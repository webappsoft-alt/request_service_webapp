import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Container, Section } from "@/components/layout/container";
import { CategoryIcon } from "@/components/shared/category-icon";
import { serviceCategories } from "@/lib/data/services";
import { serviceAccents } from "@/lib/icons";
import { proPaths } from "@/lib/pro-paths";
import { cn } from "@/lib/utils";

const beats = [
  {
    id: "lead",
    label: "Lead",
    title: "Request lands in your inbox",
    body: "Matched by ZIP and trade — or sent straight to your company by name.",
  },
  {
    id: "estimate",
    label: "Estimate",
    title: "Scope they can accept",
    body: "Line items, totals, and a share link. They approve or ask for changes online.",
  },
  {
    id: "job",
    label: "Job",
    title: "Work on the calendar",
    body: "The signed estimate becomes the job — assigned, scheduled, and tracked.",
  },
  {
    id: "invoice",
    label: "Invoice",
    title: "Paid on the same file",
    body: "Deposits and balance stay on the record they already approved.",
  },
] as const;

export function ProProduct() {
  return (
    <Section id="process" density="tight" className="scroll-mt-24">
      <Container className="flex flex-col gap-12 lg:gap-14">
        <div className="mx-auto flex max-w-2xl flex-col items-center gap-3 text-center">
          <p className="eyebrow text-primary">Made for home service teams</p>
          <h2 className="text-3xl font-semibold tracking-tight md:text-[2.5rem] md:leading-[1.12]">
            One job file, across every trade you run.
          </h2>
          <p className="max-w-lg text-sm leading-7 text-muted-foreground">
            Inbox, estimate, crew, and invoice stay on the same record — whether you run HVAC,
            plumbing, or a bath remodel.
          </p>
        </div>

        {/* Pipeline — open, no outer box */}
        <ol className="relative mx-auto grid w-full max-w-5xl gap-8 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
          {/* Connector line (desktop) */}
          <span
            aria-hidden="true"
            className="pointer-events-none absolute top-[1.125rem] right-[12.5%] left-[12.5%] hidden h-px bg-[#d7e2ef] lg:block"
          />

          {beats.map((beat, index) => (
            <li key={beat.id} className="relative flex flex-col items-center gap-3 text-center lg:items-start lg:text-left">
              <span className="relative z-10 flex size-9 items-center justify-center rounded-full border border-[#d7e2ef] bg-white font-mono text-[11px] font-semibold text-primary shadow-[0_6px_16px_-10px_rgba(0,63,125,0.45)]">
                {String(index + 1).padStart(2, "0")}
              </span>
              <div className="flex flex-col gap-1.5">
                <p className="text-[11px] font-semibold tracking-[0.14em] text-primary uppercase">
                  {beat.label}
                </p>
                <p className="text-[15px] font-semibold tracking-tight text-foreground">
                  {beat.title}
                </p>
                <p className="text-sm leading-6 text-muted-foreground">{beat.body}</p>
              </div>
            </li>
          ))}
        </ol>

        {/* Trades — editorial directory, not a centered icon grid */}
        <div className="mx-auto w-full max-w-5xl border-t border-[#e6edf5] pt-10">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.5fr)] lg:items-start lg:gap-14">
            <div className="flex flex-col gap-3 lg:pt-1">
              <p className="eyebrow text-primary">Trades</p>
              <p className="text-xl font-semibold tracking-tight text-foreground md:text-[1.35rem]">
                Built for the trades you already run
              </p>
              <p className="max-w-sm text-sm leading-6 text-muted-foreground">
                Same desk for every crew — one inbox, one estimate, one invoice file,
                whether you fix pipes or roofs.
              </p>
              <Link
                href={`${proPaths.home}#product`}
                className="mt-1 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
              >
                See everything in the portal
                <ArrowUpRight className="size-3.5" aria-hidden="true" />
              </Link>
            </div>

            <ul className="grid grid-cols-1 gap-x-8 gap-y-1 sm:grid-cols-2">
              {serviceCategories.map((category) => (
                <li key={category.id} className="flex items-center gap-3 py-2.5">
                  <span
                    className={cn(
                      "flex size-10 shrink-0 items-center justify-center rounded-lg",
                      serviceAccents[category.slug],
                    )}
                  >
                    <CategoryIcon slug={category.slug} className="size-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[14px] font-semibold tracking-tight text-foreground">
                      {category.name}
                    </span>
                    <span className="block text-[12px] leading-5 text-muted-foreground">
                      {category.tagline}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Container>
    </Section>
  );
}
