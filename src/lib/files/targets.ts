import { transportMeta } from "@/lib/transportations/types";
import { instantToZonedTime } from "@/lib/zoned-time";

/**
 * What a document can be attached to. Shared by the upload form and the edit
 * dialog, in the browser and on the server. A file has at most one parent
 * (files_single_parent); none means a trip-level document.
 *
 * In <select>s a target is the string "kind:id", and "" means none.
 */

export type AttachKind = "activity" | "accommodation" | "transportation";
export type AttachTarget = { kind: AttachKind; id: string; label: string };
export type AttachIds = { activityId?: string | null; accommodationId?: string | null; transportationId?: string | null };

export const TARGET_GROUPS: { kind: AttachKind; label: string }[] = [
  { kind: "transportation", label: "Transporte" },
  { kind: "accommodation", label: "Hospedajes" },
  { kind: "activity", label: "Actividades" },
];

/** "transportation:…" -> { transportationId: "…" }; "" -> {} (no parent). */
export function parseTarget(value: string): AttachIds {
  const [kind, id] = value.split(":");
  if (!id) return {};
  if (kind === "activity") return { activityId: id };
  if (kind === "accommodation") return { accommodationId: id };
  if (kind === "transportation") return { transportationId: id };
  return {};
}

/** A file's current parent as a "kind:id" value ("" when it has none). */
export function targetValue(file: {
  activity_id: string | null;
  accommodation_id: string | null;
  transportation_id: string | null;
}) {
  if (file.transportation_id) return `transportation:${file.transportation_id}`;
  if (file.accommodation_id) return `accommodation:${file.accommodation_id}`;
  if (file.activity_id) return `activity:${file.activity_id}`;
  return "";
}

const shortDate = new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short", timeZone: "UTC" });

/** "29 sep · 21:00 · Ir al jardín", in the local time of the place. */
function label(iso: string, timeZone: string, name: string) {
  const local = instantToZonedTime(iso, timeZone);
  const day = shortDate.format(new Date(`${local.date}T00:00:00Z`)).replace(".", "");
  return `${day} · ${local.time} · ${name}`;
}

/** Every attachable thing in a trip, labeled for a picker. */
export function buildAttachTargets({
  activities,
  stays,
  legs,
}: {
  activities: { id: string; title: string; starts_at: string; timezone: string }[];
  stays: { id: string; name: string; check_in_at: string; timezone: string }[];
  legs: { id: string; type: string; origin_name: string; destination_name: string; departs_at: string; departs_timezone: string }[];
}): AttachTarget[] {
  return [
    ...legs.map((l) => ({
      kind: "transportation" as const,
      id: l.id,
      label: label(l.departs_at, l.departs_timezone, `${transportMeta(l.type).label} ${l.origin_name} → ${l.destination_name}`),
    })),
    ...stays.map((s) => ({ kind: "accommodation" as const, id: s.id, label: label(s.check_in_at, s.timezone, s.name) })),
    ...activities.map((a) => ({ kind: "activity" as const, id: a.id, label: label(a.starts_at, a.timezone, a.title) })),
  ];
}
