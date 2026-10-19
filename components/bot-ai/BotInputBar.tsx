"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { ArrowUp, Mic, MicOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { BOT_DISCLAIMER } from "./systemPromptGuide";

const MAX_LENGTH = 500;

/** Minimal Web Speech API surface (not in every TS DOM lib). */
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

function speechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const scope = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return scope.SpeechRecognition ?? scope.webkitSpeechRecognition ?? null;
}

const noopSubscribe = () => () => {};

export function BotInputBar({
  onSend,
  disabled,
  autoFocus,
  placeholder = "Describe your home issue…",
}: {
  onSend: (text: string) => void;
  disabled?: boolean;
  autoFocus?: boolean;
  placeholder?: string;
}) {
  const [value, setValue] = useState("");
  const [listening, setListening] = useState(false);
  const speechSupported = useSyncExternalStore(
    noopSubscribe,
    () => Boolean(speechRecognitionCtor()),
    () => false,
  );
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  useEffect(() => () => recognitionRef.current?.stop(), []);

  useEffect(() => {
    // Desktop only: on phones the keyboard would pop up over the chat as soon as it opens.
    if (autoFocus && window.matchMedia("(min-width: 640px)").matches) textareaRef.current?.focus();
  }, [autoFocus]);

  // Auto-grow up to ~4 lines.
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 112)}px`;
  }, [value]);

  function submit() {
    const text = value.trim();
    if (!text || disabled) return;
    onSend(text);
    setValue("");
    textareaRef.current?.focus();
  }

  function toggleSpeech() {
    if (listening) {
      recognitionRef.current?.stop();
      return;
    }
    const Ctor = speechRecognitionCtor();
    if (!Ctor) return;
    const recognition = new Ctor();
    recognition.lang = "en-US";
    recognition.interimResults = true;
    recognition.continuous = false;
    const base = value ? `${value.trim()} ` : "";
    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map((result) => result[0]?.transcript ?? "")
        .join("");
      setValue(`${base}${transcript}`.slice(0, MAX_LENGTH));
    };
    recognition.onend = () => setListening(false);
    recognition.onerror = () => setListening(false);
    recognitionRef.current = recognition;
    setListening(true);
    recognition.start();
  }

  const canSend = Boolean(value.trim()) && !disabled;

  return (
    <div className="border-t bg-popover/95 px-3 pt-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))] backdrop-blur">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
        className={cn(
          "flex items-end gap-1.5 rounded-2xl border bg-background p-1.5 pl-3 shadow-sm transition",
          "focus-within:border-primary/50 focus-within:ring-3 focus-within:ring-primary/15",
          listening && "border-rose-400/60 ring-3 ring-rose-400/15",
        )}
      >
        <textarea
          ref={textareaRef}
          rows={1}
          value={value}
          maxLength={MAX_LENGTH}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault();
              submit();
            }
          }}
          placeholder={listening ? "Listening…" : placeholder}
          aria-label="Message the assistant"
          // 16px on phones: iOS Safari zooms the page into any focused field under 16px,
          // which pushed the full-screen chat off the viewport.
          className="max-h-28 min-h-8 min-w-0 flex-1 resize-none bg-transparent py-1.5 text-base leading-5 outline-none placeholder:text-muted-foreground sm:text-[13px]"
        />
        {speechSupported ? (
          <button
            type="button"
            onClick={toggleSpeech}
            aria-label={listening ? "Stop voice input" : "Speak your message"}
            aria-pressed={listening}
            className={cn(
              "relative flex size-8 shrink-0 items-center justify-center rounded-full transition",
              listening
                ? "bg-rose-500 text-white"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {listening ? (
              <>
                <span className="absolute inset-0 animate-ping rounded-full bg-rose-500/40" aria-hidden />
                <MicOff className="relative size-4" />
              </>
            ) : (
              <Mic className="size-4" />
            )}
          </button>
        ) : null}
        <button
          type="submit"
          disabled={!canSend}
          aria-label="Send message"
          className={cn(
            "flex size-8 shrink-0 items-center justify-center rounded-full transition",
            canSend
              ? "bg-primary text-primary-foreground shadow-md shadow-primary/25 hover:scale-105"
              : "bg-muted text-muted-foreground",
          )}
        >
          <ArrowUp className="size-4" />
        </button>
      </form>
      <p className="mt-1.5 text-center text-[10px] leading-snug text-muted-foreground">
        {BOT_DISCLAIMER}
      </p>
    </div>
  );
}
