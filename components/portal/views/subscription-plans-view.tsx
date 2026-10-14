"use client";

import { useState } from "react";
import { Headphones, PhoneCall, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { PortalPage } from "@/components/portal/portal-page";
import {
  BillingToggle,
  PlanCard,
  PlanCardSkeleton,
  PlansLoadNotice,
  useProPlans,
} from "@/components/subscription/pro-plan-cards";
import { Button } from "@/components/ui/button";
import {
  DEFAULT_PRO_PLAN_SLUG,
  type ProPlanBillingCycle,
} from "@/lib/constants/subscription-plans";

export function SubscriptionPlansView() {
  const [cycle, setCycle] = useState<ProPlanBillingCycle>("monthly");
  const { plans, state, retry, maxSavings } = useProPlans();

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
          : plans.map((plan) => {
              const isCurrent = plan.slug === DEFAULT_PRO_PLAN_SLUG;
              return (
                <PlanCard
                  key={plan.id}
                  plan={plan}
                  cycle={cycle}
                  isCurrent={isCurrent}
                  cta={
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
                      className="w-full rounded-xl"
                    >
                      {isCurrent ? "Current Tier" : plan.ctaLabel}
                    </Button>
                  }
                />
              );
            })}
      </div>

      <PlansLoadNotice state={state} count={plans.length} onRetry={retry} />

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
