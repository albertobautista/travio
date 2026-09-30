"use client";

import { useEffect, useState } from "react";
import { MapPin } from "lucide-react";

import { rememberStopPlace } from "@/app/viajes/[id]/ciudades/actions";
import { importMapsLibrary, mapsConfigured } from "@/lib/maps/load";

type Props = {
  tripId: string;
  stopId: string;
  name: string;
  placeId: string | null;
  lat: number | null;
  lng: number | null;
  /** Editors save the place found by name, so later views skip the search. */
  canRemember: boolean;
  className?: string;
};

type Photo = { src: string; author: string | null; authorUrl: string | null };

/**
 * A city's photo from Google Places (API).
 *
 * Google's terms allow keeping place ids but not the photos, so the image is
 * fetched when shown: by place id when we have it (Place Details → photos),
 * otherwise by a text search for the city, whose place id we then remember.
 * Each photo must credit its author, shown over the image.
 */
export function CityPhoto({ tripId, stopId, name, placeId, lat, lng, canRemember, className = "" }: Props) {
  const [photo, setPhoto] = useState<Photo | null>(null);

  useEffect(() => {
    if (!mapsConfigured()) return;
    let cancelled = false;
    (async () => {
      try {
        const { Place } = await importMapsLibrary("places");
        let place: google.maps.places.Place | undefined;
        if (placeId) {
          place = new Place({ id: placeId });
          await place.fetchFields({ fields: ["photos"] });
        } else {
          const { places } = await Place.searchByText({
            textQuery: name,
            fields: ["id", "photos"],
            includedType: "locality",
            maxResultCount: 1,
            language: "es",
            ...(lat !== null && lng !== null ? { locationBias: { center: { lat, lng }, radius: 50_000 } } : {}),
          });
          place = places[0];
          if (place?.id && canRemember) void rememberStopPlace(tripId, stopId, place.id);
        }
        const first = place?.photos?.[0];
        if (!first || cancelled) return;
        const attribution = first.authorAttributions[0];
        setPhoto({
          // Sized for a card; Google bills the same, but it downloads faster.
          src: first.getURI({ maxWidth: 480, maxHeight: 320 }),
          author: attribution?.displayName ?? null,
          authorUrl: attribution?.uri ?? null,
        });
      } catch (e) {
        // No photo is fine: the placeholder stays.
        console.error("City photo failed", name, e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tripId, stopId, name, placeId, lat, lng, canRemember]);

  return (
    <div className={"relative overflow-hidden bg-secondary " + className}>
      {photo ? (
        <>
          {/* Plain <img>: Google's photo URLs are short-lived and can't be cached by us. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photo.src} alt={`Foto de ${name}`} className="size-full object-cover" />
          {photo.author && (
            <a
              href={photo.authorUrl ?? undefined}
              target="_blank"
              rel="noopener noreferrer"
              className="absolute right-0 bottom-0 left-0 truncate bg-foreground/55 px-1.5 py-0.5 text-[9px] text-white hover:underline"
            >
              © {photo.author}
            </a>
          )}
        </>
      ) : (
        <div className="flex size-full items-center justify-center text-primary/60" aria-hidden="true">
          <MapPin className="size-5" />
        </div>
      )}
    </div>
  );
}
