/**
 * IANA time zones for pickers. We store the IANA name ("America/New_York"),
 * but nobody thinks in those: people look for "Miami" or "hora del Pacífico".
 * So each zone carries the cities a traveler would type (in Spanish), its
 * generic name and its current offset, and the picker searches all of them.
 *
 * When a place is picked from Google, its time zone comes with it and the
 * picker is only a fallback.
 */

export type TimeZoneOption = {
  /** IANA name, e.g. "Europe/London". This is what we store. */
  id: string;
  /** Current UTC offset, e.g. "GMT+1". Changes with daylight saving time. */
  offset: string;
  /** Cities that use this zone, best known first: ["Nueva York", "Miami", …]. */
  names: string[];
  /** Generic name in Spanish, e.g. "hora del este de Norteamérica". */
  generic: string;
};

/**
 * Cities travelers type that either aren't in the IANA name (Miami lives in
 * America/New_York) or are spelled differently in Spanish (Londres). The
 * first name is the zone's label. Zones not listed use their IANA city.
 */
const CITIES: Record<string, string[]> = {
  // Norteamérica
  "America/New_York": ["Nueva York", "Miami", "Orlando", "Boston", "Washington", "Atlanta", "Filadelfia", "Fort Lauderdale"],
  "America/Chicago": ["Chicago", "Houston", "Dallas", "Austin", "San Antonio", "Nueva Orleans"],
  "America/Denver": ["Denver", "Salt Lake City"],
  "America/Phoenix": ["Phoenix", "Gran Cañón"],
  "America/Los_Angeles": ["Los Ángeles", "San Francisco", "Las Vegas", "San Diego", "Seattle"],
  "America/Anchorage": ["Anchorage", "Alaska"],
  "Pacific/Honolulu": ["Honolulu", "Hawái"],
  "America/Toronto": ["Toronto", "Montreal", "Ottawa", "Quebec"],
  "America/Vancouver": ["Vancouver"],
  "America/Mexico_City": ["Ciudad de México", "CDMX", "Guadalajara", "Monterrey", "Puebla", "Oaxaca", "Querétaro", "Mérida"],
  "America/Cancun": ["Cancún", "Playa del Carmen", "Tulum", "Cozumel"],
  "America/Tijuana": ["Tijuana", "Mexicali"],
  "America/Mazatlan": ["Mazatlán", "La Paz", "Los Cabos"],
  "America/Hermosillo": ["Hermosillo"],
  // Caribe, Centro y Sudamérica
  "America/Havana": ["La Habana"],
  "America/Santo_Domingo": ["Santo Domingo", "Punta Cana"],
  "America/Puerto_Rico": ["San Juan (Puerto Rico)"],
  "America/Guatemala": ["Guatemala"],
  "America/Costa_Rica": ["San José (Costa Rica)"],
  "America/Panama": ["Panamá"],
  "America/Bogota": ["Bogotá", "Medellín", "Cartagena"],
  "America/Lima": ["Lima", "Cusco"],
  "America/Caracas": ["Caracas"],
  "America/Santiago": ["Santiago de Chile"],
  "America/Argentina/Buenos_Aires": ["Buenos Aires"],
  "America/Montevideo": ["Montevideo"],
  "America/Sao_Paulo": ["São Paulo", "Río de Janeiro"],
  // Europa
  "Europe/London": ["Londres", "Edimburgo", "Manchester"],
  "Europe/Dublin": ["Dublín"],
  "Europe/Lisbon": ["Lisboa", "Oporto"],
  "Atlantic/Canary": ["Islas Canarias", "Tenerife", "Gran Canaria"],
  "Europe/Madrid": ["Madrid", "Barcelona", "Sevilla", "Valencia", "Málaga", "Bilbao"],
  "Europe/Paris": ["París", "Niza", "Lyon"],
  "Europe/Brussels": ["Bruselas"],
  "Europe/Amsterdam": ["Ámsterdam"],
  "Europe/Berlin": ["Berlín", "Múnich", "Fráncfort"],
  "Europe/Zurich": ["Zúrich", "Ginebra"],
  "Europe/Rome": ["Roma", "Milán", "Venecia", "Florencia", "Nápoles"],
  "Europe/Vienna": ["Viena"],
  "Europe/Prague": ["Praga"],
  "Europe/Budapest": ["Budapest"],
  "Europe/Warsaw": ["Varsovia", "Cracovia"],
  "Europe/Copenhagen": ["Copenhague"],
  "Europe/Stockholm": ["Estocolmo"],
  "Europe/Oslo": ["Oslo"],
  "Europe/Helsinki": ["Helsinki"],
  "Europe/Athens": ["Atenas"],
  "Europe/Istanbul": ["Estambul"],
  "Europe/Moscow": ["Moscú"],
  // África, Asia y Oceanía
  "Africa/Casablanca": ["Marrakech", "Casablanca"],
  "Africa/Cairo": ["El Cairo"],
  "Asia/Dubai": ["Dubái", "Abu Dabi"],
  "Asia/Kolkata": ["Nueva Delhi", "Bombay"],
  "Asia/Bangkok": ["Bangkok"],
  "Asia/Singapore": ["Singapur"],
  "Asia/Shanghai": ["Pekín", "Shanghái"],
  "Asia/Hong_Kong": ["Hong Kong"],
  "Asia/Seoul": ["Seúl"],
  "Asia/Tokyo": ["Tokio", "Kioto", "Osaka"],
  "Australia/Sydney": ["Sídney"],
  "Australia/Melbourne": ["Melbourne"],
  "Pacific/Auckland": ["Auckland"],
};

