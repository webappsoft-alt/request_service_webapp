"use client";

import { useEffect } from "react";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { markTechSectionRead, selectTechSectionBadge, type TechSection } from "@/store/technicianSlice";

/**
 * Clears a sidebar badge while its section is open. Runs again whenever the
 * badge is non-zero — after badges first load, or when a new event arrives
 * while the technician is on the page. The reset is stored on the server, so
 * a refresh never brings old counts back. Bell notifications are not touched.
 */
export function useTechSectionSeen(section: TechSection) {
  const dispatch = useAppDispatch();
  const loaded = useAppSelector((state) => state.technician?.badges?.loaded ?? false);
  const badge = useAppSelector((state) => selectTechSectionBadge(state, section));

  useEffect(() => {
    if (!loaded || badge === 0) return;
    void dispatch(markTechSectionRead(section));
  }, [dispatch, loaded, badge, section]);
}
