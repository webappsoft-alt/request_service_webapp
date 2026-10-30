import Link from "next/link";
import { MapPin } from "lucide-react";
import { Container, Section } from "@/components/layout/container";
import { Breadcrumbs, type BreadcrumbItem } from "@/components/seo/breadcrumbs";
import type { PublicProfessionalSeoData } from "@/lib/data/public-professional-seo";
import { serviceIcons } from "@/lib/icons";
import { publicPaths } from "@/lib/public-paths";
import type { ServiceCategory } from "@/lib/types";

/** Breadcrumbs + H1 + intro for every directory landing page. */
export function LocationHeader({
  breadcrumbs,
  eyebrow,
  title,
  description,
}: {
  breadcrumbs: BreadcrumbItem[];
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <section className="pt-6 pb-4 md:pt-7">
      <Container className="flex flex-col gap-6">
        <Breadcrumbs items={breadcrumbs} />
        <div className="flex max-w-3xl flex-col gap-3">
          <p className="eyebrow text-muted-foreground">{eyebrow}</p>
          <h1 className="text-3xl font-semibold text-balance md:text-5xl">{title}</h1>
          <p className="text-base leading-7 text-pretty text-muted-foreground md:text-lg">{description}</p>
        </div>
      </Container>
    </section>
  );
}

export type LinkItem = { label: string; href: string; hint?: string };

/** A titled wrap of pill links (cities, jobs, related searches). */
export function LinkChips({
  eyebrow,
  title,
  items,
}: {
  eyebrow: string;
  title: string;
  items: LinkItem[];
}) {
  if (!items.length) return null;
  return (
    <Section density="tight">
      <Container className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <p className="eyebrow text-muted-foreground">{eyebrow}</p>
          <h2 className="text-2xl font-semibold md:text-3xl">{title}</h2>
        </div>
        <ul className="flex flex-wrap gap-2">
          {items.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                className="inline-flex rounded-lg border border-input bg-card px-3.5 py-2 text-sm font-medium transition-colors hover:border-primary/40 hover:bg-muted"
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </Container>
    </Section>
  );
}

/** Category cards (icon + name) pointing at `hrefFor(category)`. */
export function CategoryLinkGrid({
  eyebrow,
  title,
  categories,
  hrefFor,
  labelFor = (category) => category.name,
}: {
  eyebrow: string;
  title: string;
  categories: ServiceCategory[];
  hrefFor: (category: ServiceCategory) => string;
  labelFor?: (category: ServiceCategory) => string;
}) {
  return (
    <Section density="tight">
      <Container className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <p className="eyebrow text-muted-foreground">{eyebrow}</p>
          <h2 className="text-2xl font-semibold md:text-3xl">{title}</h2>
        </div>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {categories.map((category) => {
            const Icon = serviceIcons[category.slug];
            return (
              <li key={category.id}>
                <Link
                  href={hrefFor(category)}
                  className="flex items-center gap-3 rounded-xl border border-input bg-card px-3.5 py-3 transition-colors hover:border-primary/40 hover:bg-muted"
                >
                  <span className="flex size-10 shrink-0 items-center justify-center">
                    <Icon className="size-5 text-primary" aria-hidden="true" />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold">{labelFor(category)}</span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </Container>
    </Section>
  );
}

/** Server-rendered links to live Pro profiles in the area (crawlable; the directory below is client-side). */
export function LiveProsList({ title, pros }: { title: string; pros: PublicProfessionalSeoData[] }) {
  if (!pros.length) return null;
  return (
    <Section density="tight">
      <Container className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <p className="eyebrow text-muted-foreground">Local professionals</p>
          <h2 className="text-2xl font-semibold md:text-3xl">{title}</h2>
        </div>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {pros.map((pro) => (
            <li key={pro.slug}>
              <Link
                href={publicPaths.professional(pro.slug)}
                className="flex h-full flex-col gap-1 rounded-xl border border-input bg-card px-4 py-3 transition-colors hover:border-primary/40 hover:bg-muted"
              >
                <span className="truncate text-sm font-semibold">{pro.companyName}</span>
                {pro.city || pro.state ? (
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <MapPin className="size-3.5" aria-hidden="true" />
                    {[pro.city, pro.state].filter(Boolean).join(", ")}
                  </span>
                ) : null}
                {pro.categoryNames.length ? (
                  <span className="truncate text-xs text-muted-foreground">{pro.categoryNames.join(" · ")}</span>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      </Container>
    </Section>
  );
}
