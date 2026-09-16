"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ChatPanel } from "@/components/shared/chat-panel";
import { NoData } from "@/components/shared/no-data";
import { PortalPage } from "@/components/portal/portal-page";
import { useChatThreads } from "@/components/portal/use-chat-threads";
import { useRealtime } from "@/components/realtime/realtime-provider";
import { StatusPill } from "@/components/portal/status-pill";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export function MessagesView() {
  const searchParams = useSearchParams();
  const selectedId = searchParams.get("thread") ?? "";
  const [query, setQuery] = useState("");
  const { threads, send, markRead } = useChatThreads();
  const { joinThread, leaveThread, setTyping, connected } = useRealtime();
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return threads;
    return threads.filter((thread) => {
      const haystack = [
        thread.customerName,
        thread.customerEmail,
        thread.messages.at(-1)?.text,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(needle);
    });
  }, [query, threads]);
  const selected =
    filtered.find((item) => item.id === selectedId) ??
    threads.find((item) => item.id === selectedId) ??
    filtered[0];

  useEffect(() => {
    if (selected?.unreadForProvider) markRead(selected.id);
  }, [markRead, selected]);

  useEffect(() => {
    if (!selected?.id) return;
    joinThread(selected.id);
    return () => leaveThread(selected.id);
  }, [joinThread, leaveThread, selected?.id]);

  return (
    <PortalPage
      eyebrow="Work"
      title="Messages"
      description="Website chats and quote requests land here. Reply and then write an estimate if the work is not a priced fixed service."
    >
      {threads.length ? (
        <div className="grid min-h-[32rem] overflow-hidden rounded-xl border border-input bg-card lg:grid-cols-[18rem_minmax(0,1fr)]">
          <div className="flex min-h-0 flex-col border-b border-black/8 lg:border-r lg:border-b-0">
            <div className="border-b border-black/8 p-3">
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search chats…"
                aria-label="Search chats"
                className="h-8"
              />
            </div>
            <ul className="divide-y divide-black/8 overflow-y-auto">
              {filtered.length ? (
                filtered.map((thread) => {
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
                          {last?.text ||
                            (last?.attachments.length
                              ? last.attachments[0]?.name
                              : "No messages yet")}
                        </span>
                      </Link>
                    </li>
                  );
                })
              ) : (
                <li className="px-4 py-6 text-sm text-muted-foreground">
                  No chats match that search.
                </li>
              )}
            </ul>
          </div>
          {selected ? (
            <div className="flex min-h-0 flex-col">
              <div className="flex items-center justify-between gap-3 border-b border-black/10 px-4 py-3">
                <div>
                  <p className="font-semibold">{selected.customerName}</p>
                  <p className="text-xs text-muted-foreground">
                    {selected.customerEmail}
                    {connected ? " · live" : ""}
                  </p>
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
                onSend={async (text, attachments) => {
                  await send(selected.id, "provider", text, attachments);
                }}
                onTypingChange={(isTyping) => setTyping(selected.id, isTyping)}
                footer="The customer sees this on the public profile chat."
              />
            </div>
          ) : (
            <div className="flex items-center justify-center p-8 text-sm text-muted-foreground">
              Select a conversation
            </div>
          )}
        </div>
      ) : (
        <NoData
          title="No messages yet"
          description="When a customer chats from your public profile or quote request, threads appear here."
        />
      )}
    </PortalPage>
  );
}
