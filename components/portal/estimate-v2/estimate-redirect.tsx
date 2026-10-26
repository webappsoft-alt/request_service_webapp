"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CenteredSpinner } from "@/components/ui/spinner";
import { getOpportunityByEstimateId } from "@/lib/api/estimate-v2-client";
import { EstimateDetailView } from "@/components/portal/views/record-detail-views";

/**
 * Resolves a classic Estimate id to the estimate-v2 opportunity workspace; a classic estimate
 * with no opportunity (e.g. created before estimate-v2) opens in the classic estimate view.
 */
export function EstimateToOpportunityRedirect({ estimateId }: { estimateId: string }) {
  const router = useRouter();
  const [classic, setClassic] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const opportunity = await getOpportunityByEstimateId(estimateId, {
          silent: true,
        });
        if (cancelled) return;
        if (opportunity?.id) {
          router.replace(`/pro/dashboard/new-estimate/${opportunity.id}`);
          return;
        }
        setClassic(true);
      } catch {
        if (!cancelled) setClassic(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [estimateId, router]);

  if (classic) return <EstimateDetailView id={estimateId} />;

  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 p-8 text-center">
      <CenteredSpinner />
      <p className="text-sm text-muted-foreground">Opening estimate…</p>
    </div>
  );
}
