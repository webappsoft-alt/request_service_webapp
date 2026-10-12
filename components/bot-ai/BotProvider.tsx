"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { useCustomerLoginDialog } from "@/components/auth/customer-login-dialog";
import { deleteData, getData, postData } from "@/components/api/apiFuntions";
import type { PlaceAddress } from "@/lib/google-places";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  selectAuth,
  selectAuthToken,
  selectAuthUser,
  selectIsAuthenticated,
  type AuthUser,
} from "@/store/authSlice";
import {
  locationDisplayLabel,
  locationFromPlace,
  setLocationFromPlace,
  type CustomerLocation,
} from "@/store/locationSlice";
import { useBotSocket, type BotSocketAction, type BotSocketLocation } from "./hooks/useBotSocket";
import { WELCOME_MESSAGE } from "./systemPromptGuide";
import type {
  BotConversationContext,
  BotHandoff,
  BotMessage,
  BotPath,
  BotProviderCard,
  BotQuoteDraft,
  BotQuoteSuccess,
  BotSearchSuggestion,
  BotServerMessage,
  BotServerReply,
  BotServiceCard,
  BotSessionSummary,
} from "./types";

export type BotServiceAction = "book" | "quote";

type PendingAction =
  | { kind: "service"; service: BotServiceCard }
  | { kind: "quote"; draft: BotQuoteDraft };

type BotContextValue = {
  open: boolean;
  hasUnread: boolean;
  typing: boolean;
  connected: boolean;
  messages: BotMessage[];
  context: BotConversationContext;
  sessions: BotSessionSummary[];
  activeSessionId: string;
  isAuthenticated: boolean;
  locationLabel: string;
  openBot: () => void;
  openWithQuery: (text: string) => void;
  /** Hero search: open with the picked service already identified. */
  openWithSuggestion: (query: string, suggestion: BotSearchSuggestion) => void;
  /** 3-way choice: browse pros, fixed-price services, or a custom quotation. */
  choosePath: (path: BotPath) => void;
  minimize: () => void;
  close: () => void;
  reset: () => void;
  sendText: (text: string) => void;
  selectProvider: (provider: BotProviderCard) => void;
  requestService: (service: BotServiceCard, action: BotServiceAction) => void;
  requestQuote: (handoff: BotHandoff) => void;
  markQuoteSubmitted: (messageId: string) => void;
  reportQuoteSubmitted: (success: BotQuoteSuccess) => void;
  retryLast: () => void;
  /** Open the site login modal over the chat; `resume` re-offers the pending action. */
  signIn: (options?: { resume?: boolean }) => void;
  refreshSessions: () => void;
  restoreSession: (sessionId: string) => void;
  deleteSession: (sessionId: string) => void;
  /** In-chat address picker ("Change Address"). */
  addressEditorOpen: boolean;
  openAddressEditor: () => void;
  closeAddressEditor: () => void;
  /** Save the picked address site-wide and re-check which pros serve it. */
  applyAddress: (place: PlaceAddress) => void;
};

const BotContext = createContext<BotContextValue | null>(null);

const SESSION_KEY = "rs-bot-session";

const emptyContext: BotConversationContext = {
  step: "identifying",
  categorySlug: null,
  categoryName: null,
  subCategorySlug: null,
  subCategoryName: null,
  providerId: null,
  providerName: null,
  providerSlug: null,
};

let idCounter = 0;
function newId(prefix: string) {
  idCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${idCounter}`;
}

function newSessionId() {
  const random =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().replace(/-/g, "")
      : `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
  return `bs_${random}`;
}

function readSessionId() {
  try {
    const stored = window.localStorage.getItem(SESSION_KEY);
    if (stored && /^[A-Za-z0-9_-]{8,80}$/.test(stored)) return stored;
  } catch {
    // Storage blocked — fall through to a fresh id.
  }
  return null;
}

function writeSessionId(sessionId: string) {
  try {
    window.localStorage.setItem(SESSION_KEY, sessionId);
  } catch {
    // Non-fatal: the chat still works for this page view.
  }
}

