import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Container, Section } from "@/components/layout/container";
import { customerWorkflow } from "@/lib/data/navigation";
import { cn } from "@/lib/utils";

export function WorkflowSection() {
  return (
    <Section className="overflow-hidden">
      <Container className="grid items-start gap-12 lg:grid-cols-[minmax(0,21rem)_minmax(0,1fr)] lg:gap-20">
        <div className="flex flex-col gap-5 lg:sticky lg:top-28">
          <p className="eyebrow text-primary">How it works</p>
          <h2 className="text-3xl font-semibold tracking-tight md:text-[2.5rem]">
            From choosing a service to paying the invoice
          </h2>
          <p className="max-w-sm text-sm leading-7 text-muted-foreground">
            Seven steps. One file. The estimate you sign is the job that gets done and the invoice
            you pay.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <Button size="xl" asChild>
              <Link href="/get-a-quote">
                Get a written estimate
                <ArrowRight data-icon="inline-end" />
              </Link>
            </Button>
            <Button
              size="xl"
              variant="outline"
              className="border-black/25 hover:border-black/35"
              asChild
            >
              <Link href="/find-a-professional">Find a professional</Link>
            </Button>
          </div>
        </div>

        <ol className="relative">
          <span
            className="pointer-events-none absolute top-8 right-0 hidden size-64 rounded-full bg-primary/[0.05] lg:block"
            aria-hidden="true"
          />
          <svg
            viewBox="0 0 64 800"
            preserveAspectRatio="none"
            className="pointer-events-none absolute top-6 bottom-6 left-5 hidden w-10 text-primary md:left-1/2 md:block md:-translate-x-1/2 md:w-16"
            aria-hidden="true"
          >
            <path
              d="M32 0 C58 57 6 114 32 171 C58 228 6 285 32 342 C58 399 6 456 32 513 C58 570 6 627 32 684 C50 730 20 770 32 800"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
          <span
            className="absolute top-6 bottom-6 left-5 w-px bg-primary/20 md:hidden"
            aria-hidden="true"
          />

          {customerWorkflow.map((item, index) => {
            const left = index % 2 === 0;
            const number = String(item.step).padStart(2, "0");
            return (
              <li
                key={item.step}
                className="relative grid grid-cols-[2.75rem_minmax(0,1fr)] items-center gap-4 py-6 md:grid-cols-[minmax(0,1fr)_3.5rem_minmax(0,1fr)] md:gap-6 md:py-7"
              >
                <div
                  className={cn(
                    "relative hidden md:block",
                    left ? "text-right" : "invisible"
                  )}
                >
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute -top-6 right-0 -z-10 text-7xl font-semibold leading-none text-primary/[0.07]"
                  >
                    {item.step}
                  </span>
                  <h3 className="text-lg font-semibold">{item.title}</h3>
                  <p className="mt-1.5 text-sm leading-6 text-muted-foreground">{item.body}</p>
                </div>

                <span className="relative z-10 flex size-11 items-center justify-center justify-self-center rounded-full bg-primary font-mono text-[0.7rem] font-semibold text-primary-foreground">
                  {number}
                </span>

                <div className={cn("relative", left ? "md:invisible" : "")}>
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute -top-5 left-0 -z-10 text-6xl font-semibold leading-none text-primary/[0.07] md:text-7xl"
                  >
                    {item.step}
                  </span>
                  <h3 className="text-lg font-semibold">{item.title}</h3>
                  <p className="mt-1.5 max-w-sm text-sm leading-6 text-muted-foreground">
                    {item.body}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      </Container>
    </Section>
  );
}
