"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Briefcase, Check, CheckCheck, FileText, Loader2, MessageSquare, SendHorizontal, ShieldCheck, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { emitTechChatTyping, onSocketEvent } from "@/components/socket/socket-api";
import { rememberTechChatThread } from "@/components/tech-chat/use-tech-chat-unread";
import {
  getTechChat,
  markTechChatRead,
  sendTechChatMessage,
  techChatContextHref,
  techChatContextLabel,
  type TechChatMessage,
  type TechChatSide,
  type TechChatThreadDetail,
} from "@/lib/api/technician-chat-client";
import { cn } from "@/lib/utils";

/** Quick starters by record type — tap one to drop it in the message box. */
const SUGGESTIONS: Record<TechChatSide, Record<string, string[]>> = {
  technician: {
    job: [
      "On my way to the job site.",
      "I have arrived on site.",
      "Running late — new ETA in 15 minutes.",
      "I need extra materials for this job.",
      "The customer is not available.",
      "The job is complete.",
    ],
    estimate: [
      "On my way for the site visit.",
      "Site visit done — details added.",
      "Can you confirm the scope for this estimate?",
      "The customer has questions about pricing.",
      "I need to reschedule this visit.",
    ],
    payment: [
      "Can you check my hours for this job?",
      "When will this be paid?",
      "My pay amount looks incorrect.",
    ],
    general: ["Hi, I have a quick question.", "Can you call me when you are free?", "I am available for more work today."],
  },
  provider: {
    job: ["Thanks, got it.", "What is your ETA?", "Can you send a photo?", "Please call me when you can."],
    estimate: ["Thanks, got it.", "Please add photos to the visit.", "Please call me when you can."],
    payment: ["I will check and get back to you.", "Payment is on its way."],
    general: ["Thanks, got it.", "Please call me when you can."],
  },
};

