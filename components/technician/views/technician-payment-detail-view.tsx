"use client";

import { useEffect, useState } from "react";
import { TechChatButton } from "@/components/tech-chat/tech-chat-button";
import { PayoutDetailView } from "@/components/time-tracking/payout-detail";
import { CenteredSpinner } from "@/components/ui/spinner";
import { extractErrorMessage } from "@/components/api/extractErrorMessage";
import { getTechnicianPaymentDetail, type TechnicianPaymentDetail } from "@/lib/api/technician-client";
import { formatMoney } from "@/lib/format";
import { technicianPaths } from "@/lib/technician-paths";
import { useAppSelector } from "@/store/hooks";

const METHOD_LABEL: Record<string, string> = { cash: "Cash", check: "Check", card: "Card", ach: "Bank transfer (ACH)" };

/** Technician → My payments → one payout: what it paid for, the sessions and the balance. */
export function TechnicianPaymentDetailView({ id }: { id: string }) {
  const [detail, setDetail] = useState<TechnicianPaymentDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const me = useAppSelector((state) => state.technician.profile.data);

  useEffect(() => {
    let cancelled = false;
    getTechnicianPaymentDetail(id)
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

  const { payment } = detail;
  const kind = payment.job ? "Job" : payment.order ? "Order" : payment.estimate ? "Estimate" : "";
  const ref = payment.job ?? payment.order ?? payment.estimate;
  const href = payment.job
    ? technicianPaths.job(payment.job.id)
    : payment.order
      ? technicianPaths.order(payment.order.id)
      : payment.estimate
        ? technicianPaths.estimate(payment.estimate.id)
        : undefined;
  const profile = (me || {}) as { firstName?: string; lastName?: string; name?: string; hourlyRate?: number; payRate?: number };
  const payeeName = profile.name || [profile.firstName, profile.lastName].filter(Boolean).join(" ") || payment.employeeName || "You";
  const rate = detail.sessions.find((row) => row.payRate > 0)?.payRate || profile.hourlyRate || profile.payRate || 0;

  return (
    <PayoutDetailView
      backHref={technicianPaths.payments}
      backLabel="My payments"
      eyebrow="Technician / Payments"
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
      record={ref ? { kindLabel: kind, number: ref.number || kind, title: ref.title, href } : null}
      summary={detail.record ? { earned: detail.record.earned, paid: detail.record.paid, remaining: detail.record.remaining } : null}
      payRate={rate > 0 ? `${formatMoney(rate)} / hr` : undefined}
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
        href: technicianPaths.payment(row.id),
      }))}
      actions={<TechChatButton side="technician" contextType="payment" label="Ask about pay" />}
    />
  );
}
