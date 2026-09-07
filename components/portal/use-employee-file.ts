"use client";

import { useCallback, useSyncExternalStore } from "react";
import { usePortalWorkspace } from "@/components/portal/use-portal-workspace";
import type { JobAttachment } from "@/components/portal/use-job-file";
import type { PortalEmployee, PortalEmployeeRole } from "@/lib/data/portal";

const EVENT = "rs-employee-file";
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;

export type EmployeeDayHours = {
  day: number;
  off: boolean;
  start: string;
  end: string;
};

export type EmployeeNote = {
  id: string;
  at: string;
  title: string;
  body: string;
  actor: string;
};

export type EmployeePay = {
  hourlyRate: number;
  overtimeRate: number;
  travelRate: number;
};

export type PartnerOrder = {
  id: string;
  number: string;
  description: string;
  amount: number;
  status: "open" | "received" | "billed";
  jobId?: string;
  sku?: string;
  at: string;
};

export type VendorInventoryItem = {
  id: string;
  sku: string;
  name: string;
  unit: string;
  onHand: number;
  reorderAt: number;
  unitCost: number;
  location: string;
};

type EmployeeFileRecord = {
  availability: EmployeeDayHours[];
  pay: EmployeePay;
  notes: EmployeeNote[];
  attachments: JobAttachment[];
  orders: PartnerOrder[];
  inventory: VendorInventoryItem[];
};

type FileStore = Record<string, EmployeeFileRecord>;

const EMPTY: FileStore = {};
const snapshots = new Map<string, { raw: string; value: FileStore }>();

export function weekdayLabel(day: number) {
  return DAYS[day] ?? DAYS[0];
}

export function defaultAvailability(): EmployeeDayHours[] {
  return DAYS.map((_, day) => ({
    day,
    off: day === 0 || day === 6,
    start: "07:00",
    end: "19:00",
  }));
}

export function defaultPay(role: PortalEmployeeRole, employee?: PortalEmployee): EmployeePay {
  const hourly = employee?.hourlyRate ?? (role === "estimator" ? 55 : role === "dispatcher" ? 42 : role === "owner" ? 65 : 48);
  return {
    hourlyRate: hourly,
    overtimeRate: employee?.overtimeRate ?? Math.round(hourly * 1.5),
    travelRate: employee?.travelRate ?? 0,
  };
}

