"use client";

import { useState } from "react";
import { ArrowDown, ArrowRight, Bath, ChefHat } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { RedesignStyle, RoomType } from "@/lib/api/ai-redesigner-client";
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

/**
 * "A real design studio": the admin's styles (photo + finish swatches) per room. A click selects
 * that room and style in the designer above and scrolls to it.
 */
export function StyleShowcase({ styles }: { styles: RedesignStyle[] }) {
  const [room, setRoom] = useState<RoomType>("kitchen");
  const rooms = ROOMS.filter((item) => styles.some((style) => style.roomType === item.value));
  const shown = styles.filter((style) => style.roomType === room).slice(0, 8);
  if (!shown.length) return null;

  return (
    <div className="flex flex-col gap-6">
      {rooms.length > 1 ? (
        <div role="tablist" aria-label="Room" className="mx-auto inline-flex rounded-full border bg-card p-1 shadow-sm">
          {rooms.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={room === value}
              onClick={() => setRoom(value)}
              className={cn(
                "inline-flex h-9 items-center gap-2 rounded-full px-4 text-sm font-semibold transition-colors",
                room === value ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="size-4" aria-hidden="true" />
              {label}
            </button>
          ))}
        </div>
      ) : null}

      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {shown.map((style) => (
          <li key={style.id}>
            <button
              type="button"
              onClick={() => tryStyleInDesigner({ roomType: style.roomType, styleId: style.id })}
              className="group relative block aspect-4/3 w-full overflow-hidden rounded-2xl border bg-muted text-left shadow-sm transition-shadow hover:shadow-lg focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              aria-label={`Try the ${style.name} ${style.roomType} style in the designer`}
            >
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
                  style={{ background: `linear-gradient(135deg, ${(style.swatches.length ? style.swatches : ["#e2e8f0", "#94a3b8"]).join(", ")})` }}
                />
              )}
              <span className="absolute top-2.5 right-2.5 inline-flex items-center gap-1 rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-semibold text-foreground opacity-0 shadow-sm transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                Try this style
                <ArrowRight className="size-3" aria-hidden="true" />
              </span>
              <span className="absolute inset-x-2.5 bottom-2.5 flex items-center justify-between gap-2 rounded-xl bg-black/55 px-3 py-2 text-white backdrop-blur-sm">
                <span className="min-w-0 truncate text-sm font-semibold">{style.name}</span>
                {style.swatches.length ? (
                  <span className="flex shrink-0 -space-x-1.5" aria-hidden="true">
                    {style.swatches.slice(0, 4).map((color, index) => (
                      <span
                        key={`${color}-${index}`}
                        className="size-5 rounded-full border-2 border-white/90"
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </span>
                ) : null}
              </span>
            </button>
            {style.description ? (
              <p className="mt-2 line-clamp-2 px-0.5 text-[13px] leading-5 text-muted-foreground">{style.description}</p>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
