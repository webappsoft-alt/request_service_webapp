"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import { usePortalWorkspace } from "@/components/portal/use-portal-workspace";
import {
  getCrmCustomers,
  getPortalContractors,
  getPortalNotes,
  getPortalReminders,
  getPortalTasks,
  getPortalVendors,
  type PortalContractor,
  type PortalCustomerCrm,
  type PortalNote,
  type PortalReminder,
  type PortalTask,
  type PortalVendor,
} from "@/lib/data/crm-people";

const EVENT = "rs-crm-directory";

type DirectoryStore = {
  customers: PortalCustomerCrm[];
  contractors: PortalContractor[];
  vendors: PortalVendor[];
  reminders: PortalReminder[];
  tasks: PortalTask[];
  notes: PortalNote[];
  deleted: string[];
  contractorPatches: Record<string, Partial<PortalContractor>>;
  vendorPatches: Record<string, Partial<PortalVendor>>;
};

const EMPTY: DirectoryStore = {
  customers: [],
  contractors: [],
  vendors: [],
  reminders: [],
  tasks: [],
  notes: [],
  deleted: [],
  contractorPatches: {},
  vendorPatches: {},
};

const snapshots = new Map<string, { raw: string; value: DirectoryStore }>();

function storageKey(email?: string) {
  return `rs-crm-directory:${email ?? "guest"}`;
}

function readStore(key: string): DirectoryStore {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = window.localStorage.getItem(key) ?? "";
    const cached = snapshots.get(key);
    if (cached && cached.raw === raw) return cached.value;
    if (!raw) {
      snapshots.set(key, { raw, value: EMPTY });
      return EMPTY;
    }
    const parsed = JSON.parse(raw) as DirectoryStore;
    const value: DirectoryStore = {
      customers: parsed.customers ?? [],
      contractors: parsed.contractors ?? [],
      vendors: parsed.vendors ?? [],
      reminders: parsed.reminders ?? [],
      tasks: parsed.tasks ?? [],
      notes: parsed.notes ?? [],
      deleted: parsed.deleted ?? [],
      contractorPatches: parsed.contractorPatches ?? {},
      vendorPatches: parsed.vendorPatches ?? {},
    };
    snapshots.set(key, { raw, value });
    return value;
  } catch {
    return EMPTY;
  }
}

