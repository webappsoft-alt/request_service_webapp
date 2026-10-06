"use client";

import { useEffect } from "react";
import { subscribeRealtime } from "@/components/realtime/realtime-provider";
import { normalizeSocketNotification } from "@/lib/api/notifications-client";
import { mapTimeEntry } from "@/lib/time-tracking";
import { useAppDispatch } from "@/store/hooks";
import {
  fetchTechBadges,
  fetchTechNotifications,
  techNotificationReceived,
  techRefreshRequested,
} from "@/store/technicianSlice";
import { fetchActiveEntry, technicianPaymentReceived, timeEntryReceived } from "@/store/timeTrackingSlice";

/**
 * Pipes socket events into Redux for the technician portal:
 * - NEW_NOTIFICATION   → notification list + badge counts
 * - technician:refresh → bump list versions (jobs / estimates / schedule / payments / dashboard)
 * - TIME_ENTRY_UPDATED → running timer + time lists
 * Notifications and the running timer are fetched once here, not per page.
 */
export function TechnicianRealtimeBridge() {
  const dispatch = useAppDispatch();

  useEffect(() => {
    void dispatch(fetchTechNotifications());
    void dispatch(fetchTechBadges());
    void dispatch(fetchActiveEntry());
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
        // Catch up on anything missed while offline.
        void dispatch(fetchTechNotifications({ force: true }));
        void dispatch(fetchTechBadges());
        void dispatch(fetchActiveEntry({ force: true }));
        dispatch(techRefreshRequested(["dashboard", "jobs", "estimates", "schedule", "payments"]));
        dispatch(technicianPaymentReceived());
      }
    });
  }, [dispatch]);

  return null;
}
