"use client";

import { useCrmApiData } from "@/components/portal/use-crm-api-data";
import { useAppSelector } from "@/store/hooks";
import { selectAuth } from "@/store/authSlice";

/** True while auth/CRM is still hydrating — detail pages should not flash "not found". */
export function useCrmRecordPending() {
  const auth = useAppSelector(selectAuth);
  const crm = useCrmApiData();

  if (!auth.hydrated) return true;
  // Token present but provider CRM not enabled yet (role still resolving).
  if (auth.token && !crm.enabled) return true;
  // Only block on the first load — silent/background refresh must not freeze the UI.
  if (crm.enabled && (!crm.ready || crm.loading)) return true;
  return false;
}
