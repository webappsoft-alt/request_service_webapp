"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ExternalLink, Eye, Plus } from "lucide-react";
import { PortalDataTable } from "@/components/portal/portal-data-table";
import { PortalPage } from "@/components/portal/portal-page";
import { StatusPill, moneyTone, requestTone } from "@/components/portal/status-pill";
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

function statusLabel(status: string) {
  const value = String(status || "").toLowerCase();
  if (value === "site_visit") return "Site visit";
  if (value === "draft") return "Preparing";
  if (value === "inspected") return "Inspected";
  if (value === "finalized") return "Ready to send";
  if (value === "converted_to_job") return "Converted to Job";
  if (value === "declined") return "Declined";
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

function batchReference(batch: CustomerQuoteBatch) {
  return (
    batch.professionals[0]?.number ||
    batch.quoteBatchId?.slice(0, 8) ||
    batch.professionals[0]?.requestId?.slice(0, 8) ||
    "REQ"
  );
}

function batchOverallStatus(batch: CustomerQuoteBatch) {
  const pros = batch.professionals || [];
  const statuses = pros.map((p) => String(p.status || "").toLowerCase());

  if (statuses.some((s) => s === "converted_to_job")) return "converted_to_job";
  if (statuses.some((s) => s === "accepted")) return "accepted";
  if (batch.estimateCount > 0 || statuses.some((s) => s === "estimate_sent")) {
    return "estimate_sent";
  }
  if (statuses.some((s) => s === "changes_requested")) return "changes_requested";
  if (statuses.some((s) => s === "site_visit")) return "site_visit";

  const isDeclined = (s: string) =>
    ["declined", "rejected", "closed", "cancelled"].includes(s);

  if (pros.length > 0 && statuses.every(isDeclined)) {
    return "declined";
  }

  if (batch.seenCount > 0 || statuses.some((s) => s === "viewed" || s === "contacted")) {
    return "viewed";
  }
  return "new";
}

type TabId = "requests" | "estimates";

export function CustomerEstimatesDashboardView({
  defaultTab = "estimates",
}: {
  defaultTab?: TabId;
} = {}) {
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
  const [openLink, setOpenLink] = useState("");

  const tabParam = searchParams.get("tab");
  const activeTab: TabId =
    tabParam === "estimates"
      ? "estimates"
      : tabParam === "requests"
        ? "requests"
        : defaultTab;

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

  function setTab(next: TabId) {
    if (next === "requests") {
      router.replace(customerPaths.requests);
    } else {
      router.replace(customerPaths.estimates);
    }
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
  const isRequests = activeTab === "requests";

  return (
    <PortalPage
      eyebrow="Activity"
      title={
        isRequests
          ? `Quote requests (${batches.length})`
          : `Estimates (${estimateItems.length})`
      }
      description={
        isRequests
          ? "Submit quote requests to verified local professionals, track views, and compare proposals."
          : "Review proposals from service professionals, compare quotes, and sign online to begin work."
      }
      actions={
        <Button asChild size="sm">
          <Link href={customerPaths.estimateRequest}>
            <Plus className="size-3.5" />
            Request new estimate
          </Link>
        </Button>
      }
    >
      {/* Provider-style FilterTabs Bar */}
      <div className="flex flex-wrap gap-x-6 border-b border-border bg-card px-4">
        <button
          type="button"
          onClick={() => setTab("requests")}
          className={cn(
            "-mb-px cursor-pointer border-b-2 py-2.5 text-sm font-medium transition-colors",
            activeTab === "requests"
              ? "border-primary text-primary font-semibold"
              : "border-transparent text-muted-foreground hover:text-foreground",
          )}
        >
          Quote requests ({batches.length})
        </button>
        <button
          type="button"
          onClick={() => setTab("estimates")}
          className={cn(
            "-mb-px cursor-pointer border-b-2 py-2.5 text-sm font-medium transition-colors",
            activeTab === "estimates"
              ? "border-primary text-primary font-semibold"
              : "border-transparent text-muted-foreground hover:text-foreground",
          )}
        >
          Estimates ({estimateItems.length})
        </button>
      </div>

      {activeTab === "requests" ? (
        <PortalDataTable
          filename="quote-requests"
          countLabel="Quote requests"
          searchPlaceholder="Search requests…"
          loading={loadingRequests}
          rows={batches}
          rowKey={(row) => batchKey(row)}
          rowHref={(row) => customerPaths.quoteRequest(batchKey(row))}
          empty="No quote requests yet."
          columns={[
            {
              id: "number",
              header: "Request #",
              sortValue: (row) => batchReference(row),
              searchValue: (row) => batchReference(row),
              exportValue: (row) => batchReference(row),
              cell: (row) => (
                <Link
                  href={customerPaths.quoteRequest(batchKey(row))}
                  className="font-mono text-xs font-medium text-primary hover:underline"
                >
                  {batchReference(row)}
                </Link>
              ),
            },
            {
              id: "service",
              header: "Service name",
              sortValue: (row) => row.serviceName,
              searchValue: (row) => `${row.serviceName} ${row.channel}`,
              exportValue: (row) => row.serviceName,
              cell: (row) => (
                <div>
                  <Link
                    href={customerPaths.quoteRequest(batchKey(row))}
                    className="font-medium text-primary hover:underline"
                  >
                    {row.serviceName}
                  </Link>
                  <p className="text-xs text-muted-foreground capitalize">
                    {row.channel || "marketplace"}
                  </p>
                </div>
              ),
            },
            {
              id: "address",
              header: "Address",
              sortValue: (row) => formatAddress(row),
              searchValue: (row) => formatAddress(row),
              exportValue: (row) => formatAddress(row),
              cell: (row) => (
                <span className="text-muted-foreground">
                  {formatAddress(row)}
                </span>
              ),
            },
            {
              id: "status",
              header: "Status",
              sortValue: (row) => batchOverallStatus(row),
              cell: (row) => {
                const st = batchOverallStatus(row);
                return (
                  <StatusPill label={statusLabel(st)} tone={requestTone(st)} />
                );
              },
            },
            {
              id: "providers",
              header: "Pros",
              sortValue: (row) => row.sentToCount,
              cell: (row) => (
                <span className="text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">{row.sentToCount}</span> notified
                  {row.seenCount > 0 ? (
                    <> · <span className="font-medium text-foreground">{row.seenCount}</span> seen</>
                  ) : null}
                </span>
              ),
            },
            {
              id: "estimates",
              header: "Estimates",
              className: "text-center",
              sortValue: (row) => row.estimateCount,
              cell: (row) => (
                <span
                  className={cn(
                    "tabular-nums font-semibold",
                    row.estimateCount > 0
                      ? "text-primary"
                      : "text-muted-foreground",
                  )}
                >
                  {row.estimateCount > 0 ? `${row.estimateCount} received` : "0"}
                </span>
              ),
            },
            {
              id: "created",
              header: "Date",
              sortValue: (row) => row.createdAt,
              cell: (row) => (
                <span className="text-muted-foreground">
                  {row.createdAt ? formatDate(row.createdAt) : "—"}
                </span>
              ),
            },
          ]}
          actions={(row) => [
            {
              label: "View details",
              href: customerPaths.quoteRequest(batchKey(row)),
              icon: <Eye className="size-3.5" />,
              quick: true,
            },
          ]}
        />
      ) : (
        <PortalDataTable
          filename="estimates"
          countLabel="Estimates"
          searchPlaceholder="Search estimates…"
          loading={loadingEstimates}
          toolbar={
            <form onSubmit={handleOpenLink} className="flex items-center gap-2">
              <Input
                value={openLink}
                onChange={(event) => setOpenLink(event.target.value)}
                placeholder="Paste estimate link or token…"
                className="h-8.5 w-48 sm:w-60 text-xs bg-card"
              />
              <Button
                type="submit"
                size="sm"
                className="h-8.5 text-xs"
                disabled={!openLink.trim()}
              >
                Open
              </Button>
            </form>
          }
          rows={estimateItems}
          rowKey={(row) => row.shareToken || row.id || row.number}
          rowHref={(row) =>
            row.shareToken
              ? customerPaths.estimate(row.shareToken)
              : row.id
                ? customerPaths.estimate(row.id)
                : ""
          }
          empty="No estimates received yet."
          columns={[
            {
              id: "number",
              header: "Quote #",
              sortValue: (row) => row.number,
              searchValue: (row) => row.number,
              cell: (row) => {
                const href = row.shareToken
                  ? customerPaths.estimate(row.shareToken)
                  : row.id
                    ? customerPaths.estimate(row.id)
                    : null;
                return href ? (
                  <Link
                    href={href}
                    className="font-mono text-xs font-medium text-primary hover:underline"
                  >
                    {row.number || "Estimate"}
                  </Link>
                ) : (
                  <span className="font-mono text-xs font-medium text-foreground">
                    {row.number || "Estimate"}
                  </span>
                );
              },
            },
            {
              id: "name",
              header: "Estimate name",
              sortValue: (row) => row.title || row.number || "Estimate",
              searchValue: (row) => `${row.title || ""} ${row.number || ""}`,
              cell: (row) => {
                const href = row.shareToken
                  ? customerPaths.estimate(row.shareToken)
                  : row.id
                    ? customerPaths.estimate(row.id)
                    : null;
                return href ? (
                  <Link
                    href={href}
                    className="font-medium text-primary hover:underline"
                  >
                    {row.title || row.number || "Estimate"}
                  </Link>
                ) : (
                  <span className="font-medium text-foreground">
                    {row.title || row.number || "Estimate"}
                  </span>
                );
              },
            },
            {
              id: "provider",
              header: "Professional",
              sortValue: (row) => row.provider?.companyName || "",
              searchValue: (row) => row.provider?.companyName || "",
              cell: (row) => (
                <Link
                  href={customerPaths.messages}
                  className="font-medium text-primary hover:underline"
                >
                  {row.provider?.companyName || "Pro"}
                </Link>
              ),
            },
            {
              id: "status",
              header: "Status",
              sortValue: (row) => row.status,
              cell: (row) => (
                <StatusPill
                  label={statusLabel(row.status)}
                  tone={moneyTone(row.status)}
                />
              ),
            },
            {
              id: "total",
              header: "Total",
              sortValue: (row) => row.total ?? 0,
              cell: (row) => (
                <span className="font-semibold tabular-nums text-foreground">
                  {row.total ? formatMoney(row.total) : "—"}
                </span>
              ),
            },
            {
              id: "issued",
              header: "Date",
              sortValue: (row) => row.issuedAt || "",
              cell: (row) => (
                <span className="text-muted-foreground">
                  {row.issuedAt ? formatDate(row.issuedAt) : "—"}
                </span>
              ),
            },
          ]}
          actions={(row) => {
            const href = row.shareToken
              ? customerPaths.estimate(row.shareToken)
              : row.id
                ? customerPaths.estimate(row.id)
                : null;
            if (!href) return [];
            return [
              {
                label:
                  row.status === "sent" ? "Review & accept" : "View estimate",
                href,
                icon: <ExternalLink className="size-3.5" />,
                quick: true,
              },
            ];
          }}
        />
      )}
    </PortalPage>
  );
}
