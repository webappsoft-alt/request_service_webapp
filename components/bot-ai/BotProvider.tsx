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
import { useAppSelector } from "@/store/hooks";
import { selectAuthUser, selectIsAuthenticated, type AuthUser } from "@/store/authSlice";
import { locationDisplayLabel } from "@/store/locationSlice";
import { getBotReply, initialConversationState, sessionTitle } from "./botEngine";
import { findProvider, mockCategories } from "./mockData";
import { WELCOME_MESSAGE } from "./systemPromptGuide";
import type {
  BotConversationState,
  BotInput,
  BotMessage,
  BotSession,
  MockProvider,
  MockService,
} from "./types";

export type BotServiceAction = "book" | "quote";

type BotContextValue = {
  open: boolean;
  /** Bot replied while the panel was closed/minimised. */
  hasUnread: boolean;
  typing: boolean;
  messages: BotMessage[];
  state: BotConversationState;
  sessions: BotSession[];
  activeSessionId: string;
  isAuthenticated: boolean;
  locationLabel: string;
  openBot: () => void;
  openWithQuery: (text: string) => void;
  minimize: () => void;
  close: () => void;
  reset: () => void;
  sendText: (text: string) => void;
  send: (input: BotInput, label: string) => void;
  requestService: (service: MockService, action: BotServiceAction) => void;
  /** Open the site login modal over the chat; `resume` re-offers the pending book / quote. */
  signIn: (options?: { resume?: boolean }) => void;
  restoreSession: (id: string) => void;
  deleteSession: (id: string) => void;
  /** Destination for a book/quote action (also used as the post-login `next`). */
  serviceActionHref: (service: MockService, action: BotServiceAction) => string;
};

const BotContext = createContext<BotContextValue | null>(null);

function userIdOf(user: AuthUser | null | undefined) {
  return String(user?.id ?? user?._id ?? user?.email ?? "");
}

const HISTORY_LIMIT = 15;
const historyKey = (userId: string) => `rs-bot-history:${userId}`;

