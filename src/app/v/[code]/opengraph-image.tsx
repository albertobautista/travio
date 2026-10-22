import { notFound } from "next/navigation";

import { getSharePreview } from "@/lib/trips/share";
import { PREVIEW_SIZE, PREVIEW_TYPE, tripPreviewImage } from "@/lib/trips/share-image";
import { previewLine } from "@/lib/trips/share-text";

/**
 * The share link's picture (see tripPreviewImage). The id is the preview's
 * version: when the cover, name, dates or cities change, so does the URL,
 * and chat apps fetch the new picture instead of reusing the one they have.
 */
// Drawn on each request (the response itself is cacheable, see
// tripPreviewImage): a cached copy would keep a missing cover or a revoked
// link around.
export const dynamic = "force-dynamic";

export async function generateImageMetadata({ params }: { params: { code: string } }) {
  const trip = await getSharePreview(params.code);
  if (!trip) return [];
  const line = previewLine(trip);
  return [{ id: trip.version, alt: line ? `${trip.trip_name}: ${line}` : trip.trip_name, size: PREVIEW_SIZE, contentType: PREVIEW_TYPE }];
}

export default async function Image({ params }: { params: Promise<{ code: string }> }) {
  const trip = await getSharePreview((await params).code);
  if (!trip) notFound();
  return tripPreviewImage(trip);
}
