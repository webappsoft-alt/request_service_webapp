import Link from "next/link";
import { FileCheck2, MapPin, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Container, Section } from "@/components/layout/container";

const reasons = [
  {
    icon: FileCheck2,
    title: "Written estimate first",
    body: "You see the scope and the number before anyone starts. Approve it, or walk away.",
  },
  {
    icon: ShieldCheck,
    title: "Licensed local companies",
    body: "Profiles show license, insurance, and the ZIP codes they actually cover.",
  },
  {
    icon: MapPin,
    title: "One request, nearby matches",
    body: "Describe the job once. Compare the companies that serve your area.",
  },
];

export function WhyHireSection({
  ctaHref,
  ctaLabel,
}: {
  ctaHref: string;
  ctaLabel: string;
}) {
  return (
    <Section density="tight">
      <Container className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <p className="eyebrow text-muted-foreground">Why Request Services</p>
          <h2 className="max-w-2xl text-3xl font-semibold md:text-[2.5rem]">
            Why homeowners hire through here
          </h2>
          <p className="max-w-xl text-sm text-muted-foreground md:text-base">
            The listing is the start. The written estimate is what you decide on.
          </p>
        </div>

        <ul data-stagger className="grid gap-4 md:grid-cols-3">
          {reasons.map((reason) => (
            <li
              key={reason.title}
              className="flex flex-col gap-3 rounded-xl border border-foreground/15 bg-card p-5"
            >
              <span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <reason.icon className="size-5" aria-hidden="true" />
              </span>
              <h3 className="text-lg font-semibold">{reason.title}</h3>
              <p className="text-sm leading-6 text-muted-foreground">{reason.body}</p>
            </li>
          ))}
        </ul>

        <div>
          <Button size="lg" asChild>
            <Link href={ctaHref}>{ctaLabel}</Link>
          </Button>
        </div>
      </Container>
    </Section>
  );
}
