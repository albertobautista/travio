// Generates the app icons (PWA, iPhone home screen, browser tab) from the
// Lucide "plane" used as the logo in the sidebar. Run: node scripts/generate-icons.mjs
// Output is committed; rerun only when the logo changes.
import sharp from "sharp";

const BLUE = "#1F5EDB"; // --primary in globals.css
const PLANE =
  "M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z";

/**
 * size: output pixels. radius: corner radius as a share of the size (0 = full
 * bleed, for maskable and Apple icons, which the OS crops itself).
 * plane: the plane's width as a share of the size. Maskable icons keep it
 * inside the central 80% "safe zone" that every mask shape preserves.
 */
function svg({ size, radius, plane }) {
  const r = radius * size;
  const p = plane * size;
  const offset = (size - p) / 2;
  const scale = p / 24;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${r}" fill="${BLUE}"/>
  <g transform="translate(${offset} ${offset}) scale(${scale})">
    <path d="${PLANE}" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  </g>
</svg>`;
}

const icons = [
  { file: "public/icons/icon-192.png", size: 192, radius: 0.22, plane: 0.56 },
  { file: "public/icons/icon-512.png", size: 512, radius: 0.22, plane: 0.56 },
  { file: "public/icons/icon-maskable-512.png", size: 512, radius: 0, plane: 0.46 },
  { file: "src/app/apple-icon.png", size: 180, radius: 0, plane: 0.56 },
  { file: "src/app/icon.png", size: 64, radius: 0.22, plane: 0.62 },
];

for (const icon of icons) {
  await sharp(Buffer.from(svg(icon))).png().toFile(icon.file);
  console.log("wrote", icon.file);
}
