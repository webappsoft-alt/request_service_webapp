import Link from "next/link";
import { ArrowRight, FileSignature, FolderOpen, MapPin, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Container, Section } from "@/components/layout/container";
import { cn } from "@/lib/utils";

const pillars = [
  {
    icon: MapPin,
    step: "01",
    surface: "from-blue-50/60 via-white/40 to-transparent",
    accent: "from-[#0B4379]/10 via-[#0B4379]/3 to-transparent",
    title: "Tell Us What You Need",
    body: "Select a service, enter your ZIP code, and describe your project. Add photos to help professionals understand the job.",
  },
  {
    icon: Users,
    step: "02",
    surface: "from-sky-50 via-blue-50/80 to-transparent",
    accent: "from-[#0B4379]/12 via-[#0B4379]/4 to-transparent",
    title: "Connect With Local Pros",
    body: "Find professionals who serve your area and offer the service you need. Review profiles, experience, and available customer feedback.",
  },
  {
    icon: FileSignature,
    step: "03",
    surface: "from-blue-50 via-sky-100/40 to-transparent",
    accent: "from-sky-600/12 via-sky-500/4 to-transparent",
    title: "Review Estimates & Hire",
    body: "Discuss project details, review written estimates, ask questions, and choose the professional who fits your needs.",
  },
  {
    icon: FolderOpen,
    step: "04",
    surface: "from-sky-100/50 via-blue-50 to-blue-50/30",
    accent: "from-[#0B4379]/16 via-[#0B4379]/5 to-transparent",
    title: "Manage Your Project",
    body: "Keep messages, project details, schedules, and estimates organized in one convenient place.",
  },
] as const;

export function CustomerTrustSection() {
  return (
    <Section
      tone="muted"
      density="tight"
      className="trust-section relative overflow-hidden"
    >
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="trust-orb trust-orb-a absolute -top-24 left-[-8%] size-[28rem] rounded-full bg-[radial-gradient(circle,rgba(0,63,125,0.12),transparent_68%)]" />
        <div className="trust-orb trust-orb-b absolute top-[18%] right-[-12%] size-[32rem] rounded-full bg-[radial-gradient(circle,rgba(0,63,125,0.08),transparent_70%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.55)_0%,transparent_28%,transparent_72%,rgba(255,255,255,0.4)_100%)]" />
        <div className="trust-grid absolute inset-0 opacity-[0.28]" />
      </div>

      <Container className="relative flex flex-col gap-11 lg:gap-14">
        <div className="grid items-end gap-8 lg:grid-cols-[minmax(0,1.35fr)_minmax(16rem,20rem)] lg:gap-14">
          <div className="flex max-w-2xl flex-col gap-4">
            <p className="inline-flex w-fit items-center gap-2.5">
              <span className="trust-pulse h-1.5 w-1.5 rounded-full bg-primary" aria-hidden="true" />
              <span className="eyebrow text-primary">Built for homeowners</span>
            </p>
            <h2 className="text-balance text-3xl font-semibold tracking-tight md:text-[2.65rem] md:leading-[1.12]">
              Find the Right Home Service Professional.{" "}
              <span className="trust-highlight relative inline-block whitespace-nowrap">
                Get the Job Done.
              </span>
            </h2>
            <p className="max-w-xl text-sm leading-7 text-muted-foreground md:text-[15px]">
              Tell us what you need, connect with local professionals, review written estimates, and
              manage your project—all in one place.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
            <Button size="lg" className="trust-cta group justify-center" asChild>
              <Link href="/get-a-quote">
                Request a quote
                <ArrowRight
                  data-icon="inline-end"
                  className="transition-transform duration-300 group-hover:translate-x-0.5"
                />
              </Link>
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="justify-center bg-white/70 backdrop-blur-sm"
              asChild
            >
              <Link href="/find-a-professional">Browse professionals</Link>
            </Button>
          </div>
        </div>

        <div data-stagger className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {pillars.map((pillar) => {
            const Icon = pillar.icon;
            return (
              <article
                key={pillar.title}
                className={cn(
                  "trust-card group relative flex h-full flex-col overflow-hidden rounded-[1.35rem]",
                  "border border-white/80 bg-white/85 p-5",
                  "shadow-[0_18px_44px_-34px_rgba(0,63,125,0.55)] backdrop-blur-sm",
                  "transition-[transform,box-shadow,border-color] duration-300",
                  "hover:-translate-y-1.5 hover:border-primary/20 hover:shadow-[0_28px_50px_-28px_rgba(0,63,125,0.45)]",
                )}
              >
                {/* Brand-blue wash, a little deeper per step (01 → 04); muted in dark mode. */}
                <div
                  aria-hidden="true"
                  className={cn(
                    "pointer-events-none absolute inset-0 bg-linear-to-br dark:opacity-15",
                    pillar.surface,
                  )}
                />
                <div
                  aria-hidden="true"
                  className={cn(
                    "pointer-events-none absolute inset-x-0 top-0 h-28 bg-linear-to-b dark:opacity-60",
                    pillar.accent,
                  )}
                />
                {/* Brand-blue top edge. */}
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-x-0 top-0 h-0.5 bg-linear-to-r from-[#0B4379]/70 via-sky-500/50 to-transparent"
                />
                <div className="relative flex items-start justify-between gap-3">
                  <span className="flex size-11 items-center justify-center rounded-2xl bg-white text-primary shadow-[0_10px_24px_-14px_rgba(11,67,121,0.7)] ring-1 ring-[#0B4379]/15 transition-transform duration-300 group-hover:scale-105">
                    <Icon className="size-5" aria-hidden="true" />
                  </span>
                  <span className="rounded-full bg-[#0B4379]/8 px-2.5 py-1 font-mono text-[11px] font-semibold tracking-[0.16em] text-primary ring-1 ring-[#0B4379]/15 dark:bg-sky-400/10 dark:text-sky-300 dark:ring-sky-400/20">
                    {pillar.step}
                  </span>
                </div>
                <div className="relative mt-5 flex flex-1 flex-col gap-2.5">
                  <h3 className="text-[15px] font-semibold tracking-tight text-foreground">
                    {pillar.title}
                  </h3>
                  <p className="text-sm leading-6 text-muted-foreground">{pillar.body}</p>
                </div>
                <div
                  aria-hidden="true"
                  className="relative mt-5 h-px w-full overflow-hidden bg-[#0B4379]/12 dark:bg-sky-400/15"
                >
                  <span className="absolute inset-y-0 left-0 w-0 bg-primary transition-[width] duration-500 ease-out group-hover:w-full" />
                </div>
              </article>
            );
          })}
        </div>
      </Container>
    </Section>
  );
}
