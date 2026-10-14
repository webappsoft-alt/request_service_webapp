"use client";

import { useState } from "react";
import { Check, Headphones, Lock, PhoneCall, PhoneOff, ShieldCheck, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { PortalPage } from "@/components/portal/portal-page";
import { Button } from "@/components/ui/button";
import {
  DEFAULT_PRO_PLAN_ID,
  proPlanAnnualSavingsPercent,
  proPlanMonthlyRate,
  proSubscriptionPlans,
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
                Save {savings}%
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
  const rate = proPlanMonthlyRate(plan, cycle);
  const hasVoice = plan.callingMinutes > 0;
  const comingSoon = plan.status === "coming_soon";

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

      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold tracking-tight text-foreground">{plan.name}</h2>
          <p className="text-xs font-medium tracking-wide text-primary/80 uppercase dark:text-primary">{plan.tagline}</p>
        </div>
        {isCurrent ? (
          <span className="shrink-0 rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-semibold text-muted-foreground ring-1 ring-border">
            Your plan
          </span>
        ) : null}
      </div>
      <p className="mt-1.5 md:min-h-[2lh] text-sm leading-relaxed text-muted-foreground">
        {plan.description}
      </p>

      <div className="mt-5 flex items-baseline gap-1">
        <span className="text-4xl font-extrabold tracking-tight text-foreground">${rate}</span>
        <span className="text-sm font-medium text-muted-foreground">/mo</span>
      </div>
      <p className="mt-1 h-4 text-xs text-muted-foreground">
        {plan.monthlyPrice === 0
          ? "Free forever"
          : cycle === "annual"
            ? `$${plan.annualPrice.toLocaleString("en-US")} billed yearly`
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
        disabled={isCurrent || comingSoon}
        onClick={() =>
          toast.info(`${plan.name} upgrades open soon`, {
            description: "Online checkout for membership plans is being connected.",
          })
        }
        className="mt-6 w-full rounded-xl"
      >
        {isCurrent ? "Current Tier" : comingSoon ? "Coming soon" : plan.ctaLabel}
      </Button>
    </article>
  );
}

export function SubscriptionPlansView() {
  const [cycle, setCycle] = useState<ProPlanBillingCycle>("monthly");
  const plans = [...proSubscriptionPlans].sort((a, b) => a.sortOrder - b.sortOrder);
  const maxSavings = Math.max(0, ...plans.map(proPlanAnnualSavingsPercent));

  return (
    <PortalPage
      eyebrow="Membership"
      title="Subscription plans"
      description="Choose the membership that fits your business. Upgrade anytime to unlock lead matching, job tools, and the 24/7 AI Voice Receptionist."
      actions={<BillingToggle value={cycle} onChange={setCycle} savings={maxSavings} />}
    >
      <div className="grid grid-cols-1 gap-6 pt-3 md:grid-cols-2 lg:grid-cols-4">
        {plans.map((plan) => (
          <PlanCard
            key={plan.id}
            plan={plan}
            cycle={cycle}
            isCurrent={plan.id === DEFAULT_PRO_PLAN_ID}
          />
        ))}
      </div>

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
