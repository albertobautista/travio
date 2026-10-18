"use client";

import { useEffect, useState } from "react";

import { selectClass } from "@/components/form-field";
import { HOME_CURRENCY_COOKIE, parseHomeCurrency } from "@/lib/budget/home-currency";
import { CURRENCIES } from "@/lib/trips/currencies";

/** "Tu moneda", for budgets of trips in another currency. Saved in a cookie on this device. */
export function HomeCurrencyPicker() {
  const [value, setValue] = useState("MXN");

  useEffect(() => {
    const m = document.cookie.match(new RegExp(`(?:^|; )${HOME_CURRENCY_COOKIE}=([A-Za-z]+)`));
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the cookie is only readable in the browser
    setValue(parseHomeCurrency(m?.[1]) ?? "none");
  }, []);

  return (
    <section aria-labelledby="moneda" className="flex flex-col gap-2">
      <h2 id="moneda" className="font-semibold">
        Tu moneda
      </h2>
      <select
        aria-labelledby="moneda"
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          document.cookie = `${HOME_CURRENCY_COOKIE}=${e.target.value}; path=/; max-age=31536000; samesite=lax`;
        }}
        className={selectClass}
      >
        {CURRENCIES.map((c) => (
          <option key={c.code} value={c.code}>
            {c.code} · {c.label}
          </option>
        ))}
        <option value="none">No mostrar</option>
      </select>
      <p className="text-sm text-muted-foreground">
        Si un viaje está en otra moneda, su presupuesto también te muestra los totales en esta.
      </p>
    </section>
  );
}
