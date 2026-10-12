"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, Info, LogIn, UserPlus } from "lucide-react";
import { cn } from "@/lib/utils";
import { BotAvatar } from "./BotHeader";
import { useBot } from "./BotProvider";
import { CapturedContextCard } from "./cards/CapturedContextCard";
import { ProviderCardCarousel } from "./cards/ProviderCardCarousel";
import { ServiceCardCarousel } from "./cards/ServiceCardCarousel";
import type { BotAuthPrompt, BotMessage } from "./types";

function timeLabel(timestamp: number) {
  return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(timestamp);
}

function TypingIndicator() {
  return (
    <div className="flex items-end gap-2" role="status" aria-label="Assistant is typing">
      <BotAvatar className="size-7" />
      <div className="flex items-center gap-1 rounded-2xl rounded-bl-md border bg-card px-3.5 py-3 shadow-sm">
        {[0, 150, 300].map((delay) => (
          <span
            key={delay}
            className="size-1.5 animate-bounce rounded-full bg-muted-foreground/70"
            style={{ animationDelay: `${delay}ms` }}
          />
        ))}
      </div>
    </div>
  );
}

function AuthPromptCard({ prompt }: { prompt: BotAuthPrompt }) {
  const { isAuthenticated, signIn } = useBot();
  const next = encodeURIComponent(prompt.nextHref);

  if (isAuthenticated) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
        <CheckCircle2 className="size-3.5 shrink-0" aria-hidden />
        Signed in. You can continue with “{prompt.serviceTitle}”.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-primary/30 bg-primary/5 p-3">
      <p className="text-xs font-semibold">
        {prompt.action === "book" ? "Sign in to book" : "Sign in to request a quote"}
      </p>
      <p className="mt-0.5 line-clamp-1 text-[11px] text-muted-foreground">{prompt.serviceTitle}</p>
      <div className="mt-2.5 grid grid-cols-2 gap-1.5">
        {/* Opens the site login modal over the chat; no navigation. */}
        <button
          type="button"
          onClick={() => signIn({ resume: true })}
          className="inline-flex h-8 items-center justify-center gap-1.5 rounded-md bg-primary text-[11px] font-semibold text-primary-foreground transition hover:bg-primary/90"
        >
          <LogIn className="size-3.5" aria-hidden />
          Sign in
        </button>
        <Link
          href={`/register?next=${next}`}
          className="inline-flex h-8 items-center justify-center gap-1.5 rounded-md border bg-background text-[11px] font-semibold transition hover:bg-muted"
        >
          <UserPlus className="size-3.5" aria-hidden />
          Create account
        </Link>
      </div>
    </div>
  );
}

function BotBubble({ message, isLatest }: { message: BotMessage; isLatest: boolean }) {
  const { send, state, requestService } = useBot();

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-end gap-2">
        <BotAvatar className="size-7" />
        <div className="flex max-w-[85%] flex-col gap-1">
          <div className="rounded-2xl rounded-bl-md border bg-card px-3.5 py-2.5 text-[13px] leading-relaxed text-card-foreground shadow-sm">
            {message.text}
          </div>
          <span className="pl-1 text-[10px] text-muted-foreground">{timeLabel(message.createdAt)}</span>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {message.note ? (
          <div
            role={message.note.tone === "warning" ? "alert" : undefined}
            className={cn(
              "ml-9 flex gap-2 rounded-xl border px-3 py-2 text-[11px] leading-relaxed",
              message.note.tone === "warning"
                ? "border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-200"
                : "border-sky-500/30 bg-sky-500/10 text-sky-800 dark:text-sky-200",
            )}
          >
            {message.note.tone === "warning" ? (
              <AlertTriangle className="mt-px size-3.5 shrink-0" aria-hidden />
            ) : (
              <Info className="mt-px size-3.5 shrink-0" aria-hidden />
            )}
            {message.note.text}
          </div>
        ) : null}

        {message.providers?.length ? (
          <ProviderCardCarousel
            providers={message.providers}
            selectedId={state.providerId}
            onSelect={(provider) => send({ type: "provider", id: provider.id }, `I'll go with ${provider.name}`)}
          />
        ) : null}

        {message.services?.length ? (
          <ServiceCardCarousel
            services={message.services}
            highlightSubServiceId={state.subServiceId}
            onBook={(service) => requestService(service, "book")}
            onQuote={(service) => requestService(service, "quote")}
          />
        ) : null}

        {message.authPrompt ? (
          <div className="pl-9">
            <AuthPromptCard prompt={message.authPrompt} />
          </div>
        ) : null}

        {/* Quick replies only on the latest bot turn so stale pills can't rewind the flow. */}
        {isLatest && message.suggestions?.length ? (
          <div className="flex flex-wrap gap-1.5 pl-9">
            {message.suggestions.map((pill) => (
              <button
                key={pill.label}
                type="button"
                onClick={() => send(pill.input, pill.label)}
                className="rounded-full border border-primary/25 bg-primary/5 px-3 py-1.5 text-[11px] font-semibold text-primary transition hover:-translate-y-px hover:border-primary/50 hover:bg-primary/10 active:translate-y-0"
              >
                {pill.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function UserBubble({ message }: { message: BotMessage }) {
  return (
    <div className="flex flex-col items-end gap-1">
      <div className="max-w-[85%] rounded-2xl rounded-br-md bg-primary px-3.5 py-2.5 text-[13px] leading-relaxed whitespace-pre-wrap text-primary-foreground shadow-sm shadow-primary/20">
        {message.text}
      </div>
      <span className="pr-1 text-[10px] text-muted-foreground">{timeLabel(message.createdAt)}</span>
    </div>
  );
}

export function BotChatWindow() {
  const { messages, typing, state, locationLabel } = useBot();
  const endRef = useRef<HTMLDivElement>(null);
  const latestBotId = [...messages].reverse().find((message) => message.role === "bot")?.id;

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, typing]);

  return (
    <div className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain">
      <div className="sticky top-0 z-10 border-b border-transparent bg-popover px-3 pt-3 pb-2 shadow-[0_8px_12px_-12px_rgb(0_0_0/0.25)]">
        <CapturedContextCard state={state} locationLabel={locationLabel} />
      </div>

      <div className="flex flex-col gap-4 px-3 pb-4" aria-live="polite" aria-relevant="additions">
        {messages.map((message) =>
          message.role === "user" ? (
            <UserBubble key={message.id} message={message} />
          ) : (
            <BotBubble key={message.id} message={message} isLatest={message.id === latestBotId && !typing} />
          ),
        )}
        {typing ? <TypingIndicator /> : null}
        <div ref={endRef} />
      </div>
    </div>
  );
}
