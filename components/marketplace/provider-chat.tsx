"use client";

import { useEffect, useState } from "react";
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
  type ChatThread,
} from "@/lib/booking/chat-store";
import {
  listPublicChatThreads,
  markPublicChatRead,
  openPublicChatThread,
  sendPublicChatMessage,
} from "@/lib/api/chat-client";
import { connectRealtime, onRealtime } from "@/lib/realtime/socket";
import type { Provider } from "@/lib/types";

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

export function ProviderChat({ provider }: { provider: Provider }) {
  const [open, setOpen] = useState(false);
  const [guest, setGuest] = useState(readChatGuest);
  const [name, setName] = useState(() => readChatGuest()?.name ?? "");
  const [email, setEmail] = useState(() => readChatGuest()?.email ?? "");
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [thread, setThread] = useState<ChatThread | undefined>(undefined);
  const [resolvedProviderIds, setResolvedProviderIds] = useState<Record<string, string>>({});
  const { joinThread, leaveThread, setTyping, connected } = useRealtime();
  const activeProviderId =
    resolvedProviderIds[provider.slug] ||
    (OBJECT_ID_REGEX.test(provider.id) ? provider.id : "");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!guest?.email) {
        setThreads([]);
        setThread(undefined);
        return;
      }
      connectRealtime({ guestEmail: guest.email });
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
    return onRealtime("CHAT_THREAD_UPDATED", (payload) => {
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
    connectRealtime({ guestEmail: saved.email });
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

  return (
    <>
      <Button type="button" variant="outline" size="xl" onClick={() => setOpen(true)}>
        <MessageCircle data-icon="inline-start" />
        Chat with this pro
      </Button>

      <Button
        type="button"
        size="icon-lg"
        className="fixed right-5 bottom-5 z-40 rounded-full shadow-lg"
        aria-label={`Chat with ${provider.companyName}`}
        onClick={() => setOpen(true)}
      >
        <MessageCircle />
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

          {!guest ? (
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
              footer="Your message notifies the pro. They reply from Messages in the dashboard."
              onTypingChange={(isTyping) => {
                if (thread?.id) setTyping(thread.id, isTyping);
              }}
              onSend={async (text, attachments) => {
                try {
                  const current = requireThread(
                    thread ??
                      (await begin(
                        guest.name,
                        guest.email,
                        text || "Sent a note from the website.",
                        attachments,
                      )),
                    "send the message",
                  );
                  const updated = thread
                    ? requireThread(
                        await sendPublicChatMessage(current.id, guest.email, text, attachments),
                        "send the message",
                      )
                    : current;
                  const readThread = requireThread(
                    await markPublicChatRead(updated.id, guest.email),
                    "mark the chat as read",
                  );
                  const nextThreads = [
                    ...threads.filter((item) => item.id !== readThread.id),
                    readThread,
                  ].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
                  setThreads(nextThreads);
                  setThread(readThread);
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
