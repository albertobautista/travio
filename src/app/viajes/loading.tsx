import { LoadingScreen, Skeleton } from "@/components/ui/skeleton";

/**
 * While any page under /viajes loads (Mis viajes, or a trip before its own
 * layout is ready). Generic on purpose: it covers every page below.
 */
export default function Loading() {
  return (
    <LoadingScreen>
      <Skeleton className="h-8 w-48" />
      <div className="flex gap-2">
        <Skeleton className="h-9 w-20 rounded-full" />
        <Skeleton className="h-9 w-24 rounded-full" />
        <Skeleton className="h-9 w-20 rounded-full" />
      </div>
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex gap-3 rounded-[18px] border bg-card p-2.5">
          <Skeleton className="h-28 w-23 shrink-0 rounded-xl" />
          <div className="flex flex-1 flex-col gap-2 py-1">
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-3 w-1/3" />
            <Skeleton className="mt-auto h-1.5 w-full rounded-full" />
          </div>
        </div>
      ))}
    </LoadingScreen>
  );
}
