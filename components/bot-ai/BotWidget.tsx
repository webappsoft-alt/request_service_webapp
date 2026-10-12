"use client";

import { useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { BotModal } from "./BotModal";
import { useBot } from "./BotProvider";

const noopSubscribe = () => () => {};

/** Floating bottom-right launcher; also mounts the assistant modal. */
export function BotWidget() {
  const { open, openBot, hasUnread, messages } = useBot();
  const resumable = messages.some((message) => message.role === "user");
  // Portal to <body>: page wrappers animate with transform, which would trap `position: fixed`.
  const mounted = useSyncExternalStore(noopSubscribe, () => true, () => false);
  if (!mounted) return null;

  return createPortal(
    <>
      <button
        type="button"
        onClick={openBot}
        aria-label={resumable ? "Resume AI Assistant chat" : "Open AI Assistant"}
        aria-haspopup="dialog"
        className={cn(
          "group fixed right-4 bottom-4 z-50 flex items-center gap-2.5 rounded-full p-1.5 pr-1.5 text-white sm:right-6 sm:bottom-6 sm:pr-4",
          "bg-linear-to-br from-sky-500 via-blue-700 to-indigo-800 shadow-xl shadow-blue-900/30 ring-1 ring-white/20",
          "transition-all duration-300 hover:-translate-y-0.5 hover:shadow-2xl hover:shadow-blue-900/40",
          "focus-visible:ring-4 focus-visible:ring-primary/40 focus-visible:outline-none print:hidden",
          open && "pointer-events-none translate-y-4 scale-90 opacity-0",
        )}
      >
        <span className="relative flex size-11 items-center justify-center rounded-full bg-white/15 backdrop-blur">
          <span aria-hidden className="absolute inset-0 animate-ping rounded-full bg-sky-300/40 [animation-duration:2.4s]" />
          <Sparkles className="relative size-5 transition-transform duration-300 group-hover:rotate-12" aria-hidden />
          {hasUnread ? (
            <span className="absolute -top-0.5 -right-0.5 size-3 rounded-full border-2 border-blue-700 bg-rose-500" aria-hidden />
          ) : (
            <span className="absolute -right-0.5 -bottom-0.5 size-3 rounded-full border-2 border-blue-700 bg-emerald-400" aria-hidden />
          )}
        </span>
        <span className="hidden flex-col items-start leading-tight sm:flex">
          <span className="text-[13px] font-semibold">{resumable ? "Resume chat" : "Ask AI Assistant"}</span>
          <span className="text-[10px] text-white/75">Find a verified pro in seconds</span>
        </span>
      </button>

      <BotModal />
    </>,
    document.body,
  );
}
