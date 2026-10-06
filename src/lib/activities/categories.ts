import {
  Camera,
  Car,
  Flag,
  Moon,
  MoreHorizontal,
  ShoppingBag,
  Sun,
  Utensils,
  type LucideIcon,
} from "lucide-react";

/** Mirrors the check constraints on activities.category / booking_status. */

export const CATEGORIES = ["sightseeing", "tour", "food", "transfer", "free_time", "nightlife", "shopping", "other"] as const;
export type ActivityCategory = (typeof CATEGORIES)[number];

export const CATEGORY_META: Record<ActivityCategory, { label: string; icon: LucideIcon; className: string }> = {
  sightseeing: { label: "Turismo", icon: Camera, className: "bg-success-soft text-success-foreground" },
  tour: { label: "Tour", icon: Flag, className: "bg-secondary text-secondary-foreground" },
  food: { label: "Comida", icon: Utensils, className: "bg-warning-soft text-warning-foreground ring-1 ring-warning-border ring-inset" },
  transfer: { label: "Traslado", icon: Car, className: "bg-violet-100 text-violet-900 dark:bg-violet-950 dark:text-violet-300" },
  free_time: { label: "Tiempo libre", icon: Sun, className: "bg-muted text-foreground/80" },
  nightlife: { label: "Vida nocturna", icon: Moon, className: "bg-muted text-foreground/80" },
  shopping: { label: "Compras", icon: ShoppingBag, className: "bg-muted text-foreground/80" },
  other: { label: "Otro", icon: MoreHorizontal, className: "bg-muted text-foreground/80" },
};

export function isCategory(value: string): value is ActivityCategory {
  return (CATEGORIES as readonly string[]).includes(value);
}

export const BOOKING_STATUSES = ["planned", "booked", "confirmed"] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

export const BOOKING_META: Record<BookingStatus, { label: string; badge: string | null; className: string }> = {
  planned: { label: "Sin reservar", badge: null, className: "" },
  booked: { label: "Reservada", badge: "Reservada", className: "bg-secondary text-secondary-foreground" },
  confirmed: { label: "Confirmada", badge: "Confirmada", className: "bg-success-soft text-success-foreground" },
};

export function isBookingStatus(value: string): value is BookingStatus {
  return (BOOKING_STATUSES as readonly string[]).includes(value);
}
