"use client";

import type { ReactNode } from "react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { History, Minus, RotateCcw, Sparkles, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { BOT_NAME, BOT_STATUS } from "./systemPromptGuide";

export function BotAvatar({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        // Same brand gradient as the floating launcher.
        "relative flex size-8 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-primary via-primary to-primary/80 text-primary-foreground shadow-md ring-1 shadow-primary/25 ring-white/15",
        className,
      )}
    >
      <Sparkles className="size-[45%]" />
    </span>
  );
}

function HeaderButton({
  label,
  onClick,
  active,
  children,
}: {
  label: string;
  onClick: () => void;
  active?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      aria-pressed={active}
      className={cn(
        "flex size-8 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        active && "bg-muted text-foreground",
      )}
    >
      {children}
    </button>
  );
}

export function BotHeader({
  historyOpen,
  onToggleHistory,
  onReset,
  onMinimize,
  onClose,
}: {
  historyOpen: boolean;
  onToggleHistory: () => void;
  onReset: () => void;
  onMinimize: () => void;
  onClose: () => void;
}) {
  return (
    <header className="relative flex items-center gap-2.5 border-b bg-linear-to-b from-primary/[0.07] to-transparent px-3 py-2.5">
      <div className="relative">
        <BotAvatar className="size-9" />
        <span className="absolute -right-0.5 -bottom-0.5 flex size-3">
          <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400 opacity-60" />
          <span className="relative size-3 rounded-full border-2 border-popover bg-emerald-500" />
        </span>
      </div>

      <div className="min-w-0 flex-1">
        <DialogPrimitive.Title className="truncate text-sm leading-tight font-semibold">
          {BOT_NAME}
        </DialogPrimitive.Title>
        <p className="flex items-center gap-1.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
          <span className="size-1.5 rounded-full bg-emerald-500 shadow-[0_0_6px_1px] shadow-emerald-500/70" />
          {BOT_STATUS}
        </p>
        <DialogPrimitive.Description className="sr-only">
          Describe a home issue to get matched with verified local professionals, then book or request a quote.
        </DialogPrimitive.Description>
      </div>

      <div className="flex items-center gap-0.5">
        <HeaderButton label="Reset session" onClick={onReset}>
          <RotateCcw className="size-4" />
        </HeaderButton>
        <HeaderButton label="Chat history" onClick={onToggleHistory} active={historyOpen}>
          <History className="size-4" />
        </HeaderButton>
        <HeaderButton label="Minimize" onClick={onMinimize}>
          <Minus className="size-4" />
        </HeaderButton>
        <HeaderButton label="Close and end chat" onClick={onClose}>
          <X className="size-4" />
        </HeaderButton>
      </div>
    </header>
  );
}
