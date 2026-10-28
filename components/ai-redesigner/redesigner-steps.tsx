"use client";

import { Bath, Camera, Check, CookingPot, Lock, Pencil, ScanLine, Shuffle, Sun } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { siteConfig } from "@/lib/site";
import type {
  FinishCategory,
  FinishPattern,
  FinishPicks,
  RedesignContact,
  RedesignFinish,
  RedesignStyle,
  RoomType,
} from "@/lib/api/ai-redesigner-client";
import { cn } from "@/lib/utils";
import { StyleChip, SwatchDot, SwatchTile } from "./finish-swatch";

export function StepHeading({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <h2 className="text-[1.45rem] leading-tight font-semibold tracking-tight">{title}</h2>
      <p className="text-sm leading-6 text-muted-foreground">{description}</p>
    </div>
  );
}

const ROOMS: Array<{ value: RoomType; label: string; icon: typeof Bath }> = [
  { value: "kitchen", label: "Kitchen", icon: CookingPot },
  { value: "bathroom", label: "Bathroom", icon: Bath },
];

/* ----------------------------------------------------------------- 1. Photo */

export function PhotoStep({
  roomType,
  onRoomType,
  photo,
  uploading,
  error,
  onPick,
}: {
  roomType: RoomType;
  onRoomType: (room: RoomType) => void;
  photo: string | null;
  uploading: boolean;
  error: string | null;
  onPick: () => void;
}) {
  const tips = [
    { icon: Sun, text: "Turn the lights on and open the blinds" },
    { icon: ScanLine, text: "Shoot wide, from about chest height" },
    { icon: Lock, text: `Your photo stays private with ${siteConfig.name}` },
  ];
  return (
    <div className="flex flex-col gap-6">
      <StepHeading title="Start with your room" description="Stand in a corner and fit as much of the room as you can." />

      <div className="flex flex-col gap-2.5">
        <p className="text-sm font-semibold">Which room?</p>
        <div className="grid grid-cols-2 gap-1 rounded-2xl border border-input bg-muted/60 p-1" role="radiogroup" aria-label="Room type">
          {ROOMS.map((room) => {
            const Icon = room.icon;
            const active = roomType === room.value;
            return (
              <button
                key={room.value}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => onRoomType(room.value)}
                className={cn(
                  "flex h-12 items-center justify-center gap-2 rounded-xl text-[15px] font-semibold transition-all",
                  active ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="size-4" aria-hidden="true" />
                {room.label}
              </button>
            );
          })}
        </div>
      </div>

      {photo ? (
        <div className="flex items-center gap-3.5 rounded-2xl bg-primary/[0.07] p-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- the customer's own photo */}
          <img src={photo} alt="" className="size-16 shrink-0 rounded-xl object-cover" />
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-semibold">{uploading ? "Uploading your photo…" : "Photo added"}</p>
            <p className="text-sm text-muted-foreground">
              {uploading ? "This takes a moment." : "Looks good. You can change it any time."}
            </p>
          </div>
          <button type="button" onClick={onPick} disabled={uploading} className="shrink-0 text-sm font-semibold text-primary hover:underline disabled:opacity-50">
            Change
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={onPick}
          className="flex items-center gap-4 rounded-2xl border border-dashed border-input bg-muted/30 p-4 text-left transition-colors hover:border-primary/50 hover:bg-primary/[0.04]"
        >
          <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Camera className="size-5" aria-hidden="true" />
          </span>
          <span className="min-w-0">
            <span className="block text-[15px] font-semibold">Take or upload a photo</span>
            <span className="block text-sm text-muted-foreground">JPG, PNG or WebP · from your phone or computer</span>
          </span>
        </button>
      )}

      {error ? <p className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p> : null}

      <ul className="flex flex-col gap-2.5">
        {tips.map(({ icon: Icon, text }) => (
          <li key={text} className="flex items-center gap-3 text-sm text-muted-foreground">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted">
              <Icon className="size-4 text-foreground/70" aria-hidden="true" />
            </span>
            {text}
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ----------------------------------------------------------------- 2. Style */

export function StyleStep({
  roomType,
  styles,
  styleId,
  onStyle,
}: {
  roomType: RoomType;
  styles: RedesignStyle[];
  styleId: string;
  onStyle: (style: RedesignStyle) => void;
}) {
  return (
    <div className="flex flex-col gap-5">
      <StepHeading title="Choose a style" description="Each style starts with its own finishes. You can change them next." />
      {styles.length ? (
        <div className="grid grid-cols-2 gap-3">
          {styles.map((style) => {
            const selected = style.id === styleId;
            return (
              <button
                key={style.id}
                type="button"
                onClick={() => onStyle(style)}
                aria-pressed={selected}
                className={cn(
                  "group flex flex-col overflow-hidden rounded-2xl border bg-card p-1.5 text-left transition-all duration-200",
                  selected
                    ? "border-primary ring-2 ring-primary/80"
                    : "border-input hover:-translate-y-0.5 hover:shadow-[0_14px_30px_-20px_rgba(0,0,0,0.45)]",
                )}
              >
                <span className="relative block aspect-[4/3] overflow-hidden rounded-xl bg-muted">
                  {style.image ? (
                    // eslint-disable-next-line @next/next/no-img-element -- admin-uploaded style preview
                    <img
                      src={style.image}
                      alt=""
                      className="size-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                      loading="lazy"
                    />
                  ) : (
                    <span
                      className="block size-full"
                      style={{
                        background:
                          style.swatches.length > 1
                            ? `linear-gradient(135deg, ${style.swatches.join(", ")})`
                            : style.swatches[0] || undefined,
                      }}
                    />
                  )}
                  {style.swatches.length ? (
                    <span className="absolute bottom-2 left-2 inline-flex -space-x-1.5 rounded-full bg-white/90 p-1 shadow-sm">
                      {style.swatches.map((color, index) => (
                        <span key={`${color}-${index}`} className="size-4 rounded-full border-2 border-white" style={{ background: color }} />
                      ))}
                    </span>
                  ) : null}
                  {selected ? (
                    <span className="absolute top-2 right-2 flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground shadow">
                      <Check className="size-3.5" aria-hidden="true" />
                    </span>
                  ) : null}
                </span>
                <span className="block px-2 pt-2.5 pb-2">
                  <span className="block text-[15px] font-semibold">{style.name}</span>
                  {style.description ? (
                    <span className="mt-0.5 line-clamp-2 block text-[13px] leading-5 text-muted-foreground">{style.description}</span>
                  ) : null}
                </span>
              </button>
            );
          })}
        </div>
      ) : (
        <p className="rounded-2xl border border-dashed border-input px-4 py-10 text-center text-sm text-muted-foreground">
          No {roomType} styles are available yet.
        </p>
      )}
    </div>
  );
}

/* -------------------------------------------------------------- 3. Finishes */

export type FinishPreset = { id: string; name: string; picks: FinishPicks; dots: RedesignFinish[] };

export function FinishesStep({
  styleName,
  categories,
  finishes,
  picks,
  presets,
  onPick,
  onPreset,
  onSurprise,
  notes,
  onNotes,
}: {
  styleName: string;
  categories: Array<{ key: FinishCategory; label: string }>;
  finishes: RedesignFinish[];
  picks: FinishPicks;
  presets: FinishPreset[];
  onPick: (category: FinishCategory, kind: "style" | "color", id: string | null) => void;
  onPreset: (preset: FinishPreset) => void;
  onSurprise: () => void;
  notes: string;
  onNotes: (value: string) => void;
}) {
  return (
    <div className="flex flex-col gap-6">
      <StepHeading
        title="Pick your finishes"
        description={`Start from a ${styleName.toLowerCase()} look, or choose each finish yourself.`}
      />

      <div className="flex flex-wrap gap-2">
        {presets.map((preset) => (
          <button
            key={preset.id}
            type="button"
            onClick={() => onPreset(preset)}
            className="inline-flex items-center gap-2 rounded-full border border-input bg-card py-1.5 pr-3.5 pl-2 text-[13px] font-medium transition-colors hover:border-primary/40"
          >
            <span className="inline-flex -space-x-1.5">
              {preset.dots.map((dot) => (
                <SwatchDot key={dot.id} finish={dot} className="size-[18px] border-2 border-card" />
              ))}
            </span>
            {preset.name}
          </button>
        ))}
        <button
          type="button"
          onClick={onSurprise}
          className="inline-flex items-center gap-2 rounded-full bg-foreground px-4 py-1.5 text-[13px] font-semibold text-background transition-opacity hover:opacity-90"
        >
          <Shuffle className="size-3.5" aria-hidden="true" />
          Surprise me
        </button>
      </div>

      {categories.map(({ key, label }) => {
        const styleOptions = finishes.filter((item) => item.category === key && item.kind === "style");
        const colorOptions = finishes.filter((item) => item.category === key && item.kind === "color");
        if (!styleOptions.length && !colorOptions.length) return null;
        const pickedStyle = styleOptions.find((item) => item.id === picks[key]?.style);
        const pickedColor = colorOptions.find((item) => item.id === picks[key]?.color);
        const fallbackPattern: FinishPattern | undefined = pickedStyle?.pattern;
        return (
          <section key={key} className="flex flex-col gap-3">
            <div className="flex items-baseline justify-between gap-3">
              <h3 className="text-sm font-semibold">{label}</h3>
              <span className="truncate text-[13px] text-muted-foreground">
                {[pickedStyle?.name, pickedColor?.name].filter(Boolean).join(" · ") || "Keep existing"}
              </span>
            </div>
            {styleOptions.length ? (
              <div className="flex flex-wrap gap-2" role="group" aria-label={`${label} style`}>
                {styleOptions.map((finish) => (
                  <StyleChip
                    key={finish.id}
                    finish={finish}
                    selected={picks[key]?.style === finish.id}
                    onSelect={() => onPick(key, "style", picks[key]?.style === finish.id ? null : finish.id)}
                  />
                ))}
              </div>
            ) : null}
            {colorOptions.length ? (
              <div className="grid grid-cols-6 gap-2.5 sm:grid-cols-8" role="group" aria-label={`${label} colour`}>
                {colorOptions.map((finish) => (
                  <SwatchTile
                    key={finish.id}
                    finish={finish}
                    round={key === "hardware"}
                    fallbackPattern={fallbackPattern}
                    selected={picks[key]?.color === finish.id}
                    onSelect={() => onPick(key, "color", picks[key]?.color === finish.id ? null : finish.id)}
                  />
                ))}
              </div>
            ) : null}
          </section>
        );
      })}

      <div className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between">
          <label htmlFor="redesign-notes" className="text-sm font-semibold">
            Anything else?
          </label>
          <span className="text-[13px] text-muted-foreground">Optional</span>
        </div>
        <Textarea
          id="redesign-notes"
          value={notes}
          maxLength={400}
          rows={2}
          onChange={(event) => onNotes(event.target.value)}
          placeholder="e.g. gold pendant lights, a warmer wood floor"
          className="rounded-xl"
        />
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- 4. Details */

export type SummaryRow = { label: string; value: string; swatch?: RedesignFinish | null; image?: string };

export function DetailsStep({
  roomType,
  summary,
  onEdit,
  contact,
  onContact,
  consent,
  onConsent,
  errors,
}: {
  roomType: RoomType;
  summary: SummaryRow[];
  onEdit: () => void;
  contact: RedesignContact;
  onContact: (patch: Partial<RedesignContact>) => void;
  consent: boolean;
  onConsent: (value: boolean) => void;
  errors: Partial<Record<keyof RedesignContact | "consent", string>>;
}) {
  const field = (key: keyof RedesignContact, label: string, props: React.ComponentProps<typeof Input>) => (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={`redesign-${key}`} className="text-sm font-medium">
        {label}
      </label>
      <Input
        id={`redesign-${key}`}
        value={contact[key]}
        onChange={(event) => onContact({ [key]: event.target.value })}
        aria-invalid={Boolean(errors[key]) || undefined}
        className="h-11 rounded-xl"
        {...props}
      />
      {errors[key] ? <span className="text-xs text-destructive">{errors[key]}</span> : null}
    </div>
  );

  return (
    <div className="flex flex-col gap-6">
      <StepHeading
        title="Where should we send it?"
        description={`Your design appears here in about a minute, and ${siteConfig.name} gets a copy to help with your ${roomType} project.`}
      />

      <div className="rounded-2xl border border-input">
        <dl className="divide-y">
          {summary.map((row) => (
            <div key={row.label} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
              <dt className="text-muted-foreground">{row.label}</dt>
              <dd className="flex min-w-0 items-center gap-2 font-semibold">
                {row.image ? (
                  // eslint-disable-next-line @next/next/no-img-element -- style preview thumbnail
                  <img src={row.image} alt="" className="size-5 rounded-full object-cover" />
                ) : row.swatch ? (
                  <SwatchDot finish={row.swatch} />
                ) : null}
                <span className="truncate">{row.value}</span>
              </dd>
            </div>
          ))}
        </dl>
        <button type="button" onClick={onEdit} className="inline-flex items-center gap-1.5 px-4 pt-1 pb-3 text-sm font-semibold text-primary hover:underline">
          <Pencil className="size-3.5" aria-hidden="true" />
          Edit choices
        </button>
      </div>

      <div className="grid gap-3.5 sm:grid-cols-2">
        {field("name", "Name", { autoComplete: "name", maxLength: 80 })}
        {field("zip", "ZIP code", { autoComplete: "postal-code", inputMode: "numeric", maxLength: 10 })}
        {field("email", "Email", { type: "email", autoComplete: "email", maxLength: 160 })}
        {field("phone", "Phone (optional)", { type: "tel", autoComplete: "tel", maxLength: 20 })}
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="flex items-start gap-3 text-[13px] leading-5 text-muted-foreground">
          <Checkbox
            checked={consent}
            onCheckedChange={(value) => onConsent(value === true)}
            className="mt-0.5"
            aria-invalid={Boolean(errors.consent) || undefined}
          />
          <span>
            By creating a design, you agree that {siteConfig.name} and its pros may contact you by phone, email or
            text about your project. Message and data rates may apply.
          </span>
        </label>
        {errors.consent ? <span className="text-xs text-destructive">{errors.consent}</span> : null}
      </div>
    </div>
  );
}
