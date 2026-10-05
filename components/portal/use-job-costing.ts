"use client";

import { useCallback, useSyncExternalStore } from "react";
import { usePortalWorkspace } from "@/components/portal/use-portal-workspace";
import type { Job, JobItem } from "@/lib/types";

const EVENT = "rs-job-costing";

export type JobCostKind = "labor" | "materials" | "equipment";

export type JobCostLine = {
  id: string;
  description: string;
  kind: JobCostKind;
  quantity: number;
  unit: string;
  unitPrice: number;
  /** Optional material photos (URLs). Cleared when kind is labor. */
  images?: string[];
  /** Named work section (e.g. Plumbing). Empty = General / unsectioned. */
  section?: string;
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
  if (item.kind === "labor" || item.kind === "materials" || item.kind === "equipment") {
    return item.kind;
  }
  if (item.source === "change_order") return "materials";
  const text = item.description.toLowerCase();
  // Match US "labor" and UK "labour" (e.g. "LABOUR WORK").
  if (text.includes("labor") || text.includes("labour")) return "labor";
  if (String(item.unit || "").trim().toLowerCase() === "hr") return "labor";
  if (text.includes("equipment")) return "equipment";
  return "materials";
}

/** Repair misclassified lines (e.g. localStorage seeded before labour spelling was handled). */
export function repairCostLineKind(line: JobCostLine): JobCostLine {
  const text = line.description.toLowerCase();
  const looksLikeLabor =
    text.includes("labor") ||
    text.includes("labour") ||
    String(line.unit || "").trim().toLowerCase() === "hr";
  if (looksLikeLabor && line.kind !== "labor") {
    return { ...line, kind: "labor" };
  }
  return line;
}

export function seedJobLines(job: Job): JobCostLine[] {
  // Original job lines only — change orders stay in their own section.
  return job.items.map(toCostLine);
}

function toCostLine(item: JobItem): JobCostLine {
  const kind = classifyJobLine(item);
  const images =
    kind === "materials"
      ? (Array.isArray(item.images) ? item.images : [])
          .map((src) => String(src || "").trim())
          .filter(Boolean)
      : [];
  const section = String(item.section || "").trim();
  return {
    id: item.id,
    description: item.description,
    kind,
    quantity: item.quantity,
    unit: item.unit,
    unitPrice: item.unitPrice,
    ...(kind === "materials" ? { images } : {}),
    ...(section ? { section } : {}),
  };
}

export function lineTotal(line: JobCostLine) {
  const qty = Number(line.quantity);
  const price = Number(line.unitPrice);
  if (!Number.isFinite(qty) || !Number.isFinite(price)) return 0;
  // Money to 2 decimal places (cents).
  return Math.round(qty * price * 100) / 100;
}

export function jobCostMix(lines: JobCostLine[]) {
  return lines.reduce(
    (acc, line) => {
      const total = lineTotal(line);
      acc.total += total;
      if (line.kind === "labor") acc.labor += total;
      else if (line.kind === "equipment") acc.equipment += total;
      else acc.materials += total;
      return acc;
    },
    { labor: 0, materials: 0, equipment: 0, total: 0 },
  );
}

export function jobMoneySheet(
  mix: { labor: number; materials: number; total: number; equipment?: number },
  /** Sales tax percent (e.g. 8.25). 0 = no tax. */
  taxRatePercent = 0,
) {
  const equipment = Number(mix.equipment) || 0;
  const subtotal = mix.labor + mix.materials + equipment;
  const rate = Math.max(0, Number(taxRatePercent) || 0);
  // Match backend calculateTotals: cents-correct rounding.
  const tax = Math.round(((subtotal * rate) / 100) * 100) / 100;
  return {
    labor: mix.labor,
    materials: mix.materials,
    equipment,
    subtotal,
    tax,
    total: subtotal + tax,
  };
}

export function jobCostKindLabel(kind: JobCostKind) {
  switch (kind) {
    case "labor":
      return "Labour";
    case "materials":
      return "Material";
    case "equipment":
      return "Equipment";
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

export function useJobCosting(job: Job, options?: { preferApi?: boolean }) {
  const { session } = usePortalWorkspace();
  const key = storageKey(session?.email);
  const store = useSyncExternalStore(
    subscribe,
    () => readStore(key),
    () => EMPTY,
  );
  const seeded = seedJobLines(job).map(repairCostLineKind);
  const stored = store[job.id]?.map(repairCostLineKind);
  // Prefer API/seed data; if local cache exists, still restore material images from seed
  // when the cache row is missing them (stale localStorage from before image support).
  const lines = (() => {
    if (options?.preferApi || !stored?.length) return seeded;
    return stored.map((line) => {
      if (line.kind !== "materials" || (line.images && line.images.length)) return line;
      const match =
        seeded.find((item) => item.id === line.id) ||
        seeded.find(
          (item) =>
            item.kind === "materials" &&
            (item.description || "").trim() === (line.description || "").trim(),
        );
      if (match?.images?.length) return { ...line, images: match.images };
      return line;
    });
  })();
  const mix = jobCostMix(lines);

  const commit = useCallback(
    (next: JobCostLine[]) => {
      if (options?.preferApi) return;
      writeStore(key, { ...readStore(key), [job.id]: next });
    },
    [job.id, key, options?.preferApi],
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

  return { lines, mix, commit, updateLine, addLine, removeLine };
}
