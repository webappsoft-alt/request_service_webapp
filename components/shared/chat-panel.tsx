"use client";

import { useEffect, useRef, useState } from "react";
import { FileText, Paperclip, Send, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { ChatAttachment, ChatMessage, ChatRole } from "@/lib/booking/chat-store";
import { cn } from "@/lib/utils";

const accept = "image/jpeg,image/png,image/webp,image/gif,application/pdf";
const maxFiles = 5;
const maxBytes = 8 * 1024 * 1024;

function formatTime(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function makeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function ChatPanel({
  messages,
  self,
  onSend,
  placeholder = "Write a message or attach a photo / PDF…",
  footer,
}: {
  messages: ChatMessage[];
  self: ChatRole;
  onSend: (text: string, attachments: ChatAttachment[]) => void | Promise<void>;
  placeholder?: string;
  footer?: string;
}) {
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState<{ id: string; file: File; url: string }[]>([]);
  const listRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const node = listRef.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
  }, [messages, pending]);

  function addFiles(list: FileList | null) {
    if (!list?.length) return;
    const next: { id: string; file: File; url: string }[] = [];
    for (const file of Array.from(list)) {
      if (pending.length + next.length >= maxFiles) {
        toast.error(`You can attach up to ${maxFiles} files.`);
        break;
      }
      if (file.size > maxBytes) {
        toast.error(`${file.name} is over 8 MB.`);
        continue;
      }
      if (!file.type.startsWith("image/") && file.type !== "application/pdf") {
        toast.error("Use a photo or a PDF.");
        continue;
      }
      next.push({ id: makeId(), file, url: URL.createObjectURL(file) });
    }
    if (next.length) setPending((current) => [...current, ...next]);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function send() {
    const text = draft.trim();
    if (!text && !pending.length) {
      toast.error("Write a message or attach a file.");
      return;
    }
    const attachments = await Promise.all(
      pending.map(async (item) => ({
        id: item.id,
        name: item.file.name,
        url: await fileToDataUrl(item.file),
        type: item.file.type,
      })),
    );
    pending.forEach((item) => URL.revokeObjectURL(item.url));
    setDraft("");
    setPending([]);
    await onSend(text, attachments);
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div ref={listRef} data-lenis-prevent className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 py-4">
        {messages.length ? (
          messages.map((message) => {
            const mine = message.from === self;
            return (
              <div key={message.id} className={cn("flex flex-col gap-1.5", mine ? "items-end" : "items-start")}>
                <div
                  className={cn(
                    "max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-6",
                    mine
                      ? "rounded-br-md bg-primary text-primary-foreground"
                      : "rounded-bl-md border bg-card text-foreground",
                  )}
                >
                  {message.text ? <p>{message.text}</p> : null}
                  {message.attachments.length ? (
                    <ul className={cn("flex flex-col gap-2", message.text && "mt-2")}>
                      {message.attachments.map((file) => (
                        <li key={file.id}>
                          {file.type.startsWith("image/") ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={file.url} alt={file.name} className="max-h-40 rounded-lg object-cover" />
                          ) : (
                            <a
                              href={file.url}
                              target="_blank"
                              rel="noreferrer"
                              className={cn(
                                "inline-flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs font-medium",
                                mine ? "bg-primary-foreground/15" : "bg-muted",
                              )}
                            >
                              <FileText className="size-3.5" aria-hidden="true" />
                              {file.name}
                            </a>
                          )}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
                <p className="px-1 text-[11px] text-muted-foreground">{formatTime(message.at)}</p>
              </div>
            );
          })
        ) : (
          <p className="text-sm text-muted-foreground">No messages yet. Start the conversation.</p>
        )}
      </div>
      <div className="border-t bg-background p-3">
        {pending.length ? (
          <ul className="mb-2 flex flex-wrap gap-2">
            {pending.map((item) => (
              <li key={item.id} className="relative overflow-hidden rounded-lg border bg-muted">
                {item.file.type.startsWith("image/") ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.url} alt="" className="size-16 object-cover" />
                ) : (
                  <span className="flex size-16 items-center justify-center">
                    <FileText className="size-5 text-muted-foreground" aria-hidden="true" />
                  </span>
                )}
                <button
                  type="button"
                  className="absolute top-1 right-1 rounded-full bg-background/90 p-0.5 text-foreground shadow-sm"
                  aria-label={`Remove ${item.file.name}`}
                  onClick={() => {
                    URL.revokeObjectURL(item.url);
                    setPending((current) => current.filter((file) => file.id !== item.id));
                  }}
                >
                  <X className="size-3" />
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        <div className="flex items-end gap-2">
          <input
            ref={fileRef}
            type="file"
            accept={accept}
            multiple
            className="sr-only"
            onChange={(event) => addFiles(event.target.files)}
          />
          <Button
            type="button"
            variant="outline"
            size="icon-lg"
            aria-label="Attach a photo or PDF"
            onClick={() => fileRef.current?.click()}
          >
            <Paperclip />
          </Button>
          <Textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void send();
              }
            }}
            placeholder={placeholder}
            rows={1}
            className="min-h-11 max-h-32 resize-none"
          />
          <Button
            type="button"
            size="icon-lg"
            aria-label="Send message"
            disabled={!draft.trim() && !pending.length}
            onClick={() => void send()}
          >
            <Send />
          </Button>
        </div>
        {footer ? <p className="mt-2 text-[11px] text-muted-foreground">{footer}</p> : null}
      </div>
    </div>
  );
}
