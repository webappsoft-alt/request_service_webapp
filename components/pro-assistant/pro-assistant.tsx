"use client";

import "./pro-assistant.css";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { ArrowUpRight, ChevronRight, History, Loader2, Maximize2, Minimize2, Minus, RotateCcw, Volume2, VolumeX, Wand2, X } from "lucide-react";
import { extractErrorMessage } from "@/components/api/extractErrorMessage";
import { ConfirmCard, InfoCard, ListCard } from "./action-cards";
import { cn } from "@/lib/utils";
import { useAppSelector } from "@/store/hooks";
import { selectAuthProvider, selectAuthToken, selectAuthUser } from "@/store/authSlice";
import { getServiceCategoryById } from "@/lib/data/services";
import { EstimateDraftCard } from "./estimate-draft-card";
import { ProAssistantHistory } from "./history-panel";
import { ProAssistantInput } from "./pro-assistant-input";
import { PRO_ASSISTANT_TOGGLE_EVENT } from "./pro-assistant-launcher";
// import { ProAssistantEdgeTab } from "./pro-assistant-launcher"; — right-edge tab, replaced by the bubble
import { ProAssistantBubble } from "./pro-assistant-bubble";
// import { ProAssistantLauncher } from "./pro-assistant-launcher"; — floating launcher, replaced by the header button
import {
  cancelAssistantAction,
  confirmAssistantAction,
  getAssistantConversation,
  isSafePortalHref,
  type PaAction,
  type PaMessage,
  type PaReply,
} from "./pro-assistant-api";
import { useProAssistantSocket } from "./use-pro-assistant-socket";

/**
 * Pro operations co-pilot (Pro portal only). Separate from the customer bot: its own socket
 * namespace, API, components and styles. Operations manager: answers from live CRM data, opens
 * pages and records, drafts estimates, and prepares changes (assign, schedule, invoice, send…) that
 * run only after the Pro confirms — by button or by voice ("yes" / "cancel"). Replies can be read
 * aloud only when the Pro used the mic (speaker button mutes that). Ctrl/⌘ + J toggles it.
 */

// Previous: ["Show employee time tracking", "Open estimates", "Open invoice INV-…", "Fix kitchen pipe leak, replace valve, total $150"]
// Previous: [...OPS_STARTERS, "Create an estimate for a bathroom leak"] — the estimate chips now come from the Pro's own categories.
const OPS_STARTERS = ["How's business today?", "Show overdue invoices", "Who should take my next job?"];
const STARTERS = OPS_STARTERS;
/** Shown when the Pro has no categories yet (or the profile is still loading). */
const GENERIC_ESTIMATE_STARTER = "Create a new estimate";
/** Category estimate chips shown before "+N more" (all are shown when there are this many or fewer). */
const ESTIMATE_CHIPS_VISIBLE = 4;
// Previous key ("read every reply aloud"); kept so the old setting is not reused with a new meaning.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const VOICE_KEY = "rs-pro-assistant:speak";
const VOICE_REPLIES_KEY = "rs-pro-assistant:voice-replies";
const YES = /^(?:yes|yeah|yep|yup|sure|ok(?:ay)?|confirm(?:ed)?|do it|go ahead|go for it|send it|please do|approved?|correct)\b/i;
const NO = /^(?:no|nope|cancel|stop|don'?t|never mind|nevermind|abort)\b/i;

/** Read a reply aloud (browser speech synthesis). */
function speak(text: string) {
  if (typeof window === "undefined" || !("speechSynthesis" in window) || !text.trim()) return;
  try {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text.replace(/[“”]/g, '"').slice(0, 600));
    utterance.lang = "en-US";
    utterance.rate = 1.05;
    window.speechSynthesis.speak(utterance);
  } catch {
    /* speech unavailable */
  }
}
function stopSpeaking() {
  try {
    if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
  } catch {
    /* ignore */
  }
}
const STORAGE_PREFIX = "rs-pro-assistant:v1:";

const noopSubscribe = () => () => {};
const newId = () => (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);

function welcome(): PaMessage {
  return {
    id: "welcome",
    role: "assistant",
    // Previous: "Hi! I'm your Pro co-pilot. Tell me where to go, which record to open, or paste a scope of work and I'll draft the estimate."
    text: "Hi! I'm your operations co-pilot. Ask about your numbers, team and schedule, or tell me what to do — I'll draft estimates and invoices, assign the right technician and schedule visits. I always ask before changing anything.",
    suggestions: STARTERS,
    at: Date.now(),
  };
}

