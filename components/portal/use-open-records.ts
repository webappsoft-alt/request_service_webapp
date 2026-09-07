"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";

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
    cached = Array.isArray(parsed) ? parsed : EMPTY;
    return cached;
  } catch {
    return EMPTY;
  }
}

function write(next: OpenRecord[]) {
  cached = next;
  cachedRaw = JSON.stringify(next);
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
