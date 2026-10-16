"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  Bot,
  CheckCircle2,
  Headphones,
  Loader2,
  Mic,
  PhoneForwarded,
  PhoneOff,
  PhoneCall,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { AiCallingSwitch } from "./ai-calling-switch";
import { CALL_HISTORY_PATH } from "./ai-call-history";
import { testStreamUrl } from "./audio";

type CallStatus = "idle" | "connecting" | "live" | "ended";

type TranscriptEntry =
  | { kind: "caller" | "assistant"; text: string }
  | { kind: "notice"; tone: "success" | "info" | "error"; text: string; href?: string; linkLabel?: string };

type TranscriptItem = TranscriptEntry & { id: number };

const MIC_RATE = 16000;
const SPEECH_RATE = 24000;

/** Downsamples mic audio to 16 kHz PCM16 and posts ~20 ms chunks to the main thread. */
const WORKLET_SOURCE = `
class Pcm16Downsampler extends AudioWorkletProcessor {
  constructor() { super(); this.queue = []; }
  process(inputs) {
    const input = inputs[0] && inputs[0][0];
    if (!input) return true;
    for (let i = 0; i < input.length; i++) this.queue.push(input[i]);
    const ratio = sampleRate / ${MIC_RATE};
    const n = Math.floor(this.queue.length / ratio);
    if (n < 320) return true;
    const out = new Int16Array(n);
    for (let j = 0; j < n; j++) {
      const start = Math.floor(j * ratio);
      const end = Math.max(start + 1, Math.floor((j + 1) * ratio));
      let sum = 0;
      for (let k = start; k < end; k++) sum += this.queue[k];
      const v = Math.max(-1, Math.min(1, sum / (end - start)));
      out[j] = v < 0 ? v * 0x8000 : v * 0x7fff;
    }
    this.queue = this.queue.slice(Math.floor(n * ratio));
    this.port.postMessage(out.buffer, [out.buffer]);
    return true;
  }
}
registerProcessor("pcm16-downsampler", Pcm16Downsampler);
`;

