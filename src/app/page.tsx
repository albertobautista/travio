import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { Bell, BedDouble, Check, Lock, Map as MapIcon, MapPin, PiggyBank, Plane, Smartphone, Sparkles } from "lucide-react";

import { DocumentsCard, HeroBadges, ItineraryDay, NowNext, PhoneToday, TogetherCards } from "@/components/landing/illustrations";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Travio · Tu viaje, todo en un lugar",
  description:
    "El itinerario, los hospedajes, los boletos y los gastos de todos, en una app para planear el viaje y usarlo en la calle, incluso sin conexión.",
  openGraph: {
    title: "Travio · Tu viaje, todo en un lugar",
    description: "El itinerario, los hospedajes, los boletos y los gastos de todos, también sin conexión.",
    type: "website",
    locale: "es_MX",
  },
};

const ROUTE = ["Barcelona", "Madrid", "Sevilla", "Málaga", "Granada", "Valencia", "San Sebastián"];

/**
 * The landing page: what Travio does, for someone who got the link. Only
 * features that exist (see CLAUDE.md); pictures of the app are drawn in
 * components/landing/illustrations. Signed-in people get "Abrir mis viajes"
 * instead of the sign-up calls to action.
 */
export default async function Home() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims);
  const start = signedIn ? { href: "/viajes", label: "Abrir mis viajes" } : { href: "/login?registro=1", label: "Crear mi primer viaje" };

  return (
    <div className="flex-1 overflow-x-clip bg-background">
      <header className="sticky top-0 z-20 border-b bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:h-[72px] sm:px-6">
          <Link href="/" className="flex items-center gap-2.5 text-[22px] font-extrabold tracking-tight">
            <span className="flex size-9 items-center justify-center rounded-[10px] bg-primary text-primary-foreground" aria-hidden="true">
              <Plane className="size-[18px]" />
            </span>
            Travio
          </Link>
          <nav aria-label="Secciones" className="hidden gap-7 text-[15px] font-medium text-foreground/80 md:flex">
            <a href="#planifica" className="hover:text-foreground">Planifica</a>
            <a href="#en-el-viaje" className="hover:text-foreground">En el viaje</a>
            <a href="#documentos" className="hover:text-foreground">Documentos</a>
            <a href="#juntos" className="hover:text-foreground">Juntos</a>
          </nav>
          <div className="flex gap-2">
            {signedIn ? (
              <Link href="/viajes" className="pressable flex h-11 items-center rounded-xl bg-primary px-4 text-[15px] font-semibold text-primary-foreground hover:bg-primary-hover">
                Mis viajes
              </Link>
            ) : (
              <>
                <Link href="/login" className="pressable hidden h-11 items-center rounded-xl border bg-card px-4 text-[15px] font-semibold hover:bg-muted sm:flex">
                  Iniciar sesión
                </Link>
                <Link
                  href="/login?registro=1"
                  className="pressable flex h-11 items-center rounded-xl bg-primary px-4 text-[15px] font-semibold text-primary-foreground hover:bg-primary-hover"
                >
                  Empieza gratis
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <main>
        <section className="mx-auto flex max-w-6xl flex-wrap items-center gap-14 px-4 pt-12 pb-20 sm:px-6 sm:pt-[72px] sm:pb-24">
          <div className="stagger flex min-w-0 flex-[1_1_440px] flex-col gap-6">
            <span className="flex w-fit items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5 text-[13px] font-semibold text-secondary-foreground">
              <MapPin className="size-3.5" aria-hidden="true" />
              Para viajes de varias ciudades y varias personas
            </span>
            <h1 className="text-[clamp(44px,6.4vw,76px)] leading-[1.02] font-extrabold tracking-[-0.035em] text-balance">
              Tu viaje, todo en un&nbsp;lugar.
            </h1>
            <p className="max-w-[540px] text-xl leading-relaxed text-foreground/80">
              El itinerario, los hospedajes, los boletos y los gastos de todos. Para planearlo en casa y para usarlo en la calle, incluso sin
              conexión.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                href={start.href}
                className="pressable flex h-[54px] items-center rounded-xl bg-primary px-6 text-[17px] font-semibold text-primary-foreground hover:bg-primary-hover"
              >
                {start.label}
              </Link>
              <a href="#planifica" className="pressable flex h-[54px] items-center rounded-xl border bg-card px-5 text-[17px] font-semibold hover:bg-muted">
                Ver cómo funciona
              </a>
            </div>
            <p className="text-sm text-muted-foreground">Funciona en el navegador y se instala en tu celular como una app.</p>
          </div>
          <div className="relative flex min-w-0 flex-[1_1_420px] animate-rise justify-center py-3 [animation-delay:200ms]">
            <PhoneToday />
            <HeroBadges />
          </div>
        </section>

        <section aria-label="Un viaje de ejemplo" className="border-y bg-card">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-3.5 gap-y-2.5 px-4 py-7 text-sm sm:px-6">
            <span className="mr-1.5 text-muted-foreground">Un viaje real en Travio:</span>
            {ROUTE.map((city, i) => (
              <span key={city} className="flex items-center gap-3.5">
                <span
                  className={
                    "rounded-full px-3 py-1.5 font-semibold " +
                    (i < 2 ? "bg-success-soft text-success-foreground" : i === 2 ? "bg-primary text-primary-foreground" : "bg-muted text-foreground/80")
                  }
                >
                  {city}
                </span>
                {i < ROUTE.length - 1 && (
                  <span aria-hidden="true" className="text-timeline">
                    →
                  </span>
                )}
              </span>
            ))}
            <span className="ml-1.5 text-muted-foreground">· 23 días · 3 viajeros</span>
          </div>
        </section>

        <Feature
          id="planifica"
          kicker="Planifica"
          title="Todo el viaje, día por día."
          lead="Arma la ruta de ciudades y llena cada día con planes que tienen hora y duración. Travio te avisa cuando algo no cuadra."
          points={[
            [<b key="b">Choques de horario</b>, ": si dos planes se enciman, lo ves en la tarjeta."],
            [<b key="b">Tiempo para llegar</b>, " entre un plan y otro, a pie, en transporte o en auto."],
            [<b key="b">Hospedajes y transporte</b>, " aparecen solos en el día que toca."],
            [<b key="b">Lugares guardados</b>, ": junta ideas y pásalas al itinerario cuando decidas."],
          ]}
          visual={<ItineraryDay />}
          className="pt-24 sm:pt-28"
        />
        <Feature
          id="en-el-viaje"
          kicker="Durante el viaje"
          title="Abre la app y ya sabes qué sigue."
          lead="La pantalla Hoy responde lo que preguntas en la calle: qué está pasando, qué sigue, cuándo salir y dónde está tu boleto."
          points={[
            [<b key="b">Ahora y siguiente</b>, ", con cuánto falta y a qué hora salir."],
            [<b key="b">Cómo llegar</b>, " en un toque, y el mapa del día con la ruta."],
            [<b key="b">El clima</b>, " donde estás, y qué planes pisa la lluvia."],
            [<b key="b">Sin conexión</b>, ": Hoy, el itinerario y tus boletos siguen ahí en modo avión."],
          ]}
          visual={<NowNext />}
          reverse
        />
        <Feature
          id="documentos"
          kicker="Documentos"
          title="Tus boletos, privados y a la mano."
          lead="Pases de abordar, reservas y entradas viven junto al plan al que pertenecen, no perdidos en el correo."
          points={[
            [<b key="b">Solo los ve quien tiene acceso al viaje.</b>, " Nunca hay un enlace público a tus archivos."],
            [<b key="b">«Para hoy»</b>, ": los que necesitas hoy, primero."],
            [<b key="b">Descárgalos para el viaje</b>, " y ábrelos sin señal."],
          ]}
          icon={<Lock className="size-3.5" strokeWidth={2.4} aria-hidden="true" />}
          visual={<DocumentsCard />}
        />
        <Feature
          id="juntos"
          kicker="Viajen juntos"
          title="Un solo plan para todo el grupo."
          lead="Invita a quien viaja contigo y decide quién puede editar. Los que no tienen cuenta también cuentan en los planes y los gastos."
          points={[
            [<b key="b">Invita por enlace o correo</b>, ", con acceso de lectura o de edición."],
            [<b key="b">Gastos divididos</b>, " en partes iguales, montos o porcentajes, y quién le paga a quién."],
            [<b key="b">Avisos por correo</b>, " cuando alguien se une o cambia el plan, al momento o en un resumen."],
          ]}
          visual={<TogetherCards />}
          reverse
          className="pb-24 sm:pb-28"
        />

        <section aria-labelledby="mas" className="border-y bg-card">
          <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-20 sm:px-6 sm:py-22">
            <h2 id="mas" className="text-center text-[clamp(28px,4vw,40px)] leading-tight font-extrabold tracking-tight">
              Y lo demás que un viaje necesita
            </h2>
            <div className="stagger grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-4">
              <Mini icon={MapIcon} title="Mapa del día" text="Tus planes, el hotel y los lugares guardados en un mapa, con la ruta del día." />
              <Mini icon={PiggyBank} title="Presupuesto" text="Lo estimado contra lo gastado, por categoría, con tus tipos de cambio." />
              <Mini icon={BedDouble} title="Hospedajes y trayectos" text="Check-in, referencias, asientos y andenes, en su día del itinerario." />
              <Mini icon={Smartphone} title="Se instala en tu celular" text="Ábrela desde la pantalla de inicio, como cualquier app, sin tienda de apps." />
              <Mini icon={Bell} title="Recordatorio antes de salir" text="Un correo el día anterior con lo del primer día y tus documentos." />
              <Mini icon={Sparkles} title="Ideas para tus ratos libres" text="Opcional: si te sobran dos horas, sugerencias cerca que caben antes del siguiente plan." />
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-24">
          <div className="relative flex flex-col items-center gap-5 overflow-hidden rounded-[28px] bg-primary px-6 py-16 text-center text-primary-foreground">
            <Plane aria-hidden="true" strokeWidth={1} className="absolute -top-10 -right-14 size-80 text-white/10" />
            <h2 className="relative text-[clamp(32px,4.6vw,48px)] leading-tight font-extrabold tracking-tight">¿A dónde vas ahora?</h2>
            <p className="relative max-w-[520px] text-lg leading-relaxed text-white/90">
              Empieza con un nombre. Las fechas, las ciudades y los boletos pueden llegar después.
            </p>
            <Link href={start.href} className="pressable relative flex h-[54px] items-center rounded-xl bg-card px-7 text-[17px] font-semibold text-secondary-foreground hover:bg-secondary">
              {start.label}
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 pt-7 pb-9 text-sm text-muted-foreground sm:px-6">
          <span>
            <b className="text-foreground">Travio</b> · Tu viaje, todo en un lugar.
          </span>
          {!signedIn && (
            <span className="flex gap-5">
              <Link href="/login" className="hover:text-foreground">
                Iniciar sesión
              </Link>
              <Link href="/login?registro=1" className="hover:text-foreground">
                Crear cuenta
              </Link>
            </span>
          )}
        </div>
      </footer>
    </div>
  );
}

function Feature({
  id,
  kicker,
  title,
  lead,
  points,
  visual,
  icon,
  reverse = false,
  className = "",
}: {
  id: string;
  kicker: string;
  title: string;
  lead: string;
  points: ReactNode[][];
  visual: ReactNode;
  /** The bullet icon (a check by default). */
  icon?: ReactNode;
  reverse?: boolean;
  className?: string;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className={`mx-auto max-w-6xl scroll-mt-20 px-4 py-14 sm:px-6 ${className}`}>
      <div className={`flex flex-wrap items-center gap-12 ${reverse ? "flex-row-reverse" : ""}`}>
        <div className="flex min-w-0 flex-[1_1_360px] flex-col gap-4">
          <span className="text-[13px] font-bold tracking-[.06em] text-primary uppercase">{kicker}</span>
          <h2 id={`${id}-title`} className="text-[clamp(28px,4vw,40px)] leading-[1.1] font-extrabold tracking-tight text-balance">
            {title}
          </h2>
          <p className="text-lg leading-relaxed text-foreground/80">{lead}</p>
          <ul className="mt-2 flex flex-col gap-3">
            {points.map((point, i) => (
              <li key={i} className="flex items-start gap-3 leading-snug text-foreground/80 [&_b]:font-semibold [&_b]:text-foreground">
                <span className="mt-px flex size-6 shrink-0 items-center justify-center rounded-full bg-secondary text-primary" aria-hidden="true">
                  {i === 0 && icon ? icon : <Check className="size-3.5" strokeWidth={3} />}
                </span>
                <span>{point}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="flex min-w-0 flex-[1_1_440px] justify-center">{visual}</div>
      </div>
    </section>
  );
}

function Mini({ icon: Icon, title, text }: { icon: typeof Check; title: string; text: string }) {
  return (
    <div className="flex flex-col gap-2.5 rounded-[18px] border bg-background p-[22px]">
      <span className="flex size-10 items-center justify-center rounded-xl bg-secondary text-primary" aria-hidden="true">
        <Icon className="size-5" />
      </span>
      <h3 className="text-[17px] font-bold">{title}</h3>
      <p className="text-sm leading-relaxed text-muted-foreground">{text}</p>
    </div>
  );
}
