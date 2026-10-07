"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { PortalPage } from "@/components/portal/portal-page";
import { TechChatButton } from "@/components/tech-chat/tech-chat-button";
import { TechChatInbox } from "@/components/tech-chat/tech-chat-inbox";
import { rememberTechChatThread } from "@/components/tech-chat/use-tech-chat-unread";
import { Button } from "@/components/ui/button";
import { openTechChat, type TechChatContextType } from "@/lib/api/technician-chat-client";
import { technicianPaths } from "@/lib/technician-paths";

const CONTEXT_TYPES: TechChatContextType[] = ["job", "estimate", "payment", "general"];

/** "job:<id>" | "estimate:<id>" | "payment[:<jobId>]" | "general" from the Chat buttons. */
function parseOpen(value: string | null): { contextType: TechChatContextType; contextId: string | null } | null {
  if (!value) return null;
  const [type, id] = value.split(":");
  if (!CONTEXT_TYPES.includes(type as TechChatContextType)) return null;
  return { contextType: type as TechChatContextType, contextId: id || null };
}

function errorText(err: unknown) {
  const message = err && typeof err === "object" && "message" in err ? String((err as { message?: unknown }).message || "") : "";
  if (/404/.test(message)) return "Chat is not available yet — the server needs to be restarted.";
  return message || "Could not open this chat.";
}

/** Technician inbox: every conversation with the office, one per job / estimate / pay. */
export function TechnicianMessagesView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const threadId = searchParams.get("thread");
  const openParam = searchParams.get("open");
  const [error, setError] = useState<{ key: string; message: string } | null>(null);
  const started = useRef<string | null>(null);

  // A Chat button sent us here: open (or create) that record's thread, then show it.
  useEffect(() => {
    const target = parseOpen(openParam);
    if (!openParam || !target || started.current === openParam) return;
    started.current = openParam;
    openTechChat("technician", target)
      .then((thread) => {
        rememberTechChatThread("technician", thread);
        router.replace(technicianPaths.message(thread.id), { scroll: false });
      })
      .catch((err) => setError({ key: openParam, message: errorText(err) }));
  }, [openParam, router]);

  const opening = Boolean(openParam) && error?.key !== openParam;

  return (
    <PortalPage
      eyebrow="Technician / Messages"
      title="Messages"
      description="Chat with the office about the work assigned to you. Each job and estimate has its own conversation."
      actions={<TechChatButton side="technician" contextType="general" label="Message the office" />}
    >
      {opening ? (
        <div className="flex h-[calc(100svh-9rem)] min-h-[28rem] flex-col items-center justify-center gap-2 rounded-xl border border-input bg-white text-muted-foreground">
          <Loader2 className="size-6 animate-spin text-primary" />
          <p className="text-sm font-medium">Opening your conversation…</p>
        </div>
      ) : openParam && error ? (
        <div className="flex h-[calc(100svh-9rem)] min-h-[28rem] flex-col items-center justify-center gap-3 rounded-xl border border-input bg-white px-6 text-center">
          <p className="text-sm font-medium text-destructive">{error.message}</p>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                started.current = null;
                setError(null);
              }}
            >
              Try again
            </Button>
            <Button size="sm" variant="ghost" onClick={() => router.replace(technicianPaths.messages)}>
              All conversations
            </Button>
          </div>
        </div>
      ) : (
        <TechChatInbox
          side="technician"
          initialThreadId={threadId}
          onSelect={(id) =>
            router.replace(id ? technicianPaths.message(id) : technicianPaths.messages, { scroll: false })
          }
        />
      )}
    </PortalPage>
  );
}
