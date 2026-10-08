"use client";

import { useEffect } from "react";
import Link from "next/link";
import { CircleDollarSign, Hourglass, Wallet } from "lucide-react";
import { useContractorSectionSeen } from "@/components/contractor/use-contractor-section-seen";
import { PortalDataTable } from "@/components/portal/portal-data-table";
import { PortalPage } from "@/components/portal/portal-page";
import { StatusPill } from "@/components/portal/status-pill";
import { CenteredSpinner } from "@/components/ui/spinner";
import type { ContractorPayRow } from "@/lib/api/contractor-portal-client";
import { contractorPaths } from "@/lib/contractor-paths";
import { formatDate, formatMoney } from "@/lib/format";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { fetchContractorPayouts } from "@/store/contractorPortalSlice";

const METHOD_LABEL: Record<string, string> = { ach: "Bank transfer", check: "Check", cash: "Cash", card: "Card" };

/** "Fixed $1,200" or "$75.00/hr × 6.5 h". */
export function payTermsLabel(row: Pick<ContractorPayRow, "payType" | "payRate" | "hours">) {
  if (row.payType === "fixed") return `Fixed ${formatMoney(row.payRate)}`;
  return `${formatMoney(row.payRate)}/hr × ${row.hours} h`;
}

export function PayStatePill({ row }: { row: ContractorPayRow }) {
  if (row.earned > 0 && row.balance <= 0) return <StatusPill tone="success" label="Paid" />;
  if (row.paid > 0) return <StatusPill tone="primary" label="Partly paid" />;
  if (row.approved) return <StatusPill tone="warning" label="Approved · unpaid" />;
  if (row.completion === "pending_pro_approval") return <StatusPill tone="warning" label="Awaiting approval" />;
  return <StatusPill label="In progress" />;
}

