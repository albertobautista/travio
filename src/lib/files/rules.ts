/**
 * Trip document rules, shared by the browser (early feedback) and the server.
 * The `trip-files` bucket enforces the same size and type limits (see the
 * trip_files migration); keep them in sync.
 */

export const FILES_BUCKET = "trip-files";
export const MAX_FILE_BYTES = 10 * 1024 * 1024;

/** Allowed MIME types. HEIC is what iPhones take photos in. */
export const FILE_TYPES = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
} as const;

export type FileMimeType = keyof typeof FILE_TYPES;

/** For <input accept>: MIME types plus extensions, since some browsers don't know HEIC's type. */
export const FILE_ACCEPT = [...Object.keys(FILE_TYPES), ...Object.values(FILE_TYPES).map((ext) => `.${ext}`)].join(",");

export function isFileType(type: string): type is FileMimeType {
  return type in FILE_TYPES;
}

/**
 * The MIME type to upload with. Browsers usually tell us (`file.type`), but
 * Chrome on macOS reports HEIC photos as "", so fall back to the extension.
 * The bucket still checks the result against its allowed list.
 */
export function mimeTypeOf(file: { name: string; type: string }): FileMimeType | null {
  if (isFileType(file.type)) return file.type;
  const ext = file.name.split(".").pop()?.toLowerCase();
  if (ext === "jpeg") return "image/jpeg";
  const match = Object.entries(FILE_TYPES).find(([, e]) => e === ext);
  return match ? (match[0] as FileMimeType) : null;
}

/** A user-facing error for a picked file, or null if it's acceptable. */
export function validateFile(file: { name: string; type: string; size: number }) {
  if (!mimeTypeOf(file)) return "Sube un PDF o una imagen (JPG, PNG, WebP o HEIC).";
  if (file.size === 0) return "El archivo está vacío.";
  if (file.size > MAX_FILE_BYTES) return "El archivo pesa más de 10 MB. Elige uno más ligero.";
  return null;
}

/**
 * "Boleto Tren Kraków–Viena (1).PDF" -> "boleto-tren-krakow-viena-1.pdf".
 * Storage keys only allow a limited set of characters, so the stored name is a
 * plain ASCII copy. The original name is kept in the database for display.
 */
export function safeFileName(name: string, type: FileMimeType) {
  const base = name
    .replace(/\.[^.]*$/, "") // drop the extension; we add a trusted one
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // "ó" -> "o"
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return `${base || "archivo"}.${FILE_TYPES[type]}`;
}

/** "{tripId}/{fileId}/{safe-name}": see the trip_files migration for why. */
export function newFilePath(tripId: string, fileId: string, name: string, type: FileMimeType) {
  return `${tripId}/${fileId}/${safeFileName(name, type)}`;
}

/** Checks that a path has exactly the shape newFilePath produces for this trip and file. */
export function isFilePathFor(path: string, tripId: string, fileId: string) {
  const [trip, file, name, ...rest] = path.split("/");
  return rest.length === 0 && trip === tripId && file === fileId && /^[a-z0-9-]+\.[a-z]+$/.test(name ?? "");
}

// ---------------------------------------------------------------------------
// Document types: how the Documents page groups files.
// ---------------------------------------------------------------------------

export const DOCUMENT_TYPES = {
  flight: "Vuelos",
  train: "Trenes",
  hotel: "Hoteles",
  tour: "Tours",
  ticket: "Tickets",
  insurance: "Seguros",
  other: "Otros",
} as const;

export type DocumentType = keyof typeof DOCUMENT_TYPES;

export function isDocumentType(value: unknown): value is DocumentType {
  return typeof value === "string" && value in DOCUMENT_TYPES;
}

/** "2.4 MB", "830 KB". */
export function formatFileSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
