import type { Metadata } from "next";
import { Plane } from "lucide-react";

import { OfflineHousekeeping } from "@/components/offline/offline-housekeeping";
import { safeRedirectPath } from "@/lib/safe-redirect";

import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Iniciar sesión · Travio",
};

const ERROR_MESSAGES: Record<string, string> = {
  google: "No pudimos conectar con Google. Inténtalo de nuevo.",
  callback: "El enlace no es válido o ya expiró. Inicia sesión de nuevo.",
};

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const next = safeRedirectPath(typeof params.next === "string" ? params.next : null);
  const errorKey = typeof params.error === "string" ? params.error : null;

  return (
    <main className="flex flex-1 flex-col bg-card lg:flex-row">
      {/* Signed out: whatever the last person kept offline on this device goes. */}
      <OfflineHousekeeping />
      <section className="relative flex h-64 shrink-0 flex-col justify-end overflow-hidden bg-primary px-6 pt-10 pb-12 text-primary-foreground lg:h-auto lg:flex-1 lg:justify-center lg:px-16">
        <Plane aria-hidden="true" className="absolute -top-6 -right-10 size-64 rotate-12 text-white/10 lg:top-16 lg:right-10 lg:size-96" strokeWidth={1} />
        <div className="relative flex animate-rise flex-col gap-1">
          <span className="mb-3 flex size-12 items-center justify-center rounded-2xl bg-white/15" aria-hidden="true">
            <Plane className="size-6" />
          </span>
          <h1 className="text-4xl font-bold tracking-tight">Travio</h1>
          <p className="text-lg text-white/90">Tu viaje, todo en un lugar.</p>
          <p className="mt-2 hidden max-w-md text-white/80 lg:block">
            El itinerario, los hospedajes y los boletos de todos, a la mano también sin conexión.
          </p>
        </div>
      </section>
      <section className="relative -mt-6 flex flex-1 flex-col items-center rounded-t-3xl bg-card px-4 pt-6 pb-10 lg:mt-0 lg:max-w-xl lg:justify-center lg:rounded-none lg:px-12">
        <LoginForm next={next} initialError={errorKey ? ERROR_MESSAGES[errorKey] : undefined} openSignUp={params.registro === "1"} />
      </section>
    </main>
  );
}
