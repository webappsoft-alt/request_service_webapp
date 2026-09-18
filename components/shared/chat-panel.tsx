"use client";

import { useEffect, useRef, useState } from "react";
import {
  Check,
  CheckCheck,
  Download,
  FileText,
  Loader2,
  Maximize2,
  MessageSquare,
  Paperclip,
  Send,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { extractUploadedUrl, uploadDoc, uploadFile } from "@/components/api/uploadFile";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import type { ChatAttachment, ChatMessage, ChatRole } from "@/lib/booking/chat-store";
import {
  formatClockTime,
  formatDateDivider,
  getAvatarColor,
  getInitials,
} from "@/lib/chat-format";
import { cn } from "@/lib/utils";

const accept = "image/jpeg,image/png,image/webp,image/gif,application/pdf";
const maxFiles = 5;
const maxBytes = 8 * 1024 * 1024;

function makeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function errorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim()) return error.message;
  if (error && typeof error === "object" && "message" in error) {
    const message = String((error as { message?: unknown }).message || "").trim();
    if (message) return message;
  }
  return fallback;
}

async function uploadChatFile(file: File) {
  const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  const response = isPdf ? await uploadDoc(file) : await uploadFile(file);
  const url = extractUploadedUrl(response.data);
  if (!url) throw new Error(`Could not upload ${file.name}.`);
  return url;
}

