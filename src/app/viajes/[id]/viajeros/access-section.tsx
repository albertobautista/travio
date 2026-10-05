import { Clock } from "lucide-react";

import { InviteForm } from "@/components/access/invite-form";
import { LeaveTripButton, ManageMemberButton, RevokeInvitationButton } from "@/components/access/member-actions";
import { TravelerAvatar } from "@/components/travelers/traveler-avatar";
import { getPendingInvitations, ROLE_LABELS } from "@/lib/invitations/queries";
import { createClient } from "@/lib/supabase/server";
import type { Traveler } from "@/lib/travelers/queries";
import { getMembers, type TripRole } from "@/lib/trips/queries";

import {
  changeMemberRole,
  createInvitation,
  deleteInvitation,
  leaveTrip,
  removeMember,
  transferOwnership,
} from "./access-actions";

const dayMonth = new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short", timeZone: "UTC" });

/**
 * "Acceso al viaje" on the Viajeros page: who has an account on this trip and
 * with which role, plus invitations. Everyone sees the list; only the owner
 * gets the controls (the database enforces the same rule).
 */
export async function AccessSection({
  trip,
  role,
  travelers,
}: {
  trip: { id: string; name: string };
  role: TripRole | null;
  travelers: Traveler[];
}) {
  const supabase = await createClient();
  const [members, invitations, { data: claims }] = await Promise.all([
    getMembers(trip.id),
    getPendingInvitations(trip.id),
    supabase.auth.getClaims(),
  ]);
  const me = claims?.claims.sub;
  const isOwner = role === "owner";
  const travelerOf = new Map(travelers.filter((t) => t.user_id).map((t) => [t.user_id, t]));
  const unlinked = travelers.filter((t) => !t.user_id).map((t) => ({ id: t.id, name: t.name }));

  return (
    <section aria-labelledby="access" className="flex flex-col gap-3">
      <div>
        <h2 id="access" className="text-lg font-semibold">
          Acceso al viaje
        </h2>
        <p className="text-sm text-muted-foreground">
          Personas con cuenta de Travio que pueden ver el viaje{isOwner ? ". Solo tú decides quién entra." : "."}
        </p>
      </div>

      <ul className="flex flex-col divide-y rounded-2xl border bg-card">
        {members.map((m) => {
          const name = m.profiles?.display_name ?? "Sin nombre";
          const traveler = travelerOf.get(m.user_id);
          const memberRole = m.role as TripRole;
          return (
            <li key={m.user_id} className="flex min-h-14 items-center gap-3 px-4 py-2">
              <TravelerAvatar
                traveler={{ name, color: traveler?.color ?? "blue", avatar_url: m.profiles?.avatar_url ?? null }}
              />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate font-medium">
                  {name}
                  {m.user_id === me && <span className="font-normal text-muted-foreground"> (tú)</span>}
                </span>
                <span className="truncate text-xs text-muted-foreground">
                  {ROLE_LABELS[memberRole]}
                  {traveler ? ` · viaja como ${traveler.name}` : " · no está en la lista de viajeros"}
                </span>
              </span>
              {isOwner && memberRole !== "owner" && (
                <ManageMemberButton
                  name={name}
                  role={memberRole}
                  changeRole={changeMemberRole.bind(null, trip.id, m.user_id)}
                  remove={removeMember.bind(null, trip.id, m.user_id)}
                  makeOwner={transferOwnership.bind(null, trip.id, m.user_id)}
                />
              )}
            </li>
          );
        })}
      </ul>

      {isOwner && invitations.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-medium text-muted-foreground">Invitaciones pendientes</h3>
          <ul className="flex flex-col divide-y rounded-2xl border bg-card">
            {invitations.map((inv) => {
              const who = inv.traveler_name ?? (inv.adds_traveler ? "Alguien nuevo que viaja" : "Alguien que seguirá el viaje");
              return (
                <li key={inv.id} className="flex min-h-14 items-center gap-3 px-4 py-2">
                  <span
                    aria-hidden="true"
                    className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground"
                  >
                    <Clock className="size-4" />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm font-medium">{who}</span>
                    <span className={"text-xs " + (inv.expired ? "text-warning-foreground" : "text-muted-foreground")}>
                      {inv.email ? `Enviada a ${inv.email} · ` : ""}
                      {ROLE_LABELS[inv.role]} ·{" "}
                      {inv.expired
                        ? "caducó, crea un enlace nuevo"
                        : `caduca el ${dayMonth.format(new Date(inv.expires_at)).replace(".", "")}`}
                    </span>
                  </span>
                  <RevokeInvitationButton
                    revoke={deleteInvitation.bind(null, trip.id, inv.id)}
                    label={`Cancelar la invitación para ${who}`}
                  />
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {isOwner && (
        <div className="flex flex-col gap-3 rounded-2xl border bg-card p-5">
          <div>
            <h3 className="font-semibold">Invitar a alguien</h3>
            <p className="text-sm text-muted-foreground">
              Crea un enlace y compártelo. Si la persona no tiene cuenta, podrá crearla al abrirlo.
            </p>
          </div>
          <InviteForm action={createInvitation.bind(null, trip.id)} tripName={trip.name} travelers={unlinked} />
        </div>
      )}

      {role && role !== "owner" && (
        <LeaveTripButton tripName={trip.name} leave={leaveTrip.bind(null, trip.id)} />
      )}
    </section>
  );
}