function formatDuration(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

/**
 * Browser voice test for the AI receptionist (no Twilio): mic → backend test socket →
 * Deepgram → GPT → Cartesia → speakers. Uses the provider's saved voice and greeting.
 */
export function AiCallTestHarness() {
  const [status, setStatus] = useState<CallStatus>("idle");
  const [transcript, setTranscript] = useState<TranscriptItem[]>([]);
  const [interim, setInterim] = useState("");
  const [aiSpeaking, setAiSpeaking] = useState(false);
  const [headphones, setHeadphones] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [companyName, setCompanyName] = useState("");

  const wsRef = useRef<WebSocket | null>(null);
  const micCtxRef = useRef<AudioContext | null>(null);
  const playCtxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const sourcesRef = useRef(new Set<AudioBufferSourceNode>());
  const nextTimeRef = useRef(0);
  const leftoverRef = useRef<Uint8Array | null>(null);
  const markTimersRef = useRef<number[]>([]);
  const headphonesRef = useRef(headphones);
  const idRef = useRef(0);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    headphonesRef.current = headphones;
  }, [headphones]);

  useEffect(() => {
    if (status !== "live") return;
    const timer = window.setInterval(() => setSeconds((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [status]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [transcript, interim]);

  const push = (item: TranscriptEntry) =>
    setTranscript((items) => [...items, { ...item, id: ++idRef.current }]);

  const isAiAudible = () => {
    const ctx = playCtxRef.current;
    return Boolean(ctx && nextTimeRef.current > ctx.currentTime);
  };

  function clearPlayback() {
    sourcesRef.current.forEach((source) => {
      try {
        source.stop();
      } catch {
        // already stopped
      }
    });
    sourcesRef.current.clear();
    markTimersRef.current.forEach((timer) => window.clearTimeout(timer));
    markTimersRef.current = [];
    nextTimeRef.current = 0;
    leftoverRef.current = null;
    setAiSpeaking(false);
  }

  function playChunk(data: ArrayBuffer) {
    const ctx = playCtxRef.current;
    if (!ctx) return;
    // PCM16 frames can split across WebSocket messages; carry the odd byte over.
    let bytes = new Uint8Array(data);
    if (leftoverRef.current) {
      const merged = new Uint8Array(leftoverRef.current.length + bytes.length);
      merged.set(leftoverRef.current);
      merged.set(bytes, leftoverRef.current.length);
      bytes = merged;
      leftoverRef.current = null;
    }
    if (bytes.length % 2) {
      leftoverRef.current = bytes.slice(-1);
      bytes = bytes.slice(0, -1);
    }
    if (!bytes.length) return;

    const samples = new Int16Array(bytes.buffer, bytes.byteOffset, bytes.length / 2);
    const buffer = ctx.createBuffer(1, samples.length, SPEECH_RATE);
    const channel = buffer.getChannelData(0);
    for (let i = 0; i < samples.length; i++) channel[i] = samples[i] / 0x8000;

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    const startAt = Math.max(ctx.currentTime + 0.04, nextTimeRef.current);
    source.start(startAt);
    nextTimeRef.current = startAt + buffer.duration;
    sourcesRef.current.add(source);
    setAiSpeaking(true);
    source.onended = () => {
      sourcesRef.current.delete(source);
      if (!sourcesRef.current.size) setAiSpeaking(false);
    };
  }

  /** Tell the server playback reached `name` once the queued audio has actually played. */
  function ackMark(name: string) {
    const ctx = playCtxRef.current;
    const delay = ctx ? Math.max(0, nextTimeRef.current - ctx.currentTime) : 0;
    const timer = window.setTimeout(() => {
      const ws = wsRef.current;
      if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: "mark", name }));
    }, delay * 1000);
    markTimersRef.current.push(timer);
  }

  function teardown() {
    clearPlayback();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    void micCtxRef.current?.close().catch(() => {});
    void playCtxRef.current?.close().catch(() => {});
    micCtxRef.current = null;
    playCtxRef.current = null;
  }

  function handleEvent(message: Record<string, unknown>) {
    const text = typeof message.text === "string" ? message.text : "";
    switch (message.type) {
      case "ready":
        setCompanyName(String(message.companyName || ""));
        setStatus("live");
        break;
      case "interim":
        setInterim(text);
        break;
      case "caller":
        setInterim("");
        push({ kind: "caller", text });
        break;
      case "assistant":
        push({ kind: "assistant", text });
        break;
      case "clear":
        clearPlayback();
        break;
      case "mark":
        ackMark(String(message.name || ""));
        break;
      case "estimate":
      {
        const itemCount = typeof message.itemCount === "number" ? message.itemCount : null;
        const amount = typeof message.total === "number" ? message.total : 0;
        const items = itemCount !== null ? ` with ${itemCount} line item${itemCount === 1 ? "" : "s"}` : "";
        const total = amount > 0 ? ` (${amount.toLocaleString("en-US", { style: "currency", currency: "USD" })})` : "";
        push({
          kind: "notice",
          tone: "success",
          text: message.created
            ? `Draft estimate ${message.number} created${items}${total}. Review and send it from Estimates.`
            : `Draft estimate ${message.number} got the follow-up call notes (same caller within 24h).`,
          href: `/pro/dashboard/new-estimate/${message.opportunityId}`,
          linkLabel: "Open estimate",
        });
        break;
      }
      case "lead":
        push({
          kind: "notice",
          tone: "success",
          text: message.created
            ? `Lead ${message.number} created (the caller did not ask for an estimate). Find it under Requests & Leads.`
            : message.requestedIntent === "estimate"
              ? `Lead ${message.number} got the follow-up notes: the same caller called within 24h and now wants an estimate.`
              : `Lead ${message.number} got the follow-up call notes (same caller within 24h).`,
          href: `/pro/dashboard/requests/${message.leadId}`,
          linkLabel: "Open lead",
        });
        break;
      case "transfer":
        push({
          kind: "notice",
          tone: "info",
          text: message.number
            ? `On a real call, the caller would now be transferred to ${message.number}.`
            : "On a real call, this would end: no forwarding number is saved.",
        });
        break;
      case "end":
        push({ kind: "notice", tone: "info", text: `Call ended: ${String(message.reason || "")}` });
        break;
      case "error":
        push({ kind: "notice", tone: "error", text: String(message.message || "Something went wrong.") });
        break;
      default:
        break;
    }
  }

  async function startCall() {
    setTranscript([]);
    setInterim("");
    setSeconds(0);
    setStatus("connecting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 },
      });
      streamRef.current = stream;

      const playCtx = new AudioContext();
      playCtxRef.current = playCtx;
      const micCtx = new AudioContext();
      micCtxRef.current = micCtx;
      const workletUrl = URL.createObjectURL(new Blob([WORKLET_SOURCE], { type: "application/javascript" }));
      await micCtx.audioWorklet.addModule(workletUrl);
      URL.revokeObjectURL(workletUrl);

      const ws = new WebSocket(testStreamUrl());
      ws.binaryType = "arraybuffer";
      wsRef.current = ws;

      const node = new AudioWorkletNode(micCtx, "pcm16-downsampler");
      node.port.onmessage = (event: MessageEvent<ArrayBuffer>) => {
        if (ws.readyState !== WebSocket.OPEN) return;
        // Without headphones the mic hears the AI; send silence while it talks so it
        // doesn't interrupt itself.
        if (!headphonesRef.current && isAiAudible()) ws.send(new ArrayBuffer(event.data.byteLength));
        else ws.send(event.data);
      };
      micCtx.createMediaStreamSource(stream).connect(node);

      ws.onmessage = (event) => {
        if (event.data instanceof ArrayBuffer) playChunk(event.data);
        else {
          try {
            handleEvent(JSON.parse(String(event.data)));
          } catch {
            // ignore malformed frames
          }
        }
      };
      ws.onclose = () => {
        if (wsRef.current === ws) wsRef.current = null;
        // Let the last audio finish before tearing the speakers down.
        const ctx = playCtxRef.current;
        const remaining = ctx ? Math.max(0, nextTimeRef.current - ctx.currentTime) : 0;
        window.setTimeout(teardown, remaining * 1000 + 200);
        setInterim("");
        setStatus("ended");
      };
      ws.onerror = () => push({ kind: "notice", tone: "error", text: "Connection to the test server failed." });
    } catch (error) {
      teardown();
      setStatus("idle");
      push({
        kind: "notice",
        tone: "error",
        text:
          error instanceof DOMException && error.name === "NotAllowedError"
            ? "Microphone access was blocked. Allow it in your browser and try again."
            : "Could not start the test call. Check your microphone and try again.",
      });
    }
  }

  function endCall() {
    const ws = wsRef.current;
    if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: "stop" }));
    ws?.close();
    clearPlayback();
  }

  useEffect(
    () => () => {
      wsRef.current?.close();
      teardown();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- unmount cleanup only
    [],
  );

  const busy = status === "connecting" || status === "live";

  return (
    <div className="grid items-start gap-4 lg:grid-cols-[22rem_minmax(0,1fr)]">
      <Card className="rounded-xl border-border-soft">
        <CardContent className="flex flex-col items-center gap-5 pt-6 text-center">
          <div className="relative">
            <span
              className={cn(
                "flex size-24 items-center justify-center rounded-full transition-colors",
                status === "live" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
              )}
            >
              {status === "connecting" ? (
                <Loader2 className="size-9 animate-spin" aria-hidden="true" />
              ) : aiSpeaking ? (
                <Bot className="size-10" aria-hidden="true" />
              ) : (
                <Mic className="size-10" aria-hidden="true" />
              )}
            </span>
            {status === "live" ? (
              <span className="absolute inset-0 -z-10 animate-ping rounded-full bg-primary/25" aria-hidden="true" />
            ) : null}
          </div>
          <div aria-live="polite">
            <p className="text-base font-semibold text-foreground">
              {status === "idle" && "Ready to test"}
              {status === "connecting" && "Connecting…"}
              {status === "live" && (aiSpeaking ? "Receptionist is speaking" : "Listening…")}
              {status === "ended" && "Call ended"}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {status === "live" || status === "ended"
                ? `${companyName ? `${companyName} · ` : ""}${formatDuration(seconds)}`
                : "Talk as if you were a customer calling your business."}
            </p>
          </div>

          {busy ? (
            <Button type="button" variant="destructive" className="w-full gap-2" onClick={endCall}>
              <PhoneOff className="size-4" aria-hidden="true" /> End test call
            </Button>
          ) : (
            <Button type="button" className="w-full gap-2" onClick={() => void startCall()}>
              <PhoneCall className="size-4" aria-hidden="true" /> {status === "ended" ? "Call again" : "Start test call"}
            </Button>
          )}

          <label className="flex w-full cursor-pointer items-center justify-between gap-3 rounded-lg border border-border-soft px-3 py-2.5 text-left">
            <span className="flex items-start gap-2.5">
              <Headphones className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <span>
                <span className="block text-sm font-medium">I&apos;m using headphones</span>
                <span className="block text-xs text-muted-foreground">Lets you interrupt the AI mid-sentence.</span>
              </span>
            </span>
            <AiCallingSwitch checked={headphones} onCheckedChange={setHeadphones} aria-label="Using headphones" />
          </label>

          {status === "ended" ? (
            <Link
              href={CALL_HISTORY_PATH}
              className="text-sm font-medium text-primary underline-offset-4 hover:underline"
            >
              View the full call log
            </Link>
          ) : null}

          <ul className="w-full space-y-1.5 text-left text-xs leading-5 text-muted-foreground">
            <li>• Uses your saved voice, greeting, and business categories.</li>
            <li>• Quote requests become draft estimates; other inquiries and callbacks become leads. Both are real and marked as a test call in their notes.</li>
            <li>• Transfers are simulated; no phone call is placed.</li>
          </ul>
        </CardContent>
      </Card>

      <Card className="rounded-xl border-border-soft">
        <CardHeader className="border-b border-border-soft">
          <CardTitle>Live transcript</CardTitle>
          <CardDescription>What the receptionist heard and said.</CardDescription>
        </CardHeader>
        <CardContent className="pt-4">
          <div ref={scrollRef} className="flex h-[28rem] flex-col gap-3 overflow-y-auto pr-1">
            {transcript.length === 0 && !interim ? (
              <p className="m-auto max-w-xs text-center text-sm text-muted-foreground">
                Start a test call and say something like &ldquo;Hi, my kitchen sink is leaking.&rdquo;
              </p>
            ) : null}
            {transcript.map((item) =>
              item.kind === "notice" ? (
                <div
                  key={item.id}
                  className={cn(
                    "flex items-start gap-2 rounded-lg border px-3 py-2 text-xs",
                    item.tone === "success" && "border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300",
                    item.tone === "info" && "border-border-soft bg-muted/50 text-muted-foreground",
                    item.tone === "error" && "border-destructive/30 bg-destructive/10 text-destructive",
                  )}
                >
                  {item.tone === "success" ? (
                    <CheckCircle2 className="mt-px size-3.5 shrink-0" aria-hidden="true" />
                  ) : item.tone === "error" ? (
                    <AlertCircle className="mt-px size-3.5 shrink-0" aria-hidden="true" />
                  ) : (
                    <PhoneForwarded className="mt-px size-3.5 shrink-0" aria-hidden="true" />
                  )}
                  <span className="flex-1">
                    {item.text}{" "}
                    {item.href ? (
                      <Link href={item.href} className="font-semibold underline underline-offset-2">
                        {item.linkLabel || "Open"}
                      </Link>
                    ) : null}
                  </span>
                </div>
              ) : (
                <div
                  key={item.id}
                  className={cn("flex items-end gap-2", item.kind === "caller" ? "flex-row-reverse" : "")}
                >
                  <span
                    className={cn(
                      "flex size-7 shrink-0 items-center justify-center rounded-full",
                      item.kind === "caller" ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary",
                    )}
                    aria-hidden="true"
                  >
                    {item.kind === "caller" ? <User className="size-3.5" /> : <Bot className="size-3.5" />}
                  </span>
                  <p
                    className={cn(
                      "max-w-[80%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed",
                      item.kind === "caller"
                        ? "rounded-br-sm bg-primary text-primary-foreground"
                        : "rounded-bl-sm bg-muted text-foreground",
                    )}
                  >
                    <span className="sr-only">{item.kind === "caller" ? "You: " : "Receptionist: "}</span>
                    {item.text}
                  </p>
                </div>
              ),
            )}
            {interim ? (
              <p className="max-w-[80%] self-end rounded-2xl rounded-br-sm border border-dashed border-primary/40 px-3.5 py-2 text-sm text-muted-foreground italic">
                {interim}
              </p>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
