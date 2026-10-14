"use client";

import { useEffect, useState } from "react";
import {
  Check,
  Headphones,
  Lock,
  PhoneCall,
  PhoneOff,
  RefreshCw,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { getData } from "@/components/api/apiFuntions";
import { publicApi } from "@/components/api/ApiRoutesFile";
import { PortalPage } from "@/components/portal/portal-page";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DEFAULT_PRO_PLAN_SLUG,
  mapApiSubscriptionPlan,
  proPlanAnnualSavingsPercent,
  proPlanMonthlyRate,
  splitUsd,
  type ApiSubscriptionPlan,
  type ProPlanBillingCycle,
  type ProSubscriptionPlan,
} from "@/lib/constants/subscription-plans";
import { cn } from "@/lib/utils";

const cycles: { id: ProPlanBillingCycle; label: string }[] = [
  { id: "monthly", label: "Monthly" },
  { id: "annual", label: "Annual" },
];

function BillingToggle({
  value,
  onChange,
  savings,
}: {
  value: ProPlanBillingCycle;
  onChange: (next: ProPlanBillingCycle) => void;
  savings: number;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Billing cycle"
      className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/60 p-1"
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

function PlanCard({
  plan,
  cycle,
  isCurrent,
}: {
  plan: ProSubscriptionPlan;
  cycle: ProPlanBillingCycle;
  isCurrent: boolean;
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

      <h2 className="text-lg font-semibold tracking-tight text-foreground">{plan.name}</h2>
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
            ? `${plan.annualTotal.toLocaleString("en-US", { minimumFractionDigits: 2 })} billed yearly${savings ? ` · save ${savings}%` : ""}`
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

      <Button
        type="button"
        size="lg"
        variant={plan.highlighted ? "default" : "outline"}
        disabled={isCurrent}
        onClick={() =>
          toast.info(`${plan.name} upgrades open soon`, {
            description: "Online checkout for membership plans is being connected.",
          })
        }
        className="mt-6 w-full rounded-xl"
      >
        {isCurrent ? "Current Tier" : plan.ctaLabel}
      </Button>
    </article>
  );
}

function PlanCardSkeleton() {
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

type LoadState = "loading" | "ready" | "error";

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

export function SubscriptionPlansView() {
  const [cycle, setCycle] = useState<ProPlanBillingCycle>("monthly");
  const [plans, setPlans] = useState<ProSubscriptionPlan[]>([]);
  const [state, setState] = useState<LoadState>("loading");

  // Bumped by "Try again" to re-run the fetch effect.
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

  const maxSavings = Math.max(0, ...plans.map(proPlanAnnualSavingsPercent));

  return (
    <PortalPage
      eyebrow="Membership"
      title="Subscription plans"
      description="Choose the membership that fits your business. Upgrade anytime to unlock lead matching, job tools, and the 24/7 AI Voice Receptionist."
      actions={<BillingToggle value={cycle} onChange={setCycle} savings={maxSavings} />}
    >
      <div className="grid grid-cols-1 gap-6 pt-3 md:grid-cols-2 lg:grid-cols-4">
        {state === "loading"
          ? Array.from({ length: 4 }, (_, i) => <PlanCardSkeleton key={i} />)
          : plans.map((plan) => (
              <PlanCard
                key={plan.id}
                plan={plan}
                cycle={cycle}
                isCurrent={plan.slug === DEFAULT_PRO_PLAN_SLUG}
              />
            ))}
      </div>

      {state === "error" || (state === "ready" && plans.length === 0) ? (
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
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => {
                setState("loading");
                setAttempt((n) => n + 1);
              }}
            >
              <RefreshCw className="size-3.5" aria-hidden="true" />
              Try again
            </Button>
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-4 rounded-2xl border border-border bg-card p-5 text-sm sm:grid-cols-3">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
          <div>
            <p className="font-semibold text-foreground">No long-term contracts</p>
            <p className="mt-0.5 text-muted-foreground">Upgrade, downgrade, or cancel anytime.</p>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <PhoneCall className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
          <div>
            <p className="font-semibold text-foreground">Inbound minutes reset monthly</p>
            <p className="mt-0.5 text-muted-foreground">AI Voice minutes refresh each billing period.</p>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <Headphones className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
          <div>
            <p className="font-semibold text-foreground">Separate from customer billing</p>
            <p className="mt-0.5 text-muted-foreground">
              Your job invoices and payments stay under Money.
            </p>
          </div>
        </div>
      </div>
    </PortalPage>
  );
}
