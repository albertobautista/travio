/**
 * Trip cover rules, shared by the browser (early feedback) and the server.
 * The bucket enforces the same size and type limits (see the
 * trip_covers_storage migration); keep them in sync.
 */

export const COVERS_BUCKET = "trip-covers";
export const MAX_COVER_BYTES = 5 * 1024 * 1024;

/** Allowed MIME types and the extension we store each one with. */
export const COVER_TYPES = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
} as const;

export type CoverMimeType = keyof typeof COVER_TYPES;

export const COVER_ACCEPT = Object.keys(COVER_TYPES).join(",");

export function isCoverType(type: string): type is CoverMimeType {
  return type in COVER_TYPES;
}

/** A user-facing error for a picked file, or null if it's acceptable. */
export function validateCoverFile(file: { type: string; size: number }) {
  if (!isCoverType(file.type)) return "Usa una imagen JPG, PNG o WebP.";
  if (file.size > MAX_COVER_BYTES) return "La imagen pesa más de 5 MB. Elige una más ligera.";
  return null;
}

/**
 * "{tripId}/{random uuid}.{ext}". A fresh random name per upload means we never
 * overwrite a file, so no browser or CDN can serve a stale photo.
 */
export function newCoverPath(tripId: string, type: CoverMimeType) {
  return `${tripId}/${crypto.randomUUID()}.${COVER_TYPES[type]}`;
}

/** Checks that a path has exactly the shape newCoverPath produces for this trip. */
export function isCoverPathForTrip(path: string, tripId: string) {
  const [folder, file, ...rest] = path.split("/");
  return (
    rest.length === 0 &&
    folder === tripId &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$/.test(file ?? "")
  );
}
