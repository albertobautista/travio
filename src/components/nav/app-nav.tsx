"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { DropdownMenu } from "radix-ui";
import {
  BedDouble,
  ChevronDown,
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
  UserRound,
  Users,
  type LucideIcon,
} from "lucide-react";

import type { TripStatus } from "@/lib/trips/dates";

import { MoreSheet, type SheetLink } from "./more-sheet";

/**
 * The app's navigation, as decided in CLAUDE.md:
 * - Phones: a bottom bar. Outside a trip: Viajes / Hoy (trip in progress) / Más.
 *   Inside a trip: Hoy / Itinerario / Mapa / Documentos / Más.
 * - Desktop (lg): a left sidebar to pick the trip (DesktopSidebar) and,
 *   inside a trip, tabs for its sections (TripTabs): main five + Más.
 * "Más" opens a sheet with the rest.
 */

type Item = { href: string; label: string; icon: LucideIcon; match: (path: string) => boolean };

const TRIP_ROUTE = /^\/viajes\/([0-9a-f-]{36})(\/|$)/i;

function BottomBar({ items, more, moreActive }: { items: Item[]; more: React.ReactNode; moreActive: boolean }) {
  const pathname = usePathname();
  const columns = items.length + 1;
  const activeIndex = moreActive ? items.length : items.findIndex((item) => item.match(pathname));
  return (
    <nav
      aria-label="Principal"
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
    >
      <ul className="relative mx-auto grid max-w-2xl" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
        {/* The active tab's pill. One element that slides between tabs (transform only). */}
        {activeIndex >= 0 && (
          <li
            aria-hidden="true"
            className="pointer-events-none absolute top-1.5 left-0 flex justify-center transition-transform duration-250 ease-(--ease-out-soft)"
            style={{ width: `${100 / columns}%`, transform: `translateX(${activeIndex * 100}%)` }}
          >
            <span className="h-8 w-14 rounded-full bg-secondary" />
          </li>
        )}
        {items.map((item) => {
          const active = item.match(pathname);
          const Icon = item.icon;
          return (
            <li key={item.href} className="relative">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={
                  "flex min-h-14 flex-col items-center gap-0.5 pt-1.5 pb-1 text-[11px] transition-colors " +
                  (active ? "font-semibold text-primary" : "font-medium text-muted-foreground hover:text-foreground")
                }
              >
                <span className="flex h-8 w-14 items-center justify-center">
                  <Icon className="size-[22px]" aria-hidden="true" />
                </span>
                {item.label}
              </Link>
            </li>
          );
        })}
        <li className="relative flex items-stretch justify-center [&>button]:min-h-14 [&>button]:w-full">{more}</li>
      </ul>
    </nav>
  );
}

export type SidebarTrip = {
  id: string;
  name: string;
  start: string | null;
  /** "27 sep – 11 oct", or "Sin fechas". */
  dates: string;
  status: TripStatus;
  dayNumber: number | null;
  coverUrl: string | null;
};

const GROUPS: { status: TripStatus; label: string }[] = [
  { status: "active", label: "En curso" },
  { status: "upcoming", label: "Próximos" },
  { status: "undated", label: "Sin fechas" },
  { status: "past", label: "Pasados" },
];
/** Past trips beyond this many are only on Mis viajes. */
const MAX_PAST = 5;

/**
 * Desktop sidebar: which trip you're in. A trip's sections are its tabs
 * (TripTabs), so nothing here repeats them. The trip in progress gets a
 * shortcut to its Hoy; there's no "implicit" trip behind any link.
 */
