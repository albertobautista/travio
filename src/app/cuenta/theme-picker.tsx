"use client";

import { useEffect, useState } from "react";

import { applyTheme, readTheme, type Theme } from "@/lib/theme";

const OPTIONS: { value: Theme; label: string }[] = [
  { value: "system", label: "Sistema" },
  { value: "light", label: "Claro" },
  { value: "dark", label: "Oscuro" },
];

/** A small drawing of the app in that mode: title bar, a card, a button. */
function Preview({ mode }: { mode: "light" | "dark" }) {
  const dark = mode === "dark";
  return (
    <span className={"flex flex-1 flex-col gap-1.5 p-2.5 " + (dark ? "bg-[#0A1220]" : "bg-[#F7F9FC]")}>
      <span className={"h-2 w-4/5 rounded " + (dark ? "bg-[#E8EEF8]" : "bg-[#0B1B33]")} />
      <span className={"h-7 rounded border " + (dark ? "border-[#1F2C44] bg-[#111C2E]" : "border-[#E3E8F0] bg-white")} />
      <span className={"h-2 w-3/5 rounded " + (dark ? "bg-[#356EE6]" : "bg-[#1F5EDB]")} />
    </span>
  );
}

/** Sistema / Claro / Oscuro. Applies at once; saved in a cookie on this device. */
export function ThemePicker() {
  const [theme, setTheme] = useState<Theme>("system");

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the cookie is only readable in the browser
    setTheme(readTheme());
  }, []);

  return (
    <fieldset className="flex flex-col gap-2.5">
      <legend className="mb-2.5 font-semibold">Apariencia</legend>
      <div className="grid grid-cols-3 gap-2.5">
        {OPTIONS.map((o) => (
          <label
            key={o.value}
            className="pressable flex cursor-pointer flex-col gap-2.5 rounded-2xl border bg-card p-2.5 has-checked:border-primary has-checked:ring-1 has-checked:ring-primary"
          >
            <span aria-hidden="true" className="flex h-24 overflow-hidden rounded-[10px] border">
              {o.value === "system" ? (
                <>
                  <Preview mode="light" />
                  <Preview mode="dark" />
                </>
              ) : (
                <Preview mode={o.value} />
              )}
            </span>
            <span className="flex items-center gap-2 text-sm font-semibold">
              <input
                type="radio"
                name="theme"
                value={o.value}
                checked={theme === o.value}
                onChange={() => {
                  setTheme(o.value);
                  applyTheme(o.value);
                }}
                className="accent-primary"
              />
              {o.label}
            </span>
          </label>
        ))}
      </div>
      <p className="text-sm text-muted-foreground">
        «Sistema» sigue la configuración de tu teléfono: claro de día y oscuro de noche si lo tienes así. Se guarda en este dispositivo.
      </p>
    </fieldset>
  );
}
