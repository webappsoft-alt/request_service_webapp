"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { CheckCircle2, FileText, LayoutDashboard, LogIn, RotateCcw, TriangleAlert, UserPlus } from "lucide-react";
import { customerPaths } from "@/lib/customer-paths";
import { cn } from "@/lib/utils";
import { BotAvatar } from "./BotHeader";
import { isChangeAddressLabel, pathForLabel, useBot } from "./BotProvider";
import { AddressEditor } from "./cards/AddressEditor";
import { CapturedContextCard } from "./cards/CapturedContextCard";
import { PathChoiceCard } from "./cards/PathChoiceCard";
import { ProviderCardCarousel } from "./cards/ProviderCardCarousel";
import { ServiceCardCarousel } from "./cards/ServiceCardCarousel";
import { useSmoothText } from "./hooks/useSmoothText";
import { QuoteBriefCard } from "./quote/QuoteBriefCard";
import type { BotAuthPrompt, BotHandoff, BotMessage, BotQuoteSuccess } from "./types";

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

  if (isAuthenticated) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
        <CheckCircle2 className="size-3.5 shrink-0" aria-hidden />
        Signed in. You can continue with “{prompt.title}”.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-primary/30 bg-primary/5 p-3">
      <p className="text-xs font-semibold">
        {prompt.action === "book" ? "Sign in to book" : "Sign in to request a quote"}
      </p>
      <p className="mt-0.5 line-clamp-1 text-[11px] text-muted-foreground">{prompt.title}</p>
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
          href="/register"
          className="inline-flex h-8 items-center justify-center gap-1.5 rounded-md border bg-background text-[11px] font-semibold transition hover:bg-muted"
        >
          <UserPlus className="size-3.5" aria-hidden />
          Create account
        </Link>
      </div>
    </div>
  );
}

function QuoteHandoffCard({ handoff }: { handoff: BotHandoff }) {
  const { requestQuote } = useBot();
  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-primary/30 bg-primary/5 p-2.5">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <FileText className="size-4" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-semibold">
          {handoff.providerName ? `Quote from ${handoff.providerName}` : "Request quotes from nearby pros"}
        </p>
        <p className="text-[10px] text-muted-foreground">Free · itemized estimates · no obligation</p>
      </div>
      <button
        type="button"
        onClick={() => requestQuote(handoff)}
        className="inline-flex h-8 shrink-0 items-center rounded-md bg-primary px-3 text-[11px] font-semibold text-primary-foreground transition hover:bg-primary/90"
      >
        Send request
      </button>
    </div>
  );
}

function QuoteSuccessCard({ success }: { success: BotQuoteSuccess }) {
  const href = success.quoteBatchId ? customerPaths.quoteRequest(success.quoteBatchId) : customerPaths.requests;
  return (
    <div className="rounded-xl border border-emerald-500/35 bg-emerald-500/10 p-3">
      <div className="flex items-start gap-2.5">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white">
          <CheckCircle2 className="size-4" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold text-emerald-800 dark:text-emerald-200">
            Quote request {success.requestNumber ? `#${success.requestNumber} ` : ""}submitted
          </p>
          <p className="mt-0.5 text-[11px] text-emerald-900/80 dark:text-emerald-100/80">
            {success.providerName
              ? `Sent to ${success.providerName}.`
              : `Sent to ${success.count} matching ${success.count === 1 ? "pro" : "pros"}.`}{" "}
            You&apos;ll be notified when an estimate arrives.
          </p>
        </div>
      </div>
      <Link
        href={href}
        className="mt-2.5 flex h-8 items-center justify-center gap-1.5 rounded-md bg-primary text-[12px] font-semibold text-primary-foreground transition hover:bg-primary/90"
      >
        <LayoutDashboard className="size-3.5" aria-hidden />
        View in Dashboard
      </Link>
    </div>
  );
}

