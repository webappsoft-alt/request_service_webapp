"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import { readCostLines } from "@/components/portal/use-job-costing";
import { estimateAsJob, moneyFromLines } from "@/components/portal/work-builders";
import { stripChangeRequestLinesFromNotes } from "@/lib/data/estimate-change-requests";
import type { Estimate } from "@/lib/types";

const EVENT = "rs-estimate-share";
const KEY = "rs-estimate-share";
const RECORDS_EVENT = "rs-portal-records";

export type EstimateShareLine = {
  description: string;
  kind: "labor" | "materials" | "equipment";
  quantity: number;
  unit: string;
  unitPrice: number;
  total: number;
  /** Optional material photos shown to the customer. */
  images?: string[];
  /** Named work section (e.g. Plumbing). */
  section?: string;
};

export type EstimateSiteVisitPhoto = {
  id: string;
  name: string;
  url: string;
  type?: string;
  size?: number;
  addedAt?: string;
  actor?: string;
};

export type EstimateShareSiteVisit = {
  employeeId?: string;
  technician?: string;
  visitedAt?: string;
  accessNotes?: string;
  findings?: string;
  recommendations?: string;
  measurements?: string;
  photos: EstimateSiteVisitPhoto[];
};

export type EstimateShareSnapshot = {
  token: string;
  estimateId: string;
  number: string;
  companyName: string;
  companyEmail: string;
  companyPhone: string;
  companyStreet?: string;
  companyCity?: string;
  companyState?: string;
  companyZip?: string;
  logoUrl?: string;
  logoInitials?: string;
  licensed?: boolean;
  insured?: boolean;
  providerEmail?: string;
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  street: string;
  city: string;
  state: string;
  zip: string;
  issuedAt: string;
  expiresAt?: string;
  notes?: string;
  terms?: string;
  items: EstimateShareLine[];
  subtotal: number;
  /** Optional dollar discount applied before tax. */
  discount?: number;
  tax: number;
  /** Sales tax percent used for this quote (e.g. 3). */
  taxRatePercent?: number;
  total: number;
  createdAt: string;
  status?: string;
  companySignedBy?: string;
  companySignedAt?: string;
  companySignatureDataUrl?: string;
  siteVisit?: EstimateShareSiteVisit;
  /** Pro revisions visible to the customer on the same shared estimate. */
  customerUpdates?: Array<{
    summary: string;
    details?: string;
    totalBefore?: number | null;
    totalAfter?: number | null;
    at: string;
  }>;
  changeRequests?: Array<{
    reason: string;
    at: string;
    addressedAt?: string | null;
  }>;
};

export type EstimateApproval = {
  estimateId: string;
  signedBy: string;
  signedAt: string;
  signatureDataUrl: string;
};

type ShareStore = {
  snapshots: Record<string, EstimateShareSnapshot>;
  approvals: Record<string, EstimateApproval>;
};

const EMPTY: ShareStore = { snapshots: {}, approvals: {} };
const snapshots = new Map<string, { raw: string; value: ShareStore }>();

export function shareTokenFor(estimateId: string) {
  return `s_${estimateId}`;
}

