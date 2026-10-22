import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Link2Off, Lock } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { getSharePreview } from "@/lib/trips/share";
import { previewLine } from "@/lib/trips/share-text";

/**
 * The WhatsApp preview is the trip's: name in the title, dates and cities in
 * the description, the cover in the picture (./opengraph-image.tsx). Nothing
 * else about the trip is shown to someone outside it (decided with Alberto on
 * 2026-10-22). Like the other links: no Referer (the code is in the URL)
 * and out of search engines.
 */
export async function generateMetadata({ params }: PageProps<"/v/[code]">): Promise<Metadata> {
  const trip = await getSharePreview((await params).code);
  if (!trip) return { title: "Viaje · Travio", robots: { index: false, follow: false } };
  const title = `${trip.trip_name} · Travio`;
  const line = previewLine(trip);
  const description = line ? `${line}. Míralo en Travio.` : "Míralo en Travio.";
  return {
    title,
    description,
    openGraph: { title, description, siteName: "Travio", locale: "es_MX", type: "website" },
    referrer: "no-referrer",
    robots: { index: false, follow: false },
  };
}

/**
 * /v/<code>: the link the "Compartir" button shares. Public (see the proxy),
 * because chat apps open it with no session to build the preview. Members go
 * straight to the trip; anyone else sees the preview and how to get in. The
 * link itself never gives access.
 */
export default async function SharedTripPage({ params }: PageProps<"/v/[code]">) {
  const { code } = await params;
  const supabase = await createClient();
  const [trip, { data: claims }] = await Promise.all([getSharePreview(code), supabase.auth.getClaims()]);
  const signedIn = Boolean(claims?.claims);

  if (trip?.status === "member") redirect(`/viajes/${trip.trip_id}`);

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 bg-background px-4 py-12">
      <Link href="/" className="text-xl font-bold tracking-tight">
        Travio
      </Link>
      <Card className="w-full max-w-sm overflow-hidden pt-0">
        {trip ? (
          <>
            {/* The link preview picture itself: cover, name, dates and cities. */}
            {/* eslint-disable-next-line @next/next/no-img-element -- generated per trip, already sized */}
            <img
              src={`/v/${code}/opengraph-image/${trip.version}`}
              alt={previewLine(trip)}
              width={1200}
              height={630}
              className="aspect-[1200/630] w-full bg-primary object-cover"
            />
            <CardContent className="flex flex-col gap-4">
              <h1 className="sr-only">{trip.trip_name}</h1>
              <p className="flex gap-2 rounded-xl bg-secondary p-3 text-sm text-muted-foreground">
                <Lock className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                {signedIn
                  ? "No eres parte de este viaje. Pídele a quien te lo compartió que te invite para ver el itinerario y los documentos."
                  : "El itinerario y los documentos son solo para quienes viajan. Si eres parte del viaje, inicia sesión para verlo."}
              </p>
              {signedIn ? (
                <Button asChild variant="outline" size="lg">
                  <Link href="/viajes">Ir a Mis viajes</Link>
                </Button>
              ) : (
                <Button asChild size="lg">
                  <Link href={`/login?next=${encodeURIComponent(`/v/${code}`)}`}>Iniciar sesión</Link>
                </Button>
              )}
            </CardContent>
          </>
        ) : (
          <CardContent className="flex flex-col items-center gap-3 pt-6 text-center">
            <span aria-hidden="true" className="flex size-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <Link2Off className="size-5" />
            </span>
            <h1 className="text-xl font-bold tracking-tight">Este enlace no es válido</h1>
            <p className="text-sm text-muted-foreground">Puede que esté incompleto. Pide el enlace otra vez a quien lo compartió.</p>
            <Button asChild variant="outline" size="lg" className="mt-2 w-full">
              <Link href={signedIn ? "/viajes" : "/"}>{signedIn ? "Ir a Mis viajes" : "Conocer Travio"}</Link>
            </Button>
          </CardContent>
        )}
      </Card>
    </main>
  );
}
