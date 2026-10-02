"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import type { PortalRequest } from "@/lib/data/portal";

/**
 * Lead → estimate now opens estimate-v2 create (prefilled from the request).
 * Kept as a dialog wrapper so existing call sites keep working.
 */
export function ConvertLeadToEstimateDialog({
  open,
  onOpenChange,
  lead,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead: PortalRequest;
  onConverted?: (estimateId: string) => void;
}) {
  const router = useRouter();

  useEffect(() => {
    if (!open || !lead?.id) return;
    onOpenChange(false);
    router.push(`/pro/dashboard/new-estimate/new?request=${encodeURIComponent(lead.id)}`);
  }, [open, lead?.id, onOpenChange, router]);

  return null;
}
