import Link from "next/link";
import {
  ArrowRight,
  FileSignature,
  MapPin,
  MessageSquareOff,
  PenLine,
  Route,
  ShieldCheck,
  Timer,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Container, Section } from "@/components/layout/container";
import { cn } from "@/lib/utils";

const pillars = [
  {
    icon: MapPin,
    step: "01",
    accent: "from-[#003F7D]/14 via-[#003F7D]/4 to-transparent",
    title: "Matched to your address and trade",
    body: "Your request goes only to professionals who cover your area and actually offer the service you asked for — not a blast to every company in town.",
  },
  {
    icon: MessageSquareOff,
    step: "02",
    accent: "from-sky-500/12 via-sky-500/4 to-transparent",
    title: "You decide when the conversation starts",
    body: "Pros see your project details in their inbox. You message when you’re ready. No cold calls from a list of strangers.",
  },
  {
    icon: FileSignature,
    step: "03",
    accent: "from-emerald-600/12 via-emerald-600/4 to-transparent",
    title: "Written estimates you can approve online",
    body: "Review line items, ask for changes, then sign digitally. The estimate you approve becomes the job and the invoice — nothing gets rewritten quietly.",
  },
  {
    icon: ShieldCheck,
    step: "04",
    accent: "from-amber-500/14 via-amber-500/4 to-transparent",
    title: "One record from request to payment",
    body: "Quotes, messages, the signed scope, and payments stay on the same project file so you always know what was agreed and what is owed.",
  },
] as const;

const highlights = [
  {
    icon: Route,
    title: "Local first",
    label: "Pros matched by ZIP and service area",
  },
  {
    icon: PenLine,
    title: "Written scope",
    label: "Line-item estimates you can sign",
  },
  {
    icon: Timer,
    title: "Your pace",
    label: "Message only when you’re ready",
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
              Care for your home without the{" "}
              <span className="trust-highlight relative inline-block whitespace-nowrap">
                guessing game
              </span>
              .
            </h2>
            <p className="max-w-xl text-sm leading-7 text-muted-foreground md:text-[15px]">
              Request Service is the calm path from “something needs fixing” to a signed estimate,
              scheduled work, and a clear invoice — with local professionals who already cover your
              neighborhood.
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

        {/* Highlights — icon chips, not a plain numbered strip */}
        <div
          data-stagger
          className="grid gap-3 sm:grid-cols-3"
        >
          {highlights.map((item, index) => {
            const Icon = item.icon;
            return (
              <div
                key={item.title}
                className={cn(
                  "group relative flex items-start gap-4 overflow-hidden rounded-2xl border border-[#d7e2ef] bg-white px-4 py-4",
                  "shadow-[0_12px_28px_-24px_rgba(0,63,125,0.45)] transition-all duration-300",
                  "hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-[0_18px_36px_-22px_rgba(0,63,125,0.4)]",
                )}
              >
                <span
                  aria-hidden="true"
                  className="absolute inset-y-0 left-0 w-1 bg-primary/0 transition-colors duration-300 group-hover:bg-primary"
                />
                <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/[0.08] text-primary ring-1 ring-primary/10">
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                <div className="min-w-0 pt-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[10px] tracking-[0.16em] text-primary/55 uppercase">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span className="h-px flex-1 bg-[#e6edf5]" aria-hidden="true" />
                  </div>
                  <p className="mt-1.5 text-[15px] font-semibold tracking-tight text-foreground">
                    {item.title}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">{item.label}</p>
                </div>
              </div>
            );
          })}
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
                <div
                  aria-hidden="true"
                  className={cn(
                    "pointer-events-none absolute inset-x-0 top-0 h-28 bg-linear-to-b",
                    pillar.accent,
                  )}
                />
                <div className="relative flex items-start justify-between gap-3">
                  <span className="flex size-11 items-center justify-center rounded-2xl bg-white text-primary shadow-[0_10px_24px_-14px_rgba(0,63,125,0.7)] ring-1 ring-[#003F7D]/10 transition-transform duration-300 group-hover:scale-105">
                    <Icon className="size-5" aria-hidden="true" />
                  </span>
                  <span className="font-mono text-[11px] tracking-[0.16em] text-muted-foreground/80">
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
                  className="relative mt-5 h-px w-full overflow-hidden bg-[#e6edf5]"
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
