import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { BellOff, Check } from "lucide-react";

import { Button } from "@/components/ui/button";
import { unsubscribeByToken } from "@/lib/notifications/unsubscribe";

export const metadata: Metadata = {
  title: "Dejar de recibir avisos · Travio",
  robots: { index: false, follow: false },
};

/**
 * "No recibir más avisos", from the footer of a notification email. Opening
 * the link only asks; the button does it. (Mail scanners open links on their
 * own, and that must not unsubscribe anyone.)
 */
export default async function UnsubscribePage({ searchParams }: PageProps<"/avisos/baja">) {
  const { t, listo } = await searchParams;
  const token = typeof t === "string" ? t : null;

  async function unsubscribe() {
    "use server";
    const ok = await unsubscribeByToken(token);
    redirect(ok ? `/avisos/baja?listo=1` : `/avisos/baja?t=${token ?? ""}&listo=0`);
  }

  const done = listo === "1";
  const failed = listo === "0";
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 px-4 py-12">
      <Link href="/" className="text-xl font-bold tracking-tight">
        Travio
      </Link>
      <section className="flex w-full max-w-sm animate-rise flex-col items-center gap-3 rounded-[20px] border bg-card p-6 text-center">
        <span
          aria-hidden="true"
          className={"flex size-12 items-center justify-center rounded-full " + (done ? "bg-success-soft text-success-foreground" : "bg-secondary text-primary")}
        >
          {done ? <Check className="size-6" /> : <BellOff className="size-6" />}
        </span>
        <h1 className="text-xl font-bold tracking-tight">{done ? "Listo, ya no te enviaremos avisos" : "¿Dejar de recibir avisos?"}</h1>
        <p className="text-sm text-muted-foreground">
          {done
            ? "Seguirás recibiendo las invitaciones que alguien te mande directamente. Puedes volver a activarlos cuando quieras."
            : failed
              ? "Este enlace no es válido. Puedes elegir qué avisos recibir desde tu cuenta."
              : "No te llegarán correos de cambios en tus viajes, de quién se une ni recordatorios."}
        </p>
        {!done && !failed && token && (
          <form action={unsubscribe} className="w-full">
            <Button type="submit" size="lg" className="h-11 w-full">
              Sí, no enviarme más avisos
            </Button>
          </form>
        )}
        <Button asChild variant="outline" size="lg" className="h-11 w-full">
          <Link href="/cuenta/avisos">Elegir qué avisos recibir</Link>
        </Button>
      </section>
    </main>
  );
}
