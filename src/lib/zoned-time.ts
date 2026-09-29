/**
 * Converting between a local wall time in an IANA time zone ("2027-04-08
 * 10:30 in Europe/London") and an absolute instant (a JS Date / timestamptz).
 *
 * Works in both the browser and Node using only Intl, so the form can preview
 * times with exactly the same logic the server uses to save them.
 */

const partsFormatters = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timeZone: string) {
  let f = partsFormatters.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    partsFormatters.set(timeZone, f);
  }
  return f;
}

/** The wall-clock fields of `instant` as seen in `timeZone`. */
function wallClock(instant: Date, timeZone: string) {
  const parts = formatterFor(timeZone).formatToParts(instant);
  const get = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((p) => p.type === type)?.value);
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
    second: get("second"),
  };
}

/** How far `timeZone` is ahead of UTC at `instant`, in ms (London in summer: +3 600 000). */
function offsetAt(instant: Date, timeZone: string) {
  const w = wallClock(instant, timeZone);
  const wallAsUtc = Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute, w.second);
  return wallAsUtc - Math.floor(instant.getTime() / 1000) * 1000;
}

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * "2027-04-08" + "10:30" in "Europe/London" -> the instant 2027-04-08T09:30:00Z.
 *
 * The offset depends on the instant we're looking for, so we guess with the
 * offset at the wall time read as UTC, then try the offset at that guess.
 * The two only differ around a daylight saving change:
 *   - Normally one of them maps back to the same wall time; we use it.
 *   - A wall time skipped by a spring-forward change (02:30 when clocks jump
 *     from 02:00 to 03:00) maps to neither. Like Postgres, we read it with the
 *     offset from before the jump, which lands after the gap (03:30).
 */
export function zonedTimeToInstant(date: string, time: string, timeZone: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  const [h, min] = time.split(":").map(Number);
  const wall = Date.UTC(y, m - 1, d, h, min);

  const first = wall - offsetAt(new Date(wall), timeZone);
  const second = wall - offsetAt(new Date(first), timeZone);
  if (first === second) return new Date(first);

  const mapsBack = (instant: number) => wall - offsetAt(new Date(instant), timeZone) === instant;
  if (mapsBack(second)) return new Date(second);
  return new Date(Math.max(first, second));
}

/** An instant -> its local "YYYY-MM-DD" and "HH:MM" in `timeZone`. */
export function instantToZonedTime(instant: Date | string, timeZone: string) {
  const w = wallClock(new Date(instant), timeZone);
  return {
    date: `${w.year}-${pad(w.month)}-${pad(w.day)}`,
    time: `${pad(w.hour)}:${pad(w.minute)}`,
  };
}

const momentFormatters = new Map<string, Intl.DateTimeFormat>();

/** "lun 29 sep · 15:00", in the given time zone (a stay's, a departure's…). */
export function formatLocalMoment(iso: string, timeZone: string) {
  let f = momentFormatters.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat("es-MX", { weekday: "short", day: "numeric", month: "short", timeZone });
    momentFormatters.set(timeZone, f);
  }
  const day = f.format(new Date(iso)).replace(/\./g, "").replace(",", "").replace(/ de /g, " ");
  return `${day} · ${instantToZonedTime(iso, timeZone).time}`;
}
