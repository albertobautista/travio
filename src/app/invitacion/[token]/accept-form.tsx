"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";

import type { AcceptInvitationState } from "./actions";

/** acceptInvitation already bound to the token by the page (server side). */
type Props = {
  action: (prev: AcceptInvitationState, formData: FormData) => Promise<AcceptInvitationState>;
};

export function AcceptForm({ action: serverAction }: Props) {
  const [state, action, pending] = useActionState(serverAction, undefined);

  return (
    <form action={action} className="flex flex-col gap-4">
      {state?.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? "Uniéndote…" : "Unirme al viaje"}
      </Button>
    </form>
  );
}
