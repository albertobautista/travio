import type { Metadata } from "next";
import { CalendarDays, Clock, Link2Off, UsersRound } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getGroupLinkPreview, type GroupLinkPreview } from "@/lib/invitations/group-links";
import { createClient } from "@/lib/supabase/server";
import { formatTripDates } from "@/lib/trips/dates";
import { previewLine } from "@/lib/trips/share-text";

import { requestToJoin, switchAccount } from "./actions";
import { RequestForm } from "./request-form";

/**
 * Same rules as /invitacion (see its metadata): the token is in the URL, so
 * no Referer to other sites, out of search engines, and every way out is a
 * full page load. The WhatsApp preview is the trip's: its name in the
 * title, dates and cities in the description, and its cover in the picture
 * (./opengraph-image.tsx; decided with Alberto on 2026-10-22).
 */
export async function generateMetadata({ params }: PageProps<"/unirse/[token]">): Promise<Metadata> {
  const { token } = await params;
  const link = await getGroupLinkPreview(token);
  const title = link ? `Únete a ${link.trip_name} · Travio` : "Invitación · Travio";
  const line = link ? previewLine(link) : "";
  const description = `${line ? `${line}. ` : ""}Pide unirte al viaje: verás el itinerario, los hospedajes y los documentos cuando te acepten.`;
  return {
    title,
    description,
    openGraph: { title, description, siteName: "Travio", locale: "es_MX", type: "website" },
    referrer: "no-referrer",
    robots: { index: false, follow: false },
  };
}

/**
 * /unirse/<token>: where a group link lands. Public (see the proxy): signed
 * out it shows a preview and sends the person to sign in or sign up, coming
 * back here afterwards. Asking to join is an explicit click, and only the
 * owner's approval gives access.
 */
export default async function JoinPage({ params }: PageProps<"/unirse/[token]">) {
  const { token } = await params;
  const supabase = await createClient();
  const [link, { data: claims }] = await Promise.all([getGroupLinkPreview(token), supabase.auth.getClaims()]);
  const signedIn = Boolean(claims?.claims);
  const email = typeof claims?.claims.email === "string" ? claims.claims.email : null;

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 bg-background px-4 py-12">
      {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- full page load on purpose (see metadata) */}
      <a href="/" className="text-xl font-bold tracking-tight">
        Travio
      </a>
      <Card className="w-full max-w-sm overflow-hidden pt-0">
        {link ? (
          <JoinBody link={link} token={token} signedIn={signedIn} email={email} />
        ) : (
          <Problem
            title="Este enlace ya no es válido"
            text="Puede que lo hayan desactivado o cambiado por otro, o que el enlace esté incompleto. Pide uno nuevo a quien lo compartió."
            signedIn={signedIn}
          />
        )}
      </Card>
    </main>
  );
}

function JoinBody({ link, token, signedIn, email }: { link: GroupLinkPreview; token: string; signedIn: boolean; email: string | null }) {
  const inviter = link.inviter_name ?? "Alguien";

  switch (link.status) {
    case "member":
      return (
        <>
          <TripHeader link={link} lead="Ya tienes acceso a" />
          <CardContent className="flex flex-col gap-4">
            <Button asChild size="lg">
              <a href={`/viajes/${link.trip_id}`}>Abrir el viaje</a>
            </Button>
          </CardContent>
        </>
      );
    case "pending":
      return (
        <>
          <TripHeader link={link} lead="Pediste unirte a" />
          <CardContent className="flex flex-col items-center gap-3 text-center">
            <span aria-hidden="true" className="flex size-11 items-center justify-center rounded-full bg-secondary text-primary">
              <Clock className="size-5" />
            </span>
            <p className="font-medium">Tu solicitud está pendiente</p>
            <p className="text-sm text-muted-foreground">
              {inviter} tiene que aceptarla. Te avisaremos por correo{email ? ` a ${email}` : ""} en cuanto lo haga.
            </p>
            <Button asChild variant="outline" size="lg" className="mt-2 w-full">
              {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- full page load on purpose (see metadata) */}
              <a href="/viajes">Ir a Mis viajes</a>
            </Button>
          </CardContent>
        </>
      );
    case "rejected":
      return (
        <Problem
          title="No te aceptaron en este viaje"
          text={`${inviter} no aceptó tu solicitud. Si crees que es un error, escríbele directamente.`}
          signedIn={signedIn}
        />
      );
    case "expired":
      return <Problem title="Este enlace caducó" text={`Pídele a ${inviter} uno nuevo.`} signedIn={signedIn} />;
    case "full":
      return (
        <Problem
          title="Este enlace ya está completo"
          text={`Ya entró el máximo de personas que ${inviter} eligió. Pídele uno nuevo.`}
          signedIn={signedIn}
        />
      );
  }

  const next = `/unirse/${token}`;
  return (
    <>
      <TripHeader link={link} lead={`${inviter} te invita a`} />
      <CardContent className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">
          Pide unirte y {inviter} decidirá si te acepta. Verás el itinerario, los hospedajes y los documentos cuando lo haga.
          {signedIn ? " Verá tu nombre y tu correo." : ""}
        </p>

        {signedIn ? (
          <>
            <RequestForm action={requestToJoin.bind(null, token)} />
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
              <a href={`/login?next=${encodeURIComponent(next)}`}>Iniciar sesión para pedir unirme</a>
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

/** No cover photo here: the page is about asking to join (the link preview has the cover). */
function TripHeader({ link, lead }: { link: GroupLinkPreview; lead: string }) {
  return (
    <div className="flex flex-col gap-3 bg-secondary px-6 pt-6 pb-5">
      <span aria-hidden="true" className="flex size-11 items-center justify-center rounded-xl bg-card text-primary shadow-xs">
        <UsersRound className="size-5" />
      </span>
      <div className="flex flex-col gap-1">
        <p className="text-sm text-muted-foreground">{lead}</p>
        <h1 className="text-2xl font-bold tracking-tight text-balance">{link.trip_name}</h1>
      </div>
      <span className="inline-flex items-center gap-1.5 text-sm text-foreground/80">
        <CalendarDays className="size-4" aria-hidden="true" />
        {formatTripDates(link.start_date, link.end_date)}
      </span>
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
        <a href={signedIn ? "/viajes" : "/"}>{signedIn ? "Ir a Mis viajes" : "Conocer Travio"}</a>
      </Button>
    </CardContent>
  );
}
