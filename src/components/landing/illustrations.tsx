import { BedDouble, Camera, Check, CheckCircle2, CloudOff, Lock, Ticket } from "lucide-react";

/**
 * Pictures of the app for the landing page, drawn with the app's own tokens
 * instead of screenshots: crisp at any size, and no real person's data on a
 * public page (sample names: Ana, Luis, Sofía). Purely decorative: each is
 * one image for screen readers (role="img" + aria-label), its text hidden.
 */

const shadow = "shadow-[0_30px_60px_-36px_rgba(11,27,51,.35)]";

function Dot({ kind }: { kind: "done" | "now" | "next" }) {
  return (
    <span
      className={
        "size-3 shrink-0 rounded-full " +
        (kind === "done" ? "bg-success" : kind === "now" ? "animate-now-pulse bg-primary text-primary" : "border-2 border-primary")
      }
    />
  );
}

/** The Hoy screen in a phone, for the hero. */
export function PhoneToday() {
  return (
    <div
      role="img"
      aria-label="La pantalla Hoy de Travio en un celular: lo que está pasando, lo que sigue y a qué hora salir"
      className="flex h-[612px] w-[300px] flex-col gap-2.5 overflow-hidden rounded-[46px] border-[10px] border-foreground bg-background px-3.5 py-5 shadow-[0_40px_80px_-30px_rgba(11,27,51,.45)]"
    >
      <div aria-hidden="true" className="contents">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[11px] text-muted-foreground">España 2026 · día 7 de 23</p>
            <p className="text-[21px] font-extrabold tracking-tight">Hoy en Madrid</p>
          </div>
          <span className="rounded-xl border bg-card px-2 py-1.5 text-[15px] font-bold">20°</span>
        </div>
        <div className="rounded-xl bg-secondary px-2.5 py-2 text-[11px] text-secondary-foreground">
          <b>Lluvia probable 15:00–20:00</b> · afecta 4 planes
        </div>
        <div className="overflow-hidden rounded-[18px] border bg-card">
          <div className="relative flex h-[104px] items-end bg-[#2C4466] px-3 py-2.5 text-white">
            <span className="absolute top-2 right-2 flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold">
              <span className="size-1.5 animate-now-pulse rounded-full bg-white text-white" />
              En curso
            </span>
            <span>
              <span className="block text-[10px] opacity-80">Ahora</span>
              <span className="text-[15px] font-bold">Museo Reina Sofía</span>
            </span>
          </div>
          <div className="flex flex-col gap-2 px-3 py-2.5">
            <div className="flex justify-between text-[11px] text-foreground/80">
              <span className="font-mono">17:30 – 19:30</span>
              <span>
                Termina en <b>12 min</b>
              </span>
            </div>
            <div className="h-[5px] rounded-full bg-border">
              <div className="bar-fill h-full w-[88%] rounded-full bg-primary" />
            </div>
            <div className="flex h-[34px] items-center justify-center rounded-[10px] bg-primary text-xs font-semibold text-primary-foreground">Ver ticket</div>
          </div>
        </div>
        <div className="rounded-[18px] border bg-card px-3 py-2.5">
          <p className="text-[10px] font-bold text-primary">Siguiente · en 47 min</p>
          <p className="mt-0.5 text-[13px] font-semibold">Templo de Debod</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            Sal a las <b className="font-mono text-foreground">19:40</b> · 25 min en metro
          </p>
        </div>
        <div className="rounded-[18px] border bg-card p-1.5 text-[11px]">
          <div className="flex items-center gap-2.5 px-2 py-1.5 text-muted-foreground">
            <Dot kind="done" />
            <span className="font-mono">16:05</span>
            <span className="line-through">Paseo por La Latina</span>
          </div>
          <div className="flex items-center gap-2.5 rounded-lg bg-secondary px-2 py-1.5 font-semibold">
            <Dot kind="now" />
            <span className="font-mono">17:30</span>
            <span>Museo Reina Sofía</span>
          </div>
          <div className="flex items-center gap-2.5 px-2 py-1.5 font-semibold">
            <Dot kind="next" />
            <span className="font-mono">20:05</span>
            <span>Templo de Debod</span>
          </div>
        </div>
      </div>
    </div>
  );
}

const avatar = {
  A: "bg-sky-100 text-sky-900",
  L: "bg-pink-100 text-pink-900",
  S: "bg-emerald-100 text-emerald-900",
} as const;

function Avatar({ letter, className = "" }: { letter: keyof typeof avatar; className?: string }) {
  return (
    <span className={`flex size-7 items-center justify-center rounded-full border-2 border-card text-[11px] font-bold ${avatar[letter]} ${className}`}>
      {letter}
    </span>
  );
}

