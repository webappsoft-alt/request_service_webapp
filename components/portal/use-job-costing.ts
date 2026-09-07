"use client";

import { useCallback, useSyncExternalStore } from "react";
import { usePortalWorkspace } from "@/components/portal/use-portal-workspace";
import type { Job, JobItem } from "@/lib/types";

const EVENT = "rs-job-costing";

export type JobCostKind = "labor" | "materials";

export type JobCostLine = {
  id: string;
  description: string;
  kind: JobCostKind;
  quantity: number;
  unit: string;
  unitPrice: number;
};

type CostingStore = Record<string, JobCostLine[]>;

const EMPTY: CostingStore = {};
const snapshots = new Map<string, { raw: string; value: CostingStore }>();

function storageKey(email?: string) {
  return `rs-job-costing:${email ?? "guest"}`;
}

function readStore(key: string): CostingStore {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = window.localStorage.getItem(key) ?? "";
    const cached = snapshots.get(key);
    if (cached && cached.raw === raw) return cached.value;
    if (!raw) {
      snapshots.set(key, { raw, value: EMPTY });
      return EMPTY;
    }
    const parsed = JSON.parse(raw) as CostingStore;
    const value = parsed && typeof parsed === "object" ? parsed : EMPTY;
    snapshots.set(key, { raw, value });
    return value;
  } catch {
    return EMPTY;
  }
}

function writeStore(key: string, next: CostingStore) {
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

export function classifyJobLine(item: JobItem): JobCostKind {
  const text = item.description.toLowerCase();
  if (item.source === "change_order") return "materials";
  if (text.includes("labor")) return "labor";
  return "materials";
}

export function seedJobLines(job: Job): JobCostLine[] {
  const fromJob = job.items.map(toCostLine);
  const fromOrders = job.changeOrders.flatMap((order) => order.items.map(toCostLine));
  return [...fromJob, ...fromOrders];
}

function toCostLine(item: JobItem): JobCostLine {
  return {
    id: item.id,
    description: item.description,
    kind: classifyJobLine(item),
    quantity: item.quantity,
    unit: item.unit,
    unitPrice: item.unitPrice,
  };
}

export function lineTotal(line: JobCostLine) {
  return Math.round(line.quantity * line.unitPrice);
}

export function jobCostMix(lines: JobCostLine[]) {
  return lines.reduce(
    (acc, line) => {
      const total = lineTotal(line);
      acc.total += total;
      if (line.kind === "labor") acc.labor += total;
      else acc.materials += total;
      return acc;
    },
    { labor: 0, materials: 0, total: 0 },
  );
}

const TAX_RATE = 0.0825;

export function jobMoneySheet(mix: { labor: number; materials: number; total: number }) {
  const subtotal = mix.labor + mix.materials;
  const tax = Math.round(subtotal * TAX_RATE);
  return { labor: mix.labor, materials: mix.materials, subtotal, tax, total: subtotal + tax };
}

export function jobCostKindLabel(kind: JobCostKind) {
  switch (kind) {
    case "labor":
      return "Labor";
    case "materials":
      return "Materials";
    default: {
      const _never: never = kind;
      return _never;
    }
  }
}

export function readCostLines(email: string | undefined, job: Job): JobCostLine[] {
  return readStore(storageKey(email))[job.id] ?? seedJobLines(job);
}

export function writeCostLines(email: string | undefined, id: string, lines: JobCostLine[]) {
  const key = storageKey(email);
  writeStore(key, { ...readStore(key), [id]: lines });
}

export function copyCostLines(email: string | undefined, fromId: string, toId: string) {
  const key = storageKey(email);
  const store = readStore(key);
  const lines = store[fromId];
  if (!lines?.length) return;
  writeStore(key, { ...store, [toId]: lines });
}

export function useJobCosting(job: Job) {
  const { session } = usePortalWorkspace();
  const key = storageKey(session?.email);
  const store = useSyncExternalStore(
    subscribe,
    () => readStore(key),
    () => EMPTY,
  );
  const lines = store[job.id] ?? seedJobLines(job);
  const mix = jobCostMix(lines);

  const commit = useCallback(
    (next: JobCostLine[]) => {
      writeStore(key, { ...readStore(key), [job.id]: next });
    },
    [job.id, key],
  );

  const updateLine = useCallback(
    (id: string, patch: Partial<JobCostLine>) => {
      commit(lines.map((line) => (line.id === id ? { ...line, ...patch } : line)));
    },
    [commit, lines],
  );

  const addLine = useCallback(
    (kind: JobCostKind) => {
      const stamp = Date.now();
      commit([
        ...lines,
        {
          id: `extra_${kind}_${stamp}`,
          description: "",
          kind,
          quantity: 1,
          unit: kind === "labor" ? "hr" : "ea",
          unitPrice: 0,
        },
      ]);
    },
    [commit, lines],
  );

  const removeLine = useCallback(
    (id: string) => {
      commit(lines.filter((line) => line.id !== id));
    },
    [commit, lines],
  );

  return { lines, mix, updateLine, addLine, removeLine };
}
