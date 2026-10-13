"use client";

import { PhoneForwarded, PhoneIncoming } from "lucide-react";
import { cn } from "@/lib/utils";
import { AI_VOICES } from "./constants";
import { formatPhone } from "./phone";
import type { AiVoiceId } from "./types";

function Bubble({ from, children }: { from: "ai" | "caller"; children: React.ReactNode }) {
  return (
    <div className={cn("flex", from === "caller" ? "justify-end" : "justify-start")}>
      <p
        className={cn(
          "max-w-[85%] rounded-2xl px-3 py-2 text-xs leading-5",
          from === "ai"
            ? "rounded-tl-sm bg-primary text-primary-foreground"
            : "rounded-tr-sm bg-muted text-foreground dark:bg-input/40",
        )}
      >
        {children}
      </p>
    </div>
  );
}

/** Live preview of how a call sounds with the current greeting, voice and forwarding number. */
export function AiCallPreview({
  greeting,
  voiceId,
  aiPhoneNumber,
  escalationNumber,
  enabled,
}: {
  greeting: string;
  voiceId: AiVoiceId;
  aiPhoneNumber: string | null;
  escalationNumber: string;
  enabled: boolean;
}) {
  const voice = AI_VOICES.find((item) => item.id === voiceId) ?? AI_VOICES[0];
  const forwardTo = formatPhone(escalationNumber) || "your forwarding number";

  return (
    <div className="overflow-hidden rounded-xl border border-border-soft bg-card">
      <div className="flex items-center gap-3 border-b border-border-soft bg-muted/40 px-4 py-3 dark:bg-input/20">
        <span
          className={cn(
            "flex size-8 items-center justify-center rounded-full",
            enabled ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" : "bg-muted text-muted-foreground",
          )}
        >
          <PhoneIncoming className="size-4" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-semibold text-foreground">Incoming call</p>
          <p className="truncate text-[11px] text-muted-foreground tabular-nums">
            {aiPhoneNumber ? formatPhone(aiPhoneNumber) : "Your AI number"} · {voice.label} answering
          </p>
        </div>
      </div>
      <div className="flex flex-col gap-2.5 p-4">
        <Bubble from="ai">{greeting.trim() || "…"}</Bubble>
        <Bubble from="caller">Hi, can I talk to someone on the team?</Bubble>
        <Bubble from="ai">Of course, connecting you now. One moment please.</Bubble>
        <p className="mt-1 flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
          <PhoneForwarded className="size-3" aria-hidden="true" />
          Transferred to <span className="font-medium text-foreground tabular-nums">{forwardTo}</span>
        </p>
      </div>
    </div>
  );
}
