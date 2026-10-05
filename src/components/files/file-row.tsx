import type { ReactNode } from "react";
import Link from "next/link";
import { Download, FileText, ImageIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { formatFileSize } from "@/lib/files/rules";

type Props = {
  tripId: string;
  file: { id: string; original_name: string; mime_type: string; size_bytes: number };
  /** Extra line under the name, e.g. the activity it's attached to. */
  meta?: ReactNode;
  /** Extra controls on the right, e.g. a delete button for editors. */
  actions?: ReactNode;
};

/** URL that checks access and redirects to a short-lived signed URL (see documentos/[fileId]/route.ts). */
export function fileHref(tripId: string, fileId: string, download = false) {
  return `/viajes/${tripId}/documentos/${fileId}${download ? "?descargar=1" : ""}`;
}

/** The document's page: what it's for, with the file previewed (see ticket/[fileId]). */
export function ticketHref(tripId: string, fileId: string) {
  return `/viajes/${tripId}/ticket/${fileId}`;
}

/**
 * One document: tap the name for its page (preview, details), or download it.
 * The download is a plain <a>: it's a redirect to Storage, not a page.
 */
export function FileRow({ tripId, file, meta, actions }: Props) {
  const isPdf = file.mime_type === "application/pdf";
  const Icon = isPdf ? FileText : ImageIcon;
  return (
    <div className="flex items-center gap-3 rounded-xl border bg-card p-2 pl-3">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-secondary text-primary">
        <Icon className="size-5" aria-hidden="true" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col py-1">
        <Link href={ticketHref(tripId, file.id)} className="line-clamp-2 text-sm font-medium break-words hover:underline">
          {file.original_name}
        </Link>
        <span className="truncate text-xs text-muted-foreground">
          {isPdf ? "PDF" : "Imagen"} · {formatFileSize(file.size_bytes)}
          {meta ? <> · {meta}</> : null}
        </span>
      </span>
      <Button asChild variant="ghost" size="icon" className="size-11 text-muted-foreground">
        <a href={fileHref(tripId, file.id, true)} aria-label={`Descargar ${file.original_name}`}>
          <Download aria-hidden="true" />
        </a>
      </Button>
      {actions}
    </div>
  );
}
