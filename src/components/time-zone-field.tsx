"use client";

import { useId, useMemo, useState } from "react";
import { Clock } from "lucide-react";

import { Input } from "@/components/ui/input";
import { fold, searchTimeZones, timeZoneLabel, type TimeZoneMatch, type TimeZoneOption } from "@/lib/time-zones";

/** "Miami (MIA)" -> "miami mia", to find a city name inside a place's name. */
const words = (text: string) => fold(text).split(/[^\p{L}\p{N}]+/u).filter(Boolean).join(" ");

type Props = {
  id: string;
  /** Form field name; the hidden input sends the IANA id ("America/New_York"). */
  name: string;
  value: string;
  onChange: (timeZone: string) => void;
  options: TimeZoneOption[];
  /** Zones offered before typing: the trip's cities, this device's zone. */
  suggested?: string[];
  invalid?: boolean;
  describedBy?: string;
  /** The place this zone is for ("Miami"): shown instead of the zone's main city when it's one of its cities. */
  placeName?: string;
};

/**
 * Time zone picker that searches the way people think: "Miami", "Cancún",
 * "hora del Pacífico", "GMT-5". Shows "Nueva York · GMT-4" when chosen and
 * sends the IANA id. A combobox with its list under the field (like the place
 * search), so it works the same with a phone keyboard open.
 */
export function TimeZoneField({ id, name, value, onChange, options, suggested = [], invalid, describedBy, placeName }: Props) {
  const listId = `${useId()}-zones`;
  const [editing, setEditing] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(-1);
  // The city picked from the list ("Miami"), so the field reads as chosen
  // instead of the zone's main city ("Nueva York"). Same zone either way.
  const [picked, setPicked] = useState<{ id: string; title: string } | null>(null);

  const byId = useMemo(() => new Map(options.map((o) => [o.id, o])), [options]);
  const current = byId.get(value);
  const results: TimeZoneMatch[] = useMemo(() => {
    if (query.trim()) return searchTimeZones(options, query);
    // Only computed in the browser: the list shows after focusing the field.
    const device = typeof window === "undefined" ? [] : [Intl.DateTimeFormat().resolvedOptions().timeZone];
    return [...new Set([value, ...suggested, ...device])].flatMap((z) => {
      const option = byId.get(z);
      return option ? [{ option, title: option.names[0] }] : [];
    });
  }, [query, options, suggested, byId, value]);
  const open = editing && results.length > 0;

  function pick(match: TimeZoneMatch) {
    onChange(match.option.id);
    setPicked({ id: match.option.id, title: match.title });
    setEditing(false);
    setQuery("");
  }

  function finish() {
    // Someone who typed an exact IANA name ("Europe/Paris") gets it.
    const exact = options.find((o) => o.id.toLowerCase() === query.trim().toLowerCase());
    if (exact) onChange(exact.id);
    setEditing(false);
    setQuery("");
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") return finish();
    if (!open) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => (i + 1) % results.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (i <= 0 ? results.length - 1 : i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault(); // pick, don't submit the form
      pick(results[Math.max(active, 0)]);
    }
  }

  const title = current
    ? picked?.id === current.id
      ? picked.title
      : (current.names.find((n) => placeName && ` ${words(placeName)} `.includes(` ${words(n)} `)) ?? null)
    : null;
  const label = current ? (title ? `${title} · ${current.offset}` : timeZoneLabel(current)) : value;
  const others = current ? current.names.filter((n) => n !== (title ?? current.names[0])).slice(0, 3) : [];
  const shown = editing ? query : label;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="relative">
        <Clock className="pointer-events-none absolute top-3 left-3 size-5 text-muted-foreground" aria-hidden="true" />
        <Input
          id={id}
          value={shown}
          placeholder={editing && current ? label : "Busca una ciudad: Miami, Madrid, Tokio…"}
          autoComplete="off"
          spellCheck={false}
          enterKeyHint="search"
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(-1);
          }}
          onFocus={(e) => {
            setEditing(true);
            setQuery("");
            // On a phone, lift the field so the list fits above the keyboard.
            if (window.matchMedia("(max-width: 767px)").matches) e.currentTarget.scrollIntoView({ block: "center", behavior: "smooth" });
          }}
          onBlur={() => setTimeout(finish, 150)}
          onKeyDown={onKeyDown}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={listId}
          aria-activedescendant={open && active >= 0 ? `${listId}-${active}` : undefined}
          aria-invalid={invalid}
          aria-describedby={describedBy}
          className="h-11 pl-10"
        />
        {open && (
          <ul
            id={listId}
            role="listbox"
            aria-label="Zonas horarias"
            className="absolute inset-x-0 top-12 z-20 max-h-72 overflow-y-auto rounded-xl border bg-card p-1 shadow-lg"
          >
            {!query.trim() && (
              <li aria-hidden="true" className="px-2 pt-1 pb-0.5 text-[11px] font-medium text-muted-foreground">
                Sugeridas
              </li>
            )}
            {results.map((m, i) => (
              <li
                key={m.option.id}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === active}
                // mousedown (before the input's blur) so the tap isn't lost.
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(m);
                }}
                className={
                  "flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-2 py-1.5 " +
                  (i === active ? "bg-secondary" : "hover:bg-muted")
                }
              >
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm font-medium">{m.title}</span>
                  <span className="truncate text-xs text-muted-foreground first-letter:uppercase">
                    {m.option.generic}
                    {m.title !== m.option.names[0] ? ` · igual que ${m.option.names[0]}` : ""}
                  </span>
                </span>
                <span className="shrink-0 font-mono text-xs text-muted-foreground">{m.option.offset}</span>
              </li>
            ))}
          </ul>
        )}
        {editing && query.trim().length >= 2 && results.length === 0 && (
          <p className="absolute inset-x-0 top-12 z-20 rounded-xl border bg-card p-3 text-sm text-muted-foreground shadow-lg">
            No la encontramos. Prueba con una ciudad grande cercana o con la diferencia horaria, por ejemplo “GMT-5”.
          </p>
        )}
      </div>
      {current && !editing && (
        <p className="text-xs text-muted-foreground first-letter:uppercase">
          {current.generic}
          {others.length > 0 ? ` · también ${others.join(", ")}` : ""}
        </p>
      )}
      <input type="hidden" name={name} value={value} />
    </div>
  );
}
