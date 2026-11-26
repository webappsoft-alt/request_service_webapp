"use client";

import "./pro-assistant.css";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { ArrowUpRight, ChevronRight, FileClock, FileText, Receipt, TrendingUp, UserCheck, History, Loader2, Maximize2, Minimize2, Minus, PanelLeftOpen, RotateCcw, Search, SquarePen, Volume2, VolumeX, Wand2, X } from "lucide-react";
import { extractErrorMessage } from "@/components/api/extractErrorMessage";
import { ConfirmCard, InfoCard, ListCard } from "./action-cards";
import { cn } from "@/lib/utils";
import { useAppSelector } from "@/store/hooks";
import { selectAuthProvider, selectAuthToken, selectAuthUser } from "@/store/authSlice";
import { getServiceCategoryById } from "@/lib/data/services";
import { EstimateDraftCard } from "./estimate-draft-card";
import { ProAssistantHistory } from "./history-panel";
import { ProAssistantEstimateHistory } from "./estimate-history-panel";
import { ProAssistantInput } from "./pro-assistant-input";
import { PRO_ASSISTANT_TOGGLE_EVENT } from "./pro-assistant-launcher";
// import { ProAssistantEdgeTab } from "./pro-assistant-launcher"; — right-edge tab, replaced by the bubble
import { ProAssistantBubble } from "./pro-assistant-bubble";
// import { ProAssistantLauncher } from "./pro-assistant-launcher"; — floating launcher, replaced by the header button
import {
  cancelAssistantAction,
  confirmAssistantAction,
  getAssistantConversation,
  listAssistantConversations,
  getAssistantDraft,
  isSafePortalHref,
  type PaAction,
  type PaMessage,
  type PaReply,
} from "./pro-assistant-api";
import { useProAssistantSocket } from "./use-pro-assistant-socket";
import { QuickReplies, SiteScopeCard } from "./site-scope-card";
import type { PaCreatedEstimate, PaCustomerOption, PaQuickReply, PaVisionAction } from "./pro-assistant-api";

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
  // Expanded empty state (client): up to 3 "Draft a … estimate" cards from the Pro's categories, then
  // the operations prompts — 6 cards. Each sends the same message as the matching chip.
  const heroPrompts = useMemo(() => {
    const estimates = estimateStarters.slice(0, 3).map((send) => {
      const name = send.match(/^Create an estimate for (.+)$/)?.[1];
      // "an" before a vowel sound: Electrical, HVAC (aitch-vac).
      const article = name && (/^[aeiou]/i.test(name) || /^[FHLMNRSX][A-Z]/.test(name)) ? "an" : "a";
      return { send, label: name ? `Draft ${article} ${name} estimate` : "Draft a new estimate", hint: "Estimate", icon: "estimate" as const };
    });
    const ops = OPS_STARTERS.map((send) => ({
      send,
      label: send,
      hint: /invoice/i.test(send) ? "Money" : /job|tech/i.test(send) ? "Team" : "Insights",
      icon: (/invoice/i.test(send) ? "money" : /job|tech/i.test(send) ? "team" : "insights") as "money" | "team" | "insights",
    }));
    return [...estimates, ...ops].slice(0, 6);
  }, [estimateStarters]);

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
  // Expanded window: Claude-style conversation sidebar on the left (collapsible).
  const [sidebarOpen, setSidebarOpen] = useState(true);
  // Rail "Search" → open the sidebar and focus its search box.
  const [focusSearchKey, setFocusSearchKey] = useState(0);
  // Small window: the history button only once the Pro has saved chats (null = not checked yet).
  const [hasHistory, setHasHistory] = useState<boolean | null>(null);
  // AI estimate history (Save Draft + drafts generated in chats).
  const [estimateHistoryOpen, setEstimateHistoryOpen] = useState(false);
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
    setEstimateHistoryOpen(false);
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

  useEffect(() => {
    if (!everOpened || !isPro || hasHistory !== null) return;
    let cancelled = false;
    listAssistantConversations("")
      .then((list) => {
        if (!cancelled) setHasHistory(list.length > 0);
      })
      .catch(() => {
        if (!cancelled) setHasHistory(true); // unknown → keep the button
      });
    return () => {
      cancelled = true;
    };
  }, [everOpened, isPro, hasHistory]);
  // A chat saved in this session counts as history too.
  const showHistory = hasHistory === true || Boolean(conversationId);
  // Only the greeting so far (new / empty conversation).
  const emptyChat = messages.length === 0 || (messages.length === 1 && messages[0].id === "welcome");

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
      setEstimateHistoryOpen(false);
    } catch {
      /* stays on the history list */
    } finally {
      setLoadingConversation(false);
    }
  }, []);

  /**
   * AI estimate history → a saved draft reopens at the end of this chat as an editable card
   * (customer, property, category, ALL CAPS sections, lines, units, prices and photos as saved).
   */
  const openSavedDraft = useCallback(async (id: string) => {
    setLoadingConversation(true);
    try {
      const saved = await getAssistantDraft(id);
      const message: PaMessage = {
        id: `d-${saved.id}-${Date.now()}`,
        role: "assistant",
        text: saved.created
          ? `Your saved draft “${saved.title}” — the estimate was already created from it.`
          : `Here's your saved draft “${saved.title}”. Edit it, tap Save Draft again, or create the estimate.`,
        action: {
          type: "estimate_draft",
          draft: {
            title: saved.title,
            customerName: saved.customerName || null,
            customer: saved.customer,
            customerCandidates: [],
            items: saved.items,
            subtotal: saved.total,
            notes: saved.notes,
            pricing: saved.pricing ?? null,
            savedDraftId: saved.id,
            savedAt: saved.at,
            categoryName: saved.categoryName,
            subcategoryName: saved.subcategoryName,
            addressId: saved.addressId,
          },
        },
        created: saved.created,
        at: Date.now(),
      };
      setMessages((prev) => [...prev, message]);
      setEstimateHistoryOpen(false);
    } catch (error) {
      toast.error(extractErrorMessage(error) || "Could not open that draft.");
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

  // Site-photo loop: the "Upload more photos" chip opens the picker and marks the next photos as
  // more angles of the same job; "No, it's something else" prefills the box.
  const [photoRequest, setPhotoRequest] = useState(0);
  /** Customer picked on a draft card, by draft title (carried to its updated versions). */
  const [draftCustomers, setDraftCustomers] = useState<Record<string, PaCustomerOption | null>>({});
  const [morePhotos, setMorePhotos] = useState(false);
  const [prefill, setPrefill] = useState<{ text: string; nonce: number } | null>(null);

  const ask = useCallback(
    async (
      text: string,
      meta?: { voice?: boolean; images?: string[]; visionAction?: PaVisionAction | null; display?: string },
    ) => {
      const clean = text.trim();
      const images = meta?.images?.length ? meta.images : [];
      // Previous: if (!clean || busy) return; — photos or a clicked chip can come without text.
      if ((!clean && !images.length && !meta?.visionAction) || busy) return;
      // Photos sent after "Upload more photos" are more angles of the open job.
      const visionAction: PaVisionAction | null =
        meta?.visionAction || (images.length && morePhotos ? { kind: "more_photos" } : null);
      if (images.length) setMorePhotos(false);
      // const aloud = Boolean(meta?.voice) || speakOn;
      // Spoken reply only when the Pro used the mic (and voice replies aren't muted).
      const aloud = Boolean(meta?.voice) && speakOn;
      // "Yes" / "cancel" answers the Confirm card that is waiting (voice-friendly).
      const waiting = [...messages].reverse().find((m) => m.role === "assistant" && !m.pending);
      if (!images.length && !visionAction && waiting?.action?.type === "confirm" && waiting.action.status === "pending" && clean.split(/\s+/).length <= 5) {
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
        ...prev.map((m) => ({ ...m, suggestions: undefined, quickReplies: undefined })),
        { id: `u-${id}`, role: "user", text: meta?.display || clean, ...(images.length ? { images } : {}), at: Date.now() },
        { id: `a-${id}`, role: "assistant", text: "", pending: true, at: Date.now() },
      ]);
      setBusy(true);
      try {
        const reply: PaReply = await send(id, clean, history, conversationId, { images, visionAction });
        if (reply.conversationId) setConversationId(reply.conversationId);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === `a-${id}`
              ? { ...m, text: reply.replyText, action: reply.action, suggestions: reply.suggestions, quickReplies: reply.quickReplies, pending: false }
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
    [busy, conversationId, go, messages, send, speakOn, runConfirm, runCancel, morePhotos],
  );

  /** A clicked scope chip → the structured action (the label shows as the Pro's message). */
  const pickQuickReply = useCallback(
    (item: PaQuickReply) => {
      if (item.kind === "upload_more") {
        setMorePhotos(true);
        setPhotoRequest((n) => n + 1);
        return;
      }
      if (item.kind === "reject") {
        void ask("", { visionAction: { kind: "reject" }, display: item.label });
        setPrefill({ text: "It's a ", nonce: Date.now() });
        return;
      }
      // One-tap scope / tier chips ("+ Haul-away & disposal", "Budget option") → the instruction.
      if (item.kind === "revise" && item.value) {
        void ask("", { visionAction: { kind: "revise", value: item.value }, display: item.label });
        return;
      }
      const kind = item.kind === "use_ai_dimensions" ? "use_ai" : item.kind === "confirm" ? "confirm" : item.kind === "draft" ? "draft" : null;
      if (kind) void ask("", { visionAction: { kind }, display: item.label });
    },
    [ask],
  );

  if (!mounted || !isPro) return null;

  const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");
  // Drafts revised in chat keep their title: an uncreated draft with a later same-title draft is superseded.
  const supersededDrafts = new Set<string>();
  const laterTitles = new Set<string>();
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const m = messages[i];
    if (m.action?.type !== "estimate_draft") continue;
    const key = m.action.draft.title.trim().toLowerCase();
    if (laterTitles.has(key) && !m.created) supersededDrafts.add(m.id);
    laterTitles.add(key);
  }

  // A revised draft (Budget option, + Permit allowance, a chat change…) keeps its title: link it to
  // the estimate created / updated from the latest earlier version, so it updates that one.
  const linkedDrafts = new Map<string, PaCreatedEstimate>();
  const createdByTitle = new Map<string, PaCreatedEstimate>();
  for (const m of messages) {
    if (m.action?.type !== "estimate_draft") continue;
    const key = m.action.draft.title.trim().toLowerCase();
    if (m.created) createdByTitle.set(key, m.created);
    else if (createdByTitle.has(key)) linkedDrafts.set(m.id, createdByTitle.get(key)!);
  }

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
              {/* Expanded: "New conversation" lives in the sidebar / its collapsed rail (on phones the
                  rail is hidden, so the header keeps it there). */}
              <HeaderButton label="New conversation" onClick={startNew} className={expanded ? "sm:hidden" : undefined}>
                <RotateCcw className="size-4" />
              </HeaderButton>
              {expanded ? null : showHistory ? (
                // Small window: history popover — only once there are saved chats (client: no clutter
                // on the first visit).
                <HeaderButton
                  label="Conversation history"
                  onClick={() => {
                    setEstimateHistoryOpen(false);
                    setHistoryOpen((v) => !v);
                  }}
                  active={historyOpen}
                >
                  <History className="size-4" />
                </HeaderButton>
              ) : null}
              <HeaderButton
                label="AI estimate history"
                onClick={() => {
                  setHistoryOpen(false);
                  setEstimateHistoryOpen((v) => !v);
                }}
                active={estimateHistoryOpen}
              >
                <FileClock className="size-4" />
              </HeaderButton>
              <HeaderButton
                label={expanded ? "Restore to small window" : "Expand"}
                onClick={() => {
                  // The sidebar replaces the history popover in the expanded window.
                  setHistoryOpen(false);
                  setExpanded((v) => !v);
                }}
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

          <div className="flex min-h-0 flex-1">
          {expanded ? (
          // One tinted left pane (client): 270px sidebar ⇄ 48px icon rail, width animates.
          <div
            className={cn(
              "hidden shrink-0 overflow-hidden border-r border-slate-200/80 bg-slate-50/80 transition-[width] duration-300 ease-out sm:flex dark:border-white/10 dark:bg-slate-900/60",
              sidebarOpen ? "w-[270px]" : "w-12",
            )}
          >
          {!sidebarOpen ? (
            // Collapsed sidebar → slim icon rail (client: Gemini-style), so it is clear how to reopen it.
            <nav aria-label="Conversation rail" className="flex w-12 shrink-0 flex-col items-center gap-1 py-2.5 animate-in fade-in-0 duration-300">
              <HeaderButton label="Expand sidebar" onClick={() => setSidebarOpen(true)}>
                <PanelLeftOpen className="size-4" />
              </HeaderButton>
              <HeaderButton label="New conversation" onClick={startNew}>
                <SquarePen className="size-4" />
              </HeaderButton>
              <HeaderButton
                label="Search conversations"
                onClick={() => {
                  setSidebarOpen(true);
                  setFocusSearchKey((k) => k + 1);
                }}
              >
                <Search className="size-4" />
              </HeaderButton>
            </nav>
          ) : (
              <ProAssistantHistory
                variant="sidebar"
                focusSearchKey={focusSearchKey}
                activeId={conversationId}
                refreshKey={conversationId}
                onOpen={(id) => void openConversation(id)}
                onNew={startNew}
                onClose={() => setSidebarOpen(false)}
                onDeleted={(id) => {
                  if (id === conversationId) {
                    setMessages([welcome()]);
                    setConversationId(null);
                  }
                }}
              />
          )}
          </div>
          ) : null}
          <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
          {historyOpen && !expanded ? (
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
          {estimateHistoryOpen ? (
            <ProAssistantEstimateHistory
              onOpenSaved={(id) => void openSavedDraft(id)}
              onOpenChat={(id) => void openConversation(id)}
              onClose={() => setEstimateHistoryOpen(false)}
            />
          ) : null}
          {loadingConversation ? (
            <div className="absolute inset-0 z-40 flex items-center justify-center bg-popover/70">
              <Loader2 className="size-5 animate-spin text-primary" />
            </div>
          ) : null}
          <div
            ref={listRef}
            // Expanded: scrollbar space on both sides so the centered column lines up with the composer.
            className={cn("flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-3 py-3", expanded && "[scrollbar-gutter:stable_both-edges]")}
            aria-live="polite"
          >
            {expanded && emptyChat ? (
              // Expanded, nothing asked yet (client): centered welcome + starter cards instead of the
              // greeting pinned top-left.
              <div className="m-auto flex w-full max-w-3xl flex-col items-center gap-6 px-2 py-8 text-center animate-in fade-in-0 duration-300">
                <span className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 ring-1 ring-primary/15">
                  <Avatar className="size-10" />
                </span>
                <div className="flex flex-col gap-2">
                  <h2 className="text-2xl font-semibold tracking-tight text-foreground">How can I help run your business today?</h2>
                  <p className="mx-auto max-w-xl text-sm text-muted-foreground">
                    Ask about your numbers, team and schedule — or describe a job and I&apos;ll draft the estimate. I always ask before
                    changing anything.
                  </p>
                </div>
                <div className="grid w-full gap-2.5 sm:grid-cols-2 lg:grid-cols-3" role="list" aria-label="Starter prompts">
                  {heroPrompts.map((prompt) => {
                    const Icon = prompt.icon === "estimate" ? FileText : prompt.icon === "money" ? Receipt : prompt.icon === "team" ? UserCheck : TrendingUp;
                    return (
                      <button
                        key={prompt.send}
                        type="button"
                        role="listitem"
                        disabled={busy}
                        onClick={() => void ask(prompt.send)}
                        className="group flex min-h-[4.5rem] items-start gap-3 rounded-xl border bg-card p-3.5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md disabled:opacity-60"
                      >
                        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary transition group-hover:bg-primary group-hover:text-primary-foreground">
                          <Icon className="size-4" aria-hidden />
                        </span>
                        <span className="min-w-0">
                          <span className="block text-sm font-medium text-foreground">{prompt.label}</span>
                          <span className="mt-0.5 block text-[11px] text-muted-foreground">{prompt.hint}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
            // Previous: max-w-7xl, then max-w-4xl (too much empty space left / right) — max-w-6xl now (client).
            <div className={cn("mx-auto flex w-full flex-col gap-3", expanded && "max-w-6xl")}>
              {messages.map((m) =>
                m.role === "user" ? (
                  <div key={m.id} className="flex flex-col items-end gap-1.5">
                    {m.images?.length ? (
                      <div className={cn("grid max-w-[85%] gap-1", m.images.length === 1 ? "grid-cols-1" : "grid-cols-3")}>
                        {m.images.map((src) => (
                          <a key={src} href={src} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-xl border shadow-sm">
                            {/* eslint-disable-next-line @next/next/no-img-element -- the Pro's site photo (our storage) */}
                            <img
                              src={src}
                              alt="Site photo"
                              loading="lazy"
                              className={cn(
                                "object-cover",
                                m.images && m.images.length === 1
                                  ? expanded
                                    ? "max-h-80 w-[28rem]"
                                    : "max-h-44 w-56"
                                  : expanded
                                    ? "size-32"
                                    : "size-18",
                              )}
                            />
                          </a>
                        ))}
                      </div>
                    ) : null}
                    {m.text ? (
                      <p className="max-w-[85%] rounded-2xl rounded-br-md bg-primary px-3.5 py-2 text-sm whitespace-pre-wrap text-primary-foreground shadow-sm">
                        {m.text}
                      </p>
                    ) : null}
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

                      {m.action?.type === "estimate_draft" && supersededDrafts.has(m.id) ? (
                        // An older version of a draft that was changed in chat: only the latest
                        // can be created, so the same job can't be saved twice.
                        <p className="w-fit rounded-lg border border-dashed px-3 py-1.5 text-xs text-muted-foreground">
                          Earlier version of “{m.action.draft.title}” — replaced by the updated draft below.
                        </p>
                      ) : m.action?.type === "estimate_draft" ? (
                        <EstimateDraftCard
                          draft={m.action.draft}
                          created={m.created}
                          linkedEstimate={linkedDrafts.get(m.id) || null}
                          conversationId={conversationId}
                          messageId={m.id}
                          // Keep the customer picked on the card across chat edits (same draft title).
                          initialCustomer={draftCustomers[m.action.draft.title.trim().toLowerCase()] || null}
                          onCustomerChange={(c) => {
                            const key = m.action?.type === "estimate_draft" ? m.action.draft.title.trim().toLowerCase() : "";
                            if (key) setDraftCustomers((prev) => ({ ...prev, [key]: c }));
                          }}
                          onDraftSaved={(saved) =>
                            // Keep the saved draft's id on this message (next Save Draft updates the same draft).
                            setMessages((prev) =>
                              prev.map((x) =>
                                x.id === m.id && x.action?.type === "estimate_draft"
                                  ? { ...x, action: { ...x.action, draft: { ...x.action.draft, savedDraftId: saved.id, savedAt: saved.at } } }
                                  : x,
                              ),
                            )
                          }
                          onCreated={(result) => {
                            setMessages((prev) => prev.map((x) => (x.id === m.id ? { ...x, created: result } : x)));
                            // Updated in place → stay in the chat ("Estimate … updated" · Open on the card).
                            if (result.mode !== "updated") go(result.href);
                          }}
                        />
                      ) : null}

                      {m.action?.type === "site_scope" ? <SiteScopeCard scope={m.action} /> : null}

                      {m === lastAssistant && m.quickReplies?.length && !busy ? (
                        <QuickReplies
                          items={m.quickReplies}
                          onPick={pickQuickReply}
                          onDimensions={(value) =>
                            void ask("", { visionAction: { kind: "dimensions", value }, display: `Dimensions: ${value}` })
                          }
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
                              className="rounded-full border bg-background px-2.5 py-1 text-xs font-medium text-foreground/80 transition hover:border-primary/40 hover:bg-primary/5 hover:text-primary max-sm:min-h-9 max-sm:px-3"
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
                                "rounded-full border bg-background px-2.5 py-1 text-xs font-medium text-foreground/80 transition hover:border-primary/40 hover:bg-primary/5 hover:text-primary max-sm:min-h-9 max-sm:px-3",
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
            )}
          </div>

          {/* Previous: sm:px-[max(0px,calc((100%-80rem)/2))], then max-w-4xl — composer matches the 6xl chat column. */}
          <div className={cn(expanded && "mx-auto w-full max-w-6xl")}>
            <ProAssistantInput
              onSend={(text, meta) => void ask(text, meta)}
              onListenStart={stopSpeaking}
              disabled={busy}
              autoFocus={open}
              photoRequest={photoRequest}
              photoHint={morePhotos ? "Add 2–3 more photos of the same area from other angles, then send." : null}
              onCancelPhotoHint={() => setMorePhotos(false)}
              prefill={prefill}
            />
          </div>
          </div>
          </div>
        </section>
      ) : null}
    </>,
    document.body,
  );
}

