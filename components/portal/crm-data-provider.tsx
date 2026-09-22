"use client";

import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from "react";
import {
  getInboxSummary,
  loadCrmSnapshot,
  type CrmSnapshot,
} from "@/lib/api/crm-client";
import type { CrmInboxSummary } from "@/lib/api/crm-mappers";
import type {
  PortalContractor,
  PortalCustomerCrm,
  PortalReminder,
  PortalTask,
  PortalVendor,
} from "@/lib/data/crm-people";
import type { PortalCalendarEvent, PortalEmployee, PortalRequest } from "@/lib/data/portal";
import type { ChatThread } from "@/lib/booking/chat-store";
import type { Estimate, Invoice, Job, Payment } from "@/lib/types";
import { useAppSelector } from "@/store/hooks";
import { selectAuth, selectAuthUser } from "@/store/authSlice";
import { getAuthToken, getAuthUser, invalidateGetCache } from "@/components/api/apiFuntions";

function refreshInboxSummaryFromApi() {
  invalidateGetCache("provider/requests/summary");
  invalidateGetCache("provider/chats/inbox-summary");
  return getInboxSummary({ silent: true, force: true });
}

const EVENT_NAME = "rs-crm-api";

const EMPTY_INBOX_SUMMARY: CrmInboxSummary = {
  newLeads: 0,
  unreadChats: 0,
  pendingOrders: 0,
  total: 0,
};

type CrmApiContextValue = {
  enabled: boolean;
  ready: boolean;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  customers: PortalCustomerCrm[];
  employees: PortalEmployee[];
  contractors: PortalContractor[];
  vendors: PortalVendor[];
  requests: PortalRequest[];
  estimates: Estimate[];
  jobs: Job[];
  tasks: PortalTask[];
  reminders: PortalReminder[];
  invoices: Invoice[];
  payments: Payment[];
  schedule: PortalCalendarEvent[];
  chats: ChatThread[];
  inboxSummary: CrmInboxSummary;
  /** Full CRM snapshot refresh (explicit / after mutations). */
  refresh: (options?: { silent?: boolean }) => Promise<void>;
  ensureLoaded: () => Promise<void>;
  /** Apply a local task addition immediately (e.g. after create API succeeds). */
  addTask: (task: PortalTask) => void;
  /** Apply a local reminder addition immediately (e.g. after create API succeeds). */
  addReminder: (reminder: PortalReminder) => void;
  /** Remove a local task immediately (e.g. after delete API succeeds). */
  removeTask: (id: string) => void;
  /** Remove a local reminder immediately (e.g. after delete API succeeds). */
  removeReminder: (id: string) => void;
  /** Apply a local task update immediately (e.g. after status API succeeds). */
  patchTask: (id: string, patch: Partial<PortalTask>) => void;
  /** Apply a local reminder update immediately (e.g. after status API succeeds). */
  patchReminder: (id: string, patch: Partial<PortalReminder>) => void;
  /** Insert or replace a reminder in the live CRM cache (e.g. after create). */
  upsertReminder: (reminder: PortalReminder) => void;
  /** Apply a local customer update immediately (e.g. after note/save API succeeds). */
  patchCustomer: (id: string, patch: Partial<PortalCustomerCrm>) => void;
  /** Apply a local estimate update immediately (e.g. after save/update API succeeds). */
  patchEstimate: (id: string, patch: Partial<Estimate>) => void;
  /** Apply a local request/lead update immediately (e.g. after status API succeeds). */
  patchRequest: (id: string, patch: Partial<PortalRequest>) => void;
};

const EMPTY_VALUE: CrmApiContextValue = {
  enabled: false,
  ready: false,
  loading: false,
  refreshing: false,
  error: null,
  customers: [],
  employees: [],
  contractors: [],
  vendors: [],
  requests: [],
  estimates: [],
  jobs: [],
  tasks: [],
  reminders: [],
  invoices: [],
  payments: [],
  schedule: [],
  chats: [],
  inboxSummary: EMPTY_INBOX_SUMMARY,
  refresh: async () => {},
  ensureLoaded: async () => {},
  addTask: () => {},
  addReminder: () => {},
  removeTask: () => {},
  removeReminder: () => {},
  patchTask: () => {},
  patchReminder: () => {},
  upsertReminder: () => {},
  patchCustomer: () => {},
  patchEstimate: () => {},
  patchRequest: () => {},
};