function welcomeMessage(): BotMessage {
  return {
    id: newId("msg"),
    role: "bot",
    text: WELCOME_MESSAGE,
    createdAt: Date.now(),
  };
}

function toSocketLocation(location: CustomerLocation): BotSocketLocation {
  return {
    city: location.city || undefined,
    state: location.state || undefined,
    zip: location.zip || undefined,
    address: location.address || undefined,
    lat: location.latitude,
    lng: location.longitude,
  };
}

/** Pill / button labels that open the in-chat address picker (same as the backend's). */
export function isChangeAddressLabel(label: string) {
  return /^(change|set|update) (my )?(address|location)$/i.test(label.trim());
}

function userIdOf(user: AuthUser | null | undefined) {
  return String(user?.id ?? user?._id ?? "") || null;
}

function unwrap<T>(response: unknown): T | null {
  if (!response || typeof response !== "object") return null;
  const body = response as { data?: T };
  return (body.data ?? null) as T | null;
}

function fromServerMessage(message: BotServerMessage): BotMessage {
  const payload = message.payload || {};
  return {
    id: message.id,
    role: message.role === "assistant" ? "bot" : "user",
    text: message.text,
    createdAt: new Date(message.createdAt).getTime() || Date.now(),
    suggestions: payload.suggestedPills,
    providers: payload.providers,
    services: payload.services,
    handoff: payload.handoff ?? null,
    safety: payload.safety,
    choices: payload.choices ?? null,
    quoteBrief: payload.quoteBrief ?? null,
    quoteSuccess: payload.quoteSuccess ?? null,
  };
}

/** Labels of the 3-way choice (same as the backend's PATH_LABELS). */
export const PATH_LABELS: Record<BotPath, string> = {
  pros: "Browse Verified Pros",
  services: "Book Fixed-Price Services",
  quote: "Request Custom Quotation",
};

export function pathForLabel(label: string): BotPath | null {
  const entry = Object.entries(PATH_LABELS).find(([, value]) => value.toLowerCase() === label.trim().toLowerCase());
  return entry ? (entry[0] as BotPath) : null;
}

/** Existing booking modal: the fixed-service page opens it with ?book=1. */
export function bookServiceHref(service: BotServiceCard) {
  const category = service.categorySlug || "services";
  return service.slug ? `/services/${category}/${service.slug}?book=1` : `/services/${category}`;
}

/** Existing quote flows: provider-scoped request form, or the marketplace quote form. */
export function quoteHref(input: { providerSlug?: string | null; categorySlug?: string | null }, zip = "") {
  const params = new URLSearchParams();
  if (input.categorySlug) params.set("service", input.categorySlug);
  if (zip) params.set("zip", zip);
  if (input.providerSlug) {
    params.set("provider", input.providerSlug);
    return `/request-service?${params.toString()}`;
  }
  return `/get-a-quote?${params.toString()}`;
}

