"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Lock, Wallet } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { fetchProviderWallet } from "@/store/providerWalletSlice";

/** Latest wallet figures; refreshes when a screen that shows money mounts (or `enabled` turns on). */
export function useProviderWallet(enabled = true) {
  const dispatch = useAppDispatch();
  const wallet = useAppSelector((state) => state.providerWallet);
  useEffect(() => {
    if (enabled) void dispatch(fetchProviderWallet({ force: true }));
  }, [dispatch, enabled]);
  return wallet;
}

/** Message for a payout above the wallet balance (same wording as the API). */
export function insufficientBalanceText(balance: number) {
  return `Insufficient balance to complete this payout. Wallet balance: ${formatMoney(balance)}.`;
}

function Row({ label, value, negative }: { label: string; value: number; negative?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5 text-sm">
      <span className="text-slate-600 dark:text-muted-foreground">{label}</span>
      <span className={cn("font-medium tabular-nums", negative && value > 0 ? "text-slate-700" : "text-slate-900 dark:text-foreground")}>
        {negative && value > 0 ? `− ${formatMoney(value)}` : formatMoney(value)}
      </span>
    </div>
  );
}

/**
 * Current wallet balance — read-only. Calculated by the server from collected customer
 * payments minus technician / contractor payouts (and expenses); there is nothing to edit.
 */
export function WalletBalanceCard({ className }: { className?: string }) {
  const { data, loading, loaded, error } = useProviderWallet();

  return (
    <Card className={cn("rounded-md border-border-soft", className)}>
      <CardHeader className="flex flex-row items-center justify-between gap-3 border-b border-border-soft">
        <CardTitle className="flex items-center gap-2">
          <Wallet className="size-4 text-primary" aria-hidden />
          Current wallet balance
        </CardTitle>
        <span
          className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600 dark:bg-muted dark:text-muted-foreground"
          title="Calculated automatically — it can't be edited"
        >
          <Lock className="size-3" aria-hidden />
          Read-only
        </span>
      </CardHeader>
      <CardContent className="pt-4">
        {!loaded && loading ? (
          <div className="flex flex-col gap-3">
            <Skeleton className="h-9 w-40" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
          </div>
        ) : !data ? (
          <p className="text-sm text-slate-500">{error || "The wallet balance isn't available right now."}</p>
        ) : (
          <>
            <p
              className={cn(
                "text-3xl font-semibold tracking-tight tabular-nums",
                data.balance < 0 ? "text-red-600" : "text-slate-900 dark:text-foreground",
              )}
              aria-live="polite"
            >
              {formatMoney(data.balance)}
            </p>
            <p className="mt-1 text-xs text-slate-400">Available to pay your team and contractors.</p>
            <div className="mt-4 border-t border-border-soft pt-2">
              <Row label="Collected from customers" value={data.collected} />
              <Row label="Paid to technicians" value={data.technicianPayouts} negative />
              <Row label="Paid to contractors" value={data.contractorPayouts} negative />
              <Row label="Expenses" value={data.expenses} negative />
            </div>
            {data.awaitingConfirmationCount > 0 ? (
              <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">
                {formatMoney(data.awaitingConfirmation)} from {data.awaitingConfirmationCount} customer-entered payment
                {data.awaitingConfirmationCount === 1 ? "" : "s"} awaiting your confirmation — not in the balance yet.{" "}
                <Link href="/pro/dashboard/payments" className="font-semibold underline underline-offset-2">
                  Review payments
                </Link>
              </p>
            ) : null}
            <p className="mt-3 text-xs text-slate-400">
              Calculated automatically from confirmed invoice payments and payouts. It can&apos;t be edited.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
