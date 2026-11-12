"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { ArrowUp, Mic, MicOff } from "lucide-react";
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

/** Pro assistant input: Enter sends, Shift+Enter = new line, mic = voice-to-text (browser). */
export function ProAssistantInput({
  onSend,
  disabled,
  autoFocus,
}: {
  onSend: (text: string) => void;
  disabled?: boolean;
  autoFocus?: boolean;
}) {
  const [value, setValue] = useState("");
  const [listening, setListening] = useState(false);
  const speechSupported = useSyncExternalStore(noopSubscribe, () => Boolean(speechCtor()), () => false);
  const ref = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const baseRef = useRef("");
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
    if (!text || disabled) return;
    recognitionRef.current?.stop();
    onSend(text);
    setValue("");
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
    recognition.continuous = false;
    baseRef.current = value ? `${value.trim()} ` : "";
    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map((result) => result[0]?.transcript || "")
        .join("");
      const next = `${baseRef.current}${transcript}`.slice(0, MAX_LENGTH);
      valueRef.current = next;
      setValue(next);
    };
    // Client: when speech stops, send what was heard right away (no Send click needed).
    recognition.onend = () => {
      setListening(false);
      const heard = valueRef.current.trim();
      if (heard && !disabledRef.current) {
        onSendRef.current(heard);
        setValue("");
        valueRef.current = "";
      }
    };
    recognition.onerror = () => setListening(false);
    recognitionRef.current = recognition;
    setListening(true);
    recognition.start();
  }

  return (
    <div className="border-t bg-popover px-3 pt-2.5 pb-2">
      <div
        className={cn(
          "flex items-end gap-1.5 rounded-xl border bg-background px-2.5 py-1.5 shadow-xs transition focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/15",
          listening && "border-rose-300 ring-2 ring-rose-200",
        )}
      >
        <textarea
          ref={ref}
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
          placeholder={listening ? "Listening…" : "Ask, open a page, find a record, or paste a scope of work…"}
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
          disabled={disabled || !value.trim()}
          aria-label="Send"
          className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground transition hover:bg-primary/90 disabled:opacity-40"
        >
          <ArrowUp className="size-4" />
        </button>
      </div>
      <p className="mt-1.5 text-center text-[10.5px] text-muted-foreground">
        Pro co-pilot · only your business data · review estimates before sending
      </p>
    </div>
  );
}
