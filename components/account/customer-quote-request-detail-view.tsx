"use client";

import { useEffect, useMemo } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import { PortalPage } from "@/components/portal/portal-page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CenteredSpinner } from "@/components/ui/spinner";
import { customerPaths } from "@/lib/customer-paths";
import { formatDate, formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { selectAuth, selectIsAuthenticated } from "@/store/authSlice";
import {
  fetchCustomerEstimates,
  fetchCustomerQuoteRequests,
  selectCustomerApiEstimates,
  selectCustomerQuoteBatches,
  selectCustomerQuoteBatchesLoading,
  type CustomerQuoteBatch,
  type CustomerQuoteProfessional,
} from "@/store/customerQuotesSlice";

function statusLabel(status: string) {
  return status
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatAddress(batch: CustomerQuoteBatch) {
  return (
    [batch.street, batch.city, batch.state, batch.zip]
      .filter(Boolean)
      .join(", ") ||
    (batch.zip ? `ZIP ${batch.zip}` : "Address pending")
  );
}

function batchKey(batch: CustomerQuoteBatch) {
  return (
    batch.quoteBatchId ||
    batch.professionals[0]?.requestId ||
    `${batch.serviceName}-${batch.createdAt}`
  );
}

type TimelineItem = {
  id: string;
  label: string;
  done: boolean;
  detail?: string;
};

function buildTimeline(batch: CustomerQuoteBatch): TimelineItem[] {
  const hasSeen = batch.seenCount > 0;
  const hasEstimate = batch.estimateCount > 0;
  const statuses = batch.professionals.flatMap((p) =>
    p.estimates.map((e) => e.status),
  );
  const accepted = statuses.some(
    (s) => s === "accepted" || s === "converted_to_job",
  );
  const rejected = statuses.some((s) => s === "rejected");
  const jobCreated = statuses.some((s) => s === "converted_to_job");
  const firstViewed = batch.professionals
    .map((p) => p.firstViewedAt)
    .filter(Boolean)
    .sort()[0];

  // Only include events that already happened (no fake completed steps).
  const items: TimelineItem[] = [
    {
      id: "submitted",
      label: "Request submitted",
      done: true,
      detail: batch.createdAt ? formatDate(batch.createdAt) : undefined,
    },
  ];

  if (batch.sentToCount > 0) {
    items.push({
      id: "sent",
      label: "Sent to providers",
      done: true,
      detail: `${batch.sentToCount} professional${batch.sentToCount === 1 ? "" : "s"}`,
    });
  }

  if (hasSeen) {
    items.push({
      id: "viewed",
      label: "Provider viewed",
      done: true,
      detail: firstViewed
        ? `Seen by ${batch.seenCount} · ${formatDate(firstViewed)}`
        : `Seen by ${batch.seenCount}`,
    });
  }

  if (hasEstimate) {
    items.push({
      id: "response",
      label: "Estimate received",
      done: true,
      detail: `${batch.estimateCount} estimate${batch.estimateCount === 1 ? "" : "s"}`,
    });
  }

  const changesRequested = statuses.some((s) => s === "changes_requested");
  if (changesRequested) {
    items.push({
      id: "changes",
      label: "Changes requested",
      done: true,
    });
  }

  const sharedOrSent = statuses.some(
    (s) =>
      s === "sent" ||
      s === "finalized" ||
      s === "accepted" ||
      s === "converted_to_job",
  );
  if (sharedOrSent && !changesRequested) {
    // no-op marker — shared is already covered by "Estimate received" when token exists
  }

  if (accepted) {
    items.push({
      id: "accepted",
      label: "Estimate accepted",
      done: true,
      detail: "Signed and approved",
    });
  }

  if (accepted && rejected) {
    items.push({
      id: "rejected",
      label: "Other estimates declined",
      done: true,
    });
  }

  if (jobCreated) {
    items.push({
      id: "job",
      label: "Job created",
      done: true,
    });
  }

  return items;
}

function ProfessionalCard({
  pro,
}: {
  pro: CustomerQuoteProfessional;
}) {
  return (
    <div className="rounded-[4px] border border-black/10 bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-medium">{pro.providerName}</p>
          <p className="text-xs text-muted-foreground">{pro.number}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant={pro.seen ? "secondary" : "outline"}>
            {pro.seen ? "Seen" : "Not seen"}
          </Badge>
          <Badge variant="outline">{statusLabel(pro.status)}</Badge>
        </div>
      </div>
      {pro.estimates.length ? (
        <ul className="mt-3 space-y-2 border-t border-black/10 pt-3">
          {pro.estimates.map((est) => (
            <li
              key={est.id}
              className="flex flex-wrap items-center justify-between gap-2 text-sm"
            >
              <span>
                <span className="font-medium">{est.number || "Estimate"}</span>
                <span className="ml-2 text-muted-foreground">
                  {statusLabel(est.status)}
                </span>
                {est.total ? (
                  <span className="ml-2 font-semibold tabular-nums text-[#003F7D]">
                    {formatMoney(est.total)}
                  </span>
                ) : null}
              </span>
              {est.shareToken ? (
                <Button asChild size="sm">
                  <Link href={customerPaths.estimate(est.shareToken)}>
                    {["sent", "finalized", "changes_requested"].includes(
                      est.status,
                    )
                      ? est.status === "changes_requested"
                        ? "View estimate"
                        : "Review & sign"
                      : "View"}
                  </Link>
                </Button>
              ) : (
                <span className="text-xs text-muted-foreground">
                  Provider is preparing this estimate — open it here once they
                  share the review link.
                </span>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">
          No estimate submitted yet.
        </p>
      )}
    </div>
  );
}

export function CustomerQuoteRequestDetailView() {
  const params = useParams<{ id: string }>();
  const id = decodeURIComponent(String(params.id || ""));
  const router = useRouter();
  const dispatch = useAppDispatch();
  const auth = useAppSelector(selectAuth);
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  const batches = useAppSelector(selectCustomerQuoteBatches);
  const loading = useAppSelector(selectCustomerQuoteBatchesLoading);
  const estimates = useAppSelector(selectCustomerApiEstimates);

  useEffect(() => {
    if (!auth.hydrated) return;
    if (!isAuthenticated) {
      router.replace(
        `/login?next=${encodeURIComponent(customerPaths.quoteRequest(id))}`,
      );
      return;
    }
    void dispatch(fetchCustomerQuoteRequests());
    void dispatch(fetchCustomerEstimates());
  }, [auth.hydrated, isAuthenticated, router, dispatch, id]);

  const batch = useMemo(() => {
    return batches.find((item) => batchKey(item) === id) || null;
  }, [batches, id]);

  const timeline = batch ? buildTimeline(batch) : [];

  // Merge any API estimates that match request ids in this batch
  const requestIds = new Set(
    (batch?.professionals || []).map((p) => p.requestId),
  );
  const relatedEstimates = estimates.filter(
    (est) => est.requestId && requestIds.has(est.requestId),
  );

  if (!auth.hydrated || (!isAuthenticated && loading)) {
    return <CenteredSpinner label="Loading request…" />;
  }

  if (loading && !batch) {
    return <CenteredSpinner label="Loading request…" />;
  }

  if (!batch) {
    return (
      <PortalPage
        eyebrow="Estimates"
        title="Request not found"
        description="This quote request may have been removed or the link is invalid."
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href={customerPaths.estimates}>Back to estimates</Link>
          </Button>
        }
      >
        <p className="text-sm text-muted-foreground">
          Return to your estimates list to open another request.
        </p>
      </PortalPage>
    );
  }

  return (
    <PortalPage
      eyebrow="Quote request"
      title={batch.serviceName}
      description={formatAddress(batch)}
      actions={
        <Button asChild variant="outline" size="sm">
          <Link href={customerPaths.estimateRequests}>
            <ArrowLeft className="size-3.5" />
            Back to requests
          </Link>
        </Button>
      }
    >
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="space-y-6">
          <section className="rounded-[4px] border border-black/10 bg-card p-4">
            <h2 className="text-sm font-semibold tracking-wide text-[#003F7D] uppercase">
              Request details
            </h2>
            <dl className="mt-3 grid gap-3 sm:grid-cols-2 text-sm">
              <div>
                <dt className="text-muted-foreground">Service</dt>
                <dd className="font-medium">{batch.serviceName}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Address</dt>
                <dd className="font-medium">{formatAddress(batch)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Sent to</dt>
                <dd className="font-medium">{batch.sentToCount} professionals</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Seen by</dt>
                <dd className="font-medium">{batch.seenCount}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Estimates</dt>
                <dd className="font-medium">{batch.estimateCount}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Submitted</dt>
                <dd className="font-medium">
                  {batch.createdAt ? formatDate(batch.createdAt) : "—"}
                </dd>
              </div>
            </dl>
            {batch.details ? (
              <p className="mt-4 whitespace-pre-wrap text-sm text-muted-foreground">
                {batch.details}
              </p>
            ) : null}
          </section>

          <section>
            <h2 className="mb-3 text-sm font-semibold tracking-wide text-[#003F7D] uppercase">
              Provider activity
            </h2>
            <div className="space-y-3">
              {batch.professionals.map((pro) => (
                <ProfessionalCard key={pro.requestId} pro={pro} />
              ))}
            </div>
            {!batch.professionals.length ? (
              <p className="text-sm text-muted-foreground">
                No professionals linked to this request yet.
              </p>
            ) : null}
          </section>

          {relatedEstimates.length ? (
            <section>
              <h2 className="mb-3 text-sm font-semibold tracking-wide text-[#003F7D] uppercase">
                All estimates for this request
              </h2>
              <p className="mb-3 text-sm text-muted-foreground">
                Approve one estimate with signature — other estimates from the same
                quote batch are declined automatically.
              </p>
              <ul className="space-y-2">
                {relatedEstimates.map((est) => (
                  <li
                    key={est.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-[4px] border border-black/10 bg-card px-3 py-2.5 text-sm"
                  >
                    <span>
                      <span className="font-medium">
                        {est.title || est.number}
                      </span>
                      <span className="ml-2 text-muted-foreground">
                        {est.provider?.companyName || "Professional"}
                      </span>
                      <Badge className="ml-2" variant="outline">
                        {statusLabel(est.status)}
                      </Badge>
                    </span>
                    {est.shareToken ? (
                      <Button asChild size="sm">
                        <Link href={customerPaths.estimate(est.shareToken)}>
                          Open
                        </Link>
                      </Button>
                    ) : null}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>

        <aside className="rounded-[4px] border border-black/10 bg-card p-4 h-fit xl:sticky xl:top-24">
          <h2 className="text-sm font-semibold tracking-wide text-[#003F7D] uppercase">
            Timeline
          </h2>
          <ol className="mt-4 space-y-3">
            {timeline.map((item) => (
              <li key={item.id} className="flex gap-2.5 text-sm">
                {item.done ? (
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" />
                ) : (
                  <span className="mt-0.5 size-4 shrink-0 rounded-full border border-muted-foreground/40" />
                )}
                <span>
                  <span
                    className={cn(
                      "block font-medium",
                      !item.done && "text-muted-foreground",
                    )}
                  >
                    {item.label}
                  </span>
                  {item.detail ? (
                    <span className="text-xs text-muted-foreground">
                      {item.detail}
                    </span>
                  ) : null}
                </span>
              </li>
            ))}
          </ol>
        </aside>
      </div>
    </PortalPage>
  );
}
