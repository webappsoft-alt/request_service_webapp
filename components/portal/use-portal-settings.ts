"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePortalWorkspace } from "@/components/portal/use-portal-workspace";
import { cloneWorkingHours } from "@/lib/data/portal";
import {
  workingHoursFromProvider,
} from "@/lib/auth/provider-profile";
import type { WorkingHours } from "@/lib/types";
import { useAppSelector } from "@/store/hooks";
import { selectAuthProvider } from "@/store/authSlice";

/**
 * Office hours for the portal — prefers persisted auth provider settings,
 * then falls back to the merged portal provider demo hours.
 */
export function usePortalSettings() {
  const authProvider = useAppSelector(selectAuthProvider);
  const { provider } = usePortalWorkspace();

  const fromAuth = useMemo(
    () => workingHoursFromProvider(authProvider),
    [authProvider],
  );

  const sourceHours = fromAuth.length
    ? fromAuth
    : cloneWorkingHours(provider.workingHours);

  const [officeHours, setOfficeHours] = useState(() =>
    cloneWorkingHours(sourceHours),
  );

  useEffect(() => {
    setOfficeHours(cloneWorkingHours(sourceHours));
  }, [sourceHours]);

  const saveOfficeHours = useCallback((hours: WorkingHours[]) => {
    setOfficeHours(cloneWorkingHours(hours));
  }, []);

  return {
    officeHours,
    saveOfficeHours,
  };
}
