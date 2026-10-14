"use client";

import { Check, Loader2, Play, Square } from "lucide-react";
import { cn } from "@/lib/utils";
import { AI_VOICES } from "./constants";
import type { AiVoiceId } from "./types";

/** Radio-card grid of Cartesia Sonic voices, each with an optional "Listen" sample button. */
export function AiVoicePicker({
  value,
  onChange,
  disabled,
  labelledBy,
  onPreview,
  playingId,
  loadingId,
}: {
  value: AiVoiceId;
  onChange: (voiceId: AiVoiceId) => void;
  disabled?: boolean;
  labelledBy?: string;
  /** Play / stop a sample of this voice. Omit to hide the Listen buttons. */
  onPreview?: (voiceId: AiVoiceId) => void;
  playingId?: AiVoiceId | null;
  loadingId?: AiVoiceId | null;
}) {
  return (
    <div role="radiogroup" aria-labelledby={labelledBy} className="grid gap-2.5 sm:grid-cols-2">
      {AI_VOICES.map((voice) => {
        const selected = voice.id === value;
        const playing = playingId === voice.id;
        const loading = loadingId === voice.id;
        return (
          <div
            key={voice.id}
            className={cn(
              "group relative flex items-center gap-2 rounded-xl border p-3 transition-all",
              selected
                ? "border-primary bg-primary/[0.04] shadow-sm ring-1 ring-primary dark:bg-primary/10"
                : "border-border-soft hover:border-foreground/25 hover:bg-muted/40",
              disabled && "opacity-60",
            )}
          >
            <button
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={disabled}
              onClick={() => onChange(voice.id)}
              className="flex min-w-0 flex-1 items-center gap-3 rounded-lg text-left focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none disabled:cursor-not-allowed"
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
            {onPreview ? (
              <button
                type="button"
                onClick={() => onPreview(voice.id)}
                aria-label={playing ? `Stop ${voice.label} sample` : `Listen to ${voice.label}`}
                title={playing ? "Stop" : "Listen"}
                className={cn(
                  "flex size-8 shrink-0 items-center justify-center rounded-full border transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                  playing
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border-soft bg-background text-muted-foreground hover:border-primary/40 hover:text-primary",
                )}
              >
                {loading ? (
                  <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                ) : playing ? (
                  <Square className="size-3 fill-current" aria-hidden="true" />
                ) : (
                  <Play className="size-3.5 translate-x-px fill-current" aria-hidden="true" />
                )}
              </button>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
