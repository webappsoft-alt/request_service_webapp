"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { isLocalInvoicePortalKey } from "@/lib/api/crm-mappers";

export type OpenRecord = {
  href: string;
  label: string;
  kind: string;
};

const EVENT = "rs-open-records";
const KEY = "rs-open-records";
const EMPTY: OpenRecord[] = [];

let cachedRaw = "";
let cached: OpenRecord[] = EMPTY;

function isStaleInvoiceHref(href: string) {
  const match = href.match(/\/pro\/dashboard\/invoices\/([^/?#]+)/i);
  if (!match?.[1]) return false;
  try {
    return isLocalInvoicePortalKey(decodeURIComponent(match[1]));
  } catch {
    return isLocalInvoicePortalKey(match[1]);
  }
}

function pruneStale(records: OpenRecord[]) {
  return records.filter((item) => !isStaleInvoiceHref(item.href));
}

function read(): OpenRecord[] {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = window.sessionStorage.getItem(KEY) ?? "";
    if (raw === cachedRaw) return cached;
    cachedRaw = raw;
    if (!raw) {
      cached = EMPTY;
      return cached;
    }
    const parsed = JSON.parse(raw) as OpenRecord[];
    const list = Array.isArray(parsed) ? parsed : EMPTY;
    const pruned = pruneStale(list);
    if (pruned.length !== list.length) {
      cached = pruned;
      cachedRaw = JSON.stringify(pruned);
      window.sessionStorage.setItem(KEY, cachedRaw);
      return cached;
    }
    cached = list;
    return cached;
  } catch {
    return EMPTY;
  }
}

function write(next: OpenRecord[]) {
  const pruned = pruneStale(next);
  cached = pruned;
  cachedRaw = JSON.stringify(pruned);
  window.sessionStorage.setItem(KEY, cachedRaw);
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(onStoreChange: () => void) {
  window.addEventListener(EVENT, onStoreChange);
  return () => window.removeEventListener(EVENT, onStoreChange);
}

export function useOpenRecords() {
  const records = useSyncExternalStore(subscribe, read, () => EMPTY);

  const openRecord = useCallback((record: OpenRecord) => {
    if (isStaleInvoiceHref(record.href)) return;
    const current = read();
    if (current.some((item) => item.href === record.href)) return;
    write([...current, record].slice(-8));
  }, []);

  const closeRecord = useCallback((href: string) => {
    write(read().filter((item) => item.href !== href));
  }, []);

  return { records, openRecord, closeRecord };
}

export function RecordOpener({ href, label, kind }: OpenRecord) {
  const { openRecord } = useOpenRecords();
  useEffect(() => {
    openRecord({ href, label, kind });
  }, [href, kind, label, openRecord]);
  return null;
}
