"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { GoogleSignIn } from "./google-sign-in";
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
        <GoogleSignIn next={next} />

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