function timeLabel(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const today = new Date();
  const sameDay = date.toDateString() === today.toDateString();
  return sameDay
    ? date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
    : date.toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

/**
 * One technician ↔ provider conversation. Works from either portal: `side` is
 * who is reading. Messages arrive over the socket; opening the thread marks
 * the other side's messages read (they see the double tick).
 */
export function TechChatConversation({
  side,
  threadId,
  initial,
  className,
  showHeader = true,
}: {
  side: TechChatSide;
  threadId: string;
  /** Thread already loaded by the caller (e.g. from `openTechChat`). */
  initial?: TechChatThreadDetail | null;
  className?: string;
  showHeader?: boolean;
}) {
  const [thread, setThread] = useState<TechChatThreadDetail | null>(initial && initial.id === threadId ? initial : null);
  const [loading, setLoading] = useState(!thread);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [otherTyping, setOtherTyping] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const typingSent = useRef(0);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const otherTypingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const markRead = useCallback(() => {
    void markTechChatRead(side, threadId).catch(() => {});
  }, [side, threadId]);

  useEffect(() => {
    // Callers mount one conversation per thread (keyed), so loading starts from the initial state.
    let cancelled = false;
    getTechChat(side, threadId)
      .then((data) => {
        if (cancelled) return;
        setThread(data);
        rememberTechChatThread(side, { ...data, unreadForProvider: side === "provider" ? 0 : data.unreadForProvider, unreadForTechnician: side === "technician" ? 0 : data.unreadForTechnician });
      })
      .catch(() => {
        if (!cancelled) setError("Could not load this conversation.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    markRead();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload only when the thread changes
  }, [side, threadId]);

  useEffect(() => {
    const offMessage = onSocketEvent("techchat:message", (payload) => {
      if (payload?.threadId !== threadId || !payload.message) return;
      setThread((current) => {
        if (!current || current.messages.some((msg) => msg.id === payload.message.id)) return current;
        return { ...current, ...payload.thread, messages: [...current.messages, payload.message] };
      });
      if (payload.message.from !== side) {
        setOtherTyping(false);
        markRead();
      }
    });
    const offRead = onSocketEvent("techchat:read", (payload) => {
      if (payload?.threadId !== threadId || payload.reader === side) return;
      setThread((current) =>
        current
          ? {
              ...current,
              messages: current.messages.map((msg) =>
                msg.from === side && !msg.isRead ? { ...msg, isRead: true, readAt: payload.readAt } : msg,
              ),
            }
          : current,
      );
    });
    const offTyping = onSocketEvent("techchat:typing", (payload) => {
      if (payload?.threadId !== threadId || payload.from === side) return;
      setOtherTyping(Boolean(payload.isTyping));
      if (otherTypingTimer.current) clearTimeout(otherTypingTimer.current);
      if (payload.isTyping) otherTypingTimer.current = setTimeout(() => setOtherTyping(false), 5000);
    });
    return () => {
      offMessage();
      offRead();
      offTyping();
    };
  }, [threadId, side, markRead]);

  useEffect(
    () => () => {
      if (typingTimer.current) clearTimeout(typingTimer.current);
      if (otherTypingTimer.current) clearTimeout(otherTypingTimer.current);
    },
    [],
  );

  const messageCount = thread?.messages.length ?? 0;
  useLayoutEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messageCount, otherTyping]);

  function pulseTyping() {
    const now = Date.now();
    if (now - typingSent.current > 2500) {
      typingSent.current = now;
      emitTechChatTyping(threadId, true);
    }
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => {
      typingSent.current = 0;
      emitTechChatTyping(threadId, false);
    }, 3000);
  }

  async function send() {
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    setError("");
    try {
      const result = await sendTechChatMessage(side, threadId, text);
      setDraft("");
      if (typingTimer.current) clearTimeout(typingTimer.current);
      typingSent.current = 0;
      emitTechChatTyping(threadId, false);
      setThread((current) => {
        if (!current || current.messages.some((msg) => msg.id === result.message.id)) return current;
        return { ...current, ...result.thread, messages: [...current.messages, result.message] };
      });
    } catch {
      setError("Message not sent. Try again.");
    } finally {
      setSending(false);
    }
  }

  const otherName =
    side === "technician" ? thread?.providerName || "Office" : thread?.technicianName || "Technician";
  const contextLink = thread ? techChatContextHref(thread, side) : null;
  const ContextIcon =
    thread?.contextType === "job"
      ? Briefcase
      : thread?.contextType === "estimate"
        ? FileText
        : thread?.contextType === "payment"
          ? Wallet
          : MessageSquare;

  return (
    <div className={cn("flex min-h-0 flex-col bg-white", className)}>
      {showHeader ? (
        <div className="border-b border-input px-4 py-2.5">
          <p className="truncate text-sm font-semibold text-foreground">
            {otherName}
            {otherTyping ? <span className="ml-1.5 text-xs font-medium text-emerald-700">typing…</span> : null}
          </p>
        </div>
      ) : null}

      {thread ? (
        <div className="flex items-center gap-2 border-b border-input bg-[#f6f9fc] px-3 py-2">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-[#003F7D]/10 text-[#003F7D]">
            <ContextIcon className="size-3.5" aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
              {thread.contextType === "job"
                ? "About this job"
                : thread.contextType === "estimate"
                  ? "About this estimate"
                  : thread.contextType === "payment"
                    ? "About pay"
                    : "General"}
            </span>
            <span className="block truncate text-xs font-semibold text-foreground" title={techChatContextLabel(thread)}>
              {techChatContextLabel(thread)}
            </span>
          </span>
          {contextLink ? (
            <Link
              href={contextLink.href}
              className="inline-flex shrink-0 items-center gap-1 rounded-md border border-[#003F7D]/25 bg-white px-2 py-1 text-xs font-semibold text-[#003F7D] hover:bg-[#eef3f9]"
            >
              {contextLink.label}
              <ArrowUpRight className="size-3" aria-hidden />
            </Link>
          ) : null}
        </div>
      ) : null}

      <div ref={listRef} className="min-h-0 flex-1 space-y-2 overflow-y-auto bg-[#f6f8fb] px-3 py-3">
        {loading ? (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            <Loader2 className="size-5 animate-spin" />
          </div>
        ) : !thread?.messages.length ? (
          <div className="space-y-3">
            <p className="text-center text-[11px] font-medium text-muted-foreground">New conversation</p>
            {/* Not stored — a friendly opener so the thread never starts blank. */}
            <div className="flex justify-start">
              <div className="max-w-[85%] rounded-2xl rounded-bl-sm border border-input bg-white px-3 py-2 text-sm shadow-xs">
                <p className="mb-0.5 text-[11px] font-semibold text-[#003F7D]">{otherName}</p>
                <p>
                  {side === "technician"
                    ? `Hi! This chat is about ${thread ? techChatContextLabel(thread) : "your work"}. Send us a message and we will reply here — you will get a notification.`
                    : `Start the conversation with ${otherName} about ${thread ? techChatContextLabel(thread) : "this work"}. They see it instantly in their portal.`}
                </p>
              </div>
            </div>
          </div>
        ) : (
          thread.messages.map((msg) => <Bubble key={msg.id} msg={msg} mine={msg.from === side} />)
        )}
        {otherTyping ? (
          <div className="flex items-center gap-1 px-1 text-xs text-muted-foreground" aria-live="polite">
            <span className="flex gap-0.5">
              <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground/60 [animation-delay:-0.2s]" />
              <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground/60 [animation-delay:-0.1s]" />
              <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground/60" />
            </span>
            {otherName} is typing
          </div>
        ) : null}
      </div>

      {thread ? (
        <div className="flex gap-1.5 overflow-x-auto border-t border-input bg-white px-2.5 pt-2 pb-0.5 [scrollbar-width:none]">
          {(SUGGESTIONS[side][thread.contextType] ?? SUGGESTIONS[side].general).map((text) => (
            <button
              key={text}
              type="button"
              onClick={() => {
                setDraft(text);
                inputRef.current?.focus();
              }}
              className="shrink-0 rounded-full border border-[#003F7D]/20 bg-[#f6f9fc] px-3 py-1 text-xs font-medium text-[#003F7D] transition-colors hover:border-[#003F7D]/45 hover:bg-[#eef3f9]"
            >
              {text}
            </button>
          ))}
        </div>
      ) : null}

      <form
        className={cn("flex items-end gap-2 bg-white p-2.5", !thread && "border-t border-input")}
        onSubmit={(event) => {
          event.preventDefault();
          void send();
        }}
      >
        <div className="min-w-0 flex-1">
          <Textarea
            ref={inputRef}
            autoFocus
            value={draft}
            rows={1}
            maxLength={4000}
            placeholder={`Message ${otherName}…`}
            aria-label="Message"
            className="max-h-32 min-h-10 resize-none bg-white text-sm shadow-none"
            onChange={(event) => {
              setDraft(event.target.value);
              if (event.target.value.trim()) pulseTyping();
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void send();
              }
            }}
          />
          {error ? <p className="mt-1 text-xs text-destructive">{error}</p> : null}
        </div>
        <Button type="submit" size="icon" className="size-10 shrink-0" disabled={!draft.trim() || sending} aria-label="Send">
          {sending ? <Loader2 className="animate-spin" /> : <SendHorizontal />}
        </Button>
      </form>
    </div>
  );
}

function Bubble({ msg, mine }: { msg: TechChatMessage; mine: boolean }) {
  if (msg.from === "admin") {
    return (
      <div className="flex justify-start">
        <div className="max-w-[80%] rounded-2xl rounded-bl-sm border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950 shadow-xs">
          <p className="mb-0.5 flex items-center gap-1 text-[11px] font-semibold text-amber-800">
            <ShieldCheck className="size-3.5" aria-hidden /> {msg.senderName || "Platform Support"}
          </p>
          <p className="whitespace-pre-wrap break-words">{msg.text}</p>
          <p className="mt-1 text-right text-[10px] text-amber-800/70">{timeLabel(msg.at)}</p>
        </div>
      </div>
    );
  }
  return (
    <div className={cn("flex", mine ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[80%] rounded-2xl px-3 py-2 text-sm shadow-xs",
          mine ? "rounded-br-sm bg-[#003F7D] text-white" : "rounded-bl-sm border border-input bg-white text-foreground",
        )}
      >
        {!mine && msg.senderName ? (
          <p className="mb-0.5 text-[11px] font-semibold text-[#003F7D]">{msg.senderName}</p>
        ) : null}
        <p className="whitespace-pre-wrap break-words">{msg.text}</p>
        <p
          className={cn(
            "mt-1 flex items-center justify-end gap-1 text-[10px]",
            mine ? "text-white/70" : "text-muted-foreground",
          )}
        >
          {timeLabel(msg.at)}
          {mine ? (
            msg.isRead ? (
              <CheckCheck className="size-3.5 text-sky-300" aria-label="Read" />
            ) : (
              <Check className="size-3.5" aria-label="Sent" />
            )
          ) : null}
        </p>
      </div>
    </div>
  );
}
