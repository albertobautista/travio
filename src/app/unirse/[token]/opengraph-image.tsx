import { notFound } from "next/navigation";

import { getGroupLinkPreview } from "@/lib/invitations/group-links";
import { PREVIEW_SIZE, PREVIEW_TYPE, tripPreviewImage } from "@/lib/trips/share-image";
import { previewLine } from "@/lib/trips/share-text";

/** The group link shows the trip's picture too (same as /v/<code>, see there). */
// Drawn on each request (the response itself is cacheable, see
// tripPreviewImage): a cached copy would keep a missing cover or a revoked
// link around.
export const dynamic = "force-dynamic";

export async function generateImageMetadata({ params }: { params: { token: string } }) {
  const trip = await getGroupLinkPreview(params.token);
  if (!trip) return [];
  const line = previewLine(trip);
  return [{ id: trip.version, alt: line ? `${trip.trip_name}: ${line}` : trip.trip_name, size: PREVIEW_SIZE, contentType: PREVIEW_TYPE }];
}

export default async function Image({ params }: { params: Promise<{ token: string }> }) {
  const trip = await getGroupLinkPreview((await params).token);
  if (!trip) notFound();
  return tripPreviewImage(trip);
}