/** Public customer estimate path: /e/{shareToken} */
export function sharePath(token: string) {
  const cleaned = String(token || "")
    .trim()
    .replace(/^\/+/, "")
    .replace(/^e\//i, "");
  return `/e/${cleaned}`;
}

/**
 * Live customer-facing site origin from `live_domain_url` /
 * `NEXT_PUBLIC_LIVE_DOMAIN_URL`. Prefer the configured live domain over the
 * current tab origin so Open customer view matches email links.
 */
export function customerSiteOrigin(): string {
  const fromEnv = String(
    process.env.NEXT_PUBLIC_LIVE_DOMAIN_URL ||
      process.env.NEXT_PUBLIC_live_domain_url ||
      "",
  )
    .trim()
    .replace(/^["']|["']$/g, "")
    .replace(/\/+$/, "");
  if (fromEnv) return fromEnv;
  if (typeof window !== "undefined") {
    return window.location.origin.replace(/\/+$/, "");
  }
  return "";
}

/** Same public estimate URL used by email "Review & sign" and Open customer view. */
export function shareUrlFor(token: string, options?: { accept?: boolean }) {
  const path = sharePath(token);
  const origin = customerSiteOrigin();
  const accept = options?.accept !== false;
  const qs = accept ? "?accept=1" : "";
  if (!origin) return `${path}${qs}`;
  return `${origin}${path}${qs}`;
}

export function buildEstimateSnapshot(
  estimate: Estimate,
  extras: {
    token?: string;
    email?: string;
    companyName: string;
    companyEmail: string;
    companyPhone: string;
    companyStreet?: string;
    companyCity?: string;
    companyState?: string;
    companyZip?: string;
    logoUrl?: string;
    logoInitials?: string;
    licensed?: boolean;
    insured?: boolean;
    customerName: string;
    customerEmail?: string;
    customerPhone?: string;
    companySignedBy?: string;
    companySignedAt?: string;
    companySignatureDataUrl?: string;
  },
): EstimateShareSnapshot {
  const token = extras.token || estimate.shareToken || shareTokenFor(estimate.id);
  // Share/PDF must use estimate items (with section). Local cost cache often
  // predates section support and would flatten everything into one table.
  const fromEstimate = estimate.items.map((item) => ({
    id: item.id,
    description: item.description,
    kind:
      item.type === "labor"
        ? ("labor" as const)
        : item.type === "equipment"
          ? ("equipment" as const)
          : ("materials" as const),
    quantity: item.quantity,
    unit: item.unit,
    unitPrice: item.unitPrice,
    ...(item.images?.length ? { images: item.images } : {}),
    ...(String(item.section || "").trim()
      ? { section: String(item.section).trim() }
      : {}),
  }));
  const stored = readCostLines(extras.email, estimateAsJob(estimate));
  const lines = fromEstimate.length
    ? fromEstimate.map((item) => {
        const match =
          stored.find((line) => line.id === item.id) ||
          stored.find(
            (line) =>
              (line.description || "").trim() === (item.description || "").trim() &&
              line.kind === item.kind,
          );
        if (!match) return item;
        // Keep section from the saved estimate; allow local qty/price edits.
        return {
          ...item,
          quantity: match.quantity,
          unit: match.unit || item.unit,
          unitPrice: match.unitPrice,
          ...(match.kind === "materials" && match.images?.length
            ? { images: match.images }
            : {}),
          ...(item.section
            ? { section: item.section }
            : match.section
              ? { section: match.section }
              : {}),
        };
      })
    : stored;
  const taxRatePercent = Math.max(
    0,
    Number(estimate.items?.[0]?.taxRate) || 0,
  );
  const money = moneyFromLines(lines, taxRatePercent);
  const companySig = estimate.companySignature;
  const companySignedBy =
    extras.companySignedBy || companySig?.signedBy || undefined;
  const companySignedAt =
    extras.companySignedAt || companySig?.signedAt || undefined;
  const companySignatureDataUrl =
    extras.companySignatureDataUrl ||
    companySig?.imageBase64 ||
    (companySig as { signatureImageBase64?: string } | undefined)
      ?.signatureImageBase64 ||
    undefined;
  return {
    token,
    estimateId: estimate.id,
    number: estimate.number,
    companyName: extras.companyName,
    companyEmail: extras.companyEmail,
    companyPhone: extras.companyPhone,
    companyStreet: extras.companyStreet,
    companyCity: extras.companyCity,
    companyState: extras.companyState,
    companyZip: extras.companyZip,
    logoUrl: extras.logoUrl,
    logoInitials: extras.logoInitials,
    licensed: extras.licensed,
    insured: extras.insured,
    providerEmail: extras.email,
    customerName: extras.customerName,
    customerEmail: extras.customerEmail,
    customerPhone: extras.customerPhone,
    street: estimate.propertyAddress.street,
    city: estimate.propertyAddress.city,
    state: estimate.propertyAddress.state,
    zip: estimate.propertyAddress.zip,
    issuedAt: estimate.issuedAt,
    expiresAt: estimate.expiresAt,
    notes: stripChangeRequestLinesFromNotes(estimate.notes) || undefined,
    terms: estimate.terms,
    items: lines.map((line) => ({
      description: line.description,
      kind: line.kind,
      quantity: line.quantity,
      unit: line.unit,
      unitPrice: line.unitPrice,
      total: Math.round(line.quantity * line.unitPrice * 100) / 100,
      ...(line.kind === "materials" && line.images?.length
        ? { images: line.images }
        : {}),
      ...(line.section ? { section: line.section } : {}),
    })),
    subtotal: estimate.subtotal ?? money.subtotal,
    discount: Math.max(0, Number(estimate.discount) || 0) || undefined,
    tax: estimate.tax ?? money.tax,
    taxRatePercent,
    total: estimate.total ?? money.total,
    createdAt: new Date().toISOString(),
    companySignedBy,
    companySignedAt,
    companySignatureDataUrl,
    siteVisit: estimate.siteVisit
      ? {
          employeeId: estimate.siteVisit.employeeId,
          technician: estimate.siteVisit.technician,
          visitedAt: estimate.siteVisit.visitedAt,
          accessNotes: estimate.siteVisit.accessNotes,
          findings: estimate.siteVisit.findings,
          recommendations: estimate.siteVisit.recommendations,
          measurements: estimate.siteVisit.measurements,
          photos: (estimate.siteVisit.photos || []).map((p) => ({
            id: p.id,
            name: p.name,
            url: p.url,
            type: p.type,
            size: p.size,
            addedAt: p.addedAt,
            actor: p.actor,
          })),
        }
      : undefined,
    changeRequests: (estimate.changeRequests || []).map((row) => ({
      reason: row.reason,
      at: row.at,
      addressedAt: row.addressedAt || null,
    })),
    customerUpdates: (estimate.customerUpdates || []).map((row) => ({
      summary: row.summary,
      details: row.details,
      totalBefore: row.totalBefore ?? null,
      totalAfter: row.totalAfter ?? null,
      at: row.at,
    })),
  };
}

function readStore(): ShareStore {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = window.localStorage.getItem(KEY) ?? "";
    const cached = snapshots.get(KEY);
    if (cached && cached.raw === raw) return cached.value;
    if (!raw) {
      snapshots.set(KEY, { raw, value: EMPTY });
      return EMPTY;
    }
    const parsed = JSON.parse(raw) as ShareStore;
    const value: ShareStore = {
      snapshots: parsed.snapshots ?? {},
      approvals: parsed.approvals ?? {},
    };
    snapshots.set(KEY, { raw, value });
    return value;
  } catch {
    return EMPTY;
  }
}

function writeStore(next: ShareStore) {
  window.localStorage.setItem(KEY, JSON.stringify(next));
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

function markPortalAccepted(providerEmail: string | undefined, estimateId: string) {
  if (!providerEmail || typeof window === "undefined") return;
  const key = `rs-portal-records:${providerEmail}`;
  try {
    const raw = window.localStorage.getItem(key);
    const parsed = raw ? (JSON.parse(raw) as { status?: Record<string, string> }) : {};
    const status = { ...(parsed.status ?? {}), [`estimate:${estimateId}`]: "accepted" };
    window.localStorage.setItem(key, JSON.stringify({ ...parsed, status }));
    window.dispatchEvent(new Event(RECORDS_EVENT));
  } catch {
    return;
  }
}

export function useEstimateShare() {
  const store = useSyncExternalStore(subscribe, readStore, () => EMPTY);

  const snapshotOf = useCallback((token: string) => store.snapshots[token], [store.snapshots]);
  const snapshotForEstimate = useCallback(
    (estimateId: string) =>
      Object.values(store.snapshots)
        .filter((snapshot) => snapshot.estimateId === estimateId)
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0],
    [store.snapshots],
  );

  const approvalOf = useCallback(
    (estimateId: string) => store.approvals[estimateId],
    [store.approvals],
  );

  const saveSnapshot = useCallback((snapshot: EstimateShareSnapshot) => {
    const current = readStore();
    const snapshotsForOtherEstimates = Object.fromEntries(
      Object.entries(current.snapshots).filter(([, existing]) => existing.estimateId !== snapshot.estimateId),
    );
    writeStore({
      ...current,
      snapshots: { ...snapshotsForOtherEstimates, [snapshot.token]: snapshot },
    });
  }, []);

  const approve = useCallback((snapshot: EstimateShareSnapshot, signedBy: string, signatureDataUrl: string) => {
    const current = readStore();
    const approval: EstimateApproval = {
      estimateId: snapshot.estimateId,
      signedBy,
      signedAt: new Date().toISOString(),
      signatureDataUrl,
    };
    writeStore({
      ...current,
      approvals: { ...current.approvals, [snapshot.estimateId]: approval },
    });
    markPortalAccepted(snapshot.providerEmail, snapshot.estimateId);
    return approval;
  }, []);

  return useMemo(
    () => ({ snapshotOf, snapshotForEstimate, approvalOf, saveSnapshot, approve }),
    [snapshotOf, snapshotForEstimate, approvalOf, saveSnapshot, approve],
  );
}
