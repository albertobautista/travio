import type { Metadata } from "next";

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
    <main className="flex flex-1 flex-col items-center justify-center gap-8 px-4 py-12">
      <div className="flex flex-col items-center gap-1 text-center">
        <h1 className="text-3xl font-bold tracking-tight">Travio</h1>
        <p className="text-muted-foreground">Tu viaje, todo en un lugar.</p>
      </div>
      <LoginForm next={next} initialError={errorKey ? ERROR_MESSAGES[errorKey] : undefined} />
    </main>
  );
}
