"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { ArrowUp, Camera, ImagePlus, Loader2, Mic, MicOff, X } from "lucide-react";
import { extractUploadedUrl, uploadFile } from "@/components/api/uploadFile";
import { cn } from "@/lib/utils";

const MAX_LENGTH = 2000;

type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start: () => void;
  stop: () => void;
};
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function speechCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: SpeechRecognitionCtor; webkitSpeechRecognition?: SpeechRecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}
const noopSubscribe = () => () => {};

/** Site photos per message (the backend analyzes up to 6 at once). */
const MAX_PHOTOS = 6;
const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];
const PHOTO_MAX_BYTES = 15 * 1024 * 1024;

type Attachment = { id: string; preview: string; url: string | null; uploading: boolean; error: string | null };
const attachmentId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

/**
 * Pro assistant input: Enter sends, Shift+Enter = new line, mic = voice-to-text (browser).
 * Site photos: attach button, paste or drag & drop; each uploads at once through the existing
 * upload helper (POST /upload-image) and is sent as its URL. A message can be photos only.
 */
export function ProAssistantInput({
  onSend,
  disabled,
  autoFocus,
  onListenStart,
  photoRequest = 0,
  photoHint = null,
  onCancelPhotoHint,
  prefill = null,
}: {
  /** `voice`: the text came from the microphone (the reply is read aloud). `images`: uploaded site photos. */
  onSend: (text: string, meta?: { voice?: boolean; images?: string[] }) => void;
  disabled?: boolean;
  /** Called when the mic starts (e.g. to stop reading a reply aloud). */
  onListenStart?: () => void;
  autoFocus?: boolean;
  /** Bump to open the photo picker (the "Upload 2–3 more photos" chip). */
  photoRequest?: number;
  /** Shown above the box while the co-pilot is waiting for more photos. */
  photoHint?: string | null;
  onCancelPhotoHint?: () => void;
  /** Put text in the box and focus it (nonce makes the same text apply again). */
  prefill?: { text: string; nonce: number } | null;
}) {
  const [value, setValue] = useState("");
  const [listening, setListening] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const attachmentsRef = useRef<Attachment[]>([]);
  useEffect(() => {
    attachmentsRef.current = attachments;
  }, [attachments]);
  // Free the local previews when the input goes away.
  useEffect(() => () => attachmentsRef.current.forEach((a) => URL.revokeObjectURL(a.preview)), []);

  // "Upload more photos" chip → open the picker.
  useEffect(() => {
    if (photoRequest > 0) fileRef.current?.click();
  }, [photoRequest]);
  // "No, it's something else" / "Enter dimensions" style prefills.
  useEffect(() => {
    if (!prefill) return;
    const frame = requestAnimationFrame(() => {
      setValue(prefill.text);
      const el = ref.current;
      if (el) {
        el.focus();
        el.setSelectionRange(prefill.text.length, prefill.text.length);
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [prefill]);

  function addFiles(list: FileList | File[] | null | undefined) {
    const files = Array.from(list || []).filter((file) => file.type.startsWith("image/"));
    if (!files.length) return;
    const room = MAX_PHOTOS - attachmentsRef.current.length;
    for (const file of files.slice(0, Math.max(0, room))) {
      const id = attachmentId();
      const preview = URL.createObjectURL(file);
      const bad = !PHOTO_TYPES.includes(file.type)
        ? "Use a JPG, PNG or WebP photo."
        : file.size > PHOTO_MAX_BYTES
          ? "Over 15 MB."
          : null;
      setAttachments((prev) => [...prev, { id, preview, url: null, uploading: !bad, error: bad }]);
      if (bad) continue;
      void uploadFile(file)
        .then((response) => {
          const url = extractUploadedUrl(response.data);
          setAttachments((prev) =>
            prev.map((a) => (a.id === id ? { ...a, url, uploading: false, error: url ? null : "Upload failed." } : a)),
          );
        })
        .catch(() => setAttachments((prev) => prev.map((a) => (a.id === id ? { ...a, uploading: false, error: "Upload failed." } : a))));
    }
  }

  function removeAttachment(id: string) {
    setAttachments((prev) => {
      const gone = prev.find((a) => a.id === id);
      if (gone) URL.revokeObjectURL(gone.preview);
      return prev.filter((a) => a.id !== id);
    });
  }

  const uploading = attachments.some((a) => a.uploading);
  const readyPhotos = attachments.filter((a) => a.url && !a.error).map((a) => a.url as string);
  const speechSupported = useSyncExternalStore(noopSubscribe, () => Boolean(speechCtor()), () => false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const baseRef = useRef("");
  // The text in the box came from the mic → send it as voice (the reply is read aloud).
  const voiceRef = useRef(false);
  // Latest text + send handler for the speech "end" callback (voice auto-send).
  const valueRef = useRef("");
  const onSendRef = useRef(onSend);
  const disabledRef = useRef(disabled);
  useEffect(() => {
    valueRef.current = value;
    onSendRef.current = onSend;
    disabledRef.current = disabled;
  });

  useEffect(() => () => recognitionRef.current?.stop(), []);
  useEffect(() => {
    if (autoFocus && window.matchMedia("(min-width: 640px)").matches) ref.current?.focus();
  }, [autoFocus]);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [value]);

  function submit() {
    const text = value.trim();
    // Photos-only messages are fine; wait for uploads to finish first.
    if ((!text && !readyPhotos.length) || disabled || uploading) return;
    recognitionRef.current?.stop();
    // Previous: onSend(text, voiceRef.current ? { voice: true } : undefined);
    onSend(text, { ...(voiceRef.current ? { voice: true } : {}), ...(readyPhotos.length ? { images: readyPhotos } : {}) });
    voiceRef.current = false;
    setValue("");
    attachments.forEach((a) => URL.revokeObjectURL(a.preview));
    setAttachments([]);
  }

  function toggleVoice() {
    if (listening) {
      recognitionRef.current?.stop();
      return;
    }
    const Ctor = speechCtor();
    if (!Ctor) return;
    const recognition = new Ctor();
    recognition.lang = "en-US";
    recognition.interimResults = true;
    // recognition.continuous = false;
    // Keep listening through short pauses; the words show live in the box as they are heard.
    recognition.continuous = true;
    baseRef.current = value ? `${value.trim()} ` : "";
    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map((result) => result[0]?.transcript || "")
        .join("");
      const next = `${baseRef.current}${transcript}`.slice(0, MAX_LENGTH);
      valueRef.current = next;
      voiceRef.current = true;
      setValue(next);
    };
    // Client: when speech stops, send what was heard right away (no Send click needed).
    /* Previous: auto-sent as soon as speech stopped (the Pro could not review the words).
    recognition.onend = () => {
      setListening(false);
      const heard = valueRef.current.trim();
      if (heard && !disabledRef.current) {
        onSendRef.current(heard, { voice: true });
        setValue("");
        valueRef.current = "";
      }
    }; */
    // Now: the transcript stays in the box to check / edit, then Enter or Send.
    recognition.onend = () => {
      setListening(false);
      const el = ref.current;
      if (el && valueRef.current) {
        el.focus();
        el.setSelectionRange(el.value.length, el.value.length);
      }
    };
    recognition.onerror = () => setListening(false);
    recognitionRef.current = recognition;
    onListenStart?.();
    setListening(true);
    recognition.start();
  }

  return (
    <div
      className={cn("relative border-t bg-popover px-3 pt-2.5 pb-2", dragging && "bg-primary/5")}
      onDragOver={(event) => {
        if (!Array.from(event.dataTransfer.types).includes("Files")) return;
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false);
      }}
      onDrop={(event) => {
        if (!event.dataTransfer.files?.length) return;
        event.preventDefault();
        setDragging(false);
        addFiles(event.dataTransfer.files);
      }}
    >
      <input
        ref={fileRef}
        type="file"
        accept={PHOTO_TYPES.join(",")}
        multiple
        className="hidden"
        onChange={(event) => {
          addFiles(event.target.files);
          event.target.value = "";
        }}
      />
      {dragging ? (
        <div className="pointer-events-none absolute inset-1.5 z-10 flex items-center justify-center rounded-xl border-2 border-dashed border-primary/50 bg-popover/90 text-xs font-semibold text-primary">
          Drop site photos to attach
        </div>
      ) : null}
      {photoHint ? (
        <div className="mb-2 flex items-center gap-2 rounded-lg bg-primary/5 px-2.5 py-1.5 text-[11.5px] text-primary">
          <Camera className="size-3.5 shrink-0" aria-hidden />
          <span className="min-w-0 flex-1">{photoHint}</span>
          {onCancelPhotoHint ? (
            <button type="button" onClick={onCancelPhotoHint} aria-label="Cancel" className="rounded p-0.5 hover:bg-primary/10">
              <X className="size-3" />
            </button>
          ) : null}
        </div>
      ) : null}
      {attachments.length ? (
        <ul className="mb-2 flex gap-2 overflow-x-auto pb-0.5 scrollbar-none" aria-label="Attached photos">
          {attachments.map((a) => (
            <li key={a.id} className="relative size-14 shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element -- local preview of the Pro's photo */}
              <img
                src={a.preview}
                alt="Attached site photo"
                className={cn("size-full rounded-lg border object-cover", (a.uploading || a.error) && "opacity-60")}
              />
              {a.uploading ? (
                <span className="absolute inset-0 flex items-center justify-center">
                  <Loader2 className="size-4 animate-spin text-white drop-shadow" aria-label="Uploading" />
                </span>
              ) : null}
              {a.error ? (
                <span className="absolute inset-x-0 bottom-0 rounded-b-lg bg-rose-600/90 px-1 text-center text-[9px] font-medium text-white" title={a.error}>
                  {a.error}
                </span>
              ) : null}
              <button
                type="button"
                onClick={() => removeAttachment(a.id)}
                aria-label="Remove photo"
                className="absolute -top-1.5 -right-1.5 flex size-5 items-center justify-center rounded-full border bg-background text-foreground shadow-sm hover:bg-muted"
              >
                <X className="size-3" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <div
        className={cn(
          "flex items-end gap-1.5 rounded-xl border bg-background px-2.5 py-1.5 shadow-xs transition focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/15",
          listening && "border-rose-300 ring-2 ring-rose-200",
        )}
      >
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={attachments.length >= MAX_PHOTOS}
          aria-label="Attach site photos"
          title={attachments.length >= MAX_PHOTOS ? `Up to ${MAX_PHOTOS} photos` : "Attach site photos"}
          className="flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:opacity-40"
        >
          <ImagePlus className="size-4" />
        </button>
        <textarea
          ref={ref}
          rows={1}
          value={value}
          maxLength={MAX_LENGTH}
          readOnly={listening}
          onChange={(event) => setValue(event.target.value)}
          // Pasted screenshots / photos attach like the button.
          onPaste={(event) => {
            const files = Array.from(event.clipboardData?.files || []).filter((file) => file.type.startsWith("image/"));
            if (files.length) {
              event.preventDefault();
              addFiles(files);
            }
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault();
              submit();
            }
          }}
          // Previous: "Ask, open a page, find a record, or paste a scope of work…"
          placeholder={
            listening
              ? "Listening… start speaking"
              : attachments.length
                ? "Add a note (optional), e.g. “Estimate this kitchen remodel”"
                : "Ask, attach site photos, or paste a scope of work…"
          }
          aria-label="Message the Pro assistant"
          className="max-h-40 min-h-9 flex-1 resize-none bg-transparent py-1.5 text-sm outline-none placeholder:text-muted-foreground"
        />
        {speechSupported ? (
          <button
            type="button"
            onClick={toggleVoice}
            aria-label={listening ? "Stop voice input" : "Speak a command"}
            title={listening ? "Stop" : "Speak a command"}
            className={cn(
              "flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground",
              listening && "bg-rose-50 text-rose-600 hover:bg-rose-100 hover:text-rose-700",
            )}
          >
            {listening ? <MicOff className="size-4" /> : <Mic className="size-4" />}
          </button>
        ) : null}
        <button
          type="button"
          onClick={submit}
          // Previous: disabled={disabled || !value.trim()}
          disabled={disabled || uploading || (!value.trim() && !readyPhotos.length)}
          aria-label={uploading ? "Uploading photos…" : "Send"}
          className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground transition hover:bg-primary/90 disabled:opacity-40"
        >
          <ArrowUp className="size-4" />
        </button>
      </div>
      {listening ? (
        <p className="mt-1.5 flex items-center justify-center gap-1.5 text-[10.5px] font-medium text-rose-600" aria-live="polite">
          <span className="relative flex size-2">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-rose-400 opacity-75" />
            <span className="relative inline-flex size-2 rounded-full bg-rose-500" />
          </span>
          Listening — your words appear above. Tap the mic to stop, then send.
        </p>
      ) : (
      <p className="mt-1.5 text-center text-[10.5px] text-muted-foreground">
        Pro co-pilot · only your business data · review estimates before sending
      </p>
      )}
    </div>
  );
}
