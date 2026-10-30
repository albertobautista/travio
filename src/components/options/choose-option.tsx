"use client";

import { useActionState } from "react";
import { CalendarCheck, CheckCircle2 } from "lucide-react";

import { Button } from "@/components/ui/button";

type State = { error?: string } | undefined;
type Action = () => Promise<State>;

type Props = {
  /** Server actions bound to the option: mark it as booked, or as chosen but still to book. */
  chooseBooked: Action;
  choosePlanned: Action;
};

/** "¿Te decidiste?": turns an option into part of the trip. */
export function ChooseOption({ chooseBooked, choosePlanned }: Props) {
  const [bookedState, bookedAction, bookedPending] = useActionState(chooseBooked, undefined);
  const [plannedState, plannedAction, plannedPending] = useActionState(choosePlanned, undefined);
  const pending = bookedPending || plannedPending;
  const error = bookedState?.error ?? plannedState?.error;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 sm:flex-row">
        <form action={bookedAction} className="flex-1">
          <Button type="submit" size="lg" disabled={pending} className="h-11 w-full">
            <CheckCircle2 aria-hidden="true" />
            {bookedPending ? "Guardando…" : "Ya la reservé"}
          </Button>
        </form>
        <form action={plannedAction} className="flex-1">
          <Button type="submit" size="lg" variant="outline" disabled={pending} className="h-11 w-full">
            <CalendarCheck aria-hidden="true" />
            {plannedPending ? "Guardando…" : "Elegirla, falta reservar"}
          </Button>
        </form>
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
