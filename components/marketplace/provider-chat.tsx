"use client";

import { useEffect, useMemo, useState } from "react";
import { MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { ChatPanel } from "@/components/shared/chat-panel";
import { ProviderLogo } from "@/components/shared/provider-logo";
import { useRealtime } from "@/components/realtime/realtime-provider";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  readChatGuest,
  writeChatGuest,
  type ChatGuest,
  type ChatThread,
} from "@/lib/booking/chat-store";
import {
  listPublicChatThreads,
  markPublicChatRead,
  openPublicChatThread,
  sendPublicChatMessage,
} from "@/lib/api/chat-client";
import { connectSocket, onSocketEvent } from "@/components/socket";
import type { Provider } from "@/lib/types";
import { useAppSelector } from "@/store/hooks";
import {
  selectAuthUser,
  selectIsAuthenticated,
} from "@/store/authSlice";

const OBJECT_ID_REGEX = /^[a-f\d]{24}$/i;

function currentThread(threads: ChatThread[], providerId: string, customerEmail?: string) {
  if (!customerEmail) return undefined;
  const normalizedEmail = customerEmail.toLowerCase();
  return threads.find(
    (item) =>
      item.providerId === providerId &&
      item.customerEmail.toLowerCase() === normalizedEmail,
  );
}

function requireThread(thread: ChatThread | null | undefined, action: string): ChatThread {
  if (!thread) {
    throw new Error(`Unable to ${action}.`);
  }
  return thread;
}