function writeStore(key: string, next: DirectoryStore) {
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

export function useCrmDirectory() {
  const { session, provider, employees } = usePortalWorkspace();
  const key = storageKey(session?.email);
  const store = useSyncExternalStore(
    subscribe,
    () => readStore(key),
    () => EMPTY,
  );

  const seedCustomers = useMemo(() => getCrmCustomers(provider), [provider]);
  const seedContractors = useMemo(() => getPortalContractors(provider), [provider]);
  const seedVendors = useMemo(() => getPortalVendors(provider), [provider]);
  const seedReminders = useMemo(() => getPortalReminders(provider), [provider]);
  const seedTasks = useMemo(() => getPortalTasks(provider), [provider]);
  const seedNotes = useMemo(() => getPortalNotes(provider), [provider]);

  const customers = useMemo(
    () =>
      [...seedCustomers, ...store.customers].filter((item) => !store.deleted.includes(`customer:${item.id}`)),
    [seedCustomers, store.customers, store.deleted],
  );
  const contractors = useMemo(
    () =>
      [...seedContractors, ...store.contractors]
        .filter((item) => !store.deleted.includes(`contractor:${item.id}`))
        .map((item) => ({ ...item, ...store.contractorPatches[item.id] })),
    [seedContractors, store.contractorPatches, store.contractors, store.deleted],
  );
  const vendors = useMemo(
    () =>
      [...seedVendors, ...store.vendors]
        .filter((item) => !store.deleted.includes(`vendor:${item.id}`))
        .map((item) => ({ ...item, ...store.vendorPatches[item.id] })),
    [seedVendors, store.vendorPatches, store.vendors, store.deleted],
  );
  const reminders = useMemo(
    () =>
      [...seedReminders, ...store.reminders].filter((item) => !store.deleted.includes(`reminder:${item.id}`)),
    [seedReminders, store.reminders, store.deleted],
  );
  const tasks = useMemo(
    () => [...seedTasks, ...store.tasks].filter((item) => !store.deleted.includes(`task:${item.id}`)),
    [seedTasks, store.tasks, store.deleted],
  );
  const notes = useMemo(
    () => [...seedNotes, ...store.notes].filter((item) => !store.deleted.includes(`note:${item.id}`)),
    [seedNotes, store.notes, store.deleted],
  );

  const addCustomer = useCallback(
    (customer: PortalCustomerCrm) => {
      const current = readStore(key);
      writeStore(key, { ...current, customers: [...current.customers, customer] });
      return customer;
    },
    [key],
  );

  const addContractor = useCallback(
    (contractor: PortalContractor) => {
      const current = readStore(key);
      writeStore(key, { ...current, contractors: [...current.contractors, contractor] });
      return contractor;
    },
    [key],
  );

  const addVendor = useCallback(
    (vendor: PortalVendor) => {
      const current = readStore(key);
      writeStore(key, { ...current, vendors: [...current.vendors, vendor] });
      return vendor;
    },
    [key],
  );

  const addReminder = useCallback(
    (reminder: PortalReminder) => {
      const current = readStore(key);
      writeStore(key, { ...current, reminders: [...current.reminders, reminder] });
      return reminder;
    },
    [key],
  );

  const addTask = useCallback(
    (task: PortalTask) => {
      const current = readStore(key);
      writeStore(key, { ...current, tasks: [...current.tasks, task] });
      return task;
    },
    [key],
  );

  const addNote = useCallback(
    (note: PortalNote) => {
      const current = readStore(key);
      writeStore(key, { ...current, notes: [...current.notes, note] });
      return note;
    },
    [key],
  );

  const updateNote = useCallback(
    (id: string, patch: Partial<PortalNote>) => {
      const current = readStore(key);
      const inStore = current.notes.some((item) => item.id === id);
      const nextNotes = inStore
        ? current.notes.map((item) => (item.id === id ? { ...item, ...patch } : item))
        : [...current.notes, ...seedNotes.filter((item) => item.id === id).map((item) => ({ ...item, ...patch }))];
      writeStore(key, { ...current, notes: nextNotes });
    },
    [key, seedNotes],
  );

  const remove = useCallback(
    (kind: "customer" | "contractor" | "vendor" | "reminder" | "task" | "note", id: string) => {
      const current = readStore(key);
      const nextKey = `${kind}:${id}`;
      writeStore(key, {
        ...current,
        deleted: current.deleted.includes(nextKey) ? current.deleted : [...current.deleted, nextKey],
      });
    },
    [key],
  );

  const updateContractor = useCallback(
    (id: string, patch: Partial<PortalContractor>) => {
      const current = readStore(key);
      const extra = current.contractors.find((item) => item.id === id);
      writeStore(key, {
        ...current,
        contractors: extra
          ? current.contractors.map((item) => (item.id === id ? { ...item, ...patch } : item))
          : current.contractors,
        contractorPatches: extra
          ? current.contractorPatches
          : { ...current.contractorPatches, [id]: { ...current.contractorPatches[id], ...patch } },
      });
    },
    [key],
  );

  const updateVendor = useCallback(
    (id: string, patch: Partial<PortalVendor>) => {
      const current = readStore(key);
      const extra = current.vendors.find((item) => item.id === id);
      writeStore(key, {
        ...current,
        vendors: extra
          ? current.vendors.map((item) => (item.id === id ? { ...item, ...patch } : item))
          : current.vendors,
        vendorPatches: extra
          ? current.vendorPatches
          : { ...current.vendorPatches, [id]: { ...current.vendorPatches[id], ...patch } },
      });
    },
    [key],
  );

  const setReminderStatus = useCallback(
    (id: string, status: PortalReminder["status"]) => {
      const current = readStore(key);
      const inStore = current.reminders.some((item) => item.id === id);
      const nextReminders = inStore
        ? current.reminders.map((item) => (item.id === id ? { ...item, status } : item))
        : [...current.reminders, ...seedReminders.filter((item) => item.id === id).map((item) => ({ ...item, status }))];
      writeStore(key, { ...current, reminders: nextReminders });
    },
    [key, seedReminders],
  );

  const setTaskStatus = useCallback(
    (id: string, status: PortalTask["status"]) => {
      const current = readStore(key);
      const inStore = current.tasks.some((item) => item.id === id);
      const nextTasks = inStore
        ? current.tasks.map((item) => (item.id === id ? { ...item, status } : item))
        : [...current.tasks, ...seedTasks.filter((item) => item.id === id).map((item) => ({ ...item, status }))];
      writeStore(key, { ...current, tasks: nextTasks });
    },
    [key, seedTasks],
  );

  return {
    customers,
    contractors,
    vendors,
    reminders,
    tasks,
    notes,
    employees,
    provider,
    addCustomer,
    addContractor,
    addVendor,
    addReminder,
    addTask,
    addNote,
    updateNote,
    updateContractor,
    updateVendor,
    remove,
    setReminderStatus,
    setTaskStatus,
  };
}
