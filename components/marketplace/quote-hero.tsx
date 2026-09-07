import Image from "next/image";
import Link from "next/link";
import {
  ClipboardList,
  FileCheck2,
  MapPin,
  ShieldCheck,
  Users,
} from "lucide-react";
import { Container } from "@/components/layout/container";

const steps = [
  { n: "01", label: "Describe the job", icon: ClipboardList },
  { n: "02", label: "Add your ZIP", icon: MapPin },
  { n: "03", label: "Compare matching pros", icon: Users },
];

const nextSteps = [
  {
    n: "1",
    title: "Tell us the work",
    body: "Service, job type, and timing so we ask the right questions.",
  },
  {
    n: "2",
    title: "See local matches",
    body: "Licensed companies that serve your ZIP, with a typical starting range.",
  },
  {
    n: "3",
    title: "Get a written estimate",
    body: "Matching companies receive your answers and send an itemized quote. You only hire if you approve it.",
  },
];

const assurances = [
  { icon: ShieldCheck, label: "Licensed and insured professionals" },
  { icon: FileCheck2, label: "Itemized estimates after a visit" },
  { icon: Users, label: "No obligation to hire" },
];

export function QuoteHero({ categoryName }: { categoryName?: string }) {
  return (
    <section className="relative isolate overflow-hidden">
      <div className="relative min-h-[17rem] w-full sm:min-h-[19rem] lg:min-h-[21rem]">
        <Image
          src="/images/home/hero-home.jpg"
          alt=""
          fill
          sizes="100vw"
          className="object-cover object-[66%_22%]"
          priority
        />
        <div
          className="absolute inset-0 bg-[rgba(4,26,54,0.62)] lg:hidden"
          aria-hidden="true"
        />
        <div
          className="absolute inset-0 hidden bg-[linear-gradient(100deg,rgba(4,26,54,0.9)_0%,rgba(4,26,54,0.72)_34%,rgba(4,26,54,0.42)_58%,rgba(4,26,54,0.16)_78%)] lg:block"
          aria-hidden="true"
        />

        <Container className="relative flex min-h-[17rem] flex-col justify-center gap-5 py-8 text-white sm:min-h-[19rem] md:py-10 lg:min-h-[21rem]">
          <nav aria-label="Breadcrumb">
            <ol className="flex items-center gap-2 text-sm text-white/70">
              <li>
                <Link href="/" className="transition-colors hover:text-white">
                  Home
                </Link>
              </li>
              <li aria-hidden="true">/</li>
              <li className="font-medium text-white" aria-current="page">
                Get a quote
              </li>
            </ol>
          </nav>

          <div className="max-w-2xl">
            <p className="eyebrow text-white/75">Written estimates</p>
            <h1 className="mt-2 text-[1.85rem] leading-[1.08] sm:text-[2.35rem] lg:text-[2.75rem]">
              {categoryName
                ? `Get a ${categoryName.toLowerCase()} quote`
                : "Get a written estimate from a local pro"}
            </h1>
            <p className="mt-3 max-w-lg text-sm text-white/80 md:text-base">
              Answer a few questions. We’ll show a typical starting range and the
              licensed companies that do this work in your ZIP.
            </p>
          </div>

          <ol className="grid gap-2 sm:grid-cols-3 sm:gap-3 lg:max-w-3xl">
            {steps.map((step) => (
              <li
                key={step.n}
                className="flex items-center gap-3 rounded-xl border border-white/15 bg-white/8 px-3.5 py-3 backdrop-blur-sm"
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-white/12">
                  <step.icon className="size-4" aria-hidden="true" />
                </span>
                <span>
                  <span className="block text-[11px] font-semibold tracking-wide text-white/55 uppercase">
                    Step {step.n}
                  </span>
                  <span className="text-sm font-medium">{step.label}</span>
                </span>
              </li>
            ))}
          </ol>
        </Container>
      </div>
    </section>
  );
}

export function QuoteGuide() {
  return (
    <aside className="flex flex-col gap-4 lg:sticky lg:top-24">
      <div className="rounded-xl border bg-card p-5 shadow-sm">
        <h2 className="text-sm font-semibold">What happens next</h2>
        <ol className="mt-4 flex flex-col gap-4">
          {nextSteps.map((step) => (
            <li key={step.n} className="flex gap-3">
              <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground">
                {step.n}
              </span>
              <span>
                <span className="block text-sm font-medium">{step.title}</span>
                <span className="mt-0.5 block text-sm leading-5 text-muted-foreground">
                  {step.body}
                </span>
              </span>
            </li>
          ))}
        </ol>
      </div>

      <div className="rounded-xl border bg-card p-5 shadow-sm">
        <h2 className="text-sm font-semibold">Before you request</h2>
        <ul className="mt-4 flex flex-col gap-3">
          {assurances.map((item) => (
            <li key={item.label} className="flex items-start gap-2.5 text-sm">
              <item.icon
                className="mt-0.5 size-4 shrink-0 text-primary"
                aria-hidden="true"
              />
              {item.label}
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}
