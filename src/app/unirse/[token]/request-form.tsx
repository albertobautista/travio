"use client";

import { useActionState, useEffect } from "react";

import { Button } from "@/components/ui/button";

import type { JoinRequestState } from "./actions";

/** requestToJoin already bound to the token by the page (server side). */
type Props = {
  action: (prev: JoinRequestState, formData: FormData) => Promise<JoinRequestState>;
};

export function RequestForm({ action: serverAction }: Props) {
  const [state, action, pending] = useActionState(serverAction, undefined);
  const tripUrl = state?.tripUrl;

  // A full page load, so the trip doesn't inherit this page's referrer policy.
  useEffect(() => {
    if (tripUrl) window.location.assign(tripUrl);
  }, [tripUrl]);

  return (
    <form action={action} className="flex flex-col gap-4">
      {state?.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
      <Button type="submit" size="lg" disabled={pending || Boolean(tripUrl)}>
        {pending ? "Enviando…" : "Pedir unirme"}
      </Button>
    </form>
  );
}
