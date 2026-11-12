"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowRight, Check, Crown, Gift, Loader2, RefreshCcw, TrendingUp, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { PremiumBadge } from "@/components/shared/premium-badge";
import { DeleteConfirmDialog } from "@/components/portal/delete-confirm-dialog";
import { formatDate, formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  cancelProviderPremium,
  fetchProviderPremium,
  resumeProviderPremium,
  subscribeProviderPremium,
} from "@/store/providerPremiumSlice";
import { fetchProviderWallet } from "@/store/providerWalletSlice";

/** Premium status for the signed-in Pro; `load` fetches the latest when the screen mounts. */
export function useProviderPremium(load = false) {
  const dispatch = useAppDispatch();
  const state = useAppSelector((root) => root.providerPremium);
  useEffect(() => {
    if (load) void dispatch(fetchProviderPremium({ force: true }));
  }, [dispatch, load]);
  return state;
}

function SummaryRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={cn("flex items-center justify-between gap-3 py-1.5 text-sm", strong && "font-semibold")}>
      <span className={strong ? "text-foreground" : "text-muted-foreground"}>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}

const BENEFITS = [
  "Shown at the top of customer searches in your city and state",
  "Premium badge on your card and public profile",
  "Paid from your wallet — cancel anytime",
];

/**
 * Premium Business Profile on the Business Profile page: price, upgrade (paid from the wallet),
 * cancel / resume auto-renew, and recent Premium payments. Every rule is checked by the API.
 */