function storageKey(email?: string) {
  return `rs-employee-file:${email ?? "guest"}`;
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

function emptyFile(employee: PortalEmployee): EmployeeFileRecord {
  return {
    availability: defaultAvailability(),
    pay: defaultPay(employee.role, employee),
    notes: [],
    attachments: [],
    orders: [],
    inventory: [],
  };
}

export function defaultVendorInventory(category: string): VendorInventoryItem[] {
  const key = category.toLowerCase();
  if (key.includes("plumb")) {
    return [
      { id: "inv_wh50", sku: "WH-50G", name: "50-gal water heater", unit: "ea", onHand: 4, reorderAt: 2, unitCost: 680, location: "Aisle 3" },
      { id: "inv_cu34", sku: "CU-34", name: "3/4 copper pipe", unit: "ft", onHand: 120, reorderAt: 40, unitCost: 4.25, location: "Rack B" },
      { id: "inv_pex12", sku: "PEX-12", name: "1/2 PEX tubing", unit: "ft", onHand: 28, reorderAt: 50, unitCost: 0.85, location: "Rack B" },
      { id: "inv_valve", sku: "BV-34", name: "3/4 ball valve", unit: "ea", onHand: 18, reorderAt: 8, unitCost: 12.4, location: "Bin 12" },
      { id: "inv_flex", sku: "FLX-WH", name: "Water heater flex kit", unit: "ea", onHand: 6, reorderAt: 3, unitCost: 22, location: "Bin 8" },
    ];
  }
  if (key.includes("hvac")) {
    return [
      { id: "inv_filter", sku: "FLT-16x25", name: "16x25x1 filter", unit: "ea", onHand: 36, reorderAt: 12, unitCost: 6.5, location: "Shelf A" },
      { id: "inv_cap", sku: "CAP-45", name: "45 µF run capacitor", unit: "ea", onHand: 5, reorderAt: 6, unitCost: 18, location: "Bin 4" },
      { id: "inv_r410", sku: "R410A-25", name: "R-410A refrigerant", unit: "lb", onHand: 40, reorderAt: 20, unitCost: 22, location: "Cage" },
      { id: "inv_cont", sku: "CNT-40", name: "40A contactor", unit: "ea", onHand: 9, reorderAt: 4, unitCost: 28, location: "Bin 4" },
    ];
  }
  if (key.includes("janit") || key.includes("clean")) {
    return [
      { id: "inv_liner", sku: "BAG-33", name: "33-gal liners", unit: "cs", onHand: 8, reorderAt: 4, unitCost: 28, location: "Dock" },
      { id: "inv_chem", sku: "CLN-GAL", name: "Neutral cleaner", unit: "gal", onHand: 2, reorderAt: 3, unitCost: 14, location: "Cage" },
      { id: "inv_pad", sku: "PAD-RED", name: "Red buffing pads", unit: "pk", onHand: 11, reorderAt: 4, unitCost: 9, location: "Shelf C" },
    ];
  }
  return [
    { id: "inv_misc", sku: "GEN-001", name: "Shop stock", unit: "ea", onHand: 10, reorderAt: 4, unitCost: 15, location: "Shop" },
  ];
}

export function inventoryNeedsReorder(item: VendorInventoryItem) {
  return item.onHand <= item.reorderAt;
}

export function useEmployeeFile(employee: PortalEmployee) {
  const { session } = usePortalWorkspace();
  const key = storageKey(session?.email);
  const actor = [session?.firstName, session?.lastName].filter(Boolean).join(" ") || "Desk";
  const store = useSyncExternalStore(
    subscribe,
    () => readStore(key),
    () => EMPTY,
  );
  const stored = store[employee.id] ?? emptyFile(employee);

  const commit = useCallback(
    (next: EmployeeFileRecord) => {
      writeStore(key, { ...readStore(key), [employee.id]: next });
    },
    [employee.id, key],
  );

  const current = useCallback((): EmployeeFileRecord => {
    return readStore(key)[employee.id] ?? emptyFile(employee);
  }, [employee, key]);

  return {
    actor,
    availability: stored.availability,
    pay: stored.pay,
    notes: stored.notes.slice().sort((a, b) => (a.at < b.at ? 1 : -1)),
    attachments: stored.attachments,
    orders: (stored.orders ?? []).slice().sort((a, b) => (a.at < b.at ? 1 : -1)),
    inventory: stored.inventory ?? [],
    saveAvailability: (availability: EmployeeDayHours[]) => {
      commit({ ...current(), availability });
    },
    savePay: (pay: EmployeePay) => {
      commit({ ...current(), pay });
    },
    addNote: (title: string, body: string) => {
      const latest = current();
      commit({
        ...latest,
        notes: [
          { id: `note_${Date.now()}`, at: new Date().toISOString(), title, body, actor },
          ...latest.notes,
        ],
      });
    },
    removeNote: (id: string) => {
      const latest = current();
      commit({ ...latest, notes: latest.notes.filter((item) => item.id !== id) });
    },
    addAttachments: (files: JobAttachment[]) => {
      const latest = current();
      commit({ ...latest, attachments: [...files, ...latest.attachments] });
    },
    removeAttachment: (id: string) => {
      const latest = current();
      commit({ ...latest, attachments: latest.attachments.filter((item) => item.id !== id) });
    },
    addOrder: (order: Omit<PartnerOrder, "id" | "at">) => {
      const latest = current();
      commit({
        ...latest,
        orders: [
          { ...order, id: `po_${Date.now()}`, at: new Date().toISOString() },
          ...(latest.orders ?? []),
        ],
      });
    },
    setOrderStatus: (id: string, status: PartnerOrder["status"]) => {
      const latest = current();
      commit({
        ...latest,
        orders: (latest.orders ?? []).map((item) => (item.id === id ? { ...item, status } : item)),
      });
    },
    removeOrder: (id: string) => {
      const latest = current();
      commit({ ...latest, orders: (latest.orders ?? []).filter((item) => item.id !== id) });
    },
    replaceInventory: (inventory: VendorInventoryItem[]) => {
      commit({ ...current(), inventory });
    },
  };
}
