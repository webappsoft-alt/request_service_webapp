"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  Building2,
  CreditCard,
  MessageSquare,
  Receipt,
} from "lucide-react";
import { PortalPage } from "@/components/portal/portal-page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CenteredSpinner } from "@/components/ui/spinner";
import { StatusPill, moneyTone } from "@/components/portal/status-pill";
import { customerPaths } from "@/lib/customer-paths";
import { formatDate, formatMoney } from "@/lib/format";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { selectAuth, selectIsAuthenticated } from "@/store/authSlice";
import {
  clearCustomerPaymentDetail,
  fetchCustomerPaymentDetail,
  selectCustomerPaymentDetail,
  selectCustomerPaymentDetailError,
  selectCustomerPaymentDetailLoading,
} from "@/store/customerPaymentsSlice";

function paymentNumber(id: string) {
  return `PMT-${String(id || "").replace(/^pay_?/i, "")}`;
}

function statusLabel(status: string) {
  const clean = String(status || "").toLowerCase();
  if (clean === "sent") return "Pending";
  if (clean === "partially_paid") return "Partially Paid";
  return clean
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function methodLabel(method: string) {
  const clean = String(method || "").toLowerCase();
  if (clean === "ach") return "ACH";
  return clean.charAt(0).toUpperCase() + clean.slice(1);
}

export function CustomerPaymentDetailDashboardView({ id }: { id: string }) {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const auth = useAppSelector(selectAuth);
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  const payment = useAppSelector(selectCustomerPaymentDetail);
  const loading = useAppSelector(selectCustomerPaymentDetailLoading);
  const error = useAppSelector(selectCustomerPaymentDetailError);
  const paymentId = String(id || "").trim();

  useEffect(() => {
    if (!auth.hydrated) return;
    if (!isAuthenticated) {
      router.replace(
        `/login?next=${encodeURIComponent(customerPaths.payment(paymentId))}`,
      );
      return;
    }
    if (!paymentId) return;
    void dispatch(fetchCustomerPaymentDetail(paymentId));
    return () => {
      dispatch(clearCustomerPaymentDetail());
    };
  }, [auth.hydrated, dispatch, paymentId, isAuthenticated, router]);

  if (!auth.hydrated || (loading && !payment)) {
    return (
      <PortalPage
        eyebrow="Payments"
        title="Payment"
        description="Review a payment recorded against your invoice."
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href={customerPaths.payments}>
              <ArrowLeft className="size-3.5" />
              All payments
            </Link>
          </Button>
        }
      >
        <div className="flex min-h-[360px] items-center justify-center">
          <CenteredSpinner label="Loading payment…" />
        </div>
      </PortalPage>
    );
  }

  if (error || !payment) {
    return (
      <PortalPage
        eyebrow="Payments"
        title="Payment not found"
        description={error || "This payment is missing or no longer available."}
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href={customerPaths.payments}>
              <ArrowLeft className="size-3.5" />
              All payments
            </Link>
          </Button>
        }
      >
        <div className="rounded-xl border border-input bg-card p-8 text-center">
          <AlertCircle className="mx-auto size-8 text-muted-foreground/50" />
          <p className="mt-3 text-base font-medium text-foreground">
            Payment could not be located
          </p>
          <Button asChild className="mt-4" size="sm">
            <Link href={customerPaths.payments}>Return to all payments</Link>
          </Button>
        </div>
      </PortalPage>
    );
  }

  const companyName = payment.provider?.companyName || "Service Professional";

  return (
    <PortalPage
      eyebrow="Payments"
      title={paymentNumber(payment.id)}
      description={`Payment from ${companyName}`}
      badge={
        <div className="flex flex-wrap items-center gap-2">
          <StatusPill
            label={statusLabel(payment.status)}
            tone={moneyTone(payment.status)}
          />
          <Badge
            variant="outline"
            className="border-input bg-muted/30 text-xs text-muted-foreground"
          >
            {methodLabel(payment.method)}
          </Badge>
        </div>
      }
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href={customerPaths.payments}>
              <ArrowLeft className="size-3.5" />
              All payments
            </Link>
          </Button>
          {payment.invoiceId ? (
            <Button asChild variant="outline" size="sm">
              <Link href={customerPaths.invoice(payment.invoiceId)}>
                <Receipt className="size-3.5" />
                {payment.invoiceNumber || "Open invoice"}
              </Link>
            </Button>
          ) : null}
          <Button asChild size="sm">
            <Link href={customerPaths.messages}>
              <MessageSquare className="size-3.5" />
              Message pro
            </Link>
          </Button>
        </div>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-input bg-card px-5 py-5 shadow-xs">
          <p className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
            Amount
          </p>
          <p className="mt-3 text-[1.75rem] leading-none font-semibold tabular-nums text-foreground">
            {formatMoney(payment.amount)}
          </p>
          <p className="mt-2 text-xs text-muted-foreground">Recorded payment</p>
        </div>
        <div className="rounded-xl border border-input bg-card px-5 py-5 shadow-xs">
          <p className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
            Status
          </p>
          <div className="mt-3">
            <StatusPill
              label={statusLabel(payment.status)}
              tone={moneyTone(payment.status)}
            />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">Settlement state</p>
        </div>
        <div className="rounded-xl border border-input bg-card px-5 py-5 shadow-xs">
          <p className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
            Method
          </p>
          <p className="mt-3 text-lg font-semibold text-foreground">
            {methodLabel(payment.method)}
          </p>
          <p className="mt-2 text-xs text-muted-foreground">How it was paid</p>
        </div>
        <div className="rounded-xl border border-input bg-card px-5 py-5 shadow-xs">
          <p className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
            Paid on
          </p>
          <p className="mt-3 text-lg font-semibold text-foreground">
            {payment.paidAt
              ? formatDate(payment.paidAt.slice(0, 10))
              : "—"}
          </p>
          <p className="mt-2 text-xs text-muted-foreground">Payment date</p>
        </div>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <section className="rounded-xl border border-input bg-card p-5 shadow-xs sm:p-6">
          <div className="flex items-center gap-2 border-b border-input pb-3">
            <CreditCard className="size-4 text-primary" />
            <h2 className="text-base font-semibold text-foreground">
              Payment details
            </h2>
          </div>
          <dl className="mt-4 space-y-3 text-sm">
            <div className="flex items-center justify-between border-b border-input pb-2.5">
              <dt className="text-muted-foreground">Payment #</dt>
              <dd className="font-mono font-medium">{paymentNumber(payment.id)}</dd>
            </div>
            <div className="flex items-center justify-between border-b border-input pb-2.5">
              <dt className="text-muted-foreground">Invoice</dt>
              <dd>
                {payment.invoiceId ? (
                  <Link
                    href={customerPaths.invoice(payment.invoiceId)}
                    className="font-medium text-primary hover:underline"
                  >
                    {payment.invoiceNumber || "View invoice"}
                  </Link>
                ) : (
                  "—"
                )}
              </dd>
            </div>
            {payment.invoiceStatus ? (
              <div className="flex items-center justify-between border-b border-input pb-2.5">
                <dt className="text-muted-foreground">Invoice status</dt>
                <dd>
                  <StatusPill
                    label={statusLabel(payment.invoiceStatus)}
                    tone={moneyTone(payment.invoiceStatus)}
                  />
                </dd>
              </div>
            ) : null}
            {payment.transactionReference ? (
              <div className="flex items-center justify-between border-b border-input pb-2.5">
                <dt className="text-muted-foreground">Reference</dt>
                <dd className="font-mono text-xs">{payment.transactionReference}</dd>
              </div>
            ) : null}
            {payment.notes ? (
              <div>
                <dt className="text-muted-foreground">Notes</dt>
                <dd className="mt-1 whitespace-pre-wrap text-foreground">
                  {payment.notes}
                </dd>
              </div>
            ) : null}
          </dl>
        </section>

        <aside className="rounded-xl border border-input bg-card p-5 shadow-xs">
          <div className="flex items-center gap-2 border-b border-input pb-3">
            <Building2 className="size-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">
              Service professional
            </h2>
          </div>
          <p className="mt-4 font-semibold text-foreground">{companyName}</p>
          <Button asChild className="mt-4 w-full" size="sm">
            <Link href={customerPaths.messages}>
              <MessageSquare className="size-3.5" />
              Chat with professional
            </Link>
          </Button>
        </aside>
      </div>
    </PortalPage>
  );
}