function loadMessages(key: string): PaMessage[] {
  try {
    const raw = sessionStorage.getItem(key);
    const parsed = raw ? (JSON.parse(raw) as PaMessage[]) : null;
    return Array.isArray(parsed) && parsed.length ? parsed.map((m) => ({ ...m, pending: false })) : [welcome()];
  } catch {
    return [welcome()];
  }
}

function HeaderButton({ label, onClick, active, className, children }: { label: string; onClick: () => void; active?: boolean; className?: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      aria-pressed={active}
      className={cn(
        "flex size-8 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        active && "bg-muted text-foreground",
        className,
      )}
    >
      {children}
    </button>
  );
}

function Avatar({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "relative flex size-8 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-primary via-primary to-primary/80 text-primary-foreground shadow-md ring-1 shadow-primary/25 ring-white/15",
        className,
      )}
    >
      <Wand2 className="size-[45%]" />
    </span>
  );
}

export function ProAssistant() {
  const router = useRouter();
  const user = useAppSelector(selectAuthUser);
  const token = useAppSelector(selectAuthToken);
  const isPro = String(user?.role || "provider") === "provider";
  const storageKey = `${STORAGE_PREFIX}${String(user?.id || user?._id || "pro")}`;

  // Welcome estimate chips from the Pro's own service categories (same source as the estimate draft card).
  const authProvider = useAppSelector(selectAuthProvider);
  const categoryIds = authProvider?.services?.categoryIds;
  const estimateStarters = useMemo(() => {
    const ids = Array.isArray(categoryIds) ? categoryIds : [];
    const seen = new Set<string>();
    const list: string[] = [];
    for (const id of ids) {
      const category = getServiceCategoryById(String(id));
      const name = (category?.name || category?.shortName || "").trim();
      if (!name || seen.has(name.toLowerCase())) continue;
      seen.add(name.toLowerCase());
      list.push(`Create an estimate for ${name}`);
    }
    return list.length ? list : [GENERIC_ESTIMATE_STARTER];
  }, [categoryIds]);
  const [showAllEstimateStarters, setShowAllEstimateStarters] = useState(false);

  // Client only (portal to <body>, sessionStorage).
  const mounted = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const [open, setOpen] = useState(false);
  const [everOpened, setEverOpened] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState<PaMessage[]>(() => (typeof window === "undefined" ? [] : loadMessages(storageKey)));
  // Saved conversation (server history) this chat belongs to.
  const [conversationId, setConversationId] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      return sessionStorage.getItem(`${storageKey}:conversation`) || null;
    } catch {
      return null;
    }
  });
  const [historyOpen, setHistoryOpen] = useState(false);
  /* Previous: "Read replies aloud" — when on, typed messages were spoken too.
  const [speakOn, setSpeakOn] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      return localStorage.getItem(VOICE_KEY) === "1";
    } catch {
      return false;
    }
  }); */
  // Now: typed message → text reply only; mic message → spoken reply + text. The speaker button
  // only mutes / unmutes those voice replies (on by default, remembered on this device).
  const [speakOn, setSpeakOn] = useState(() => {
    if (typeof window === "undefined") return true;
    try {
      return localStorage.getItem(VOICE_REPLIES_KEY) !== "0";
    } catch {
      return true;
    }
  });
  useEffect(() => {
    try {
      // localStorage.setItem(VOICE_KEY, speakOn ? "1" : "0");
      localStorage.setItem(VOICE_REPLIES_KEY, speakOn ? "1" : "0");
    } catch {
      /* ignore */
    }
    if (!speakOn) stopSpeaking();
  }, [speakOn]);
  const [loadingConversation, setLoadingConversation] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const pendingIdRef = useRef<string | null>(null);

  // Conversation survives page changes and reloads (this tab only).
  useEffect(() => {
    if (!mounted || !messages.length) return;
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(messages.slice(-40)));
    } catch {
      /* storage unavailable — the chat still works */
    }
  }, [messages, mounted, storageKey]);
  useEffect(() => {
    if (!mounted) return;
    try {
      if (conversationId) sessionStorage.setItem(`${storageKey}:conversation`, conversationId);
      else sessionStorage.removeItem(`${storageKey}:conversation`);
    } catch {
      /* ignore */
    }
  }, [conversationId, mounted, storageKey]);

  const handlers = useMemo(
    () => ({
      onDelta: (clientMessageId: string | null, text: string) => {
        if (!clientMessageId || clientMessageId !== pendingIdRef.current) return;
        setMessages((prev) => prev.map((m) => (m.id === `a-${clientMessageId}` ? { ...m, text } : m)));
      },
    }),
    [],
  );
  const { send } = useProAssistantSocket({ token: token?.trim() || null, enabled: everOpened && isPro, handlers });

  const openPanel = useCallback(() => {
    setEverOpened(true);
    setOpen(true);
  }, []);
  const closePanel = useCallback(() => {
    // (Speech keeps going so a spoken answer finishes while the page opens.)
    setOpen(false);
    setExpanded(false);
    setHistoryOpen(false);
  }, []);

  // The header's Co-pilot button toggles the panel.
  useEffect(() => {
    const onToggle = () => {
      if (open) closePanel();
      else openPanel();
    };
    window.addEventListener(PRO_ASSISTANT_TOGGLE_EVENT, onToggle);
    return () => window.removeEventListener(PRO_ASSISTANT_TOGGLE_EVENT, onToggle);
  }, [open, openPanel, closePanel]);

  // Ctrl/⌘ + J toggles; Esc closes (or restores when expanded).
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "j") {
        event.preventDefault();
        if (open) closePanel();
        else openPanel();
      } else if (event.key === "Escape" && open) {
        if (expanded) setExpanded(false);
        else closePanel();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, expanded, openPanel, closePanel]);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages, open]);

  /** Open a portal page; the co-pilot closes so the page is fully visible (client). Chat is kept. */
  const go = useCallback(
    (href: string) => {
      if (!isSafePortalHref(href)) return;
      router.push(href);
      closePanel();
    },
    [router, closePanel],
  );

  const startNew = useCallback(() => {
    setMessages([welcome()]);
    setConversationId(null);
    setHistoryOpen(false);
  }, []);

  const openConversation = useCallback(async (id: string) => {
    setLoadingConversation(true);
    try {
      const conversation = await getAssistantConversation(id);
      const list = Array.isArray(conversation.messages) ? conversation.messages : [];
      setMessages(list.length ? list.map((m) => ({ ...m, pending: false })) : [welcome()]);
      setConversationId(conversation.id);
      setHistoryOpen(false);
    } catch {
      /* stays on the history list */
    } finally {
      setLoadingConversation(false);
    }
  }, []);

  /** Update one message's Confirm card in the chat. */
  const patchConfirm = useCallback((messageId: string, patch: Partial<Extract<PaAction, { type: "confirm" }>>) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === messageId && m.action?.type === "confirm" ? { ...m, action: { ...m.action, ...patch } } : m)),
    );
  }, []);

  /** Confirm a prepared change (button or "yes"). The server runs what it stored, once. */
  const runConfirm = useCallback(
    async (messageId: string, actionId: string, aloud: boolean) => {
      patchConfirm(messageId, { status: "running", result: null });
      try {
        const result = await confirmAssistantAction(actionId);
        patchConfirm(messageId, { status: "done", result });
        // if (aloud || speakOn) speak(result.replyText || "Done.");
        if (aloud) speak(result.replyText || "Done.");
      } catch (error) {
        const message = extractErrorMessage(error) || "That didn't work. Please try again.";
        patchConfirm(messageId, { status: "pending", result: { error: message } });
        // if (aloud || speakOn) speak(message);
        if (aloud) speak(message);
      }
    },
    [patchConfirm],
  );
  const runCancel = useCallback(
    (messageId: string, actionId: string, aloud: boolean) => {
      patchConfirm(messageId, { status: "cancelled" });
      void cancelAssistantAction(actionId).catch(() => {});
      // if (aloud || speakOn) speak("Cancelled.");
      if (aloud) speak("Cancelled.");
    },
    [patchConfirm],
  );

  const ask = useCallback(
    async (text: string, meta?: { voice: boolean }) => {
      const clean = text.trim();
      if (!clean || busy) return;
      // const aloud = Boolean(meta?.voice) || speakOn;
      // Spoken reply only when the Pro used the mic (and voice replies aren't muted).
      const aloud = Boolean(meta?.voice) && speakOn;
      // "Yes" / "cancel" answers the Confirm card that is waiting (voice-friendly).
      const waiting = [...messages].reverse().find((m) => m.role === "assistant" && !m.pending);
      if (waiting?.action?.type === "confirm" && waiting.action.status === "pending" && clean.split(/\s+/).length <= 5) {
        if (YES.test(clean)) {
          setMessages((prev) => [...prev, { id: `u-${newId()}`, role: "user", text: clean, at: Date.now() }]);
          return runConfirm(waiting.id, waiting.action.actionId, aloud);
        }
        if (NO.test(clean)) {
          setMessages((prev) => [...prev, { id: `u-${newId()}`, role: "user", text: clean, at: Date.now() }]);
          return runCancel(waiting.id, waiting.action.actionId, aloud);
        }
      }
      const id = newId();
      pendingIdRef.current = id;
      const history = messages
        .filter((m) => m.id !== "welcome" && !m.error && m.text)
        .slice(-6)
        .map((m) => ({ role: m.role, text: m.text }));
      setMessages((prev) => [
        ...prev.map((m) => ({ ...m, suggestions: undefined })),
        { id: `u-${id}`, role: "user", text: clean, at: Date.now() },
        { id: `a-${id}`, role: "assistant", text: "", pending: true, at: Date.now() },
      ]);
      setBusy(true);
      try {
        const reply: PaReply = await send(id, clean, history, conversationId);
        if (reply.conversationId) setConversationId(reply.conversationId);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === `a-${id}`
              ? { ...m, text: reply.replyText, action: reply.action, suggestions: reply.suggestions, pending: false }
              : m,
          ),
        );
        if (aloud) speak(reply.replyText);
        // Previous: if (reply.action?.type === "navigate") go(reply.action.href);
        if (reply.action?.type === "navigate" && !reply.action.manual) go(reply.action.href);
        if (reply.action?.type === "info" && reply.action.autoOpen && reply.action.href) go(reply.action.href);
      } catch (error) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === `a-${id}`
              ? { ...m, text: error instanceof Error ? error.message : "Something went wrong. Please try again.", pending: false, error: true }
              : m,
          ),
        );
      } finally {
        pendingIdRef.current = null;
        setBusy(false);
      }
    },
    [busy, conversationId, go, messages, send, speakOn, runConfirm, runCancel],
  );

  if (!mounted || !isPro) return null;

  const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");

  return createPortal(
    <>
      {/* Launcher — draggable like the customer RS AI launcher; snaps to the nearest side and remembers it. */}
      {/* Previous: floating, draggable launcher over the page (covered form buttons / pagination).
          The co-pilot now opens from the Co-pilot button in the top bar (portal-shell.tsx).
      <ProAssistantLauncher open={open} onOpen={openPanel} /> */}
      {/* Previous entry point: slim tab on the right edge.
      <ProAssistantEdgeTab open={open} onOpen={openPanel} /> */}
      {/* Entry point: draggable floating bubble with smart collision (moves up off buttons /
          pagination, hides behind dialogs, remembers where the Pro put it). */}
      <ProAssistantBubble open={open} onOpen={openPanel} />
      {/* Previous (fixed bottom-right, not movable):
      <button
        type="button"
        onClick={openPanel}
        aria-label="Open Pro co-pilot"
        aria-haspopup="dialog"
        title="Pro co-pilot (Ctrl+J)"
        className={cn(
          "group fixed right-4 bottom-4 z-40 flex h-12 items-center gap-2 rounded-full bg-linear-to-br from-primary via-primary to-primary/80 py-1 pr-4 pl-1 text-primary-foreground shadow-lg ring-1 shadow-primary/30 ring-white/15 transition-[transform,box-shadow,opacity] duration-300 hover:-translate-y-0.5 hover:shadow-xl print:hidden sm:right-5 sm:bottom-5",
          open && "pointer-events-none scale-90 opacity-0",
        )}
      >
        <span className="relative flex size-10 items-center justify-center rounded-full bg-white/12 ring-1 ring-white/20">
          <Wand2 className="size-[18px]" aria-hidden />
          <span aria-hidden className="absolute -top-0.5 -left-0.5 size-3 rounded-full border-2 border-primary bg-emerald-400" />
        </span>
        <span className="flex flex-col text-left leading-tight">
          <span className="text-sm font-bold">Pro Co-pilot</span>
          <span className="hidden text-[11px] font-medium text-primary-foreground/80 sm:block">Ask · navigate · estimate</span>
        </span>
      </button>
      */}

      {open && expanded ? (
        <button
          type="button"
          aria-label="Restore co-pilot to small window"
          onClick={() => setExpanded(false)}
          className="pa-backdrop fixed inset-0 z-[60] hidden cursor-default bg-slate-950/40 backdrop-blur-[3px] sm:block"
        />
      ) : null}

      {open ? (
        <section
          role="dialog"
          aria-label="Pro co-pilot"
          data-expanded={expanded ? "true" : "false"}
          data-state="opening"
          className="pa-panel flex flex-col overflow-hidden bg-popover text-popover-foreground sm:rounded-2xl sm:border sm:shadow-2xl sm:shadow-black/25"
        >
          <header className="flex items-center gap-2.5 border-b bg-linear-to-b from-primary/[0.07] to-transparent px-3 py-2.5">
            <div className="relative">
              <Avatar className="size-9" />
              <span className="absolute -right-0.5 -bottom-0.5 size-3 rounded-full border-2 border-popover bg-emerald-500" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm leading-tight font-semibold">Pro Co-pilot</p>
              <p className="flex items-center gap-1.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                <span className="size-1.5 rounded-full bg-emerald-500" />
                Online · operations manager
              </p>
            </div>
            <div className="flex items-center gap-0.5">
              <HeaderButton
                // label={speakOn ? "Stop reading replies aloud" : "Read replies aloud"}
                label={speakOn ? "Mute voice replies (mic messages)" : "Unmute voice replies (mic messages)"}
                onClick={() => setSpeakOn((v) => !v)}
                active={speakOn}
              >
                {speakOn ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}
              </HeaderButton>
              <HeaderButton label="New conversation" onClick={startNew}>
                <RotateCcw className="size-4" />
              </HeaderButton>
              <HeaderButton label="Conversation history" onClick={() => setHistoryOpen((v) => !v)} active={historyOpen}>
                <History className="size-4" />
              </HeaderButton>
              <HeaderButton
                label={expanded ? "Restore to small window" : "Expand"}
                onClick={() => setExpanded((v) => !v)}
                active={expanded}
                className="hidden sm:flex"
              >
                {expanded ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
              </HeaderButton>
              {/* Minimize: hide to the launcher; the chat, size and any open history stay as they are. */}
              <HeaderButton label="Minimize" onClick={() => setOpen(false)}>
                <Minus className="size-4" />
              </HeaderButton>
              <HeaderButton label="Close" onClick={closePanel}>
                <X className="size-4" />
              </HeaderButton>
            </div>
          </header>

          <div className="relative flex min-h-0 flex-1 flex-col">
          {historyOpen ? (
            <ProAssistantHistory
              activeId={conversationId}
              onOpen={(id) => void openConversation(id)}
              onNew={startNew}
              onClose={() => setHistoryOpen(false)}
              onDeleted={(id) => {
                if (id === conversationId) {
                  setMessages([welcome()]);
                  setConversationId(null);
                }
              }}
            />
          ) : null}
          {loadingConversation ? (
            <div className="absolute inset-0 z-40 flex items-center justify-center bg-popover/70">
              <Loader2 className="size-5 animate-spin text-primary" />
            </div>
          ) : null}
          <div ref={listRef} className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-3 py-3" aria-live="polite">
            <div className={cn("mx-auto flex w-full flex-col gap-3", expanded && "max-w-3xl")}>
              {messages.map((m) =>
                m.role === "user" ? (
                  <div key={m.id} className="flex justify-end">
                    <p className="max-w-[85%] rounded-2xl rounded-br-md bg-primary px-3.5 py-2 text-sm whitespace-pre-wrap text-primary-foreground shadow-sm">
                      {m.text}
                    </p>
                  </div>
                ) : (
                  <div key={m.id} className="flex items-start gap-2">
                    <Avatar className="mt-0.5 size-7" />
                    <div className="flex min-w-0 flex-1 flex-col gap-2">
                      {m.pending && !m.text ? (
                        <div className="flex w-fit items-center gap-1 rounded-2xl rounded-tl-md border bg-card px-3.5 py-3 shadow-sm" role="status" aria-label="Co-pilot is working">
                          {[0, 1, 2].map((i) => (
                            <span key={i} className="size-1.5 animate-bounce rounded-full bg-muted-foreground/70" style={{ animationDelay: `${i * 120}ms` }} />
                          ))}
                        </div>
                      ) : (
                        <p
                          className={cn(
                            "w-fit max-w-[92%] rounded-2xl rounded-tl-md border bg-card px-3.5 py-2 text-sm whitespace-pre-wrap shadow-sm",
                            m.error && "border-rose-200 bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300",
                          )}
                        >
                          {m.text}
                        </p>
                      )}

                      {m.action?.type === "navigate" ? (
                        <button
                          type="button"
                          onClick={() => go(m.action && m.action.type === "navigate" ? m.action.href : "")}
                          className="inline-flex w-fit items-center gap-1.5 rounded-full border border-primary/30 bg-primary/5 px-3 py-1 text-xs font-semibold text-primary transition hover:bg-primary/10"
                        >
                          {m.action.label}
                          <ArrowUpRight className="size-3.5" aria-hidden />
                        </button>
                      ) : null}

                      {m.action?.type === "choices" ? (
                        <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
                          {m.action.items.map((item) => (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => go(item.href)}
                              className="flex w-full items-center justify-between gap-2 border-b px-3 py-2 text-left last:border-b-0 hover:bg-muted"
                            >
                              <span className="min-w-0">
                                <span className="block truncate text-sm font-medium">{item.title}</span>
                                {item.subtitle ? <span className="block truncate text-xs text-muted-foreground">{item.subtitle}</span> : null}
                              </span>
                              <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                            </button>
                          ))}
                        </div>
                      ) : null}

                      {m.action?.type === "list" ? <ListCard action={m.action} onOpen={go} /> : null}
                      {m.action?.type === "info" ? <InfoCard action={m.action} onOpen={go} /> : null}
                      {m.action?.type === "confirm" ? (
                        <ConfirmCard
                          action={m.action}
                          onOpen={go}
                          onConfirm={() => m.action?.type === "confirm" && void runConfirm(m.id, m.action.actionId, false)}
                          onCancel={() => m.action?.type === "confirm" && runCancel(m.id, m.action.actionId, false)}
                        />
                      ) : null}

                      {m.action?.type === "estimate_draft" ? (
                        <EstimateDraftCard
                          draft={m.action.draft}
                          created={m.created}
                          conversationId={conversationId}
                          messageId={m.id}
                          onCreated={(result) => {
                            setMessages((prev) => prev.map((x) => (x.id === m.id ? { ...x, created: result } : x)));
                            go(result.href);
                          }}
                        />
                      ) : null}

                      {m === lastAssistant && m.id === "welcome" && !busy ? (
                        // Welcome: operational chips + one estimate chip per category (first 4, then "+N more").
                        <div className="flex flex-wrap gap-1.5">
                          {[
                            ...OPS_STARTERS,
                            ...(showAllEstimateStarters || estimateStarters.length <= ESTIMATE_CHIPS_VISIBLE
                              ? estimateStarters
                              : estimateStarters.slice(0, ESTIMATE_CHIPS_VISIBLE - 1)),
                          ].map((s) => (
                            <button
                              key={s}
                              type="button"
                              onClick={() => void ask(s)}
                              className="rounded-full border bg-background px-2.5 py-1 text-xs font-medium text-foreground/80 transition hover:border-primary/40 hover:bg-primary/5 hover:text-primary"
                            >
                              {s}
                            </button>
                          ))}
                          {estimateStarters.length > ESTIMATE_CHIPS_VISIBLE ? (
                            <button
                              type="button"
                              onClick={() => setShowAllEstimateStarters((v) => !v)}
                              aria-expanded={showAllEstimateStarters}
                              className="rounded-full border border-dashed bg-background px-2.5 py-1 text-xs font-medium text-muted-foreground transition hover:border-primary/40 hover:bg-primary/5 hover:text-primary"
                            >
                              {showAllEstimateStarters ? "Show less" : `+${estimateStarters.length - (ESTIMATE_CHIPS_VISIBLE - 1)} more`}
                            </button>
                          ) : null}
                        </div>
                      ) : m === lastAssistant && m.suggestions?.length && !busy ? (
                        <div className="flex flex-wrap gap-1.5">
                          {m.suggestions.map((s) => (
                            <button
                              key={s}
                              type="button"
                              onClick={() => (s.includes("…") ? undefined : void ask(s))}
                              className={cn(
                                "rounded-full border bg-background px-2.5 py-1 text-xs font-medium text-foreground/80 transition hover:border-primary/40 hover:bg-primary/5 hover:text-primary",
                                s.includes("…") && "cursor-default opacity-70",
                              )}
                              title={s.includes("…") ? "Type the number, e.g. INV-874" : undefined}
                            >
                              {s}
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </div>
                ),
              )}
            </div>
          </div>

          <div className={cn(expanded && "sm:px-[max(0px,calc((100%-48rem)/2))]")}>
            <ProAssistantInput onSend={(text, meta) => void ask(text, meta)} onListenStart={stopSpeaking} disabled={busy} autoFocus={open} />
          </div>
          </div>
        </section>
      ) : null}
    </>,
    document.body,
  );
}

