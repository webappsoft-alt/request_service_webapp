"use client";

import { useEffect } from "react";
import { subscribeRealtime } from "@/components/realtime/realtime-provider";
import { normalizeSocketNotification } from "@/lib/api/notifications-client";
import { useAppDispatch } from "@/store/hooks";
import {
  contractorNotificationReceived,
  contractorRefreshRequested,
  fetchContractorBadges,
  fetchContractorNotifications,
} from "@/store/contractorPortalSlice";

/**
 * Pipes socket events into Redux for the contractor portal:
 * - NEW_NOTIFICATION   → bell list + sidebar badge counts
 * - contractor:refresh → bump list versions (jobs / changeRequests / payouts / dashboard)
 * Notifications and badges are fetched once here, not per page.
 */
export function ContractorRealtimeBridge() {
  const dispatch = useAppDispatch();

  useEffect(() => {
    void dispatch(fetchContractorNotifications());
    void dispatch(fetchContractorBadges());
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
        // Catch up on anything missed while offline.
        void dispatch(fetchContractorNotifications({ force: true }));
        void dispatch(fetchContractorBadges());
        dispatch(contractorRefreshRequested(["dashboard", "jobs", "changeRequests", "payouts", "schedule"]));
      }
    });
  }, [dispatch]);

  return null;
}