export function ChatPanel({
  messages,
  self,
  onSend,
  placeholder = "Write a message or attach photos / PDFs…",
  footer,
  onTypingChange,
  otherName = "Customer",
  otherAvatar,
  quickReplies,
}: {
  messages: ChatMessage[];
  self: ChatRole;
  onSend: (text: string, attachments: ChatAttachment[]) => void | Promise<void>;
  placeholder?: string;
  footer?: string;
  onTypingChange?: (isTyping: boolean) => void;
  otherName?: string;
  otherAvatar?: string;
  quickReplies?: string[];
}) {
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState<{ id: string; file: File; url: string }[]>([]);
  const [sending, setSending] = useState(false);
  const [lightboxAttachment, setLightboxAttachment] = useState<{
    url: string;
    name: string;
  } | null>(null);

  const listRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const typingTimer = useRef<number | null>(null);

  useEffect(() => {
    const node = listRef.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
  }, [messages, pending]);

  useEffect(() => {
    return () => {
      if (typingTimer.current) window.clearTimeout(typingTimer.current);
      onTypingChange?.(false);
    };
  }, [onTypingChange]);

  function signalTyping() {
    if (!onTypingChange) return;
    onTypingChange(true);
    if (typingTimer.current) window.clearTimeout(typingTimer.current);
    typingTimer.current = window.setTimeout(() => onTypingChange(false), 1200);
  }

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
    if (sending) return;
    const text = draft.trim();
    if (!text && !pending.length) {
      toast.error("Write a message or attach a file.");
      return;
    }
    setSending(true);
    try {
      const attachments = await Promise.all(
        pending.map(async (item) => ({
          id: item.id,
          name: item.file.name,
          url: await uploadChatFile(item.file),
          type:
            item.file.type ||
            (item.file.name.toLowerCase().endsWith(".pdf")
              ? "application/pdf"
              : "image/jpeg"),
        })),
      );
      await onSend(text, attachments);
      pending.forEach((item) => URL.revokeObjectURL(item.url));
      setDraft("");
      setPending([]);
    } catch (error) {
      toast.error(errorMessage(error, "Could not send the attachment."));
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-slate-50/50 dark:bg-background">
      {/* Messages Scroll Area */}
      <div
        ref={listRef}
        data-lenis-prevent
        className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4 sm:p-6"
      >
        {messages.length ? (
          messages.map((message, index) => {
            const mine = message.from === self;
            const prevMessage = messages[index - 1];
            const showDateDivider =
              index === 0 ||
              formatDateDivider(message.at) !== formatDateDivider(prevMessage?.at);

            return (
              <div key={message.id} className="flex flex-col gap-1.5">
                {/* Date Divider */}
                {showDateDivider ? (
                  <div className="my-3 flex items-center justify-center">
                    <span className="rounded-full border border-black/10 bg-background/95 px-3 py-1 text-[11px] font-semibold text-muted-foreground shadow-2xs">
                      {formatDateDivider(message.at)}
                    </span>
                  </div>
                ) : null}

                {/* Message Row */}
                <div
                  className={cn(
                    "flex items-end gap-2.5",
                    mine ? "justify-end" : "justify-start",
                  )}
                >
                  {/* Incoming Sender Avatar */}
                  {!mine ? (
                    <Avatar className="size-8 shrink-0 shadow-2xs ring-1 ring-border">
                      {otherAvatar ? (
                        <AvatarImage src={otherAvatar} alt={otherName} />
                      ) : null}
                      <AvatarFallback
                        className={cn(
                          "text-xs font-semibold",
                          getAvatarColor(otherName),
                        )}
                      >
                        {getInitials(otherName)}
                      </AvatarFallback>
                    </Avatar>
                  ) : null}

                  <div
                    className={cn(
                      "flex max-w-[85%] flex-col gap-1 sm:max-w-[70%]",
                      mine ? "items-end" : "items-start",
                    )}
                  >
                    {/* Bubble */}
                    <div
                      className={cn(
                        "group relative rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-xs transition-shadow",
                        mine
                          ? "rounded-br-xs bg-[#003F7D] text-white"
                          : "rounded-bl-xs border border-black/10 bg-card text-foreground",
                      )}
                    >
                      {message.text ? (
                        <p className="whitespace-pre-wrap break-words selection:bg-white/20">
                          {message.text}
                        </p>
                      ) : null}

                      {/* Attachments */}
                      {message.attachments.length ? (
                        <div
                          className={cn(
                            "flex flex-wrap gap-2",
                            message.text && "mt-2.5 pt-1",
                          )}
                        >
                          {message.attachments.map((file) => (
                            <div key={file.id} className="overflow-hidden">
                              {file.type.startsWith("image/") ? (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setLightboxAttachment({
                                      url: file.url,
                                      name: file.name,
                                    })
                                  }
                                  className="group/img relative block overflow-hidden rounded-xl border border-black/10 shadow-xs transition-transform hover:scale-[1.02]"
                                  aria-label={`View photo: ${file.name}`}
                                >
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img
                                    src={file.url}
                                    alt={file.name}
                                    className="max-h-56 w-auto max-w-full rounded-xl object-cover"
                                  />
                                  <div className="absolute inset-0 flex items-center justify-center bg-black/35 opacity-0 backdrop-blur-xs transition-opacity group-hover/img:opacity-100">
                                    <span className="flex items-center gap-1.5 rounded-full bg-black/65 px-3 py-1.5 text-xs font-medium text-white shadow-sm">
                                      <Maximize2 className="size-3.5" />
                                      Zoom
                                    </span>
                                  </div>
                                </button>
                              ) : (
                                <a
                                  href={file.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className={cn(
                                    "inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-medium transition-colors",
                                    mine
                                      ? "border-white/20 bg-white/10 text-white hover:bg-white/20"
                                      : "border-border bg-muted/60 text-foreground hover:bg-muted",
                                  )}
                                >
                                  <FileText className="size-4 shrink-0" aria-hidden="true" />
                                  <span className="max-w-44 truncate">{file.name}</span>
                                  <Download className="size-3.5 shrink-0 opacity-70" />
                                </a>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>

                    {/* Timestamp & Status */}
                    <div
                      className={cn(
                        "flex items-center gap-1 px-1 text-[11px] text-muted-foreground",
                        mine && "justify-end",
                      )}
                    >
                      <span>{formatClockTime(message.at)}</span>
                      {mine ? (
                        <CheckCheck
                          className="size-3.5 text-[#003F7D] dark:text-sky-400"
                          aria-label="Delivered"
                        />
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center text-muted-foreground">
            <div className="flex size-12 items-center justify-center rounded-full bg-muted">
              <MessageSquare className="size-6 text-muted-foreground/60" />
            </div>
            <p className="text-sm font-medium">No messages yet</p>
            <p className="max-w-xs text-xs">
              Start the conversation by sending a quick message, quote preview, or project question.
            </p>
          </div>
        )}
      </div>

      {/* Composer */}
      <div className="border-t border-border bg-background p-3 sm:p-4 shadow-sm">
        {/* Pending File Previews */}
        {pending.length ? (
          <ul className="mb-2.5 flex flex-wrap gap-2">
            {pending.map((item) => (
              <li
                key={item.id}
                className="relative overflow-hidden rounded-xl border border-black/10 bg-muted/60 shadow-2xs"
              >
                {item.file.type.startsWith("image/") ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.url}
                    alt={item.file.name}
                    className="size-16 object-cover"
                  />
                ) : (
                  <span className="flex size-16 flex-col items-center justify-center gap-1 p-1 text-center">
                    <FileText className="size-5 text-muted-foreground" aria-hidden="true" />
                    <span className="line-clamp-1 max-w-14 text-[9px] text-muted-foreground">
                      {item.file.name}
                    </span>
                  </span>
                )}
                <button
                  type="button"
                  className="absolute top-1 right-1 rounded-full bg-background/90 p-1 text-foreground shadow-xs transition-transform hover:scale-110"
                  aria-label={`Remove ${item.file.name}`}
                  onClick={() => {
                    URL.revokeObjectURL(item.url);
                    setPending((current) =>
                      current.filter((file) => file.id !== item.id),
                    );
                  }}
                >
                  <X className="size-3" />
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        {/* Input Bar */}
        <div className="flex items-end gap-2">
          <input
            ref={fileRef}
            type="file"
            accept={accept}
            multiple
            className="sr-only"
            disabled={sending}
            onChange={(event) => addFiles(event.target.files)}
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-10 shrink-0 rounded-xl border-border text-muted-foreground hover:text-foreground"
            aria-label="Attach photos or PDF documents"
            title="Attach photos or PDF documents"
            disabled={sending}
            onClick={() => fileRef.current?.click()}
          >
            <Paperclip className="size-4" />
          </Button>

          <Textarea
            value={draft}
            onChange={(event) => {
              setDraft(event.target.value);
              signalTyping();
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void send();
              }
            }}
            placeholder={placeholder}
            rows={1}
            disabled={sending}
            className="min-h-10 max-h-32 resize-none rounded-xl bg-card text-sm leading-normal focus-visible:ring-1 focus-visible:ring-[#003F7D]"
          />

          <Button
            type="button"
            className="size-10 shrink-0 rounded-xl bg-[#003F7D] text-white shadow-xs hover:bg-[#003264]"
            aria-label="Send message"
            disabled={sending || (!draft.trim() && !pending.length)}
            onClick={() => void send()}
          >
            {sending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Send className="size-4" />
            )}
          </Button>
        </div>
      </div>

      {/* Lightbox Image Preview Dialog */}
      <Dialog
        open={Boolean(lightboxAttachment)}
        onOpenChange={(open) => !open && setLightboxAttachment(null)}
      >
        <DialogContent className="max-w-4xl border-black/10 bg-background/95 p-3 backdrop-blur-md sm:p-5">
          <DialogHeader className="flex flex-row items-center justify-between pb-3 border-b">
            <DialogTitle className="max-w-[70%] truncate text-sm font-semibold">
              {lightboxAttachment?.name}
            </DialogTitle>
            {lightboxAttachment ? (
              <Button size="sm" variant="outline" asChild>
                <a
                  href={lightboxAttachment.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  download={lightboxAttachment.name}
                >
                  <Download className="mr-1.5 size-3.5" />
                  Download
                </a>
              </Button>
            ) : null}
          </DialogHeader>
          <div className="relative flex max-h-[75vh] items-center justify-center overflow-hidden rounded-xl bg-black/5 p-2">
            {lightboxAttachment ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={lightboxAttachment.url}
                alt={lightboxAttachment.name}
                className="max-h-[70vh] w-auto max-w-full rounded-lg object-contain shadow-md"
              />
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

