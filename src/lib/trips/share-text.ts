import { formatTripDates } from "./dates";

/** "Londres → Cracovia → Viena", or the first few and how many more. */
export function routeLine(cities: string[], max = 4) {
  if (cities.length <= max) return cities.join(" → ");
  return `${cities.slice(0, max - 1).join(" → ")} y ${cities.length - (max - 1)} más`;
}

/** The line under a trip's name in a link preview: dates and route, whichever it has. */
export function previewLine(trip: { start_date: string | null; end_date: string | null; cities: string[] }) {
  return [trip.start_date ? formatTripDates(trip.start_date, trip.end_date) : null, trip.cities.length ? routeLine(trip.cities) : null]
    .filter(Boolean)
    .join(" · ");
}
