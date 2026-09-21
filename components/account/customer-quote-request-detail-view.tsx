"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Building2,
  CalendarDays,
  Check,
  Clock,
  ExternalLink,
  Eye,
  HelpCircle,
  MapPin,
  MessageSquare,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import {
  postData,
  showApiErrorToast,
} from "@/components/api/apiFuntions";
import { userApi } from "@/components/api/ApiRoutesFile";
import { typedSignature } from "@/components/estimate/estimate-pdf";
import { PortalPage } from "@/components/portal/portal-page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CenteredSpinner } from "@/components/ui/spinner";
import { customerPaths } from "@/lib/customer-paths";
import { formatDate, formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  selectAuth,
  selectAuthUser,
  selectIsAuthenticated,
} from "@/store/authSlice";
import {
  fetchCustomerEstimates,
  fetchCustomerQuoteRequests,
  selectCustomerApiEstimates,
  selectCustomerQuoteBatches,
  selectCustomerQuoteBatchesLoading,
  type CustomerQuoteBatch,
} from "@/store/customerQuotesSlice";

function statusLabel(status: string) {
  const clean = String(status || "").toLowerCase();
  if (clean === "converted_to_job") return "Job Created";
  if (clean === "site_visit") return "Site Visit";
  if (clean === "changes_requested") return "Changes Requested";
  if (clean === "estimate_sent") return "Estimate Sent";
  if (clean === "rejected") return "Rejected";
  return status
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function isAcceptedStatus(status: string) {
  const clean = String(status || "").toLowerCase();
  return clean === "accepted" || clean === "converted_to_job";
}

function isRejectedStatus(status: string) {
  const clean = String(status || "").toLowerCase();
  return clean === "rejected" || clean === "expired";
}

function isSignableStatus(status: string) {
  const clean = String(status || "").toLowerCase();
  return clean === "sent" || clean === "finalized" || clean === "draft";
}

function estimateHref(est: { id?: string; shareToken?: string }) {
  const token = String(est.shareToken || "").trim();
  const id = String(est.id || "").trim();
  if (token) return customerPaths.estimate(token);
  if (id) return customerPaths.estimate(id);
  return null;
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

type ConsolidatedEstimate = {
  id: string;
  number: string;
  title: string;
  status: string;
  total: number;
  shareToken: string;
  providerName: string;
  providerSlug?: string;
  providerId?: string;
  requestId?: string;
  createdAt?: string;
};

type TimelineStep = {
  id: string;
  label: string;
  detail?: string;
  done: boolean;
  current?: boolean;
};

function buildTimelineSteps(batch: CustomerQuoteBatch): TimelineStep[] {
  const hasSeen = batch.seenCount > 0;
  const hasEstimate = batch.estimateCount > 0;
  const statuses = batch.professionals.flatMap((p) => [
    p.status,
    ...p.estimates.map((e) => e.status),
  ]);
  const isAccepted = statuses.some(
    (s) => s === "accepted" || s === "converted_to_job",
  );
  const isJobCreated = statuses.some((s) => s === "converted_to_job");
  const firstViewed = batch.professionals
    .map((p) => p.firstViewedAt)
    .filter(Boolean)
    .sort()[0];

  const steps: TimelineStep[] = [
    {
      id: "submitted",
      label: "Request Submitted",
      detail: batch.createdAt ? formatDate(batch.createdAt) : "Submitted online",
      done: true,
    },
    {
      id: "sent",
      label: "Dispatched to Providers",
      detail:
        batch.sentToCount > 0
          ? `Sent to ${batch.sentToCount} local professional${batch.sentToCount === 1 ? "" : "s"}`
          : "Matching providers in your area",
      done: batch.sentToCount > 0,
      current: batch.sentToCount > 0 && !hasSeen,
    },
    {
      id: "viewed",
      label: "Provider Review",
      detail: hasSeen
        ? firstViewed
          ? `Viewed by ${batch.seenCount} pro${batch.seenCount === 1 ? "" : "s"} · First on ${formatDate(firstViewed)}`
          : `Viewed by ${batch.seenCount} pro${batch.seenCount === 1 ? "" : "s"}`
        : "Awaiting provider review",
      done: hasSeen,
      current: hasSeen && !hasEstimate,
    },
    {
      id: "estimate",
      label: "Estimates Received",
      detail: hasEstimate
        ? `${batch.estimateCount} estimate${batch.estimateCount === 1 ? "" : "s"} submitted for review`
        : "Providers are calculating estimates",
      done: hasEstimate,
      current: hasEstimate && !isAccepted,
    },
    {
      id: "accepted",
      label: isJobCreated ? "Job Confirmed" : "Estimate Accepted",
      detail: isJobCreated
        ? "Job created and scheduled with provider"
        : isAccepted
          ? "Approved & signed by customer"
          : "Sign proposal to confirm booking",
      done: isAccepted,
      current: isAccepted,
    },
  ];

  return steps;
}

function getOverallStatusBadge(batch: CustomerQuoteBatch) {
  const statuses = batch.professionals.flatMap((p) => [
    p.status,
    ...p.estimates.map((e) => e.status),
  ]);

  if (statuses.some((s) => s === "converted_to_job")) {
    return (
      <Badge className="bg-emerald-600 text-white hover:bg-emerald-700">
        Job Created
      </Badge>
    );
  }
  if (statuses.some((s) => s === "accepted")) {
    return (
      <Badge className="bg-emerald-600 text-white hover:bg-emerald-700">
        Estimate Accepted
      </Badge>
    );
  }
  if (batch.estimateCount > 0) {
    return (
      <Badge className="bg-primary text-primary-foreground">
        {batch.estimateCount} Estimate{batch.estimateCount === 1 ? "" : "s"} Ready
      </Badge>
    );
  }
  if (batch.seenCount > 0) {
    return (
      <Badge variant="secondary" className="bg-amber-100 text-amber-900 border-amber-300">
        Under Review
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="border-border text-muted-foreground">
      Awaiting Providers
    </Badge>
  );
}


function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint: string;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="rounded-xl border border-border bg-card px-5 py-5 transition-colors hover:bg-muted/40">
      <p className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
        {label}
      </p>
      <p className="mt-3 text-[1.75rem] leading-none font-semibold tracking-tight tabular-nums text-foreground">
        {value}
      </p>
      <p className="mt-2 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

export function CustomerQuoteRequestDetailView() {
  const params = useParams<{ id: string }>();
  const id = decodeURIComponent(String(params.id || ""));
  const router = useRouter();
  const dispatch = useAppDispatch();
  const auth = useAppSelector(selectAuth);
  const authUser = useAppSelector(selectAuthUser);
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  const batches = useAppSelector(selectCustomerQuoteBatches);
  const loading = useAppSelector(selectCustomerQuoteBatchesLoading);
  const apiEstimates = useAppSelector(selectCustomerApiEstimates);
  const [acceptTarget, setAcceptTarget] = useState<ConsolidatedEstimate | null>(
    null,
  );
  const [accepting, setAccepting] = useState(false);

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
    return (
      batches.find((item) => batchKey(item) === id) ||
      batches.find((item) => item.quoteBatchId === id) ||
      batches.find((item) =>
        item.professionals.some((p) => p.requestId === id),
      ) ||
      null
    );
  }, [batches, id]);

  const timelineSteps = useMemo(() => {
    return batch ? buildTimelineSteps(batch) : [];
  }, [batch]);

  // Consolidate all estimates linked to this request / batch
  const consolidatedEstimates = useMemo<ConsolidatedEstimate[]>(() => {
    if (!batch) return [];
    const map = new Map<string, ConsolidatedEstimate>();

    // 1. Estimates directly under professionals
    for (const pro of batch.professionals) {
      for (const est of pro.estimates) {
        const key = est.id || est.shareToken || est.number;
        if (!key) continue;
        map.set(key, {
          id: est.id,
          number: est.number || "Estimate",
          title:
            est.title ||
            `Proposal from ${pro.providerName}`,
          status: est.status,
          total: est.total,
          shareToken: est.shareToken,
          providerName: pro.providerName,
          providerSlug: pro.providerSlug,
          providerId: pro.providerId,
          requestId: pro.requestId,
          createdAt: est.createdAt,
        });
      }
    }

    // 2. Estimates matching request IDs from API estimates list
    const requestIds = new Set(batch.professionals.map((p) => p.requestId));
    for (const est of apiEstimates) {
      if (est.requestId && requestIds.has(est.requestId)) {
        const key = est.id || est.shareToken || est.number;
        const existing = map.get(key);
        map.set(key, {
          id: est.id,
          number: est.number || existing?.number || "Estimate",
          title: est.title || existing?.title || "Estimate",
          status: est.status || existing?.status || "sent",
          total: est.total || existing?.total || 0,
          shareToken: est.shareToken || existing?.shareToken || "",
          providerName:
            est.provider?.companyName ||
            existing?.providerName ||
            "Service Professional",
          providerSlug: est.provider?.slug || existing?.providerSlug,
          providerId: est.provider?.id || existing?.providerId,
          requestId: est.requestId,
          createdAt: est.createdAt,
        });
      }
    }

    return Array.from(map.values());
  }, [batch, apiEstimates]);

  const customerName = [
    authUser?.firstName,
    authUser?.lastName,
  ]
    .filter(Boolean)
    .join(" ")
    .trim() || authUser?.email || "Customer";

  async function confirmAcceptEstimate() {
    if (!acceptTarget?.id || accepting) return;
    setAccepting(true);
    try {
      const signatureImageBase64 = typedSignature(customerName);
      if (!signatureImageBase64) {
        toast.error("Could not create acceptance signature. Please try again.");
        return;
      }
      await postData(userApi.estimateApprove(acceptTarget.id), {
        signedBy: customerName,
        signatureImageBase64,
      });
      toast.success(
        `${acceptTarget.number} accepted. Other estimates for this request were rejected.`,
      );
      setAcceptTarget(null);
      await Promise.all([
        dispatch(fetchCustomerQuoteRequests()),
        dispatch(fetchCustomerEstimates()),
      ]);
    } catch (err) {
      showApiErrorToast(err, "Unable to accept this estimate.");
    } finally {
      setAccepting(false);
    }
  }

  if (!auth.hydrated || (loading && !batch)) {
    return (
      <div className="flex min-h-[360px] items-center justify-center">
        <CenteredSpinner label="Loading request details…" />
      </div>
    );
  }

  if (!batch) {
    return (
      <PortalPage
        eyebrow="Estimates"
        title="Request not found"
        description="This quote request may have been removed or the link is invalid."
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href={customerPaths.estimateRequests}>
              <ArrowLeft className="size-3.5" />
              Back to requests
            </Link>
          </Button>
        }
      >
        <div className="rounded-xl border border-border bg-card p-8 text-center">
          <p className="text-base font-medium text-foreground">
            Quote request could not be located
          </p>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
            Return to your estimates dashboard to view all active requests and
            proposals.
          </p>
          <Button asChild className="mt-4" size="sm">
            <Link href={customerPaths.estimateRequests}>View all requests</Link>
          </Button>
        </div>
      </PortalPage>
    );
  }

  const referenceId =
    batch.quoteBatchId || batch.professionals[0]?.requestId || id;
  const firstViewedAt = batch.professionals
    .map((p) => p.firstViewedAt)
    .filter(Boolean)
    .sort()[0];

  return (
    <>
    <PortalPage
      eyebrow="Quote Request Details"
      title={batch.serviceName}
      description={
        referenceId
          ? `${formatAddress(batch)} · Ref: ${referenceId.slice(0, 8)}`
          : formatAddress(batch)
      }
      badge={getOverallStatusBadge(batch)}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href={customerPaths.estimateRequests}>
              <ArrowLeft className="size-3.5" />
              Back to requests
            </Link>
          </Button>
          <Button asChild size="sm">
            <Link href={customerPaths.estimateRequest}>
              <Sparkles className="size-3.5" />
              New request
            </Link>
          </Button>
        </div>
      }
    >
      {/* KPI Metric Cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Request status"
          value={
            batch.estimateCount > 0
              ? `${batch.estimateCount} ready`
              : batch.seenCount > 0
                ? "Under review"
                : "Dispatched"
          }
          hint={
            batch.estimateCount > 0
              ? "Estimates ready for signature"
              : batch.seenCount > 0
                ? "Pros reviewing requirements"
                : "Sent to matching providers"
          }
        />
        <StatCard
          label="Providers notified"
          value={batch.sentToCount}
          hint={
            batch.sentToCount === 1
              ? "1 local provider notified"
              : `${batch.sentToCount} local providers notified`
          }
        />
        <StatCard
          label="Provider views"
          value={batch.seenCount}
          hint={
            firstViewedAt
              ? `First seen ${formatDate(firstViewedAt)}`
              : batch.seenCount > 0
                ? "Seen by matching pros"
                : "Awaiting initial view"
          }
        />
        <StatCard
          label="Estimates received"
          value={batch.estimateCount}
          hint={
            batch.estimateCount > 0
              ? "Proposals ready to compare"
              : "Quotes in preparation"
          }
        />
      </div>

      {/* Main Grid: Content (Left) & Sidebar (Right) */}
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-6">
          {/* SECTION 1: Received Estimates Spotlight (If Any) */}
          {consolidatedEstimates.length > 0 ? (
            <section className="rounded-xl border border-border bg-card p-5 sm:p-6 shadow-xs">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-4">
                <div>
                  <h2 className="text-base font-semibold text-foreground">
                    Estimates received ({consolidatedEstimates.length})
                  </h2>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Review proposals from providers and select one to accept
                  </p>
                </div>
                {consolidatedEstimates.some(
                  (est) =>
                    isSignableStatus(est.status) &&
                    !consolidatedEstimates.some((other) =>
                      isAcceptedStatus(other.status),
                    ),
                ) ? (
                  <Badge
                    variant="default"
                    className="bg-primary text-primary-foreground"
                  >
                    Action available
                  </Badge>
                ) : consolidatedEstimates.some((est) =>
                    isAcceptedStatus(est.status),
                  ) ? (
                  <Badge className="bg-emerald-600 text-white">Selected</Badge>
                ) : null}
              </div>

              {/* Informative Guidance Notice */}
              <div className="mt-4 flex items-start gap-2.5 rounded-lg border border-border bg-muted/40 p-3.5 text-xs text-foreground">
                <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" />
                <p>
                  <strong className="font-semibold">Single-Approval Guarantee:</strong>{" "}
                  Once you review and accept an estimate with your digital
                  signature, that provider is confirmed, and other competing
                  proposals for this request are automatically declined.
                </p>
              </div>

              {/* Estimates Cards List */}
              <div className="mt-4 space-y-3">
                {consolidatedEstimates.map((est) => {
                  const batchHasAccepted = consolidatedEstimates.some((item) =>
                    isAcceptedStatus(item.status),
                  );
                  const isAccepted = isAcceptedStatus(est.status);
                  const isRejected =
                    isRejectedStatus(est.status) ||
                    (batchHasAccepted && !isAccepted);
                  const isChanges = est.status === "changes_requested";
                  const canSign =
                    isSignableStatus(est.status) && !batchHasAccepted;
                  const href = estimateHref(est);
                  const displayStatus = isRejected && !isRejectedStatus(est.status)
                    ? "rejected"
                    : est.status;

                  return (
                    <div
                      key={est.id || est.shareToken || est.number}
                      className={cn(
                        "group relative rounded-lg border border-border bg-card p-4 transition-all sm:p-5",
                        isAccepted && "border-emerald-500/40 bg-emerald-50/20",
                        isRejected && "border-border bg-muted/30 opacity-80",
                        !isAccepted &&
                          !isRejected &&
                          "hover:border-primary/50",
                      )}
                    >
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="space-y-1.5">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="flex size-7 items-center justify-center rounded-full bg-muted font-semibold text-xs text-foreground border border-border">
                              {est.providerName.charAt(0).toUpperCase()}
                            </span>
                            <span className="font-semibold text-foreground">
                              {est.providerName}
                            </span>
                            <Badge
                              variant={
                                isAccepted
                                  ? "default"
                                  : isRejected
                                    ? "secondary"
                                    : isChanges
                                      ? "secondary"
                                      : "outline"
                              }
                              className={cn(
                                isAccepted && "bg-emerald-600 text-white",
                                isRejected &&
                                  "bg-muted text-muted-foreground border-border",
                                isChanges &&
                                  "bg-amber-100 text-amber-900 border-amber-300",
                              )}
                            >
                              {isAccepted
                                ? statusLabel(est.status)
                                : isRejected
                                  ? "Rejected"
                                  : statusLabel(displayStatus)}
                            </Badge>
                          </div>

                          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            <span className="font-mono font-medium text-foreground">
                              {est.number}
                            </span>
                            {est.title && est.title !== est.number ? (
                              <>
                                <span>·</span>
                                <span>{est.title}</span>
                              </>
                            ) : null}
                            {est.createdAt ? (
                              <>
                                <span>·</span>
                                <span>{formatDate(est.createdAt)}</span>
                              </>
                            ) : null}
                          </div>
                          {isRejected && !isAccepted ? (
                            <p className="text-xs text-muted-foreground">
                              Not selected — another estimate was accepted for
                              this request.
                            </p>
                          ) : null}
                        </div>

                        <div className="flex flex-wrap items-center gap-3 sm:text-right">
                          {est.total ? (
                            <div className="flex flex-col sm:items-end">
                              <span className="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
                                Quote total
                              </span>
                              <span className="text-xl font-bold tabular-nums text-foreground">
                                {formatMoney(est.total)}
                              </span>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              Pricing pending
                            </span>
                          )}

                          <div className="flex items-center gap-2">
                            {isRejected && !isAccepted ? null : (
                              <>
                                {href ? (
                                  <Button
                                    asChild
                                    size="sm"
                                    variant="outline"
                                    className="gap-1.5 font-medium"
                                  >
                                    <Link href={href}>
                                      {isAccepted
                                        ? "View signed estimate"
                                        : "View estimate"}
                                      <ExternalLink className="size-3.5" />
                                    </Link>
                                  </Button>
                                ) : (
                                  <Button variant="outline" size="sm" disabled>
                                    Preparing…
                                  </Button>
                                )}
                                {canSign && est.id ? (
                                  <Button
                                    type="button"
                                    size="sm"
                                    className="gap-1.5 font-medium"
                                    disabled={accepting}
                                    onClick={() => setAcceptTarget(est)}
                                  >
                                    Accept
                                  </Button>
                                ) : null}
                                {isAccepted ? null : (
                                  <Button asChild variant="outline" size="sm">
                                    <Link
                                      href={customerPaths.messages}
                                      title={`Message ${est.providerName}`}
                                    >
                                      <MessageSquare className="size-3.5" />
                                      <span className="sr-only">
                                        Message provider
                                      </span>
                                    </Link>
                                  </Button>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ) : null}

          {/* SECTION 2: Request & Service Specifications */}
          <section className="rounded-xl border border-border bg-card p-5 sm:p-6 shadow-xs">
            <div className="border-b border-border pb-4">
              <h2 className="text-base font-semibold text-foreground">
                Service & request details
              </h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Job parameters and specifications sent to matching professionals
              </p>
            </div>

            <dl className="mt-5 grid gap-4 sm:grid-cols-2 text-sm">
              <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/30 p-3.5">
                <Sparkles className="mt-0.5 size-4 shrink-0 text-primary" />
                <div>
                  <dt className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
                    Requested service
                  </dt>
                  <dd className="mt-0.5 font-medium text-foreground">
                    {batch.serviceName}
                  </dd>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/30 p-3.5">
                <MapPin className="mt-0.5 size-4 shrink-0 text-primary" />
                <div>
                  <dt className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
                    Service address
                  </dt>
                  <dd className="mt-0.5 font-medium text-foreground">
                    {formatAddress(batch)}
                  </dd>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/30 p-3.5">
                <CalendarDays className="mt-0.5 size-4 shrink-0 text-primary" />
                <div>
                  <dt className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
                    Date submitted
                  </dt>
                  <dd className="mt-0.5 font-medium text-foreground">
                    {batch.createdAt ? formatDate(batch.createdAt) : "—"}
                  </dd>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/30 p-3.5">
                <Building2 className="mt-0.5 size-4 shrink-0 text-primary" />
                <div>
                  <dt className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
                    Channel & distribution
                  </dt>
                  <dd className="mt-0.5 font-medium text-foreground capitalize">
                    {batch.channel || "Marketplace Quote Request"}
                  </dd>
                </div>
              </div>
            </dl>

            {/* Special Details / Customer Notes */}
            <div className="mt-5">
              <h3 className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
                Customer notes & specifications
              </h3>
              {batch.details ? (
                <div className="mt-2 rounded-lg border border-border bg-muted/20 p-4 text-sm leading-relaxed text-foreground whitespace-pre-wrap">
                  {batch.details}
                </div>
              ) : (
                <p className="mt-2 text-xs italic text-muted-foreground">
                  No additional notes or special requirements provided for this
                  quote request.
                </p>
              )}
            </div>
          </section>

          {/* SECTION 3: Provider Activity & Contact */}
          <section className="rounded-xl border border-border bg-card p-5 sm:p-6 shadow-xs">
            <div className="border-b border-border pb-4">
              <h2 className="text-base font-semibold text-foreground">
                Matched professionals ({batch.professionals.length})
              </h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Providers notified of this request and their activity status
              </p>
            </div>

            <div className="mt-4 space-y-3">
              {batch.professionals.map((pro) => (
                <div
                  key={pro.requestId}
                  className="rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary/40"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex items-start gap-3">
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted font-semibold text-sm text-foreground border border-border">
                        {pro.providerName.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-semibold text-foreground">
                          {pro.providerName}
                        </p>
                        <p className="font-mono text-xs text-muted-foreground">
                          Ref: {pro.number || pro.requestId.slice(0, 8)}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <Badge
                        variant={pro.seen ? "secondary" : "outline"}
                        className={cn(
                          pro.seen
                            ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                            : "text-muted-foreground",
                        )}
                      >
                        {pro.seen ? (
                          <span className="inline-flex items-center gap-1">
                            <Eye className="size-3" />
                            Viewed
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1">
                            <Clock className="size-3" />
                            Not seen yet
                          </span>
                        )}
                      </Badge>
                      <Badge variant="outline">{statusLabel(pro.status)}</Badge>

                      <Button asChild variant="ghost" size="sm" className="h-7 text-xs">
                        <Link href={customerPaths.messages}>
                          <MessageSquare className="size-3.5" />
                          Message
                        </Link>
                      </Button>
                    </div>
                  </div>

                  {/* Estimates from this provider */}
                  {pro.estimates.length > 0 ? (
                    <div className="mt-3 border-t border-border pt-3">
                      <p className="text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
                        Estimates submitted
                      </p>
                      <ul className="mt-2 space-y-2">
                        {pro.estimates.map((est) => (
                          <li
                            key={est.id}
                            className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-muted/40 px-3 py-2 text-sm"
                          >
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-foreground">
                                {est.number || "Estimate"}
                              </span>
                              <Badge variant="outline" className="text-xs">
                                {statusLabel(est.status)}
                              </Badge>
                              {est.total ? (
                                <span className="font-semibold tabular-nums text-foreground">
                                  {formatMoney(est.total)}
                                </span>
                              ) : null}
                            </div>

                            {(() => {
                              const batchHasAccepted =
                                consolidatedEstimates.some((item) =>
                                  isAcceptedStatus(item.status),
                                );
                              const isAccepted = isAcceptedStatus(est.status);
                              const isRejected =
                                isRejectedStatus(est.status) ||
                                (batchHasAccepted && !isAccepted);
                              const canSign =
                                isSignableStatus(est.status) &&
                                !batchHasAccepted;
                              const href = estimateHref(est);
                              if (isRejected && !isAccepted) {
                                return (
                                  <span className="text-xs text-muted-foreground">
                                    Rejected
                                  </span>
                                );
                              }
                              if (!href) {
                                return (
                                  <span className="text-xs text-muted-foreground">
                                    Preparing…
                                  </span>
                                );
                              }
                              return (
                                <div className="flex items-center gap-2">
                                  <Button
                                    asChild
                                    size="sm"
                                    variant="outline"
                                    className="h-7 text-xs"
                                  >
                                    <Link href={href}>
                                      {isAccepted ? "View signed" : "View"}
                                    </Link>
                                  </Button>
                                  {canSign && est.id ? (
                                    <Button
                                      type="button"
                                      size="sm"
                                      className="h-7 text-xs"
                                      disabled={accepting}
                                      onClick={() =>
                                        setAcceptTarget({
                                          id: est.id,
                                          number: est.number || "Estimate",
                                          title: "",
                                          status: est.status,
                                          total: est.total,
                                          shareToken: est.shareToken || "",
                                          providerName: pro.providerName,
                                          providerSlug: pro.providerSlug,
                                          providerId: pro.providerId,
                                          requestId: pro.requestId,
                                        })
                                      }
                                    >
                                      Accept
                                    </Button>
                                  ) : null}
                                </div>
                              );
                            })()}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    <p className="mt-3 text-xs text-muted-foreground">
                      No estimate submitted yet by this professional.
                    </p>
                  )}
                </div>
              ))}

              {!batch.professionals.length ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  No professionals linked to this request yet.
                </p>
              ) : null}
            </div>
          </section>
        </div>

        {/* SIDEBAR: Lifecycle Timeline & Guidance */}
        <aside className="space-y-6">
          {/* Stepped Timeline */}
          <div className="rounded-xl border border-border bg-card p-5 shadow-xs xl:sticky xl:top-20">
            <h2 className="text-sm font-semibold text-foreground">
              Request lifecycle
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Real-time progress of your quote request
            </p>

            <div className="relative mt-5 space-y-6 pl-6 before:absolute before:left-2.5 before:top-2.5 before:bottom-2.5 before:w-0.5 before:bg-border">
              {timelineSteps.map((step, idx) => (
                <div key={step.id} className="relative flex items-start gap-3">
                  <span
                    className={cn(
                      "absolute -left-6 top-0 flex size-5 items-center justify-center rounded-full text-[10px] font-bold ring-4 ring-card",
                      step.done
                        ? "bg-emerald-600 text-white"
                        : step.current
                          ? "bg-primary text-primary-foreground ring-primary/20 animate-pulse"
                          : "border border-border bg-muted text-muted-foreground",
                    )}
                  >
                    {step.done ? (
                      <Check className="size-3" />
                    ) : (
                      <span>{idx + 1}</span>
                    )}
                  </span>
                  <div className="min-w-0">
                    <p
                      className={cn(
                        "text-sm font-medium",
                        step.done
                          ? "text-foreground"
                          : step.current
                            ? "font-semibold text-primary"
                            : "text-muted-foreground",
                      )}
                    >
                      {step.label}
                    </p>
                    {step.detail ? (
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {step.detail}
                      </p>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>

            {/* Need Assistance Card */}
            <div className="mt-6 rounded-lg border border-border bg-muted/40 p-4 text-xs text-foreground">
              <div className="flex items-center gap-1.5 font-semibold text-foreground">
                <HelpCircle className="size-4 shrink-0 text-primary" />
                <span>How quote requests work</span>
              </div>
              <ul className="mt-2.5 space-y-2 text-muted-foreground">
                <li className="flex items-start gap-1.5">
                  <span className="text-primary">•</span>
                  <span>Providers typically review and respond within 24–48 hours.</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="text-primary">•</span>
                  <span>Compare prices, terms, and reviews before signing.</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="text-primary">•</span>
                  <span>Need changes? Message the provider directly anytime.</span>
                </li>
              </ul>
            </div>
          </div>
        </aside>
      </div>
    </PortalPage>

    <Dialog
      open={Boolean(acceptTarget)}
      onOpenChange={(open) => {
        if (!open && !accepting) setAcceptTarget(null);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Accept this estimate?</DialogTitle>
          <DialogDescription>
            Accept{" "}
            <strong>{acceptTarget?.number}</strong> from{" "}
            <strong>{acceptTarget?.providerName}</strong>
            {acceptTarget?.total
              ? ` for ${formatMoney(acceptTarget.total)}`
              : ""}
            . Other estimates for this request will be rejected and their Accept
            buttons will be removed.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            disabled={accepting}
            onClick={() => setAcceptTarget(null)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            disabled={accepting || !acceptTarget?.id}
            onClick={() => void confirmAcceptEstimate()}
          >
            {accepting ? "Accepting…" : "Confirm accept"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}
