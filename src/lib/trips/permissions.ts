import type { TripRole } from "./queries";

/**
 * Extra permissions the owner can give a viewer (trip_members.permissions).
 * Each one means "add these, and change or delete the ones you added".
 * Owners and editors already do everything. The database enforces the same
 * rules (has_trip_permission in the RLS policies); these only decide what to show.
 */
export const MEMBER_PERMISSIONS = ["saved_places", "expenses"] as const;
export type MemberPermission = (typeof MEMBER_PERMISSIONS)[number];

/** `short` completes "también …" in the member list. */
export const PERMISSION_META: Record<MemberPermission, { label: string; hint: string; short: string }> = {
  saved_places: { label: "Guardar lugares", hint: "Agrega lugares a Guardados y edita los que guardó.", short: "guarda lugares" },
  expenses: { label: "Anotar gastos", hint: "Agrega gastos en Presupuesto y edita los que anotó.", short: "anota gastos" },
};

export const isMemberPermission = (value: string): value is MemberPermission =>
  (MEMBER_PERMISSIONS as readonly string[]).includes(value);

/** Unknown values (an older or newer database) are dropped. */
export const toMemberPermissions = (values: readonly string[] | null | undefined): MemberPermission[] =>
  (values ?? []).filter(isMemberPermission);

/** What the signed-in user may do in a trip. */
export type TripAccess = { role: TripRole | null; permissions: MemberPermission[]; userId: string | null };

/** May add this kind of thing: owners and editors always, viewers if the owner allowed it. */
export const canAdd = (access: TripAccess, permission: MemberPermission) =>
  access.role === "owner" ||
  access.role === "editor" ||
  (access.role === "viewer" && access.permissions.includes(permission));

/** May change or delete this one: owners and editors any, the others only what they added. */
export const canChange = (access: TripAccess, permission: MemberPermission, createdBy: string | null) =>
  access.role === "owner" ||
  access.role === "editor" ||
  (canAdd(access, permission) && createdBy !== null && createdBy === access.userId);
