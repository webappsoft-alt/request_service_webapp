"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { AI_VOICES } from "./constants";
import type { AiVoiceId } from "./types";

/** Radio-card grid of Cartesia Sonic voices. */
export function AiVoicePicker({
  value,
  onChange,
  disabled,
  labelledBy,
}: {
  value: AiVoiceId;
  onChange: (voiceId: AiVoiceId) => void;
  disabled?: boolean;
  labelledBy?: string;
}) {
  return (
    <div role="radiogroup" aria-labelledby={labelledBy} className="grid gap-2.5 sm:grid-cols-2">
      {AI_VOICES.map((voice) => {
        const selected = voice.id === value;
        return (
          <button
            key={voice.id}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={disabled}
            onClick={() => onChange(voice.id)}
            className={cn(
              "group relative flex items-center gap-3 rounded-xl border p-3 text-left transition-all",
              "focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60",
              selected
                ? "border-primary bg-primary/[0.04] shadow-sm ring-1 ring-primary dark:bg-primary/10"
                : "border-border-soft hover:border-foreground/25 hover:bg-muted/40",
            )}
          >
            <span
              aria-hidden="true"
              className={cn(
                "flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold",
                voice.accentClassName,
              )}
            >
              {voice.label.charAt(0)}
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2">
                <span className="text-sm font-semibold text-foreground">{voice.label}</span>
                <span className="rounded-full bg-muted px-1.5 py-px text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
                  {voice.gender}
                </span>
              </span>
              <span className="mt-0.5 block truncate text-xs text-muted-foreground">{voice.tone}</span>
            </span>
            <span
              aria-hidden="true"
              className={cn(
                "flex size-5 shrink-0 items-center justify-center rounded-full border transition-colors",
                selected ? "border-primary bg-primary text-primary-foreground" : "border-input bg-background",
              )}
            >
              {selected ? <Check className="size-3" strokeWidth={3} /> : null}
            </span>
          </button>
        );
      })}
    </div>
  );
}
