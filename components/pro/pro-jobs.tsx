import Link from "next/link";
import { ArrowRight, MapPin, Radio } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Container, Section } from "@/components/layout/container";
import { proPaths } from "@/lib/pro-paths";

const stats = [
  { value: "0%", label: "Commission taken from the work you win" },
  { value: "24/7", label: "Job requests arrive while your crew is on a roof" },
  { value: "20+", label: "Colorado cities matched by trade and ZIP" },
] as const;

const feed = [
  { trade: "Plumbing", job: "Water heater replacement", city: "Aurora, CO 80014", budget: "$1,500 – $2,200", age: "22m ago" },
  { trade: "HVAC", job: "AC condenser not cooling", city: "Littleton, CO 80120", budget: "$600 – $1,100", age: "48m ago" },
  { trade: "Electrical", job: "Panel upgrade to 200A", city: "Denver, CO 80210", budget: "$2,400 – $3,600", age: "1h ago" },
  { trade: "Roofing", job: "Hail damage inspection", city: "Lakewood, CO 80226", budget: "Estimate requested", age: "2h ago" },
];

export function ProJobs() {
  return (
    <Section id="jobs" density="tight" className="scroll-mt-24">
      <Container className="grid items-center gap-10 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] lg:gap-16">
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-3">
            <p className="eyebrow text-primary">Get the work</p>
            <h2 className="text-3xl font-semibold tracking-tight md:text-[2.5rem]">
              Homeowners are already looking for your trade.
            </h2>
            <p className="max-w-lg text-base leading-7 text-muted-foreground">
              Set your services and the ZIPs you cover. Matching requests land in your portal with
              photos, notes, and the address attached — ready to quote before you spend a truck roll.
            </p>
          </div>

          <dl className="grid gap-5 border-t pt-6 sm:grid-cols-3">
            {stats.map((stat) => (
              <div key={stat.label} className="flex flex-col gap-1">
                <dt className="font-mono text-2xl tracking-tight text-primary">{stat.value}</dt>
                <dd className="text-sm leading-5 text-muted-foreground">{stat.label}</dd>
              </div>
            ))}
          </dl>

          <div>
            <Button size="lg" asChild>
              <Link href={proPaths.register}>
                Claim your service area
                <ArrowRight data-icon="inline-end" />
              </Link>
            </Button>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border bg-card shadow-[0_18px_44px_rgba(4,26,54,0.10)]">
          <div className="flex items-center justify-between border-b bg-muted/40 px-5 py-3.5">
            <p className="flex items-center gap-2 text-sm font-medium">
              <Radio className="size-4 text-primary" aria-hidden="true" />
              Job requests near you
            </p>
            <p className="font-mono text-[11px] text-muted-foreground">Live sample</p>
          </div>

          <ul className="flex flex-col">
            {feed.map((row) => (
              <li key={row.job} className="flex flex-col gap-2 border-b px-5 py-4 last:border-b-0">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <span className="inline-flex items-center rounded-full bg-primary/8 px-2.5 py-0.5 text-[11px] font-medium text-primary">
                      {row.trade}
                    </span>
                    <p className="mt-1.5 truncate text-sm font-medium">{row.job}</p>
                  </div>
                  <span className="shrink-0 font-mono text-[11px] text-muted-foreground">
                    {row.age}
                  </span>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <MapPin className="size-3.5" aria-hidden="true" />
                    {row.city}
                  </p>
                  <p className="font-mono text-xs tabular-nums">{row.budget}</p>
                </div>
              </li>
            ))}
          </ul>

          <div className="flex items-center justify-between gap-4 border-t bg-muted/40 px-5 py-3.5">
            <p className="text-xs text-muted-foreground">
              Matched to the trades and ZIPs on your profile.
            </p>
            <Link
              href={proPaths.register}
              className="text-xs font-medium text-primary hover:text-foreground"
            >
              Set up matching
            </Link>
          </div>
        </div>
      </Container>
    </Section>
  );
}
