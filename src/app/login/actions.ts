"use server";

import type { AuthError } from "@supabase/supabase-js";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { callbackUrl } from "@/lib/auth/callback-url";
import { safeRedirectPath } from "@/lib/safe-redirect";
import { createClient } from "@/lib/supabase/server";

export type AuthFormState = { error?: string; message?: string } | undefined;

const MIN_PASSWORD_LENGTH = 8;

/** Absolute URL of this app, needed for links Supabase sends the user back to. */
async function getOrigin() {
  const h = await headers();
  const origin = h.get("origin");
  if (origin) return origin;
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const protocol = h.get("x-forwarded-proto") ?? "http";
  return `${protocol}://${host}`;
}


/** Supabase errors are in English and sometimes too revealing; show our own copy. */
function authErrorMessage(error: AuthError) {
  switch (error.code) {
    case "invalid_credentials":
      return "Correo o contraseña incorrectos.";
    case "email_not_confirmed":
      return "Confirma tu correo antes de iniciar sesión. Revisa tu bandeja de entrada.";
    case "user_already_exists":
    case "email_exists":
      return "Ya existe una cuenta con ese correo. Inicia sesión.";
    case "weak_password":
      return "La contraseña es demasiado débil. Usa al menos 8 caracteres.";
    case "over_email_send_rate_limit":
    case "over_request_rate_limit":
      return "Demasiados intentos. Espera unos minutos e inténtalo de nuevo.";
    default:
      return "Algo salió mal. Inténtalo de nuevo.";
  }
}

function readCredentials(formData: FormData) {
  return {
    email: String(formData.get("email") ?? "").trim(),
    password: String(formData.get("password") ?? ""),
    next: safeRedirectPath(formData.get("next") as string | null),
  };
}

export async function signIn(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const { email, password, next } = readCredentials(formData);
  if (!email || !password) {
    return { error: "Escribe tu correo y tu contraseña." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    return { error: authErrorMessage(error) };
  }

  redirect(next);
}

export async function signUp(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const { email, password, next } = readCredentials(formData);
  const name = String(formData.get("name") ?? "").trim();

  if (!name || !email || !password) {
    return { error: "Completa tu nombre, correo y contraseña." };
  }
  // Checked here too: the browser's minLength can be bypassed.
  if (password.length < MIN_PASSWORD_LENGTH) {
    return { error: `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.` };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      // Read by the handle_new_user trigger to fill profiles.display_name.
      data: { full_name: name },
      emailRedirectTo: callbackUrl(await getOrigin(), next),
    },
  });
  if (error) {
    return { error: authErrorMessage(error) };
  }

  // With email confirmation off (local dev) Supabase signs the user in right away.
  if (data.session) {
    redirect(next);
  }
  return { message: `Te enviamos un correo a ${email}. Abre el enlace para activar tu cuenta.` };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
