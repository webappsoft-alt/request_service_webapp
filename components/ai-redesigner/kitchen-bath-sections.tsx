"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowRight, Bath, ChefHat } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FINISH_CATEGORIES } from "@/lib/api/ai-redesigner-client";
import type { RedesignCatalog, RedesignFinish, RedesignStyle, RoomType } from "@/lib/api/ai-redesigner-client";
import { cn } from "@/lib/utils";
import { DESIGNER_ANCHOR, scrollToDesigner, tryStyleInDesigner } from "./designer-events";

/** Hero CTA: smooth-scrolls to the designer (#demo); a real link without JavaScript. */
export function TryItNowButton({ className }: { className?: string }) {
  return (
    <Button size="lg" className={cn("h-12 rounded-full px-6 text-[15px]", className)} asChild>
      <a
        href={`#${DESIGNER_ANCHOR}`}
        onClick={(event) => {
          event.preventDefault();
          scrollToDesigner();
        }}
      >
        Try It Now
        <ArrowDown className="size-4" aria-hidden="true" />
      </a>
    </Button>
  );
}

const ROOMS: Array<{ value: RoomType; label: string; icon: typeof ChefHat }> = [
  { value: "kitchen", label: "Kitchen", icon: ChefHat },
  { value: "bathroom", label: "Bathroom", icon: Bath },
];

type RoomInfo = NonNullable<RedesignCatalog["rooms"]>[number];
type Chip = { name: string; color: string };

/** A style's default finish names ("Shaker, Slab, Subway") and its named color palette. */
function describeStyle(style: RedesignStyle, byId: Map<string, RedesignFinish>) {
  const materials: string[] = [];
  const palette: Chip[] = [];
  for (const key of FINISH_CATEGORIES) {
    const pick = style.defaults?.[key];
    const finishStyle = pick?.style ? byId.get(pick.style) : undefined;
    const finishColor = pick?.color ? byId.get(pick.color) : undefined;
    if (finishStyle?.name && !materials.includes(finishStyle.name)) materials.push(finishStyle.name);
    if (finishColor?.color && !palette.some((chip) => chip.name === finishColor.name)) {
      palette.push({ name: finishColor.name, color: finishColor.color });
    }
  }
  // No color finishes linked: the style's own swatches.
  if (!palette.length) style.swatches.forEach((color) => palette.push({ name: "", color }));
  return { materials, palette: palette.slice(0, 5) };
}

/**
 * Style library: the admin's styles per room as compact cards (framed photo, name + "Try" pill,
 * a two-line summary and a slim palette bar). A click selects that room and style in the designer
 * above and scrolls to it.
 * Previous designs (2026-11-24): a dark name + swatch pill over each photo, then tall cards with a
 * finish table + labeled chips (too busy; styles without finishes left empty cards).
 */
export function StyleShowcase({
  styles,
  finishes = [],
}: {
  styles: RedesignStyle[];
  finishes?: RedesignFinish[];
  /** Kept for callers; room labels are not shown on the compact cards. */
  rooms?: RoomInfo[];
}) {
  const [room, setRoom] = useState<RoomType>("kitchen");
  const byId = useMemo(() => new Map(finishes.map((finish) => [finish.id, finish])), [finishes]);
  const tabs = ROOMS.filter((item) => styles.some((style) => style.roomType === item.value));
  const shown = styles.filter((style) => style.roomType === room).slice(0, 8);
  if (!shown.length) return null;
  const roomLabel = ROOMS.find((item) => item.value === room)?.label || "";

  return (
    <div className="flex flex-col gap-8">
      {tabs.length > 1 ? (
        <div
          role="tablist"
          aria-label="Room"
          className="mx-auto grid w-full max-w-xs grid-cols-2 gap-1 rounded-xl border bg-card p-1"
        >
          {tabs.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={room === value}
              onClick={() => setRoom(value)}
              className={cn(
                "inline-flex h-10 items-center justify-center gap-2 rounded-lg text-sm font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                room === value
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <Icon className="size-4" aria-hidden="true" />
              {label}
            </button>
          ))}
        </div>
      ) : null}

      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {shown.map((style) => {
          const { materials, palette } = describeStyle(style, byId);
          const summary =
            style.description ||
            (materials.length ? materials.join(", ") : `The ${style.name} ${roomLabel.toLowerCase()} look, ready to customize.`);
          return (
            <li key={style.id} className="flex">
              <button
                type="button"
                onClick={() => tryStyleInDesigner({ roomType: style.roomType, styleId: style.id })}
                className="group flex w-full flex-col rounded-2xl border bg-card p-2 text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                aria-label={`Try the ${style.name} ${style.roomType} style in the designer`}
              >
                <span className="relative block aspect-4/3 w-full overflow-hidden rounded-xl bg-muted">
                  {style.image ? (
                    // eslint-disable-next-line @next/next/no-img-element -- admin-uploaded style photo (our storage)
                    <img
                      src={style.image}
                      alt=""
                      loading="lazy"
                      className="absolute inset-0 size-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                    />
                  ) : (
                    // No photo yet: the style's own palette.
                    <span
                      aria-hidden="true"
                      className="absolute inset-0"
                      style={{
                        background: `linear-gradient(135deg, ${(style.swatches.length ? style.swatches : ["#e2e8f0", "#94a3b8"]).join(", ")})`,
                      }}
                    />
                  )}
                  <span className="absolute top-2.5 left-2.5 rounded-md bg-background/95 px-2 py-0.5 text-[11px] font-semibold tracking-wide text-foreground uppercase opacity-0 shadow-sm transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                    {roomLabel}
                  </span>
                </span>

                <span className="flex flex-1 flex-col gap-2 px-2 pt-3 pb-2">
                  <span className="flex items-center justify-between gap-3">
                    <span className="min-w-0 truncate text-[15px] font-semibold text-foreground">{style.name}</span>
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                      Try
                      <ArrowRight className="size-3.5" aria-hidden="true" />
                    </span>
                  </span>
                  <span className="line-clamp-2 min-h-10 text-[13px] leading-5 text-muted-foreground">{summary}</span>
                  {palette.length ? (
                    <span className="mt-auto flex flex-col gap-1.5 pt-1">
                      <span
                        className="flex h-2 w-full overflow-hidden rounded-full ring-1 ring-black/5 dark:ring-white/15"
                        aria-hidden="true"
                      >
                        {palette.map((chip, index) => (
                          <span
                            key={`${chip.color}-${index}`}
                            className="h-full flex-1"
                            style={{ backgroundColor: chip.color }}
                            title={chip.name || undefined}
                          />
                        ))}
                      </span>
                      {palette.some((chip) => chip.name) ? (
                        <span className="truncate text-[11.5px] text-muted-foreground">
                          {palette.map((chip) => chip.name).filter(Boolean).join(" · ")}
                        </span>
                      ) : null}
                    </span>
                  ) : (
                    // No palette yet: same footprint, so every card lines up.
                    <span className="mt-auto flex flex-col gap-1.5 pt-1">
                      <span className="h-2 w-full rounded-full border border-dashed" aria-hidden="true" />
                      <span className="truncate text-[11.5px] text-muted-foreground">Choose your own finishes</span>
                    </span>
                  )}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
