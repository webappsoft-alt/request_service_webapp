"use client";

import { useCallback, useSyncExternalStore } from "react";
import { readCostLines } from "@/components/portal/use-job-costing";
import { estimateAsJob, moneyFromLines } from "@/components/portal/work-builders";
import type { Estimate } from "@/lib/types";

const EVENT = "rs-estimate-share";
const KEY = "rs-estimate-share";
const RECORDS_EVENT = "rs-portal-records";

export type EstimateShareLine = {
  description: string;
  kind: "labor" | "materials";
  quantity: number;
  unit: string;
  unitPrice: number;
  total: number;
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
  tax: number;
  total: number;
  createdAt: string;
  companySignedBy?: string;
  companySignedAt?: string;
  companySignatureDataUrl?: string;
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

export function sharePath(token: string) {
  return `/e/${token}`;
}

export function shareUrlFor(token: string) {
  if (typeof window === "undefined") return sharePath(token);
  return `${window.location.origin}${sharePath(token)}`;
}

export function buildEstimateSnapshot(
  estimate: Estimate,
  extras: {
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
  const token = shareTokenFor(estimate.id);
  const stored = readCostLines(extras.email, estimateAsJob(estimate));
  const lines = stored.length
    ? stored
    : estimate.items.map((item) => ({
        id: item.id,
        description: item.description,
        kind: item.type === "labor" ? ("labor" as const) : ("materials" as const),
        quantity: item.quantity,
        unit: item.unit,
        unitPrice: item.unitPrice,
      }));
  const money = moneyFromLines(lines);
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
    notes: estimate.notes,
    terms: estimate.terms,
    items: lines.map((line) => ({
      description: line.description,
      kind: line.kind,
      quantity: line.quantity,
      unit: line.unit,
      unitPrice: line.unitPrice,
      total: Math.round(line.quantity * line.unitPrice),
    })),
    subtotal: money.subtotal || estimate.subtotal,
    tax: money.tax || estimate.tax,
    total: money.total || estimate.total,
    createdAt: new Date().toISOString(),
    companySignedBy: extras.companySignedBy,
    companySignedAt: extras.companySignedAt,
    companySignatureDataUrl: extras.companySignatureDataUrl,
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

  const approvalOf = useCallback(
    (estimateId: string) => store.approvals[estimateId],
    [store.approvals],
  );

  const saveSnapshot = useCallback((snapshot: EstimateShareSnapshot) => {
    const current = readStore();
    writeStore({
      ...current,
      snapshots: { ...current.snapshots, [snapshot.token]: snapshot },
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

  return { snapshotOf, approvalOf, saveSnapshot, approve };
}
