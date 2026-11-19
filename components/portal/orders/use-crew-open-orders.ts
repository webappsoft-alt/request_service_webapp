"use client";

import { useEffect, useState } from "react";
import { subscribeRealtime } from "@/components/realtime/realtime-provider";
import type { CrewPortal } from "@/lib/api/order-crew-client";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { fetchCrewOrders, selectCrewOrders } from "@/store/crewOrdersSlice";

/**
 * Crew portals' fixed-price orders, from one shared Redux copy (store/crewOrdersSlice).
 * Previous: the nav badge, hover card and Jobs list each fetched on their own and each listened
 * to the socket, so one page load / order update fired several identical requests.
 */

/** Mounted once per portal shell: first load + reload on order changes / reconnect. */
export function CrewOrdersSync({ portal }: { portal: CrewPortal }) {
  const dispatch = useAppDispatch();
  useEffect(() => {
    void dispatch(fetchCrewOrders({ portal }));
    return subscribeRealtime((detail) => {
      const type = String(detail?.type || "");
      // A new assignment / removal arrives only as a notification (no ORDER_UPDATED reaches the
      // worker), so reload on any notification about an order too. Previous: ORDER_UPDATED /
      // reconnect only — the Jobs badge stayed stale after "Order assigned".
      const data = (detail?.payload as { data?: { orderId?: unknown } } | undefined)?.data;
      const aboutOrder = type === "NEW_NOTIFICATION" && Boolean(data?.orderId);
      if (type === "ORDER_UPDATED" || type === "SOCKET_RECONNECTED" || aboutOrder) {
        void dispatch(fetchCrewOrders({ portal, force: true }));
      }
    });
  }, [dispatch, portal]);
  return null;
}

const DONE = ["WORK_COMPLETED", "SETTLED", "CANCELLED"];
const SEEN_EVENT = "rs-crew-orders-seen";
const seenKey = (portal: CrewPortal) => `rs:crew-orders-seen:${portal}`;

function readSeen(portal: CrewPortal): number {
  try {
    return Number(window.localStorage.getItem(seenKey(portal))) || 0;
  } catch {
    return 0;
  }
}

/** Jobs page opened: fixed-price orders assigned up to now are "seen" (badge resets). */
export function markCrewOrdersSeen(portal: CrewPortal) {
  try {
    window.localStorage.setItem(seenKey(portal), String(Date.now()));
  } catch {
    // Storage blocked — the badge just keeps counting until the next visit.
  }
  window.dispatchEvent(new CustomEvent(SEEN_EVENT, { detail: portal }));
}

/**
 * Jobs nav badge part for fixed-price orders: open orders assigned to me since I last opened
 * Jobs (resets on visit, like the job-updates badge). `onJobsPage` keeps it at 0 while there.
 */
export function useCrewUnseenOrders(portal: CrewPortal, onJobsPage: boolean) {
  const rows = useAppSelector((state) => selectCrewOrders(state, portal).rows);
  const [seenAt, setSeenAt] = useState(0);

  useEffect(() => {
    setSeenAt(readSeen(portal));
    const onSeen = (event: Event) => {
      if ((event as CustomEvent).detail === portal) setSeenAt(readSeen(portal));
    };
    window.addEventListener(SEEN_EVENT, onSeen);
    return () => window.removeEventListener(SEEN_EVENT, onSeen);
  }, [portal]);

  if (onJobsPage || !rows) return 0;
  return rows.filter(
    (row) => !DONE.includes(row.status) && (new Date(row.assignedAt || 0).getTime() || 0) > seenAt,
  ).length;
}
