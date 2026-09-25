"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  Check,
  CheckCheck,
  Clock,
  Download,
  FileText,
  Loader2,
  Maximize2,
  MessageSquare,
  Paperclip,
  RotateCw,
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

type OptimisticMessage = ChatMessage & {
  status: "pending" | "sent" | "failed";
  localPendingFiles?: { id: string; file: File; url: string }[];
};

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
  recipientUnreadCount = 0,
  isOtherTyping = false,
  otherTypingName,
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
  recipientUnreadCount?: number;
  isOtherTyping?: boolean;
  otherTypingName?: string;
}) {
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState<{ id: string; file: File; url: string }[]>([]);
  const [optimisticList, setOptimisticList] = useState<OptimisticMessage[]>([]);
  const [lightboxAttachment, setLightboxAttachment] = useState<{
    url: string;
    name: string;
  } | null>(null);

  const listRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const typingTimer = useRef<number | null>(null);

  // Combine parent messages with optimistic messages (with deduplication)
  const displayMessages = useMemo(() => {
    if (!optimisticList.length) return messages;

    // Filter out optimistic messages that already exist in `messages` from the server
    const pendingToKeep = optimisticList.filter((opt) => {
      const alreadyDelivered = messages.some((m) => {
        if (m.id === opt.id) return true;
        if (m.from === opt.from && m.text === opt.text) {
          const t1 = new Date(m.at).getTime();
          const t2 = new Date(opt.at).getTime();
          if (!Number.isNaN(t1) && !Number.isNaN(t2) && Math.abs(t1 - t2) < 20000) {
            return true;
          }
        }
        return false;
      });
      return !alreadyDelivered;
    });

    return [...messages, ...pendingToKeep];
  }, [messages, optimisticList]);

  // Clean up optimistic items that landed in server messages
  useEffect(() => {
    if (!optimisticList.length) return;
    setOptimisticList((prev) =>
      prev.filter((opt) => {
        if (opt.status === "failed") return true; // Keep failed items for retry
        const inServer = messages.some((m) => {
          if (m.id === opt.id) return true;
          if (m.from === opt.from && m.text === opt.text) {
            const t1 = new Date(m.at).getTime();
            const t2 = new Date(opt.at).getTime();
            if (!Number.isNaN(t1) && !Number.isNaN(t2) && Math.abs(t1 - t2) < 20000) {
              return true;
            }
          }
          return false;
        });
        return !inServer;
      }),
    );
  }, [messages, optimisticList.length]);

  // Auto-scroll on new message or typing indicator change
  useEffect(() => {
    const node = listRef.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
  }, [displayMessages.length, pending.length, isOtherTyping]);

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

  async function executeSend(
    text: string,
    files: { id: string; file: File; url: string }[],
    optId: string,
  ) {
    try {
      let finalAttachments: ChatAttachment[] = [];
      if (files.length) {
        finalAttachments = await Promise.all(
          files.map(async (item) => ({
            id: item.id,
            name: item.file.name,
            url: item.url.startsWith("blob:")
              ? await uploadChatFile(item.file)
              : item.url,
            type:
              item.file.type ||
              (item.file.name.toLowerCase().endsWith(".pdf")
                ? "application/pdf"
                : "image/jpeg"),
          })),
        );
      }

      await onSend(text, finalAttachments);

      // Clean up object URLs
      files.forEach((item) => {
        if (item.url.startsWith("blob:")) URL.revokeObjectURL(item.url);
      });

      // Remove from optimistic list once server acknowledged
      setOptimisticList((prev) => prev.filter((m) => m.id !== optId));
    } catch (error) {
      setOptimisticList((prev) =>
        prev.map((m) => (m.id === optId ? { ...m, status: "failed" } : m)),
      );
      toast.error(errorMessage(error, "Could not send the message. Click Retry."));
    }
  }

  function send() {
    const text = draft.trim();
    if (!text && !pending.length) {
      toast.error("Write a message or attach a file.");
      return;
    }

    const currentPendingFiles = [...pending];
    const optId = `temp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const tempAttachments: ChatAttachment[] = currentPendingFiles.map((item) => ({
      id: item.id,
      name: item.file.name,
      url: item.url,
      type:
        item.file.type ||
        (item.file.name.toLowerCase().endsWith(".pdf")
          ? "application/pdf"
          : "image/jpeg"),
    }));

    const optimisticMessage: OptimisticMessage = {
      id: optId,
      from: self,
      text,
      at: new Date().toISOString(),
      attachments: tempAttachments,
      status: "pending",
      localPendingFiles: currentPendingFiles,
    };

    // Instant optimistic render: append immediately to chat view
    setOptimisticList((prev) => [...prev, optimisticMessage]);
    setDraft("");
    setPending([]);
    if (fileRef.current) fileRef.current.value = "";

    // Execute API transmission asynchronously in background
    void executeSend(text, currentPendingFiles, optId);
  }

  function handleRetry(msg: OptimisticMessage) {
    setOptimisticList((prev) =>
      prev.map((m) => (m.id === msg.id ? { ...m, status: "pending" } : m)),
    );
    void executeSend(msg.text, msg.localPendingFiles || [], msg.id);
  }

  // Calculate whether a sent message is read by the recipient
  function isMessageReadByRecipient(
    msg: ChatMessage,
    index: number,
    all: ChatMessage[],
    unreadCount: number,
  ): boolean {
    if (msg.isRead || Boolean(msg.readAt) || msg.status === "read") return true;
    // Do NOT treat unreadCount <= 0 as "all read" — that false-positive marked
    // every outgoing message read when the wrong unread field was passed (0).
    // Only use the unread-tail heuristic when we know how many are still unread.
    if (unreadCount <= 0) return false;

    // Count how many sent messages from `self` exist AFTER this message
    const myLaterDeliveredCount = all
      .slice(index + 1)
      .filter((m) => m.from === self && m.status !== "pending" && m.status !== "failed").length;

    // If this message has fewer than `unreadCount` later messages, it is within the unread tail
    return myLaterDeliveredCount >= unreadCount;
  }

  function renderStatusIndicator(message: ChatMessage, index: number) {
    // 1. Pending (Sending) -> Clock Icon
    if (message.status === "pending") {
      return (
        <span
          className="inline-flex items-center gap-1 text-muted-foreground/80"
          title="Sending…"
        >
          <Clock className="size-3 animate-pulse text-muted-foreground" aria-label="Sending…" />
        </span>
      );
    }

    // 2. Failed -> Error Alert + Retry Button
    if (message.status === "failed") {
      return (
        <span className="inline-flex items-center gap-1 text-rose-500">
          <AlertCircle className="size-3 shrink-0" aria-label="Failed to send" />
          <button
            type="button"
            onClick={() => handleRetry(message as OptimisticMessage)}
            className="inline-flex items-center gap-0.5 rounded px-1 py-0.2 text-[10px] font-semibold text-rose-600 dark:text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 transition-colors"
            title="Click to retry"
          >
            <RotateCw className="size-2.5" />
            Retry
          </button>
        </span>
      );
    }

    // 3. Delivered: Single vs Double Tick
    const read = isMessageReadByRecipient(
      message,
      index,
      displayMessages,
      recipientUnreadCount,
    );

    if (read) {
      return (
        <span title="Read">
          <CheckCheck
            className="size-3.5 text-[#003F7D] dark:text-sky-400"
            aria-label="Read"
          />
        </span>
      );
    }

    return (
      <span title="Sent (Delivered)">
        <Check
          className="size-3.5 text-muted-foreground/80"
          aria-label="Sent"
        />
      </span>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-slate-50/50 dark:bg-background">
      {/* Messages Scroll Area */}
      <div
        ref={listRef}
        data-lenis-prevent
        className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4 sm:p-6"
      >
        {displayMessages.length ? (
          displayMessages.map((message, index) => {
            const mine = message.from === self;
            const isAdmin = message.from === "admin";
            const prevMessage = displayMessages[index - 1];
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
                      {isAdmin ? (
                        <AvatarFallback className="bg-indigo-600 text-white text-[10px] font-bold">
                          AD
                        </AvatarFallback>
                      ) : (
                        <>
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
                        </>
                      )}
                    </Avatar>
                  ) : null}

                  <div
                    className={cn(
                      "flex max-w-[85%] flex-col gap-1 sm:max-w-[70%]",
                      mine ? "items-end" : "items-start",
                    )}
                  >
                    {isAdmin ? (
                      <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                        Platform Support
                      </span>
                    ) : null}

                    {/* Bubble */}
                    <div
                      className={cn(
                        "group relative rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-xs transition-shadow",
                        isAdmin
                          ? "rounded-bl-xs border border-indigo-200/80 bg-indigo-50/80 text-indigo-950 dark:border-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-100"
                          : mine
                            ? "rounded-br-xs bg-[#003F7D] text-white"
                            : "rounded-bl-xs border border-black/10 bg-card text-foreground",
                        message.status === "failed" && "border-rose-400 bg-rose-50 text-rose-950 dark:bg-rose-950/40 dark:text-rose-100",
                        message.status === "pending" && "opacity-85",
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

                    {/* Timestamp & Status Icon */}
                    <div
                      className={cn(
                        "flex items-center gap-1.5 px-1 text-[11px] text-muted-foreground",
                        mine && "justify-end",
                      )}
                    >
                      <span>{formatClockTime(message.at)}</span>
                      {mine ? renderStatusIndicator(message, index) : null}
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

        {/* Real-time Typing Indicator */}
        {isOtherTyping ? (
          <div className="flex items-end gap-2 text-left animate-in fade-in slide-in-from-bottom-2 duration-200">
            <Avatar className="size-8 shrink-0 shadow-2xs ring-1 ring-border">
              {otherAvatar ? (
                <AvatarImage src={otherAvatar} alt={otherTypingName || otherName} />
              ) : null}
              <AvatarFallback
                className={cn(
                  "text-xs font-semibold",
                  getAvatarColor(otherTypingName || otherName),
                )}
              >
                {getInitials(otherTypingName || otherName)}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col gap-1">
              <div className="rounded-2xl rounded-bl-xs border border-border bg-card px-4 py-2.5 shadow-2xs">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-muted-foreground">
                    {otherTypingName || otherName} is typing
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="size-1.5 animate-bounce rounded-full bg-[#003F7D] dark:bg-sky-400 [animation-delay:-0.3s]" />
                    <span className="size-1.5 animate-bounce rounded-full bg-[#003F7D] dark:bg-sky-400 [animation-delay:-0.15s]" />
                    <span className="size-1.5 animate-bounce rounded-full bg-[#003F7D] dark:bg-sky-400" />
                  </span>
                </div>
              </div>
            </div>
          </div>
        ) : null}
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
                    setPending((current) => current.filter((p) => p.id !== item.id));
                  }}
                >
                  <X className="size-3" />
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        {/* Quick Replies */}
        {quickReplies?.length ? (
          <div className="mb-2.5 flex flex-wrap gap-1.5">
            {quickReplies.map((reply) => (
              <button
                key={reply}
                type="button"
                onClick={() => setDraft(reply)}
                className="rounded-full border border-black/10 bg-muted/60 px-2.5 py-1 text-xs text-foreground transition-colors hover:bg-muted"
              >
                {reply}
              </button>
            ))}
          </div>
        ) : null}

        {/* Text Input Row */}
        <div className="flex items-center gap-2">
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
            size="icon"
            className="size-10 shrink-0 rounded-xl border-border text-muted-foreground hover:text-foreground"
            aria-label="Attach photos or PDF documents"
            title="Attach photos or PDF documents"
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
                send();
              }
            }}
            placeholder={placeholder}
            rows={1}
            className="min-h-10 max-h-32 resize-none rounded-xl bg-card text-sm leading-normal focus-visible:ring-1 focus-visible:ring-[#003F7D]"
          />

          <Button
            type="button"
            size="icon"
            className="size-10 shrink-0 rounded-xl bg-[#003F7D] text-white shadow-xs hover:bg-[#003264]"
            aria-label="Send message"
            disabled={!draft.trim() && !pending.length}
            onClick={() => send()}
          >
            <Send className="size-4" />
          </Button>
        </div>

        {footer ? (
          <p className="mt-2 text-center text-[11px] text-muted-foreground">
            {footer}
          </p>
        ) : null}
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

          {lightboxAttachment ? (
            <div className="flex max-h-[75vh] items-center justify-center overflow-hidden p-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={lightboxAttachment.url}
                alt={lightboxAttachment.name}
                className="max-h-[70vh] w-auto max-w-full rounded-lg object-contain shadow-lg"
              />
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
