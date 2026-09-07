"use client";

import { useCallback, useSyncExternalStore } from "react";
import { usePortalWorkspace } from "@/components/portal/use-portal-workspace";
import { cloneWorkingHours } from "@/lib/data/portal";
import type { WorkingHours } from "@/lib/types";

const EVENT = "rs-portal-settings";

type SettingsStore = {
  workingHours: WorkingHours[];
};

const EMPTY: SettingsStore = {
  workingHours: [],
};
const snapshots = new Map<string, { raw: string; value: SettingsStore }>();

function storageKey(email?: string) {
  return `rs-portal-settings:${email ?? "guest"}`;
}

function readStore(key: string): SettingsStore {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = window.localStorage.getItem(key) ?? "";
    const cached = snapshots.get(key);
    if (cached && cached.raw === raw) return cached.value;
    if (!raw) {
      snapshots.set(key, { raw, value: EMPTY });
      return EMPTY;
    }
    const parsed = JSON.parse(raw) as SettingsStore;
    const value: SettingsStore = {
      workingHours: parsed.workingHours ?? [],
    };
    snapshots.set(key, { raw, value });
    return value;
  } catch {
    return EMPTY;
  }
}

function writeStore(key: string, next: SettingsStore) {
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

export function usePortalSettings() {
  const { session, provider } = usePortalWorkspace();
  const key = storageKey(session?.email);
  const store = useSyncExternalStore(
    subscribe,
    () => readStore(key),
    () => EMPTY,
  );

  const officeHours = store.workingHours.length
    ? store.workingHours
    : cloneWorkingHours(provider.workingHours);

  const saveOfficeHours = useCallback(
    (hours: WorkingHours[]) => {
      const current = readStore(key);
      writeStore(key, { ...current, workingHours: cloneWorkingHours(hours) });
    },
    [key],
  );

  return {
    officeHours,
    saveOfficeHours,
  };
}
