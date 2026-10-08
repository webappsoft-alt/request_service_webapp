"use client";

import { useEffect } from "react";
import type { ContractorSection } from "@/lib/api/contractor-portal-client";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { markContractorSectionSeen, selectContractorSectionBadge } from "@/store/contractorPortalSlice";

/**
 * Clears a sidebar badge while its section is open — after badges first load,
 * or when a new event lands while the contractor is on the page. The reset is
 * stored on the server, so a refresh never brings old counts back.
 */
export function useContractorSectionSeen(section: ContractorSection) {
  const dispatch = useAppDispatch();
  const loaded = useAppSelector((state) => state.contractorPortal?.badges?.loaded ?? false);
  const badge = useAppSelector((state) => selectContractorSectionBadge(state, section));

  useEffect(() => {
    if (!loaded || badge === 0) return;
    void dispatch(markContractorSectionSeen(section));
  }, [dispatch, loaded, badge, section]);
}
