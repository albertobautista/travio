/**
 * IANA time zones for pickers. Until Google Places fills a stop's time zone
 * automatically, the user picks one from this list.
 */

export type TimeZoneOption = {
  /** IANA name, e.g. "Europe/London". This is what we store. */
  id: string;
  /** Current UTC offset, e.g. "GMT+1". Changes with daylight saving time. */
  offset: string;
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

function currentOffset(timeZone: string, now: Date) {
  return (
    new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "shortOffset" })
      .formatToParts(now)
      .find((part) => part.type === "timeZoneName")?.value ?? ""
  );
}

export function listTimeZones(now: Date = new Date()): TimeZoneOption[] {
  return Intl.supportedValuesOf("timeZone").map((id) => ({ id, offset: currentOffset(id, now) }));
}
