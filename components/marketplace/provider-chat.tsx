"use client";

import { useEffect, useState } from "react";
import { MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { ChatPanel } from "@/components/shared/chat-panel";
import { ProviderLogo } from "@/components/shared/provider-logo";
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
  appendChatMessage,
  ensureChatThread,
  findChatThread,
  markChatRead,
  readChatGuest,
  subscribeChat,
  writeChatGuest,
  type ChatThread,
} from "@/lib/booking/chat-store";
import { createWebsiteLead } from "@/lib/booking/create-website-lead";
import type { Provider } from "@/lib/types";

function currentThread(providerEmail: string, customerEmail?: string) {
  if (!customerEmail) return undefined;
  return findChatThread(providerEmail, { customerEmail });
}

export function ProviderChat({ provider }: { provider: Provider }) {
  const [open, setOpen] = useState(false);
  const [guest, setGuest] = useState(readChatGuest);
  const [name, setName] = useState(() => readChatGuest()?.name ?? "");
  const [email, setEmail] = useState(() => readChatGuest()?.email ?? "");
  const [thread, setThread] = useState<ChatThread | undefined>(() =>
    currentThread(provider.email, readChatGuest()?.email),
  );

  useEffect(() => {
    return subscribeChat(() => {
      setThread(currentThread(provider.email, guest?.email));
    });
  }, [guest?.email, provider.email]);

  function begin(nextName: string, nextEmail: string, firstText: string) {
    const saved = { name: nextName.trim(), email: nextEmail.trim() };
    writeChatGuest(saved);
    setGuest(saved);
    const existing = currentThread(provider.email, saved.email);
    if (existing) {
      setThread(existing);
      return existing;
    }
    const { request } = createWebsiteLead({
      provider,
      name: saved.name,
      email: saved.email,
      zip: provider.zip,
      details: firstText || "Started a chat from the website.",
      serviceName: "Website chat",
    });
    const created = ensureChatThread({
      providerEmail: provider.email,
      providerId: provider.id,
      customerName: saved.name,
      customerEmail: saved.email,
      requestId: request.id,
    });
    if (firstText.trim()) {
      appendChatMessage({
        providerEmail: provider.email,
        threadId: created.id,
        from: "customer",
        text: firstText,
      });
    }
    const latest = currentThread(provider.email, saved.email) ?? created;
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
                <SheetDescription>They see this in Messages and can reply from the portal.</SheetDescription>
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
                onClick={() => {
                  if (!name.trim() || !email.trim()) {
                    toast.error("Add your name and email to start the chat.");
                    return;
                  }
                  begin(name, email, "Hi — I would like to talk about a job.");
                  toast.success(`${provider.companyName} was notified in their portal.`);
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
              onSend={(text, attachments) => {
                const current = thread ?? begin(guest.name, guest.email, text || "Sent a note from the website.");
                appendChatMessage({
                  providerEmail: provider.email,
                  threadId: current.id,
                  from: "customer",
                  text,
                  attachments,
                });
                markChatRead(provider.email, current.id, "customer");
              }}
            />
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
