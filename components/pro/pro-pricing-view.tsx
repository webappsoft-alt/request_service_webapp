"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Bot, CalendarClock, FileText, Smartphone, Users } from "lucide-react";
import { Container, Section } from "@/components/layout/container";
import { JsonLd } from "@/components/seo/json-ld";
import { FaqList } from "@/components/shared/faq-list";
import {
  BillingToggle,
  PlanCard,
  PlanCardSkeleton,
  PlansLoadNotice,
  useProPlans,
} from "@/components/subscription/pro-plan-cards";
import { Button } from "@/components/ui/button";
import type { ProPlanBillingCycle, ProSubscriptionPlan } from "@/lib/constants/subscription-plans";
import { faqJsonLd } from "@/lib/json-ld";
import { proDashboard, proPaths } from "@/lib/pro-paths";
import type { FaqItem } from "@/lib/types";
import { selectAuth, selectAuthUser, selectIsAuthenticated } from "@/store/authSlice";
import { useAppSelector } from "@/store/hooks";

const highlights = [
  {
    icon: Bot,
    title: "24/7 AI Voice Receptionist",
    body: "Answers every call, captures the job details, and drafts the estimate for you to review.",
  },
  {
    icon: Users,
    title: "Crew & technician logins",
    body: "Give each tech their own login with only the jobs they're assigned.",
  },
  {
    icon: CalendarClock,
    title: "Scheduling & dispatch",
    body: "Book visits, assign crews, and keep the whole team on one calendar.",
  },
  {
    icon: FileText,
    title: "Estimates that close",
    body: "Templates with labor and materials, e-signatures, and one-click conversion to jobs.",
  },
  {
    icon: Smartphone,
    title: "Pro mobile app",
    body: "Run the office from the truck: leads, jobs, and photos on your phone.",
  },
];

const pricingFaqs: FaqItem[] = [
  {
    id: "pricing-ai-phone-line",
    question: "How does the AI phone line work?",
    answer:
      "You get a dedicated AI number. When a customer calls, the AI receptionist answers in your company's name, asks about the job, collects their name, number, and address, and saves a draft estimate in your portal. If the caller asks for a person, or the job is outside your services, the call is transferred to the number you choose.",
  },
  {
    id: "pricing-existing-number",
    question: "Can I keep my existing business number?",
    answer:
      "Yes. Keep the number your customers already know and set your phone carrier to forward calls to your AI number, for example after hours or when the line is busy.",
  },
  {
    id: "pricing-minutes-run-out",
    question: "What happens when my AI minutes run out?",
    answer:
      "Minutes reset at the start of each billing period. If you regularly need more, upgrade to a plan with a larger allowance at any time from your dashboard.",
  },
  {
    id: "pricing-change-plan",
    question: "Can I change or cancel my plan later?",
    answer:
      "Yes. There are no long-term contracts. Upgrade, downgrade, or cancel from Subscription in your Pro dashboard.",
  },
  {
    id: "pricing-annual",
    question: "How does annual billing work?",
    answer:
      "Annual billing charges the full year up front at a lower monthly rate. The saving for each plan is shown when you switch the toggle to Annual.",
  },
  {
    id: "pricing-commission",
    question: "Do you take a commission on jobs?",
    answer: "No. You keep 100% of what you earn on the work you win. Plans are a flat subscription.",
  },
  {
    id: "pricing-customer-billing",
    question: "Is this separate from how I bill my customers?",
    answer:
      "Yes. Your membership plan is what you pay us. Invoices and payments for your own customers stay under Money in your dashboard.",
  },
];

function useIsProvider() {
  const auth = useAppSelector(selectAuth);
  const user = useAppSelector(selectAuthUser);
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  return Boolean(
    auth.hydrated && isAuthenticated && (user?.role === "provider" || auth.role === "provider"),
  );
}

function planCta(plan: ProSubscriptionPlan, isProvider: boolean) {
  if (isProvider) {
    return { href: proDashboard("/subscription"), label: plan.ctaLabel };
  }
  const query = plan.slug ? `?plan=${encodeURIComponent(plan.slug)}` : "";
  return {
    href: `${proPaths.register}${query}`,
    label: plan.monthlyPrice === 0 ? "Start for free" : `Start with ${plan.name}`,
  };
}

