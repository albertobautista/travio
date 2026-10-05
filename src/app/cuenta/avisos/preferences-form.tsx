"use client";

import { useActionState } from "react";
import { Check } from "lucide-react";

import { Button } from "@/components/ui/button";

import { savePreferences, type PreferencesState } from "./actions";

type Props = {
  initial: { members: boolean; changes: string; reminders: boolean };
  options: { value: string; label: string; hint: string }[];
};

export function PreferencesForm({ initial, options }: Props) {
  const [state, action, pending] = useActionState<PreferencesState, FormData>(savePreferences, undefined);

  const toggle = (name: "members" | "reminders", title: string, hint: string) => (
    <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-xl border bg-card p-4 has-checked:border-primary/40">
      <input type="checkbox" name={name} defaultChecked={initial[name]} className="mt-1 size-4 accent-primary" />
      <span className="flex flex-col">
        <span className="font-medium">{title}</span>
        <span className="text-sm text-muted-foreground">{hint}</span>
      </span>
    </label>
  );

  return (
    <form action={action} className="flex flex-col gap-5">
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 font-semibold">Cambios en tus viajes</legend>
        <p className="-mt-1 mb-1 text-sm text-muted-foreground">
          Actividades, hospedajes, transporte y documentos que agregan o cambian otras personas. Los tuyos nunca te llegan.
        </p>
        {options.map((o) => (
          <label
            key={o.value}
            className="flex min-h-11 cursor-pointer items-start gap-3 rounded-xl border bg-card p-4 has-checked:border-primary has-checked:bg-secondary"
          >
            <input type="radio" name="changes" value={o.value} defaultChecked={initial.changes === o.value} className="mt-1 accent-primary" />
            <span className="flex flex-col">
              <span className="font-medium">{o.label}</span>
              <span className="text-sm text-muted-foreground">{o.hint}</span>
            </span>
          </label>
        ))}
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 font-semibold">Otros avisos</legend>
        {toggle("members", "Quién se une o sale", "En los viajes que son tuyos o a los que invitaste a alguien. Llega al momento.")}
        {toggle("reminders", "Recordatorio antes de viajar", "El día anterior: lo del primer día y tus documentos.")}
      </fieldset>

      {state?.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
      <div className="flex items-center gap-3">
        <Button type="submit" size="lg" className="h-11 px-6" disabled={pending}>
          {pending ? "Guardando…" : "Guardar"}
        </Button>
        {state?.saved && !pending && (
          <span role="status" className="flex animate-rise items-center gap-1.5 text-sm text-success-foreground">
            <Check className="size-4" aria-hidden="true" />
            Guardado
          </span>
        )}
      </div>
    </form>
  );
}
