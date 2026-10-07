"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { TechChatConversation } from "@/components/tech-chat/tech-chat-conversation";
import { contextKey, rememberTechChatThread, useTechChatUnread } from "@/components/tech-chat/use-tech-chat-unread";
import {
  openTechChat,
  type TechChatContextType,
  type TechChatSide,
  type TechChatThreadDetail,
} from "@/lib/api/technician-chat-client";
import { cn } from "@/lib/utils";

/**
 * "Chat" action on a job / estimate / payment. Opens (or starts) the thread
 * about that record in a side sheet. Technicians always talk to the provider
 * that assigned the work; providers pick the technician with `employeeId`.
 */
export function TechChatButton({
  side,
  contextType,
  contextId,
  employeeId,
  label = "Chat",
  variant = "outline",
  size = "sm",
  className,
  iconOnly = false,
}: {
  side: TechChatSide;
  contextType: TechChatContextType;
  contextId?: string | null;
  /** Provider side only: the technician to chat with. */
  employeeId?: string;
  label?: string;
  variant?: "outline" | "default" | "ghost" | "secondary";
  size?: "sm" | "default" | "icon";
  className?: string;
  iconOnly?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [thread, setThread] = useState<TechChatThreadDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  // Provider threads are per technician; the badge only tracks the technician's own context map.
  const unread = useTechChatUnread(side, thread?.id ?? null, side === "technician" ? contextKey(contextType, contextId) : null);

  async function start() {
    // Technicians chat on the Messages page; it opens (or creates) this record's thread.
    if (side === "technician") {
      const target = contextType === "general" || (contextType === "payment" && !contextId)
        ? contextType
        : `${contextType}:${contextId}`;
      router.push(`/technical/messages?open=${encodeURIComponent(target)}`);
      return;
    }
    setOpen(true);
    if (thread) return;
    setLoading(true);
    setError("");
    try {
      const data = await openTechChat(side, { contextType, contextId: contextId ?? null, employeeId });
      setThread(data);
      rememberTechChatThread(side, data);
    } catch (err) {
      const message =
        err && typeof err === "object" && "message" in err ? String((err as { message?: unknown }).message || "") : "";
      setError(message || "Could not open the chat.");
    } finally {
      setLoading(false);
    }
  }

  const otherName = side === "technician" ? thread?.providerName || "the office" : thread?.technicianName || "technician";

  return (
    <span className="contents" data-row-nav-ignore onClick={(event) => event.stopPropagation()}>
      <Button
        type="button"
        variant={variant}
        size={iconOnly ? "icon" : size}
        className={cn("relative", className)}
        onClick={() => void start()}
        aria-label={iconOnly ? label : undefined}
        title={label}
      >
        <MessageSquare />
        {iconOnly ? null : label}
        {unread > 0 ? (
          <span className="absolute -top-1.5 -right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#c2410c] px-1 text-[10px] font-semibold leading-none text-white ring-2 ring-white">
            {unread > 99 ? "99+" : unread}
          </span>
        ) : null}
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
          <SheetHeader className="border-b border-input px-4 py-3 pr-12">
            <SheetTitle className="text-base">Chat with {otherName}</SheetTitle>
            <SheetDescription className="text-xs">
              Messages are delivered instantly and kept on record.
            </SheetDescription>
          </SheetHeader>
          {loading ? (
            <div className="flex flex-1 items-center justify-center text-muted-foreground">
              <Loader2 className="size-5 animate-spin" />
            </div>
          ) : error ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
              <p className="text-sm text-destructive">{error}</p>
              <Button size="sm" variant="outline" onClick={() => void start()}>
                Try again
              </Button>
            </div>
          ) : thread ? (
            <TechChatConversation
              side={side}
              threadId={thread.id}
              initial={thread}
              showHeader={false}
              className="min-h-0 flex-1"
            />
          ) : null}
        </SheetContent>
      </Sheet>
    </span>
  );
}
