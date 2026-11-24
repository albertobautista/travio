import { Fragment } from "react";
import { cn } from "cn";

import { initials } from "@/lib/initials";
import { isTravelerColor, TRAVELER_COLOR_CLASSES } from "@/lib/travelers/colors";
import { SEAT_LAYOUT_META, seatLabel, seatPosition, type SeatLayout } from "@/lib/transportations/seat-map";

export type SeatTraveler = { id: string; name: string; color: string };

type Props = {
  layout: SeatLayout;
  /** Rows to draw, with "gap" where rows are skipped (see visibleRows). */
  rows: (number | "gap")[];
  /** Who sits in a seat ("14A"), if anyone. */
  occupant: (seat: string) => SeatTraveler | undefined;
  /** "sm" for cards (read only), "lg" for the picker (≈44 px seats). */
  size?: "sm" | "lg";
  /** Makes each seat a button. */
  onSeat?: (seat: string) => void;
  /** In the picker, whose seat is being chosen: their seat is outlined. */
  activeTravelerId?: string;
};

/**
 * A generic cabin seen from above, nose at the top: one column per seat letter,
 * an aisle between blocks and the row number on the left. Drawn with plain
 * elements (no SVG) so each seat can be a real, focusable button.
 */
export function SeatMap({ layout, rows, occupant, size = "sm", onSeat, activeTravelerId }: Props) {
  const blocks = SEAT_LAYOUT_META[layout].blocks;
  // Seats shrink to fit a 10-across cabin on a phone, up to 44 px (lg) or 28 px (sm).
  const seat = size === "lg" ? "aspect-square min-w-0 flex-1 max-w-11 rounded-lg text-xs" : "aspect-square min-w-0 flex-1 max-w-7 rounded-md text-[10px]";
  const letterWidth = size === "lg" ? "min-w-0 flex-1 max-w-11 text-xs" : "min-w-0 flex-1 max-w-7 text-[10px]";
  const aisle = size === "lg" ? "w-4 sm:w-6" : "w-3";
  const rowLabel = size === "lg" ? "w-6 text-xs" : "w-5 text-[10px]";

  function header() {
    return (
      <div className="flex items-center gap-1" aria-hidden="true">
        <span className={cn("shrink-0", rowLabel)} />
        {blocks.map((block, b) => (
          <Fragment key={b}>
            {b > 0 && <span className={cn("shrink-0", aisle)} />}
            <span className="flex min-w-0 justify-center gap-1" style={{ flex: block.length }}>
              {block.map((letter) => (
                <span key={letter} className={cn("text-center font-mono text-muted-foreground", letterWidth)}>
                  {letter}
                </span>
              ))}
            </span>
          </Fragment>
        ))}
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col", size === "lg" ? "gap-1.5" : "gap-1")}>
      {/* The nose, so "front" is obvious without a legend. */}
      <div aria-hidden="true" className="mx-auto mb-1 h-4 w-2/5 rounded-t-full border-x border-t bg-muted/60" />
      {size === "lg" && <div className="sticky top-0 z-10 -mx-2 bg-card px-2 py-1">{header()}</div>}
      {size === "sm" && header()}
      {rows.map((row, i) =>
        row === "gap" ? (
          <div key={`gap-${i}`} aria-hidden="true" className="text-center text-xs leading-3 text-muted-foreground">
            ⋯
          </div>
        ) : (
          <div key={row} data-row={row} className="flex items-center gap-1">
            <span className={cn("shrink-0 text-right font-mono text-muted-foreground tabular-nums", rowLabel)} aria-hidden="true">
              {row}
            </span>
            {blocks.map((block, b) => (
              <Fragment key={b}>
                {b > 0 && <span className={cn("shrink-0", aisle)} aria-hidden="true" />}
                <span className="flex min-w-0 justify-center gap-1" style={{ flex: block.length }}>
                  {block.map((letter) => {
                    const label = seatLabel(row, letter);
                    const who = occupant(label);
                    const colors = who ? (isTravelerColor(who.color) ? TRAVELER_COLOR_CLASSES[who.color] : TRAVELER_COLOR_CLASSES.blue) : "";
                    const mine = Boolean(who && activeTravelerId && who.id === activeTravelerId);
                    const className = cn(
                      "flex items-center justify-center font-semibold",
                      seat,
                      who ? colors : "border bg-card",
                      mine && "ring-2 ring-primary ring-offset-1 ring-offset-card",
                    );
                    const position = seatPosition(layout, letter);
                    const description = [label, position, who ? who.name : "libre"].filter(Boolean).join(", ");
                    if (onSeat) {
                      return (
                        <button
                          key={letter}
                          type="button"
                          onClick={() => onSeat(label)}
                          aria-label={description}
                          aria-pressed={mine}
                          className={cn(className, !who && "hover:border-primary hover:bg-secondary", "focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none")}
                        >
                          {who ? initials(who.name) : ""}
                        </button>
                      );
                    }
                    return (
                      <span key={letter} className={className} title={who ? description : undefined}>
                        {who ? initials(who.name) : ""}
                      </span>
                    );
                  })}
                </span>
              </Fragment>
            ))}
          </div>
        ),
      )}
    </div>
  );
}
