"use client";

import { useState } from "react";
import { Dialog } from "radix-ui";
import { Plus, X } from "lucide-react";

import { ExpenseForm, type ExpenseValues } from "@/components/budget/budget-forms";
import { Button } from "@/components/ui/button";

type State = { error?: string; ok?: boolean } | undefined;

/**
 * "+ Gasto": on phones a floating button above the bottom bar, so it's one
 * tap away from any of the budget's tabs; on desktop a button in the header.
 * The form opens in a sheet (from the bottom on phones, centered on wider
 * screens) and closes once the expense is saved.
 */
export function ExpenseSheet({
  action,
  initial,
  travelers,
}: {
  action: (prev: State, formData: FormData) => Promise<State>;
  initial: ExpenseValues;
  travelers: { id: string; name: string }[];
}) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <Button
          size="lg"
          className="fixed right-4 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-30 h-14 rounded-full px-5 shadow-lg lg:static lg:h-11 lg:rounded-xl lg:px-4 lg:shadow-none"
        >
          <Plus aria-hidden="true" />
          Gasto
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-foreground/40 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:duration-200 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:duration-300" />
        <Dialog.Content
          className={
            "fixed inset-x-0 bottom-0 z-50 flex max-h-[90vh] flex-col gap-3 overflow-y-auto rounded-t-3xl bg-card p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-xl ease-(--ease-out-soft) " +
            "data-[state=closed]:animate-out data-[state=closed]:slide-out-to-bottom data-[state=closed]:duration-200 data-[state=open]:animate-in data-[state=open]:slide-in-from-bottom data-[state=open]:duration-300 " +
            "sm:inset-x-auto sm:top-1/2 sm:bottom-auto sm:left-1/2 sm:w-full sm:max-w-lg sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-3xl sm:data-[state=closed]:slide-out-to-bottom-0 sm:data-[state=closed]:zoom-out-95 sm:data-[state=open]:slide-in-from-bottom-0 sm:data-[state=open]:zoom-in-95"
          }
        >
          <div className="flex items-center justify-between">
            <Dialog.Title className="text-lg font-semibold">Nuevo gasto</Dialog.Title>
            <Dialog.Close className="flex size-11 items-center justify-center rounded-full text-muted-foreground hover:bg-muted" aria-label="Cerrar">
              <X className="size-5" aria-hidden="true" />
            </Dialog.Close>
          </div>
          <Dialog.Description className="sr-only">Anota cuánto, en qué y quién pagó.</Dialog.Description>
          <ExpenseForm action={action} initial={initial} travelers={travelers} submitLabel="Guardar gasto" onSaved={() => setOpen(false)} />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
