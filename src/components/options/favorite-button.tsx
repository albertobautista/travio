"use client";

import { useOptimistic, useState, useTransition } from "react";
import { Star } from "lucide-react";

type State = { error?: string } | undefined;

/**
 * The star on an option: the one you lean towards for its city or route.
 * Only the favorite is previewed in the itinerary and the map. The server
 * takes the star off the others in the same group, and refreshes the page.
 */
export function FavoriteButton({
  favorite,
  setFavorite,
  name,
}: {
  favorite: boolean;
  /** Server action bound to the option. */
  setFavorite: (favorite: boolean) => Promise<State>;
  name: string;
}) {
  const [shown, setShown] = useOptimistic(favorite);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <span className="flex shrink-0 flex-col items-end">
      <button
        type="button"
        aria-pressed={shown}
        aria-label={shown ? `Quitar ${name} como favorita` : `Marcar ${name} como favorita`}
        title={shown ? "Favorita: se ve en el itinerario" : "Marcar como favorita para verla en el itinerario"}
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            setShown(!shown);
            const result = await setFavorite(!shown);
            if (result?.error) setError(result.error);
          })
        }
        className={
          "-m-1.5 flex size-11 items-center justify-center rounded-full hover:bg-muted " +
          (shown ? "text-warning" : "text-muted-foreground")
        }
      >
        <Star className="size-5" fill={shown ? "currentColor" : "none"} aria-hidden="true" />
      </button>
      {error && (
        <span role="alert" className="max-w-40 text-right text-xs text-destructive">
          {error}
        </span>
      )}
    </span>
  );
}

/** Read-only star for people who can't change it. */
export function FavoriteMark() {
  return (
    <span className="flex shrink-0 items-center gap-1 rounded-full border border-warning-border bg-warning-soft px-2 py-0.5 text-xs font-semibold text-warning-foreground">
      <Star className="size-3" fill="currentColor" aria-hidden="true" />
      Favorita
    </span>
  );
}
