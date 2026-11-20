"use client";

import { useEffect, useState } from "react";
import { PayoutDetailView } from "@/components/time-tracking/payout-detail";
import { CenteredSpinner } from "@/components/ui/spinner";
import { extractErrorMessage } from "@/components/api/extractErrorMessage";
import { getContractorPayoutDetail, type ContractorPayoutDetail } from "@/lib/api/contractor-portal-client";
import { contractorPaths } from "@/lib/contractor-paths";
import { formatMoney } from "@/lib/format";
import { useAppSelector } from "@/store/hooks";

const METHOD_LABEL: Record<string, string> = { cash: "Cash", check: "Check", card: "Card", ach: "Bank transfer (ACH)" };

/** Contractor → Payouts → one payment: the job / order it paid, balance, sessions and payouts on that work. */
export function ContractorPayoutDetailView({ id }: { id: string }) {
  const [detail, setDetail] = useState<ContractorPayoutDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const me = useAppSelector((state) => state.contractorPortal.profile.data);

  useEffect(() => {
    let cancelled = false;
    getContractorPayoutDetail(id)
      .then((data) => {
        if (!cancelled) setDetail(data);
      })
      .catch((err) => {
        if (!cancelled) setError(extractErrorMessage(err) || "Could not load this payment.");
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (error) {
    return <p className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>;
  }
  if (!detail) return <CenteredSpinner />;

  const { payment, record } = detail;
  const isOrder = Boolean(payment.order) || record?.kind === "order";
  const ref = payment.order ?? payment.job;
  const recordId = payment.order?.id || payment.orderId || payment.job?.id || payment.jobId;
  const payeeName =
    me?.companyName || [me?.firstName, me?.lastName].filter(Boolean).join(" ") || "You";
  const payRate = record
    ? record.payType === "fixed"
      ? `Fixed ${formatMoney(record.payRate)}${record.extras > 0 ? ` + ${formatMoney(record.extras)} extras` : ""}`
      : `${formatMoney(record.payRate)} / hr${record.extras > 0 ? ` + ${formatMoney(record.extras)} extras` : ""}`
    : undefined;

  return (
    <PayoutDetailView
      backHref={contractorPaths.payouts}
      backLabel="Payouts"
      eyebrow="Contractor / Payouts"
      payment={{
        id: payment.id,
        number: payment.number,
        amount: payment.amount,
        method: METHOD_LABEL[payment.method] || payment.method,
        paidAt: payment.paidAt,
        reference: payment.reference,
        notes: payment.notes,
      }}
      company={detail.company || { name: me?.provider?.name || "" }}
      payeeName={payeeName}
      record={
        ref || record
          ? {
              kindLabel: isOrder ? "Order" : "Job",
              number: ref?.number || record?.number || (isOrder ? "Order" : "Job"),
              title: ref?.title || record?.title,
              status: record?.status,
              href: recordId ? (isOrder ? contractorPaths.order(recordId) : contractorPaths.job(recordId)) : undefined,
            }
          : null
      }
      summary={record ? { earned: record.earned, paid: record.paid, remaining: record.remaining } : null}
      payRate={payRate}
      sessions={detail.sessions.map((row) => ({
        id: row.id,
        clockInAt: row.clockInAt,
        clockOutAt: row.clockOutAt,
        seconds: row.seconds,
        pay: row.pay,
      }))}
      payouts={detail.payments.map((row) => ({
        id: row.id,
        number: row.number,
        paidAt: row.paidAt,
        method: METHOD_LABEL[row.method] || row.method,
        amount: row.amount,
        href: contractorPaths.payout(row.id),
      }))}
    />
  );
}
