/** Mirrors the check constraint on travelers.color. */
export const TRAVELER_COLORS = ["blue", "green", "orange", "purple", "pink", "teal"] as const;
export type TravelerColor = (typeof TRAVELER_COLORS)[number];

/** Avatar fill and text. Dark text on light fills keeps contrast above 4.5:1. */
export const TRAVELER_COLOR_CLASSES: Record<TravelerColor, string> = {
  blue: "bg-sky-100 text-sky-900",
  green: "bg-emerald-100 text-emerald-900",
  orange: "bg-orange-100 text-orange-900",
  purple: "bg-violet-100 text-violet-900",
  pink: "bg-pink-100 text-pink-900",
  teal: "bg-teal-100 text-teal-900",
};

export function isTravelerColor(value: string): value is TravelerColor {
  return (TRAVELER_COLORS as readonly string[]).includes(value);
}

/** The least used color, so new travelers look different from existing ones. */
export function nextTravelerColor(used: string[]): TravelerColor {
  const counts = new Map(TRAVELER_COLORS.map((c) => [c, 0]));
  for (const c of used) if (isTravelerColor(c)) counts.set(c, (counts.get(c) ?? 0) + 1);
  return TRAVELER_COLORS.reduce((best, c) => ((counts.get(c) ?? 0) < (counts.get(best) ?? 0) ? c : best));
}
