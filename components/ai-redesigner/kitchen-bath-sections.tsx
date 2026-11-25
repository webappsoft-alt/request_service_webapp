"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowRight, Bath, ChefHat } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FINISH_CATEGORIES } from "@/lib/api/ai-redesigner-client";
import type {
  FinishCategory,
  RedesignCatalog,
  RedesignFinish,
  RedesignStyle,
  RoomType,
} from "@/lib/api/ai-redesigner-client";
import { cn } from "@/lib/utils";
import { DESIGNER_ANCHOR, scrollToDesigner, tryStyleInDesigner } from "./designer-events";
import { swatchStyle } from "./finish-swatch";

/** Hero CTA: smooth-scrolls to the designer (#demo); a real link without JavaScript. */
export function TryItNowButton({ className, label = "Try It Now" }: { className?: string; label?: string }) {
  return (
    <Button size="lg" className={cn("h-12 rounded-full px-6 text-[15px]", className)} asChild>
      <a
        href={`#${DESIGNER_ANCHOR}`}
        onClick={(event) => {
          event.preventDefault();
          scrollToDesigner();
        }}
        data-keep-white
      >
        {label}
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

/** Pill room toggle shared by the lookbook and the customize showcase. */
function RoomTabs({
  tabs,
  room,
  onRoom,
  className,
}: {
  tabs: typeof ROOMS;
  room: RoomType;
  onRoom: (room: RoomType) => void;
  className?: string;
}) {
  if (tabs.length < 2) return null;
  return (
    <div
      role="tablist"
      aria-label="Room"
      className={cn("grid w-full max-w-xs grid-cols-2 gap-1 rounded-full border bg-card p-1 shadow-sm", className)}
    >
      {tabs.map(({ value, label, icon: Icon }) => (
        <button
          key={value}
          type="button"
          role="tab"
          aria-selected={room === value}
          onClick={() => onRoom(value)}
          className={cn(
            "inline-flex h-9 items-center justify-center gap-2 rounded-full text-sm font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
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
  );
}

const CATEGORY_FALLBACK: Record<FinishCategory, string> = {
  cabinets: "Cabinetry",
  countertops: "Countertops",
  backsplash: "Backsplash tile",
  hardware: "Hardware & lighting",
};

/**
 * "What you can customize" (Kitchen & Bath Design, 2026-11-25): the admin's real finishes per room
 * and category (cabinetry, countertops, backsplash, hardware) as material tiles. Read-only preview;
 * "Load in Studio" scrolls to the designer.
 */
export function CustomizeShowcase({
  finishes = [],
  rooms = [],
}: {
  finishes?: RedesignFinish[];
  rooms?: RoomInfo[];
}) {
  const [room, setRoom] = useState<RoomType>("kitchen");
  const [category, setCategory] = useState<FinishCategory>("cabinets");
  const tabs = ROOMS.filter((item) => finishes.some((finish) => finish.roomType === item.value));
  const labels = rooms.find((item) => item.roomType === room)?.categories || [];
  const labelFor = (key: FinishCategory) => labels.find((item) => item.key === key)?.label || CATEGORY_FALLBACK[key];
  const inRoom = finishes.filter((finish) => finish.roomType === room && finish.category === category);
  const colors = inRoom.filter((finish) => finish.kind === "color").slice(0, 12);
  const shapes = inRoom.filter((finish) => finish.kind === "style").slice(0, 6);

  return (
    <div className="flex flex-col overflow-hidden rounded-3xl border bg-card shadow-xl shadow-slate-900/[0.08] dark:shadow-black/40">
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[linear-gradient(135deg,#082447_0%,#0f3868_100%)] px-5 py-4 text-white md:px-6">
        <div>
          <p className="text-[15px] font-semibold">What you can customize</p>
          <p className="text-[13px] text-white/65">Real finishes from our designer library</p>
        </div>
        {tabs.length > 1 ? (
          <div role="tablist" aria-label="Room" className="flex gap-1 rounded-full bg-white/10 p-1">
            {tabs.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={room === value}
                onClick={() => {
                  setRoom(value);
                  setCategory("cabinets");
                }}
                className={cn(
                  "inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[13px] font-semibold transition-colors",
                  room === value ? "bg-white text-[#082447]" : "text-white/75 hover:text-white",
                )}
                data-keep-white
              >
                <Icon className="size-3.5" aria-hidden="true" />
                {label}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div className="flex gap-2 overflow-x-auto border-b px-5 py-3 [scrollbar-width:none] md:px-6" role="tablist" aria-label="Finish category">
        {FINISH_CATEGORIES.map((key) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={category === key}
            onClick={() => setCategory(key)}
            className={cn(
              "shrink-0 rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition-colors",
              category === key ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {labelFor(key)}
          </button>
        ))}
      </div>

      <div key={`${room}-${category}`} className="animate-in fade-in flex flex-1 flex-col gap-5 p-5 duration-300 md:p-6">
        {shapes.length ? (
          <div className="flex flex-wrap gap-2">
            {shapes.map((finish) => (
              <span key={finish.id} className="inline-flex items-center rounded-full border bg-background px-3 py-1 text-[13px] font-medium">
                {finish.name}
              </span>
            ))}
          </div>
        ) : null}
        {colors.length ? (
          <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4">
            {colors.map((finish) => (
              <li key={finish.id} className="flex flex-col gap-1.5">
                <span
                  className="h-16 w-full rounded-xl border border-black/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_4px_10px_-6px_rgba(15,41,74,0.45)] dark:border-white/10"
                  style={swatchStyle(finish)}
                  aria-hidden="true"
                />
                <span className="truncate text-xs font-medium text-muted-foreground">{finish.name}</span>
              </li>
            ))}
          </ul>
        ) : !shapes.length ? (
          <p className="rounded-2xl bg-muted/50 px-4 py-8 text-center text-sm text-muted-foreground">
            Finishes for this category are coming soon.
          </p>
        ) : null}
        <div className="mt-auto flex items-center justify-between gap-3 border-t pt-4">
          <span className="text-[13px] text-muted-foreground">
            {colors.length + shapes.length} {labelFor(category).toLowerCase()} options
          </span>
          <button
            type="button"
            onClick={() => scrollToDesigner()}
            className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
          >
            Load in Studio
            <ArrowRight className="size-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Style library: the admin's styles per room as clean rounded cards (16:10 photo with hover zoom,
 * name, summary, finish tags, "Load in Studio"). A click selects that room and style in the
 * designer above and scrolls to it.
 * Previous designs: an editorial lookbook with square sample chips (2026-11-25, rejected); compact
 * cards with a palette bar; a dark name pill over each photo; tall cards with a finish table.
 */
export function StyleShowcase({
  styles,
  finishes = [],
}: {
  styles: RedesignStyle[];
  finishes?: RedesignFinish[];
  /** Kept for callers; room labels are not shown on the cards. */
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
      <RoomTabs tabs={tabs} room={room} onRoom={setRoom} className="mx-auto" />

      <ul className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {shown.map((style) => {
          const { materials, palette } = describeStyle(style, byId);
          const summary =
            style.description ||
            (materials.length ? materials.join(", ") : `The ${style.name} ${roomLabel.toLowerCase()} look, ready to customize.`);
          const tags = palette.filter((chip) => chip.name).slice(0, 3);
          return (
            <li key={style.id} className="flex">
              <button
                type="button"
                onClick={() => tryStyleInDesigner({ roomType: style.roomType, styleId: style.id })}
                className="group flex w-full flex-col overflow-hidden rounded-2xl border bg-card text-left shadow-lg shadow-slate-900/5 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-slate-900/10 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none dark:shadow-black/30"
                aria-label={`Load the ${style.name} ${style.roomType} style in the studio`}
              >
                <span className="relative block aspect-[16/10] w-full overflow-hidden bg-muted">
                  {style.image ? (
                    // eslint-disable-next-line @next/next/no-img-element -- admin-uploaded style photo (our storage)
                    <img
                      src={style.image}
                      alt=""
                      loading="lazy"
                      className="absolute inset-0 size-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.05]"
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
                </span>

                <span className="flex flex-1 flex-col gap-3 p-4">
                  <span className="flex flex-col gap-1">
                    <span className="truncate text-base font-semibold text-foreground">{style.name}</span>
                    <span className="line-clamp-2 min-h-10 text-[13px] leading-5 text-muted-foreground">{summary}</span>
                  </span>

                  <span className="mt-auto flex min-h-7 flex-wrap gap-1.5">
                    {tags.length ? (
                      tags.map((chip) => (
                        <span
                          key={chip.name}
                          className="inline-flex max-w-full items-center gap-1.5 rounded-full border bg-background py-0.5 pr-2.5 pl-1 text-[11.5px] font-medium text-muted-foreground"
                        >
                          <span
                            className="size-4 shrink-0 rounded-full ring-1 ring-black/10 dark:ring-white/15"
                            style={{ backgroundColor: chip.color }}
                            aria-hidden="true"
                          />
                          <span className="truncate">{chip.name}</span>
                        </span>
                      ))
                    ) : (
                      <span className="inline-flex items-center rounded-full border border-dashed px-2.5 py-0.5 text-[11.5px] text-muted-foreground">
                        Choose your own finishes
                      </span>
                    )}
                  </span>

                  <span className="flex items-center justify-between border-t pt-3 text-sm font-semibold text-primary">
                    Load in Studio
                    <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-1" aria-hidden="true" />
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
