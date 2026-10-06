/** A grey placeholder shaped like the content that's loading. */
export function Skeleton({ className = "" }: { className?: string }) {
  // A light sweeps across (globals.css, shimmer) so the page never looks frozen.
  return (
    <div
      aria-hidden="true"
      className={
        "animate-shimmer rounded-md bg-[linear-gradient(90deg,var(--muted)_0,color-mix(in_oklab,var(--muted),var(--foreground)_7%)_50%,var(--muted)_100%)] bg-size-[800px_100%] " + className
      }
    />
  );
}

/**
 * Wraps a loading screen: announced once to screen readers, the blocks
 * themselves are hidden from them.
 */
export function LoadingScreen({ children, label = "Cargando…" }: { children: React.ReactNode; label?: string }) {
  return (
    <main role="status" aria-live="polite" className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-4 py-6">
      <span className="sr-only">{label}</span>
      {children}
    </main>
  );
}
