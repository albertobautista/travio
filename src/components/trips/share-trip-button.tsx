"use client";

import { useState, useSyncExternalStore } from "react";
import { DropdownMenu } from "radix-ui";
import { Check, Copy, MessageCircle, Share2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = {
  shareCode: string;
  tripName: string;
  /** "hero": round icon button over the cover (phones); "header": labeled button (desktop). */
  variant: "hero" | "header";
  className?: string;
};

const noSubscribe = () => () => {};
const hasShareSheet = () => typeof navigator.share === "function";

const itemClass =
  "flex min-h-11 cursor-pointer items-center gap-2.5 rounded-lg px-2.5 text-sm text-foreground outline-none data-[highlighted]:bg-muted";

/**
 * "Compartir": the trip's share link (/v/<code>). Pasted in WhatsApp & co. it
 * shows the trip's cover, name, dates and cities; it gives no access. Opens a
 * small menu: copy the link, or send it, through the system share sheet where
 * there is one (phones) and WhatsApp elsewhere.
 */
export function ShareTripButton({ shareCode, tripName, variant, className }: Props) {
  const [copied, setCopied] = useState(false);
  // Only known in the browser; the server render (and hydration) assume no share sheet.
  const canShare = useSyncExternalStore(noSubscribe, hasShareSheet, () => false);

  // The origin is whatever domain the user is on; only read on click, in the browser.
  const url = () => `${window.location.origin}/v/${shareCode}`;
  const message = `Mira nuestro viaje "${tripName}" en Travio`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(url());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked (permissions, insecure origin): nothing else to offer here.
    }
  }

  async function share() {
    try {
      await navigator.share({ title: tripName, text: message, url: url() });
    } catch {
      // Closing the share sheet rejects too; nothing to do.
    }
  }

  const Icon = copied ? Check : Share2;

  return (
    <>
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          {variant === "hero" ? (
            <button
              type="button"
              aria-label="Compartir viaje"
              className={cn(
                "flex size-11 items-center justify-center rounded-full bg-card/90 text-foreground shadow outline-none hover:bg-card focus-visible:ring-3 focus-visible:ring-ring/50",
                className,
              )}
            >
              <Icon className="size-5" aria-hidden="true" />
            </button>
          ) : (
            <Button type="button" variant="outline" className={cn("h-10", className)}>
              <Icon aria-hidden="true" />
              {copied ? "Copiado" : "Compartir"}
            </Button>
          )}
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content align="end" sideOffset={6} className="z-50 min-w-52 rounded-xl border bg-card p-1 shadow-lg">
            <DropdownMenu.Item className={itemClass} onSelect={copy}>
              <Copy className="size-4 text-muted-foreground" aria-hidden="true" />
              Copiar enlace
            </DropdownMenu.Item>
            {canShare ? (
              <DropdownMenu.Item className={itemClass} onSelect={share}>
                <Share2 className="size-4 text-muted-foreground" aria-hidden="true" />
                Compartir en…
              </DropdownMenu.Item>
            ) : (
              <DropdownMenu.Item
                className={itemClass}
                onSelect={() => window.open(`https://wa.me/?text=${encodeURIComponent(`${message}: ${url()}`)}`, "_blank", "noopener,noreferrer")}
              >
                <MessageCircle className="size-4 text-muted-foreground" aria-hidden="true" />
                Enviar por WhatsApp
              </DropdownMenu.Item>
            )}
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
      <span role="status" className="sr-only">
        {copied ? "Enlace copiado" : ""}
      </span>
    </>
  );
}
