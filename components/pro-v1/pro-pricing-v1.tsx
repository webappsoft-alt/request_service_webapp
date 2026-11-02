"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, HardHat, Hash, Minus, PhoneCall, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Container, Section } from "@/components/layout/container";
import { Skeleton } from "@/components/ui/skeleton";
import { BillingToggle, PlansLoadNotice, useProPlans } from "@/components/subscription/pro-plan-cards";
import {
  proPlanAnnualSavingsPercent,
  proPlanMonthlyRate,
  splitUsd,
  type ProPlanBillingCycle,
  type ProSubscriptionPlan,
} from "@/lib/constants/subscription-plans";
import { proDashboard, proPaths } from "@/lib/pro-paths";
import { selectAuth, selectAuthUser, selectIsAuthenticated } from "@/store/authSlice";
import { useAppSelector } from "@/store/hooks";
import { cn } from "@/lib/utils";

function useIsProvider() {
  const auth = useAppSelector(selectAuth);
  const user = useAppSelector(selectAuthUser);
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  return Boolean(auth.hydrated && isAuthenticated && (user?.role === "provider" || auth.role === "provider"));
}

/** Same CTA rules as the live plans section. */
function planCta(plan: ProSubscriptionPlan, isProvider: boolean) {
  if (isProvider) return { href: proDashboard("/subscription"), label: plan.ctaLabel };
  const query = plan.slug ? `?plan=${encodeURIComponent(plan.slug)}` : "";
  return { href: `${proPaths.register}${query}`, label: plan.monthlyPrice === 0 ? "Start for free" : `Start with ${plan.name}` };
}

/** AI minutes, the AI number, crew logins, and the subcontractor portal for one plan. */
function planLimits(plan: ProSubscriptionPlan) {
  const ai = plan.callingMinutes > 0;
  return [
    { icon: PhoneCall, label: "AI voice minutes", value: ai ? `${plan.callingMinutes.toLocaleString("en-US")} / mo` : "—", on: ai },
    { icon: Hash, label: "AI business number", value: ai ? "Included" : "—", on: ai },
    {
      icon: Users,
      label: "Crew logins",
      value: plan.crewSeats < 0 ? "Unlimited" : plan.crewSeats > 0 ? `Up to ${plan.crewSeats}` : "Owner only",
      on: plan.crewSeats !== 0,
    },
    { icon: HardHat, label: "Subcontractor portal", value: plan.subcontractorPortal ? "Included" : "—", on: plan.subcontractorPortal },
  ];
}

