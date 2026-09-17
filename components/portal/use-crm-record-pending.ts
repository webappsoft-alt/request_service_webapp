"use client";

import { useCrmApiData } from "@/components/portal/use-crm-api-data";
import { useAppSelector } from "@/store/hooks";
import { selectAuth } from "@/store/authSlice";

/**
 * True while auth is still hydrating, or while an in-flight CRM snapshot
 * bootstrap is running. Does NOT wait forever for `crm.ready` — the full
 * snapshot is lazy and must not block list pages like Customers.
 */
export function useCrmRecordPending() {
  const auth = useAppSelector(selectAuth);
  const crm = useCrmApiData();

  if (!auth.hydrated) return true;
  // Token present but provider CRM not enabled yet (role still resolving).
  if (auth.token && !crm.enabled) return true;
  // Only while a snapshot fetch is actually in progress.
  if (crm.enabled && crm.loading && !crm.ready) return true;
  return false;
}
