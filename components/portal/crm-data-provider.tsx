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
import { loadCrmSnapshot, type CrmSnapshot } from "@/lib/api/crm-client";
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
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { selectAuth, selectAuthUser } from "@/store/authSlice";
import { fetchProviderDashboard } from "@/store/dashboardSlice";
import {
  fetchRequests,
  invalidateRequestsCache,
} from "@/store/requestsSlice";
import { getAuthToken, getAuthUser } from "@/components/api/apiFuntions";
import { applyPortalInboxCounts } from "@/components/portal/portal-inbox-counts-store";
import {
  ackProviderInboxBadges,
  onSocketEvent,
  requestProviderInboxCounts,
} from "@/components/socket";

const EVENT_NAME = "rs-crm-api";

const EMPTY_INBOX_SUMMARY: CrmInboxSummary = {
  newLeads: 0,
  unreadChats: 0,
  pendingOrders: 0,
  pendingEstimates: 0,
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

/** Data-only empty state — never include `enabled` (it would overwrite the live flag). */
const EMPTY_STATE: CrmDataState = {
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
};

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
    // Keep socket-driven badges; snapshot no longer fetches summary APIs.
    inboxSummary: EMPTY_INBOX_SUMMARY,
  };
}

export function CrmDataProvider({ children }: PropsWithChildren) {
  const dispatch = useAppDispatch();
  const auth = useAppSelector(selectAuth);
  const user = useAppSelector(selectAuthUser);
  const mountedRef = useRef(true);
  const inFlightRef = useRef(false);
  const queuedSilentRef = useRef(false);
  const waitersRef = useRef<Array<() => void>>([]);
  const readyRef = useRef(false);
  const [state, setState] = useState<CrmDataState>(EMPTY_STATE);

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
        setState((current) => ({
          ...toState(snapshot),
          // Never overwrite socket badge counts with empty snapshot defaults.
          inboxSummary: current.inboxSummary,
        }));
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
      setState(EMPTY_STATE);
      readyRef.current = false;
      inFlightRef.current = false;
      queuedSilentRef.current = false;
      flushWaiters();
      return;
    }

    // Sidebar badge counts: socket only (provider:inbox-counts). No REST summary APIs.
    requestProviderInboxCounts();
    // Retry — CrmDataProvider often mounts before the shared socket connects.
    const t1 = window.setTimeout(() => requestProviderInboxCounts(), 400);
    const t2 = window.setTimeout(() => requestProviderInboxCounts(), 1500);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [enabled, flushWaiters]);

  // No setInterval polling — full snapshot must not auto-fire on a timer.

  useEffect(() => {
    if (!enabled) return;
    let debounceId = 0;
    const applyInboxSummary = (inboxSummary: CrmInboxSummary) => {
      // Always update the sidebar store even during Strict Mode remount gaps.
      applyPortalInboxCounts(inboxSummary);
      if (!mountedRef.current) return;
      setState((current) => ({ ...current, inboxSummary }));
    };
    // Direct socket path — do not rely only on RealtimeProvider → window hop.
    const offCounts = onSocketEvent("provider:inbox-counts", (payload) => {
      applyInboxSummary({
        newLeads: Number(payload?.newLeads) || 0,
        unreadChats: Number(payload?.unreadChats) || 0,
        pendingOrders: Number(payload?.pendingOrders) || 0,
        pendingEstimates: Number(payload?.pendingEstimates) || 0,
        total: Number(payload?.total) || 0,
      });
    });
    const requestCountsSoon = () => {
      window.clearTimeout(debounceId);
      debounceId = window.setTimeout(() => {
        requestProviderInboxCounts();
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
        requestCountsSoon();
        // Keep Overview Incoming requests and Leads list in sync with the new quote.
        void dispatch(fetchProviderDashboard({ force: true, silent: true }));
        dispatch(invalidateRequestsCache());
        void dispatch(fetchRequests({ force: true, silent: true, page: 1 }));
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
        requestCountsSoon();
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
          requestCountsSoon();
        }
        return;
      }

      if (detail?.type === "INBOX_SUMMARY_APPLY") {
        const summary = detail?.payload as
          | (CrmInboxSummary & { reason?: string; kinds?: string[] })
          | undefined;
        if (summary && typeof summary === "object") {
          applyInboxSummary({
            newLeads: Number(summary.newLeads) || 0,
            unreadChats: Number(summary.unreadChats) || 0,
            pendingOrders: Number(summary.pendingOrders) || 0,
            pendingEstimates: Number(summary.pendingEstimates) || 0,
            total: Number(summary.total) || 0,
          });
        }
        return;
      }

      if (detail?.type === "INBOX_SUMMARY_INVALIDATE") {
        const reason = String(detail?.payload?.reason || "");
        // Socket ACK clears badges locally; exact counts arrive via provider:inbox-counts.
        if (reason === "INBOX_ACK") {
          const kinds = Array.isArray(detail?.payload?.kinds)
            ? detail.payload.kinds.map((k: unknown) => String(k || "").toLowerCase())
            : [];
          setState((current) => {
            const next = { ...current.inboxSummary };
            if (kinds.includes("leads")) next.newLeads = 0;
            if (kinds.includes("orders")) next.pendingOrders = 0;
            if (kinds.includes("estimates")) next.pendingEstimates = 0;
            next.total =
              (next.newLeads || 0) +
              (next.unreadChats || 0) +
              (next.pendingOrders || 0) +
              (next.pendingEstimates || 0);
            return { ...current, inboxSummary: next };
          });
          return;
        }
        requestCountsSoon();
        return;
      }

      if (detail?.type === "CHAT_READ_RECEIPT" && detail.payload?.readBy === "provider") {
        const cleared = Math.max(
          0,
          Number(
            (detail.payload as { clearedUnread?: number })?.clearedUnread,
          ) || 0,
        );
        setState((current) => ({
          ...current,
          inboxSummary: {
            ...current.inboxSummary,
            unreadChats: Math.max(
              0,
              (current.inboxSummary?.unreadChats || 0) - (cleared || 1),
            ),
            total: Math.max(
              0,
              (current.inboxSummary?.total || 0) - (cleared || 1),
            ),
          },
        }));
        requestCountsSoon();
        return;
      }

      if (detail?.type === "LEADS_TAB_OPENED") {
        return;
      }

      if (detail?.type === "ORDERS_TAB_OPENED") {
        setState((current) => ({
          ...current,
          inboxSummary: {
            ...current.inboxSummary,
            pendingOrders: 0,
            total:
              (current.inboxSummary?.newLeads || 0) +
              (current.inboxSummary?.unreadChats || 0) +
              (current.inboxSummary?.pendingEstimates || 0),
          },
        }));
        ackProviderInboxBadges(["orders"]);
        return;
      }

      if (detail?.type === "ESTIMATES_TAB_OPENED") {
        setState((current) => ({
          ...current,
          inboxSummary: {
            ...current.inboxSummary,
            pendingEstimates: 0,
            total:
              (current.inboxSummary?.newLeads || 0) +
              (current.inboxSummary?.unreadChats || 0) +
              (current.inboxSummary?.pendingOrders || 0),
          },
        }));
        ackProviderInboxBadges(["estimates"]);
        return;
      }

      if (detail?.type === "SOCKET_RECONNECTED") {
        requestProviderInboxCounts();
        return;
      }

      // Chat/presence events must not refresh CRM snapshot or badge APIs.
      const isChatEvent =
        detail?.type === "CHAT_MESSAGE" ||
        detail?.type === "CHAT_TYPING" ||
        detail?.type === "CHAT_READ_RECEIPT" ||
        detail?.type === "CHAT_THREAD_UPDATED" ||
        detail?.type === "USER_PRESENCE" ||
        detail?.type === "chat:presence";

      if (!isChatEvent) {
        // Domain events may change badges — reconcile over socket only.
        requestCountsSoon();
      }
    };

    const onLeadStatus = (event: Event) => {
      const custom = event as CustomEvent<{ id?: string; status?: string }>;
      const detail = custom?.detail;
      if (detail?.id && detail?.status) {
        patchRequest(detail.id, { status: detail.status as PortalRequest["status"] });
      }
    };

    window.addEventListener(EVENT_NAME, requestCountsSoon);
    window.addEventListener("rs-realtime", onRealtimeMessage);
    window.addEventListener("rs-lead-status", onLeadStatus);
    return () => {
      offCounts();
      window.clearTimeout(debounceId);
      window.removeEventListener(EVENT_NAME, requestCountsSoon);
      window.removeEventListener("rs-realtime", onRealtimeMessage);
      window.removeEventListener("rs-lead-status", onLeadStatus);
    };
  }, [enabled, patchRequest, dispatch]);


  const value = useMemo<CrmApiContextValue>(
    () => ({
      ...state,
      // `enabled` must come after `...state` so a stale state.enabled never wins.
      enabled,
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