function PlanColumn({ plan, cycle, isProvider }: { plan: ProSubscriptionPlan; cycle: ProPlanBillingCycle; isProvider: boolean }) {
  const [dollars, cents] = splitUsd(proPlanMonthlyRate(plan, cycle));
  const savings = proPlanAnnualSavingsPercent(plan);
  const cta = planCta(plan, isProvider);

  return (
    <div className={cn("relative flex min-w-0 flex-col p-6 lg:p-7", plan.highlighted && "bg-primary/[0.04]")}>
      {plan.highlighted ? <span aria-hidden="true" className="absolute inset-x-0 top-0 h-1 bg-primary" /> : null}
      <div className="flex items-center gap-2">
        <h3 className="text-lg font-semibold tracking-tight">{plan.name}</h3>
        {plan.badge ? (
          <span className="rounded-full bg-primary px-2 py-0.5 text-[11px] font-semibold text-primary-foreground">{plan.badge}</span>
        ) : null}
      </div>
      <p className="mt-1.5 text-sm leading-6 text-muted-foreground lg:min-h-[3lh]">{plan.description}</p>

      <p className="mt-5 flex items-baseline gap-0.5 whitespace-nowrap">
        <span className="sr-only">{`$${dollars}.${cents} per month`}</span>
        <span aria-hidden="true" className="text-4xl font-semibold tracking-tight tabular-nums">
          ${dollars}
        </span>
        <span aria-hidden="true" className="text-base font-semibold tabular-nums">
          .{cents}
        </span>
        <span aria-hidden="true" className="ml-1 text-sm text-muted-foreground">
          /mo
        </span>
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        {plan.monthlyPrice === 0
          ? "Free forever"
          : cycle === "annual"
            ? `$${plan.annualTotal.toLocaleString("en-US", { minimumFractionDigits: 2 })} billed yearly${savings ? ` · save ${savings}%` : ""}`
            : "Billed monthly"}
      </p>

      <Button asChild size="lg" variant={plan.highlighted ? "default" : "outline"} className="mt-5 w-full">
        <Link href={cta.href}>{cta.label}</Link>
      </Button>

      {/* At a glance: the limits that separate the plans, from the plan's own settings */}
      <dl className="mt-6 grid gap-2.5 rounded-xl border border-border bg-muted/40 p-3.5 text-sm">
        {planLimits(plan).map((row) => {
          const Icon = row.icon;
          return (
            <div key={row.label} className="flex items-center justify-between gap-3">
              <dt className="flex items-center gap-2 text-muted-foreground">
                <Icon className="size-4 shrink-0" aria-hidden="true" />
                {row.label}
              </dt>
              <dd className={cn("text-right font-semibold tabular-nums", !row.on && "font-normal text-muted-foreground")}>{row.value}</dd>
            </div>
          );
        })}
      </dl>

      <ul className="mt-4 flex flex-col gap-3 border-t border-border pt-5 text-sm">
        {plan.features.map((feature) => (
          <li key={feature.label} className="flex items-start gap-2.5">
            {feature.included ? (
              <Check className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" strokeWidth={2.5} aria-hidden="true" />
            ) : (
              <Minus className="mt-0.5 size-4 shrink-0 text-muted-foreground/50" aria-hidden="true" />
            )}
            <span className={feature.included ? "text-foreground/90" : "text-muted-foreground"}>
              <span className="sr-only">{feature.included ? "Included: " : "Not included: "}</span>
              {feature.label}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Plans as one open comparison panel: a column per plan (price, CTA, AI minutes, its own
 * checklist) split by hairlines, the popular plan tinted. Phones get a plan switcher and one
 * column at a time. Prices and features come from the live plans API.
 */
export function ProPricingV1() {
  const [cycle, setCycle] = useState<ProPlanBillingCycle>("monthly");
  const plansState = useProPlans();
  const { plans, state, retry, maxSavings } = plansState;
  const isProvider = useIsProvider();
  const popularIndex = Math.max(0, plans.findIndex((plan) => plan.highlighted));
  const [picked, setPicked] = useState<number | null>(null);
  const mobileIndex = Math.min(picked ?? popularIndex, Math.max(plans.length - 1, 0));

  return (
    <Section id="plans" className="scroll-mt-24 bg-background">
      <Container className="flex flex-col gap-10">
        <div className="mx-auto flex max-w-2xl flex-col items-center gap-4 text-center">
          <p className="eyebrow text-primary">Pricing</p>
          <h2 className="text-balance text-3xl font-semibold tracking-tight md:text-[2.75rem] md:leading-[1.1]">
            Straightforward plans. No commission.
          </h2>
          <p className="max-w-lg text-sm leading-7 text-muted-foreground md:text-base">
            Start free, then add the AI Voice Receptionist, crew logins, and the mobile app as you grow. Cancel anytime.
          </p>
          <BillingToggle value={cycle} onChange={setCycle} savings={maxSavings} className="mt-2" />
        </div>

        {state === "loading" ? (
          <div className="grid overflow-hidden rounded-[1.75rem] border border-border bg-background lg:grid-cols-4">
            {Array.from({ length: 4 }, (_, index) => (
              <div key={index} className={cn("flex flex-col gap-4 p-7", index > 0 && "hidden lg:flex")}>
                <Skeleton className="h-6 w-24" />
                <Skeleton className="h-10 w-32" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-32 w-full" />
              </div>
            ))}
          </div>
        ) : plans.length ? (
          <>
            {/* Phones / tablets: one plan at a time */}
            <div className="flex flex-col gap-4 lg:hidden">
              <div role="tablist" aria-label="Plans" className="flex gap-1 overflow-x-auto rounded-full border border-border bg-background p-1 [scrollbar-width:none]">
                {plans.map((plan, index) => (
                  <button
                    key={plan.id}
                    type="button"
                    role="tab"
                    aria-selected={index === mobileIndex}
                    onClick={() => setPicked(index)}
                    className={cn(
                      "flex-1 shrink-0 rounded-full px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors",
                      index === mobileIndex ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {plan.name}
                  </button>
                ))}
              </div>
              <div className="overflow-hidden rounded-[1.75rem] border border-border bg-background">
                <PlanColumn plan={plans[mobileIndex]} cycle={cycle} isProvider={isProvider} />
              </div>
            </div>

            {/* Desktop: all plans side by side */}
            <div
              className="hidden overflow-hidden rounded-[1.75rem] border border-border bg-background lg:grid lg:divide-x lg:divide-border"
              style={{ gridTemplateColumns: `repeat(${plans.length}, minmax(0, 1fr))` }}
            >
              {plans.map((plan) => (
                <PlanColumn key={plan.id} plan={plan} cycle={cycle} isProvider={isProvider} />
              ))}
            </div>
          </>
        ) : null}

        <PlansLoadNotice state={state} count={plans.length} onRetry={retry} />

        <Link
          href={proPaths.pricing}
          className="inline-flex items-center gap-1.5 self-center text-sm font-medium text-primary underline-offset-4 hover:underline"
        >
          Compare plans and read the pricing FAQ
          <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
      </Container>
    </Section>
  );
}
