"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DeleteConfirmDialog } from "@/components/portal/delete-confirm-dialog";
import { moneyTone } from "@/components/portal/status-pill";
import { invoiceStatusLabel, invoiceStatusTone, paymentNumber } from "@/lib/data/portal";
import { formatMoney } from "@/lib/format";
import type { Invoice, Payment } from "@/lib/types";
import { useAppDispatch } from "@/store/hooks";
import { fetchInvoices } from "@/store/invoicesSlice";
import { fetchPayments, reviewPaymentThunk } from "@/store/paymentsSlice";
import { fetchProviderWallet } from "@/store/providerWalletSlice";

/**
 * Customer-entered payments wait for the Pro's confirmation (client rule). Until then an invoice
 * the customer "paid" shows "Awaiting confirmation", not "Paid".
 */
export function invoiceDisplayStatus(invoice: Pick<Invoice, "status" | "awaitingConfirmation">) {
  if ((invoice.awaitingConfirmation ?? 0) > 0) {
    return {
      label: "Awaiting confirmation",
      tone: "warning" as const,
      pillClass: "bg-amber-50 text-amber-800",
    };
  }
  return {
    label: invoiceStatusLabel(invoice.status),
    tone: moneyTone(invoice.status),
    pillClass: invoiceStatusTone(invoice.status),
  };
}

/** Pending (unconfirmed) customer-entered payments among these. */
export function pendingCustomerPayments(payments: Payment[]) {
  return payments.filter((payment) => payment.confirmationStatus === "pending");
}

/**
 * Amber card with Confirm received / Not received for each pending payment. Both ask first.
 * Used on the payment page and the invoice page.
 */
export function PaymentReviewCard({
  payments,
  onReviewed,
  className = "",
}: {
  payments: Payment[];
  /** Page-specific refresh after a decision (e.g. reload the invoice / payment detail). */
  onReviewed?: () => void;
  className?: string;
}) {
  const dispatch = useAppDispatch();
  const [ask, setAsk] = useState<{ payment: Payment; decision: "confirm" | "reject" } | null>(null);
  const [busy, setBusy] = useState(false);
  const pending = pendingCustomerPayments(payments);
  if (!pending.length) return null;

  async function review(payment: Payment, decision: "confirm" | "reject") {
    setBusy(true);
    try {
      await dispatch(reviewPaymentThunk({ id: payment.id, decision })).unwrap();
      void dispatch(fetchPayments({ force: true, silent: true }));
      void dispatch(fetchInvoices({ force: true, silent: true }));
      void dispatch(fetchProviderWallet({ force: true }));
      onReviewed?.();
      toast.success(
        decision === "confirm"
          ? `${paymentNumber(payment)} confirmed — added to your wallet balance.`
          : `${paymentNumber(payment)} marked not received and taken off the invoice.`,
      );
      setAsk(null);
    } catch (error) {
      toast.error(typeof error === "string" ? error : "Could not update this payment.");
    } finally {
      setBusy(false);
    }
  }

  const single = pending.length === 1;

  return (
    <>
      <div
        className={`rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100 ${className}`}
      >
        <p>
          <span className="font-semibold">Awaiting your confirmation.</span>{" "}
          {single
            ? "The customer entered this payment. It isn't in your wallet balance until you confirm you received it."
            : `The customer entered ${pending.length} payments. They aren't in your wallet balance until you confirm you received them.`}
        </p>
        <ul className="mt-2 flex flex-col gap-2">
          {pending.map((payment) => (
            <li key={payment.id} className="flex flex-wrap items-center gap-3">
              <span className="min-w-0 flex-1 font-medium tabular-nums">
                {paymentNumber(payment)} · {formatMoney(payment.amount)}
                {payment.recordedByName ? ` · entered by ${payment.recordedByName}` : ""}
              </span>
              <Button size="sm" className="h-8" disabled={busy} onClick={() => setAsk({ payment, decision: "confirm" })}>
                Confirm received
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-8 bg-white/80"
                disabled={busy}
                onClick={() => setAsk({ payment, decision: "reject" })}
              >
                Not received
              </Button>
            </li>
          ))}
        </ul>
      </div>
      <DeleteConfirmDialog
        open={ask !== null}
        onOpenChange={(next) => {
          if (!next && !busy) setAsk(null);
        }}
        tone={ask?.decision === "confirm" ? "primary" : "danger"}
        title={ask?.decision === "confirm" ? "Confirm payment received?" : "Payment not received?"}
        description={
          !ask
            ? ""
            : ask.decision === "confirm"
              ? `Confirm you received ${formatMoney(ask.payment.amount)} for ${paymentNumber(ask.payment)}? It will be added to your wallet balance. This can't be undone.`
              : `${paymentNumber(ask.payment)} was entered by the customer. Marking it not received takes it off the invoice, so the balance is due again. It never counted in your wallet.`
        }
        confirmLabel={ask?.decision === "confirm" ? "Confirm received" : "Not received"}
        loadingLabel="Updating…"
        loading={busy}
        onConfirm={() => {
          if (ask) void review(ask.payment, ask.decision);
        }}
      />
    </>
  );
}
