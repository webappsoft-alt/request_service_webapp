"use client";

import { useState } from "react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { cn } from "@/lib/utils";
import { BotChatWindow } from "./BotChatWindow";
import { BotHeader } from "./BotHeader";
import { BotHistoryDrawer } from "./BotHistoryDrawer";
import { BotInputBar } from "./BotInputBar";
import { useBot } from "./BotProvider";

/**
 * Assistant dialog: full-screen sheet on phones, floating panel anchored bottom-right
 * on larger screens. Esc / outside click minimise (the conversation is kept); the
 * header ✕ ends the chat and archives it to history.
 */
export function BotModal() {
  const { open, minimize, close, reset, sendText, typing } = useBot();
  const [historyOpen, setHistoryOpen] = useState(false);

  return (
    <DialogPrimitive.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setHistoryOpen(false);
          minimize();
        }
      }}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className="fixed inset-0 z-[60] bg-black/30 duration-300 supports-backdrop-filter:backdrop-blur-[2px] data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0 sm:bg-black/15 sm:supports-backdrop-filter:backdrop-blur-none"
        />
        <DialogPrimitive.Content
          onOpenAutoFocus={(event) => event.preventDefault()}
          className={cn(
            "fixed z-[61] flex flex-col overflow-hidden bg-popover text-popover-foreground outline-none",
            "inset-0 h-dvh w-full",
            "sm:inset-auto sm:right-5 sm:bottom-5 sm:h-[min(44rem,calc(100dvh-2.5rem))] sm:w-[26.5rem] sm:rounded-2xl sm:border sm:shadow-2xl sm:shadow-black/25",
            "duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] data-open:animate-in data-open:fade-in-0 data-open:slide-in-from-bottom-6 sm:data-open:zoom-in-95",
            "data-closed:animate-out data-closed:fade-out-0 data-closed:slide-out-to-bottom-4",
            "sm:origin-bottom-right",
          )}
        >
          <BotHeader
            historyOpen={historyOpen}
            onToggleHistory={() => setHistoryOpen((value) => !value)}
            onReset={() => {
              setHistoryOpen(false);
              reset();
            }}
            onMinimize={() => {
              setHistoryOpen(false);
              minimize();
            }}
            onClose={() => {
              setHistoryOpen(false);
              close();
            }}
          />

          <div className="relative flex min-h-0 flex-1 flex-col">
            <BotChatWindow />
            <BotInputBar
              onSend={sendText}
              disabled={typing}
              autoFocus={open}
            />
            <BotHistoryDrawer open={historyOpen} onClose={() => setHistoryOpen(false)} />
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
