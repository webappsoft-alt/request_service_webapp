"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { HoursEditor } from "@/components/portal/hours-editor";
import { PortalPage } from "@/components/portal/portal-page";
import { StatusPill } from "@/components/portal/status-pill";
import { usePortalSettings } from "@/components/portal/use-portal-settings";
import { usePortalWorkspace } from "@/components/portal/use-portal-workspace";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { cloneWorkingHours } from "@/lib/data/portal";
import { getActivePlans, formatPlanPrice } from "@/lib/data/plans";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

export function BillingView() {
  const { subscription } = usePortalWorkspace();
  const plans = getActivePlans();
  const current = plans.find((plan) => plan.id === subscription.planId) ?? plans[0];

  return (
    <PortalPage
      eyebrow="Plan"
      title="Subscription & billing"
      description="Portal access follows subscription status. Plans are the same records shown on the public pricing page."
    >
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Current plan</CardTitle>
          <StatusPill label={subscription.status} tone="success" />
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm">
          <p className="text-2xl font-semibold">{current.name}</p>
          <p>
            {formatPlanPrice(current)} / {current.interval}
          </p>
          <p className="text-muted-foreground">
            Current period {formatDate(subscription.currentPeriodStart)} – {formatDate(subscription.currentPeriodEnd)}
          </p>
          <p className="text-muted-foreground">Payment method · Visa ending 4242</p>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        {plans.map((plan) => (
          <div
            key={plan.id}
            className={cn(
              "flex flex-col gap-3 rounded-xl border border-input bg-card p-5",
              plan.id === current.id && "border-primary",
            )}
          >
            <p className="font-semibold">{plan.name}</p>
            <p className="text-2xl font-semibold">{formatPlanPrice(plan)}</p>
            <ul className="flex flex-col gap-1.5 text-sm text-muted-foreground">
              {plan.features.slice(0, 4).map((feature) => (
                <li key={feature}>{feature}</li>
              ))}
            </ul>
            <Button
              variant={plan.id === current.id ? "outline" : "default"}
              onClick={() =>
                toast.success(
                  plan.id === current.id
                    ? "You are already on this plan."
                    : `${plan.name} selected. Billing would update after checkout.`,
                )
              }
            >
              {plan.id === current.id ? "Current plan" : plan.price > current.price ? "Upgrade" : "Downgrade"}
            </Button>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => toast.success("Cancellation is scheduled for the period end in this demo.")}>
          Cancel at period end
        </Button>
      </div>
    </PortalPage>
  );
}

export function SettingsView() {
  const { session, provider } = usePortalWorkspace();
  const { officeHours, saveOfficeHours } = usePortalSettings();
  const [hours, setHours] = useState(() => cloneWorkingHours(officeHours));
  const hoursSynced = useRef(false);

  useEffect(() => {
    if (hoursSynced.current) return;
    hoursSynced.current = true;
    setHours(cloneWorkingHours(officeHours));
  }, [officeHours]);

  return (
    <PortalPage
      eyebrow="Account"
      title="Settings"
      description="Login, notifications, and the company office hours used by fixed services."
    >
      <form
        className="max-w-xl rounded-xl border border-input bg-card p-5"
        onSubmit={(event) => {
          event.preventDefault();
          toast.success("Settings saved on this demo account.");
        }}
      >
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="owner">Owner name</FieldLabel>
            <Input id="owner" defaultValue={provider.contact?.name} />
          </Field>
          <Field>
            <FieldLabel htmlFor="login-email">Login email</FieldLabel>
            <Input id="login-email" type="email" defaultValue={session?.email ?? provider.email} />
          </Field>
          <Field>
            <FieldLabel htmlFor="notify">Request alerts</FieldLabel>
            <Input id="notify" defaultValue="Email me when a new request matches my trades" readOnly />
          </Field>
          <Button type="submit">Save settings</Button>
        </FieldGroup>
      </form>

      <section id="office-hours" className="max-w-xl scroll-mt-6 rounded-xl border border-input bg-card p-5">
        <p className="text-sm font-semibold">Company office hours</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Fixed services that use office hours follow this schedule for {provider.companyName}.
        </p>
        <div className="mt-4">
          <HoursEditor hours={hours} onChange={setHours} />
        </div>
        <Button
          type="button"
          className="mt-4"
          onClick={() => {
            saveOfficeHours(hours);
            toast.success("Office hours saved. Fixed services using office time will show these hours.");
          }}
        >
          Save office hours
        </Button>
      </section>
    </PortalPage>
  );
}
