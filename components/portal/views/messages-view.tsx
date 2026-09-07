"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ChatPanel } from "@/components/shared/chat-panel";
import { PortalPage } from "@/components/portal/portal-page";
import { useChatThreads } from "@/components/portal/use-chat-threads";
import { StatusPill } from "@/components/portal/status-pill";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function MessagesView() {
  const searchParams = useSearchParams();
  const selectedId = searchParams.get("thread") ?? "";
  const { threads, send, markRead } = useChatThreads();
  const selected = threads.find((item) => item.id === selectedId) ?? threads[0];

  useEffect(() => {
    if (selected?.unreadForProvider) markRead(selected.id);
  }, [markRead, selected]);

  return (
    <PortalPage
      eyebrow="Work"
      title="Messages"
      description="Website chats and quote requests land here. Reply and then write an estimate if the work is not a priced fixed service."
    >
      {threads.length ? (
        <div className="grid min-h-[32rem] overflow-hidden rounded-xl border border-input bg-card lg:grid-cols-[18rem_minmax(0,1fr)]">
          <ul className="divide-y divide-black/8 border-b border-black/8 lg:border-r lg:border-b-0">
            {threads.map((thread) => {
              const active = selected?.id === thread.id;
              const last = thread.messages.at(-1);
              return (
                <li key={thread.id}>
                  <Link
                    href={`/pro/dashboard/messages?thread=${thread.id}`}
                    className={cn(
                      "flex flex-col gap-1 px-4 py-3 text-sm",
                      active ? "bg-[#003F7D]/8" : "hover:bg-[#eef1f5]",
                    )}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="font-medium">{thread.customerName}</span>
                      {thread.unreadForProvider ? (
                        <StatusPill label={`${thread.unreadForProvider} new`} tone="warning" />
                      ) : null}
                    </span>
                    <span className="line-clamp-2 text-xs text-muted-foreground">
                      {last?.text || (last?.attachments.length ? last.attachments[0]?.name : "No messages yet")}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
          {selected ? (
            <div className="flex min-h-0 flex-col">
              <div className="flex items-center justify-between gap-3 border-b border-black/10 px-4 py-3">
                <div>
                  <p className="font-semibold">{selected.customerName}</p>
                  <p className="text-xs text-muted-foreground">{selected.customerEmail}</p>
                </div>
                {selected.requestId ? (
                  <Button size="sm" variant="outline" asChild>
                    <Link href={`/pro/dashboard/requests/${selected.requestId}?tab=messages`}>
                      Open lead
                    </Link>
                  </Button>
                ) : null}
              </div>
              <ChatPanel
                messages={selected.messages}
                self="provider"
                onSend={(text, attachments) => {
                  send(selected.id, "provider", text, attachments);
                }}
                footer="The customer sees this on the public profile chat."
              />
            </div>
          ) : null}
        </div>
      ) : (
        <div className="rounded-xl border border-input bg-card p-6 text-sm text-muted-foreground">
          No website chats yet. When a customer requests a quote or messages your profile, the thread
          appears here.
        </div>
      )}
    </PortalPage>
  );
}
