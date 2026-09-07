import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Container, Section } from "@/components/layout/container";
import { CategoryIcon } from "@/components/shared/category-icon";
import { serviceCategories } from "@/lib/data/services";
import { serviceAccents } from "@/lib/icons";
import { proPaths } from "@/lib/pro-paths";
import { cn } from "@/lib/utils";

const beats = [
  { id: "request", label: "Inbox", hint: "Matched or direct", active: false },
  { id: "sign", label: "Estimate", hint: "They sign the scope", active: true },
  { id: "crew", label: "Crew", hint: "On the calendar", active: false },
  { id: "paid", label: "Invoice", hint: "Same job file", active: false },
] as const;

export function ProProduct() {
  return (
    <Section id="process" density="tight" className="scroll-mt-24">
      <Container className="flex flex-col items-center gap-10 text-center">
        <div className="flex max-w-2xl flex-col items-center gap-3">
          <p className="eyebrow text-primary">Made for home service teams</p>
          <h2 className="text-3xl font-semibold tracking-tight md:text-[2.5rem]">
            One job file, across every trade you run.
          </h2>
          <p className="max-w-lg text-sm leading-7 text-muted-foreground">
            Inbox, estimate, crew, and invoice stay on the same record — HVAC, plumbing, or a
            bath remodel. One desk, every trade you run.
          </p>
        </div>

        <div className="w-full max-w-4xl rounded-2xl bg-primary/[0.06] p-3 sm:p-4">
          <div className="overflow-hidden rounded-xl border border-black/15 bg-card text-left shadow-[0_22px_48px_-28px_rgba(0,63,125,0.45)]">
            <div className="flex items-center justify-between gap-3 border-b border-black/10 px-4 py-3">
              <div className="flex min-w-0 items-center gap-3">
                <span className="hidden items-center gap-1.5 sm:flex" aria-hidden="true">
                  <span className="size-2 rounded-full bg-black/15" />
                  <span className="size-2 rounded-full bg-black/15" />
                  <span className="size-2 rounded-full bg-black/15" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">Job file RS-2841</p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    One record · every trade
                  </p>
                </div>
              </div>
              <span className="hidden font-mono text-[10px] tracking-[0.14em] text-primary uppercase sm:inline">
                Live
              </span>
            </div>

            <div className="grid grid-cols-2 border-b border-black/10 sm:grid-cols-4">
              {beats.map((beat) => (
                <div
                  key={beat.id}
                  className={cn(
                    "border-black/8 px-3 py-3 sm:border-l sm:first:border-l-0",
                    beat.active && "bg-primary text-primary-foreground",
                  )}
                >
                  <p
                    className={cn(
                      "text-[10px] font-medium tracking-wide uppercase",
                      beat.active ? "text-white/65" : "text-muted-foreground",
                    )}
                  >
                    {beat.label}
                  </p>
                  <p className="mt-0.5 text-[12px] font-semibold">{beat.hint}</p>
                </div>
              ))}
            </div>

            <div className="-mb-px -mr-px grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
              {serviceCategories.map((category) => (
                <div
                  key={category.id}
                  className="flex items-center gap-2.5 border-r border-b border-black/8 px-4 py-4"
                >
                  <span
                    className={cn(
                      "flex size-9 shrink-0 items-center justify-center rounded-lg",
                      serviceAccents[category.slug],
                    )}
                  >
                    <CategoryIcon slug={category.slug} className="size-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-[13px] font-semibold">{category.name}</span>
                    <span className="block truncate text-[11px] text-muted-foreground">
                      {category.tagline}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <Link
          href={`${proPaths.home}#product`}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
        >
          See everything in the portal
          <ArrowUpRight className="size-3.5" aria-hidden="true" />
        </Link>
      </Container>
    </Section>
  );
}
