"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Loader2, MapPin, X } from "lucide-react";

import { Field } from "@/components/form-field";
import { Input } from "@/components/ui/input";
import { importMapsLibrary, mapsConfigured } from "@/lib/maps/load";

export type PlaceValues = { name: string; address: string; placeId: string; lat: string; lng: string };

type Suggestion = { placeId: string; main: string; secondary: string; prediction: google.maps.places.PlacePrediction };

type Props = {
  /** Form field names: the place name ("location_name" or "name") and "address". */
  nameField: string;
  nameLabel: string;
  namePlaceholder: string;
  initial: PlaceValues;
  errors: { name?: string; address?: string };
  /** Bias suggestions toward the trip's city, when it has coordinates. */
  nearLat?: number | null;
  nearLng?: number | null;
  maxNameLength?: number;
  /** False for a city: just its name, no address field. */
  showAddress?: boolean;
  /** Narrow suggestions, e.g. ["(cities)"] for a trip's stops. */
  includedPrimaryTypes?: string[];
  /** Called with the picked place's time zone, so the form can fill it in. */
  onPicked?: (place: { name: string; timeZone: string | null }) => void;
};

/**
 * Place name + address, with Google place search when a Maps key is set.
 *
 * Picking a suggestion fills the name and address and stores the place id and
 * coordinates in hidden fields (so the map and "Cómo llegar" are exact). The
 * name can still be edited afterwards ("Sagrada Família · torres"); typing a
 * different address clears the stored place, since it would no longer match.
 *
 * Billing: suggestions and the final details share one session token, which
 * Google bills as a single session instead of per keystroke.
 */
