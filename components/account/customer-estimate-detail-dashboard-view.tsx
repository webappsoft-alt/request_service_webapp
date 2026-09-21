"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { CustomerEstimatePage } from "@/components/estimate/customer-estimate";
import { PortalPage } from "@/components/portal/portal-page";
import { Button } from "@/components/ui/button";
import { customerPaths } from "@/lib/customer-paths";

export function CustomerEstimateDetailDashboardView({
  token,
}: {
  token: string;
}) {
  const key = String(token || "").trim();
  const isEstimateId = /^[a-fA-F0-9]{24}$/.test(key);

  return (
    <PortalPage
      eyebrow="Estimates"
      title="Review estimate"
      description="Review the proposal from the professional, then sign to accept using the existing approval flow."
      actions={
        <Button asChild variant="outline" size="sm">
          <Link href={customerPaths.estimates}>
            <ArrowLeft data-icon="inline-start" />
            All estimates
          </Link>
        </Button>
      }
    >
      <div className="rounded-[4px] border border-black/10 bg-card p-3 sm:p-4">
        {key ? (
          <CustomerEstimatePage
            token={isEstimateId ? undefined : key}
            estimateId={isEstimateId ? key : undefined}
          />
        ) : (
          <p className="text-sm text-muted-foreground">
            This estimate link is missing or invalid.
          </p>
        )}
      </div>
    </PortalPage>
  );
}
