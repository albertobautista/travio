import { readFile } from "node:fs/promises";
import { join } from "node:path";

// Shared by the link preview pictures (src/app/opengraph-image.tsx and the
// trip previews in src/lib/trips/share-image.tsx). The image renderer
// (Satori) is not a browser: every element with more than one child needs
// display: flex, styles are inline, and fonts must be passed as files (Geist
// from the `geist` package; Next's file tracing ships them with the routes
// that render at request time).

const fontDir = join(process.cwd(), "node_modules/geist/dist/fonts/geist-sans");

/** Geist regular, semibold and bold, as ImageResponse's `fonts` option. */
export async function geistFonts() {
  const [regular, semibold, bold] = await Promise.all([
    readFile(join(fontDir, "Geist-Regular.ttf")),
    readFile(join(fontDir, "Geist-SemiBold.ttf")),
    readFile(join(fontDir, "Geist-Bold.ttf")),
  ]);
  return [
    { name: "Geist", data: regular, weight: 400 as const, style: "normal" as const },
    { name: "Geist", data: semibold, weight: 600 as const, style: "normal" as const },
    { name: "Geist", data: bold, weight: 700 as const, style: "normal" as const },
  ];
}

const PLANE =
  "M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z";

/** Lucide's plane, the app icon. */
export function Plane({ size: px, stroke, width = 2 }: { size: number; stroke: string; width?: number }) {
  return (
    <svg width={px} height={px} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round">
      <path d={PLANE} />
    </svg>
  );
}