export function PlaceFields({
  nameField,
  nameLabel,
  namePlaceholder,
  initial,
  errors,
  nearLat = null,
  nearLng = null,
  maxNameLength = 200,
  showAddress = true,
  includedPrimaryTypes,
  onPicked,
}: Props) {
  const ids = useId();
  const listId = `${ids}-list`;
  const configured = mapsConfigured();

  const [name, setName] = useState(initial.name);
  const [address, setAddress] = useState(initial.address);
  const [place, setPlace] = useState(
    initial.lat && initial.lng ? { placeId: initial.placeId, lat: initial.lat, lng: initial.lng } : null,
  );
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const token = useRef<google.maps.places.AutocompleteSessionToken | null>(null);
  const request = useRef(0);

  // Debounced search as the user types in the name field.
  const [query, setQuery] = useState("");
  const searching = configured && query.trim().length >= 3;
  useEffect(() => {
    if (!searching) return;
    const n = ++request.current;
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const { AutocompleteSessionToken, AutocompleteSuggestion } = await importMapsLibrary("places");
        token.current ??= new AutocompleteSessionToken();
        const { suggestions: found } = await AutocompleteSuggestion.fetchAutocompleteSuggestions({
          input: query,
          sessionToken: token.current,
          language: "es",
          ...(includedPrimaryTypes ? { includedPrimaryTypes } : {}),
          ...(nearLat !== null && nearLng !== null
            ? { locationBias: { center: { lat: nearLat, lng: nearLng }, radius: 20_000 } }
            : {}),
        });
        if (n !== request.current) return; // a newer search is on its way
        setSuggestions(
          found.flatMap((s) =>
            s.placePrediction
              ? [
                  {
                    placeId: s.placePrediction.placeId,
                    main: s.placePrediction.mainText?.text ?? s.placePrediction.text.text,
                    secondary: s.placePrediction.secondaryText?.text ?? "",
                    prediction: s.placePrediction,
                  },
                ]
              : [],
          ),
        );
        setOpen(true);
        setActive(-1);
        setFailed(false);
      } catch (e) {
        console.error("Place search failed", e);
        setFailed(true);
      } finally {
        if (n === request.current) setLoading(false);
      }
    }, 250);
    return () => clearTimeout(timer);
    // includedPrimaryTypes is a constant per form.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, searching, nearLat, nearLng]);

  // A short or cleared query hides old suggestions without an extra render.
  const shown = searching ? suggestions : [];

  async function pick(s: Suggestion) {
    setOpen(false);
    setLoading(true);
    try {
      const p = s.prediction.toPlace();
      // timeZone is billed in the same tier as displayName (Place Details Pro): no extra cost.
      await p.fetchFields({ fields: ["displayName", "formattedAddress", "location", "timeZone"] });
      token.current = null; // the session ends with the details request
      setName((p.displayName ?? s.main).slice(0, maxNameLength));
      setAddress((p.formattedAddress ?? s.secondary).slice(0, 300));
      if (p.location) {
        setPlace({ placeId: p.id, lat: p.location.lat().toFixed(7), lng: p.location.lng().toFixed(7) });
      }
      onPicked?.({ name: p.displayName ?? s.main, timeZone: p.timeZone?.id ?? null });
    } catch (e) {
      console.error("Place details failed", e);
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || shown.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => (i + 1) % shown.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (i <= 0 ? shown.length - 1 : i - 1));
    } else if (e.key === "Enter" && active >= 0) {
      e.preventDefault(); // pick, don't submit the form
      pick(shown[active]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <Field id={nameField} label={nameLabel} error={errors.name}>
        <div className="relative">
          <Input
            id={nameField}
            name={nameField}
            maxLength={maxNameLength}
            placeholder={namePlaceholder}
            autoComplete="off"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setQuery(e.target.value);
            }}
            onKeyDown={onKeyDown}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            onFocus={() => shown.length > 0 && setOpen(true)}
            role={configured ? "combobox" : undefined}
            aria-autocomplete={configured ? "list" : undefined}
            aria-expanded={configured ? open && shown.length > 0 : undefined}
            aria-controls={configured ? listId : undefined}
            aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
            aria-invalid={Boolean(errors.name)}
            className="h-11 pr-9"
          />
          {loading && (
            <Loader2 className="absolute top-3 right-3 size-5 animate-spin text-muted-foreground" aria-hidden="true" />
          )}
          {open && shown.length > 0 && (
            <ul
              id={listId}
              role="listbox"
              aria-label="Lugares sugeridos"
              className="absolute inset-x-0 top-12 z-20 max-h-72 overflow-y-auto rounded-xl border bg-card p-1 shadow-lg"
            >
              {shown.map((s, i) => (
                <li
                  key={s.placeId}
                  id={`${listId}-${i}`}
                  role="option"
                  aria-selected={i === active}
                  // mousedown (before the input's blur) so the click isn't lost.
                  onMouseDown={(e) => {
                    e.preventDefault();
                    pick(s);
                  }}
                  className={"flex min-h-11 cursor-pointer items-start gap-2 rounded-lg px-2 py-1.5 " + (i === active ? "bg-secondary" : "hover:bg-muted")}
                >
                  <MapPin className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate text-sm font-medium">{s.main}</span>
                    {s.secondary && <span className="truncate text-xs text-muted-foreground">{s.secondary}</span>}
                  </span>
                </li>
              ))}
              <li aria-hidden="true" className="px-2 pt-1 text-right text-[10px] text-muted-foreground">
                Resultados de Google
              </li>
            </ul>
          )}
        </div>
        {configured && !place && !failed && (
          <p className="text-xs text-muted-foreground">Escribe para buscar el lugar en Google Maps.</p>
        )}
        {failed && <p className="text-xs text-warning-foreground">No pudimos buscar en Google Maps. Puedes escribirlo a mano.</p>}
      </Field>

      {showAddress && (
        <Field id="address" label="Dirección" error={errors.address}>
          <Input
            id="address"
            name="address"
            maxLength={300}
            value={address}
            onChange={(e) => {
              setAddress(e.target.value);
              setPlace(null); // a typed address no longer matches the stored coordinates
            }}
            className="h-11"
          />
        </Field>
      )}

      {place && (
        <p className="flex items-center gap-2 text-xs text-success-foreground">
          <MapPin className="size-3.5 shrink-0" aria-hidden="true" />
          Ubicación guardada: aparecerá en el mapa.
          <button
            type="button"
            onClick={() => setPlace(null)}
            className="ml-auto flex min-h-8 items-center gap-1 text-muted-foreground hover:text-foreground"
          >
            <X className="size-3.5" aria-hidden="true" />
            Quitar
          </button>
        </p>
      )}

      <input type="hidden" name="google_place_id" value={place?.placeId ?? ""} />
      <input type="hidden" name="lat" value={place?.lat ?? ""} />
      <input type="hidden" name="lng" value={place?.lng ?? ""} />
    </div>
  );
}
