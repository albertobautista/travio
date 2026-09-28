import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 px-4 text-center">
      <div className="flex flex-col gap-2">
        <h1 className="text-4xl font-bold tracking-tight">Travio</h1>
        <p className="text-muted-foreground">Tu viaje, todo en un lugar.</p>
      </div>
      <Button size="lg" asChild>
        <Link href="/viajes">Empezar</Link>
      </Button>
    </main>
  );
}
