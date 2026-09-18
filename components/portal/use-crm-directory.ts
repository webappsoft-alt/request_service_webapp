"use client";

import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { fetchCustomers } from "@/store/customersSlice";
import {
  archiveCustomer,
  createContractor as createContractorApi,
  createCustomer as createCustomerApi,
  createReminder as createReminderApi,
  createTask as createTaskApi,
  createVendor as createVendorApi,
  deleteContractor as deleteContractorApi,
  deleteReminder as deleteReminderApi,
  deleteTask as deleteTaskApi,
  deleteVendor as deleteVendorApi,
  updateContractor as updateContractorApi,
  updateReminderStatus as updateReminderStatusApi,
  updateTaskStatus as updateTaskStatusApi,
  updateVendor as updateVendorApi,
  updateCustomer as updateCustomerApi,
} from "@/lib/api/crm-client";
import { useCrmApiData } from "@/components/portal/use-crm-api-data";
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
  const dispatch = useAppDispatch();
  const reduxCustomers = useAppSelector((state) => state.customers?.items ?? []);
  const reduxLoading = useAppSelector((state) => state.customers?.loading ?? false);
  const { session, provider, employees } = usePortalWorkspace();
  const crm = useCrmApiData();
  const key = storageKey(session?.email);
  const store = useSyncExternalStore(
    subscribe,
    () => readStore(key),
    () => EMPTY,
  );
  const apiReady = crm.enabled && crm.ready;
  // Authenticated providers: never merge seed/demo people data.
  const suppressSeedData = Boolean(session) || (crm.enabled && !crm.ready);

  const seedCustomers = useMemo(
    () => (suppressSeedData ? [] : getCrmCustomers(provider)),
    [provider, suppressSeedData],
  );
  const seedContractors = useMemo(
    () => (suppressSeedData ? [] : getPortalContractors(provider)),
    [provider, suppressSeedData],
  );
  const seedVendors = useMemo(
    () => (suppressSeedData ? [] : getPortalVendors(provider)),
    [provider, suppressSeedData],
  );
  const seedReminders = useMemo(
    () => (suppressSeedData ? [] : getPortalReminders(provider)),
    [provider, suppressSeedData],
  );
  const seedTasks = useMemo(
    () => (suppressSeedData ? [] : getPortalTasks(provider)),
    [provider, suppressSeedData],
  );
  const seedNotes = useMemo(
    () => (suppressSeedData ? [] : getPortalNotes(provider)),
    [provider, suppressSeedData],
  );

  const customers = useMemo(() => {
    if (crm.customers && crm.customers.length > 0) return crm.customers;
    if (reduxCustomers && reduxCustomers.length > 0) return reduxCustomers;
    const local = store.customers.filter((item) => !store.deleted.includes(`customer:${item.id}`));
    if (local.length > 0) return local;
    if (apiReady && crm.customers) return crm.customers;
    if (suppressSeedData) return local;
    return [...seedCustomers, ...local];
  }, [apiReady, crm.customers, reduxCustomers, seedCustomers, store.customers, store.deleted, suppressSeedData]);

  useEffect(() => {
    if (crm.enabled && customers.length === 0 && !reduxLoading) {
      void dispatch(fetchCustomers({ limit: 100, force: true }));
    }
  }, [crm.enabled, customers.length, dispatch, reduxLoading]);

  const loading = crm.enabled && customers.length === 0 && (reduxLoading || !crm.ready);
  const contractors = useMemo(
    () =>
      apiReady
        ? crm.contractors
        : suppressSeedData
          ? store.contractors
              .filter((item) => !store.deleted.includes(`contractor:${item.id}`))
              .map((item) => ({ ...item, ...store.contractorPatches[item.id] }))
          : [...seedContractors, ...store.contractors]
              .filter((item) => !store.deleted.includes(`contractor:${item.id}`))
              .map((item) => ({ ...item, ...store.contractorPatches[item.id] })),
    [
      apiReady,
      crm.contractors,
      seedContractors,
      store.contractorPatches,
      store.contractors,
      store.deleted,
      suppressSeedData,
    ],
  );
  const vendors = useMemo(
    () =>
      apiReady
        ? crm.vendors
        : suppressSeedData
          ? store.vendors
              .filter((item) => !store.deleted.includes(`vendor:${item.id}`))
              .map((item) => ({ ...item, ...store.vendorPatches[item.id] }))
          : [...seedVendors, ...store.vendors]
              .filter((item) => !store.deleted.includes(`vendor:${item.id}`))
              .map((item) => ({ ...item, ...store.vendorPatches[item.id] })),
    [
      apiReady,
      crm.vendors,
      seedVendors,
      store.vendorPatches,
      store.vendors,
      store.deleted,
      suppressSeedData,
    ],
  );
  const reminders = useMemo(
    () =>
      apiReady
        ? crm.reminders
        : suppressSeedData
          ? store.reminders.filter((item) => !store.deleted.includes(`reminder:${item.id}`))
          : [...seedReminders, ...store.reminders].filter(
              (item) => !store.deleted.includes(`reminder:${item.id}`),
            ),
    [apiReady, crm.reminders, seedReminders, store.reminders, store.deleted, suppressSeedData],
  );
  const tasks = useMemo(
    () =>
      apiReady
        ? crm.tasks
        : suppressSeedData
          ? store.tasks.filter((item) => !store.deleted.includes(`task:${item.id}`))
          : [...seedTasks, ...store.tasks].filter((item) => !store.deleted.includes(`task:${item.id}`)),
    [apiReady, crm.tasks, seedTasks, store.tasks, store.deleted, suppressSeedData],
  );
  const notes = useMemo(
    () =>
      (suppressSeedData || apiReady
        ? store.notes
        : [...seedNotes, ...store.notes]
      ).filter((item) => !store.deleted.includes(`note:${item.id}`)),
    [apiReady, seedNotes, store.notes, store.deleted, suppressSeedData],
  );

  const addCustomer = useCallback(
    (customer: PortalCustomerCrm) => {
      // Use live API whenever the provider is authenticated — do not wait for
      // the full CRM snapshot (Customers list no longer bootstraps it).
      if (crm.enabled) {
        return (async () => {
          const created = await createCustomerApi(customer);
          void dispatch(fetchCustomers({ force: true, limit: 100 }));
          if (crm.ready) {
            await crm.refresh({ silent: true });
          }
          return created;
        })();
      }
      const current = readStore(key);
      writeStore(key, { ...current, customers: [...current.customers, customer] });
      return customer;
    },
    [crm, key],
  );

  const updateCustomer = useCallback(
    (id: string, patch: Partial<PortalCustomerCrm>) => {
      if (apiReady) {
        return (async () => {
          const currentCustomer = customers.find((item) => item.id === id);
          if (!currentCustomer) throw new Error("Customer not found");
          const updated = await updateCustomerApi(id, { ...currentCustomer, ...patch });
          await crm.refresh();
          return updated;
        })();
      }
      const current = readStore(key);
      const extra = current.customers.find((item) => item.id === id);
      writeStore(key, {
        ...current,
        customers: extra
          ? current.customers.map((item) => (item.id === id ? { ...item, ...patch } : item))
          : current.customers,
      });
    },
    [apiReady, crm, customers, key],
  );

  const addContractor = useCallback(
    (contractor: PortalContractor) => {
      if (apiReady) {
        return (async () => {
          const created = await createContractorApi(contractor);
          await crm.refresh();
          return created;
        })();
      }
      const current = readStore(key);
      writeStore(key, { ...current, contractors: [...current.contractors, contractor] });
      return contractor;
    },
    [apiReady, crm, key],
  );

  const addVendor = useCallback(
    (vendor: PortalVendor) => {
      if (apiReady) {
        return (async () => {
          const created = await createVendorApi(vendor);
          await crm.refresh();
          return created;
        })();
      }
      const current = readStore(key);
      writeStore(key, { ...current, vendors: [...current.vendors, vendor] });
      return vendor;
    },
    [apiReady, crm, key],
  );

  const addReminder = useCallback(
    (reminder: PortalReminder) => {
      if (apiReady) {
        return (async () => {
          const created = await createReminderApi(reminder);
          void crm.refresh({ silent: true });
          return created;
        })();
      }
      const current = readStore(key);
      writeStore(key, { ...current, reminders: [...current.reminders, reminder] });
      return reminder;
    },
    [apiReady, crm, key],
  );

  const addTask = useCallback(
    (task: PortalTask) => {
      // Match addCustomer: hit the API whenever the provider session is live —
      // do not wait for the full CRM snapshot (create was skipping POST).
      if (crm.enabled) {
        return (async () => {
          const created = await createTaskApi(task);
          void crm.refresh({ silent: true });
          return created;
        })();
      }
      const current = readStore(key);
      writeStore(key, { ...current, tasks: [...current.tasks, task] });
      return task;
    },
    [crm, key],
  );

  const addNote = useCallback(
    (note: PortalNote) => {
      if (apiReady && note.subjectKind === "customer" && note.subjectId) {
        const subjectId = note.subjectId;
        return (async () => {
          const customer =
            crm.customers.find((item) => item.id === subjectId) ??
            store.customers.find((item) => item.id === subjectId);
          const line = [note.title, note.body].filter(Boolean).join(": ").trim();
          const nextNotes = [customer?.notes?.trim(), line].filter(Boolean).join("\n\n");
          if (customer) {
            await updateCustomerApi(subjectId, { ...customer, notes: nextNotes });
          } else {
            await updateCustomerApi(subjectId, { notes: nextNotes });
          }
          const current = readStore(key);
          writeStore(key, { ...current, notes: [...current.notes, note] });
          crm.patchCustomer(subjectId, { notes: nextNotes });
          void crm.refresh({ silent: true });
          return note;
        })();
      }
      const current = readStore(key);
      writeStore(key, { ...current, notes: [...current.notes, note] });
      return note;
    },
    [apiReady, crm, key, store.customers],
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
      if (apiReady) {
        return (async () => {
          switch (kind) {
            case "customer":
              await archiveCustomer(id);
              break;
            case "contractor":
              await deleteContractorApi(id);
              break;
            case "vendor":
              await deleteVendorApi(id);
              break;
            case "reminder":
              await deleteReminderApi(id);
              break;
            case "task":
              await deleteTaskApi(id);
              break;
            case "note":
              break;
            default: {
              const _never: never = kind;
              return _never;
            }
          }
          if (kind !== "note") {
            await crm.refresh();
            return;
          }
          const current = readStore(key);
          const nextKey = `${kind}:${id}`;
          writeStore(key, {
            ...current,
            deleted: current.deleted.includes(nextKey)
              ? current.deleted
              : [...current.deleted, nextKey],
          });
        })();
      }
      const current = readStore(key);
      const nextKey = `${kind}:${id}`;
      writeStore(key, {
        ...current,
        deleted: current.deleted.includes(nextKey) ? current.deleted : [...current.deleted, nextKey],
      });
    },
    [apiReady, crm, key],
  );

  const updateContractor = useCallback(
    (id: string, patch: Partial<PortalContractor>) => {
      if (apiReady) {
        return (async () => {
          const updated = await updateContractorApi(id, patch);
          await crm.refresh();
          return updated;
        })();
      }
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
    [apiReady, crm, key],
  );

  const updateVendor = useCallback(
    (id: string, patch: Partial<PortalVendor>) => {
      if (apiReady) {
        return (async () => {
          const updated = await updateVendorApi(id, patch);
          await crm.refresh();
          return updated;
        })();
      }
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
    [apiReady, crm, key],
  );

  const setReminderStatus = useCallback(
    (id: string, status: PortalReminder["status"]) => {
      if (apiReady) {
        return (async () => {
          const updated = await updateReminderStatusApi(id, status);
          crm.patchReminder(id, { status: updated?.status ?? status });
          void crm.refresh({ silent: true });
          return updated;
        })();
      }
      const current = readStore(key);
      const inStore = current.reminders.some((item) => item.id === id);
      const nextReminders = inStore
        ? current.reminders.map((item) => (item.id === id ? { ...item, status } : item))
        : [...current.reminders, ...seedReminders.filter((item) => item.id === id).map((item) => ({ ...item, status }))];
      writeStore(key, { ...current, reminders: nextReminders });
    },
    [apiReady, crm, key, seedReminders],
  );

  const setTaskStatus = useCallback(
    (id: string, status: PortalTask["status"]) => {
      if (apiReady) {
        return (async () => {
          const updated = await updateTaskStatusApi(id, status);
          crm.patchTask(id, { status: updated?.status ?? status });
          void crm.refresh({ silent: true });
          return updated;
        })();
      }
      const current = readStore(key);
      const inStore = current.tasks.some((item) => item.id === id);
      const nextTasks = inStore
        ? current.tasks.map((item) => (item.id === id ? { ...item, status } : item))
        : [...current.tasks, ...seedTasks.filter((item) => item.id === id).map((item) => ({ ...item, status }))];
      writeStore(key, { ...current, tasks: nextTasks });
    },
    [apiReady, crm, key, seedTasks],
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
    updateCustomer,
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
    loading,
    ready: !crm.enabled || crm.ready,
    apiReady,
  };
}
