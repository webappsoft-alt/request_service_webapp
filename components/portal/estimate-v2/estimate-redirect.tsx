"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CenteredSpinner } from "@/components/ui/spinner";
import { getOpportunityByEstimateId } from "@/lib/api/estimate-v2-client";

/** Resolves a classic Estimate id to the estimate-v2 opportunity workspace. */
export function EstimateToOpportunityRedirect({ estimateId }: { estimateId: string }) {
  const router = useRouter();
  const [failed, setFailed] = useState(false);

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
        setFailed(true);
        router.replace("/pro/dashboard/new-estimate");
      } catch {
        if (cancelled) return;
        setFailed(true);
        router.replace("/pro/dashboard/new-estimate");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [estimateId, router]);

  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 p-8 text-center">
      <CenteredSpinner />
      <p className="text-sm text-muted-foreground">
        {failed ? "Opening estimates…" : "Opening estimate…"}
      </p>
    </div>
  );
}
