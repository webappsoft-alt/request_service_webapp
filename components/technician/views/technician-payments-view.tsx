"use client";

import { useEffect, useMemo, useState } from "react";
import { PortalPage } from "@/components/portal/portal-page";
import { TechChatButton } from "@/components/tech-chat/tech-chat-button";
import { DetailCard } from "@/components/technician/tech-ui";
import { useTechSectionSeen } from "@/components/technician/use-tech-section-seen";
import { PaymentHistoryTable } from "@/components/time-tracking/timesheet-ui";
import { formatMoney } from "@/lib/format";
import { technicianPaths } from "@/lib/technician-paths";
import { formatExactDuration } from "@/lib/time-tracking";
import { cn } from "@/lib/utils";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { fetchLedger, selectLedger } from "@/store/timeTrackingSlice";

const PAGE_SIZE = 10;

/** Technician's own pay: earned from tracked time, paid by the office, and still owed. */
export function TechnicianPaymentsView() {
  const dispatch = useAppDispatch();
  const ledger = useAppSelector((state) => selectLedger(state, "tech"));
  const timeVersion = useAppSelector((state) => state.timeTracking.version);
  const paymentVersion = useAppSelector((state) => state.timeTracking.paymentVersion);
  const { summary, payments, paymentsPagination } = ledger.data;
  const [page, setPage] = useState(1);
  const query = useMemo(() => ({ technician: true, paymentsPage: page, paymentsLimit: PAGE_SIZE }), [page]);

  useTechSectionSeen("payments");

  // Fresh numbers on every visit and after any clock-out or payout; cached ones stay visible meanwhile.
  useEffect(() => {
    void dispatch(fetchLedger({ scopeKey: "tech", query, force: true }));
  }, [dispatch, query, timeVersion, paymentVersion]);

  const hrefFor = (kind: "job" | "estimate", id: string) =>
    kind === "job" ? technicianPaths.job(id) : technicianPaths.estimate(id);

  const tiles = [
    { label: "Total earned", value: formatMoney(summary.earned), hint: `${formatExactDuration(summary.totalSeconds)} · ${summary.sessions} sessions` },
    { label: "Paid to you", value: formatMoney(summary.paid), hint: `${paymentsPagination.total} payment${paymentsPagination.total === 1 ? "" : "s"}`, tone: "text-emerald-700" },
    {
      label: "Remaining",
      value: formatMoney(summary.remaining),
      hint: summary.remaining > 0 ? "Still owed by the office" : "All caught up",
      tone: summary.remaining > 0 ? "text-amber-700" : "text-muted-foreground",
    },
  ];

  return (
    <PortalPage
      eyebrow="Technician / Payments"
      title="My payments"
      description="Pay is earned from your completed clock-in sessions (hours × your pay rate). Payments from the office are listed below."
      actions={<TechChatButton side="technician" contextType="payment" label="Ask about pay" />}
    >
      {ledger.error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{ledger.error}</p>
      ) : null}
      <div className="grid gap-2 sm:grid-cols-3">
        {tiles.map((tile) => (
          <div key={tile.label} className="rounded-lg border border-input bg-card px-4 py-3">
            <p className="text-[10px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">{tile.label}</p>
            <p className={cn("mt-0.5 text-2xl font-semibold tabular-nums", tile.tone)}>{tile.value}</p>
            <p className="text-xs text-muted-foreground">{tile.hint}</p>
          </div>
        ))}
      </div>

      <DetailCard title={`Payment history (${paymentsPagination.total})`}>
        <PaymentHistoryTable
          payments={payments}
          hrefFor={hrefFor}
          loading={ledger.loading}
          pagination={{
            page: paymentsPagination.page,
            pageSize: PAGE_SIZE,
            total: paymentsPagination.total,
            totalPages: paymentsPagination.totalPages,
            onPageChange: setPage,
          }}
          empty={ledger.loading && !ledger.loaded ? "Loading payments…" : "No payments from the office yet."}
        />
      </DetailCard>
    </PortalPage>
  );
}
