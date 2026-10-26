import { House, MapPin, Waypoints, type LucideIcon } from "lucide-react";

import type { StopKind } from "@/lib/trips/stops";

export const STOP_KIND_ICON: Record<StopKind, LucideIcon> = {
  destination: MapPin,
  origin: House,
  transit: Waypoints,
};
