"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import {
  fetchCustomers,
  upsertCustomerTask,
  upsertCustomerReminder,
  removeCustomerTaskLocal,
  removeCustomerReminderLocal,
} from "@/store/customersSlice";
import { upsertTaskItem, removeTaskItemLocal } from "@/store/tasksSlice";
import { upsertReminderItem, removeReminderItemLocal } from "@/store/remindersSlice";
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
  queryCustomersByIds,
  CUSTOMERS_BY_ID_MAX,
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
  getPortalTasks,
  getPortalVendors,
  type PortalContractor,
  type PortalCustomerCrm,
  type PortalNote,
  type PortalReminder,
  type PortalTask,
  type PortalVendor,
} from "@/lib/data/crm-people";
import { useAppDispatch, useAppSelector } from "@/store/hooks";

const EVENT = "rs-crm-directory";

/**
 * Customers looked up by id for the records a page shows (names, the selected customer), when
 * neither the CRM snapshot nor the Customers Redux slice has them. Only the ids asked for are
 * fetched (≤50 per call), never a big page. Kept out of Redux so it never disturbs the Customers
 * page pagination; shared by every page for the session.
 */
const LOOKUP_EVENT = "rs-crm-directory-lookup";
const lookupById = new Map<string, PortalCustomerCrm>();
/** Ids asked for (fetched, in flight, or not found), so each is requested once. */
const lookupRequested = new Set<string>();

function ensureCustomersById(ids: string[]) {
  const missing = [...new Set(ids)].filter((id) => id && !lookupRequested.has(id));
  if (!missing.length) return;
  for (let start = 0; start < missing.length; start += CUSTOMERS_BY_ID_MAX) {
    const chunk = missing.slice(start, start + CUSTOMERS_BY_ID_MAX);
    chunk.forEach((id) => lookupRequested.add(id));
    void queryCustomersByIds(chunk)
      .then((items) => {
        items.forEach((item) => lookupById.set(item.id, item));
        window.dispatchEvent(new Event(LOOKUP_EVENT));
      })
      .catch(() => {
        // Let a later mount retry these.
        chunk.forEach((id) => lookupRequested.delete(id));
      });
  }
}

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

/**
 * @param options.customerIds customers this page shows (record owners, the selected customer):
 *   any not already loaded are fetched by id and included in `customers`. Without ids no
 *   customer list is fetched; customer pickers use the paged, searchable picker instead.
 * @param options.customerLookup false turns the by-id lookup off (pages that never read `customers`).
 */
