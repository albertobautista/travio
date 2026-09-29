"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BedDouble,
  Bookmark,
  CalendarDays,
  FileText,
  Home,
  Map as MapIcon,
  Navigation,
  Pencil,
  PiggyBank,
  Plane,
  Plus,
  Sun,
  Users,
  type LucideIcon,
} from "lucide-react";

import { MoreSheet, type SheetLink } from "./more-sheet";

/**
 * The app's navigation, as decided in CLAUDE.md:
 * - Phones: a bottom bar. Outside a trip: Viajes / Mapa / Guardados / Más.
 *   Inside a trip: Hoy / Itinerario / Mapa / Documentos / Más.
 * - Desktop (lg): a left sidebar with every section of the current trip.
 * "Más" opens a sheet with the rest.
 */

type Item = { href: string; label: string; icon: LucideIcon; match: (path: string) => boolean };

const TRIP_ROUTE = /^\/viajes\/[0-9a-f-]{36}(\/|$)/i;

function BottomBar({ items, more }: { items: Item[]; more: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Principal"
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
    >
      <ul className="mx-auto grid max-w-2xl" style={{ gridTemplateColumns: `repeat(${items.length + 1}, minmax(0, 1fr))` }}>
        {items.map((item) => {
          const active = item.match(pathname);
          const Icon = item.icon;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={
                  "flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] " +
                  (active ? "font-semibold text-primary" : "font-medium text-muted-foreground hover:text-foreground")
                }
              >
                <Icon className="size-[22px]" aria-hidden="true" />
                {item.label}
              </Link>
            </li>
          );
        })}
        <li className="flex items-stretch justify-center [&>button]:min-h-14 [&>button]:w-full">{more}</li>
      </ul>
    </nav>
  );
}

function Sidebar({ heading, items, footer }: { heading?: React.ReactNode; items: Item[]; footer?: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col gap-4 border-r bg-card p-4 lg:flex">
      <Link href="/viajes" className="px-2 text-xl font-bold tracking-tight">
        Travio
      </Link>
      {heading}
      <nav aria-label="Secciones" className="flex-1 overflow-y-auto">
        <ul className="flex flex-col gap-0.5">
          {items.map((item) => {
            const active = item.match(pathname);
            const Icon = item.icon;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={
                    "flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm " +
                    (active ? "bg-secondary font-semibold text-secondary-foreground" : "text-foreground/80 hover:bg-muted")
                  }
                >
                  <Icon className={"size-[18px] " + (active ? "text-primary" : "text-muted-foreground")} aria-hidden="true" />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      {footer}
    </aside>
  );
}

// ---------------------------------------------------------------------------
// Inside a trip
// ---------------------------------------------------------------------------

export function TripNav({ tripId, tripName, editable }: { tripId: string; tripName: string; editable: boolean }) {
  const base = `/viajes/${tripId}`;
  const is = (...paths: string[]) => (p: string) => paths.some((x) => p === `${base}${x}` || p.startsWith(`${base}${x}/`));

  const bar: Item[] = [
    { href: `${base}/hoy`, label: "Hoy", icon: Sun, match: is("/hoy") },
    { href: `${base}/itinerario`, label: "Itinerario", icon: CalendarDays, match: is("/itinerario", "/actividades") },
    { href: `${base}/mapa`, label: "Mapa", icon: MapIcon, match: is("/mapa") },
    { href: `${base}/documentos`, label: "Documentos", icon: FileText, match: is("/documentos") },
  ];
  const rest: (SheetLink & { match: Item["match"] })[] = [
    { href: base, label: "Resumen", icon: Home, hint: tripName, match: (p) => p === base },
    { href: `${base}/hospedajes`, label: "Hospedajes", icon: BedDouble, match: is("/hospedajes") },
    { href: `${base}/transporte`, label: "Transporte", icon: Plane, match: is("/transporte") },
    { href: `${base}/guardados`, label: "Guardados", icon: Bookmark, match: is("/guardados") },
    { href: `${base}/presupuesto`, label: "Presupuesto", icon: PiggyBank, match: is("/presupuesto") },
    { href: `${base}/viajeros`, label: "Viajeros", icon: Users, match: is("/viajeros") },
    ...(editable ? [{ href: `${base}/editar`, label: "Editar viaje", icon: Pencil, match: is("/editar", "/ciudades") }] : []),
    { href: "/viajes", label: "Mis viajes", icon: Navigation, match: () => false },
  ];
  const pathname = usePathname();
  const inMore = rest.some((r) => r.match(pathname));

  return (
    <>
      <BottomBar items={bar} more={<MoreSheet title={tripName} links={rest} active={inMore} />} />
      <Sidebar
        heading={
          <Link href={base} className="flex flex-col rounded-xl bg-secondary px-3 py-2">
            <span className="text-xs text-muted-foreground">Viaje</span>
            <span className="truncate font-semibold text-secondary-foreground">{tripName}</span>
          </Link>
        }
        items={[rest[0], ...bar, ...rest.slice(1, -1)]}
        footer={
          <Link href="/viajes" className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm text-muted-foreground hover:bg-muted">
            <Navigation className="size-[18px]" aria-hidden="true" />
            Mis viajes
          </Link>
        }
      />
    </>
  );
}

// ---------------------------------------------------------------------------
// Outside a trip
// ---------------------------------------------------------------------------

/**
 * "Mapa" and "Guardados" point at the trip in progress, else the next one
 * (there's no cross-trip map yet). Hidden inside a trip, where TripNav shows.
 */
export function GlobalNav({ focusTripId, signOut }: { focusTripId: string | null; signOut: React.ReactNode }) {
  const pathname = usePathname();
  if (TRIP_ROUTE.test(pathname)) return null;

  const focus = focusTripId ? `/viajes/${focusTripId}` : null;
  const bar: Item[] = [
    { href: "/viajes", label: "Viajes", icon: Navigation, match: (p) => p === "/viajes" },
    ...(focus
      ? [
          { href: `${focus}/mapa`, label: "Mapa", icon: MapIcon, match: () => false },
          { href: `${focus}/guardados`, label: "Guardados", icon: Bookmark, match: () => false },
        ]
      : []),
  ];
  const more: SheetLink[] = [{ href: "/viajes/nuevo", label: "Nuevo viaje", icon: Plus }];

  return (
    <>
      <BottomBar
        items={bar}
        more={<MoreSheet title="Travio" links={more} active={pathname === "/viajes/nuevo"} footer={signOut} />}
      />
      <Sidebar
        items={[...bar, { href: "/viajes/nuevo", label: "Nuevo viaje", icon: Plus, match: (p) => p === "/viajes/nuevo" }]}
        footer={signOut}
      />
    </>
  );
}
