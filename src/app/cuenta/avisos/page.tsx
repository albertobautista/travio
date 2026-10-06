import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import { CHANGES_OPTIONS } from "@/lib/notifications/options";
import { createClient } from "@/lib/supabase/server";

import { PreferencesForm } from "./preferences-form";

export const metadata: Metadata = {
  title: "Avisos por correo · Travio",
};

/** What emails this person wants. No row yet means the defaults. */
export default async function NotificationPreferencesPage() {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims.sub;
  if (!userId) redirect("/login?next=/cuenta/avisos");

  const { data } = await supabase.from("notification_preferences").select("members, changes, reminders").eq("user_id", userId).maybeSingle();
  const email = typeof claims?.claims.email === "string" ? claims.claims.email : null;

  return (
    <main className="stagger mx-auto flex w-full max-w-lg flex-1 flex-col gap-5 px-4 py-6">
      <header className="flex flex-col gap-2">
        <Link href="/cuenta" className="-ml-2 inline-flex min-h-11 w-fit items-center gap-1 px-2 text-sm text-muted-foreground hover:text-foreground">
          <ChevronLeft className="size-4" aria-hidden="true" />
          Tu cuenta
        </Link>
        <h1 className="text-[28px] leading-tight font-bold tracking-tight">Avisos por correo</h1>
        {email && <p className="text-sm text-muted-foreground">Te llegan a {email}.</p>}
      </header>
      <PreferencesForm initial={data ?? { members: true, changes: "daily", reminders: true }} options={CHANGES_OPTIONS} />
    </main>
  );
}
