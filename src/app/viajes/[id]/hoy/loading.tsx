import { LoadingScreen, Skeleton } from "@/components/ui/skeleton";

/** Hoy's shape: header with weather, the next-plan card with its photo, the day's timeline. */
export default function Loading() {
  return (
    <LoadingScreen label="Cargando tu día…">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-1 flex-col gap-2">
          <Skeleton className="h-8 w-52" />
          <Skeleton className="h-4 w-44" />
          <Skeleton className="h-4 w-36" />
        </div>
        <Skeleton className="h-12 w-20" />
      </div>
      <div className="overflow-hidden rounded-[20px] border bg-card">
        <Skeleton className="h-[196px] rounded-none" />
        <div className="flex flex-col gap-3 p-4">
          <Skeleton className="h-4 w-32" />
          <div className="grid grid-cols-2 gap-2">
            <Skeleton className="h-11 rounded-lg" />
            <Skeleton className="h-11 rounded-lg" />
          </div>
        </div>
      </div>
      <Skeleton className="h-5 w-32" />
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} className="flex items-center gap-2.5">
          <Skeleton className="size-3 rounded-full" />
          <Skeleton className="h-3 w-10" />
          <Skeleton className="h-9 flex-1 rounded-lg" />
        </div>
      ))}
    </LoadingScreen>
  );
}
