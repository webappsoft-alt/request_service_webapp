import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Container, Section } from "@/components/layout/container";

const ASSURANCES = [
  {
    title: "Compare before you commit",
    body: "Review profiles, service areas, and written quotes before anyone shows up at your door.",
  },
  {
    title: "Scope stays as signed",
    body: "Extra work is a separate change order. The estimate you approved is never rewritten in place.",
  },
  {
    title: "Pay against a clear balance",
    body: "Deposits, progress payments, and the final invoice sit on one running record for the job.",
  },
] as const;

/** Full-bleed dark blue call-to-action band. */
export function QuoteBand() {
  return (
    <section className="relative overflow-hidden bg-[#003F7D] text-white dark:bg-[#0a2a52]">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-40 right-[-10%] size-[36rem] rounded-full bg-[radial-gradient(circle,rgba(56,189,248,0.22),transparent_65%)]"
      />
      <Container className="relative flex flex-col gap-8 py-16 md:py-20 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex max-w-2xl flex-col gap-3">
          <h2 className="text-balance text-3xl font-semibold tracking-tight md:text-[2.4rem] md:leading-[1.12]">
            Start with a quote request — or pick a pro by name.
          </h2>
          <p className="max-w-xl text-sm leading-7 text-white/75 md:text-base">
            General requests go to matching local professionals. Choosing a company from search or a profile sends
            that request only to them.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button size="xl" className="bg-white text-[#003F7D] hover:bg-white/90" asChild>
            <Link href="/get-a-quote">
              Get a quote
              <ArrowRight data-icon="inline-end" />
            </Link>
          </Button>
          <Button
            size="xl"
            variant="outline"
            className="border-white/35 bg-transparent text-white hover:bg-white/10 hover:text-white"
            asChild
          >
            <Link href="/find-a-professional">Find a professional</Link>
          </Button>
        </div>
      </Container>
    </section>
  );
}

/**
 * "Peace of mind" as a statement + numbered rows (no cards), followed by a full-bleed
 * call-to-action band instead of a rounded box.
 */
export function AssuranceSplit() {
  return (
    <>
      <Section className="bg-background">
        <Container className="grid gap-12 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-24">
          <div className="flex flex-col gap-4 lg:sticky lg:top-28 lg:self-start">
            <p className="eyebrow text-primary">Peace of mind</p>
            <h2 className="text-balance text-3xl font-semibold tracking-tight md:text-[3rem] md:leading-[1.08]">
              You stay in control at every step.
            </h2>
            <p className="max-w-md text-sm leading-7 text-muted-foreground md:text-base">
              Thumbtack-simple for finding help. Contractor-grade clarity once the work is quoted. Request Service keeps both
              sides on the same project file.
            </p>
          </div>

          <ol className="flex flex-col">
            {ASSURANCES.map((item, index) => (
              <li
                key={item.title}
                className="grid grid-cols-[3.5rem_minmax(0,1fr)] gap-x-4 border-t border-border py-8 first:border-t-0 first:pt-0 last:pb-0 sm:grid-cols-[5rem_minmax(0,1fr)]"
              >
                <span className="text-4xl font-semibold tracking-tight text-primary/25 tabular-nums sm:text-5xl">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <div className="flex flex-col gap-2 pt-1">
                  <h3 className="text-lg font-semibold tracking-tight sm:text-xl">{item.title}</h3>
                  <p className="max-w-lg text-sm leading-7 text-muted-foreground sm:text-base">{item.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </Container>
      </Section>

      <QuoteBand />
    </>
  );
}
