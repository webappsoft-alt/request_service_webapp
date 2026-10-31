"use client";

import { useEffect } from "react";
import { subscribeRealtime } from "@/components/realtime/realtime-provider";
import { onSocketEvent, requestFieldBadgeCounts } from "@/components/socket/socket-api";
import { normalizeSocketNotification } from "@/lib/api/notifications-client";
import { useAppDispatch } from "@/store/hooks";
import {
  contractorNotificationReceived,
  contractorBadgesReceived,
  contractorRefreshRequested,
} from "@/store/contractorPortalSlice";

/**
 * Pipes socket events into Redux for the contractor portal:
 * - NEW_NOTIFICATION   → sidebar badge counts (the bell keeps its own feed)
 * - contractor:refresh → bump list versions (jobs / changeRequests / payouts / dashboard)
 * - contractor:badge-counts → sidebar section badges (socket on connect / on request, no REST)
 */
export function ContractorRealtimeBridge() {
  const dispatch = useAppDispatch();

  // Sidebar badges: the server sends them on connect; ask too, in case that arrived before this mounted.
  useEffect(() => {
    const off = onSocketEvent("contractor:badge-counts", (payload) => {
      if (payload?.badges) dispatch(contractorBadgesReceived(payload.badges));
    });
    requestFieldBadgeCounts("contractor");
    return off;
  }, [dispatch]);

  useEffect(() => {
    return subscribeRealtime((detail) => {
      const type = String(detail?.type || "");
      if (type === "NEW_NOTIFICATION") {
        const mapped = normalizeSocketNotification(detail.payload);
        if (mapped) dispatch(contractorNotificationReceived(mapped));
        return;
      }
      if (type === "CONTRACTOR_REFRESH") {
        const scopes = (detail.payload as { scopes?: string[] } | undefined)?.scopes;
        dispatch(contractorRefreshRequested(scopes));
        return;
      }
      if (type === "TIME_ENTRY_UPDATED") {
        // Own clock in / out (any tab) — job time, pay, and dashboard change.
        dispatch(contractorRefreshRequested(["jobs", "payouts", "dashboard"]));
        return;
      }
      if (type === "SOCKET_RECONNECTED") {
        // Catch up on anything missed while offline (badges arrive with the new connection).
        dispatch(contractorRefreshRequested(["dashboard", "jobs", "changeRequests", "payouts", "schedule"]));
      }
    });
  }, [dispatch]);

  return null;
}
