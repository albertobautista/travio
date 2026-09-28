import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function TripNotFound() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-2xl font-bold tracking-tight">No encontramos este viaje</h1>
      <p className="max-w-sm text-muted-foreground">
        Puede que no exista o que no tengas acceso. Pide a quien lo organiza que te invite.
      </p>
      <Button asChild size="lg">
        <Link href="/viajes">Volver a mis viajes</Link>
      </Button>
    </main>
  );
}
