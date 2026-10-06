import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Bell, ChevronLeft, ChevronRight } from "lucide-react";

import { SignOutButton } from "@/components/offline/sign-out-button";
import { createClient } from "@/lib/supabase/server";

import { ThemePicker } from "./theme-picker";

export const metadata: Metadata = {
  title: "Tu cuenta · Travio",
};

/** Settings that belong to the person, not to a trip: appearance and emails. */
export default async function AccountPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) redirect("/login?next=/cuenta");
  const email = typeof data.claims.email === "string" ? data.claims.email : null;

  return (
    <main className="stagger mx-auto flex w-full max-w-lg flex-1 flex-col gap-6 px-4 py-6">
      <header className="flex flex-col gap-2">
        <Link href="/viajes" className="-ml-2 inline-flex min-h-11 w-fit items-center gap-1 px-2 text-sm text-muted-foreground hover:text-foreground">
          <ChevronLeft className="size-4" aria-hidden="true" />
          Mis viajes
        </Link>
        <div>
          <h1 className="text-[28px] leading-tight font-bold tracking-tight">Tu cuenta</h1>
          {email && <p className="text-sm text-muted-foreground">{email}</p>}
        </div>
      </header>

      <ThemePicker />

      <section aria-labelledby="correo" className="flex flex-col gap-2">
        <h2 id="correo" className="font-semibold">
          Correo
        </h2>
        <Link href="/cuenta/avisos" className="pressable flex min-h-14 items-center gap-3 rounded-2xl border bg-card px-4 py-2 hover:bg-muted">
          <Bell className="size-5 shrink-0 text-primary" aria-hidden="true" />
          <span className="flex flex-1 flex-col">
            <span className="font-medium">Avisos por correo</span>
            <span className="text-sm text-muted-foreground">Resumen de cambios · quién se une · recordatorios</span>
          </span>
          <ChevronRight className="size-4 text-muted-foreground" aria-hidden="true" />
        </Link>
      </section>

      <div className="mt-auto rounded-2xl border bg-card p-1">
        <SignOutButton />
      </div>
    </main>
  );
}
