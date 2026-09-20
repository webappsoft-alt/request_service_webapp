"use client";

import { useCallback, useSyncExternalStore } from "react";
import {
  createEstimate as createEstimateApi,
  createInvoice as createInvoiceApi,
  createJob as createJobApi,
  deleteJob as deleteJobApi,
  deleteEstimate as deleteEstimateApi,
  createRequest as createRequestApi,
  recordInvoicePayment,
  updateEstimate as updateEstimateApi,
  updateEstimateStatus as updateEstimateStatusApi,
  updateEstimateArchive as updateEstimateArchiveApi,
  updateInvoice as updateInvoiceApi,
  updateJobStatus as updateJobStatusApi,
  updateRequestStatus,
  archiveCustomer as archiveCustomerApi,
} from "@/lib/api/crm-client";
import { useCrmApiData } from "@/components/portal/use-crm-api-data";
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

function upsertById<T extends { id: string }>(primary: T[], extra: T[]) {
  const seen = new Set(primary.map((item) => item.id));
  return [...primary, ...extra.filter((item) => item.id && !seen.has(item.id))];
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
  const crm = useCrmApiData();
  const key = storageKey(session?.email);
  const store = useSyncExternalStore(
    subscribe,
    () => readStore(key),
    () => EMPTY,
  );
  const apiReady = crm.enabled && crm.ready;
  const suppressSeedData = Boolean(session) || (crm.enabled && !crm.ready);

  const isDeleted = useCallback(
    (kind: PortalRecordKind, id: string) => store.deleted.includes(recordKey(kind, id)),
    [store.deleted],
  );

  const isArchived = useCallback(
    (kind: PortalRecordKind, id: string) => {
      const nextKey = recordKey(kind, id);
      if (store.archived.includes(nextKey)) return true;
      if (kind === "estimate") {
        const est = crm.estimates.find((item) => item.id === id);
        if (est && (est.isArchived !== undefined || est.isArchieved !== undefined)) {
          return Boolean(est.isArchived ?? est.isArchieved);
        }
      }
      return false;
    },
    [crm.estimates, store.archived],
  );

  const statusOf = useCallback(
    <T extends string>(kind: PortalRecordKind, id: string, fallback: T) =>
      (store.status[recordKey(kind, id)] as T | undefined) ?? fallback,
    [store.status],
  );

  const setStatus = useCallback(
    (kind: PortalRecordKind, id: string, status: string) => {
      if (crm.enabled && kind === "request") {
        return (async () => {
          const nextStatus = status as PortalRequest["status"];
          crm.patchRequest(id, { status: nextStatus });
          const current = readStore(key);
          writeStore(key, {
            ...current,
            status: { ...current.status, [recordKey(kind, id)]: status },
          });
          const updated = await updateRequestStatus(
            id,
            nextStatus,
          );
          if (typeof window !== "undefined") {
            window.dispatchEvent(
              new CustomEvent("rs-realtime", {
                detail: { type: "INBOX_SUMMARY_INVALIDATE" },
              }),
            );
          }
          return updated;
        })();
      }
      if (crm.enabled && kind === "estimate") {
        return (async () => {
          const nextStatus = status as Estimate["status"];
          try {
            const updated = await updateEstimateStatusApi(id, nextStatus);
            if (updated) {
              crm.patchEstimate(id, updated);
            } else {
              crm.patchEstimate(id, { status: nextStatus });
            }
            if (crm.ready) {
              void crm.refresh({ silent: true });
            }
            return updated;
          } catch (statusError) {
            const currentEstimate =
              crm.estimates.find((item) => item.id === id) ??
              store.estimates.find((item) => item.id === id);
            if (!currentEstimate) throw statusError;
            const updated = await updateEstimateApi(id, {
              ...currentEstimate,
              status: nextStatus,
            });
            if (updated) {
              crm.patchEstimate(id, updated);
            } else {
              crm.patchEstimate(id, { status: nextStatus });
            }
            if (crm.ready) {
              void crm.refresh({ silent: true });
            }
            return updated;
          }
        })();
      }
      if (apiReady && kind === "job") {
        return (async () => {
          const updated = await updateJobStatusApi(id, status as Job["status"]);
          await crm.refresh();
          return updated;
        })();
      }
      if (apiReady && kind === "invoice") {
        return (async () => {
          const currentInvoice =
            crm.invoices.find((item) => item.id === id) ??
            store.invoices.find((item) => item.id === id);
          if (!currentInvoice) throw new Error("Invoice not found");
          const updated = await updateInvoiceApi(id, {
            ...currentInvoice,
            status: status as Invoice["status"],
          });
          await crm.refresh();
          return updated;
        })();
      }
      const current = readStore(key);
      writeStore(key, {
        ...current,
        status: { ...current.status, [recordKey(kind, id)]: status },
      });
    },
    [apiReady, crm, key, store.estimates, store.invoices],
  );

  const remove = useCallback(
    (kind: PortalRecordKind, id: string) => {
      if (crm.enabled && kind === "estimate") {
        return (async () => {
          await deleteEstimateApi(id);
          const current = readStore(key);
          const nextKey = recordKey(kind, id);
          writeStore(key, {
            ...current,
            deleted: current.deleted.includes(nextKey)
              ? current.deleted
              : [...current.deleted, nextKey],
          });
          if (crm.ready) {
            void crm.refresh();
          }
        })();
      }
      if (apiReady && kind === "customer") {
        return (async () => {
          await archiveCustomerApi(id);
          await crm.refresh();
        })();
      }
      if (apiReady && kind === "job") {
        return (async () => {
          await deleteJobApi(id);
          const current = readStore(key);
          const nextKey = recordKey(kind, id);
          writeStore(key, {
            ...current,
            deleted: current.deleted.includes(nextKey) ? current.deleted : [...current.deleted, nextKey],
          });
          await crm.refresh();
        })();
      }
      const current = readStore(key);
      const nextKey = recordKey(kind, id);
      const job = kind === "job" ? current.jobs.find((item) => item.id === id) ?? crm.jobs.find((item) => item.id === id) : undefined;
      writeStore(key, {
        ...current,
        deleted: current.deleted.includes(nextKey) ? current.deleted : [...current.deleted, nextKey],
        status:
          job?.estimateId
            ? { ...current.status, [recordKey("estimate", job.estimateId)]: "draft" }
            : current.status,
      });
    },
    [apiReady, crm, key],
  );

  const keep = useCallback(
    <T extends { id: string }>(kind: PortalRecordKind, rows: T[]) =>
      rows.filter((row) => !isDeleted(kind, row.id)),
    [isDeleted],
  );

  const archive = useCallback(
    (kind: PortalRecordKind, id: string) => {
      if (apiReady && kind === "customer") {
        return (async () => {
          await archiveCustomerApi(id);
          await crm.refresh();
        })();
      }
      if (apiReady && kind === "estimate") {
        return (async () => {
          const updated = await updateEstimateArchiveApi(id, true);
          const persisted = Boolean(updated?.isArchived ?? updated?.isArchieved);
          if (!updated || !persisted) {
            throw new Error("Archive did not save on the server. Restart the API and try again.");
          }
          crm.patchEstimate(id, updated);
          const current = readStore(key);
          const nextKey = recordKey(kind, id);
          writeStore(key, {
            ...current,
            archived: current.archived.includes(nextKey) ? current.archived : [...current.archived, nextKey],
          });
          if (crm.ready) {
            void crm.refresh({ silent: true });
          }
          return updated;
        })();
      }
      const current = readStore(key);
      const nextKey = recordKey(kind, id);
      writeStore(key, {
        ...current,
        archived: current.archived.includes(nextKey) ? current.archived : [...current.archived, nextKey],
      });
    },
    [apiReady, crm, key],
  );

  const unarchive = useCallback(
    (kind: PortalRecordKind, id: string) => {
      if (apiReady && kind === "estimate") {
        return (async () => {
          const updated = await updateEstimateArchiveApi(id, false);
          const stillArchived = Boolean(updated?.isArchived ?? updated?.isArchieved);
          if (!updated || stillArchived) {
            throw new Error("Restore did not save on the server. Restart the API and try again.");
          }
          crm.patchEstimate(id, updated);
          const current = readStore(key);
          const nextKey = recordKey(kind, id);
          writeStore(key, {
            ...current,
            archived: current.archived.filter((item) => item !== nextKey),
          });
          if (crm.ready) {
            void crm.refresh({ silent: true });
          }
          return updated;
        })();
      }
      const current = readStore(key);
      writeStore(key, {
        ...current,
        archived: current.archived.filter((item) => item !== recordKey(kind, id)),
      });
    },
    [apiReady, crm, key],
  );

  const listed = useCallback(
    <T extends { id: string }>(kind: PortalRecordKind, rows: T[], archivedOnly: boolean) =>
      keep(kind, rows).filter((row) => isArchived(kind, row.id) === archivedOnly),
    [isArchived, keep],
  );

  const mergeEstimates = useCallback(
    (seeded: Estimate[]) =>
      keep(
        "estimate",
        apiReady
          ? upsertById(crm.estimates, store.estimates)
          : suppressSeedData
            ? store.estimates
            : [...seeded, ...store.estimates],
      ).map((item) => ({
        ...item,
        status: statusOf("estimate", item.id, item.status),
      })),
    [apiReady, crm.estimates, keep, statusOf, store.estimates, suppressSeedData],
  );

  const mergeJobs = useCallback(
    (seeded: Job[]) =>
      keep(
        "job",
        apiReady
          ? upsertById(crm.jobs, store.jobs)
          : suppressSeedData
            ? store.jobs
            : [...seeded, ...store.jobs],
      ).map(
        (item) => ({
          ...item,
          status: statusOf("job", item.id, item.status),
        }),
      ),
    [apiReady, crm.jobs, keep, statusOf, store.jobs, suppressSeedData],
  );

  const cacheJob = useCallback(
    (job: Job) => {
      const current = readStore(key);
      writeStore(key, {
        ...current,
        jobs: [job, ...current.jobs.filter((item) => item.id !== job.id)],
      });
    },
    [key],
  );

  const mergeInvoices = useCallback(
    (seeded: Invoice[]) =>
      keep(
        "invoice",
        apiReady ? crm.invoices : suppressSeedData ? [] : [...seeded, ...store.invoices],
      ).map((item) => ({
        ...item,
        ...store.invoicePatches[item.id],
        status: statusOf("invoice", item.id, store.invoicePatches[item.id]?.status ?? item.status),
      })),
    [apiReady, crm.invoices, keep, statusOf, store.invoicePatches, store.invoices, suppressSeedData],
  );

  const mergePayments = useCallback(
    (seeded: Payment[]) =>
      keep(
        "payment",
        apiReady ? crm.payments : suppressSeedData ? [] : [...seeded, ...store.payments],
      ),
    [apiReady, crm.payments, keep, store.payments, suppressSeedData],
  );

  const persistEstimate = useCallback(
    (estimate: Estimate, dropIds: string[] = []) => {
      const current = readStore(key);
      const skip = new Set(dropIds.filter(Boolean));
      writeStore(key, {
        ...current,
        estimates: [estimate, ...current.estimates.filter((item) => item.id !== estimate.id && !skip.has(item.id))],
      });
    },
    [key],
  );

  const addEstimate = useCallback(
    (estimate: Estimate) => {
      persistEstimate(estimate);
      if (crm.enabled) {
        return (async () => {
          const created = await createEstimateApi(estimate);
          const saved = created ?? estimate;
          persistEstimate(saved, created && created.id !== estimate.id ? [estimate.id] : []);
          if (crm.ready) {
            await crm.refresh({ silent: true });
          }
          return saved;
        })();
      }
    },
    [crm, persistEstimate],
  );

  const addJob = useCallback(
    (job: Job) => {
      // Match addEstimate: hit the API whenever the provider session is live.
      if (crm.enabled) {
        return (async () => {
          const created = await createJobApi(job, crm.employees);
          const saved = created ?? job;
          if (crm.ready) {
            await crm.refresh({ silent: true });
          }
          return saved;
        })();
      }
      const current = readStore(key);
      writeStore(key, { ...current, jobs: [...current.jobs, job] });
      return job;
    },
    [crm, key],
  );

  const addInvoice = useCallback(
    (invoice: Invoice) => {
      if (apiReady) {
        return (async () => {
          const created = await createInvoiceApi(invoice);
          await crm.refresh();
          return created;
        })();
      }
      const current = readStore(key);
      writeStore(key, { ...current, invoices: [...current.invoices, invoice] });
    },
    [apiReady, crm, key],
  );

  const patchInvoice = useCallback(
    (id: string, patch: Partial<Invoice>) => {
      if (apiReady) {
        return (async () => {
          const currentInvoice =
            crm.invoices.find((item) => item.id === id) ??
            store.invoices.find((item) => item.id === id);
          if (!currentInvoice) throw new Error("Invoice not found");
          const updated = await updateInvoiceApi(id, { ...currentInvoice, ...patch });
          await crm.refresh();
          return updated;
        })();
      }
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
    [apiReady, crm, key, store.invoices],
  );

  const addPayment = useCallback(
    (payment: Payment) => {
      if (apiReady) {
        return (async () => {
          const created = await recordInvoicePayment(payment.invoiceId, payment);
          await crm.refresh();
          return created;
        })();
      }
      const current = readStore(key);
      writeStore(key, { ...current, payments: [...current.payments, payment] });
    },
    [apiReady, crm, key],
  );

  const mergeRequests = useCallback(
    (seeded: PortalRequest[]) =>
      keep(
        "request",
        apiReady ? crm.requests : suppressSeedData ? [] : [...seeded, ...store.requests],
      ).map((item) => ({
        ...item,
        ...store.requestPatches[item.id],
        status: statusOf("request", item.id, item.status),
      })),
    [apiReady, crm.requests, keep, statusOf, store.requestPatches, store.requests, suppressSeedData],
  );

  const addRequest = useCallback(
    (request: PortalRequest) => {
      if (apiReady) {
        return (async () => {
          const created = await createRequestApi(request);
          await crm.refresh();
          return created;
        })();
      }
      const current = readStore(key);
      writeStore(key, { ...current, requests: [...current.requests, request] });
    },
    [apiReady, crm, key],
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
      keep(
        "service",
        suppressSeedData ? store.services : [...seeded, ...store.services],
      ).map((item) => {
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
    [keep, statusOf, store.servicePatches, store.services, suppressSeedData],
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
    restore: unarchive,
    listed,
    keep,
    mergeEstimates,
    mergeJobs,
    mergeInvoices,
    mergePayments,
    addEstimate,
    addJob,
    cacheJob,
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
