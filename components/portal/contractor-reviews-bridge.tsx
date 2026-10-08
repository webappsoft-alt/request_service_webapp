"use client";

import { useEffect } from "react";
import { subscribeRealtime } from "@/components/realtime/realtime-provider";
import { onSocketEvent, requestProviderInboxCounts } from "@/components/socket/socket-api";
import { mapPendingReviewCounts } from "@/lib/api/contractor-portal-client";
import { useAppDispatch } from "@/store/hooks";
import { contractorRequestsChanged, pendingReviewCountsReceived } from "@/store/contractorReviewsSlice";

/**
 * Keeps the pro "Pending reviews" badge live from the socket only — same as
 * the Leads / Messages / Orders badges. Counts ride on `provider:inbox-counts`
 * (`contractorReviews`); `contractor:requests` just tells an open review list
 * to refetch. No REST calls for counts.
 */
export function ContractorReviewsBridge() {
  const dispatch = useAppDispatch();

  useEffect(() => {
    const off = onSocketEvent("provider:inbox-counts", (payload) => {
      if (payload?.contractorReviews) {
        dispatch(pendingReviewCountsReceived(mapPendingReviewCounts(payload.contractorReviews)));
      }
    });
    requestProviderInboxCounts();
    return off;
  }, [dispatch]);

  useEffect(() => {
    return subscribeRealtime((detail) => {
      if (String(detail?.type || "") === "CONTRACTOR_REQUESTS_CHANGED") dispatch(contractorRequestsChanged());
    });
  }, [dispatch]);

  return null;
}