export function useCrmDirectory({
  customerLookup = true,
  customerIds,
}: { customerLookup?: boolean; customerIds?: Array<string | null | undefined> } = {}) {
  const dispatch = useAppDispatch();
  const reduxCustomers = useAppSelector((state) => state.customers?.items ?? []);
  const reduxLoading = useAppSelector((state) => state.customers?.loading ?? false);
  const reduxTasks = useAppSelector((state) => state.tasks?.items ?? []);
  const reduxCustomerTasks = useAppSelector((state) => state.customers?.tasks?.items ?? []);
  const reduxReminders = useAppSelector((state) => state.reminders?.items ?? []);
  const reduxCustomerReminders = useAppSelector((state) => state.customers?.reminders?.items ?? []);
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
  const seedTasks = useMemo(
    () => (suppressSeedData ? [] : getPortalTasks(provider)),
    [provider, suppressSeedData],
  );
  const seedNotes = useMemo(
    () => (suppressSeedData ? [] : getPortalNotes(provider)),
    [provider, suppressSeedData],
  );

  // Stable key for the ids this page asked about (callers pass a fresh array each render).
  const wantedKey = useMemo(
    () => [...new Set((customerIds ?? []).map((id) => String(id || "").trim()).filter(Boolean))].sort().join(","),
    [customerIds],
  );
  const [lookupVersion, setLookupVersion] = useState(0);
  useEffect(() => {
    if (!customerLookup || !crm.enabled) return;
    const sync = () => setLookupVersion((value) => value + 1);
    window.addEventListener(LOOKUP_EVENT, sync);
    return () => window.removeEventListener(LOOKUP_EVENT, sync);
  }, [customerLookup, crm.enabled]);

  const baseCustomers = useMemo(() => {
    if (crm.customers && crm.customers.length > 0) return crm.customers;
    if (reduxCustomers && reduxCustomers.length > 0) return reduxCustomers;
    const local = store.customers.filter((item) => !store.deleted.includes(`customer:${item.id}`));
    if (local.length > 0) return local;
    if (apiReady && crm.customers) return crm.customers;
    if (suppressSeedData) return local;
    return [...seedCustomers, ...local];
  }, [apiReady, crm.customers, reduxCustomers, seedCustomers, store.customers, store.deleted, suppressSeedData]);

  useEffect(() => {
    if (!customerLookup || !crm.enabled || !wantedKey) return;
    const known = new Set(baseCustomers.map((item) => item.id));
    ensureCustomersById(wantedKey.split(",").filter((id) => !known.has(id)));
  }, [customerLookup, crm.enabled, wantedKey, baseCustomers]);

  // What the page had before, plus the customers looked up by id for it.
  const customers = useMemo(() => {
    if (!crm.enabled || !wantedKey) return baseCustomers;
    const known = new Set(baseCustomers.map((item) => item.id));
    const extra = wantedKey
      .split(",")
      .filter((id) => !known.has(id))
      .map((id) => lookupById.get(id))
      .filter((item): item is PortalCustomerCrm => Boolean(item));
    return extra.length ? [...baseCustomers, ...extra] : baseCustomers;
    // lookupVersion: re-read the module cache after a lookup lands.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseCustomers, crm.enabled, wantedKey, lookupVersion]);

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
  const reminders = useMemo(() => {
    // API / Redux only — no localStorage or seed demo reminders.
    const pool = [...(crm.reminders || []), ...(reduxReminders || []), ...(reduxCustomerReminders || [])];
    const map = new Map<string, PortalReminder>();
    for (const item of pool) {
      if (item?.id) map.set(item.id, item);
    }
    return Array.from(map.values());
  }, [crm.reminders, reduxReminders, reduxCustomerReminders]);

  const tasks = useMemo(() => {
    // Later sources win so Redux / local patches override a stale CRM snapshot.
    const pool = [
      ...(store.tasks || []),
      ...(crm.tasks || []),
      ...(reduxTasks || []),
      ...(reduxCustomerTasks || []),
    ];
    const map = new Map<string, PortalTask>();
    for (const item of pool) {
      if (item && item.id && !store.deleted.includes(`task:${item.id}`)) {
        map.set(item.id, item);
      }
    }
    if (map.size > 0) return Array.from(map.values());
    if (suppressSeedData) return [];
    return seedTasks.filter((item) => !store.deleted.includes(`task:${item.id}`));
  }, [
    crm.tasks,
    reduxTasks,
    reduxCustomerTasks,
    store.tasks,
    store.deleted,
    suppressSeedData,
    seedTasks,
  ]);
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
      // Authenticated provider — always POST to the API. Never invent local-only customers.
      if (!(crm.enabled || Boolean(session))) {
        throw new Error("Sign in as a provider to create customers.");
      }
      return (async () => {
        const created = await createCustomerApi(customer);
        if (!created?.id) {
          throw new Error("Customer was created but the server response could not be read.");
        }
        // Reload at the list's own page size (100 here filled the Customers table with 100 rows).
        await dispatch(fetchCustomers({ force: true }));
        if (crm.ready) {
          await crm.refresh({ silent: true });
        }
        return created;
      })();
    },
    [crm, dispatch, session],
  );

  const updateCustomer = useCallback(
    (id: string, patch: Partial<PortalCustomerCrm>) => {
      // Authenticated provider — always PUT; do not write local-only patches.
      if (!(crm.enabled || Boolean(session))) {
        throw new Error("Sign in as a provider to update customers.");
      }
      return (async () => {
        const currentCustomer =
          customers.find((item) => item.id === id) ||
          reduxCustomers.find((item) => item.id === id);
        if (!currentCustomer) throw new Error("Customer not found");
        const updated = await updateCustomerApi(id, { ...currentCustomer, ...patch });
        if (!updated?.id) {
          throw new Error("Customer was updated but the server response could not be read.");
        }
        // Reload at the list's own page size (100 here filled the Customers table with 100 rows).
        await dispatch(fetchCustomers({ force: true }));
        if (crm.ready) {
          await crm.refresh({ silent: true });
        }
        return updated;
      })();
    },
    [crm, customers, dispatch, reduxCustomers, session],
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
      if (!crm.enabled) {
        return Promise.reject(new Error("Sign in as a Pro to manage reminders."));
      }
      return (async () => {
        const created = await createReminderApi(reminder);
        const finalReminder = created || reminder;
        crm.addReminder(finalReminder);
        dispatch(upsertReminderItem(finalReminder));
        if (finalReminder.customerId) {
          dispatch(upsertCustomerReminder({ customerId: finalReminder.customerId, item: finalReminder }));
        }
        void crm.refresh({ silent: true });
        return finalReminder;
      })();
    },
    [crm, dispatch],
  );

  const addTask = useCallback(
    (task: PortalTask) => {
      if (crm.enabled) {
        return (async () => {
          const created = await createTaskApi(task);
          const finalTask = created || task;
          crm.addTask(finalTask);
          dispatch(upsertTaskItem(finalTask));
          if (finalTask.customerId) {
            dispatch(upsertCustomerTask({ customerId: finalTask.customerId, item: finalTask }));
          }
          void crm.refresh({ silent: true });
          return finalTask;
        })();
      }
      crm.addTask(task);
      const current = readStore(key);
      writeStore(key, { ...current, tasks: [task, ...current.tasks.filter((t) => t.id !== task.id)] });
      return task;
    },
    [crm, dispatch, key],
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
      if (kind === "reminder" || kind === "task") {
        if (!crm.enabled) {
          return Promise.reject(new Error("Sign in as a Pro to manage this record."));
        }
        return (async () => {
          if (kind === "reminder") {
            crm.removeReminder(id);
            dispatch(removeReminderItemLocal(id));
            dispatch(removeCustomerReminderLocal(id));
            await deleteReminderApi(id);
          } else {
            crm.removeTask(id);
            dispatch(removeTaskItemLocal(id));
            dispatch(removeCustomerTaskLocal(id));
            await deleteTaskApi(id);
          }
          await crm.refresh({ silent: true });
        })();
      }
      if (crm.enabled) {
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
            case "note":
              break;
            default: {
              const _never: never = kind;
              return _never;
            }
          }
          if (kind !== "note") {
            await crm.refresh({ silent: true });
          }
        })();
      }
      const current = readStore(key);
      const nextKey = `${kind}:${id}`;
      writeStore(key, {
        ...current,
        deleted: current.deleted.includes(nextKey) ? current.deleted : [...current.deleted, nextKey],
      });
    },
    [crm, dispatch, key],
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
      if (!crm.enabled) {
        return Promise.reject(new Error("Sign in as a Pro to manage reminders."));
      }
      return (async () => {
        crm.patchReminder(id, { status });
        const updated = await updateReminderStatusApi(id, status);
        if (updated) {
          crm.patchReminder(id, updated);
          dispatch(upsertReminderItem(updated));
          if (updated.customerId) {
            dispatch(upsertCustomerReminder({ customerId: updated.customerId, item: updated }));
          }
        }
        void crm.refresh({ silent: true });
        return updated;
      })();
    },
    [crm, dispatch],
  );

  const setTaskStatus = useCallback(
    (id: string, status: PortalTask["status"]) => {
      if (crm.enabled) {
        return (async () => {
          crm.patchTask(id, { status });
          const updated = await updateTaskStatusApi(id, status);
          if (updated) {
            crm.patchTask(id, updated);
            dispatch(upsertTaskItem(updated));
            if (updated.customerId) {
              dispatch(upsertCustomerTask({ customerId: updated.customerId, item: updated }));
            }
          }
          void crm.refresh({ silent: true });
          return updated;
        })();
      }
      crm.patchTask(id, { status });
      const current = readStore(key);
      const inStore = current.tasks.some((item) => item.id === id);
      const nextTasks = inStore
        ? current.tasks.map((item) => (item.id === id ? { ...item, status } : item))
        : [...current.tasks, ...seedTasks.filter((item) => item.id === id).map((item) => ({ ...item, status }))];
      writeStore(key, { ...current, tasks: nextTasks });
    },
    [crm, dispatch, key, seedTasks],
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
