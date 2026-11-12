"use client";

import type { ReactNode } from "react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { History, Maximize2, Minimize2, Minus, RotateCcw, Sparkles, X } from "lucide-react";
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
  className,
  children,
}: {
  label: string;
  onClick: () => void;
  active?: boolean;
  className?: string;
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
        className,
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
  expanded = false,
  onToggleExpanded,
}: {
  historyOpen: boolean;
  onToggleHistory: () => void;
  onReset: () => void;
  onMinimize: () => void;
  onClose: () => void;
  /** Large centred view (desktop / tablet). */
  expanded?: boolean;
  onToggleExpanded?: () => void;
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
        {onToggleExpanded ? (
          // Phones are already full screen, so the button is shown from 640px up.
          <HeaderButton
            label={expanded ? "Restore to small window" : "Expand chat"}
            onClick={onToggleExpanded}
            active={expanded}
            className="hidden sm:flex"
          >
            {expanded ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
          </HeaderButton>
        ) : null}
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