export function DesktopSidebar({
  trips,
  active,
  account,
  signOut,
}: {
  trips: SidebarTrip[];
  active: SidebarTrip | null;
  account: { name: string };
  signOut: React.ReactNode;
}) {
  const pathname = usePathname();
  const current = TRIP_ROUTE.exec(pathname)?.[1] ?? null;
  const onHoy = active !== null && pathname === `/viajes/${active.id}/hoy`;
  const initials = account.name
    .split(/[^\p{L}]+/u)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col gap-3 border-r bg-card p-4 lg:flex">
      <Link href="/viajes" className="flex items-center gap-2 px-2 text-xl font-bold tracking-tight">
        <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground" aria-hidden="true">
          <Plane className="size-4" />
        </span>
        Travio
      </Link>

      <nav aria-label="Principal" className="flex min-h-0 flex-1 flex-col gap-3">
        <Link
          href="/viajes"
          aria-current={pathname === "/viajes" ? "page" : undefined}
          className={
            "flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm " +
            (pathname === "/viajes" ? "bg-secondary font-semibold text-secondary-foreground" : "text-foreground/80 hover:bg-muted")
          }
        >
          <Home className={"size-[18px] " + (pathname === "/viajes" ? "text-primary" : "text-muted-foreground")} aria-hidden="true" />
          Mis viajes
        </Link>

        {active && (
          <Link
            href={`/viajes/${active.id}/hoy`}
            aria-current={onHoy ? "page" : undefined}
            className={
              "flex flex-col rounded-xl border px-3 py-2 " +
              (onHoy ? "border-success/40 bg-success-soft" : "border-success/20 bg-success-soft/60 hover:bg-success-soft")
            }
          >
            <span className="text-xs text-success-foreground">En curso{active.dayNumber ? ` · día ${active.dayNumber}` : ""}</span>
            <span className="flex items-center gap-1.5 truncate text-sm font-semibold text-success-foreground">
              <Sun className="size-4 shrink-0" aria-hidden="true" />
              <span className="truncate">{active.name} · Hoy</span>
            </span>
          </Link>
        )}

        <div className="-mx-1 flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-1">
          {GROUPS.map(({ status, label }) => {
            const all = trips.filter((t) => t.status === status);
            if (all.length === 0) return null;
            const shown = status === "past" ? all.slice(0, MAX_PAST) : all;
            return (
              <section key={status} aria-labelledby={`trips-${status}`} className="flex flex-col gap-0.5">
                <h2 id={`trips-${status}`} className="px-3 pb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  {label}
                </h2>
                <ul className="flex flex-col gap-0.5">
                  {shown.map((t) => {
                    const on = t.id === current;
                    return (
                      <li key={t.id}>
                        <Link
                          href={`/viajes/${t.id}`}
                          aria-current={on ? "true" : undefined}
                          className={"flex min-h-11 items-center gap-2.5 rounded-xl px-2 py-1.5 " + (on ? "bg-secondary" : "hover:bg-muted")}
                        >
                          {t.coverUrl ? (
                            // Plain <img>: signed URLs change on every load.
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={t.coverUrl} alt="" className="size-8 shrink-0 rounded-lg object-cover" />
                          ) : (
                            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-secondary text-primary" aria-hidden="true">
                              <Plane className="size-4" />
                            </span>
                          )}
                          <span className="flex min-w-0 flex-col">
                            <span className={"truncate text-sm " + (on ? "font-semibold text-secondary-foreground" : "font-medium")}>{t.name}</span>
                            <span className="truncate text-xs text-muted-foreground">{t.dates}</span>
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
                {all.length > shown.length && (
                  <Link href="/viajes?filtro=pasados" className="px-3 py-1 text-xs font-medium text-primary hover:underline">
                    Ver los {all.length} pasados
                  </Link>
                )}
              </section>
            );
          })}
        </div>
      </nav>

      <div className="flex flex-col gap-1">
        <Link
          href="/viajes/nuevo"
          aria-current={pathname === "/viajes/nuevo" ? "page" : undefined}
          className="flex h-11 items-center justify-center gap-2 rounded-xl border border-dashed text-sm font-medium text-primary hover:bg-secondary"
        >
          <Plus className="size-4" aria-hidden="true" />
          Nuevo viaje
        </Link>
        <div className="mt-1 flex items-center gap-2.5 border-t px-3 pt-3">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold text-secondary-foreground" aria-hidden="true">
            {initials || "?"}
          </span>
          <span className="truncate text-sm font-medium">{account.name}</span>
        </div>
        <Link
          href="/cuenta"
          aria-current={pathname.startsWith("/cuenta") ? "page" : undefined}
          className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-sm text-muted-foreground hover:bg-muted"
        >
          <UserRound className="size-[18px]" aria-hidden="true" />
          Tu cuenta
        </Link>
        {signOut}
      </div>
    </aside>
  );
}

/**
 * A trip's sections as tabs under its header (desktop): the same main five
 * as the phone's bottom bar (plus Resumen), and the rest under "Más", so
 * nothing gets cut off on narrower screens.
 */
export function TripTabs({ tripId, editable }: { tripId: string; editable: boolean }) {
  const pathname = usePathname();
  const base = `/viajes/${tripId}`;
  const is = (...paths: string[]) => (p: string) => paths.some((x) => p === `${base}${x}` || p.startsWith(`${base}${x}/`));
  const main: Item[] = [
    { href: base, label: "Resumen", icon: Home, match: (p) => p === base || (editable && is("/editar", "/ciudades")(p)) },
    { href: `${base}/hoy`, label: "Hoy", icon: Sun, match: is("/hoy") },
    { href: `${base}/itinerario`, label: "Itinerario", icon: CalendarDays, match: is("/itinerario", "/actividades") },
    { href: `${base}/mapa`, label: "Mapa", icon: MapIcon, match: is("/mapa") },
    { href: `${base}/documentos`, label: "Documentos", icon: FileText, match: is("/documentos") },
  ];
  const more: Item[] = [
    { href: `${base}/hospedajes`, label: "Hospedajes", icon: BedDouble, match: is("/hospedajes") },
    { href: `${base}/transporte`, label: "Transporte", icon: Plane, match: is("/transporte") },
    { href: `${base}/guardados`, label: "Guardados", icon: Bookmark, match: is("/guardados") },
    { href: `${base}/presupuesto`, label: "Presupuesto", icon: PiggyBank, match: is("/presupuesto") },
    { href: `${base}/viajeros`, label: "Viajeros", icon: Users, match: is("/viajeros") },
  ];
  const inMore = more.find((m) => m.match(pathname));
  const tab = (active: boolean) =>
    "flex h-11 items-center gap-1 border-b-2 px-3 text-sm " +
    (active ? "border-primary font-semibold text-primary" : "border-transparent text-muted-foreground hover:border-border hover:text-foreground");

  return (
    <nav aria-label="Secciones del viaje" className="-mb-px">
      <ul className="flex gap-1">
        {main.map((t) => {
          const active = t.match(pathname);
          return (
            <li key={t.href} className="shrink-0">
              <Link href={t.href} aria-current={active ? "page" : undefined} className={tab(active)}>
                {t.label}
              </Link>
            </li>
          );
        })}
        <li className="shrink-0">
          <DropdownMenu.Root>
            {/* Shows the section you're in when it's one of these. */}
            <DropdownMenu.Trigger className={tab(Boolean(inMore)) + " outline-none focus-visible:ring-3 focus-visible:ring-ring/50"}>
              {inMore?.label ?? "Más"}
              {inMore && <span className="sr-only">, más secciones</span>}
              <ChevronDown className="size-4" aria-hidden="true" />
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content
                align="start"
                sideOffset={4}
                className="z-50 min-w-48 rounded-xl border bg-card p-1 shadow-lg"
              >
                {more.map((m) => {
                  const Icon = m.icon;
                  const active = m.match(pathname);
                  return (
                    <DropdownMenu.Item key={m.href} asChild>
                      <Link
                        href={m.href}
                        aria-current={active ? "page" : undefined}
                        className={
                          "flex min-h-10 items-center gap-2.5 rounded-lg px-2.5 text-sm outline-none data-[highlighted]:bg-muted " +
                          (active ? "font-semibold text-primary" : "text-foreground/80")
                        }
                      >
                        <Icon className={"size-4 " + (active ? "text-primary" : "text-muted-foreground")} aria-hidden="true" />
                        {m.label}
                      </Link>
                    </DropdownMenu.Item>
                  );
                })}
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        </li>
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
      <BottomBar items={bar} moreActive={inMore} more={<MoreSheet title={tripName} links={rest} active={inMore} />} />
    </>
  );
}

// ---------------------------------------------------------------------------
// Outside a trip
// ---------------------------------------------------------------------------

/**
 * Phones, outside a trip: Viajes, Hoy of the trip in progress (only when
 * there is one: no link to a trip you didn't pick), and Más. Hidden inside a
 * trip, where TripNav shows.
 */
export function GlobalNav({ activeTrip, signOut }: { activeTrip: { id: string; name: string } | null; signOut: React.ReactNode }) {
  const pathname = usePathname();
  if (TRIP_ROUTE.test(pathname)) return null;

  const bar: Item[] = [
    { href: "/viajes", label: "Viajes", icon: Navigation, match: (p) => p === "/viajes" },
    ...(activeTrip ? [{ href: `/viajes/${activeTrip.id}/hoy`, label: "Hoy", icon: Sun, match: () => false }] : []),
  ];
  const more: SheetLink[] = [
    { href: "/viajes/nuevo", label: "Nuevo viaje", icon: Plus },
    { href: "/cuenta", label: "Tu cuenta", icon: UserRound, hint: "Apariencia y avisos" },
  ];

  return (
    <BottomBar
      items={bar}
      moreActive={pathname === "/viajes/nuevo"}
      more={<MoreSheet title="Travio" links={more} active={pathname === "/viajes/nuevo"} footer={signOut} />}
    />
  );
}
