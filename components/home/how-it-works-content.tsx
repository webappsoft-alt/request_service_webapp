import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  Check,
  ClipboardList,
  CreditCard,
  FileCheck2,
  HardHat,
  LayoutGrid,
  PenLine,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Container, Section } from "@/components/layout/container";
import { customerWorkflow } from "@/lib/data/navigation";
import { HERO_PRO_IMAGE } from "@/lib/site";
import { cn } from "@/lib/utils";

function stepNo(step: number) {
  return String(step).padStart(2, "0");
}

const HERO_CONTRACTORS_IMAGE =
  "https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&w=2400&q=80";

const CUSTOMER_STEP_META = [
  { phase: "Start", icon: LayoutGrid },
  { phase: "Request", icon: ClipboardList },
  { phase: "Match", icon: Users },
  { phase: "Quote", icon: FileCheck2 },
  { phase: "Approve", icon: PenLine },
  { phase: "Job", icon: HardHat },
  { phase: "Pay", icon: CreditCard },
] as const;

const customerSteps = customerWorkflow.map((item, index) => ({
  ...item,
  ...CUSTOMER_STEP_META[index]!,
}));

const PRO_HIGHLIGHTS = [
  "Matched requests in your ZIP and trade",
  "Estimate, schedule, and invoice on one file",
  "No commission on the work you win",
] as const;

