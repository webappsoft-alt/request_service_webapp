"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { subscribeRealtime } from "@/components/realtime/realtime-provider";
import { applyLocationUpdate, toDateKey } from "@/lib/tracking";
import { useAppDispatch, useAppSelector, useAppStore } from "@/store/hooks";
import { fetchLiveWorkers, liveWorkersUpdated, selectLiveDay } from "@/store/trackingSlice";

/** Ticks every 30 s so "Updated x mins ago" labels stay current without refetching. */
export function useNow(intervalMs = 30_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(timer);
  }, [intervalMs]);
  return now;
}

/**
 * Everyone's last position on `dateKey` (default today), from the tracking slice: cached
 * markers show at once and a fresh copy loads in the background. For today, socket updates
 * then move the markers in place (a refetch only when someone new appears).
 */
export function useLiveWorkers(dateKey?: string) {
  const day = dateKey || toDateKey(new Date());
  const isToday = day === toDateKey(new Date());
  const dispatch = useAppDispatch();
  const store = useAppStore();
  const entry = useAppSelector((state) => selectLiveDay(state, day));
  const refetchTimer = useRef<number | null>(null);

  const load = useCallback(() => {
    void dispatch(fetchLiveWorkers({ dateKey: day }));
  }, [day, dispatch]);

  // Every visit refreshes; with a cached copy the page shows it meanwhile (no spinner).
  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!isToday) return;
    const unsubscribe = subscribeRealtime((detail) => {
      if (detail?.type !== "WORKER_LOCATION_UPDATED") return;
      const payload = (detail.payload || {}) as Record<string, unknown>;
      const next = applyLocationUpdate(selectLiveDay(store.getState(), day).items, payload);
      if (next) {
        dispatch(liveWorkersUpdated({ dateKey: day, items: next }));
        return;
      }
      // Someone not on the map yet: fetch once for their name (coalesced).
      if (refetchTimer.current) return;
      refetchTimer.current = window.setTimeout(() => {
        refetchTimer.current = null;
        load();
      }, 1500);
    });
    // Coming back to the tab after a while: catch up in one request.
    const onVisible = () => {
      if (document.visibilityState === "visible") load();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      unsubscribe();
      document.removeEventListener("visibilitychange", onVisible);
      if (refetchTimer.current) window.clearTimeout(refetchTimer.current);
      refetchTimer.current = null;
    };
  }, [day, dispatch, isToday, load, store]);

  // Spinner only before the first copy of this day arrives; refreshes keep showing the cache.
  const status: "loading" | "ready" | "failed" = entry.loaded
    ? "ready"
    : entry.error
      ? "failed"
      : "loading";

  return { items: entry.items, status, reload: load, isToday, day };
}
