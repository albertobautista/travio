import { LoadingScreen, Skeleton } from "@/components/ui/skeleton";

/** Any section of a trip while it loads; the trip's header and tabs stay (they're in the layout). */
export default function Loading() {
  return (
    <LoadingScreen>
      <Skeleton className="h-8 w-40" />
      <Skeleton className="h-4 w-64" />
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="flex items-center gap-3 rounded-2xl border bg-card p-4">
          <Skeleton className="size-11 shrink-0 rounded-xl" />
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-3 w-3/4" />
          </div>
        </div>
      ))}
    </LoadingScreen>
  );
}
