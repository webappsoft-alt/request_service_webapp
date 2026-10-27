"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { subscribeRealtime } from "@/components/realtime/realtime-provider";
import {
  applyLocationUpdate,
  dayWindow,
  getLiveLocations,
  toDateKey,
  type LiveWorker,
} from "@/lib/tracking";

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
 * Everyone's last position on `dateKey` (default today). One request on open; for today,
 * socket updates then move the markers in place (a refetch only when someone new appears).
 */
export function useLiveWorkers(dateKey?: string) {
  const day = dateKey || toDateKey(new Date());
  const isToday = day === toDateKey(new Date());
  const [items, setItems] = useState<LiveWorker[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "failed">("loading");
  const itemsRef = useRef(items);
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);
  const refetchTimer = useRef<number | null>(null);

  const load = useCallback(async () => {
    try {
      const next = await getLiveLocations(dayWindow(day));
      setItems(next);
      setStatus("ready");
    } catch {
      setStatus((current) => (current === "ready" ? current : "failed"));
    }
  }, [day]);

  useEffect(() => {
    setStatus("loading");
    void load();
  }, [load]);

  useEffect(() => {
    if (!isToday) return;
    const unsubscribe = subscribeRealtime((detail) => {
      if (detail?.type !== "WORKER_LOCATION_UPDATED") return;
      const payload = (detail.payload || {}) as Record<string, unknown>;
      const next = applyLocationUpdate(itemsRef.current, payload);
      if (next) {
        setItems(next);
        return;
      }
      // Someone not on the map yet: fetch once for their name (coalesced).
      if (refetchTimer.current) return;
      refetchTimer.current = window.setTimeout(() => {
        refetchTimer.current = null;
        void load();
      }, 1500);
    });
    // Coming back to the tab after a while: catch up in one request.
    const onVisible = () => {
      if (document.visibilityState === "visible") void load();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      unsubscribe();
      document.removeEventListener("visibilitychange", onVisible);
      if (refetchTimer.current) window.clearTimeout(refetchTimer.current);
      refetchTimer.current = null;
    };
  }, [isToday, load]);

  return { items, status, reload: load, isToday, day };
}