let idCounter = 0;
function newId(prefix: string) {
  idCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${idCounter}`;
}

function welcomeMessage(): BotMessage {
  return {
    id: newId("msg"),
    role: "bot",
    text: WELCOME_MESSAGE,
    createdAt: Date.now(),
    suggestions: mockCategories.slice(0, 6).map((category) => ({
      label: `${category.emoji} ${category.name}`,
      input: { type: "category", slug: category.slug },
    })),
  };
}

function readHistory(userId: string): BotSession[] {
  try {
    const raw = window.localStorage.getItem(historyKey(userId));
    const parsed = raw ? (JSON.parse(raw) as BotSession[]) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeHistory(userId: string, sessions: BotSession[]) {
  try {
    window.localStorage.setItem(historyKey(userId), JSON.stringify(sessions.slice(0, HISTORY_LIMIT)));
  } catch {
    // Storage full or blocked — history is a convenience only.
  }
}

/** Default hand-off into the existing request / booking flows. */
export function defaultServiceActionHref(
  service: MockService,
  provider: MockProvider | undefined,
  action: BotServiceAction,
  zip: string,
) {
  const params = new URLSearchParams();
  params.set("service", service.categorySlug);
  if (zip) params.set("zip", zip);
  if (provider?.slug) {
    params.set("provider", provider.slug);
    if (action === "book") params.set("intent", "book");
    return `/request-service?${params.toString()}`;
  }
  if (action === "book") {
    params.set("intent", "book");
    return `/request-service?${params.toString()}`;
  }
  return `/get-a-quote?${params.toString()}`;
}

export function BotProvider({
  children,
  onServiceAction,
}: {
  children: ReactNode;
  /**
   * Optional hook into an on-page booking modal / quote form. Return true when handled;
   * otherwise the assistant navigates to the existing request / quote pages.
   */
  onServiceAction?: (service: MockService, action: BotServiceAction) => boolean;
}) {
  const router = useRouter();
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  const user = useAppSelector(selectAuthUser);
  const location = useAppSelector((state) => state.location);
  const locationLabel = locationDisplayLabel(location);
  const userId = isAuthenticated ? userIdOf(user) : "";
  const loginDialog = useCustomerLoginDialog();

  const [open, setOpen] = useState(false);
  const [hasUnread, setHasUnread] = useState(false);
  const [messages, setMessages] = useState<BotMessage[]>([]);
  const [state, setState] = useState<BotConversationState>(initialConversationState);
  const [pendingReplies, setPendingReplies] = useState(0);
  const [sessions, setSessions] = useState<BotSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState(() => newId("session"));

  // Refs keep rapid consecutive sends consistent before React re-renders.
  const stateRef = useRef(state);
  const messagesRef = useRef(messages);
  const openRef = useRef(open);
  const timersRef = useRef(new Set<ReturnType<typeof setTimeout>>());
  const pendingActionRef = useRef<{ service: MockService; action: BotServiceAction } | null>(null);
  const userIdRef = useRef(userId);

  useEffect(() => {
    openRef.current = open;
  }, [open]);

  useEffect(() => {
    userIdRef.current = userId;
  }, [userId]);

  // Load the signed-in user's history (client only), re-reading when the account changes.
  const [historyFor, setHistoryFor] = useState<string | null>(null);
  if (typeof window !== "undefined" && historyFor !== userId) {
    setHistoryFor(userId);
    setSessions(userId ? readHistory(userId) : []);
  }

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      timers.forEach((timer) => clearTimeout(timer));
      timers.clear();
    };
  }, []);

  const cancelPending = useCallback(() => {
    timersRef.current.forEach((timer) => clearTimeout(timer));
    timersRef.current.clear();
    setPendingReplies(0);
  }, []);

  const applyState = useCallback((next: BotConversationState) => {
    stateRef.current = next;
    setState(next);
  }, []);

  const pushMessages = useCallback((next: BotMessage[]) => {
    messagesRef.current = [...messagesRef.current, ...next];
    setMessages(messagesRef.current);
  }, []);

  /**
   * Persist the active conversation to a user's history. Merges against storage (not
   * state) so a guest chat can be attached to an account right after sign-in.
   */
  const archiveActive = useCallback(
    (targetUserId: string = userId) => {
      const current = messagesRef.current;
      const firstUser = current.find((message) => message.role === "user");
      if (!targetUserId || !firstUser) return;
      const session: BotSession = {
        id: activeSessionId,
        title: sessionTitle(stateRef.current, firstUser.text),
        updatedAt: Date.now(),
        messages: current,
        state: stateRef.current,
      };
      const next = [session, ...readHistory(targetUserId).filter((item) => item.id !== session.id)].slice(
        0,
        HISTORY_LIMIT,
      );
      writeHistory(targetUserId, next);
      if (targetUserId === userIdRef.current) setSessions(next);
    },
    [activeSessionId, userId],
  );

  const startFresh = useCallback(() => {
    cancelPending();
    applyState(initialConversationState);
    messagesRef.current = [welcomeMessage()];
    setMessages(messagesRef.current);
    setActiveSessionId(newId("session"));
  }, [applyState, cancelPending]);

  const scheduleBot = useCallback(
    (drafts: Omit<BotMessage, "id" | "role" | "createdAt">[]) => {
      if (!drafts.length) return;
      setPendingReplies((count) => count + 1);
      const delay = 550 + Math.min(700, drafts[0].text.length * 6);
      const timer = setTimeout(() => {
        timersRef.current.delete(timer);
        setPendingReplies((count) => Math.max(0, count - 1));
        pushMessages(
          drafts.map((draft) => ({ ...draft, id: newId("msg"), role: "bot" as const, createdAt: Date.now() })),
        );
        if (!openRef.current) setHasUnread(true);
      }, delay);
      timersRef.current.add(timer);
    },
    [pushMessages],
  );

  const ensureThread = useCallback(() => {
    if (!messagesRef.current.length) {
      messagesRef.current = [welcomeMessage()];
      setMessages(messagesRef.current);
    }
  }, []);

  const send = useCallback(
    (input: BotInput, label: string) => {
      ensureThread();
      pushMessages([{ id: newId("msg"), role: "user", text: label, createdAt: Date.now() }]);
      const reply = getBotReply(stateRef.current, input, locationLabel);
      applyState(reply.state);
      scheduleBot(reply.messages);
    },
    [applyState, ensureThread, locationLabel, pushMessages, scheduleBot],
  );

  const sendText = useCallback(
    (text: string) => {
      const value = text.trim();
      if (!value) return;
      send({ type: "text", text: value }, value);
    },
    [send],
  );

  const openBot = useCallback(() => {
    ensureThread();
    setOpen(true);
    setHasUnread(false);
  }, [ensureThread]);

  const openWithQuery = useCallback(
    (text: string) => {
      openBot();
      sendText(text);
    },
    [openBot, sendText],
  );

  const minimize = useCallback(() => setOpen(false), []);

  const close = useCallback(() => {
    archiveActive();
    setOpen(false);
    setHasUnread(false);
    cancelPending();
    applyState(initialConversationState);
    messagesRef.current = [];
    setMessages([]);
    setActiveSessionId(newId("session"));
  }, [applyState, archiveActive, cancelPending]);

  const reset = useCallback(() => {
    archiveActive();
    startFresh();
  }, [archiveActive, startFresh]);

  const serviceActionHref = useCallback(
    (service: MockService, action: BotServiceAction) =>
      defaultServiceActionHref(service, findProvider(service.providerId), action, location.zip),
    [location.zip],
  );

  /** Hand a chosen service to the booking / quote flow (caller has checked auth). */
  const proceedService = useCallback(
    (service: MockService, action: BotServiceAction, targetUserId: string) => {
      archiveActive(targetUserId);
      if (onServiceAction?.(service, action)) {
        setOpen(false);
        return;
      }
      scheduleBot([
        {
          text: action === "book" ? "Opening the booking form…" : "Opening the quote request form…",
        },
      ]);
      const timer = setTimeout(() => {
        timersRef.current.delete(timer);
        setOpen(false);
        router.push(serviceActionHref(service, action));
      }, 1200);
      timersRef.current.add(timer);
    },
    [archiveActive, onServiceAction, router, scheduleBot, serviceActionHref],
  );

  const requestService = useCallback(
    (service: MockService, action: BotServiceAction) => {
      ensureThread();
      const label = action === "book" ? `Book “${service.title}”` : `Get a quote for “${service.title}”`;
      pushMessages([{ id: newId("msg"), role: "user", text: label, createdAt: Date.now() }]);

      if (!isAuthenticated) {
        pendingActionRef.current = { service, action };
        scheduleBot([
          {
            text:
              action === "book"
                ? "Almost there! Sign in to confirm your booking — your chat and selected pro stay right here."
                : "Sign in so the pro can send your itemized quote — your chat stays right here.",
            authPrompt: { action, serviceTitle: service.title, nextHref: serviceActionHref(service, action) },
          },
        ]);
        return;
      }

      pendingActionRef.current = null;
      proceedService(service, action, userId);
    },
    [ensureThread, isAuthenticated, proceedService, pushMessages, scheduleBot, serviceActionHref, userId],
  );

  /**
   * Open the website-level login modal over the chat (no navigation). On success the
   * guest conversation is attached to the account and, when `resume` is set, the
   * pending book / quote action continues automatically.
   */
  const signIn = useCallback(
    ({ resume = false }: { resume?: boolean } = {}) => {
      const pending = resume ? pendingActionRef.current : null;
      if (!loginDialog) {
        const next = pending ? serviceActionHref(pending.service, pending.action) : "/";
        router.push(`/login?next=${encodeURIComponent(next)}`);
        return;
      }
      loginDialog.openLogin({
        reason: pending
          ? `Sign in to ${pending.action === "book" ? "book" : "get a quote for"} “${pending.service.title}”.`
          : "Sign in to save and view your assistant chat history.",
        registerNext: pending ? serviceActionHref(pending.service, pending.action) : undefined,
        onSuccess: (signedInUser) => {
          const nextUserId = userIdOf(signedInUser);
          const name = signedInUser?.firstName?.trim();
          const greeting = `You're signed in${name ? `, ${name}` : ""}.`;
          // The chat stays open; the pending service is offered again so one tap continues.
          scheduleBot([
            pending
              ? {
                  text: `${greeting} Your conversation and selected pro are saved. Tap “${
                    pending.action === "book" ? "Book this Service" : "Get a Quote"
                  }” to continue.`,
                  services: [pending.service],
                }
              : { text: `${greeting} This chat is now saved to your history.` },
          ]);
          pendingActionRef.current = null;
          // Attach the guest conversation (including that reply) to the account.
          const attach = setTimeout(() => {
            timersRef.current.delete(attach);
            archiveActive(nextUserId);
          }, 1500);
          timersRef.current.add(attach);
          archiveActive(nextUserId);
        },
      });
    },
    [archiveActive, loginDialog, router, scheduleBot, serviceActionHref],
  );

  const restoreSession = useCallback(
    (id: string) => {
      const session = sessions.find((item) => item.id === id);
      if (!session) return;
      archiveActive();
      cancelPending();
      applyState(session.state);
      messagesRef.current = session.messages;
      setMessages(session.messages);
      setActiveSessionId(session.id);
    },
    [applyState, archiveActive, cancelPending, sessions],
  );

  const deleteSession = useCallback(
    (id: string) => {
      setSessions((previous) => {
        const next = previous.filter((item) => item.id !== id);
        if (userId) writeHistory(userId, next);
        return next;
      });
    },
    [userId],
  );

  const value = useMemo<BotContextValue>(
    () => ({
      open,
      hasUnread,
      typing: pendingReplies > 0,
      messages,
      state,
      sessions,
      activeSessionId,
      isAuthenticated,
      locationLabel,
      openBot,
      openWithQuery,
      minimize,
      close,
      reset,
      sendText,
      send,
      requestService,
      signIn,
      restoreSession,
      deleteSession,
      serviceActionHref,
    }),
    [
      open, hasUnread, pendingReplies, messages, state, sessions, activeSessionId, isAuthenticated,
      locationLabel, openBot, openWithQuery, minimize, close, reset, sendText, send, requestService, signIn,
      restoreSession, deleteSession, serviceActionHref,
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
