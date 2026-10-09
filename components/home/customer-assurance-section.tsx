import Link from "next/link";
import {
  ArrowRight,
  ClipboardList,
  HandCoins,
  SearchCheck,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Container, Section } from "@/components/layout/container";

const assurances = [
  {
    icon: SearchCheck,
    title: "Compare before you commit",
    body: "Review profiles, service areas, and written quotes before anyone shows up at your door.",
  },
  {
    icon: ClipboardList,
    title: "Scope stays as signed",
    body: "Extra work is a separate change order. The estimate you approved is never rewritten in place.",
  },
  {
    icon: HandCoins,
    title: "Pay against a clear balance",
    body: "Deposits, progress payments, and the final invoice sit on one running record for the job.",
  },
] as const;

export function CustomerAssuranceSection() {
  return (
    <Section tone="muted" density="tight" className="relative overflow-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-[linear-gradient(180deg,transparent,rgba(0,63,125,0.06))]"
      />

      <Container className="relative flex flex-col gap-10">
        <div className="mx-auto flex max-w-2xl flex-col items-center gap-3 text-center">
          <p className="eyebrow text-primary">Peace of mind</p>
          <h2 className="text-3xl font-semibold tracking-tight md:text-[2.35rem] md:leading-[1.15]">
            You stay in control at every step.
          </h2>
          <p className="max-w-lg text-sm leading-7 text-muted-foreground md:text-base">
            Thumbtack-simple for finding help. Contractor-grade clarity once the work is quoted.
            Request Service keeps both sides on the same project file.
          </p>
        </div>

        <div data-stagger className="grid gap-4 md:grid-cols-3">
          {assurances.map((item) => {
            const Icon = item.icon;
            return (
              <article
                key={item.title}
                className="rounded-2xl border border-input bg-card px-5 py-6 text-center shadow-[0_16px_36px_-28px_rgba(0,63,125,0.4)]"
              >
                <span className="mx-auto flex size-11 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                <h3 className="mt-4 text-[15px] font-semibold tracking-tight">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.body}</p>
              </article>
            );
          })}
        </div>

        <div className="overflow-hidden rounded-[1.75rem] border border-[#003F7D]/15 bg-[#003F7D] px-6 py-8 text-primary-foreground sm:px-10 sm:py-10 dark:border-sky-400/20 dark:bg-[linear-gradient(135deg,#0b3a6e,#0a2a52)] dark:text-white">
          <div className="grid items-center gap-8 lg:grid-cols-[minmax(0,1fr)_auto]">
            <div className="flex flex-col gap-3">
              <p className="inline-flex w-fit items-center gap-2 rounded-full bg-white/12 px-3 py-1 text-[11px] font-medium tracking-[0.14em] uppercase dark:text-sky-100">
                <Sparkles className="size-3.5" aria-hidden="true" />
                Ready when you are
              </p>
              <h3 className="text-2xl font-semibold tracking-tight md:text-[1.85rem]">
                Start with a quote request — or pick a pro by name.
              </h3>
              <p className="max-w-xl text-sm leading-7 text-primary-foreground/75 dark:text-slate-200/80">
                General requests go to matching local professionals. Choosing a company from search
                or a profile sends that request only to them.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row lg:flex-col xl:flex-row">
              <Button
                size="lg"
                className="bg-white text-[#003F7D] hover:bg-white/90"
                asChild
              >
                <Link href="/get-a-quote">
                  Get a quote
                  <ArrowRight data-icon="inline-end" />
                </Link>
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="border-white/30 bg-transparent text-white hover:bg-white/10 hover:text-white"
                asChild
              >
                <Link href="/find-a-professional">Find a professional</Link>
              </Button>
            </div>
          </div>
        </div>
      </Container>
    </Section>
  );
}
