import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Container, Section } from "@/components/layout/container";
import { SectionHeader } from "@/components/shared/section-header";
import { cn } from "@/lib/utils";

const estimateRows = [
  { label: "Labor — 6 hrs @ $80.00", amount: "$480.00" },
  { label: "Copper fittings and supply line", amount: "$92.00" },
  { label: "City permit", amount: "$65.00" },
];

const paymentRows = [
  { label: "Deposit", note: "Paid Aug 12", amount: "$500.00", settled: true },
  { label: "Progress payment", note: "Paid Aug 21", amount: "$800.00", settled: true },
  { label: "Completion balance", note: "Due Aug 30", amount: "$540.00", settled: false },
];

const revenueBars = [42, 58, 51, 73, 66, 88];

function Showcase({
  step,
  eyebrow,
  title,
  description,
  points,
  flip = false,
  children,
}: {
  step: string;
  eyebrow: string;
  title: string;
  description: string;
  points: string[];
  flip?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
      <div className={cn("flex flex-col gap-5", flip && "lg:order-2")}>
        <p className="eyebrow flex items-center gap-3 text-muted-foreground">
          <span className="font-mono text-primary">{step}</span>
          <span className="h-px w-8 bg-border" aria-hidden="true" />
          {eyebrow}
        </p>

        <h3 className="text-2xl md:text-3xl">{title}</h3>

        <p className="text-base leading-7 text-muted-foreground text-pretty">{description}</p>

        <ul className="flex flex-col gap-3 border-t pt-5">
          {points.map((point) => (
            <li key={point} className="flex items-start gap-3 text-sm leading-6">
              <Check className="mt-1 size-4 shrink-0 text-success" aria-hidden="true" />
              {point}
            </li>
          ))}
        </ul>
      </div>

      <div className={cn("relative", flip && "lg:order-1")}>
        <div
          className="pointer-events-none absolute -inset-4 rounded-[2rem] bg-primary/4"
          aria-hidden="true"
        />
        <div className="relative rounded-2xl border bg-card p-6 elevate-lg md:p-7">{children}</div>
      </div>
    </div>
  );
}

