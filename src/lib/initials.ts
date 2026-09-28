/** "Alberto Chávez Bautista" -> "AC"; no name -> "?". */
export function initials(name: string | null | undefined) {
  const words = name?.trim().split(/\s+/).filter(Boolean) ?? [];
  return words.length === 0 ? "?" : words.slice(0, 2).map((w) => w[0].toUpperCase()).join("");
}
