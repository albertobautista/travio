"use client";

import { LogOut } from "lucide-react";

import { signOut } from "@/app/login/actions";
import { clearOfflineData } from "@/lib/offline/storage";

/**
 * "Cerrar sesión": first deletes the trip pages and documents kept on this
 * device for offline use, then signs out on the server.
 */
export function SignOutButton() {
  return (
    <form
      action={async () => {
        await clearOfflineData();
        await signOut();
      }}
    >
      <button
        type="submit"
        className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-sm text-muted-foreground hover:bg-muted"
      >
        <LogOut className="size-[18px]" aria-hidden="true" />
        Cerrar sesión
      </button>
    </form>
  );
}
