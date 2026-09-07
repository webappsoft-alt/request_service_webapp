import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/layout/container";
import { Section } from "@/components/layout/container";
import { cn } from "@/lib/utils";

export function CtaBanner({
  eyebrow,
  title,
  description,
  primary,
  secondary,
  tone = "inverse",
  density = "default",
  embedded = false,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  primary: { href: string; label: string };
  secondary?: { href: string; label: string };
  tone?: "inverse" | "muted";
  density?: "default" | "tight";
  embedded?: boolean;
}) {
  const inverted = tone === "inverse";
  const innerClassName = cn(
    "flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between",
    inverted && "text-primary-foreground"
  );

  const body = (
      <div className={innerClassName}>
        <div className="flex max-w-2xl flex-col gap-3">
          {eyebrow ? (
            <p
              className={cn(
                "text-xs font-medium tracking-[0.14em] uppercase",
                inverted ? "text-primary-foreground/70" : "text-muted-foreground"
              )}
            >
              {eyebrow}
            </p>
          ) : null}
          <h2 className="text-3xl md:text-4xl">
            {title}
          </h2>
          <p
            className={cn(
              "max-w-xl text-base leading-7",
              inverted ? "text-primary-foreground/75" : "text-muted-foreground"
            )}
          >
            {description}
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button
            size="xl"
            variant={inverted ? "secondary" : "default"}
            asChild
          >
            <Link href={primary.href}>{primary.label}</Link>
          </Button>
          {secondary ? (
            <Button
              size="xl"
              variant="outline"
              className={
                inverted
                  ? "border-primary-foreground/20 bg-transparent text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"
                  : undefined
              }
              asChild
            >
              <Link href={secondary.href}>{secondary.label}</Link>
            </Button>
          ) : null}
        </div>
      </div>
  );

  if (embedded) {
    return (
      <div
        className={cn(
          "relative px-5 sm:px-8 md:px-10 lg:px-14",
          density === "tight" ? "section-space-tight" : "section-space"
        )}
      >
        {body}
      </div>
    );
  }

  return (
    <Section tone={tone === "inverse" ? "inverse" : "muted"} density={density}>
      <Container>{body}</Container>
    </Section>
  );
}
