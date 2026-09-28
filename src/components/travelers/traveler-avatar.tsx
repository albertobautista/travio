import { cn } from "cn";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { initials } from "@/lib/initials";
import { isTravelerColor, TRAVELER_COLOR_CLASSES } from "@/lib/travelers/colors";

type Props = {
  traveler: { name: string; color: string; avatar_url: string | null };
  size?: "sm" | "default" | "lg";
  className?: string;
};

/** Account photo when the traveler is linked to one, else initials on their color. */
export function TravelerAvatar({ traveler, size = "default", className }: Props) {
  const colors = isTravelerColor(traveler.color) ? TRAVELER_COLOR_CLASSES[traveler.color] : TRAVELER_COLOR_CLASSES.blue;
  return (
    <Avatar size={size} className={className}>
      {traveler.avatar_url && (
        // Google may refuse to serve profile photos when a Referer header is sent.
        <AvatarImage src={traveler.avatar_url} alt="" referrerPolicy="no-referrer" />
      )}
      <AvatarFallback className={cn("font-semibold", colors)}>{initials(traveler.name)}</AvatarFallback>
    </Avatar>
  );
}

/** Overlapping avatars for a list of travelers, with an accessible summary. */
export function TravelerStack({
  travelers,
  max = 4,
}: {
  travelers: Props["traveler"][];
  max?: number;
}) {
  const shown = travelers.slice(0, max);
  const extra = travelers.length - shown.length;
  return (
    <span className="flex items-center" aria-label={travelers.map((t) => t.name).join(", ")} role="img">
      {shown.map((t, i) => (
        <TravelerAvatar key={i} traveler={t} size="sm" className={cn("ring-2 ring-card", i > 0 && "-ml-1.5")} />
      ))}
      {extra > 0 && <span className="ml-1 text-xs text-muted-foreground">+{extra}</span>}
    </span>
  );
}
