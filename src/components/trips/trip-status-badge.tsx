import { cn } from "cn";

import type { TripStatus } from "@/lib/trips/dates";

const STATUS: Record<TripStatus, { label: string; className: string }> = {
  active: { label: "En curso", className: "bg-success-soft text-success-foreground" },
  upcoming: { label: "Próximo", className: "bg-secondary text-secondary-foreground" },
  past: { label: "Pasado", className: "bg-muted text-muted-foreground" },
  undated: { label: "Sin fechas", className: "bg-muted text-muted-foreground" },
};

export function TripStatusBadge({ status, className }: { status: TripStatus; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-semibold",
        STATUS[status].className,
        className,
      )}
    >
      {STATUS[status].label}
    </span>
  );
}