/** The two cards drifting around the phone in the hero. */
export function HeroBadges() {
  return (
    <>
      <div
        aria-hidden="true"
        className="absolute bottom-[72px] left-0 hidden animate-float items-center gap-2.5 rounded-[18px] border bg-card px-3.5 py-3 shadow-[0_18px_40px_-20px_rgba(11,27,51,.35)] sm:flex"
      >
        <span className="flex size-[34px] items-center justify-center rounded-xl bg-success-soft text-success-foreground">
          <Check className="size-4" strokeWidth={2.6} />
        </span>
        <span className="text-[13px] leading-tight">
          <b>39 documentos</b>
          <br />
          <span className="text-muted-foreground">listos sin conexión</span>
        </span>
      </div>
      <div
        aria-hidden="true"
        className="absolute top-16 right-0 hidden animate-float items-center gap-2.5 rounded-[18px] border bg-card px-3.5 py-3 shadow-[0_18px_40px_-20px_rgba(11,27,51,.35)] [animation-delay:-2.5s] sm:flex"
      >
        <span className="flex">
          <Avatar letter="A" />
          <Avatar letter="L" className="-ml-2" />
          <Avatar letter="S" className="-ml-2" />
        </span>
        <span className="text-[13px] leading-tight">
          <b>Sofía se unió</b>
          <br />
          <span className="text-muted-foreground">puede editar el viaje</span>
        </span>
      </div>
    </>
  );
}