function Tile({ label, value, icon: Icon, tone }: { label: string; value: string; icon: typeof Wallet; tone: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-[var(--ct-border)] bg-white p-4">
      <span className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${tone}`}>
        <Icon className="size-5" aria-hidden />
      </span>
      <span className="min-w-0">
        <span className="block text-2xl font-semibold tabular-nums text-slate-900">{value}</span>
        <span className="block text-xs text-slate-500">{label}</span>
      </span>
    </div>
  );
}

/**
 * Earnings: per job Total earned / Paid / Remaining balance, and every payout
 * the office has recorded.
 */
export function ContractorPayoutsView() {
  const dispatch = useAppDispatch();
  const { data, loading, error } = useAppSelector((state) => state.contractorPortal.payouts);
  const version = useAppSelector((state) => state.contractorPortal.versions.payouts);
  const company = useAppSelector((state) => state.contractorPortal.profile.data?.provider?.name || "the office");

  useContractorSectionSeen("payouts");

  useEffect(() => {
    void dispatch(fetchContractorPayouts());
  }, [dispatch, version]);

  return (
    <PortalPage
      eyebrow="Contractor / Invoices & payouts"
      title="Invoices / Payouts"
      description={`What you've earned on each job with ${company}, what's been paid, and what's still owed.`}
    >
      {error ? <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p> : null}

      {!data && loading ? (
        <CenteredSpinner label="Loading earnings" />
      ) : data ? (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Tile
              label="Total earned"
              value={formatMoney(data.totals.earned)}
              icon={CircleDollarSign}
              tone="bg-[var(--ct-accent-soft)] text-[var(--ct-accent)]"
            />
            <Tile label="Paid to you" value={formatMoney(data.totals.paid)} icon={Wallet} tone="bg-emerald-50 text-emerald-700" />
            <Tile label="Remaining balance" value={formatMoney(data.totals.balance)} icon={Hourglass} tone="bg-amber-50 text-amber-700" />
          </div>

          <section className="flex flex-col gap-2">
            <h2 className="text-sm font-semibold text-slate-900">By job</h2>
            <PortalDataTable
              filename="earnings-by-job"
              countLabel="Jobs"
              searchPlaceholder="Search job #, title"
              empty="Nothing earned yet. Fixed-price jobs and logged hours show up here."
              rows={data.jobs}
              rowKey={(row) => row.jobId}
              rowHref={(row) => contractorPaths.job(row.jobId)}
              columns={[
                {
                  id: "job",
                  header: "Job",
                  sortValue: (row) => row.number,
                  searchValue: (row) => `${row.number} ${row.title}`,
                  exportValue: (row) => row.number,
                  cell: (row) => (
                    <div className="min-w-0">
                      <Link href={contractorPaths.job(row.jobId)} className="font-semibold text-primary hover:underline">
                        {row.number}
                      </Link>
                      {row.title ? <p className="truncate text-xs text-muted-foreground">{row.title}</p> : null}
                    </div>
                  ),
                },
                {
                  id: "terms",
                  header: "Pay terms",
                  exportValue: (row) => payTermsLabel(row),
                  cell: (row) => (
                    <div className="text-xs">
                      <p>{payTermsLabel(row)}</p>
                      {row.extras > 0 ? <p className="text-muted-foreground">+ {formatMoney(row.extras)} change orders</p> : null}
                    </div>
                  ),
                },
                {
                  id: "state",
                  header: "Status",
                  exportValue: (row) => (row.approved ? "Approved" : "Not approved"),
                  cell: (row) => <PayStatePill row={row} />,
                },
                {
                  id: "earned",
                  header: "Earned",
                  className: "text-right",
                  sortValue: (row) => row.earned,
                  exportValue: (row) => row.earned.toFixed(2),
                  cell: (row) => <span className="tabular-nums">{formatMoney(row.earned)}</span>,
                },
                {
                  id: "paid",
                  header: "Paid",
                  className: "text-right",
                  sortValue: (row) => row.paid,
                  exportValue: (row) => row.paid.toFixed(2),
                  cell: (row) => <span className="tabular-nums text-emerald-700">{formatMoney(row.paid)}</span>,
                },
                {
                  id: "balance",
                  header: "Balance",
                  className: "text-right",
                  sortValue: (row) => row.balance,
                  exportValue: (row) => row.balance.toFixed(2),
                  cell: (row) => <span className="font-semibold tabular-nums">{formatMoney(row.balance)}</span>,
                },
              ]}
              actions={(row) => [{ label: "Open job", href: contractorPaths.job(row.jobId) }]}
            />
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="text-sm font-semibold text-slate-900">Payment history</h2>
            <PortalDataTable
              filename="payment-history"
              countLabel="Payments"
              searchPlaceholder="Search payment #, job, reference"
              empty="No payments yet."
              rows={data.payments}
              rowKey={(row) => row.id}
              columns={[
                {
                  id: "date",
                  header: "Paid on",
                  sortValue: (row) => row.paidAt,
                  exportValue: (row) => formatDate(row.paidAt),
                  cell: (row) => formatDate(row.paidAt),
                },
                {
                  id: "number",
                  header: "Payment #",
                  sortValue: (row) => row.number,
                  searchValue: (row) => `${row.number} ${row.reference} ${row.job?.number || ""}`,
                  exportValue: (row) => row.number,
                  cell: (row) => <span className="font-medium">{row.number}</span>,
                },
                {
                  id: "job",
                  header: "Job",
                  exportValue: (row) => row.job?.number || "",
                  cell: (row) =>
                    row.job ? (
                      <Link href={contractorPaths.job(row.jobId)} className="text-primary hover:underline">
                        {row.job.number}
                      </Link>
                    ) : (
                      "—"
                    ),
                },
                {
                  id: "method",
                  header: "Method",
                  exportValue: (row) => METHOD_LABEL[row.method] || row.method,
                  cell: (row) => (
                    <div className="text-xs">
                      <p>{METHOD_LABEL[row.method] || row.method}</p>
                      {row.reference ? <p className="text-muted-foreground">Ref {row.reference}</p> : null}
                    </div>
                  ),
                },
                {
                  id: "amount",
                  header: "Amount",
                  className: "text-right",
                  sortValue: (row) => row.amount,
                  exportValue: (row) => row.amount.toFixed(2),
                  cell: (row) => <span className="font-semibold tabular-nums">{formatMoney(row.amount)}</span>,
                },
              ]}
            />
          </section>
        </>
      ) : null}
    </PortalPage>
  );
}
