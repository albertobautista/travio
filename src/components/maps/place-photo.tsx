"use client";

import { useEffect, useState } from "react";
import { MapPin } from "lucide-react";

import { importMapsLibrary, mapsConfigured } from "@/lib/maps/load";

type Props = {
  /** What the photo shows, for the alt text ("Foto de …"). */
  name: string;
  /** Text to search when there's no place id ("Casa Batlló, Passeig de Gràcia 43"). */
  query: string;
  placeId: string | null;
  lat: number | null;
  lng: number | null;
  /** Narrow the text search, e.g. "locality" for cities. */
  includedType?: string;
  /** Search radius around lat/lng, in meters. */
  radius?: number;
  /**
   * Saves the place id a text search found (a bound Server Action), so later
   * views skip the search. Pass it only to people who can edit.
   */
  remember?: (placeId: string, location: { lat: number; lng: number } | null) => Promise<void>;
  /**
   * Also hand `remember` the place's location when lat/lng are missing. For
   * cities: one typed without picking it from the list has no coordinates,
   * so no weather and no pin, and the name alone finds the right place.
   */
  rememberLocation?: boolean;
  maxWidth?: number;
  maxHeight?: number;
  /** Where the required author credit goes, so it doesn't clash with overlays. */
  creditAt?: "top" | "bottom";
  className?: string;
  /** Drawn over the photo (e.g. a title band). */
  children?: React.ReactNode;
  /** Shown when there's no photo (no key, no place, or an error). */
  fallback?: React.ReactNode;
};

type Photo = { src: string; author: string | null; authorUrl: string | null };

/**
 * A place's photo from Google Places (API), loaded in the browser.
 *
 * Google's terms allow keeping place ids but not photos, so the image is
 * fetched when shown: by place id when we have it (Place Details → photos),
 * otherwise by a text search, whose place id can then be remembered. Each
 * photo must credit its author, shown over the image. Keep the key's HTTP
 * referrer restriction in mind: the <img> must send its Referer.
 */
export function PlacePhoto({
  name,
  query,
  placeId,
  lat,
  lng,
  includedType,
  radius = 50_000,
  remember,
  rememberLocation = false,
  maxWidth = 480,
  maxHeight = 320,
  creditAt = "bottom",
  className = "",
  children,
  fallback,
}: Props) {
  const [photo, setPhoto] = useState<Photo | null>(null);

  useEffect(() => {
    if (!mapsConfigured() || (!placeId && !query)) return;
    let cancelled = false;
    (async () => {
      try {
        const { Place } = await importMapsLibrary("places");
        const needsLocation = Boolean(remember) && rememberLocation && (lat === null || lng === null);
        const fields = needsLocation ? ["id", "photos", "location"] : ["id", "photos"];
        let place: google.maps.places.Place | undefined;
        if (placeId) {
          place = new Place({ id: placeId });
          await place.fetchFields({ fields });
        } else {
          const { places } = await Place.searchByText({
            textQuery: query,
            fields,
            maxResultCount: 1,
            language: "es",
            ...(includedType ? { includedType } : {}),
            ...(lat !== null && lng !== null ? { locationBias: { center: { lat, lng }, radius } } : {}),
          });
          place = places[0];
        }
        if (place?.id && remember && (!placeId || needsLocation)) {
          const location = needsLocation && place.location ? { lat: place.location.lat(), lng: place.location.lng() } : null;
          void remember(place.id, location);
        }
        const first = place?.photos?.[0];
        if (!first || cancelled) return;
        const attribution = first.authorAttributions[0];
        setPhoto({
          src: first.getURI({ maxWidth, maxHeight }),
          author: attribution?.displayName ?? null,
          authorUrl: attribution?.uri ?? null,
        });
      } catch (e) {
        // No photo is fine: the fallback stays.
        console.error("Place photo failed", name, e);
      }
    })();
    return () => {
      cancelled = true;
    };
    // `remember` is a bound Server Action: a new function each render, same effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, query, placeId, lat, lng, includedType, radius, rememberLocation, maxWidth, maxHeight]);

  return (
    <div className={"relative overflow-hidden bg-secondary " + className}>
      {photo ? (
        <>
          {/* Plain <img>: Google's photo URLs are short-lived and can't be cached by us. */}
          {/* Explicit referrerPolicy: Google checks the Referer against the key's allowed sites. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photo.src}
            alt={`Foto de ${name}`}
            referrerPolicy="strict-origin-when-cross-origin"
            className="size-full object-cover"
          />
          {photo.author && (
            <a
              href={photo.authorUrl ?? undefined}
              target="_blank"
              rel="noopener noreferrer"
              className={
                "absolute max-w-full truncate bg-black/55 px-1.5 py-0.5 text-[9px] text-white hover:underline " +
                (creditAt === "top" ? "top-0 right-0 rounded-bl-md" : "right-0 bottom-0 left-0")
              }
            >
              © {photo.author}
            </a>
          )}
        </>
      ) : (
        (fallback ?? (
          <div className="flex size-full items-center justify-center text-primary/60" aria-hidden="true">
            <MapPin className="size-5" />
          </div>
        ))
      )}
      {children}
    </div>
  );
}
