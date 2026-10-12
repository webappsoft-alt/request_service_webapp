"use client";

import Link from "next/link";
import { History, LogIn, MessageSquarePlus, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useBot } from "./BotProvider";

function relativeTime(timestamp: number) {
  const minutes = Math.round((Date.now() - timestamp) / 60_000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(timestamp);
}

/** Slide-over inside the assistant panel listing the signed-in user's past sessions. */
export function BotHistoryDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { isAuthenticated, sessions, activeSessionId, restoreSession, deleteSession, reset, signIn } = useBot();

  return (
    <>
      <div
        aria-hidden
        onClick={onClose}
        className={cn(
          "absolute inset-0 z-30 bg-black/25 transition-opacity duration-300",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      />
      <aside
        aria-label="Chat history"
        aria-hidden={!open}
        inert={!open}
        className={cn(
          "absolute inset-y-0 left-0 z-40 flex w-[82%] max-w-80 flex-col border-r bg-popover shadow-2xl transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex items-center justify-between border-b px-3 py-3">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <History className="size-4 text-primary" aria-hidden />
            Chat history
          </p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close history"
            className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>

        {!isAuthenticated ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
            <span className="flex size-11 items-center justify-center rounded-full bg-primary/10 text-primary">
              <History className="size-5" aria-hidden />
            </span>
            <p className="text-sm font-semibold">Save your conversations</p>
            <p className="text-xs text-muted-foreground">
              Sign in to keep your assistant history and pick up where you left off.
            </p>
            {/* Login modal opens over the chat; the drawer stays open and swaps to the
                account's history as soon as Redux auth updates. */}
            <button
              type="button"
              onClick={() => signIn()}
              className="inline-flex h-8 items-center gap-1.5 rounded-md bg-primary px-3 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
            >
              <LogIn className="size-3.5" aria-hidden />
              Sign in
            </button>
            <Link href="/register" className="text-xs font-medium text-primary hover:underline">
              Create an account
            </Link>
          </div>
        ) : (
          <>
            <div className="p-3">
              <button
                type="button"
                onClick={() => {
                  reset();
                  onClose();
                }}
                className="flex h-9 w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-primary/40 text-xs font-semibold text-primary transition hover:bg-primary/5"
              >
                <MessageSquarePlus className="size-4" aria-hidden />
                New conversation
              </button>
            </div>
            {sessions.length ? (
              <ul className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-2 pb-3">
                {sessions.map((session) => (
                  <li key={session.id} className="group/item relative">
                    <button
                      type="button"
                      onClick={() => {
                        restoreSession(session.id);
                        onClose();
                      }}
                      className={cn(
                        "flex w-full flex-col gap-0.5 rounded-lg px-2.5 py-2 pr-9 text-left transition hover:bg-muted",
                        session.id === activeSessionId && "bg-muted",
                      )}
                    >
                      <span className="truncate text-[13px] font-medium">{session.title}</span>
                      <span className="text-[10px] text-muted-foreground">
                        {relativeTime(session.updatedAt)} · {session.messages.length} messages
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteSession(session.id)}
                      aria-label={`Delete ${session.title}`}
                      className="absolute top-1/2 right-1.5 flex size-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground opacity-0 transition group-hover/item:opacity-100 hover:bg-destructive/10 hover:text-destructive focus-visible:opacity-100"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-6 py-8 text-center text-xs text-muted-foreground">
                No past conversations yet. They&apos;ll appear here after you reset or close a chat.
              </p>
            )}
          </>
        )}
      </aside>
    </>
  );
}
