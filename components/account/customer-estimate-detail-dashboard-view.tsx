"use client";

import Link from "next/link";
import { ArrowLeft, FileQuestion } from "lucide-react";
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
            <ArrowLeft className="size-3.5" />
            All estimates
          </Link>
        </Button>
      }
    >
      {key ? (
        <CustomerEstimatePage
          token={isEstimateId ? undefined : key}
          estimateId={isEstimateId ? key : undefined}
          embedded
        />
      ) : (
        <div className="mx-auto max-w-lg rounded-xl border border-input bg-card p-8 sm:p-10 text-center shadow-xs">
          <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl border border-input bg-muted/60 text-muted-foreground shadow-2xs">
            <FileQuestion className="size-7 text-primary/80" />
          </div>
          <h1 className="text-xl font-semibold text-foreground tracking-tight">
            Invalid estimate link
          </h1>
          <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
            The estimate reference or token is missing from this link. Return to your
            estimates to see all active proposals.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Button asChild size="sm">
              <Link href={customerPaths.estimates}>
                <ArrowLeft className="size-3.5" />
                All estimates
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href={customerPaths.requests}>
                View quote requests
              </Link>
            </Button>
          </div>
        </div>
      )}
    </PortalPage>
  );
}
