import "server-only";

import { ImageResponse } from "next/og";
import sharp from "sharp";

import { geistFonts, Plane } from "@/lib/og/brand";
import { createAdminClient } from "@/lib/supabase/admin";

import { COVERS_BUCKET } from "./covers";
import { formatTripDates } from "./dates";
import type { TripPreview } from "./share";
import { routeLine } from "./share-text";

/**
 * The picture a shared trip link shows in WhatsApp & co.: the trip's cover
 * with its name, dates and cities on it (or Travio blue without a cover).
 *
 * Two steps, because neither tool does both:
 * 1. sharp crops the cover to 1200×630. It reads JPG, PNG and WebP (Satori
 *    can't read WebP) and writes a small JPEG: WhatsApp skips big pictures,
 *    and a photo as PNG easily weighs over a megabyte.
 * 2. Satori (ImageResponse) draws the text and the dark gradient on a
 *    transparent layer, which sharp lays over the photo.
 *
 * The cover is in a private bucket and whoever fetches the picture isn't
 * signed in, so it's read with the secret key. Callers only get here after
 * get_trip_share_preview or get_trip_group_link found the link, and the
 * bytes never leave as anything but this picture.
 */

export const PREVIEW_SIZE = { width: 1200, height: 630 };
export const PREVIEW_TYPE = "image/jpeg";

const BLUE = "#1F5EDB";

async function coverBytes(tripId: string) {
  try {
    const admin = createAdminClient();
    const { data: trip } = await admin.from("trips").select("cover_image_path").eq("id", tripId).maybeSingle();
    if (!trip?.cover_image_path) return null;
    const { data, error } = await admin.storage.from(COVERS_BUCKET).download(trip.cover_image_path);
    if (error) throw error;
    return Buffer.from(await data.arrayBuffer());
  } catch (error) {
    // No secret key (local dev) or a missing file: the blue version.
    console.error("Cover for the link preview failed", error);
    return null;
  }
}

async function photoBase(cover: Buffer) {
  try {
    // rotate(): phone photos carry their orientation in EXIF.
    return await sharp(cover).rotate().resize(PREVIEW_SIZE.width, PREVIEW_SIZE.height, { fit: "cover", position: "attention" }).toBuffer();
  } catch (error) {
    console.error("Cover for the link preview is unreadable", error);
    return null;
  }
}

export async function tripPreviewImage(trip: TripPreview): Promise<Response> {
  const cover = trip.has_cover ? await coverBytes(trip.trip_id) : null;
  const photo = cover ? await photoBase(cover) : null;

  const overlay = Buffer.from(await new ImageResponse(<Overlay trip={trip} photo={Boolean(photo)} />, { ...PREVIEW_SIZE, fonts: await geistFonts() }).arrayBuffer());

  const base = photo ?? sharp({ create: { ...PREVIEW_SIZE, channels: 3, background: BLUE } }).png().toBuffer();
  const jpeg = await sharp(await base)
    .composite([{ input: overlay }])
    .jpeg({ quality: 80, mozjpeg: true })
    .toBuffer();

  return new Response(new Uint8Array(jpeg), {
    headers: {
      "Content-Type": PREVIEW_TYPE,
      // The URL changes with the preview's version; the hour bounds how long
      // a revoked group link's picture can linger in a cache.
      "Cache-Control": "public, max-age=3600",
    },
  });
}

function Overlay({ trip, photo }: { trip: TripPreview; photo: boolean }) {
  const dates = trip.start_date ? formatTripDates(trip.start_date, trip.end_date) : null;
  const route = trip.cities.length ? routeLine(trip.cities) : null;
  const titleSize = trip.trip_name.length > 32 ? 60 : trip.trip_name.length > 18 ? 76 : 92;

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "56px 64px",
        fontFamily: "Geist",
        color: "#ffffff",
        position: "relative",
        // Dark at the top (the badge) and the bottom (the text), the photo in between.
        // Spread, not undefined: Satori chokes on undefined style values.
        ...(photo && {
          backgroundImage:
            "linear-gradient(180deg, rgba(11,27,51,0.45) 0%, rgba(11,27,51,0) 30%, rgba(11,27,51,0.15) 45%, rgba(11,27,51,0.88) 100%)",
        }),
      }}
    >
      {!photo && (
        <div style={{ position: "absolute", right: -120, top: -150, display: "flex", transform: "rotate(12deg)" }}>
          <Plane size={620} stroke="rgba(255,255,255,0.08)" width={1} />
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ width: 52, height: 52, borderRadius: 15, background: photo ? BLUE : "rgba(255,255,255,0.16)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Plane size={28} stroke="#ffffff" />
        </div>
        <span style={{ fontSize: 36, fontWeight: 700, letterSpacing: -1 }}>Travio</span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <span style={{ fontSize: titleSize, fontWeight: 700, lineHeight: 1.04, letterSpacing: -2.5, maxWidth: 1060, lineClamp: 2 }}>{trip.trip_name}</span>
        {(dates || route) && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 32, color: "rgba(255,255,255,0.9)" }}>
            {dates && <span style={{ fontWeight: 600 }}>{dates}</span>}
            {route && <span style={{ maxWidth: 1060, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{route}</span>}
          </div>
        )}
      </div>
    </div>
  );
}