/** The 4 plan cards with the right CTA for guests vs. signed-in Pros. */
function PlanGrid({ cycle, plansState }: { cycle: ProPlanBillingCycle; plansState: ReturnType<typeof useProPlans> }) {
  const { plans, state, retry } = plansState;
  const isProvider = useIsProvider();
  return (
    <>
      <div className="grid grid-cols-1 gap-6 pt-3 md:grid-cols-2 xl:grid-cols-4">
        {state === "loading"
          ? Array.from({ length: 4 }, (_, i) => <PlanCardSkeleton key={i} />)
          : plans.map((plan) => {
              const cta = planCta(plan, isProvider);
              return (
                <PlanCard
                  key={plan.id}
                  plan={plan}
                  cycle={cycle}
                  titleAs="h3"
                  cta={
                    <Button
                      asChild
                      size="lg"
                      variant={plan.highlighted ? "default" : "outline"}
                      className="w-full rounded-xl"
                    >
                      <Link href={cta.href}>{cta.label}</Link>
                    </Button>
                  }
                />
              );
            })}
      </div>
      <PlansLoadNotice state={state} count={plans.length} onRetry={retry} />
    </>
  );
}

/** Plans section on the Pro landing page (/pro#plans). */
export function ProLandingPlans() {
  const [cycle, setCycle] = useState<ProPlanBillingCycle>("monthly");
  const plansState = useProPlans();
  return (
    <Section id="plans" density="tight">
      <Container className="flex flex-col gap-8">
        <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div className="flex max-w-2xl flex-col gap-3">
            <p className="eyebrow text-primary">Subscription</p>
            <h2 className="text-3xl font-semibold tracking-tight md:text-[2.5rem]">
              Straightforward plans for every crew size
            </h2>
            <p className="max-w-xl text-sm leading-7 text-muted-foreground">
              Start free, then add the AI Voice Receptionist, crew logins, and the mobile app as
              you grow. Cancel anytime.
            </p>
          </div>
          <BillingToggle value={cycle} onChange={setCycle} savings={plansState.maxSavings} className="w-fit" />
        </div>
        <PlanGrid cycle={cycle} plansState={plansState} />
        <Link
          href={proPaths.pricing}
          className="inline-flex items-center gap-1.5 self-center text-sm font-medium text-primary hover:underline"
        >
          Compare plans and read the pricing FAQ
          <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
      </Container>
    </Section>
  );
}

export function ProPricingView() {
  const [cycle, setCycle] = useState<ProPlanBillingCycle>("monthly");
  const plansState = useProPlans();

  return (
    <>
      <JsonLd data={faqJsonLd(pricingFaqs)} />

      <Section density="tight" className="pb-0">
        <Container className="flex flex-col items-center gap-5 text-center">
          <p className="eyebrow text-primary">Pricing for Pros</p>
          <h1 className="max-w-3xl text-3xl font-semibold tracking-tight text-balance md:text-5xl">
            Transparent, Flexible Plans Built for Trade Professionals
          </h1>
          <p className="max-w-2xl text-sm leading-7 text-muted-foreground md:text-base">
            Run your business, dispatch crews, automate phone intake 24/7 with our AI Voice
            Receptionist, and win more local jobs.
          </p>
          <BillingToggle
            value={cycle}
            onChange={setCycle}
            savings={plansState.maxSavings}
            className="mt-2"
          />
        </Container>
      </Section>

      <Section id="plans" density="tight">
        <Container className="flex flex-col gap-8">
          <h2 className="sr-only">Plans</h2>
          <PlanGrid cycle={cycle} plansState={plansState} />
          <p className="text-center text-xs text-muted-foreground">
            Prices in USD. No commission on the work you win. Cancel anytime.
          </p>
        </Container>
      </Section>

      <Section density="tight" tone="muted">
        <Container className="flex flex-col gap-8">
          <div className="flex max-w-2xl flex-col gap-3">
            <p className="eyebrow text-primary">Built for the trades</p>
            <h2 className="text-3xl font-semibold tracking-tight md:text-[2.5rem]">
              One system from the first call to the paid invoice
            </h2>
          </div>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {highlights.map((item) => (
              <li key={item.title} className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5">
                <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <item.icon className="size-5" aria-hidden="true" />
                </span>
                <p className="text-sm font-semibold text-foreground">{item.title}</p>
                <p className="text-sm leading-6 text-muted-foreground">{item.body}</p>
              </li>
            ))}
          </ul>
        </Container>
      </Section>

      <Section id="faq" density="tight">
        <Container className="grid items-start gap-12 lg:grid-cols-[minmax(0,21rem)_minmax(0,1fr)] lg:gap-20">
          <div className="flex flex-col gap-5 lg:sticky lg:top-28">
            <p className="eyebrow text-primary">FAQ</p>
            <h2 className="text-3xl font-semibold tracking-tight md:text-[2.5rem]">
              Pricing questions from contractors
            </h2>
            <p className="max-w-sm text-sm leading-7 text-muted-foreground">
              The AI phone line, minutes, billing, and changing plans.
            </p>
            <Button asChild variant="outline" className="w-fit gap-1.5">
              <Link href="/contact">
                Talk to our team
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </Button>
          </div>
          <FaqList items={pricingFaqs} variant="cards" />
        </Container>
      </Section>
    </>
  );
}