export function PremiumProfileCard({ className }: { className?: string }) {
  const dispatch = useAppDispatch();
  const { data, loading, loaded, error, acting } = useProviderPremium(true);
  const [dialog, setDialog] = useState<"subscribe" | "cancel" | "resume" | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  function open(kind: "subscribe" | "cancel" | "resume") {
    setActionError(null);
    setReason("");
    setDialog(kind);
  }

  async function run(kind: "subscribe" | "cancel" | "resume") {
    if (!data) return;
    setActionError(null);
    const result =
      kind === "subscribe"
        ? await dispatch(subscribeProviderPremium({ expectedPrice: data.settings.monthlyPrice }))
        : kind === "cancel"
          ? await dispatch(cancelProviderPremium({ reason }))
          : await dispatch(resumeProviderPremium());
    // The wallet balance changed (or may have) — show the new one in the wallet card too.
    void dispatch(fetchProviderWallet({ force: true }));
    if (result.meta.requestStatus === "fulfilled") {
      setDialog(null);
      toast.success(
        kind === "subscribe"
          ? "Your business profile is now Premium."
          : kind === "cancel"
            ? "Premium cancelled. It stays active until the end of this period."
            : "Premium auto-renew is back on.",
      );
      return;
    }
    // Price or balance may have changed — show the latest next to the error.
    setActionError(typeof result.payload === "string" ? result.payload : "Something went wrong. Please try again.");
    void dispatch(fetchProviderPremium({ force: true }));
  }

  const settings = data?.settings;
  const sub = data?.subscription;
  const price = settings?.monthlyPrice ?? 0;
  const days = settings?.durationDays ?? 30;
  const balanceAfter = (data?.walletBalance ?? 0) - price;
  const renewsOn = data?.expiresAt ? formatDate(data.expiresAt) : "—";
  const isGrant = Boolean(data?.isPremium && sub?.source === "admin_grant");
  const lastEndedForBalance = !data?.isPremium && sub?.status === "expired" && sub.endReason === "insufficient_balance";

  return (
    <Card
      id="premium"
      className={cn("scroll-mt-20 overflow-hidden rounded-md border-border-soft", data?.isPremium && "border-amber-300/70", className)}
    >
      <CardHeader
        className={cn(
          "flex flex-row items-center justify-between gap-3 border-b border-border-soft",
          data?.isPremium && "bg-linear-to-r from-amber-50 to-transparent dark:from-amber-500/10",
        )}
      >
        <CardTitle className="flex items-center gap-2">
          <Crown className="size-4 fill-amber-400 text-amber-500" aria-hidden />
          Premium Business Profile
        </CardTitle>
        {data?.isPremium ? (
          <PremiumBadge
            size="xs"
            label={data.subscription?.source === "admin_grant" ? "Complimentary" : data.autoRenew ? "Active" : "Ending"}
          />
        ) : loaded ? (
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600 dark:bg-muted dark:text-muted-foreground">
            Standard
          </span>
        ) : null}
      </CardHeader>

      <CardContent className="pt-4">
        {!loaded && loading ? (
          <div className="flex flex-col gap-3">
            <Skeleton className="h-8 w-36" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-9 w-40" />
          </div>
        ) : !data ? (
          <div className="flex flex-col items-start gap-2">
            <p className="text-sm text-muted-foreground">{error || "Premium status isn't available right now."}</p>
            <Button size="sm" variant="outline" onClick={() => void dispatch(fetchProviderPremium({ force: true }))}>
              <RefreshCcw data-icon="inline-start" />
              Try again
            </Button>
          </div>
        ) : data.isPremium ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-foreground">
              Your profile shows first in customer searches for your city and state, with the Premium badge.
            </p>
            <div className="rounded-md border border-border-soft px-3 py-1">
              <SummaryRow label="Active until" value={renewsOn} />
              <SummaryRow
                label="Auto-renew"
                value={data.autoRenew ? `On · ${formatMoney(sub?.price ?? price)} from your wallet` : "Off"}
              />
              {sub ? <SummaryRow label="Paid so far" value={formatMoney(sub.totalPaid)} /> : null}
            </div>
            {isGrant ? (
              <p className="flex items-start gap-2 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">
                <Gift className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                Complimentary Premium from Request Service until {renewsOn}. Nothing is charged to your wallet; you can
                upgrade to keep it after that date.
              </p>
            ) : data.autoRenew ? (
              <p className="text-xs text-muted-foreground">
                Renews on {renewsOn} at the current price ({formatMoney(price)} / {days} days) if your wallet covers it.
              </p>
            ) : (
              <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">
                Cancelled — Premium ends on {renewsOn}. Resume to keep it renewing.
              </p>
            )}
            <div className={cn("flex flex-wrap gap-2", isGrant && "hidden")}>
              {data.autoRenew ? (
                <Button size="sm" variant="outline" onClick={() => open("cancel")} disabled={Boolean(acting)}>
                  Cancel Premium
                </Button>
              ) : (
                <Button size="sm" onClick={() => open("resume")} disabled={Boolean(acting) || !settings?.isEnabled}>
                  Resume auto-renew
                </Button>
              )}
            </div>
          </div>
        ) : !settings?.isEnabled ? (
          <p className="text-sm text-muted-foreground">Premium Business Profiles aren&apos;t offered right now. Check back soon.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {/* Client: a selling line for Pros who don't have Premium yet. */}
            <div className="rounded-md bg-linear-to-br from-amber-50 via-amber-50/60 to-transparent p-3 ring-1 ring-amber-200/70 dark:from-amber-500/10 dark:ring-amber-500/20">
              <p className="flex items-center gap-1.5 text-sm font-semibold text-amber-900 dark:text-amber-200">
                <TrendingUp className="size-4" aria-hidden />
                Be the first business customers see
              </p>
              <p className="mt-1 text-xs leading-5 text-amber-900/80 dark:text-amber-100/80">
                Premium businesses appear at the very top of local search results — above every standard listing in your
                city and state — with a gold Premium badge that builds trust at first glance.
              </p>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-3xl font-semibold tracking-tight tabular-nums">{formatMoney(price)}</span>
              <span className="text-sm text-muted-foreground">/ {days} days</span>
            </div>
            <ul className="flex flex-col gap-1.5 text-sm">
              {BENEFITS.map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <Check className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-hidden />
                  {item}
                </li>
              ))}
            </ul>
            <div className="flex items-center justify-between gap-3 rounded-md bg-muted/60 px-3 py-2 text-sm">
              <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                <Wallet className="size-3.5" aria-hidden />
                Wallet balance
              </span>
              <span className={cn("font-semibold tabular-nums", data.walletBalance < 0 && "text-red-600")}>
                {formatMoney(data.walletBalance)}
              </span>
            </div>
            {lastEndedForBalance ? (
              <p className="text-xs text-muted-foreground">
                Your last Premium ended on {formatDate(sub?.currentPeriodEnd)} — the wallet didn&apos;t cover the renewal.
              </p>
            ) : null}
            {!data.canAfford ? (
              <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">
                Your wallet needs {formatMoney(price)} to upgrade. It grows as you collect invoice payments.
              </p>
            ) : null}
            <Button
              className="self-start"
              size="sm"
              onClick={() => open("subscribe")}
              disabled={!data.canAfford || Boolean(acting)}
            >
              <Crown data-icon="inline-start" />
              Upgrade to Premium
            </Button>
          </div>
        )}

        {data?.charges.length ? (
          <div className="mt-4 border-t border-border-soft pt-3">
            <p className="text-[11px] font-semibold tracking-[0.08em] text-slate-400 uppercase">Premium payments</p>
            <ul className="mt-1 divide-y divide-border-soft">
              {data.charges.slice(0, 5).map((charge) => (
                <li key={charge.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <span className="min-w-0">
                    <span className="block truncate font-medium">
                      {charge.kind === "renewal" ? "Renewal" : charge.kind === "grant" ? "Given free" : "Upgrade"} · {charge.number}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatDate(charge.createdAt)} · {charge.durationDays} days to {formatDate(charge.periodEnd)}
                    </span>
                  </span>
                  <span className="shrink-0 font-medium tabular-nums">
                    {charge.kind === "grant" ? "Free" : formatMoney(charge.amount)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </CardContent>

      {/* Upgrade: what is paid and from where, before anything is charged. */}
      <Dialog open={dialog === "subscribe"} onOpenChange={(value) => !acting && setDialog(value ? "subscribe" : null)}>
        <DialogContent className="max-w-md" data-lenis-prevent>
          <DialogHeader className="border-b-0 bg-transparent">
            <DialogTitle className="flex items-center gap-2 text-base font-semibold">
              <Crown className="size-4 fill-amber-400 text-amber-500" aria-hidden />
              Upgrade to Premium?
            </DialogTitle>
            <DialogDescription>
              {formatMoney(price)} is paid from your wallet now. Premium renews every {days} days at the current price;
              cancel anytime and keep it until the period ends.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-md border border-border-soft px-3 py-1">
            <SummaryRow label={`Premium · ${days} days`} value={formatMoney(price)} />
            <SummaryRow label="Wallet balance now" value={formatMoney(data?.walletBalance ?? 0)} />
            <SummaryRow label="Wallet balance after" value={formatMoney(balanceAfter)} strong />
          </div>
          {actionError ? <p className="text-sm text-red-600">{actionError}</p> : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)} disabled={acting === "subscribe"}>
              Not now
            </Button>
            <Button onClick={() => void run("subscribe")} disabled={acting === "subscribe" || !data?.canAfford}>
              {acting === "subscribe" ? <Loader2 className="animate-spin" data-icon="inline-start" /> : null}
              {acting === "subscribe" ? "Upgrading…" : `Pay ${formatMoney(price)} & upgrade`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel: auto-renew off, Premium kept to the end of the paid period. */}
      <Dialog open={dialog === "cancel"} onOpenChange={(value) => !acting && setDialog(value ? "cancel" : null)}>
        <DialogContent className="max-w-md" data-lenis-prevent>
          <DialogHeader className="border-b-0 bg-transparent">
            <DialogTitle className="text-base font-semibold">Cancel Premium?</DialogTitle>
            <DialogDescription>
              Auto-renew turns off. Your Premium badge and top placement stay until {renewsOn}; after that your profile
              goes back to the standard order.
            </DialogDescription>
          </DialogHeader>
          {/* Client wording (exact). */}
          <div
            role="alert"
            className="flex items-start gap-2.5 rounded-md border border-amber-300 bg-amber-50 px-3 py-2.5 text-sm text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100"
          >
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" aria-hidden />
            <p>
              No refund will be issued, and you will retain your Premium features until the end of your current billing
              period.
            </p>
          </div>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-muted-foreground">Reason (optional)</span>
            <Textarea value={reason} onChange={(event) => setReason(event.target.value)} maxLength={500} rows={3} />
          </label>
          {actionError ? <p className="text-sm text-red-600">{actionError}</p> : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)} disabled={acting === "cancel"}>
              Keep Premium
            </Button>
            <Button variant="destructive" onClick={() => void run("cancel")} disabled={acting === "cancel"}>
              {acting === "cancel" ? <Loader2 className="animate-spin" data-icon="inline-start" /> : null}
              {acting === "cancel" ? "Cancelling…" : "Cancel Premium"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DeleteConfirmDialog
        open={dialog === "resume"}
        onOpenChange={(value) => setDialog(value ? "resume" : null)}
        tone="primary"
        title="Turn auto-renew back on?"
        description={`Premium renews on ${renewsOn} for ${formatMoney(price)} from your wallet.${actionError ? ` ${actionError}` : ""}`}
        confirmLabel="Resume auto-renew"
        loadingLabel="Saving…"
        loading={acting === "resume"}
        onConfirm={() => run("resume")}
      />
    </Card>
  );
}

const PREMIUM_HREF = "/pro/dashboard/settings#premium";

/**
 * Pro dashboard shortcut (client): Premium Pros see their status; everyone else sees what Premium
 * gets them and a one-click way to the upgrade. Hidden while loading or when Premium isn't offered.
 */
export function PremiumDashboardShortcut({ className }: { className?: string }) {
  const { data } = useProviderPremium(true);
  if (!data) return null;

  if (data.isPremium) {
    const isGrant = data.subscription?.source === "admin_grant";
    return (
      <div
        className={cn(
          "flex flex-col gap-3 rounded-lg border border-border-soft border-l-[3px] border-l-amber-400 bg-card px-4 py-3 sm:flex-row sm:items-center sm:justify-between",
          className,
        )}
      >
        <div className="flex items-center gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-amber-50 text-amber-500 ring-1 ring-amber-200 dark:bg-amber-500/10 dark:ring-amber-500/30">
            <Crown className="size-4 fill-current" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-foreground">
              Your business is Premium
              <PremiumBadge size="xs" label={isGrant ? "Complimentary" : "Active"} />
            </p>
            <p className="text-xs text-muted-foreground">
              You&apos;re shown first in customer searches for your city and state ·{" "}
              {isGrant || !data.autoRenew ? "ends" : "renews"} {formatDate(data.expiresAt)}
            </p>
          </div>
        </div>
        <Button asChild size="sm" variant="outline" className="self-start sm:self-auto">
          <Link href={PREMIUM_HREF}>
            Manage Premium
            <ArrowRight data-icon="inline-end" />
          </Link>
        </Button>
      </div>
    );
  }

  if (!data.settings.isEnabled) return null;

  // Client: compact, light shortcut (the earlier dark banner was too big / too heavy).
  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-lg border border-border-soft border-l-[3px] border-l-amber-400 bg-card px-4 py-3 sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-amber-50 text-amber-500 ring-1 ring-amber-200 dark:bg-amber-500/10 dark:ring-amber-500/30">
          <Crown className="size-4 fill-current" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-semibold text-foreground">
            Be the first Pro customers see in your area
            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800 ring-1 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/30">
              {formatMoney(data.settings.monthlyPrice)} / {data.settings.durationDays} days
            </span>
          </p>
          <p className="truncate text-xs text-muted-foreground">
            Premium puts your business at the top of local searches with a gold badge customers trust.
          </p>
        </div>
      </div>
      <Button
        asChild
        size="sm"
        variant="outline"
        className="premium-cta shrink-0 self-start border-amber-300 text-amber-900 hover:bg-amber-50 sm:self-auto dark:text-amber-200 dark:hover:bg-amber-500/10"
      >
        <Link href={PREMIUM_HREF}>
          {/* Animated: shine + crown wiggle (globals.css .premium-cta). */}
          <Crown data-icon="inline-start" className="premium-cta-crown fill-amber-400 text-amber-500" />
          Upgrade to Premium
        </Link>
      </Button>
    </div>
  );
}
