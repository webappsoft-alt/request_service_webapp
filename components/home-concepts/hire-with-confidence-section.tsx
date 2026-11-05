import {
  ClipboardCheck,
  FileText,
  ShieldCheck,
  Star,
  type LucideIcon,
} from "lucide-react";
import { Container, Section } from "@/components/layout/container";

const POINTS: { icon: LucideIcon; title: string; body: string }[] = [
  {
    icon: ShieldCheck,
    title: "Know Who You're Hiring",
    body: "Review business profiles, qualifications, and available license and insurance information.",
  },
  {
    icon: FileText,
    title: "Clear Written Estimates",
    body: "Understand proposed work, materials, pricing, and terms before approving.",
  },
  {
    icon: Star,
    title: "Customer Reviews",
    body: "Learn from customer experiences and review completed projects where available.",
  },
  {
    icon: ClipboardCheck,
    title: "Your Project, Organized",
    body: "Keep estimates, schedules, approvals, and project communication in one place.",
  },
];

/** Trust section (home-v3): why hiring through Request Service is safe, in four short points. */
export function HireWithConfidenceSection() {
  return (
    <Section density="tight" className="bg-background">
      <Container>
        <div className="flex max-w-3xl flex-col gap-3">
          <p className="eyebrow text-primary">Built for your peace of mind</p>
          <h2 className="text-balance text-3xl font-semibold tracking-tight md:text-[2.5rem] md:leading-[1.1]">
            Hire With Confidence. Stay in Control.
          </h2>
          <p className="text-sm leading-7 text-muted-foreground md:text-base">
            Finding the right professional shouldn&apos;t involve guesswork.
            Explore local businesses, compare estimates, and make informed
            decisions about your home.
          </p>
        </div>

        <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {POINTS.map(({ icon: Icon, title, body }) => (
            <li
              key={title}
              className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-background p-5 transition-[transform,box-shadow] duration-300 hover:-translate-y-1 hover:shadow-[0_16px_40px_-24px_rgba(0,63,125,0.4)]"
            >
              <span className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Icon className="size-5" aria-hidden="true" />
              </span>
              <h3 className="text-base font-semibold tracking-tight">
                {title}
              </h3>
              <p className="text-sm leading-6 text-muted-foreground">{body}</p>
            </li>
          ))}
        </ul>
      </Container>
    </Section>
  );
}
