/** "20:26" and "GMT+1" for `now` in `timeZone`. Shared by server and browser. */
export function clockParts(now: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("es-MX", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZoneName: "shortOffset",
  }).formatToParts(now);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? "";
  return { time: `${get("hour")}:${get("minute")}`, offset: get("timeZoneName") };
}

/** "Europe/London" -> "London": a readable place when no stop applies. */
export function zoneCity(timeZone: string) {
  return timeZone.split("/").pop()!.replace(/_/g, " ");
}