type CrmDataState = Omit<
  CrmApiContextValue,
  | "enabled"
  | "refresh"
  | "ensureLoaded"
  | "addTask"
  | "addReminder"
  | "removeTask"
  | "removeReminder"
  | "patchTask"
  | "patchReminder"
  | "upsertReminder"
  | "patchCustomer"
  | "patchEstimate"
  | "patchRequest"
>;

const CrmApiDataContext = createContext<CrmApiContextValue>(EMPTY_VALUE);

function toState(snapshot: CrmSnapshot): CrmDataState {
  return {
    ready: true,
    loading: false,
    refreshing: false,
    error: null,
    customers: snapshot.customers,
    employees: snapshot.employees,
    contractors: snapshot.contractors,
    vendors: snapshot.vendors,
    requests: snapshot.requests,
    estimates: snapshot.estimates,
    jobs: snapshot.jobs,
    tasks: snapshot.tasks,
    reminders: snapshot.reminders,
    invoices: snapshot.invoices,
    payments: snapshot.payments,
    schedule: snapshot.schedule.filter(
      (item): item is PortalCalendarEvent => Boolean(item),
    ),
    chats: snapshot.chats,
    inboxSummary: snapshot.inboxSummary,
  };
}

export function CrmDataProvider({ children }: PropsWithChildren) {
  const auth = useAppSelector(selectAuth);
  const user = useAppSelector(selectAuthUser);
  const mountedRef = useRef(true);
  const inFlightRef = useRef(false);
  const queuedSilentRef = useRef(false);
  const waitersRef = useRef<Array<() => void>>([]);
  const readyRef = useRef(false);
  const [state, setState] = useState<CrmDataState>(EMPTY_VALUE);

  const flushWaiters = useCallback(() => {
    const waiters = waitersRef.current;
    waitersRef.current = [];
    waiters.forEach((resolve) => resolve());
  }, []);

  const token = auth.token || (typeof window !== "undefined" ? getAuthToken() : null);
  const activeUser = user ?? (typeof window !== "undefined" ? getAuthUser() : null);
  const roleStr = String(activeUser?.role || auth.role || "").toLowerCase();
  const isProvider =
    !roleStr ||
    roleStr === "provider" ||
    roleStr === "pro" ||
    roleStr === "admin";
  const enabled = Boolean(token) && isProvider;

  const refresh = useCallback(
    async (options?: { silent?: boolean }) => {
      if (!enabled) return;
      if (inFlightRef.current) {
        queuedSilentRef.current = true;
        await new Promise<void>((resolve) => {
          waitersRef.current.push(resolve);
        });
        return;
      }

      inFlightRef.current = true;
      setState((current) => ({
        ...current,
        loading: !current.ready && !options?.silent,
        refreshing: current.ready || Boolean(options?.silent),
        error: null,
      }));

      try {
        const snapshot = await loadCrmSnapshot();
        if (!mountedRef.current) return;
        readyRef.current = true;
        setState(toState(snapshot));
      } catch (error) {
        if (!mountedRef.current) return;
        const message =
          error instanceof Error && error.message
            ? error.message
            : "Failed to load CRM data.";
        setState((current) => ({
          ...current,
          loading: false,
          refreshing: false,
          error: message,
          ready: current.ready,
        }));
      } finally {
        inFlightRef.current = false;
        if (queuedSilentRef.current && mountedRef.current && enabled) {
          queuedSilentRef.current = false;
          try {
            await refresh({ silent: true });
          } finally {
            flushWaiters();
          }
          return;
        }
        flushWaiters();
      }
    },
    [enabled, flushWaiters],
  );

  const ensureLoaded = useCallback(async () => {
    if (!enabled) return;
    if (readyRef.current) return;
    await refresh();
  }, [enabled, refresh]);

  const addTask = useCallback((task: PortalTask) => {
    setState((current) => ({
      ...current,
      tasks: [task, ...current.tasks.filter((item) => item.id !== task.id)],
    }));
  }, []);

  const addReminder = useCallback((reminder: PortalReminder) => {
    setState((current) => ({
      ...current,
      reminders: [reminder, ...current.reminders.filter((item) => item.id !== reminder.id)],
    }));
  }, []);

  const removeTask = useCallback((id: string) => {
    setState((current) => ({
      ...current,
      tasks: current.tasks.filter((item) => item.id !== id),
    }));
  }, []);

  const removeReminder = useCallback((id: string) => {
    setState((current) => ({
      ...current,
      reminders: current.reminders.filter((item) => item.id !== id),
    }));
  }, []);

  const patchTask = useCallback((id: string, patch: Partial<PortalTask>) => {
    setState((current) => ({
      ...current,
      tasks: current.tasks.map((item) =>
        item.id === id ? { ...item, ...patch } : item,
      ),
    }));
  }, []);

  const patchReminder = useCallback((id: string, patch: Partial<PortalReminder>) => {
    setState((current) => ({
      ...current,
      reminders: current.reminders.map((item) =>
        item.id === id ? { ...item, ...patch } : item,
      ),
    }));
  }, []);

  const upsertReminder = useCallback((reminder: PortalReminder) => {
    setState((current) => {
      const index = current.reminders.findIndex((item) => item.id === reminder.id);
      if (index >= 0) {
        const next = current.reminders.slice();
        next[index] = { ...next[index], ...reminder };
        return { ...current, reminders: next };
      }
      return { ...current, reminders: [reminder, ...current.reminders] };
    });
  }, []);

  const patchCustomer = useCallback((id: string, patch: Partial<PortalCustomerCrm>) => {
    setState((current) => ({
      ...current,
      customers: current.customers.map((item) =>
        item.id === id ? { ...item, ...patch } : item,
      ),
    }));
  }, []);

  const patchEstimate = useCallback((id: string, patch: Partial<Estimate>) => {
    setState((current) => ({
      ...current,
      estimates: current.estimates.map((item) =>
        item.id === id ? { ...item, ...patch } : item,
      ),
    }));
  }, []);

  const patchRequest = useCallback((id: string, patch: Partial<PortalRequest>) => {
    setState((current) => ({
      ...current,
      requests: current.requests.map((item) =>
        item.id === id ? { ...item, ...patch } : item,
      ),
    }));
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    readyRef.current = state.ready;
  }, [state.ready]);

  useEffect(() => {
    if (!enabled) {
      setState(EMPTY_VALUE);
      readyRef.current = false;
      inFlightRef.current = false;
      queuedSilentRef.current = false;
      flushWaiters();
      return;
    }

    // Lightweight badge data only — do NOT load the full CRM snapshot here.
    // Full snapshot is opt-in via ensureLoaded() / refresh() so Customers
    // (and similar list pages) are not flooded with unrelated APIs.
    let cancelled = false;
    void refreshInboxSummaryFromApi()
      .then((inboxSummary) => {
        if (cancelled || !mountedRef.current) return;
        setState((current) => ({
          ...current,
          inboxSummary,
          error: null,
        }));
      })
      .catch(() => {
        /* badge is best-effort */
      });

    return () => {
      cancelled = true;
    };
  }, [enabled, flushWaiters]);

  // No setInterval polling — full snapshot must not auto-fire on a timer.

  useEffect(() => {
    if (!enabled) return;
    let debounceId = 0;
    const applyInboxSummary = (inboxSummary: CrmInboxSummary) => {
      if (!mountedRef.current) return;
      setState((current) => ({ ...current, inboxSummary }));
    };
    const onExternalRefresh = () => {
      // Keep badge counters fresh. Full snapshot is NEVER auto-fired from
      // background events — individual tabs manage only their own data.
      window.clearTimeout(debounceId);
      debounceId = window.setTimeout(() => {
        void refreshInboxSummaryFromApi()
          .then(applyInboxSummary)
          .catch(() => undefined);
      }, 300);
    };

    const onRealtimeMessage = (event: Event) => {
      const custom = event as CustomEvent<{ type?: string; payload?: any }>;
      const detail = custom?.detail;

      if (detail?.type === "LEAD_CREATED") {
        setState((current) => ({
          ...current,
          inboxSummary: {
            ...current.inboxSummary,
            newLeads: (current.inboxSummary?.newLeads || 0) + 1,
            total: (current.inboxSummary?.total || 0) + 1,
          },
        }));
        void refreshInboxSummaryFromApi()
          .then(applyInboxSummary)
          .catch(() => undefined);
        return;
      }

      if (detail?.type === "ORDER_UPDATED") {
        const status = String(detail.payload?.status || "");
        const action = String(detail.payload?.action || "");
        if (status === "BOOKING_REQUESTED" || action === "requested") {
          setState((current) => ({
            ...current,
            inboxSummary: {
              ...current.inboxSummary,
              pendingOrders: (current.inboxSummary?.pendingOrders || 0) + 1,
              total: (current.inboxSummary?.total || 0) + 1,
            },
          }));
        } else if (
          status === "CONFIRMED" ||
          status === "CANCELLED" ||
          action === "accept" ||
          action === "reject"
        ) {
          setState((current) => ({
            ...current,
            inboxSummary: {
              ...current.inboxSummary,
              pendingOrders: Math.max(
                0,
                (current.inboxSummary?.pendingOrders || 1) - 1,
              ),
              total: Math.max(0, (current.inboxSummary?.total || 1) - 1),
            },
          }));
        }
        void refreshInboxSummaryFromApi()
          .then(applyInboxSummary)
          .catch(() => undefined);
        return;
      }

      if (detail?.type === "NEW_NOTIFICATION") {
        const notifType = String(detail.payload?.type || "");
        if (notifType === "NEW_BOOKING_REQUEST") {
          setState((current) => ({
            ...current,
            inboxSummary: {
              ...current.inboxSummary,
              pendingOrders: (current.inboxSummary?.pendingOrders || 0) + 1,
              total: (current.inboxSummary?.total || 0) + 1,
            },
          }));
          void refreshInboxSummaryFromApi()
            .then(applyInboxSummary)
            .catch(() => undefined);
        }
        return;
      }

      if (detail?.type === "INBOX_SUMMARY_INVALIDATE") {
        void refreshInboxSummaryFromApi()
          .then(applyInboxSummary)
          .catch(() => undefined);
        return;
      }

      if (detail?.type === "CHAT_READ_RECEIPT" && detail.payload?.readBy === "provider") {
        setState((current) => ({
          ...current,
          inboxSummary: {
            ...current.inboxSummary,
            unreadChats: Math.max(0, (current.inboxSummary?.unreadChats || 1) - 1),
            total: Math.max(0, (current.inboxSummary?.total || 1) - 1),
          },
        }));
        return;
      }

      // Do NOT trigger full CRM snapshot refresh for chat/presence/typing events!
      // Chat messages, read receipts, typing, and presence are handled in real-time
      // by the chat socket listeners directly.
      const isChatEvent =
        detail?.type === "CHAT_MESSAGE" ||
        detail?.type === "CHAT_TYPING" ||
        detail?.type === "CHAT_READ_RECEIPT" ||
        detail?.type === "CHAT_THREAD_UPDATED" ||
        detail?.type === "USER_PRESENCE" ||
        detail?.type === "chat:presence";

      if (!isChatEvent) {
        onExternalRefresh();
      }
    };

    const onLeadStatus = (event: Event) => {
      const custom = event as CustomEvent<{ id?: string; status?: string }>;
      const detail = custom?.detail;
      if (detail?.id && detail?.status) {
        patchRequest(detail.id, { status: detail.status as PortalRequest["status"] });
      }
    };

    window.addEventListener(EVENT_NAME, onExternalRefresh);
    window.addEventListener("rs-realtime", onRealtimeMessage);
    window.addEventListener("rs-lead-status", onLeadStatus);
    return () => {
      window.clearTimeout(debounceId);
      window.removeEventListener(EVENT_NAME, onExternalRefresh);
      window.removeEventListener("rs-realtime", onRealtimeMessage);
      window.removeEventListener("rs-lead-status", onLeadStatus);
    };
  }, [enabled, patchRequest, refresh]);

  const value = useMemo<CrmApiContextValue>(
    () => ({
      enabled,
      ...state,
      refresh,
      ensureLoaded,
      addTask,
      addReminder,
      removeTask,
      removeReminder,
      patchTask,
      patchReminder,
      upsertReminder,
      patchCustomer,
      patchEstimate,
      patchRequest,
    }),
    [
      enabled,
      ensureLoaded,
      addTask,
      addReminder,
      removeTask,
      removeReminder,
      patchCustomer,
      patchEstimate,
      patchReminder,
      patchRequest,
      upsertReminder,
      patchTask,
      refresh,
      state,
    ],
  );

  return (
    <CrmApiDataContext.Provider value={value}>
      {children}
    </CrmApiDataContext.Provider>
  );
}

export { CrmApiDataContext, EVENT_NAME as CRM_API_EVENT };
