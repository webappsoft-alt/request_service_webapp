"use client";

import { useCallback, useSyncExternalStore } from "react";
import { usePortalWorkspace } from "@/components/portal/use-portal-workspace";
import type { PortalFixedService, PortalRequest } from "@/lib/data/portal";
import type { Estimate, Invoice, Job, Payment } from "@/lib/types";

const EVENT = "rs-portal-records";

export type PortalRecordKind =
  | "request"
  | "estimate"
  | "job"
  | "invoice"
  | "payment"
  | "customer"
  | "service"
  | "task";

type RequestPatch = Partial<
  Pick<
    PortalRequest,
    | "customerId"
    | "customerName"
    | "customerEmail"
    | "customerPhone"
    | "serviceName"
    | "details"
    | "preferredDate"
    | "preferredTimeWindow"
    | "zip"
    | "city"
    | "state"
  >
>;

type RecordsStore = {
  deleted: string[];
  archived: string[];
  status: Record<string, string>;
  estimates: Estimate[];
  jobs: Job[];
  invoices: Invoice[];
  payments: Payment[];
  invoicePatches: Record<string, Partial<Invoice>>;
  requests: PortalRequest[];
  requestPatches: Record<string, RequestPatch>;
  services: PortalFixedService[];
  servicePatches: Record<string, Partial<PortalFixedService>>;
  links: Record<string, string>;
};

const EMPTY: RecordsStore = {
  deleted: [],
  archived: [],
  status: {},
  estimates: [],
  jobs: [],
  invoices: [],
  payments: [],
  invoicePatches: {},
  requests: [],
  requestPatches: {},
  services: [],
  servicePatches: {},
  links: {},
};
const snapshots = new Map<string, { raw: string; value: RecordsStore }>();

function storageKey(email?: string) {
  return `rs-portal-records:${email ?? "guest"}`;
}

function recordKey(kind: PortalRecordKind, id: string) {
  return `${kind}:${id}`;
}

function readStore(key: string): RecordsStore {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = window.localStorage.getItem(key) ?? "";
    const cached = snapshots.get(key);
    if (cached && cached.raw === raw) return cached.value;
    if (!raw) {
      snapshots.set(key, { raw, value: EMPTY });
      return EMPTY;
    }
    const parsed = JSON.parse(raw) as RecordsStore;
    const value: RecordsStore = {
      deleted: parsed.deleted ?? [],
      archived: parsed.archived ?? [],
      status: parsed.status ?? {},
      estimates: parsed.estimates ?? [],
      jobs: parsed.jobs ?? [],
      invoices: parsed.invoices ?? [],
      payments: parsed.payments ?? [],
      invoicePatches: parsed.invoicePatches ?? {},
      requests: parsed.requests ?? [],
      requestPatches: parsed.requestPatches ?? {},
      services: parsed.services ?? [],
      servicePatches: parsed.servicePatches ?? {},
      links: parsed.links ?? {},
    };
    snapshots.set(key, { raw, value });
    return value;
  } catch {
    return EMPTY;
  }
}

