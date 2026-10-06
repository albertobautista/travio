"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { signIn, signUp, type AuthFormState } from "./actions";

type LoginFormProps = {
  next: string;
  /** Open on "Crear cuenta" (the landing's "Empieza gratis"). */
  openSignUp?: boolean;
  initialError?: string;
};

export function LoginForm({ next, initialError, openSignUp = false }: LoginFormProps) {
  const [signInState, signInAction, signingIn] = useActionState(signIn, undefined);
  const [signUpState, signUpAction, signingUp] = useActionState(signUp, undefined);

  return (
    <Card className="w-full max-w-sm animate-rise border-0 bg-transparent py-0 shadow-none ring-0 [animation-delay:80ms]">
      <CardContent className="flex flex-col gap-5 px-0">
        {/* A plain POST (not a Server Action): see app/auth/google/route.ts. */}
        <form method="post" action="/auth/google">
          <input type="hidden" name="next" value={next} />
          <Button type="submit" variant="outline" size="lg" className="w-full">
            <GoogleIcon />
            Continuar con Google
          </Button>
        </form>

        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="h-px flex-1 bg-border" />o con tu correo
          <span className="h-px flex-1 bg-border" />
        </div>

        <Tabs defaultValue={openSignUp ? "sign-up" : "sign-in"}>
          <TabsList className="w-full">
            <TabsTrigger value="sign-in">Iniciar sesión</TabsTrigger>
            <TabsTrigger value="sign-up">Crear cuenta</TabsTrigger>
          </TabsList>

          <TabsContent value="sign-in">
            <form action={signInAction} className="flex flex-col gap-4 pt-2">
              <input type="hidden" name="next" value={next} />
              <Field id="sign-in-email" name="email" label="Correo" type="email" autoComplete="email" />
              <Field
                id="sign-in-password"
                name="password"
                label="Contraseña"
                type="password"
                autoComplete="current-password"
              />
              <FormFeedback state={signInState ?? (initialError ? { error: initialError } : undefined)} />
              <Button type="submit" size="lg" disabled={signingIn}>
                {signingIn ? "Entrando…" : "Iniciar sesión"}
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="sign-up">
            <form action={signUpAction} className="flex flex-col gap-4 pt-2">
              <input type="hidden" name="next" value={next} />
              <Field id="sign-up-name" name="name" label="Nombre" autoComplete="name" />
              <Field id="sign-up-email" name="email" label="Correo" type="email" autoComplete="email" />
              <Field
                id="sign-up-password"
                name="password"
                label="Contraseña"
                type="password"
                autoComplete="new-password"
                minLength={8}
                hint="Al menos 8 caracteres."
              />
              <FormFeedback state={signUpState} />
              <Button type="submit" size="lg" disabled={signingUp}>
                {signingUp ? "Creando cuenta…" : "Crear cuenta"}
              </Button>
            </form>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

type FieldProps = React.ComponentProps<typeof Input> & {
  id: string;
  label: string;
  hint?: string;
};

function Field({ id, label, hint, ...inputProps }: FieldProps) {
  const hintId = hint ? `${id}-hint` : undefined;
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} required aria-describedby={hintId} className="h-11" {...inputProps} />
      {hint && (
        <p id={hintId} className="text-xs text-muted-foreground">
          {hint}
        </p>
      )}
    </div>
  );
}

function FormFeedback({ state }: { state: AuthFormState }) {
  if (state?.error) {
    return (
      <p role="alert" className="text-sm text-destructive">
        {state.error}
      </p>
    );
  }
  if (state?.message) {
    return (
      <p role="status" className="rounded-lg bg-success-soft p-3 text-sm text-success-foreground">
        {state.message}
      </p>
    );
  }
  return null;
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
