"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Check, Lock, PhoneCall, PhoneOff, RefreshCw, Sparkles } from "lucide-react";
import { getData } from "@/components/api/apiFuntions";
import { publicApi } from "@/components/api/ApiRoutesFile";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  mapApiSubscriptionPlan,
  proPlanAnnualSavingsPercent,
  proPlanMonthlyRate,
  splitUsd,
  type ApiSubscriptionPlan,
  type ProPlanBillingCycle,
  type ProSubscriptionPlan,
} from "@/lib/constants/subscription-plans";
import { cn } from "@/lib/utils";

/**
 * Pro membership plan UI shared by the public pricing page (/for-pros/pricing) and the
 * dashboard subscription page. Plans come from the admin-managed public endpoint.
 */

const cycles: { id: ProPlanBillingCycle; label: string }[] = [
  { id: "monthly", label: "Monthly" },
  { id: "annual", label: "Annual" },
];

export function BillingToggle({
  value,
  onChange,
  savings,
  className,
}: {
  value: ProPlanBillingCycle;
  onChange: (next: ProPlanBillingCycle) => void;
  savings: number;
  className?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Billing cycle"
      className={cn("inline-flex items-center gap-1 rounded-full border border-border bg-muted/60 p-1", className)}
    >
      {cycles.map((cycle) => {
        const active = value === cycle.id;
        return (
          <button
            key={cycle.id}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(cycle.id)}
            className={cn(
              "inline-flex h-8 items-center gap-1.5 rounded-full px-4 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              active
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {cycle.label}
            {cycle.id === "annual" && savings > 0 ? (
              <span className="rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[10px] whitespace-nowrap font-semibold text-emerald-700 dark:text-emerald-400">
                Save up to {savings}%
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

export function PlanCard({
  plan,
  cycle,
  isCurrent = false,
  titleAs: Title = "h2",
  cta,
}: {
  plan: ProSubscriptionPlan;
  cycle: ProPlanBillingCycle;
  isCurrent?: boolean;
  titleAs?: "h2" | "h3";
  /** The plan's call-to-action button (differs between the public page and the dashboard). */
  cta: ReactNode;
}) {
  const [dollars, cents] = splitUsd(proPlanMonthlyRate(plan, cycle));
  const savings = proPlanAnnualSavingsPercent(plan);
  const hasVoice = plan.callingMinutes > 0;

  return (
    <article
      className={cn(
        "relative flex flex-col rounded-2xl border bg-card p-6 shadow-xs transition-shadow hover:shadow-md",
        plan.highlighted
          ? "border-primary shadow-lg ring-1 ring-primary/30"
          : "border-border",
      )}
    >
      {plan.badge ? (
        <span className="absolute -top-3 left-1/2 inline-flex -translate-x-1/2 items-center gap-1 rounded-full bg-primary px-3 py-1 text-xs font-semibold whitespace-nowrap text-primary-foreground shadow-sm">
          <Sparkles className="size-3" aria-hidden="true" />
          {plan.badge}
        </span>
      ) : null}

      {isCurrent ? (
        <span className="absolute -top-3 left-6 rounded-full bg-muted px-3 py-1 text-xs font-semibold whitespace-nowrap text-muted-foreground ring-1 ring-border">
          Your plan
        </span>
      ) : null}

      <Title className="text-lg font-semibold tracking-tight text-foreground">{plan.name}</Title>
      <p className="text-xs font-medium tracking-wide text-primary/80 uppercase dark:text-primary">
        {plan.tagline}
      </p>
      <p className="mt-1.5 md:min-h-[2lh] lg:min-h-[3lh] text-sm leading-relaxed text-muted-foreground">
        {plan.description}
      </p>

      <div className="mt-5 flex items-start whitespace-nowrap text-foreground">
        <span className="sr-only">{`$${dollars}.${cents} per month`}</span>
        <span className="mt-1.5 text-lg font-bold" aria-hidden="true">$</span>
        <span className="text-4xl font-extrabold tracking-tight tabular-nums" aria-hidden="true">{dollars}</span>
        <span className="mt-1.5 ml-0.5 text-base font-bold tabular-nums" aria-hidden="true">.{cents}</span>
        <span className="mt-auto mb-1 ml-1 text-sm font-medium text-muted-foreground" aria-hidden="true">/mo</span>
      </div>
      <p className="mt-1 h-4 text-xs text-muted-foreground">
        {plan.monthlyPrice === 0
          ? "Free forever"
          : cycle === "annual"
            ? `$${plan.annualTotal.toLocaleString("en-US", { minimumFractionDigits: 2 })} billed yearly${savings ? ` · save ${savings}%` : ""}`
            : "Billed monthly"}
      </p>

      <div
        className={cn(
          "mt-5 flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-sm font-medium",
          hasVoice
            ? "border-primary/25 bg-primary/5 text-primary"
            : "border-dashed border-border bg-muted/40 text-muted-foreground",
        )}
      >
        {hasVoice ? (
          <PhoneCall className="size-4 shrink-0" aria-hidden="true" />
        ) : (
          <PhoneOff className="size-4 shrink-0" aria-hidden="true" />
        )}
        {hasVoice ? `${plan.callingMinutes} AI Voice mins/mo` : "AI Voice not included"}
      </div>

      <ul className="mt-5 flex flex-1 flex-col gap-3 text-sm">
        {plan.features.map((feature) => (
          <li key={feature.label} className="flex items-start gap-2.5">
            {feature.included ? (
              <span className="mt-0.5 flex size-4.5 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                <Check className="size-3" strokeWidth={3} aria-hidden="true" />
              </span>
            ) : (
              <span className="mt-0.5 flex size-4.5 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground/70">
                <Lock className="size-2.5" strokeWidth={2.5} aria-hidden="true" />
              </span>
            )}
            <span className={feature.included ? "text-foreground/90" : "text-muted-foreground line-through decoration-muted-foreground/40"}>
              <span className="sr-only">{feature.included ? "Included: " : "Not included: "}</span>
              {feature.label}
            </span>
          </li>
        ))}
      </ul>

      <div className="mt-6">{cta}</div>
    </article>
  );
}

export function PlanCardSkeleton() {
  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-6" aria-hidden="true">
      <Skeleton className="h-5 w-24" />
      <Skeleton className="h-3 w-32" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-9 w-28" />
      <Skeleton className="h-11 w-full rounded-xl" />
      {Array.from({ length: 6 }, (_, i) => (
        <Skeleton key={i} className="h-4 w-full" />
      ))}
      <Skeleton className="mt-4 h-10 w-full rounded-xl" />
    </div>
  );
}

export type PlansLoadState = "loading" | "ready" | "error";

async function fetchActivePlans(force = false): Promise<ProSubscriptionPlan[]> {
  const res = await getData<ApiSubscriptionPlan[] | { data?: ApiSubscriptionPlan[] }>(
    publicApi.subscriptionPlans,
    undefined,
    { silent: true, force },
  );
  const rows = Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : [];
  return rows
    .filter((row) => row.isActive !== false)
    .map(mapApiSubscriptionPlan)
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

/** Active plans from the admin-managed endpoint, with load state and a retry. */
export function useProPlans() {
  const [plans, setPlans] = useState<ProSubscriptionPlan[]>([]);
  const [state, setState] = useState<PlansLoadState>("loading");
  // Bumped by retry() to re-run the fetch effect.
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetchActivePlans(attempt > 0).then(
      (next) => {
        if (cancelled) return;
        setPlans(next);
        setState("ready");
      },
      () => {
        if (!cancelled) setState("error");
      },
    );
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const retry = () => {
    setState("loading");
    setAttempt((n) => n + 1);
  };
  const maxSavings = Math.max(0, ...plans.map(proPlanAnnualSavingsPercent));
  return { plans, state, retry, maxSavings };
}

/** Error / empty message under the plan grid; renders nothing while plans are fine. */
export function PlansLoadNotice({
  state,
  count,
  onRetry,
}: {
  state: PlansLoadState;
  count: number;
  onRetry: () => void;
}) {
  if (state === "loading" || (state === "ready" && count > 0)) return null;
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border bg-card px-6 py-10 text-center">
      <p className="text-sm font-semibold text-foreground">
        {state === "error" ? "Could not load membership plans" : "No membership plans available yet"}
      </p>
      <p className="max-w-sm text-sm text-muted-foreground">
        {state === "error"
          ? "Check your connection and try again."
          : "Plans appear here as soon as they are published."}
      </p>
      {state === "error" ? (
        <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={onRetry}>
          <RefreshCw className="size-3.5" aria-hidden="true" />
          Try again
        </Button>
      ) : null}
    </div>
  );
}