export function HowItWorksContent() {
  return (
    <>
      <section className="relative isolate overflow-hidden">
        <div className="relative min-h-[17rem] w-full sm:min-h-[19rem] lg:min-h-[21rem]">
          <Image
            src={HERO_CONTRACTORS_IMAGE}
            alt="Contractors working on a job site"
            fill
            priority
            sizes="100vw"
            className="object-cover object-[center_35%]"
          />
          <div
            className="absolute inset-0 bg-[rgba(4,26,54,0.62)] lg:hidden"
            aria-hidden="true"
          />
          <div
            className="absolute inset-0 hidden bg-[linear-gradient(100deg,rgba(4,26,54,0.88)_0%,rgba(4,26,54,0.7)_38%,rgba(4,26,54,0.38)_64%,rgba(4,26,54,0.18)_82%)] lg:block"
            aria-hidden="true"
          />

          <Container className="relative flex min-h-[17rem] flex-col justify-center gap-5 py-8 text-white sm:min-h-[19rem] md:py-10 lg:min-h-[21rem]">
            <nav aria-label="Breadcrumb">
              <ol className="flex flex-wrap items-center gap-2 text-sm text-white/70">
                <li>
                  <Link href="/" className="transition-colors hover:text-white">
                    Home
                  </Link>
                </li>
                <li aria-hidden="true">/</li>
                <li className="font-medium text-white" aria-current="page">
                  How it works
                </li>
              </ol>
            </nav>

            <div className="flex max-w-2xl flex-col gap-3">
              <p className="eyebrow text-white/75">How it works</p>
              <h1 className="text-[1.85rem] leading-[1.08] font-semibold tracking-tight sm:text-[2.35rem] lg:text-[2.75rem]">
                Two workflows. One product.
              </h1>
              <p className="max-w-xl text-sm leading-6 text-white/80 md:text-base">
                Customers request and approve work. Pros quote, complete, invoice, and get paid —
                on the same written file.
              </p>
              <div className="flex flex-col gap-3 pt-1 sm:flex-row sm:items-center">
                <Button
                  size="lg"
                  className="bg-white text-foreground hover:bg-white/90"
                  asChild
                >
                  <Link href="/get-a-quote">
                    Get a written estimate
                    <ArrowRight data-icon="inline-end" />
                  </Link>
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="border-white/35 bg-transparent text-white hover:bg-white/10 hover:text-white"
                  asChild
                >
                  <Link href="/pro">Join as a Pro</Link>
                </Button>
              </div>
            </div>
          </Container>
        </div>
      </section>

      <Section>
        <Container className="flex flex-col gap-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex max-w-xl flex-col gap-2">
              <p className="eyebrow text-muted-foreground">For homeowners</p>
              <h2 className="text-2xl font-semibold tracking-tight md:text-[1.85rem]">
                From request to payment
              </h2>
              <p className="text-sm leading-6 text-muted-foreground">
                Seven steps. Clear scope. No surprises after you approve.
              </p>
            </div>
            <Button className="w-fit shrink-0" asChild>
              <Link href="/get-a-quote">
                Start a request
                <ArrowRight data-icon="inline-end" />
              </Link>
            </Button>
          </div>

          <div className="grid gap-8 lg:grid-cols-2 lg:gap-x-12">
            {[customerSteps.slice(0, 4), customerSteps.slice(4)].map((group, groupIndex) => (
              <ol key={groupIndex} className="relative flex flex-col">
                <span
                  className="absolute top-4 bottom-4 left-5 w-px bg-border"
                  aria-hidden="true"
                />
                {group.map((item, index) => {
                  const Icon = item.icon;
                  return (
                    <li
                      key={item.step}
                      className={cn(
                        "relative grid grid-cols-[2.5rem_minmax(0,1fr)] gap-4",
                        index < group.length - 1 && "pb-5",
                      )}
                    >
                      <span className="relative z-10 flex size-10 items-center justify-center rounded-full border border-primary/25 bg-primary/10 text-primary">
                        <Icon className="size-4" aria-hidden="true" />
                      </span>
                      <div className="min-w-0 pt-1">
                        <p className="font-mono text-[10px] tracking-[0.14em] text-muted-foreground uppercase">
                          {stepNo(item.step)} · {item.phase}
                        </p>
                        <h3 className="mt-0.5 text-[0.95rem] font-semibold tracking-tight">
                          {item.title}
                        </h3>
                        <p className="mt-0.5 text-sm leading-5 text-muted-foreground">
                          {item.body}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ol>
            ))}
          </div>
        </Container>
      </Section>

      {/* Pros — graphic panel, not a 10-step list */}
      <Section tone="muted">
        <Container>
          <div className="grid overflow-hidden rounded-2xl border border-input bg-card lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
            <div className="flex flex-col justify-center gap-5 p-6 sm:p-8 lg:p-10">
              <div className="flex flex-col gap-2">
                <p className="eyebrow text-muted-foreground">For Pros</p>
                <h2 className="text-2xl font-semibold tracking-tight md:text-[1.85rem]">
                  Run the job from one login
                </h2>
                <p className="max-w-md text-sm leading-6 text-muted-foreground">
                  Matched requests, written estimates, schedule, and payment — the same desk
                  homeowners approve against.
                </p>
              </div>

              <ul className="flex flex-col gap-2.5">
                {PRO_HIGHLIGHTS.map((point) => (
                  <li key={point} className="flex items-start gap-2.5 text-sm">
                    <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                    <span>{point}</span>
                  </li>
                ))}
              </ul>

              <Button className="w-fit" asChild>
                <Link href="/pro">
                  Explore the Pro portal
                  <ArrowRight data-icon="inline-end" />
                </Link>
              </Button>
            </div>

            <div className="relative min-h-[14rem] sm:min-h-[18rem] lg:min-h-full">
              <Image
                src={HERO_PRO_IMAGE}
                alt="Service professional reviewing a job on site"
                fill
                sizes="(min-width: 1024px) 45vw, 100vw"
                className="object-cover object-[62%_28%]"
              />
              <div
                className="absolute inset-0 bg-[linear-gradient(0deg,rgba(4,26,54,0.35),transparent_45%)] lg:bg-[linear-gradient(270deg,transparent_20%,rgba(4,26,54,0.12))]"
                aria-hidden="true"
              />
            </div>
          </div>
        </Container>
      </Section>

      <Section density="tight">
        <Container className="flex flex-col gap-6">
          <div className="flex max-w-2xl flex-col gap-2">
            <p className="eyebrow text-muted-foreground">One job file</p>
            <h2 className="text-xl font-semibold tracking-tight md:text-2xl">
              Estimate → job → invoice. Same numbers.
            </h2>
            <p className="text-sm leading-6 text-muted-foreground">
              When a homeowner signs, Pros schedule on that file. Payments and change orders stay
              attached.
            </p>
          </div>

          <ol className="grid gap-4 md:grid-cols-3">
            {[
              {
                label: "Estimate",
                title: "Itemized and sent",
                body: "Labor, materials, tax, and terms on one page.",
              },
              {
                label: "Approval",
                title: "Signed digitally",
                body: "The signed scope becomes the job record.",
              },
              {
                label: "Invoice",
                title: "Paid against the file",
                body: "Deposits and balances stay on the same total.",
              },
            ].map((item, index) => (
              <li
                key={item.label}
                className="rounded-xl border border-input bg-card p-5"
              >
                <p className="font-mono text-[11px] tracking-[0.16em] text-primary uppercase">
                  {stepNo(index + 1)} · {item.label}
                </p>
                <h3 className="mt-3 text-base font-semibold tracking-tight">{item.title}</h3>
                <p className="mt-1.5 text-sm leading-6 text-muted-foreground">{item.body}</p>
                <p className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
                  <Check className="size-3.5 text-primary" aria-hidden="true" />
                  Stays on the same record
                </p>
              </li>
            ))}
          </ol>
        </Container>
      </Section>

      {/* CTA — light surface so it sits apart from the dark footer */}
      <section className="border-t border-border bg-primary/[0.06]">
        <div className="container-site grid gap-10 py-12 md:grid-cols-2 md:gap-0 md:py-14">
          <div className="flex flex-col gap-4 md:border-r md:border-border md:pr-10 lg:pr-14">
            <p className="text-xs font-medium tracking-[0.14em] text-primary uppercase">
              Customers
            </p>
            <h2 className="text-2xl font-semibold tracking-tight text-foreground md:text-[1.75rem]">
              Get a written estimate
            </h2>
            <p className="max-w-sm text-sm leading-6 text-muted-foreground">
              Request the work, compare local Pros, and approve the scope before anyone starts.
            </p>
            <Button size="lg" className="mt-1 w-fit" asChild>
              <Link href="/get-a-quote">
                Request service
                <ArrowRight data-icon="inline-end" />
              </Link>
            </Button>
          </div>

          <div className="flex flex-col gap-4 md:pl-10 lg:pl-14">
            <p className="text-xs font-medium tracking-[0.14em] text-primary uppercase">
              Pros
            </p>
            <h2 className="text-2xl font-semibold tracking-tight text-foreground md:text-[1.75rem]">
              Join the Pro portal
            </h2>
            <p className="max-w-sm text-sm leading-6 text-muted-foreground">
              Create an account, review plans, and run requests through payment in one login.
            </p>
            <Button size="lg" variant="outline" className="mt-1 w-fit border-input bg-card" asChild>
              <Link href="/pro">
                Join as a Pro
                <ArrowRight data-icon="inline-end" />
              </Link>
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}
