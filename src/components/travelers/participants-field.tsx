"use client";

import { TravelerAvatar } from "@/components/travelers/traveler-avatar";

type Traveler = { id: string; name: string; color: string; avatar_url: string | null };

type Props = {
  legend: string;
  travelers: Traveler[];
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
  error?: string;
};

/**
 * Traveler chips submitted as `participants` checkboxes. Everyone checked is
 * saved as "everyone" (no rows), so travelers added later are included too.
 */
export function ParticipantsField({ legend, travelers, selected, onChange, error }: Props) {
  if (travelers.length === 0) return null;
  const everyone = travelers.every((t) => selected.has(t.id));

  function toggle(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange(next);
  }

  return (
    <fieldset
      className="flex flex-col gap-2"
      aria-describedby={[error ? "participants-error" : null, "participants-hint"].filter(Boolean).join(" ")}
    >
      <legend className="mb-2 text-sm font-medium">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {travelers.map((t) => {
          const checked = selected.has(t.id);
          return (
            <label
              key={t.id}
              className={
                "flex min-h-11 cursor-pointer items-center gap-2 rounded-full border py-1 pr-3 pl-1 text-sm has-focus-visible:ring-3 has-focus-visible:ring-ring/50 " +
                (checked ? "border-primary bg-secondary font-medium text-secondary-foreground" : "bg-card text-foreground/80")
              }
            >
              <input
                type="checkbox"
                name="participants"
                value={t.id}
                checked={checked}
                onChange={() => toggle(t.id)}
                className="sr-only"
              />
              <TravelerAvatar traveler={t} size="sm" />
              {t.name}
            </label>
          );
        })}
      </div>
      <div className="flex items-center justify-between gap-3">
        <p id="participants-hint" className="text-xs text-muted-foreground">
          {everyone ? "Van todos. Quien agregues después al viaje también irá." : "Solo las personas marcadas."}
        </p>
        {!everyone && (
          <button
            type="button"
            onClick={() => onChange(new Set(travelers.map((t) => t.id)))}
            className="min-h-11 shrink-0 px-1 text-sm font-medium text-primary hover:underline"
          >
            Marcar a todos
          </button>
        )}
      </div>
      {error && (
        <p id="participants-error" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </fieldset>
  );
}
