"use client";

import type { CSSProperties } from "react";
import { Check } from "lucide-react";
import type { FinishPattern, RedesignFinish } from "@/lib/api/ai-redesigner-client";
import { cn } from "@/lib/utils";

/** CSS layers drawn over the swatch colour so finishes read as materials, not flat paint. */
const PATTERN_LAYERS: Record<Exclude<FinishPattern, "none">, string> = {
  marble:
    "linear-gradient(118deg, transparent 38%, rgba(70,70,70,.24) 39%, transparent 40.5%), linear-gradient(32deg, transparent 57%, rgba(70,70,70,.18) 58%, transparent 59.5%), linear-gradient(160deg, transparent 70%, rgba(70,70,70,.12) 71%, transparent 72%)",
  speckle:
    "radial-gradient(circle, rgba(255,255,255,.55) 0 1px, transparent 1.6px) 0 0 / 7px 7px, radial-gradient(circle, rgba(0,0,0,.35) 0 1px, transparent 1.6px) 3px 4px / 9px 9px",
  wood: "repeating-linear-gradient(100deg, rgba(0,0,0,.08) 0 1.5px, transparent 1.5px 5px), linear-gradient(90deg, rgba(255,255,255,.1), rgba(0,0,0,.1))",
  subway:
    "linear-gradient(rgba(0,0,0,.2) 1px, transparent 1px) 0 0 / 100% 9px, linear-gradient(90deg, rgba(0,0,0,.2) 1px, transparent 1px) 0 0 / 18px 18px, linear-gradient(90deg, rgba(0,0,0,.2) 1px, transparent 1px) 9px 9px / 18px 18px",
  square:
    "linear-gradient(rgba(0,0,0,.18) 1px, transparent 1px) 0 0 / 11px 11px, linear-gradient(90deg, rgba(0,0,0,.18) 1px, transparent 1px) 0 0 / 11px 11px",
  herringbone:
    "repeating-linear-gradient(45deg, rgba(0,0,0,.16) 0 1px, transparent 1px 7px), repeating-linear-gradient(-45deg, rgba(0,0,0,.16) 0 1px, transparent 1px 7px)",
  checker: "repeating-conic-gradient(rgba(25,25,25,.88) 0 25%, transparent 0 50%) 0 0 / 14px 14px",
  metal: "linear-gradient(135deg, rgba(255,255,255,.7) 0%, rgba(255,255,255,0) 45%, rgba(0,0,0,.28) 100%)",
};

type SwatchSource = Pick<RedesignFinish, "color" | "color2" | "image"> & { pattern?: FinishPattern };

/**
 * Background for a finish swatch: its texture image, or its colour (two-tone split) with the
 * pattern on top. `fallbackPattern` lets a plain colour borrow the chosen style's pattern
 * (e.g. backsplash colours shown as subway tile once "Subway" is picked).
 */
export function swatchStyle(finish: SwatchSource, fallbackPattern?: FinishPattern): CSSProperties {
  if (finish.image) {
    return { backgroundImage: `url(${finish.image})`, backgroundSize: "cover", backgroundPosition: "center" };
  }
  const base =
    finish.color && finish.color2
      ? `linear-gradient(90deg, ${finish.color} 50%, ${finish.color2} 50%)`
      : finish.color || "#ece8e1";
  const pattern = finish.pattern && finish.pattern !== "none" ? finish.pattern : fallbackPattern;
  const layer = pattern && pattern !== "none" ? PATTERN_LAYERS[pattern] : "";
  return { background: layer ? `${layer}, ${base}` : base };
}

/** True when a colour is light enough that a dark check mark reads better. */
function isLight(hex: string) {
  const value = hex.replace("#", "");
  const full = value.length === 3 ? value.split("").map((c) => c + c).join("") : value;
  const n = Number.parseInt(full, 16);
  if (!Number.isFinite(n)) return true;
  return ((n >> 16) & 255) * 0.299 + ((n >> 8) & 255) * 0.587 + (n & 255) * 0.114 > 160;
}

/** Small round swatch for chips and summary rows. */
export function SwatchDot({
  finish,
  fallbackPattern,
  className,
}: {
  finish: SwatchSource;
  fallbackPattern?: FinishPattern;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn("inline-block size-5 shrink-0 rounded-full border border-black/10", className)}
      style={swatchStyle(finish, fallbackPattern)}
    />
  );
}

/** A selectable swatch tile (colours, textures). `round` for metals (hardware). */
export function SwatchTile({
  finish,
  selected,
  onSelect,
  round,
  fallbackPattern,
}: {
  finish: RedesignFinish;
  selected: boolean;
  onSelect: () => void;
  round?: boolean;
  fallbackPattern?: FinishPattern;
}) {
  const darkCheck = !finish.image && isLight(finish.color || "#ffffff");
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      aria-label={finish.name}
      title={finish.name}
      className={cn(
        "relative flex aspect-square w-full items-center justify-center border border-black/10 transition-[box-shadow,transform] duration-150 hover:-translate-y-px",
        round ? "rounded-full" : "rounded-xl",
        selected
          ? "ring-2 ring-primary ring-offset-2 ring-offset-card"
          : "hover:shadow-[0_6px_14px_-8px_rgba(0,0,0,0.45)]",
      )}
      style={swatchStyle(finish, fallbackPattern)}
    >
      {selected ? (
        <span
          className={cn(
            "flex size-5 items-center justify-center rounded-full",
            darkCheck ? "bg-white/80 text-foreground" : "bg-black/35 text-white",
          )}
        >
          <Check className="size-3.5" aria-hidden="true" />
        </span>
      ) : null}
    </button>
  );
}

/** Text chip for shape/style options without an image (e.g. "Shaker", "Bar pulls"). */
export function StyleChip({
  finish,
  selected,
  onSelect,
}: {
  finish: RedesignFinish;
  selected: boolean;
  onSelect: () => void;
}) {
  const showSwatch = Boolean(finish.image) || (finish.pattern && finish.pattern !== "none");
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        "inline-flex items-center gap-2 rounded-full border py-1.5 pr-3.5 text-[13px] font-medium transition-colors",
        showSwatch ? "pl-1.5" : "pl-3.5",
        selected
          ? "border-primary bg-primary/10 text-primary ring-1 ring-primary"
          : "border-input bg-card hover:border-primary/40",
      )}
    >
      {showSwatch ? <SwatchDot finish={finish} className="size-6" /> : null}
      {finish.name}
      {selected ? <Check className="size-3.5" aria-hidden="true" /> : null}
    </button>
  );
}