export function BotProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const auth = useAppSelector(selectAuth);
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  const token = useAppSelector(selectAuthToken);
  const user = useAppSelector(selectAuthUser);
  const location = useAppSelector((state) => state.location);
  const locationLabel = locationDisplayLabel(location);
  const loginDialog = useCustomerLoginDialog();
  const socketToken = auth.hydrated && isAuthenticated ? token?.trim() || null : null;

  const [open, setOpen] = useState(false);
  const [engaged, setEngaged] = useState(false);
  const [hasUnread, setHasUnread] = useState(false);
  const [messages, setMessages] = useState<BotMessage[]>([]);
  const [context, setContext] = useState<BotConversationContext>(emptyContext);
  const [serverTyping, setServerTyping] = useState(false);
  const [awaiting, setAwaiting] = useState<string | null>(null);
  const [sessions, setSessions] = useState<BotSessionSummary[]>([]);
  const [activeSessionId, setActiveSessionId] = useState("");
  const [addressEditorOpen, setAddressEditorOpen] = useState(false);

  const messagesRef = useRef<BotMessage[]>([]);
  const sessionIdRef = useRef("");
  const openRef = useRef(open);
  const restoredRef = useRef(false);
  const lastSendRef = useRef<{ message?: string; action?: BotSocketAction } | null>(null);
  const pendingActionRef = useRef<PendingAction | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Work to send once the socket reconnects with the new sign-in token (a message sent
  // while the old guest socket is closing would lose its reply).
  const afterReconnectRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    openRef.current = open;
  }, [open]);

  const commit = useCallback((next: BotMessage[]) => {
    messagesRef.current = next;
    setMessages(next);
  }, []);

  const pushMessage = useCallback(
    (message: BotMessage) => commit([...messagesRef.current, message]),
    [commit],
  );

  /** Replace the streaming placeholder for a turn, or append when none exists. */
  const upsertTurn = useCallback(
    (clientMessageId: string | null, message: BotMessage) => {
      const placeholderId = clientMessageId ? `reply-${clientMessageId}` : null;
      const index = placeholderId ? messagesRef.current.findIndex((item) => item.id === placeholderId) : -1;
      if (index === -1) {
        commit([...messagesRef.current, message]);
        return;
      }
      const next = [...messagesRef.current];
      // Keep the placeholder's id so the bubble (and its reveal animation) isn't remounted.
      next[index] = { ...message, id: next[index].id };
      commit(next);
    },
    [commit],
  );

  const ensureSession = useCallback(() => {
    if (sessionIdRef.current) return sessionIdRef.current;
    const sessionId = readSessionId() || newSessionId();
    writeSessionId(sessionId);
    sessionIdRef.current = sessionId;
    setActiveSessionId(sessionId);
    return sessionId;
  }, []);

  const clearAwaitTimeout = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = null;
  }, []);

  useEffect(() => clearAwaitTimeout, [clearAwaitTimeout]);

  // ---- Socket ---------------------------------------------------------------
  const socketHandlers = useMemo(
    () => ({
      onConnect: () => {
        const run = afterReconnectRef.current;
        afterReconnectRef.current = null;
        run?.();
      },
      onTyping: (typing: boolean) => setServerTyping(typing),
      onDelta: ({ clientMessageId, text }: { clientMessageId: string | null; text: string }) => {
        if (!clientMessageId) return;
        upsertTurn(clientMessageId, {
          id: `reply-${clientMessageId}`,
          role: "bot",
          text,
          createdAt: Date.now(),
          streaming: true,
          live: true,
        });
      },
      onResponse: (reply: BotServerReply) => {
        if (reply.sessionId !== sessionIdRef.current) return;
        clearAwaitTimeout();
        setAwaiting(null);
        setContext({ ...emptyContext, ...reply.context, step: reply.step });
        upsertTurn(reply.clientMessageId, {
          id: reply.messageId,
          role: "bot",
          text: reply.replyText,
          createdAt: new Date(reply.createdAt).getTime() || Date.now(),
          suggestions: reply.suggestedPills,
          providers: reply.providers,
          services: reply.services,
          handoff: reply.handoff,
          safety: reply.safety,
          choices: reply.choices ?? null,
          quoteBrief: reply.quoteBrief ?? null,
          quoteSuccess: reply.quoteSuccess ?? null,
          live: true,
        });
        if (!openRef.current) setHasUnread(true);
      },
      onError: ({ clientMessageId, code, message }: { clientMessageId: string | null; code?: string; message: string }) => {
        clearAwaitTimeout();
        setAwaiting(null);
        // Stored session belongs to another account (e.g. after sign-out): switch to a fresh one.
        const forbidden = code === "SESSION_FORBIDDEN";
        if (forbidden) {
          const sessionId = newSessionId();
          writeSessionId(sessionId);
          sessionIdRef.current = sessionId;
          setActiveSessionId(sessionId);
        }
        upsertTurn(clientMessageId, {
          id: newId("err"),
          role: "bot",
          text: forbidden
            ? "I started a new conversation for you. Please send that again."
            : message || "Something went wrong. Please try again.",
          createdAt: Date.now(),
          error: true,
        });
      },
    }),
    [clearAwaitTimeout, upsertTurn],
  );

  const { connected, sendMessage } = useBotSocket({
    token: socketToken,
    enabled: engaged,
    handlers: socketHandlers,
  });

  const emit = useCallback(
    (body: { message?: string; action?: BotSocketAction }, locationOverride?: CustomerLocation) => {
      const sessionId = ensureSession();
      const clientMessageId = newId("c");
      lastSendRef.current = body;
      setAwaiting(clientMessageId);
      clearAwaitTimeout();
      timeoutRef.current = setTimeout(() => {
        socketHandlers.onError({
          clientMessageId,
          message: "The assistant is taking too long to respond. Please try again.",
        });
      }, 45_000);
      sendMessage({
        sessionId,
        clientMessageId,
        ...body,
        userId: isAuthenticated ? userIdOf(user) : null,
        // Redux updates on the next render, so a just-picked address is passed explicitly.
        location: toSocketLocation(locationOverride ?? location),
      });
    },
    [clearAwaitTimeout, ensureSession, isAuthenticated, location, sendMessage, socketHandlers, user],
  );

  // ---- History ----------------------------------------------------------------
  const refreshSessions = useCallback(() => {
    if (!isAuthenticated) {
      setSessions([]);
      return;
    }
    void getData("bot-ai/history", undefined, { silent: true, force: true })
      .then((response) => setSessions(unwrap<BotSessionSummary[]>(response) ?? []))
      .catch(() => setSessions([]));
  }, [isAuthenticated]);

  const loadSession = useCallback(
    async (sessionId: string) => {
      try {
        const response = await getData(`bot-ai/history/${sessionId}`, undefined, { silent: true, force: true });
        const data = unwrap<{ messages: BotServerMessage[]; context: Partial<BotConversationContext> }>(response);
        if (!data?.messages?.length || sessionIdRef.current !== sessionId) return false;
        commit([welcomeMessage(), ...data.messages.map(fromServerMessage)]);
        setContext({ ...emptyContext, ...data.context });
        return true;
      } catch {
        return false;
      }
    },
    [commit],
  );

  /** First open: restore this browser's session (guest or signed in) from the server. */
  const engage = useCallback(() => {
    setEngaged(true);
    const sessionId = ensureSession();
    if (restoredRef.current) return;
    restoredRef.current = true;
    if (!messagesRef.current.length) commit([welcomeMessage()]);
    void loadSession(sessionId);
  }, [commit, ensureSession, loadSession]);

  // ---- Conversation -------------------------------------------------------------
  const sendText = useCallback(
    (text: string) => {
      const value = text.trim();
      if (!value) return;
      engage();
      pushMessage({ id: newId("msg"), role: "user", text: value, createdAt: Date.now() });
      emit({ message: value });
    },
    [emit, engage, pushMessage],
  );

  const selectProvider = useCallback(
    (provider: BotProviderCard) => {
      pushMessage({ id: newId("msg"), role: "user", text: `I'll go with ${provider.name}`, createdAt: Date.now() });
      emit({ action: { type: "select_provider", providerId: provider.id, providerName: provider.name } });
    },
    [emit, pushMessage],
  );

  const retryLast = useCallback(() => {
    if (lastSendRef.current) emit(lastSendRef.current);
  }, [emit]);

  const openBot = useCallback(() => {
    engage();
    setOpen(true);
    setHasUnread(false);
  }, [engage]);

  const startFresh = useCallback(() => {
    clearAwaitTimeout();
    setAwaiting(null);
    setServerTyping(false);
    const sessionId = newSessionId();
    writeSessionId(sessionId);
    sessionIdRef.current = sessionId;
    setActiveSessionId(sessionId);
    setContext(emptyContext);
    setAddressEditorOpen(false);
    pendingActionRef.current = null;
    commit([welcomeMessage()]);
  }, [clearAwaitTimeout, commit]);

  /** Hero search: every new search starts a fresh conversation (old one stays in history). */
  const beginSearchThread = useCallback(() => {
    // Also covers the first open of this page view: don't load the stored thread into it.
    restoredRef.current = true;
    startFresh();
    refreshSessions();
    openBot();
  }, [openBot, refreshSessions, startFresh]);

  const openWithQuery = useCallback(
    (text: string) => {
      beginSearchThread();
      sendText(text);
    },
    [beginSearchThread, sendText],
  );

  const openWithSuggestion = useCallback(
    (query: string, suggestion: BotSearchSuggestion) => {
      beginSearchThread();
      const text = query.trim() || suggestion.label;
      pushMessage({ id: newId("msg"), role: "user", text, createdAt: Date.now() });
      // The typed problem is stored as the customer's message (safety checks + AI brief use it).
      emit({
        message: text,
        action: {
          type: "select_service",
          categorySlug: suggestion.categorySlug,
          subCategorySlug: suggestion.subCategorySlug,
          label: suggestion.label,
        },
      });
    },
    [beginSearchThread, emit, pushMessage],
  );

  const minimize = useCallback(() => setOpen(false), []);

  const close = useCallback(() => {
    setOpen(false);
    setHasUnread(false);
    startFresh();
    refreshSessions();
  }, [refreshSessions, startFresh]);

  const reset = useCallback(() => {
    startFresh();
    refreshSessions();
  }, [refreshSessions, startFresh]);

  // ---- Hand-offs into existing flows ------------------------------------------
  const navigate = useCallback(
    (href: string, note: string) => {
      pushMessage({ id: newId("msg"), role: "bot", text: note, createdAt: Date.now() });
      setTimeout(() => {
        setOpen(false);
        router.push(href);
      }, 700);
    },
    [pushMessage, router],
  );

  // ---- Custom quotation: the AI writes the brief from the conversation (no form) ----
  const startBrief = useCallback(
    (draft: BotQuoteDraft) =>
      emit({
        action: {
          type: "quote_brief",
          providerId: draft.providerId,
          providerName: draft.providerName,
          categorySlug: draft.categorySlug,
          serviceTitle: draft.serviceTitle,
        },
      }),
    [emit],
  );

  const runAction = useCallback(
    (pending: PendingAction) => {
      if (pending.kind === "service") {
        // Booking keeps using the existing fixed-service booking modal (?book=1).
        navigate(bookServiceHref(pending.service), "Opening the booking form…");
        return;
      }
      startBrief(pending.draft);
    },
    [navigate, startBrief],
  );

  const guardAuth = useCallback(
    (pending: PendingAction, label: string, title: string, action: BotServiceAction) => {
      pushMessage({ id: newId("msg"), role: "user", text: label, createdAt: Date.now() });
      if (isAuthenticated) {
        pendingActionRef.current = null;
        runAction(pending);
        return;
      }
      pendingActionRef.current = pending;
      pushMessage({
        id: newId("msg"),
        role: "bot",
        text:
          action === "book"
            ? "Almost there! Sign in to confirm your booking — your chat and selected pro stay right here."
            : "Sign in so pros can send your itemized quote — your chat stays right here.",
        createdAt: Date.now(),
        authPrompt: { action, title },
      });
    },
    [isAuthenticated, pushMessage, runAction],
  );

  const draftFromService = useCallback(
    (service: BotServiceCard): BotQuoteDraft => ({
      providerId: service.provider?.id ?? null,
      providerSlug: service.provider?.slug ?? null,
      providerName: service.provider?.name ?? null,
      categoryId: context.categorySlug === service.categorySlug ? context.categoryId ?? null : null,
      categorySlug: service.categorySlug,
      categoryName: service.categoryName,
      subCategoryName: service.subCategoryName,
      serviceTitle: service.title,
    }),
    [context.categoryId, context.categorySlug],
  );

  const requestService = useCallback(
    (service: BotServiceCard, action: BotServiceAction) =>
      action === "book"
        ? guardAuth({ kind: "service", service }, `Book “${service.title}”`, service.title, "book")
        : guardAuth(
            { kind: "quote", draft: draftFromService(service) },
            `Get a quote for “${service.title}”`,
            service.title,
            "quote",
          ),
    [draftFromService, guardAuth],
  );

  const requestQuote = useCallback(
    (handoff: BotHandoff) =>
      guardAuth(
        {
          kind: "quote",
          draft: {
            providerId: handoff.providerId,
            providerSlug: handoff.providerSlug,
            providerName: handoff.providerName,
            categoryId: context.categoryId ?? null,
            categorySlug: handoff.categorySlug ?? context.categorySlug,
            categoryName: context.categoryName,
            subCategoryName: context.subCategoryName,
            serviceTitle: null,
          },
        },
        handoff.providerName ? `Request a quote from ${handoff.providerName}` : PATH_LABELS.quote,
        handoff.providerName ? `Quote from ${handoff.providerName}` : "Quote request",
        "quote",
      ),
    [context.categoryId, context.categoryName, context.categorySlug, context.subCategoryName, guardAuth],
  );

  const choosePath = useCallback(
    (path: BotPath) => {
      if (path === "quote") {
        requestQuote({
          type: "quote",
          providerId: context.providerId,
          providerSlug: context.providerSlug,
          providerName: context.providerName,
          categorySlug: context.categorySlug,
        });
        return;
      }
      pushMessage({ id: newId("msg"), role: "user", text: PATH_LABELS[path], createdAt: Date.now() });
      emit({ action: { type: "choose_path", path } });
    },
    [context.categorySlug, context.providerId, context.providerName, context.providerSlug, emit, pushMessage, requestQuote],
  );

  // ---- Address ------------------------------------------------------------------
  const openAddressEditor = useCallback(() => setAddressEditorOpen(true), []);
  const closeAddressEditor = useCallback(() => setAddressEditorOpen(false), []);

  const applyAddress = useCallback(
    (place: PlaceAddress) => {
      const next = locationFromPlace(place);
      // Same Redux location as the hero search and /services, so the whole site follows.
      dispatch(setLocationFromPlace(place));
      setAddressEditorOpen(false);
      const label = locationDisplayLabel(next) || place.formattedAddress;
      pushMessage({ id: newId("msg"), role: "user", text: `Changed my address to ${label}`, createdAt: Date.now() });
      emit({ action: { type: "location_changed" } }, next);
    },
    [dispatch, emit, pushMessage],
  );

  /** Collapse a sent brief so it can't be sent twice (the server flags it too). */
  const markQuoteSubmitted = useCallback(
    (messageId: string) =>
      commit(
        messagesRef.current.map((item) =>
          item.id === messageId && item.quoteBrief ? { ...item, quoteBrief: { ...item.quoteBrief, submitted: true } } : item,
        ),
      ),
    [commit],
  );

  /** Log the confirmation in the conversation (server renders the success card). */
  const reportQuoteSubmitted = useCallback(
    (success: BotQuoteSuccess) => emit({ action: { type: "quote_submitted", ...success } }),
    [emit],
  );

  /** After sign-in: attach this guest session to the account, then refresh history. */
  const mergeAfterLogin = useCallback(async () => {
    const sessionId = sessionIdRef.current;
    if (sessionId) {
      await postData("bot-ai/history/merge", { sessionId }, { silent: true }).catch(() => null);
    }
    const response = await getData("bot-ai/history", undefined, { silent: true, force: true }).catch(() => null);
    setSessions(unwrap<BotSessionSummary[]>(response) ?? []);
  }, []);

  const signIn = useCallback(
    ({ resume = false }: { resume?: boolean } = {}) => {
      const pending = resume ? pendingActionRef.current : null;
      if (!loginDialog) {
        router.push(`/login?next=${encodeURIComponent("/")}`);
        return;
      }
      loginDialog.openLogin({
        reason: pending
          ? "Sign in to continue — your conversation and selected pro are kept."
          : "Sign in to save and view your assistant chat history.",
        onSuccess: (signedInUser) => {
          const name = signedInUser?.firstName?.trim();
          const greeting = `You're signed in${name ? `, ${name}` : ""}. `;
          void mergeAfterLogin();
          if (pending?.kind === "quote") {
            // Continue straight into the AI brief.
            pushMessage({
              id: newId("msg"),
              role: "bot",
              text: `${greeting}Writing up your job for the pros…`,
              createdAt: Date.now(),
            });
            // Sent once the socket reconnects as the signed-in user (fallback: shortly after).
            const draft = pending.draft;
            const run = () => startBrief(draft);
            afterReconnectRef.current = run;
            setTimeout(() => {
              if (afterReconnectRef.current !== run) return;
              afterReconnectRef.current = null;
              run();
            }, 4000);
          } else {
            pushMessage({
              id: newId("msg"),
              role: "bot",
              text: pending
                ? `${greeting}Your conversation is saved — tap below to continue.`
                : `${greeting}This chat is now saved to your history.`,
              createdAt: Date.now(),
              services: pending?.kind === "service" ? [pending.service] : undefined,
            });
          }
          pendingActionRef.current = null;
        },
      });
    },
    [loginDialog, mergeAfterLogin, pushMessage, router, startBrief],
  );

  const restoreSession = useCallback(
    (sessionId: string) => {
      clearAwaitTimeout();
      setAwaiting(null);
      sessionIdRef.current = sessionId;
      writeSessionId(sessionId);
      setActiveSessionId(sessionId);
      void loadSession(sessionId);
    },
    [clearAwaitTimeout, loadSession],
  );

  const deleteSession = useCallback(
    (sessionId: string) => {
      setSessions((previous) => previous.filter((item) => item.sessionId !== sessionId));
      void deleteData(`bot-ai/history/${sessionId}`, { silent: true }).catch(() => null);
      if (sessionId === sessionIdRef.current) startFresh();
    },
    [startFresh],
  );

  const value = useMemo<BotContextValue>(
    () => ({
      open,
      hasUnread,
      typing: Boolean(awaiting) && (serverTyping || !messages.some((item) => item.id === `reply-${awaiting}`)),
      connected,
      messages,
      context,
      sessions,
      activeSessionId,
      isAuthenticated,
      locationLabel,
      openBot,
      openWithQuery,
      openWithSuggestion,
      choosePath,
      minimize,
      close,
      reset,
      sendText,
      selectProvider,
      requestService,
      requestQuote,
      markQuoteSubmitted,
      reportQuoteSubmitted,
      retryLast,
      signIn,
      refreshSessions,
      restoreSession,
      deleteSession,
      addressEditorOpen,
      openAddressEditor,
      closeAddressEditor,
      applyAddress,
    }),
    [
      open, hasUnread, awaiting, serverTyping, connected, messages, context, sessions, activeSessionId,
      isAuthenticated, locationLabel, openBot, openWithQuery, openWithSuggestion, choosePath, minimize, close, reset, sendText, selectProvider,
      requestService, requestQuote, markQuoteSubmitted, reportQuoteSubmitted, retryLast, signIn, refreshSessions, restoreSession, deleteSession,
      addressEditorOpen, openAddressEditor, closeAddressEditor, applyAddress,
    ],
  );

  return <BotContext.Provider value={value}>{children}</BotContext.Provider>;
}

export function useBot() {
  const context = useContext(BotContext);
  if (!context) throw new Error("useBot must be used inside <BotProvider>");
  return context;
}

/** Null outside a BotProvider — lets shared components opt in without a hard dependency. */
export function useOptionalBot() {
  return useContext(BotContext);
}
