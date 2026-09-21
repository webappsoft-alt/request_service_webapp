"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, Plus, Search } from "lucide-react";
import { PortalPage } from "@/components/portal/portal-page";
import { NoData } from "@/components/shared/no-data";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CenteredSpinner } from "@/components/ui/spinner";
import {
  loadRememberedCustomerEstimates,
  type CustomerEstimateListItem,
} from "@/lib/api/customer-estimates";
import {
  extractEstimateTokenFromInput,
  rememberCustomerEstimateToken,
} from "@/lib/booking/customer-estimates-store";
import { customerPaths } from "@/lib/customer-paths";
import { formatDate, formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { selectAuth, selectIsAuthenticated } from "@/store/authSlice";
import {
  fetchCustomerEstimates,
  fetchCustomerQuoteRequests,
  selectCustomerApiEstimates,
  selectCustomerApiEstimatesLoading,
  selectCustomerQuoteBatches,
  selectCustomerQuoteBatchesLoading,
  type CustomerQuoteBatch,
} from "@/store/customerQuotesSlice";

function statusVariant(status: string) {
  const value = status.toLowerCase();
  if (value === "accepted" || value === "converted_to_job")
    return "default" as const;
  if (
    value === "sent" ||
    value === "finalized" ||
    value === "viewed" ||
    value === "site_visit" ||
    value === "inspected" ||
    value === "draft"
  )
    return "secondary" as const;
  if (value === "rejected" || value === "expired" || value === "declined")
    return "destructive" as const;
  return "outline" as const;
}

function statusLabel(status: string) {
  const value = status.toLowerCase();
  if (value === "site_visit") return "Site visit";
  if (value === "draft") return "Preparing";
  if (value === "inspected") return "Inspected";
  if (value === "finalized") return "Ready to send";
  return status
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatAddress(batch: CustomerQuoteBatch) {
  const line = [batch.street, batch.city, batch.state, batch.zip]
    .filter(Boolean)
    .join(", ");
  return line || (batch.zip ? `ZIP ${batch.zip}` : "Address pending");
}

function batchKey(batch: CustomerQuoteBatch) {
  return (
    batch.quoteBatchId ||
    batch.professionals[0]?.requestId ||
    `${batch.serviceName}-${batch.createdAt}`
  );
}

function batchOverallStatus(batch: CustomerQuoteBatch) {
  const statuses = batch.professionals.map((p) => p.status);
  if (statuses.some((s) => s === "converted_to_job")) return "converted_to_job";
  if (statuses.some((s) => s === "accepted")) return "accepted";
  if (statuses.some((s) => s === "estimate_sent")) return "estimate_sent";
  if (batch.seenCount > 0) return "viewed";
  return "new";
}

type TabId = "requests" | "estimates";

export function CustomerEstimatesDashboardView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const dispatch = useAppDispatch();
  const auth = useAppSelector(selectAuth);
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  const apiEstimates = useAppSelector(selectCustomerApiEstimates);
  const apiEstimatesLoading = useAppSelector(selectCustomerApiEstimatesLoading);
  const batches = useAppSelector(selectCustomerQuoteBatches);
  const batchesLoading = useAppSelector(selectCustomerQuoteBatchesLoading);
  const [remembered, setRemembered] = useState<CustomerEstimateListItem[]>([]);
  const [rememberedLoading, setRememberedLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [openLink, setOpenLink] = useState("");

  const tabParam = searchParams.get("tab");
  const activeTab: TabId =
    tabParam === "estimates" ? "estimates" : "requests";

  useEffect(() => {
    if (!auth.hydrated) return;
    if (!isAuthenticated) {
      router.replace(
        `/login?next=${encodeURIComponent(customerPaths.estimates)}`,
      );
      return;
    }

    void dispatch(fetchCustomerEstimates());
    void dispatch(fetchCustomerQuoteRequests());

    let cancelled = false;
    void (async () => {
      setRememberedLoading(true);
      try {
        const list = await loadRememberedCustomerEstimates();
        if (!cancelled) setRemembered(list);
      } catch {
        if (!cancelled) setRemembered([]);
      } finally {
        if (!cancelled) setRememberedLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [auth.hydrated, isAuthenticated, router, dispatch]);

  const estimateItems = useMemo(() => {
    const byToken = new Map<string, CustomerEstimateListItem>();
    for (const item of remembered) {
      if (item.shareToken) byToken.set(item.shareToken, item);
    }
    for (const item of apiEstimates) {
      if (!item.shareToken && !item.id) continue;
      const key = item.shareToken || item.id;
      byToken.set(key, {
        id: item.id,
        number: item.number,
        title: item.title,
        status: item.status,
        total: item.total,
        shareToken: item.shareToken,
        issuedAt: item.updatedAt || item.createdAt || null,
        provider: item.provider,
      });
    }
    return [...byToken.values()];
  }, [apiEstimates, remembered]);

  const filteredBatches = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return batches;
    return batches.filter((batch) =>
      [
        batch.serviceName,
        batch.street,
        batch.city,
        batch.zip,
        ...batch.professionals.map((p) => p.providerName),
      ]
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [batches, search]);

  const filteredEstimates = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return estimateItems;
    return estimateItems.filter((item) =>
      [item.title, item.number, item.status, item.provider?.companyName]
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [estimateItems, search]);

  function setTab(next: TabId) {
    const params = new URLSearchParams(searchParams.toString());
    if (next === "requests") params.delete("tab");
    else params.set("tab", next);
    const qs = params.toString();
    router.replace(
      qs ? `${customerPaths.estimates}?${qs}` : customerPaths.estimates,
    );
  }

  function handleOpenLink(event: React.FormEvent) {
    event.preventDefault();
    const token = extractEstimateTokenFromInput(openLink);
    if (!token) return;
    rememberCustomerEstimateToken(token);
    router.push(customerPaths.estimate(token));
  }

  if (!auth.hydrated || !isAuthenticated) {
    return <CenteredSpinner label="Checking your account…" />;
  }

  const loadingRequests = batchesLoading && !batches.length;
  const loadingEstimates =
    (apiEstimatesLoading || rememberedLoading) && !estimateItems.length;

  return (
    <PortalPage
      eyebrow="Activity"
      title="Estimates"
      description="Submit a quote request, track which professionals viewed it, then review and approve the estimates you receive."
      actions={
        <Button asChild size="sm">
          <Link href={customerPaths.estimateRequest}>
            <Plus className="size-3.5" />
            Request new estimate
          </Link>
        </Button>
      }
    >
      <div className="mb-4 flex flex-wrap items-center gap-2 border-b border-black/10 pb-3">
        <button
          type="button"
          onClick={() => setTab("requests")}
          className={cn(
            "rounded-[4px] px-3 py-1.5 text-sm font-medium transition-colors",
            activeTab === "requests"
              ? "bg-[#003F7D] text-white"
              : "text-muted-foreground hover:bg-muted",
          )}
        >
          Quote requests ({batches.length})
        </button>
        <button
          type="button"
          onClick={() => setTab("estimates")}
          className={cn(
            "rounded-[4px] px-3 py-1.5 text-sm font-medium transition-colors",
            activeTab === "estimates"
              ? "bg-[#003F7D] text-white"
              : "text-muted-foreground hover:bg-muted",
          )}
        >
          Estimates ({estimateItems.length})
        </button>
      </div>

      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative max-w-md flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={
              activeTab === "requests"
                ? "Search requests…"
                : "Search estimates…"
            }
            className="h-9 bg-card pl-8"
          />
        </div>
        {activeTab === "estimates" ? (
          <form
            onSubmit={handleOpenLink}
            className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center"
          >
            <Input
              value={openLink}
              onChange={(event) => setOpenLink(event.target.value)}
              placeholder="Paste estimate link or token…"
              className="h-9 bg-card"
            />
            <Button type="submit" size="sm" disabled={!openLink.trim()}>
              Open estimate
            </Button>
          </form>
        ) : null}
      </div>

      {activeTab === "requests" ? (
        <div className="overflow-hidden rounded-[4px] border border-black/10 bg-card">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] text-left text-sm">
              <thead className="bg-[#e8eef5] text-[11px] tracking-[0.12em] text-[#003F7D] uppercase">
                <tr>
                  <th className="px-3 py-2.5 font-semibold">Request / Service</th>
                  <th className="px-3 py-2.5 font-semibold">Address</th>
                  <th className="px-3 py-2.5 font-semibold">Status</th>
                  <th className="px-3 py-2.5 font-semibold">Sent</th>
                  <th className="px-3 py-2.5 font-semibold">Seen</th>
                  <th className="px-3 py-2.5 font-semibold">Estimates</th>
                  <th className="px-3 py-2.5 font-semibold">Created</th>
                  <th className="px-3 py-2.5 font-semibold"> </th>
                </tr>
              </thead>
              <tbody>
                {loadingRequests ? (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-3 py-10 text-center text-muted-foreground"
                    >
                      Loading requests…
                    </td>
                  </tr>
                ) : filteredBatches.length ? (
                  filteredBatches.map((batch) => {
                    const id = batchKey(batch);
                    const status = batchOverallStatus(batch);
                    return (
                      <tr
                        key={id}
                        className="border-t border-black/10 hover:bg-[#f7f8fa]"
                      >
                        <td className="px-3 py-3">
                          <p className="font-medium">{batch.serviceName}</p>
                          <p className="text-xs text-muted-foreground">
                            {batch.channel || "marketplace"}
                          </p>
                        </td>
                        <td className="px-3 py-3 text-muted-foreground">
                          {formatAddress(batch)}
                        </td>
                        <td className="px-3 py-3">
                          <Badge variant={statusVariant(status)}>
                            {statusLabel(status)}
                          </Badge>
                        </td>
                        <td className="px-3 py-3 tabular-nums">
                          {batch.sentToCount}
                        </td>
                        <td className="px-3 py-3 tabular-nums">
                          {batch.seenCount}
                        </td>
                        <td className="px-3 py-3 tabular-nums">
                          {batch.estimateCount}
                        </td>
                        <td className="px-3 py-3 text-muted-foreground">
                          {batch.createdAt
                            ? formatDate(batch.createdAt)
                            : "—"}
                        </td>
                        <td className="px-3 py-3 text-right">
                          <Button asChild size="sm" variant="outline">
                            <Link href={customerPaths.quoteRequest(id)}>
                              <Eye className="size-3.5" />
                              View details
                            </Link>
                          </Button>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={8} className="px-3 py-8">
                      <NoData
                        title="No quote requests yet"
                        description="Request a new estimate to send your job details to matching professionals."
                      />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="overflow-hidden rounded-[4px] border border-black/10 bg-card">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-left text-sm">
              <thead className="bg-[#e8eef5] text-[11px] tracking-[0.12em] text-[#003F7D] uppercase">
                <tr>
                  <th className="px-3 py-2.5 font-semibold">Estimate</th>
                  <th className="px-3 py-2.5 font-semibold">Professional</th>
                  <th className="px-3 py-2.5 font-semibold">Status</th>
                  <th className="px-3 py-2.5 font-semibold">Total</th>
                  <th className="px-3 py-2.5 font-semibold"> </th>
                </tr>
              </thead>
              <tbody>
                {loadingEstimates ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-3 py-10 text-center text-muted-foreground"
                    >
                      Loading estimates…
                    </td>
                  </tr>
                ) : filteredEstimates.length ? (
                  filteredEstimates.map((item) => (
                    <tr
                      key={item.shareToken || item.id}
                      className="border-t border-black/10 hover:bg-[#f7f8fa]"
                    >
                      <td className="px-3 py-3">
                        <p className="font-medium">
                          {item.title || item.number || "Estimate"}
                        </p>
                        <p className="font-mono text-xs text-muted-foreground">
                          {item.number || item.id}
                        </p>
                      </td>
                      <td className="px-3 py-3 text-muted-foreground">
                        {item.provider?.companyName || "Professional"}
                      </td>
                      <td className="px-3 py-3">
                        <Badge variant={statusVariant(item.status)}>
                          {statusLabel(item.status)}
                        </Badge>
                      </td>
                      <td className="px-3 py-3 font-semibold tabular-nums text-[#003F7D]">
                        {formatMoney(item.total)}
                      </td>
                      <td className="px-3 py-3 text-right">
                        {(() => {
                          // Prefer CRM id so the account dashboard uses /user/estimates/:id
                          // (public share-token lookup fails for unshared drafts / site visits).
                          const href = item.id
                            ? customerPaths.estimate(item.id)
                            : item.shareToken
                              ? customerPaths.estimate(item.shareToken)
                              : customerPaths.estimates;
                          const canReview = item.status === "sent";
                          const label = canReview
                            ? "Review & sign"
                            : "View";
                          if (!item.id && !item.shareToken) {
                            return (
                              <span className="text-xs text-muted-foreground">
                                Waiting for share link
                              </span>
                            );
                          }
                          return (
                            <Button asChild size="sm">
                              <Link href={href}>{label}</Link>
                            </Button>
                          );
                        })()}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="px-3 py-8">
                      <NoData
                        title="No estimates yet"
                        description="When professionals submit estimates for your request, they appear here."
                      />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </PortalPage>
  );
}
