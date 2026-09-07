"use client";

import { useCallback, useSyncExternalStore } from "react";
import { usePortalWorkspace } from "@/components/portal/use-portal-workspace";
import type { Estimate, EstimateStatus, Invoice, InvoiceStatus, Job, JobStatus } from "@/lib/types";

const EVENT = "rs-job-file";

export type JobLog = {
  id: string;
  at: string;
  title: string;
  detail: string;
  actor: string;
};

export type JobActivity = {
  id: string;
  at: string;
  title: string;
  html: string;
  actor: string;
};

export type JobAttachment = {
  id: string;
  name: string;
  type: string;
  size: number;
  dataUrl: string;
  addedAt: string;
  actor: string;
};

export type JobSettingsDraft = {
  name: string;
  customerId: string;
  street: string;
  city: string;
  state: string;
  zip: string;
  start: string;
  due: string;
  employeeId: string;
  assignedTo: string;
  status: JobStatus;
  notes: string;
};

export type InvoiceSettingsDraft = {
  customerId: string;
  issuedAt: string;
  dueAt: string;
  status: InvoiceStatus;
};

export type EstimateSettingsDraft = {
  name: string;
  customerId: string;
  street: string;
  city: string;
  state: string;
  zip: string;
  issuedAt: string;
  expiresAt: string;
  status: EstimateStatus;
  notes: string;
  terms: string;
};

export type EstimateSiteVisit = {
  employeeId: string;
  technician: string;
  visitedAt: string;
  accessNotes: string;
  findings: string;
  recommendations: string;
  measurements: string;
  photos: JobAttachment[];
};

export const EMPTY_SITE_VISIT: EstimateSiteVisit = {
  employeeId: "",
  technician: "",
  visitedAt: "",
  accessNotes: "",
  findings: "",
  recommendations: "",
  measurements: "",
  photos: [],
};

type JobFileRecord = {
  logs: JobLog[];
  activities: JobActivity[];
  attachments: JobAttachment[];
  settings?: JobSettingsDraft;
  estimateSettings?: EstimateSettingsDraft;
  invoiceSettings?: InvoiceSettingsDraft;
  siteVisit?: EstimateSiteVisit;
};

export function applyInvoiceSettings(invoice: Invoice, settings?: InvoiceSettingsDraft): Invoice {
  if (!settings) return invoice;
  return {
    ...invoice,
    customerId: settings.customerId || invoice.customerId,
    issuedAt: settings.issuedAt || invoice.issuedAt,
    dueAt: settings.dueAt || invoice.dueAt,
    status: settings.status || invoice.status,
  };
}

export function applyEstimateSettings(estimate: Estimate, settings?: EstimateSettingsDraft): Estimate {
  if (!settings) return estimate;
  return {
    ...estimate,
    customerId: settings.customerId || estimate.customerId,
    issuedAt: settings.issuedAt || estimate.issuedAt,
    expiresAt: settings.expiresAt || estimate.expiresAt,
    status: settings.status || estimate.status,
    notes: settings.notes || estimate.notes,
    terms: settings.terms || estimate.terms,
    propertyAddress: {
      ...estimate.propertyAddress,
      street: settings.street || estimate.propertyAddress.street,
      city: settings.city || estimate.propertyAddress.city,
      state: settings.state || estimate.propertyAddress.state,
      zip: settings.zip || estimate.propertyAddress.zip,
    },
  };
}

export function applyJobSettings(job: Job, settings?: JobSettingsDraft): Job {
  if (!settings) return job;
  return {
    ...job,
    customerId: settings.customerId || job.customerId,
    assignedTo: settings.assignedTo || job.assignedTo,
    scheduledAt: settings.start || job.scheduledAt,
    dueAt: settings.due || job.dueAt,
    status: settings.status || job.status,
    notes: settings.notes || job.notes,
    address: {
      ...job.address,
      street: settings.street || job.address.street,
      city: settings.city || job.address.city,
      state: settings.state || job.address.state,
      zip: settings.zip || job.address.zip,
    },
  };
}

type FileStore = Record<string, JobFileRecord>;

const EMPTY: FileStore = {};
const snapshots = new Map<string, { raw: string; value: FileStore }>();

function storageKey(email?: string) {
  return `rs-job-file:${email ?? "guest"}`;
}

function readStore(key: string): FileStore {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = window.localStorage.getItem(key) ?? "";
    const cached = snapshots.get(key);
    if (cached && cached.raw === raw) return cached.value;
    if (!raw) {
      snapshots.set(key, { raw, value: EMPTY });
      return EMPTY;
    }
    const parsed = JSON.parse(raw) as FileStore;
    const value = parsed && typeof parsed === "object" ? parsed : EMPTY;
    snapshots.set(key, { raw, value });
    return value;
  } catch {
    return EMPTY;
  }
}

