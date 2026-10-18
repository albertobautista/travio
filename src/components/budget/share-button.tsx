"use client";

import { useState } from "react";
import { Check, Copy, Share2 } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * "Compartir cuentas": the phone's share sheet (WhatsApp, Messages…) where
 * there is one; otherwise copies the text, plus a direct WhatsApp link.
 */
export function ShareButton({ text, title }: { text: string; title: string }) {
  const [copied, setCopied] = useState(false);

  async function share() {
    if (navigator.share) {
      try {
        await navigator.share({ title, text });
        return;
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") return; // closed the sheet
      }
    }
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button type="button" variant="outline" className="h-11 flex-1 rounded-xl" onClick={share}>
        {copied ? <Check aria-hidden="true" /> : <Share2 aria-hidden="true" />}
        {copied ? "Copiado" : "Compartir cuentas"}
      </Button>
      <Button asChild variant="outline" className="h-11 rounded-xl">
        <a href={`https://wa.me/?text=${encodeURIComponent(text)}`} target="_blank" rel="noopener noreferrer">
          WhatsApp
        </a>
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-11"
        aria-label="Copiar texto"
        onClick={async () => {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 2500);
        }}
      >
        <Copy aria-hidden="true" />
      </Button>
      <span role="status" className="sr-only">
        {copied ? "Texto copiado" : ""}
      </span>
    </div>
  );
}
