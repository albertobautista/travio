"use client";

import { useState } from "react";
import { Check, Share2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = {
  shareCode: string;
  tripName: string;
  /** "hero": round icon button over the cover (phones); "header": labeled button (desktop). */
  variant: "hero" | "header";
  className?: string;
};

/**
 * "Compartir": the trip's share link (/v/<code>). Pasted in WhatsApp & co. it
 * shows the trip's cover, name, dates and cities; it gives no access. Phones
 * get the system share sheet; elsewhere the link is copied.
 */
export function ShareTripButton({ shareCode, tripName, variant, className }: Props) {
  const [copied, setCopied] = useState(false);

  async function share() {
    // Built on click, in the browser: the origin is whatever domain the user is on.
    const url = `${window.location.origin}/v/${shareCode}`;
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title: tripName, text: `Mira nuestro viaje "${tripName}" en Travio`, url });
      } catch {
        // Closing the share sheet rejects too; nothing to do.
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked (permissions, insecure origin): nothing else to offer here.
    }
  }

  const Icon = copied ? Check : Share2;
  const status = (
    <span role="status" className="sr-only">
      {copied ? "Enlace copiado" : ""}
    </span>
  );

  if (variant === "hero") {
    return (
      <>
        <button
          type="button"
          onClick={share}
          aria-label="Compartir viaje"
          className={cn("flex size-11 items-center justify-center rounded-full bg-card/90 text-foreground shadow hover:bg-card", className)}
        >
          <Icon className="size-5" aria-hidden="true" />
        </button>
        {status}
      </>
    );
  }

  return (
    <>
      <Button type="button" variant="outline" className={cn("h-10", className)} onClick={share}>
        <Icon aria-hidden="true" />
        {copied ? "Copiado" : "Compartir"}
      </Button>
      {status}
    </>
  );
}
