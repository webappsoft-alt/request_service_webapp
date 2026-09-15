"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { MessageCircle, Search } from "lucide-react";
import { toast } from "sonner";
import { Container, Section } from "@/components/layout/container";
import { ChatPanel } from "@/components/shared/chat-panel";
import { NoData } from "@/components/shared/no-data";
import { useRealtime } from "@/components/realtime/realtime-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MessageThreadSkeleton } from "@/components/shared/loading-skeletons";
import { CenteredSpinner } from "@/components/ui/spinner";
import { StatusPill } from "@/components/portal/status-pill";
import {
  listPublicChatThreads,
  markPublicChatRead,
  sendPublicChatMessage,
} from "@/lib/api/chat-client";
import {
  readChatGuest,
  type ChatAttachment,
  type ChatThread,
} from "@/lib/booking/chat-store";
import { onRealtime } from "@/lib/realtime/socket";
import { useAppSelector } from "@/store/hooks";
import {
  selectAuth,
  selectAuthUser,
  selectIsAuthenticated,
} from "@/store/authSlice";
import { cn } from "@/lib/utils";

const THREAD_TITLE = "Professional";

function lastPreview(thread: ChatThread) {
  const last = thread.messages.at(-1);
  if (!last) return "No messages yet";
  if (last.text?.trim()) return last.text;
  if (last.attachments.length) return last.attachments[0]?.name || "Attachment";
  return "No messages yet";
}

function upsertThread(threads: ChatThread[], updated: ChatThread) {
  return [...threads.filter((item) => item.id !== updated.id), updated].sort(
    (a, b) => b.updatedAt.localeCompare(a.updatedAt),
  );
}

function resolveListingEmail(
  authEmail: string | undefined,
  guestEmail: string | undefined,
) {
  const fromAuth = String(authEmail || "").trim();
  if (fromAuth) return fromAuth;
  return String(guestEmail || "").trim();
}

