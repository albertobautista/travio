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
 * - Desktop (lg): a left sidebar (DesktopSidebar) and, inside a trip, tabs
 *   with its sections (TripTabs).
 * "Más" opens a sheet with the rest.
 */

type Item = { href: string; label: string; icon: LucideIcon; match: (path: string) => boolean };

const TRIP_ROUTE = /^\/viajes\/([0-9a-f-]{36})(\/|$)/i;

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

export type SidebarTrip = { id: string; name: string; dates: string };

/**
 * Desktop sidebar, the same everywhere (as in the mockups): the sections that
 * make sense across the app, pointing at the trip on screen (else the trip in
 * progress or the next one), then the list of trips. A trip's own sections
 * are its tabs (TripTabs).
 */
export function DesktopSidebar({
  trips,
  focusTripId,
  footer,
}: {
  trips: SidebarTrip[];
  focusTripId: string | null;
  footer?: React.ReactNode;
}) {
  const pathname = usePathname();
  const current = TRIP_ROUTE.exec(pathname)?.[1] ?? null;
  const target = current ?? focusTripId;
  const base = target ? `/viajes/${target}` : null;
  const is = (x: string) => (p: string) => !!current && current === target && (p === `${base}${x}` || p.startsWith(`${base}${x}/`));
  const items: Item[] = [
    { href: "/viajes", label: "Mis viajes", icon: Navigation, match: (p) => p === "/viajes" },
    ...(base
      ? [
          { href: `${base}/mapa`, label: "Mapa", icon: MapIcon, match: is("/mapa") },
          { href: `${base}/documentos`, label: "Documentos", icon: FileText, match: is("/documentos") },
          { href: `${base}/presupuesto`, label: "Presupuesto", icon: PiggyBank, match: is("/presupuesto") },
          { href: `${base}/viajeros`, label: "Personas", icon: Users, match: is("/viajeros") },
        ]
      : []),
  ];
  const link = (active: boolean) =>
    "flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm " +
    (active ? "bg-secondary font-semibold text-secondary-foreground" : "text-foreground/80 hover:bg-muted");

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col gap-4 border-r bg-card p-4 lg:flex">
      <Link href="/viajes" className="flex items-center gap-2 px-2 text-xl font-bold tracking-tight">
        <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground" aria-hidden="true">
          <Plane className="size-4" />
        </span>
        Travio
      </Link>
      <nav aria-label="Principal">
        <ul className="flex flex-col gap-0.5">
          {items.map((item) => {
            const active = item.match(pathname);
            const Icon = item.icon;
            return (
              <li key={item.href}>
                <Link href={item.href} aria-current={active ? "page" : undefined} className={link(active)}>
                  <Icon className={"size-[18px] " + (active ? "text-primary" : "text-muted-foreground")} aria-hidden="true" />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      {trips.length > 0 && (
        <nav aria-labelledby="sidebar-trips" className="flex min-h-0 flex-1 flex-col gap-1">
          <h2 id="sidebar-trips" className="px-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            Mis viajes
          </h2>
          <ul className="flex flex-col gap-0.5 overflow-y-auto">
            {trips.map((t) => {
              const active = t.id === current;
              return (
                <li key={t.id}>
                  <Link
                    href={`/viajes/${t.id}`}
                    aria-current={active ? "true" : undefined}
                    className={
                      "flex min-h-11 flex-col justify-center rounded-xl px-3 py-1.5 " +
                      (active ? "bg-secondary" : "hover:bg-muted")
                    }
                  >
                    <span className={"truncate text-sm " + (active ? "font-semibold text-secondary-foreground" : "font-medium")}>
                      {t.name}
                    </span>
                    {t.dates && <span className="text-xs text-muted-foreground">{t.dates}</span>}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      )}
      <div className={"flex flex-col gap-1 " + (trips.length > 0 ? "" : "mt-auto")}>
        <Link
          href="/viajes/nuevo"
          aria-current={pathname === "/viajes/nuevo" ? "page" : undefined}
          className="flex h-11 items-center justify-center gap-2 rounded-xl border border-dashed text-sm font-medium text-primary hover:bg-secondary"
        >
          <Plus className="size-4" aria-hidden="true" />
          Nuevo viaje
        </Link>
        {footer}
      </div>
    </aside>
  );
}

/**
 * A trip's sections as tabs under its header (desktop). Phones use the
 * bottom bar and the "Más" sheet instead.
 */
export function TripTabs({ tripId, editable }: { tripId: string; editable: boolean }) {
  const pathname = usePathname();
  const base = `/viajes/${tripId}`;
  const is = (...paths: string[]) => (p: string) => paths.some((x) => p === `${base}${x}` || p.startsWith(`${base}${x}/`));
  const tabs: Item[] = [
    { href: base, label: "Resumen", icon: Home, match: (p) => p === base || (editable && is("/editar", "/ciudades")(p)) },
    { href: `${base}/hoy`, label: "Hoy", icon: Sun, match: is("/hoy") },
    { href: `${base}/itinerario`, label: "Itinerario", icon: CalendarDays, match: is("/itinerario", "/actividades") },
    { href: `${base}/mapa`, label: "Mapa", icon: MapIcon, match: is("/mapa") },
    { href: `${base}/hospedajes`, label: "Hospedajes", icon: BedDouble, match: is("/hospedajes") },
    { href: `${base}/transporte`, label: "Transporte", icon: Plane, match: is("/transporte") },
    { href: `${base}/guardados`, label: "Guardados", icon: Bookmark, match: is("/guardados") },
    { href: `${base}/documentos`, label: "Documentos", icon: FileText, match: is("/documentos") },
    { href: `${base}/presupuesto`, label: "Presupuesto", icon: PiggyBank, match: is("/presupuesto") },
    { href: `${base}/viajeros`, label: "Viajeros", icon: Users, match: is("/viajeros") },
  ];
  return (
    <nav aria-label="Secciones del viaje" className="-mb-px overflow-x-auto">
      <ul className="flex gap-1">
        {tabs.map((tab) => {
          const active = tab.match(pathname);
          return (
            <li key={tab.href} className="shrink-0">
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={
                  "flex h-11 items-center border-b-2 px-3 text-sm " +
                  (active
                    ? "border-primary font-semibold text-primary"
                    : "border-transparent text-muted-foreground hover:border-border hover:text-foreground")
                }
              >
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
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
    </>
  );
}