function guestFromAuth(user: {
  firstName?: string;
  lastName?: string;
  email?: string;
} | null): ChatGuest | null {
  const email = String(user?.email || "").trim();
  if (!email) return null;
  const name =
    [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim() ||
    email.split("@")[0] ||
    "Customer";
  return { name, email };
}

export function ProviderChat({ provider }: { provider: Provider }) {
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  const authUser = useAppSelector(selectAuthUser);
  const authGuest = useMemo(
    () => (isAuthenticated ? guestFromAuth(authUser) : null),
    [authUser, isAuthenticated],
  );

  const [open, setOpen] = useState(false);
  const [guest, setGuest] = useState<ChatGuest | null>(() => authGuest ?? readChatGuest());
  const [name, setName] = useState(() => authGuest?.name ?? readChatGuest()?.name ?? "");
  const [email, setEmail] = useState(() => authGuest?.email ?? readChatGuest()?.email ?? "");
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [thread, setThread] = useState<ChatThread | undefined>(undefined);
  const [resolvedProviderIds, setResolvedProviderIds] = useState<Record<string, string>>({});
  const { joinThread, leaveThread, setTyping, connected } = useRealtime();
  const activeProviderId =
    resolvedProviderIds[provider.slug] ||
    (OBJECT_ID_REGEX.test(provider.id) ? provider.id : "");

  // Logged-in customers skip the guest form — use account name/email.
  useEffect(() => {
    if (!authGuest) return;
    writeChatGuest(authGuest);
    setGuest(authGuest);
    setName(authGuest.name);
    setEmail(authGuest.email);
  }, [authGuest]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!guest?.email) {
        setThreads([]);
        setThread(undefined);
        return;
      }
      connectSocket({ guestEmail: guest.email });
      try {
        const next = await listPublicChatThreads(guest.email, { silent: true });
        if (cancelled) return;
        setThreads(next);
        setThread(currentThread(next, activeProviderId || provider.id, guest.email));
      } catch {
        if (cancelled) return;
        setThreads([]);
        setThread(undefined);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [activeProviderId, guest?.email, provider.id]);

  useEffect(() => {
    if (!guest?.email) return;
    return onSocketEvent("CHAT_THREAD_UPDATED", (payload) => {
      const updated = payload as ChatThread;
      if (!updated?.id) return;
      if (String(updated.providerId) !== String(activeProviderId || provider.id)) return;
      if (String(updated.customerEmail || "").toLowerCase() !== guest.email.toLowerCase()) {
        return;
      }
      setThread(updated);
      setResolvedProviderIds((current) => ({
        ...current,
        [provider.slug]: String(updated.providerId || ""),
      }));
      setThreads((current) =>
        [...current.filter((item) => item.id !== updated.id), updated].sort((a, b) =>
          b.updatedAt.localeCompare(a.updatedAt),
        ),
      );
    });
  }, [activeProviderId, guest?.email, provider.id, provider.slug]);

  useEffect(() => {
    if (!thread?.id || !open) return;
    joinThread(thread.id);
    return () => leaveThread(thread.id);
  }, [joinThread, leaveThread, open, thread?.id]);

  async function begin(
    nextName: string,
    nextEmail: string,
    firstText: string,
    attachments: ChatThread["messages"][number]["attachments"] = [],
  ) {
    const saved = { name: nextName.trim(), email: nextEmail.trim() };
    writeChatGuest(saved);
    setGuest(saved);
    connectSocket({ guestEmail: saved.email });
    const existing = currentThread(threads, activeProviderId || provider.id, saved.email);
    if (existing) {
      setThread(existing);
      return existing;
    }
    const created = requireThread(
      await openPublicChatThread({
        providerId: OBJECT_ID_REGEX.test(provider.id) ? provider.id : undefined,
        providerSlug: provider.slug,
        customerName: saved.name,
        customerEmail: saved.email,
        zip: provider.zip,
        city: provider.city,
        state: provider.state,
        street: provider.street,
        text: firstText || "Started a chat from the website.",
        attachments,
      }),
      "start the chat",
    );
    const nextThreads = [
      ...threads.filter((item) => item.id !== created.id),
      created,
    ].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    setThreads(nextThreads);
    setResolvedProviderIds((current) => ({
      ...current,
      [provider.slug]: String(created.providerId || ""),
    }));
    const latest = currentThread(nextThreads, created.providerId || provider.id, saved.email) ?? created;
    setThread(latest);
    return latest;
  }

  const unreadForCustomer = thread?.unreadForCustomer ?? 0;
  const showGuestForm = !guest;

  return (
    <>
      <Button type="button" variant="outline" size="xl" onClick={() => setOpen(true)}>
        <MessageCircle data-icon="inline-start" />
        Chat with this pro
        {unreadForCustomer > 0 ? (
          <span className="ml-2 rounded-full bg-primary px-1.5 text-[10px] font-semibold text-primary-foreground">
            {unreadForCustomer > 9 ? "9+" : unreadForCustomer}
          </span>
        ) : null}
      </Button>

      <Button
        type="button"
        size="icon-lg"
        className="relative fixed right-5 bottom-5 z-40 rounded-full shadow-lg"
        aria-label={`Chat with ${provider.companyName}`}
        onClick={() => setOpen(true)}
      >
        <MessageCircle />
        {unreadForCustomer > 0 ? (
          <span className="absolute -top-1 -right-1 flex size-5 items-center justify-center rounded-full bg-destructive text-[10px] font-semibold text-white">
            {unreadForCustomer > 9 ? "9+" : unreadForCustomer}
          </span>
        ) : null}
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-md" data-lenis-prevent>
          <SheetHeader className="border-b pr-12">
            <div className="flex items-center gap-3">
              <ProviderLogo provider={provider} size="sm" />
              <div className="min-w-0">
                <SheetTitle className="truncate">{provider.companyName}</SheetTitle>
                <SheetDescription>
                  They see this in Messages and can reply from the portal
                  {connected ? " · live" : ""}.
                </SheetDescription>
              </div>
            </div>
          </SheetHeader>

          {showGuestForm ? (
            <div className="flex flex-col gap-4 p-4">
              <p className="text-sm text-muted-foreground">
                Add your name and email so {provider.companyName} can reply and keep this conversation.
              </p>
              <Field>
                <FieldLabel htmlFor="chat-name">Name</FieldLabel>
                <Input id="chat-name" value={name} onChange={(event) => setName(event.target.value)} />
              </Field>
              <Field>
                <FieldLabel htmlFor="chat-email">Email</FieldLabel>
                <Input
                  id="chat-email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </Field>
              <Button
                type="button"
                onClick={async () => {
                  if (!name.trim() || !email.trim()) {
                    toast.error("Add your name and email to start the chat.");
                    return;
                  }
                  try {
                    await begin(name, email, "Hi - I would like to talk about a job.");
                    toast.success(`${provider.companyName} was notified in their portal.`);
                  } catch (error) {
                    toast.error(error instanceof Error ? error.message : "Unable to start the chat.");
                  }
                }}
              >
                Start chat
              </Button>
            </div>
          ) : (
            <ChatPanel
              messages={thread?.messages ?? []}
              self="customer"
              recipientUnreadCount={thread?.unreadForProvider ?? 0}
              footer="Your message notifies the pro. They reply from Messages in the dashboard."
              onTypingChange={(isTyping) => {
                if (thread?.id) setTyping(thread.id, isTyping);
              }}
              onSend={async (text, attachments) => {
                try {
                  const current = requireThread(
                    thread ??
                      (await begin(
                        guest!.name,
                        guest!.email,
                        text || "Sent a note from the website.",
                        attachments,
                      )),
                    "send the message",
                  );
                  const updated = thread
                    ? requireThread(
                        await sendPublicChatMessage(current.id, guest!.email, text, attachments),
                        "send the message",
                      )
                    : current;
                  const nextThreads = [
                    ...threads.filter((item) => item.id !== updated.id),
                    updated,
                  ].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
                  setThreads(nextThreads);
                  setThread(updated);
                } catch (error) {
                  toast.error(error instanceof Error ? error.message : "Unable to send the message.");
                }
              }}
            />
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
