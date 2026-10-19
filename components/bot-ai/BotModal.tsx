"use client";

import { useState } from "react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { cn } from "@/lib/utils";
import { BotChatWindow } from "./BotChatWindow";
import { BotHeader } from "./BotHeader";
import { BotHistoryDrawer } from "./BotHistoryDrawer";
import { BotInputBar } from "./BotInputBar";
import { useBot } from "./BotProvider";
import { useVisualViewportBox } from "./hooks/useVisualViewportBox";

/**
 * Assistant dialog: full-screen sheet on phones, floating panel anchored bottom-right
 * on larger screens. Esc / outside click minimise (the conversation is kept); the
 * header ✕ ends the chat and archives it to history.
 */
export function BotModal() {
  const { open, minimize, close, reset, sendText, typing, addressEditorOpen, closeAddressEditor } = useBot();
  const [historyOpen, setHistoryOpen] = useState(false);
  const viewportBox = useVisualViewportBox(open);

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
          // The header address input's suggestion menu is portaled to <body>: picking from it
          // must not count as an "outside" click and minimise the chat.
          onInteractOutside={(event) => {
            const target = event.target as Element | null;
            if (target?.closest?.("[data-google-address-menu]")) event.preventDefault();
          }}
          style={viewportBox}
          className={cn(
            "fixed z-[61] flex flex-col overflow-hidden bg-popover text-popover-foreground outline-none",
            // Phones: full screen (dvh, then the visible viewport above the keyboard via
            // viewportBox), never wider than the screen.
            "inset-0 h-dvh w-full max-w-[100vw] overscroll-none",
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
            {/* Address card open: soften the chat behind it so the input and its suggestions
                stand out (the sticky header sits above this at z-30). Click to dismiss. */}
            {addressEditorOpen ? (
              <button
                type="button"
                aria-label="Close address search"
                onClick={closeAddressEditor}
                // Frosted glass, kept light: a slight blur + faint white wash so the chat stays
                // readable but steps back behind the address card.
                className="absolute inset-0 z-20 cursor-default bg-white/25 backdrop-blur-[1.5px] animate-in fade-in duration-200 motion-reduce:animate-none dark:bg-black/20"
              />
            ) : null}
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
