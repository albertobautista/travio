"use client";

import { useState, useTransition } from "react";
import { Loader2, Undo2 } from "lucide-react";

import { Button } from "@/components/ui/button";

type Result = { error?: string; ok?: boolean } | undefined;

/**
 * "Deshacer" on a recorded payment. (Suggested payments use TransferRow.)
 * `action` is a Server Action with its arguments already bound.
 */
export function SettleButton({ action, label }: { action: () => Promise<Result>; label: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <span className="flex flex-col items-end gap-1">
      <Button
        type="button"
        size="sm"
        variant="ghost"
        className="h-9"
        disabled={pending}
        aria-label={label}
        onClick={() =>
          start(async () => {
            const r = await action();
            setError(r?.error ?? null);
          })
        }
      >
        {pending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Undo2 aria-hidden="true" />}
        Deshacer
      </Button>
      {error && (
        <span role="alert" className="text-xs text-destructive">
          {error}
        </span>
      )}
    </span>
  );
}
