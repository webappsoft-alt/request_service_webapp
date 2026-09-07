import Link from "next/link";
import { Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatPlanPrice } from "@/lib/data/plans";
import type { SubscriptionPlan } from "@/lib/types";

export function PricingCard({ plan }: { plan: SubscriptionPlan }) {
  const intervalLabel = plan.interval === "month" ? "month" : "year";

  return (
    <Card
      className={cn(
        "h-full transition-all duration-300 ease-out hover:-translate-y-1 hover:elevate",
        plan.highlighted ? "border-primary ring-1 ring-primary" : "hover:border-foreground/15"
      )}
    >
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-lg">{plan.name}</CardTitle>
          {plan.highlighted ? <Badge>Most popular</Badge> : null}
        </div>
        <CardDescription>{plan.description}</CardDescription>
        <div className="pt-3">
          <p className="flex items-end gap-1">
            <span className="text-4xl font-bold tracking-[-0.03em]">{formatPlanPrice(plan)}</span>
            <span className="pb-1 text-sm text-muted-foreground">/{intervalLabel}</span>
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Billed per {intervalLabel}. Cancel anytime.
          </p>
        </div>
      </CardHeader>
      <CardContent>
        <ul className="flex flex-col gap-2.5">
          {plan.features.map((feature) => (
            <li key={feature} className="flex items-start gap-2 text-sm leading-6">
              <Check className="mt-0.5 size-4 text-success" aria-hidden="true" />
              <span>{feature}</span>
            </li>
          ))}
        </ul>
      </CardContent>
      <CardFooter className="bg-transparent">
        <Button asChild className="w-full" variant={plan.highlighted ? "default" : "outline"}>
          <Link href={`/pro/register?plan=${plan.slug}`}>{plan.ctaLabel}</Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
