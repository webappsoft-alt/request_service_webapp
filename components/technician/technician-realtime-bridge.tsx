"use client";

import { useEffect } from "react";
import { subscribeRealtime } from "@/components/realtime/realtime-provider";
import { onSocketEvent, requestFieldBadgeCounts } from "@/components/socket/socket-api";
import { normalizeSocketNotification } from "@/lib/api/notifications-client";
import { mapTimeEntry } from "@/lib/time-tracking";
import { useAppDispatch } from "@/store/hooks";
import {
  techBadgesReceived,
  techNotificationReceived,
  techRefreshRequested,
} from "@/store/technicianSlice";
import { fetchActiveEntry, technicianPaymentReceived, timeEntryReceived } from "@/store/timeTrackingSlice";

/**
 * Pipes socket events into Redux for the technician portal:
 * - NEW_NOTIFICATION   → sidebar section badges (the bell keeps its own feed)
 * - technician:refresh → bump list versions (jobs / estimates / schedule / payments / dashboard)
 * - TIME_ENTRY_UPDATED → running timer + time lists
 * - technician:badge-counts → sidebar section badges (socket on connect / on request, no REST)
 * The running timer is fetched once here, not per page.
 */
export function TechnicianRealtimeBridge() {
  const dispatch = useAppDispatch();

  useEffect(() => {
    void dispatch(fetchActiveEntry());
  }, [dispatch]);

  // Sidebar badges: the server sends them on connect; ask too, in case that arrived before this mounted.
  useEffect(() => {
    const off = onSocketEvent("technician:badge-counts", (payload) => {
      if (payload?.badges) dispatch(techBadgesReceived(payload.badges));
    });
    requestFieldBadgeCounts("technician");
    return off;
  }, [dispatch]);

  useEffect(() => {
    return subscribeRealtime((detail) => {
      const type = String(detail?.type || "");
      if (type === "NEW_NOTIFICATION") {
        const mapped = normalizeSocketNotification(detail.payload);
        if (mapped) dispatch(techNotificationReceived(mapped));
        return;
      }
      if (type === "TECHNICIAN_REFRESH") {
        const scopes = (detail.payload as { scopes?: string[] } | undefined)?.scopes;
        dispatch(techRefreshRequested(scopes));
        if (scopes?.includes("payments")) dispatch(technicianPaymentReceived());
        return;
      }
      if (type === "TIME_ENTRY_UPDATED") {
        const entry = mapTimeEntry((detail.payload as { entry?: unknown } | undefined)?.entry);
        if (entry) {
          dispatch(timeEntryReceived({ entry, technician: true }));
          dispatch(techRefreshRequested(["dashboard", "jobs", "payments"]));
        }
        return;
      }
      if (type === "SOCKET_RECONNECTED") {
        // Catch up on anything missed while offline (badges arrive with the new connection).
        void dispatch(fetchActiveEntry({ force: true }));
        dispatch(techRefreshRequested(["dashboard", "jobs", "estimates", "schedule", "payments"]));
        dispatch(technicianPaymentReceived());
      }
    });
  }, [dispatch]);

  return null;
}
