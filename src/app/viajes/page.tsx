import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";

import { signOut } from "../login/actions";

export const metadata: Metadata = {
  title: "Mis viajes · Travio",
};

export default async function TripsPage() {
  const supabase = await createClient();

  // The proxy already redirects signed-out users; this is the real check.
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims.sub;
  if (!userId) {
    redirect("/login?next=/viajes");
  }

  // No filter by user needed: RLS only returns trips this user is a member of.
  const [{ data: profile }, { data: trips, error }] = await Promise.all([
    supabase.from("profiles").select("display_name, avatar_url").eq("id", userId).single(),
    supabase.from("trips").select("id, name, start_date, end_date").order("start_date"),
  ]);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-8">
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Mis viajes</h1>
          <div className="mt-1 flex items-center gap-2">
            <Avatar>
              {profile?.avatar_url && (
                // Google may refuse to serve profile photos when a Referer header is sent.
                <AvatarImage src={profile.avatar_url} alt="" referrerPolicy="no-referrer" />
              )}
              <AvatarFallback>{initials(profile?.display_name)}</AvatarFallback>
            </Avatar>
            <p className="text-muted-foreground">
              Hola{profile?.display_name ? `, ${profile.display_name}` : ""}.
            </p>
          </div>
        </div>
        <form action={signOut}>
          <Button type="submit" variant="ghost">
            Cerrar sesión
          </Button>
        </form>
      </header>

      {error ? (
        <p role="alert" className="text-destructive">
          No pudimos cargar tus viajes. Recarga la página.
        </p>
      ) : trips.length === 0 ? (
        <p className="rounded-xl border border-dashed bg-card p-8 text-center text-muted-foreground">
          Aún no tienes viajes.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {trips.map((trip) => (
            <li key={trip.id} className="rounded-xl border bg-card p-4 font-semibold">
              {trip.name}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

/** "Alberto Chávez Bautista" -> "AC"; no name -> "?". */
function initials(name: string | null | undefined) {
  const words = name?.trim().split(/\s+/).filter(Boolean) ?? [];
  return words.length === 0 ? "?" : words.slice(0, 2).map((w) => w[0].toUpperCase()).join("");
}