/** A day of the itinerary, with travel time and an overlap warning. */
export function ItineraryDay() {
  return (
    <div role="img" aria-label="Un día del itinerario con el tiempo a pie entre planes y un aviso de choque de horario" className={`flex w-full max-w-[480px] flex-col gap-2.5 rounded-[18px] border bg-card p-5 ${shadow}`}>
      <div aria-hidden="true" className="contents">
        <div className="flex items-center justify-between">
          <b className="text-[17px]">Sábado 3 oct · Madrid</b>
          <span className="text-[13px] text-muted-foreground">21° / 18°</span>
        </div>
        <div className="flex items-start gap-2.5">
          <span className="w-11 pt-3 font-mono text-[13px] font-semibold">10:00</span>
          <div className="flex flex-1 flex-col gap-1.5 rounded-[14px] border p-3">
            <b className="text-[15px]">Palacio Real</b>
            <span className="text-xs text-muted-foreground">10:00–11:30 · 1 h 30</span>
            <span className="flex gap-1.5">
              <span className="rounded-full bg-success-soft px-2.5 py-0.5 text-xs font-semibold text-success-foreground">Turismo</span>
              <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-semibold text-secondary-foreground">Confirmada</span>
            </span>
          </div>
        </div>
        <span className="ml-[54px] w-fit rounded-full bg-muted px-2.5 py-1 text-xs text-foreground/80">13 min a pie · te sobran 17 min</span>
        <div className="flex items-start gap-2.5">
          <span className="w-11 pt-3 font-mono text-[13px] font-semibold">12:00</span>
          <div className="flex flex-1 flex-col gap-1.5 rounded-[14px] border border-warning-border bg-warning-soft p-3">
            <b className="text-[15px]">Catedral de la Almudena</b>
            <span className="text-xs text-muted-foreground">12:00–13:00 · 1 h</span>
            <span className="text-xs text-warning-foreground">
              Se solapa 30 min con Mercado de San Miguel · <u>Ajustar</u>
            </span>
          </div>
        </div>
        <div className="flex items-start gap-2.5">
          <span className="w-11 pt-3 font-mono text-[13px] font-semibold">12:30</span>
          <div className="flex flex-1 flex-col gap-1 rounded-[14px] border border-warning-border bg-warning-soft p-3">
            <b className="text-[15px]">Mercado de San Miguel</b>
            <span className="text-xs text-muted-foreground">12:30–13:30 · Comida</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/** "Ahora" and "Siguiente" with the offline banner. */
export function NowNext() {
  return (
    <div role="img" aria-label="Las tarjetas de Ahora y Siguiente, funcionando sin conexión" className="flex w-full max-w-[440px] flex-col gap-3">
      <div aria-hidden="true" className="contents">
        <div className="flex items-center gap-2.5 rounded-[14px] border border-warning-border bg-warning-soft px-3.5 py-2.5 text-sm text-warning-foreground">
          <CloudOff className="size-4" />
          <span>
            <b>Sin conexión.</b> Datos guardados a las 18:56.
          </span>
        </div>
        <div className={`flex flex-col gap-2.5 rounded-[18px] border bg-card p-[18px] ${shadow}`}>
          <div className="flex items-center justify-between">
            <span className="text-[13px] text-muted-foreground">Ahora</span>
            <span className="flex items-center gap-1.5 rounded-full bg-primary px-2.5 py-0.5 text-xs font-semibold text-primary-foreground">
              <span className="size-1.5 animate-now-pulse rounded-full bg-white text-white" />
              En curso
            </span>
          </div>
          <b className="text-xl">Museo Reina Sofía (Guernica)</b>
          <div className="flex justify-between text-[13px] text-foreground/80">
            <span className="font-mono">17:30 – 19:30</span>
            <span>
              Termina en <b>12 min</b>
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-border">
            <div className="bar-fill h-full w-[88%] rounded-full bg-primary" />
          </div>
        </div>
        <div className="flex items-center gap-3.5 rounded-[18px] border bg-card px-[18px] py-4">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-success-soft text-success-foreground">
            <Camera className="size-5" />
          </span>
          <span className="flex-1">
            <span className="block text-xs font-bold text-primary">Siguiente · en 47 min</span>
            <b>Templo de Debod</b>
            <span className="block text-[13px] text-muted-foreground">
              Sal a las <b className="font-mono text-foreground">19:40</b> · 25 min en metro
            </span>
          </span>
        </div>
      </div>
    </div>
  );
}

/** The document wallet. */
export function DocumentsCard() {
  const file = (Icon: typeof Ticket, name: string, meta: string) => (
    <div className="flex items-center gap-2.5 rounded-xl border p-2.5">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-violet-800">
        <Icon className="size-[18px]" />
      </span>
      <span className="flex-1">
        <b className="text-sm">{name}</b>
        <br />
        <span className="text-xs text-muted-foreground">{meta}</span>
      </span>
    </div>
  );
  return (
    <div role="img" aria-label="La lista de documentos del viaje, privados y disponibles sin conexión" className={`flex w-full max-w-[460px] flex-col gap-3 rounded-[18px] border bg-card p-[18px] ${shadow}`}>
      <div aria-hidden="true" className="contents">
        <div className="flex items-center justify-between">
          <b className="text-lg">Documentos</b>
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Lock className="size-3.5" />
            Privados
          </span>
        </div>
        <div className="flex flex-wrap gap-1.5 text-xs font-semibold">
          <span className="rounded-full bg-foreground px-3 py-1 text-background">Todos 39</span>
          <span className="rounded-full bg-muted px-3 py-1 text-foreground/80">Vuelos 5</span>
          <span className="rounded-full bg-muted px-3 py-1 text-foreground/80">Trenes 2</span>
          <span className="rounded-full bg-muted px-3 py-1 text-foreground/80">Hoteles 7</span>
        </div>
        <span className="text-[11px] font-bold tracking-wide text-muted-foreground">PARA HOY</span>
        {file(Ticket, "Entradas Real Alcázar.pdf", "PDF · Real Alcázar · 16:00")}
        {file(BedDouble, "Reserva hotel Sevilla.pdf", "PDF · Esta noche")}
        <div className="flex items-center gap-2.5 rounded-xl bg-success-soft p-3 text-[13px] text-success-foreground">
          <CheckCircle2 className="size-[18px] shrink-0" />
          <span>
            <b>Disponibles sin conexión</b> · los 39 están en este teléfono
          </span>
        </div>
      </div>
    </div>
  );
}

/** Who has access, and who owes whom. */
export function TogetherCards() {
  const member = (letter: keyof typeof avatar, name: string, role: string) => (
    <div className="flex items-center gap-2.5">
      <span className={`flex size-[34px] items-center justify-center rounded-full text-[13px] font-bold ${avatar[letter]}`}>{letter}</span>
      <span className="flex-1 text-sm">
        <b>{name}</b>
        <br />
        <span className="text-xs text-muted-foreground">{role}</span>
      </span>
    </div>
  );
  return (
    <div role="img" aria-label="Quién tiene acceso al viaje, con su permiso, y quién le paga a quién" className="flex w-full max-w-[460px] flex-col gap-3">
      <div aria-hidden="true" className="contents">
        <div className={`flex flex-col gap-3 rounded-[18px] border bg-card px-[18px] py-4 ${shadow}`}>
          <b>Acceso al viaje</b>
          {member("A", "Ana", "Propietaria")}
          {member("S", "Sofía", "Puede editar")}
          {member("L", "Luis", "Solo lectura · invitación enviada por correo")}
        </div>
        <div className="flex flex-col gap-2.5 rounded-[18px] border bg-card px-[18px] py-4">
          <div className="flex justify-between">
            <b>Cuentas claras</b>
            <span className="text-xs text-muted-foreground">MXN</span>
          </div>
          <div className="flex justify-between text-sm">
            <span>Luis le paga a Ana</span>
            <b className="font-mono">$1,840.00</b>
          </div>
          <div className="flex justify-between text-sm">
            <span>Sofía le paga a Ana</span>
            <b className="font-mono">$620.50</b>
          </div>
          <div className="flex h-10 items-center justify-center rounded-[10px] border text-[13px] font-semibold">Marcar pagado</div>
        </div>
      </div>
    </div>
  );
}
