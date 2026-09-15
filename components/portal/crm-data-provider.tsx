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
import { useAppSelector } from "@/store/hooks";
import { selectAuth, selectAuthUser } from "@/store/authSlice";

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
  refresh: (options?: { silent?: boolean }) => Promise<void>;
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
};

type CrmDataState = Omit<CrmApiContextValue, "enabled" | "refresh">;

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
  const [state, setState] = useState<CrmDataState>(EMPTY_VALUE);

  const flushWaiters = useCallback(() => {
    const waiters = waitersRef.current;
    waitersRef.current = [];
    waiters.forEach((resolve) => resolve());
  }, []);

  const enabled =
    auth.hydrated &&
    Boolean(auth.token) &&
    (user?.role === "provider" || auth.role === "provider");

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

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!enabled) {
      setState(EMPTY_VALUE);
      inFlightRef.current = false;
      queuedSilentRef.current = false;
      flushWaiters();
      return;
    }
    void refresh();
  }, [enabled, flushWaiters, refresh]);

  useEffect(() => {
    if (!enabled) return;
    const id = window.setInterval(() => {
      void refresh({ silent: true });
    }, 60_000);
    return () => window.clearInterval(id);
  }, [enabled, refresh]);

  useEffect(() => {
    if (!enabled) return;
    let debounceId = 0;
    const onExternalRefresh = () => {
      window.clearTimeout(debounceId);
      debounceId = window.setTimeout(() => {
        void refresh({ silent: true });
      }, 300);
    };
    window.addEventListener(EVENT_NAME, onExternalRefresh);
    window.addEventListener("rs-realtime", onExternalRefresh);
    return () => {
      window.clearTimeout(debounceId);
      window.removeEventListener(EVENT_NAME, onExternalRefresh);
      window.removeEventListener("rs-realtime", onExternalRefresh);
    };
  }, [enabled, refresh]);

  const value = useMemo<CrmApiContextValue>(
    () => ({
      enabled,
      ...state,
      refresh,
    }),
    [enabled, refresh, state],
  );

  return (
    <CrmApiDataContext.Provider value={value}>
      {children}
    </CrmApiDataContext.Provider>
  );
}

export { CrmApiDataContext, EVENT_NAME as CRM_API_EVENT };