function writeStore(key: string, next: RecordsStore) {
  window.localStorage.setItem(key, JSON.stringify(next));
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(onStoreChange: () => void) {
  window.addEventListener(EVENT, onStoreChange);
  window.addEventListener("storage", onStoreChange);
  return () => {
    window.removeEventListener(EVENT, onStoreChange);
    window.removeEventListener("storage", onStoreChange);
  };
}

export function usePortalRecords() {
  const { session } = usePortalWorkspace();
  const key = storageKey(session?.email);
  const store = useSyncExternalStore(
    subscribe,
    () => readStore(key),
    () => EMPTY,
  );

  const isDeleted = useCallback(
    (kind: PortalRecordKind, id: string) => store.deleted.includes(recordKey(kind, id)),
    [store.deleted],
  );

  const isArchived = useCallback(
    (kind: PortalRecordKind, id: string) => store.archived.includes(recordKey(kind, id)),
    [store.archived],
  );

  const statusOf = useCallback(
    <T extends string>(kind: PortalRecordKind, id: string, fallback: T) =>
      (store.status[recordKey(kind, id)] as T | undefined) ?? fallback,
    [store.status],
  );

  const setStatus = useCallback(
    (kind: PortalRecordKind, id: string, status: string) => {
      const current = readStore(key);
      writeStore(key, {
        ...current,
        status: { ...current.status, [recordKey(kind, id)]: status },
      });
    },
    [key],
  );

  const remove = useCallback(
    (kind: PortalRecordKind, id: string) => {
      const current = readStore(key);
      const nextKey = recordKey(kind, id);
      writeStore(key, {
        ...current,
        deleted: current.deleted.includes(nextKey) ? current.deleted : [...current.deleted, nextKey],
      });
    },
    [key],
  );

  const keep = useCallback(
    <T extends { id: string }>(kind: PortalRecordKind, rows: T[]) =>
      rows.filter((row) => !isDeleted(kind, row.id)),
    [isDeleted],
  );

  const archive = useCallback(
    (kind: PortalRecordKind, id: string) => {
      const current = readStore(key);
      const nextKey = recordKey(kind, id);
      writeStore(key, {
        ...current,
        archived: current.archived.includes(nextKey) ? current.archived : [...current.archived, nextKey],
      });
    },
    [key],
  );

  const unarchive = useCallback(
    (kind: PortalRecordKind, id: string) => {
      const current = readStore(key);
      writeStore(key, {
        ...current,
        archived: current.archived.filter((item) => item !== recordKey(kind, id)),
      });
    },
    [key],
  );

  const listed = useCallback(
    <T extends { id: string }>(kind: PortalRecordKind, rows: T[], archivedOnly: boolean) =>
      keep(kind, rows).filter((row) => isArchived(kind, row.id) === archivedOnly),
    [isArchived, keep],
  );

  const mergeEstimates = useCallback(
    (seeded: Estimate[]) => keep("estimate", [...seeded, ...store.estimates]),
    [keep, store.estimates],
  );

  const mergeJobs = useCallback(
    (seeded: Job[]) => keep("job", [...seeded, ...store.jobs]),
    [keep, store.jobs],
  );

  const mergeInvoices = useCallback(
    (seeded: Invoice[]) =>
      keep("invoice", [...seeded, ...store.invoices]).map((item) => ({
        ...item,
        ...store.invoicePatches[item.id],
        status: statusOf("invoice", item.id, store.invoicePatches[item.id]?.status ?? item.status),
      })),
    [keep, statusOf, store.invoicePatches, store.invoices],
  );

  const mergePayments = useCallback(
    (seeded: Payment[]) => keep("payment", [...seeded, ...store.payments]),
    [keep, store.payments],
  );

  const addEstimate = useCallback(
    (estimate: Estimate) => {
      const current = readStore(key);
      writeStore(key, { ...current, estimates: [...current.estimates, estimate] });
    },
    [key],
  );

  const addJob = useCallback(
    (job: Job) => {
      const current = readStore(key);
      writeStore(key, { ...current, jobs: [...current.jobs, job] });
    },
    [key],
  );

  const addInvoice = useCallback(
    (invoice: Invoice) => {
      const current = readStore(key);
      writeStore(key, { ...current, invoices: [...current.invoices, invoice] });
    },
    [key],
  );

  const patchInvoice = useCallback(
    (id: string, patch: Partial<Invoice>) => {
      const current = readStore(key);
      const extra = current.invoices.find((item) => item.id === id);
      writeStore(key, {
        ...current,
        invoices: extra
          ? current.invoices.map((item) => (item.id === id ? { ...item, ...patch } : item))
          : current.invoices,
        invoicePatches: extra
          ? current.invoicePatches
          : { ...current.invoicePatches, [id]: { ...current.invoicePatches[id], ...patch } },
      });
    },
    [key],
  );

  const addPayment = useCallback(
    (payment: Payment) => {
      const current = readStore(key);
      writeStore(key, { ...current, payments: [...current.payments, payment] });
    },
    [key],
  );

  const mergeRequests = useCallback(
    (seeded: PortalRequest[]) =>
      keep("request", [...seeded, ...store.requests]).map((item) => ({
        ...item,
        ...store.requestPatches[item.id],
        status: statusOf("request", item.id, item.status),
      })),
    [keep, statusOf, store.requestPatches, store.requests],
  );

  const addRequest = useCallback(
    (request: PortalRequest) => {
      const current = readStore(key);
      writeStore(key, { ...current, requests: [...current.requests, request] });
    },
    [key],
  );

  const updateRequest = useCallback(
    (id: string, patch: RequestPatch) => {
      const current = readStore(key);
      const extra = current.requests.find((item) => item.id === id);
      writeStore(key, {
        ...current,
        requests: extra
          ? current.requests.map((item) => (item.id === id ? { ...item, ...patch } : item))
          : current.requests,
        requestPatches: extra
          ? current.requestPatches
          : { ...current.requestPatches, [id]: { ...current.requestPatches[id], ...patch } },
      });
    },
    [key],
  );

  const mergeServices = useCallback(
    (seeded: PortalFixedService[]) =>
      keep("service", [...seeded, ...store.services]).map((item) => {
        const patched = { ...item, ...store.servicePatches[item.id] };
        return {
          ...patched,
          images: patched.images ?? [],
          coverage: patched.coverage ?? [],
          areaZips: patched.areaZips ?? [],
          availabilityMode: patched.availabilityMode ?? "office",
          customHours: patched.customHours ?? [],
          active: statusOf("service", item.id, patched.active ? "active" : "hidden") === "active",
        };
      }),
    [keep, statusOf, store.servicePatches, store.services],
  );

  const addService = useCallback(
    (service: PortalFixedService) => {
      const current = readStore(key);
      writeStore(key, { ...current, services: [...current.services, service] });
    },
    [key],
  );

  const patchService = useCallback(
    (id: string, patch: Partial<PortalFixedService>) => {
      const current = readStore(key);
      const extra = current.services.find((item) => item.id === id);
      writeStore(key, {
        ...current,
        services: extra
          ? current.services.map((item) => (item.id === id ? { ...item, ...patch } : item))
          : current.services,
        servicePatches: extra
          ? current.servicePatches
          : { ...current.servicePatches, [id]: { ...current.servicePatches[id], ...patch } },
      });
    },
    [key],
  );

  const linkRecords = useCallback(
    (fromKind: "estimate" | "job", fromId: string, toId: string) => {
      const current = readStore(key);
      writeStore(key, { ...current, links: { ...current.links, [`${fromKind}:${fromId}`]: toId } });
    },
    [key],
  );

  const linkedId = useCallback(
    (fromKind: "estimate" | "job", fromId: string) => store.links[`${fromKind}:${fromId}`],
    [store.links],
  );

  return {
    isDeleted,
    isArchived,
    statusOf,
    setStatus,
    remove,
    archive,
    unarchive,
    listed,
    keep,
    mergeEstimates,
    mergeJobs,
    mergeInvoices,
    mergePayments,
    addEstimate,
    addJob,
    addInvoice,
    patchInvoice,
    addPayment,
    mergeRequests,
    addRequest,
    updateRequest,
    mergeServices,
    addService,
    patchService,
    linkRecords,
    linkedId,
  };
}
