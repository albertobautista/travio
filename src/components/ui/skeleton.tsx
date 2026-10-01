/** A grey placeholder shaped like the content that's loading. */
export function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden="true" className={"animate-pulse rounded-md bg-muted " + className} />;
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