function writeStore(key: string, next: FileStore) {
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

export function jobCostsLocked(invoice?: Invoice) {
  if (!invoice) return false;
  switch (invoice.status) {
    case "draft":
    case "cancelled":
      return false;
    case "sent":
    case "partially_paid":
    case "paid":
    case "overdue":
      return true;
    default: {
      const _never: never = invoice.status;
      return _never;
    }
  }
}

export function invoiceIssuedLabel(status: InvoiceStatus) {
  switch (status) {
    case "draft":
      return "Draft invoice";
    case "sent":
      return "Invoice sent";
    case "partially_paid":
      return "Invoice partially paid";
    case "paid":
      return "Invoice paid";
    case "overdue":
      return "Invoice overdue";
    case "cancelled":
      return "Invoice cancelled";
    default: {
      const _never: never = status;
      return _never;
    }
  }
}

function seedFile(
  job: Job,
  estimate: Estimate | undefined,
  invoice: Invoice | undefined,
  technician: string,
): JobFileRecord {
  const logs: JobLog[] = [
    {
      id: `log_${job.id}_created`,
      at: job.createdAt,
      title: "Job opened",
      detail: estimate ? `Created from ${estimate.number}` : "Opened on the board",
      actor: "System",
    },
  ];
  if (job.scheduledAt) {
    logs.push({
      id: `log_${job.id}_scheduled`,
      at: job.scheduledAt,
      title: "Scheduled",
      detail: job.dueAt ? `${job.scheduledAt} through ${job.dueAt}` : job.scheduledAt,
      actor: "System",
    });
  }
  if (technician) {
    logs.push({
      id: `log_${job.id}_assign`,
      at: job.updatedAt,
      title: "Technician assigned",
      detail: technician,
      actor: "System",
    });
  }
  if (invoice) {
    logs.push({
      id: `log_${job.id}_invoice`,
      at: invoice.issuedAt,
      title: invoiceIssuedLabel(invoice.status),
      detail: invoice.number,
      actor: "System",
    });
  }
  logs.push({
    id: `log_${job.id}_status`,
    at: job.updatedAt,
    title: "Status set",
    detail: job.status.replace("_", " "),
    actor: "System",
  });
  return { logs, activities: [], attachments: [] };
}

export function useInvoiceSettings(invoiceId: string) {
  const { session } = usePortalWorkspace();
  const key = storageKey(session?.email);
  const store = useSyncExternalStore(
    subscribe,
    () => readStore(key),
    () => EMPTY,
  );
  return store[invoiceId]?.invoiceSettings;
}

export function useEstimateSettings(estimateId: string) {
  const { session } = usePortalWorkspace();
  const key = storageKey(session?.email);
  const store = useSyncExternalStore(
    subscribe,
    () => readStore(key),
    () => EMPTY,
  );
  return store[estimateId]?.estimateSettings;
}

export function writeSiteVisit(
  email: string | undefined,
  recordId: string,
  visit: EstimateSiteVisit,
  actor = "Desk",
) {
  const key = storageKey(email);
  const latest = readStore(key)[recordId] ?? { logs: [], activities: [], attachments: [] };
  writeStore(key, {
    ...readStore(key),
    [recordId]: {
      ...latest,
      siteVisit: visit,
      logs: [
        ...latest.logs,
        {
          id: `log_visit_${Date.now()}`,
          at: new Date().toISOString(),
          title: "Site visit updated",
          detail: visit.findings.slice(0, 90) || `${visit.photos.length} photos`,
          actor,
        },
      ],
    },
  });
}

export function useEstimateSiteVisit(estimateId: string) {
  const { session } = usePortalWorkspace();
  const key = storageKey(session?.email);
  const store = useSyncExternalStore(
    subscribe,
    () => readStore(key),
    () => EMPTY,
  );
  return store[estimateId]?.siteVisit;
}

export function useJobSettings(jobId: string) {
  const { session } = usePortalWorkspace();
  const key = storageKey(session?.email);
  const store = useSyncExternalStore(
    subscribe,
    () => readStore(key),
    () => EMPTY,
  );
  return store[jobId]?.settings;
}

export function useJobFile(
  job: Job,
  estimate: Estimate | undefined,
  invoice: Invoice | undefined,
  technician: string,
) {
  const { session } = usePortalWorkspace();
  const key = storageKey(session?.email);
  const actor = [session?.firstName, session?.lastName].filter(Boolean).join(" ") || "Desk";
  const store = useSyncExternalStore(
    subscribe,
    () => readStore(key),
    () => EMPTY,
  );
  const stored = store[job.id] ?? { logs: [], activities: [], attachments: [] };
  const systemLogs = seedFile(job, estimate, invoice, technician).logs;

  const commit = useCallback(
    (next: JobFileRecord) => {
      writeStore(key, { ...readStore(key), [job.id]: next });
    },
    [job.id, key],
  );

  const current = useCallback((): JobFileRecord => {
    return readStore(key)[job.id] ?? { logs: [], activities: [], attachments: [] };
  }, [job.id, key]);

  const addLog = useCallback(
    (title: string, detail: string) => {
      const latest = current();
      commit({
        ...latest,
        logs: [
          ...latest.logs,
          { id: `log_${Date.now()}`, at: new Date().toISOString(), title, detail, actor },
        ],
      });
    },
    [actor, commit, current],
  );

  const addActivity = useCallback(
    (title: string, html: string) => {
      const latest = current();
      const activity: JobActivity = {
        id: `act_${Date.now()}`,
        at: new Date().toISOString(),
        title,
        html,
        actor,
      };
      commit({
        ...latest,
        activities: [activity, ...latest.activities],
        logs: [
          ...latest.logs,
          { id: `log_${Date.now()}`, at: activity.at, title: "Activity posted", detail: title, actor },
        ],
      });
    },
    [actor, commit, current],
  );

  const updateActivity = useCallback(
    (id: string, title: string, html: string) => {
      const latest = current();
      const existing = latest.activities.find((item) => item.id === id);
      if (!existing) return;
      commit({
        ...latest,
        activities: latest.activities.map((item) =>
          item.id === id ? { ...item, title, html, at: new Date().toISOString() } : item,
        ),
        logs: [
          ...latest.logs,
          {
            id: `log_${Date.now()}`,
            at: new Date().toISOString(),
            title: "Activity updated",
            detail: title,
            actor,
          },
        ],
      });
    },
    [actor, commit, current],
  );

  const removeActivity = useCallback(
    (id: string) => {
      const latest = current();
      const existing = latest.activities.find((item) => item.id === id);
      commit({
        ...latest,
        activities: latest.activities.filter((item) => item.id !== id),
        logs: existing
          ? [
              ...latest.logs,
              {
                id: `log_${Date.now()}`,
                at: new Date().toISOString(),
                title: "Activity deleted",
                detail: existing.title,
                actor,
              },
            ]
          : latest.logs,
      });
    },
    [actor, commit, current],
  );

  const addAttachments = useCallback(
    (files: JobAttachment[]) => {
      const latest = current();
      commit({
        ...latest,
        attachments: [...files, ...latest.attachments],
        logs: [
          ...latest.logs,
          ...files.map((file) => ({
            id: `log_${file.id}`,
            at: file.addedAt,
            title: "Attachment added",
            detail: file.name,
            actor,
          })),
        ],
      });
    },
    [actor, commit, current],
  );

  const removeAttachment = useCallback(
    (id: string) => {
      const latest = current();
      const file = latest.attachments.find((item) => item.id === id);
      commit({
        ...latest,
        attachments: latest.attachments.filter((item) => item.id !== id),
        logs: file
          ? [
              ...latest.logs,
              {
                id: `log_del_${Date.now()}`,
                at: new Date().toISOString(),
                title: "Attachment removed",
                detail: file.name,
                actor,
              },
            ]
          : latest.logs,
      });
    },
    [actor, commit, current],
  );

  const logs = [...systemLogs, ...stored.logs].slice().sort((a, b) => (a.at < b.at ? 1 : -1));
  const activities = stored.activities.slice().sort((a, b) => (a.at < b.at ? 1 : -1));

  return {
    actor,
    logs,
    activities,
    attachments: stored.attachments,
    addLog,
    addActivity,
    updateActivity,
    removeActivity,
    addAttachments,
    removeAttachment,
    settings: stored.settings,
    siteVisit: stored.siteVisit,
    saveSiteVisit: (visit: EstimateSiteVisit) => {
      writeSiteVisit(session?.email, job.id, visit, actor);
    },
    saveSettings: (settings: JobSettingsDraft) => {
      const latest = current();
      commit({
        ...latest,
        settings,
        logs: [
          ...latest.logs,
          {
            id: `log_${Date.now()}`,
            at: new Date().toISOString(),
            title: "Job settings updated",
            detail: settings.name || job.number,
            actor,
          },
        ],
      });
    },
    saveEstimateSettings: (settings: EstimateSettingsDraft) => {
      const latest = current();
      commit({
        ...latest,
        estimateSettings: settings,
        logs: [
          ...latest.logs,
          {
            id: `log_${Date.now()}`,
            at: new Date().toISOString(),
            title: "Estimate settings updated",
            detail: settings.name || job.number,
            actor,
          },
        ],
      });
    },
    saveInvoiceSettings: (settings: InvoiceSettingsDraft) => {
      const latest = current();
      commit({
        ...latest,
        invoiceSettings: settings,
        logs: [
          ...latest.logs,
          {
            id: `log_${Date.now()}`,
            at: new Date().toISOString(),
            title: "Invoice settings updated",
            detail: job.number,
            actor,
          },
        ],
      });
    },
    locked: jobCostsLocked(invoice),
  };
}
