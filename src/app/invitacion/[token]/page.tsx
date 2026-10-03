import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays, Link2Off, Plane } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getInvitationPreview, ROLE_LABELS, type InvitationPreview } from "@/lib/invitations/queries";
import { createClient } from "@/lib/supabase/server";
import { formatTripDates } from "@/lib/trips/dates";

import { acceptInvitation, switchAccount } from "./actions";
import { AcceptForm } from "./accept-form";

// The token is in the URL: don't send it to other sites in the Referer
// header, and keep the page out of search engines.
export const metadata: Metadata = {
  title: "Invitación · Travio",
  referrer: "no-referrer",
  robots: { index: false, follow: false },
};

/**
 * /invitacion/<token>: where an invitation link lands. Public (see the proxy):
 * signed out it shows a preview and sends the person to sign in or sign up,
 * coming back here afterwards. Joining is always an explicit click.
 */
export default async function InvitationPage({ params }: PageProps<"/invitacion/[token]">) {
  const { token } = await params;
  const supabase = await createClient();
  const [invitation, { data: claims }] = await Promise.all([getInvitationPreview(token), supabase.auth.getClaims()]);
  const signedIn = Boolean(claims?.claims);
  const email = typeof claims?.claims.email === "string" ? claims.claims.email : null;

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 bg-background px-4 py-12">
      <Link href="/" className="text-xl font-bold tracking-tight">
        Travio
      </Link>
      <Card className="w-full max-w-sm overflow-hidden pt-0">
        {invitation ? (
          <InvitationBody invitation={invitation} token={token} signedIn={signedIn} email={email} />
        ) : (
          <Problem
            title="Este enlace ya no es válido"
            text="Puede que la invitación se haya cancelado o que el enlace esté incompleto. Pide uno nuevo a quien te invitó."
            signedIn={signedIn}
          />
        )}
      </Card>
    </main>
  );
}

function InvitationBody({
  invitation,
  token,
  signedIn,
  email,
}: {
  invitation: InvitationPreview;
  token: string;
  signedIn: boolean;
  email: string | null;
}) {
  const inviter = invitation.inviter_name ?? "Alguien";

  if (invitation.status === "member") {
    return (
      <>
        <TripHeader invitation={invitation} lead="Ya tienes acceso a" showRole={false} />
        <CardContent className="flex flex-col gap-4">
          <Button asChild size="lg">
            <Link href={`/viajes/${invitation.trip_id}`}>Abrir el viaje</Link>
          </Button>
        </CardContent>
      </>
    );
  }
  if (invitation.status === "used") {
    return (
      <Problem
        title="Esta invitación ya se usó"
        text={`Cada enlace sirve para una sola persona. Pídele a ${inviter} uno nuevo.`}
        signedIn={signedIn}
      />
    );
  }
  if (invitation.status === "expired") {
    return (
      <Problem
        title="Esta invitación caducó"
        text={`Los enlaces duran 7 días. Pídele a ${inviter} uno nuevo.`}
        signedIn={signedIn}
      />
    );
  }

  const next = `/invitacion/${token}`;
  return (
    <>
      <TripHeader invitation={invitation} lead={`${inviter} te invitó a`} />
      <CardContent className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">
          {invitation.traveler_name
            ? `Entrarás como ${invitation.traveler_name}. `
            : invitation.adds_traveler
              ? "Te agregaremos como viajero con el nombre de tu cuenta. "
              : "Podrás seguir el viaje sin aparecer como viajero. "}
          {invitation.role === "editor"
            ? "Podrás ver el itinerario y los documentos, y agregar o cambiar planes."
            : "Podrás ver el itinerario, los hospedajes y los documentos del viaje."}
        </p>

        {signedIn ? (
          <>
            <AcceptForm action={acceptInvitation.bind(null, token)} />
            <form action={switchAccount.bind(null, token)} className="flex flex-wrap items-center justify-center gap-x-1 text-xs text-muted-foreground">
              {email && <span>Entraste como {email}.</span>}
              <button type="submit" className="min-h-11 px-1 font-medium text-primary hover:underline">
                ¿No eres tú?
              </button>
            </form>
          </>
        ) : (
          <>
            <Button asChild size="lg">
              <Link href={`/login?next=${encodeURIComponent(next)}`}>Iniciar sesión para unirme</Link>
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              ¿No tienes cuenta? Créala en el siguiente paso, con Google o con tu correo. Volverás aquí al terminar.
            </p>
          </>
        )}
      </CardContent>
    </>
  );
}

/** No cover photo: covers are private to members, and the invitee isn't one yet. */
function TripHeader({ invitation, lead, showRole = true }: { invitation: InvitationPreview; lead: string; showRole?: boolean }) {
  return (
    <div className="flex flex-col gap-3 bg-secondary px-6 pt-6 pb-5">
      <span aria-hidden="true" className="flex size-11 items-center justify-center rounded-xl bg-card text-primary shadow-xs">
        <Plane className="size-5" />
      </span>
      <div className="flex flex-col gap-1">
        <p className="text-sm text-muted-foreground">{lead}</p>
        <h1 className="text-2xl font-bold tracking-tight text-balance">{invitation.trip_name}</h1>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="inline-flex items-center gap-1.5 text-foreground/80">
          <CalendarDays className="size-4" aria-hidden="true" />
          {formatTripDates(invitation.start_date, invitation.end_date)}
        </span>
        {showRole && (
          <span className="rounded-full border border-primary/30 bg-card px-2.5 py-0.5 text-xs font-medium text-primary">
            {ROLE_LABELS[invitation.role]}
          </span>
        )}
      </div>
    </div>
  );
}

function Problem({ title, text, signedIn }: { title: string; text: string; signedIn: boolean }) {
  return (
    <CardContent className="flex flex-col items-center gap-3 pt-6 text-center">
      <span aria-hidden="true" className="flex size-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Link2Off className="size-5" />
      </span>
      <h1 className="text-xl font-bold tracking-tight">{title}</h1>
      <p className="text-sm text-muted-foreground">{text}</p>
      <Button asChild variant="outline" size="lg" className="mt-2 w-full">
        <Link href={signedIn ? "/viajes" : "/"}>{signedIn ? "Ir a Mis viajes" : "Conocer Travio"}</Link>
      </Button>
    </CardContent>
  );
}
