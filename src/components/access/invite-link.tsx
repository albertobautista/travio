"use client";

import { useState } from "react";
import { Check, Copy, MessageCircle, Share2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Props = {
  token: string;
  tripName: string;
  expiresAt: string;
  /** A group link (/unirse/…) instead of a one-person invitation (/invitacion/…). */
  group?: boolean;
};

const expiryFormat = new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "long" });

/**
 * The invitation link, shown once right after it's created (the database
 * keeps only a hash of the token). On phones "Compartir" opens the system
 * share sheet (WhatsApp, Mensajes…); elsewhere "Copiar" and a WhatsApp
 * link (WhatsApp Web or the desktop app) do the job.
 */
export function InviteLink({ token, tripName, expiresAt, group = false }: Props) {
  const [copied, setCopied] = useState(false);
  // Only rendered after the create action returns, in the browser, so window
  // is there. The origin is localhost now and the real domain later.
  const url = `${window.location.origin}/${group ? "unirse" : "invitacion"}/${token}`;
  const canShare = typeof navigator.share === "function";
  const message = group
    ? `Únete a nuestro viaje "${tripName}" en Travio`
    : `Te invito a mi viaje "${tripName}" en Travio`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked (permissions, insecure origin): the field is selectable.
    }
  }

  async function share() {
    try {
      await navigator.share({ title: tripName, text: message, url });
    } catch {
      // Closing the share sheet rejects too; nothing to do.
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-primary/30 bg-secondary p-4">
      <p className="text-sm font-medium">
        {group ? "Comparte este enlace en el grupo" : "Comparte este enlace con la persona que invitas"}
      </p>
      <Input
        readOnly
        value={url}
        aria-label="Enlace de invitación"
        onFocus={(e) => e.currentTarget.select()}
        className="h-11 bg-card font-mono text-xs"
      />
      <div className="flex gap-2">
        <Button type="button" size="lg" variant={canShare ? "outline" : "default"} className="flex-1" onClick={copy}>
          {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
          {copied ? "Copiado" : "Copiar"}
        </Button>
        {canShare ? (
          <Button type="button" size="lg" className="flex-1" onClick={share}>
            <Share2 aria-hidden="true" />
            Compartir
          </Button>
        ) : (
          <Button asChild size="lg" variant="outline" className="flex-1">
            <a href={`https://wa.me/?text=${encodeURIComponent(`${message}: ${url}`)}`} target="_blank" rel="noopener noreferrer">
              <MessageCircle aria-hidden="true" />
              WhatsApp
            </a>
          </Button>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        {group
          ? `Cada persona que lo abra te pedirá unirse y tú decides. Caduca el ${expiryFormat.format(new Date(expiresAt))}. `
          : `Sirve para una sola persona y caduca el ${expiryFormat.format(new Date(expiresAt))}. `}
        Por seguridad no podremos mostrarlo otra vez; si lo pierdes, crea uno nuevo.
      </p>
      <span role="status" className="sr-only">
        {copied ? "Enlace copiado" : ""}
      </span>
    </div>
  );
}