export function PlatformSection() {
  return (
    <Section>
      <Container className="flex flex-col gap-16 lg:gap-24">
        <SectionHeader
          eyebrow="The provider portal"
          title="Estimates, approvals, change orders, invoices, and payments"
          description="Every job keeps a financial audit trail. Extra materials are added as change orders instead of quietly rewriting the quote a customer already approved."
          action={
            <Button variant="outline" asChild>
              <Link href="/pro">
                Explore the platform
                <ArrowRight data-icon="inline-end" />
              </Link>
            </Button>
          }
        />

        <Showcase
          step="01"
          eyebrow="Estimates"
          title="Quote the job line by line, not as a lump sum"
          description="Build an estimate from labor, materials, services, and miscellaneous lines. Subtotal, discount, and tax calculate as you type, so the number the customer sees is the number you meant to send."
          points={[
            "Reusable line items priced from your own rate card",
            "Discounts and tax applied at the estimate level",
            "Sent as a link the customer can open without an account",
          ]}
        >
          <div className="flex items-center justify-between gap-3 border-b pb-4">
            <span className="flex flex-col">
              <span className="font-mono text-xs text-muted-foreground">EST-1184</span>
              <span className="text-sm font-semibold">Water heater replacement</span>
            </span>
            <span className="rounded-full bg-secondary px-2.5 py-1 font-mono text-xs text-muted-foreground">
              Draft
            </span>
          </div>

          <div className="flex flex-col gap-3 py-4">
            {estimateRows.map((row) => (
              <div key={row.label} className="flex items-center justify-between gap-4 text-sm">
                <span className="truncate text-muted-foreground">{row.label}</span>
                <span className="shrink-0 font-mono tabular-nums">{row.amount}</span>
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-2.5 border-t pt-4 text-sm">
            <div className="flex items-center justify-between text-muted-foreground">
              <span>Subtotal</span>
              <span className="font-mono tabular-nums">$637.00</span>
            </div>
            <div className="flex items-center justify-between text-muted-foreground">
              <span>Tax (8.25%)</span>
              <span className="font-mono tabular-nums">$52.55</span>
            </div>
            <div className="flex items-center justify-between border-t pt-2.5 text-base font-medium">
              <span>Total</span>
              <span className="font-mono text-lg font-semibold tabular-nums">$689.55</span>
            </div>
          </div>
        </Showcase>

        <Showcase
          step="02"
          eyebrow="Approval and change orders"
          title="The estimate they signed stays exactly as they signed it"
          description="Customers review the line items and terms, then approve and sign electronically. When the job turns up extra work, it is added as a change order alongside the original — never written over the top of it."
          points={[
            "Digital signature captured with a timestamp",
            "Change orders approved separately before work continues",
            "Original estimate preserved for the life of the job",
          ]}
          flip
        >
          <div className="flex flex-col gap-2 border-b pb-4">
            <span className="text-sm font-semibold">Customer signature</span>
            <svg
              viewBox="0 0 200 46"
              className="h-12 w-full text-foreground"
              role="img"
              aria-label="Sample customer signature"
            >
              <path
                d="M6 34c10-16 16-22 20-20 5 3-6 22-1 24 5 2 14-24 21-24 6 0 1 18 6 19 6 1 12-14 18-14 5 0 2 11 8 11 7 0 12-13 20-13 6 0 4 9 10 9 7 0 14-9 22-9 9 0 15 6 21 6 6 0 12-3 18-8"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span className="flex items-center gap-2 text-xs text-muted-foreground">
              <Check className="size-3.5 text-success" aria-hidden="true" />
              Approved · Aug 14, 2:41 PM · Dana R.
            </span>
          </div>

          <div className="flex flex-col gap-3 pt-4 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Original estimate</span>
              <span className="font-mono tabular-nums">$689.55</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="flex min-w-0 items-center gap-2">
                <span className="rounded bg-warning/15 px-1.5 py-0.5 font-mono text-[0.65rem] text-warning-foreground">
                  CO-1
                </span>
                <span className="truncate text-muted-foreground">Additional supply line</span>
              </span>
              <span className="shrink-0 font-mono tabular-nums">$75.00</span>
            </div>
            <div className="flex items-center justify-between gap-3 border-t pt-3 font-medium">
              <span>Job total</span>
              <span className="font-mono text-base tabular-nums">$764.55</span>
            </div>
          </div>
        </Showcase>

        <Showcase
          step="03"
          eyebrow="Invoices, payments, reporting"
          title="Know what is owed, what is paid, and what it added up to"
          description="Deposits, progress payments, and completion balances stay on one running record per job. Across the business, reporting answers the questions an owner actually asks at the end of the month."
          points={[
            "Payment schedules with a live outstanding balance",
            "Invoices generated from the approved job total",
            "Revenue, job volume, and estimate conversion over time",
          ]}
        >
          <div className="flex flex-col gap-3 border-b pb-4">
            {paymentRows.map((row) => (
              <div key={row.label} className="flex items-center justify-between gap-3 text-sm">
                <span className="flex min-w-0 items-center gap-2.5">
                  <span
                    className={cn(
                      "size-1.5 shrink-0 rounded-full",
                      row.settled ? "bg-success" : "bg-warning"
                    )}
                    aria-hidden="true"
                  />
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate">{row.label}</span>
                    <span className="truncate text-xs text-muted-foreground">{row.note}</span>
                  </span>
                </span>
                <span className="shrink-0 font-mono tabular-nums">{row.amount}</span>
              </div>
            ))}
          </div>

          <div className="pt-4">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-sm font-medium">Revenue</span>
              <span className="font-mono text-xs text-muted-foreground">Trailing 6 months</span>
            </div>
            <div className="mt-3 flex h-24 items-end gap-2" aria-hidden="true">
              {revenueBars.map((height, index) => (
                <span
                  key={height}
                  className={cn(
                    "flex-1 rounded-sm",
                    index === revenueBars.length - 1 ? "bg-primary" : "bg-primary/20"
                  )}
                  style={{ height: `${height}%` }}
                />
              ))}
            </div>
          </div>
        </Showcase>
      </Container>
    </Section>
  );
}