/** True for IANA names this runtime knows. The database check is stricter still. */
export function isKnownTimeZone(timeZone: string) {
  if (!timeZone || !timeZone.includes("/")) return timeZone === "UTC";
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch {
    return false;
  }
}

function zoneName(timeZone: string, now: Date, style: "shortOffset" | "longGeneric", locale: string) {
  return (
    new Intl.DateTimeFormat(locale, { timeZone, timeZoneName: style })
      .formatToParts(now)
      .find((part) => part.type === "timeZoneName")?.value ?? ""
  );
}

/** "America/Argentina/Buenos_Aires" -> "Buenos Aires". */
const cityOf = (id: string) => id.slice(id.lastIndexOf("/") + 1).replace(/_/g, " ");

export function listTimeZones(now: Date = new Date()): TimeZoneOption[] {
  return Intl.supportedValuesOf("timeZone").map((id) => {
    const city = cityOf(id);
    const names = CITIES[id] ?? [city];
    return {
      id,
      offset: zoneName(id, now, "shortOffset", "en-US"),
      // Keep the IANA city too ("New York"), for people who type it in English.
      names: names.some((n) => fold(n) === fold(city)) ? names : [...names, city],
      generic: zoneName(id, now, "longGeneric", "es"),
    };
  });
}

/** Lowercase, no accents: "Cancún" and "cancun" are the same search. */
export function fold(text: string) {
  return text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();
}

export type TimeZoneMatch = { option: TimeZoneOption; /** What matched, to show as the title ("Miami"). */ title: string };

/**
 * Zones matching what the user typed, best first: a city starting with the
 * text, then a city containing it, then the zone's generic name, IANA id or
 * offset ("GMT-5", "-5"). Cities listed for a zone rank above the hundreds of
 * small places IANA also names.
 */
export function searchTimeZones(options: TimeZoneOption[], query: string, limit = 30): TimeZoneMatch[] {
  const q = fold(query);
  if (!q) return [];
  const offsetQuery = q.replace(/^(gmt|utc)\s*/, "");
  const scored: { match: TimeZoneMatch; score: number }[] = [];
  for (const option of options) {
    const known = option.id in CITIES ? 0 : 1;
    const starts = option.names.find((n) => fold(n).startsWith(q));
    const contains = starts ?? option.names.find((n) => fold(n).includes(q));
    const title = contains ?? option.names[0];
    let score: number | null = null;
    if (starts) score = 0 + known;
    else if (contains) score = 2 + known;
    else if (fold(option.generic).includes(q) || fold(option.id).replace(/_/g, " ").includes(q)) score = 4 + known;
    else if (/^[+-]\d/.test(offsetQuery) && fold(option.offset).replace(/^gmt/, "").startsWith(offsetQuery)) score = 6 + known;
    if (score !== null) scored.push({ match: { option, title }, score });
  }
  return scored
    .sort((a, b) => a.score - b.score || a.match.title.localeCompare(b.match.title, "es"))
    .slice(0, limit)
    .map((s) => s.match);
}

/**
 * A zone guessed from a place's name, for forms where it's typed by hand
 * ("Miami (MIA)", "Aeropuerto de Cancún"). Only the cities listed above, as
 * whole words, so "Lima" doesn't match "Limassol". Null when unsure.
 */
export function guessTimeZone(text: string): string | null {
  const t = ` ${fold(text).replace(/[^\p{L}\p{N}]+/gu, " ")} `;
  for (const [id, names] of Object.entries(CITIES)) {
    if (names.some((n) => t.includes(` ${fold(n).replace(/[^\p{L}\p{N}]+/gu, " ")} `))) return id;
  }
  return null;
}

/** "Nueva York · GMT-4": how a stored zone reads in a form. */
export function timeZoneLabel(option: TimeZoneOption) {
  return `${option.names[0]} · ${option.offset}`;
}
