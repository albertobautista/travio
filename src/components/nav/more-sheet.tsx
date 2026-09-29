"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Dialog } from "radix-ui";
import { MoreHorizontal, X, type LucideIcon } from "lucide-react";

export type SheetLink = { href: string; label: string; icon: LucideIcon; hint?: string };

type Props = {
  title: string;
  links: SheetLink[];
  /** Extra content at the bottom (e.g. the sign-out form). */
  footer?: React.ReactNode;
  active: boolean;
};

/**
 * The "Más" tab: a bottom sheet with the sections that don't fit in the bar.
 * Radix Dialog handles focus trapping, Esc and restoring focus to the button.
 */
export function MoreSheet({ title, links, footer, active }: Props) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button
          type="button"
          className={
            "flex min-h-12 flex-col items-center justify-center gap-0.5 text-[11px] " +
            (active ? "font-semibold text-primary" : "font-medium text-muted-foreground")
          }
        >
          <MoreHorizontal className="size-[22px]" aria-hidden="true" />
          Más
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-foreground/40 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <Dialog.Content className="fixed inset-x-0 bottom-0 z-50 flex max-h-[85vh] flex-col gap-2 rounded-t-3xl bg-card p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-xl data-[state=open]:animate-in data-[state=open]:slide-in-from-bottom">
          <div className="flex items-center justify-between">
            <Dialog.Title className="text-lg font-semibold">{title}</Dialog.Title>
            <Dialog.Close className="flex size-11 items-center justify-center rounded-full text-muted-foreground hover:bg-muted" aria-label="Cerrar">
              <X className="size-5" aria-hidden="true" />
            </Dialog.Close>
          </div>
          <Dialog.Description className="sr-only">Más secciones</Dialog.Description>
          <nav aria-label={title} className="overflow-y-auto">
            <ul className="grid grid-cols-2 gap-2">
              {links.map((l) => {
                const Icon = l.icon;
                const current = pathname === l.href;
                return (
                  <li key={l.href}>
                    <Link
                      href={l.href}
                      onClick={() => setOpen(false)}
                      aria-current={current ? "page" : undefined}
                      className={
                        "flex min-h-16 items-center gap-3 rounded-2xl border p-3 " +
                        (current ? "border-primary/40 bg-secondary text-secondary-foreground" : "bg-card hover:bg-muted")
                      }
                    >
                      <Icon className="size-5 shrink-0 text-primary" aria-hidden="true" />
                      <span className="flex min-w-0 flex-col">
                        <span className="truncate text-sm font-semibold">{l.label}</span>
                        {l.hint && <span className="truncate text-xs text-muted-foreground">{l.hint}</span>}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
          {footer}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
