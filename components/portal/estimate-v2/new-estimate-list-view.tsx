"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PortalPage } from "@/components/portal/portal-page";
import { PortalDataTable } from "@/components/portal/portal-data-table";
import {
  listEstimateV2Opportunities,
  type EstimateV2Opportunity,
} from "@/lib/api/estimate-v2-client";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

function customerLabel(opportunity: EstimateV2Opportunity) {
  const c = opportunity.customerId;
  if (!c || typeof c === "string") return "Customer";
  const company = String(c.companyName || "").trim();
  if (company) return company;
  return [c.firstName, c.lastName].filter(Boolean).join(" ").trim() || "Customer";
}

function propertyLabel(opportunity: EstimateV2Opportunity) {
  const p = opportunity.propertyAddress || {};
  const street = String(p.address || p.street || "").trim();
  const city = String(p.city || "").trim();
  const state = String(p.state || "").trim();
  const zip = String(p.zip || "").trim();
  const parts = [street, [city, state].filter(Boolean).join(" "), zip]
    .map((part) => part.trim())
    .filter((part) => part.length > 1);
  return parts.join(", ") || "—";
}

function statusLabel(status: string) {
  return status.replace(/_/g, " ");
}

export function NewEstimateListView() {
  const router = useRouter();
  const [items, setItems] = useState<EstimateV2Opportunity[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await listEstimateV2Opportunities({
        page,
        limit: 20,
        search: search.trim() || undefined,
      });
      setItems(result.items);
      setTotal(result.total);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not load estimates.");
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    void load();
  }, [load]);

  const rows = useMemo(() => items, [items]);

  return (
    <PortalPage
      eyebrow="Work / Estimate"
      title={`Estimates (${total})`}
      description="Customer → property → work request → optional site assessment → estimate."
      actions={
        <Button size="sm" onClick={() => router.push("/pro/dashboard/new-estimate/new")}>
          <Plus className="size-3.5" />
          New estimate
        </Button>
      }
    >
      <PortalDataTable
        filename="estimates"
        countLabel="Estimates"
        searchPlaceholder="Search estimates"
        loading={loading}
        pageSize={20}
        serverPagination={{
          page,
          pageSize: 20,
          total,
          totalPages: Math.max(1, Math.ceil(total / 20)),
          onPageChange: setPage,
          search,
          onSearchChange: (value) => {
            setPage(1);
            setSearch(value);
          },
        }}
        rows={rows}
        rowKey={(row) => row.id}
        rowHref={(row) => `/pro/dashboard/new-estimate/${row.id}`}
        columns={[
          {
            id: "number",
            header: "Estimate",
            sortValue: (row) => row.number,
            cell: (row) => (
              <div>
                <Link
                  href={`/pro/dashboard/new-estimate/${row.id}`}
                  className="font-medium text-primary hover:underline"
                >
                  {row.number}
                </Link>
                <p className="mt-0.5 text-xs font-medium text-foreground">{row.title}</p>
                {row.categoryName ? (
                  <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {row.categoryName}
                  </p>
                ) : null}
              </div>
            ),
          },
          {
            id: "customer",
            header: "Customer",
            sortValue: (row) => customerLabel(row),
            cell: (row) => (
              <div>
                <p className="text-sm font-medium">{customerLabel(row)}</p>
                {typeof row.customerId === "object" && row.customerId?.phone ? (
                  <p className="mt-0.5 text-xs text-muted-foreground">{row.customerId.phone}</p>
                ) : null}
              </div>
            ),
          },
          {
            id: "property",
            header: "Property",
            sortValue: (row) => propertyLabel(row),
            cell: (row) => (
              <span className="text-sm text-muted-foreground">{propertyLabel(row)}</span>
            ),
          },
          {
            id: "prep",
            header: "Prep",
            sortValue: (row) => row.prepChoice || "",
            cell: (row) => {
              const label =
                row.prepChoice === "schedule_assessment"
                  ? "Site visit"
                  : row.prepChoice === "have_information"
                    ? "Have info"
                    : row.prepChoice === "create_now"
                      ? "Create now"
                      : "—";
              return (
                <span className="text-xs text-muted-foreground">{label}</span>
              );
            },
          },
          {
            id: "estimate",
            header: "Estimate",
            sortValue: (row) =>
              row.estimates?.[0]?.number || (row.estimateIds?.length ? "1" : ""),
            cell: (row) => {
              const est = row.estimates?.[0];
              if (est?.number) {
                return (
                  <div>
                    <p className="text-sm font-medium">{est.number}</p>
                    <p className="text-[11px] capitalize text-muted-foreground">
                      {String(est.status || "").replace(/_/g, " ")}
                    </p>
                  </div>
                );
              }
              const linked = row.estimateIds?.length || 0;
              if (linked > 0 || row.status?.startsWith("estimate_") || row.status === "won") {
                return (
                  <span className="text-xs font-medium text-foreground">
                    Linked
                  </span>
                );
              }
              return <span className="text-xs text-muted-foreground">—</span>;
            },
          },
          {
            id: "status",
            header: "Status",
            sortValue: (row) => row.status,
            cell: (row) => (
              <span
                className={cn(
                  "inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium capitalize",
                  "bg-slate-100 text-slate-700",
                )}
              >
                {statusLabel(row.status)}
              </span>
            ),
          },
          {
            id: "updated",
            header: "Updated",
            sortValue: (row) => row.updatedAt || "",
            cell: (row) =>
              row.updatedAt ? formatDate(row.updatedAt) : "—",
          },
          {
            id: "open",
            header: "",
            cell: (row) => (
              <Link
                href={`/pro/dashboard/new-estimate/${row.id}`}
                className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
              >
                Open <ArrowRight className="size-3" />
              </Link>
            ),
          },
        ]}
      />
    </PortalPage>
  );
}