export function CustomerMessagesView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedId = searchParams.get("thread") ?? "";
  const auth = useAppSelector(selectAuth);
  const user = useAppSelector(selectAuthUser);
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  const { joinThread, leaveThread, setTyping, connected } = useRealtime();

  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [guestEmail, setGuestEmail] = useState("");

  const listingEmail = useMemo(
    () => resolveListingEmail(user?.email, guestEmail),
    [guestEmail, user?.email],
  );

  useEffect(() => {
    setGuestEmail(readChatGuest()?.email ?? "");
  }, []);

  useEffect(() => {
    if (!auth.hydrated) return;
    if (!isAuthenticated) {
      router.replace(
        `/login?next=${encodeURIComponent("/account/messages")}`,
      );
    }
  }, [auth.hydrated, isAuthenticated, router]);

  const loadThreads = useCallback(
    async (options?: { silent?: boolean }) => {
      if (!listingEmail) {
        setThreads([]);
        setLoading(false);
        setError(null);
        return;
      }
      if (!options?.silent) setLoading(true);
      try {
        const next = await listPublicChatThreads(listingEmail, {
          silent: options?.silent ?? true,
        });
        setThreads(next);
        setError(null);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Could not load messages.";
        setError(message);
        if (!options?.silent) {
          toast.error(message);
        }
      } finally {
        setLoading(false);
      }
    },
    [listingEmail],
  );

  useEffect(() => {
    if (!auth.hydrated || !isAuthenticated) return;
    void loadThreads();
  }, [auth.hydrated, isAuthenticated, loadThreads]);

  useEffect(() => {
    if (!listingEmail) return;
    return onRealtime("CHAT_THREAD_UPDATED", (payload) => {
      const updated = payload as ChatThread;
      if (!updated?.id) return;
      if (
        String(updated.customerEmail || "").toLowerCase() !==
        listingEmail.toLowerCase()
      ) {
        return;
      }
      setThreads((current) => upsertThread(current, updated));
    });
  }, [listingEmail]);

  const filteredThreads = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return threads;
    return threads.filter((thread) => {
      const haystack = [
        THREAD_TITLE,
        thread.providerId,
        thread.customerName,
        thread.customerEmail,
        lastPreview(thread),
        ...thread.messages.map((message) => message.text),
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(needle);
    });
  }, [query, threads]);

  const selected =
    filteredThreads.find((item) => item.id === selectedId) ??
    threads.find((item) => item.id === selectedId) ??
    filteredThreads[0] ??
    threads[0];

  useEffect(() => {
    if (!selected?.id || !listingEmail || !selected.unreadForCustomer) return;
    let cancelled = false;
    void (async () => {
      try {
        const updated = await markPublicChatRead(selected.id, listingEmail);
        if (cancelled || !updated) return;
        setThreads((current) => upsertThread(current, updated));
      } catch {
        // Silent — unread badge will refresh on next load.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [listingEmail, selected?.id, selected?.unreadForCustomer]);

  useEffect(() => {
    if (!selected?.id) return;
    joinThread(selected.id);
    return () => leaveThread(selected.id);
  }, [joinThread, leaveThread, selected?.id]);

  async function handleSend(text: string, attachments: ChatAttachment[]) {
    if (!selected?.id || !listingEmail) {
      toast.error("Unable to send the message.");
      return;
    }
    try {
      const updated = await sendPublicChatMessage(
        selected.id,
        listingEmail,
        text,
        attachments,
      );
      if (!updated) throw new Error("Unable to send the message.");
      const readThread =
        (await markPublicChatRead(updated.id, listingEmail)) ?? updated;
      setThreads((current) => upsertThread(current, readThread));
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Unable to send the message.",
      );
    }
  }

  if (!auth.hydrated || !isAuthenticated) {
    return (
      <Section tone="muted">
        <Container>
          <CenteredSpinner label="Loading messages" className="min-h-64" />
        </Container>
      </Section>
    );
  }

  const showInitialLoading = loading && !threads.length && !error;

  return (
    <Section tone="muted">
      <Container className="max-w-6xl space-y-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            Messages
          </h1>
          <p className="text-sm text-muted-foreground">
            Conversations with professionals you contacted from their profiles.
          </p>
        </div>

        {showInitialLoading ? (
          <div className="flex flex-col gap-3" aria-busy="true" aria-label="Loading messages">
            {Array.from({ length: 6 }, (_, i) => (
              <MessageThreadSkeleton key={`msg-sk-${i}`} />
            ))}
          </div>
        ) : error && !threads.length ? (
          <div className="space-y-4 rounded-xl border border-border bg-card px-5 py-12 text-center">
            <p className="text-base font-medium text-foreground">
              Couldn’t load your messages
            </p>
            <p className="mx-auto max-w-md text-sm text-muted-foreground">
              {error}
            </p>
            <Button type="button" onClick={() => void loadThreads()}>
              Try again
            </Button>
          </div>
        ) : !threads.length ? (
          <NoData
            icon={<MessageCircle className="size-4" />}
            title="No messages yet"
            description="When you chat with a professional from their profile, conversations will show up here."
            action={
              <Button asChild>
                <Link href="/find-a-professional">Find a professional</Link>
              </Button>
            }
          />
        ) : (
          <div className="space-y-4">
            {error ? (
              <div className="rounded-xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
                {error}{" "}
                <button
                  type="button"
                  className="font-medium text-primary underline-offset-2 hover:underline"
                  onClick={() => void loadThreads()}
                >
                  Retry
                </button>
              </div>
            ) : null}

            <div className="relative max-w-sm">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search conversations…"
                className="pl-9"
                aria-label="Search conversations"
              />
            </div>

            {filteredThreads.length ? (
              <div className="grid min-h-[32rem] overflow-hidden rounded-xl border border-input bg-card lg:grid-cols-[18rem_minmax(0,1fr)]">
                <ul className="divide-y divide-black/8 border-b border-black/8 lg:border-r lg:border-b-0">
                  {filteredThreads.map((thread) => {
                    const active = selected?.id === thread.id;
                    return (
                      <li key={thread.id}>
                        <Link
                          href={`/account/messages?thread=${thread.id}`}
                          className={cn(
                            "flex flex-col gap-1 px-4 py-3 text-sm",
                            active
                              ? "bg-[#003F7D]/8"
                              : "hover:bg-[#eef1f5]",
                          )}
                        >
                          <span className="flex items-center justify-between gap-2">
                            <span className="font-medium">{THREAD_TITLE}</span>
                            {thread.unreadForCustomer ? (
                              <StatusPill
                                label={`${thread.unreadForCustomer} new`}
                                tone="warning"
                              />
                            ) : null}
                          </span>
                          <span className="line-clamp-2 text-xs text-muted-foreground">
                            {lastPreview(thread)}
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
                        <p className="font-semibold">{THREAD_TITLE}</p>
                        <p className="text-xs text-muted-foreground">
                          Your conversation
                          {connected ? " · live" : ""}
                        </p>
                      </div>
                    </div>
                    <ChatPanel
                      messages={selected.messages}
                      self="customer"
                      onSend={handleSend}
                      onTypingChange={(isTyping) =>
                        setTyping(selected.id, isTyping)
                      }
                      footer="Your message notifies the professional in their portal."
                    />
                  </div>
                ) : null}
              </div>
            ) : (
              <NoData
                icon={<Search className="size-4" />}
                title="No matching conversations"
                description="Try a different search term, or clear the filter to see all messages."
                action={
                  <Button type="button" variant="outline" onClick={() => setQuery("")}>
                    Clear search
                  </Button>
                }
              />
            )}
          </div>
        )}
      </Container>
    </Section>
  );
}
