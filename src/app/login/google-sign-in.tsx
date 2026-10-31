"use client";

import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

/**
 * "Continuar con Google".
 *
 * Two ways to sign in, the first one preferred when it's available:
 *
 * 1. Google Identity Services (GIS), when NEXT_PUBLIC_GOOGLE_CLIENT_ID is set.
 *    Google's own button opens a popup (or the browser's FedCM sheet) that
 *    returns a signed ID token to this page; `signInWithIdToken` hands it to
 *    Supabase, which checks it and creates the session cookies. The browser
 *    never visits <project>.supabase.co, so Google's screen says "Ir a
 *    travio.com.mx" (the page's origin) instead of the Supabase project URL.
 *
 * 2. The classic redirect (POST /auth/google → Supabase → Google → back), used
 *    when GIS isn't configured or its script can't load (blocked, offline).
 *    Here Google shows the Supabase callback's domain, because that's where
 *    it sends the user back.
 *
 * The nonce: we make a random value, give Google its SHA-256 (Google copies it
 * into the token) and give Supabase the raw value, which it hashes and compares.
 * A token stolen from somewhere else won't carry our nonce, so it can't be
 * replayed here.
 */

const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
const GIS_SRC = "https://accounts.google.com/gsi/client";

export function GoogleSignIn({ next }: { next: string }) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLDivElement>(null);
  const [gisReady, setGisReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Bumped after a failed attempt so a fresh nonce is set up for the next one.
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!CLIENT_ID) return;
    let cancelled = false;

    async function setUp() {
      await loadGisScript();
      const container = buttonRef.current;
      if (cancelled || !container || !window.google?.accounts?.id) return;

      const rawNonce = randomNonce();
      const hashedNonce = await sha256Hex(rawNonce);
      if (cancelled) return;

      window.google.accounts.id.initialize({
        client_id: CLIENT_ID!,
        nonce: hashedNonce,
        ux_mode: "popup",
        use_fedcm_for_button: true,
        callback: async ({ credential }) => {
          setBusy(true);
          setError(null);
          const supabase = createClient();
          const { error: signInError } = await supabase.auth.signInWithIdToken({
            provider: "google",
            token: credential,
            nonce: rawNonce,
          });
          if (signInError) {
            console.error("signInWithIdToken failed", signInError);
            setBusy(false);
            setError("No pudimos conectar con Google. Inténtalo de nuevo.");
            setAttempt((n) => n + 1);
            return;
          }
          // A full navigation, so the server renders with the new session cookies.
          window.location.assign(next);
        },
      });

      const dark = document.documentElement.classList.contains("dark");
      container.replaceChildren();
      window.google.accounts.id.renderButton(container, {
        type: "standard",
        theme: dark ? "filled_black" : "outline",
        size: "large",
        text: "continue_with",
        shape: "pill",
        logo_alignment: "center",
        // GIS takes a pixel width between 200 and 400.
        // Measured on the wrapper: the container itself is hidden until now.
        width: Math.max(200, Math.min(400, Math.round(wrapperRef.current?.getBoundingClientRect().width ?? 320))),
        locale: "es-419",
      });
      setGisReady(true);
    }

    setUp().catch((err) => {
      // Script blocked or offline: the redirect button below keeps working.
      console.warn("Google Identity Services unavailable", err);
    });

    return () => {
      cancelled = true;
    };
  }, [next, attempt]);

  return (
    <div ref={wrapperRef} className="flex flex-col gap-2">
      {CLIENT_ID && (
        <div
          ref={buttonRef}
          aria-busy={busy}
          className={gisReady && !busy ? "flex min-h-11 w-full justify-center" : "hidden w-full"}
        />
      )}

      {/* Until Google's button is ready (or if it never is): the redirect flow.
          A plain POST (not a Server Action): see app/auth/google/route.ts. */}
      {(!gisReady || busy) && (
        <form method="post" action="/auth/google">
          <input type="hidden" name="next" value={next} />
          <Button type="submit" variant="outline" size="lg" className="w-full" disabled={busy}>
            <GoogleIcon />
            {busy ? "Entrando…" : "Continuar con Google"}
          </Button>
        </form>
      )}

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

let gisScript: Promise<void> | null = null;

function loadGisScript(): Promise<void> {
  if (window.google?.accounts?.id) return Promise.resolve();
  gisScript ??= new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = GIS_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      gisScript = null;
      script.remove();
      reject(new Error(`Could not load ${GIS_SRC}`));
    };
    document.head.appendChild(script);
  });
  return gisScript;
}

function randomNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes)).replace(/[+/=]/g, "");
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

// The few pieces of the GIS API used above (https://developers.google.com/identity/gsi/web/reference/js-reference).
declare global {
  interface Window {
    google?: {
      accounts?: {
        id?: {
          initialize(config: {
            client_id: string;
            callback: (response: { credential: string }) => void;
            nonce?: string;
            ux_mode?: "popup" | "redirect";
            use_fedcm_for_button?: boolean;
          }): void;
          renderButton(
            parent: HTMLElement,
            options: {
              type?: "standard" | "icon";
              theme?: "outline" | "filled_blue" | "filled_black";
              size?: "large" | "medium" | "small";
              text?: "signin_with" | "signup_with" | "continue_with" | "signin";
              shape?: "rectangular" | "pill" | "circle" | "square";
              logo_alignment?: "left" | "center";
              width?: number;
              locale?: string;
            },
          ): void;
        };
      };
    };
  }
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.76h3.56c2.08-1.92 3.28-4.74 3.28-8.09Z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.56-2.76c-.98.66-2.23 1.06-3.72 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.11A6.6 6.6 0 0 1 5.5 12c0-.73.13-1.44.34-2.11V7.05H2.18A11 11 0 0 0 1 12c0 1.77.43 3.45 1.18 4.95l3.66-2.84Z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15A10.96 10.96 0 0 0 12 1 11 11 0 0 0 2.18 7.05l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38Z"
      />
    </svg>
  );
}
