"use client";

import { useContext } from "react";
import { CrmApiDataContext } from "@/components/portal/crm-data-provider";

export function useCrmApiData() {
  return useContext(CrmApiDataContext);
}