function BotBubble({ message, isLatest, isNewest }: { message: BotMessage; isLatest: boolean; isNewest: boolean }) {
  const { sendText, choosePath, context, selectProvider, requestService, retryLast, openAddressEditor } = useBot();
  // Only the newest reply that arrived live is revealed at a reading pace (cards and
  // buttons follow once it's done); history and older replies render instantly.
  const reveal = useSmoothText(message.id, message.text, Boolean(message.live) && isNewest, !message.streaming);
  const settled = reveal.done && !message.streaming;

  return (
    <div className="flex scroll-mt-28 flex-col gap-2" data-bot-message={message.id}>
      {/* Emergency guidance always comes first, before the reply and any services. */}
      {message.safety?.length ? (
        <div className="flex flex-col gap-1.5">
          {message.safety.map((alert) => (
            <div
              key={alert.kind}
              role="alert"
              className="flex gap-2.5 rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2.5 text-red-900 dark:border-red-400/40 dark:bg-red-500/15 dark:text-red-100"
            >
              <TriangleAlert className="mt-0.5 size-4 shrink-0 text-red-600 dark:text-red-300" aria-hidden />
              <div className="min-w-0">
                <p className="text-xs font-bold tracking-wide uppercase">{alert.title} — act now</p>
                <p className="mt-0.5 text-[12px] leading-snug">{alert.text}</p>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      <div className="flex items-end gap-2">
        <BotAvatar className="size-7" />
        <div className="flex max-w-[85%] flex-col gap-1">
          <div
            className={cn(
              "rounded-2xl rounded-bl-md border bg-card px-3.5 py-2.5 text-[13px] leading-relaxed whitespace-pre-wrap text-card-foreground shadow-sm",
              message.error && "border-destructive/30 bg-destructive/5",
            )}
          >
            {reveal.text}
            {!settled ? (
              <span className="ml-0.5 inline-block h-3.5 w-1.5 animate-pulse rounded-sm bg-primary/60 align-middle" aria-hidden />
            ) : null}
          </div>
          {settled ? (
            <span className="pl-1 text-[10px] text-muted-foreground">{timeLabel(message.createdAt)}</span>
          ) : null}
        </div>
      </div>

      {settled ? (
      <div className="flex animate-in flex-col gap-2 duration-300 fade-in slide-in-from-bottom-1">
        {message.choices ? <PathChoiceCard choices={message.choices} active={isLatest} /> : null}

        {message.providers?.length ? (
          <ProviderCardCarousel
            providers={message.providers}
            selectedId={context.providerId}
            onSelect={selectProvider}
          />
        ) : null}

        {message.services?.length ? (
          <ServiceCardCarousel
            services={message.services}
            onBook={(service) => requestService(service, "book")}
            onQuote={(service) => requestService(service, "quote")}
          />
        ) : null}

        {message.handoff ? <QuoteHandoffCard handoff={message.handoff} /> : null}

        {message.quoteBrief ? <QuoteBriefCard message={message} brief={message.quoteBrief} /> : null}

        {message.quoteSuccess ? <QuoteSuccessCard success={message.quoteSuccess} /> : null}

        {message.authPrompt ? <AuthPromptCard prompt={message.authPrompt} /> : null}

        {isLatest && message.error ? (
          <div className="pl-9">
            <button
              type="button"
              onClick={retryLast}
              className="inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/5 px-3 py-1.5 text-[11px] font-semibold text-primary transition hover:bg-primary/10"
            >
              <RotateCcw className="size-3" aria-hidden />
              Try again
            </button>
          </div>
        ) : null}

        {/* Quick replies only on the latest bot turn so stale pills can't rewind the flow. */}
        {isLatest && !message.error && message.suggestions?.length ? (
          <div className="flex flex-wrap gap-1.5 pl-9">
            {message.suggestions.map((pill) => (
              <button
                key={pill}
                type="button"
                onClick={() => {
                  // "Change Address" opens the in-chat address picker.
                  if (isChangeAddressLabel(pill)) {
                    openAddressEditor();
                    return;
                  }
                  // Path pills ("Request Custom Quotation"…) act like the choice card.
                  const path = pathForLabel(pill);
                  if (path) choosePath(path);
                  else sendText(pill);
                }}
                className="rounded-full border border-primary/25 bg-primary/5 px-3 py-1.5 text-[11px] font-semibold text-primary transition hover:-translate-y-px hover:border-primary/50 hover:bg-primary/10 active:translate-y-0"
              >
                {pill}
              </button>
            ))}
          </div>
        ) : null}
      </div>
      ) : null}
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
  const { messages, typing, context, locationLabel, connected, addressEditorOpen, openAddressEditor } = useBot();
  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const latestBotId = [...messages].reverse().find((message) => message.role === "bot")?.id;
  const lastText = messages[messages.length - 1]?.text.length ?? 0;

  const lastMessage = messages[messages.length - 1];
  const safetyTarget = lastMessage?.role === "bot" && lastMessage.safety?.length ? lastMessage.id : null;

  useEffect(() => {
    // Emergency replies: keep the safety alert in view instead of jumping past it to the cards.
    if (safetyTarget) {
      document
        .querySelector(`[data-bot-message="${CSS.escape(safetyTarget)}"]`)
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, typing, lastText, safetyTarget]);

  // Follow the text as it's revealed (and cards as they appear) while the reader is at the bottom.
  useEffect(() => {
    const scroller = scrollRef.current;
    const content = contentRef.current;
    if (!scroller || !content || safetyTarget) return;
    let bottom = scroller.scrollHeight;
    const observer = new ResizeObserver(() => {
      const nearBottom = bottom - scroller.scrollTop - scroller.clientHeight < 140;
      bottom = scroller.scrollHeight;
      if (nearBottom) scroller.scrollTop = scroller.scrollHeight;
    });
    observer.observe(content);
    return () => observer.disconnect();
  }, [safetyTarget]);

  return (
    <div ref={scrollRef} className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain">
      <div className="sticky top-0 z-10 bg-popover px-3 pt-3 pb-2 shadow-[0_8px_12px_-12px_rgb(0_0_0/0.25)]">
        <CapturedContextCard
          context={context}
          locationLabel={locationLabel}
          connected={connected}
          onChangeAddress={openAddressEditor}
        />
        {addressEditorOpen ? <AddressEditor /> : null}
      </div>

      <div ref={contentRef} className="flex flex-col gap-4 px-3 pb-4" aria-live="polite" aria-relevant="additions">
        {messages.map((message) =>
          message.role === "user" ? (
            <UserBubble key={message.id} message={message} />
          ) : (
            <BotBubble
              key={message.id}
              message={message}
              isLatest={message.id === latestBotId && !typing && !message.streaming}
              isNewest={message.id === latestBotId}
            />
          ),
        )}
        {typing ? <TypingIndicator /> : null}
        <div ref={endRef} />
      </div>
    </div>
  );
}
