import { LoadingScreen, Skeleton } from "@/components/ui/skeleton";

/** The itinerary's shape: day chips, the day header, timeline cards. */
export default function Loading() {
  return (
    <LoadingScreen label="Cargando el itinerario…">
      <Skeleton className="h-8 w-36" />
      <div className="-mx-4 flex gap-2 overflow-hidden px-4">
        {[0, 1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-14 w-20 shrink-0 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-6 w-48" />
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="flex items-center gap-2.5">
          <Skeleton className="size-3 rounded-full" />
          <Skeleton className="h-3 w-10" />
          <div className="flex flex-1 items-center gap-2.5 rounded-[14px] border bg-card px-2.5 py-2">
            <Skeleton className="size-11 shrink-0 rounded-[10px]" />
            <div className="flex flex-1 flex-col gap-2">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
        </div>
      ))}
    </LoadingScreen>
  );
}
