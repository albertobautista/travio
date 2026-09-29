"use client";

import { useEffect, useState } from "react";

import { formatStartsIn } from "@/lib/activities/day-plan";

/**
 * "en 1 h 05 min", kept current while the page stays open.
 * The first render uses the server's text so server and browser HTML match;
 * after that the browser's clock takes over.
 */
export function StartsIn({ startsAt, initial }: { startsAt: string; initial: string }) {
  const [label, setLabel] = useState(initial);

  useEffect(() => {
    const update = () => setLabel(formatStartsIn(new Date(startsAt), new Date()));
    const id = setInterval(update, 30_000);
    return () => clearInterval(id);
  }, [startsAt]);

  return <span>{label}</span>;
}
