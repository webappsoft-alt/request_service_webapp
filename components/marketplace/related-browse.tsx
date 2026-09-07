import Link from "next/link";
import { Container, Section } from "@/components/layout/container";
import { getRelatedJobs, slugifyJob } from "@/lib/data/jobs";
import { getLocalKeywordItems, resolveKeywordPlace } from "@/lib/data/local-keywords";
import { getExplorePlaceLabel } from "@/lib/data/markets";
import { directoryHref, getRelatedCategories } from "@/lib/data/related-categories";
import { serviceIcons } from "@/lib/icons";
import type { ServiceCategory } from "@/lib/types";

export function RelatedBrowse({
  category,
  currentJob,
  basePath,
  zip,
  loc,
}: {
  category?: ServiceCategory;
  currentJob?: string;
  basePath: "/services" | "/find-a-professional";
  zip?: string;
  loc?: string;
}) {
  const relatedCategories = getRelatedCategories(category?.slug);
  const relatedJobs = category ? getRelatedJobs(category, currentJob ?? "", 6) : [];
  const localLinks = getLocalKeywordItems({
    category,
    job: currentJob,
    zip,
    loc,
    basePath,
  });
  const placeLabel = getExplorePlaceLabel(resolveKeywordPlace({ zip, loc }));

  function hrefFor(service: string, job?: string) {
    return directoryHref(basePath, { service, job, zip, loc });
  }

  return (
    <Section density="tight">
      <Container className="flex flex-col gap-8">
        {localLinks.length ? (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <p className="eyebrow text-muted-foreground">People also search</p>
              <h2 className="text-2xl font-semibold md:text-3xl">
                {category
                  ? `${category.name} near ${placeLabel}`
                  : `Home services near ${placeLabel}`}
              </h2>
            </div>
            <ul data-stagger className="flex flex-wrap gap-2">
              {localLinks.map((item) => (
                <li key={item.label}>
                  <Link
                    href={item.href}
                    className="inline-flex rounded-lg border border-input bg-card px-3.5 py-2 text-sm font-medium capitalize transition-colors hover:border-primary/40 hover:bg-muted"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {relatedJobs.length ? (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <p className="eyebrow text-muted-foreground">Narrow the job</p>
              <h2 className="text-2xl font-semibold md:text-3xl">
                Related {category?.shortName} jobs
              </h2>
            </div>
            <ul data-stagger className="flex flex-wrap gap-2">
              {relatedJobs.map((job) => (
                <li key={job}>
                  <Link
                    href={hrefFor(category?.slug ?? "", slugifyJob(job))}
                    className="inline-flex rounded-lg border border-input bg-card px-3.5 py-2 text-sm font-medium transition-colors hover:border-primary/40 hover:bg-muted"
                  >
                    {job}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <p className="eyebrow text-muted-foreground">
              {category ? "Also in demand" : "Browse by trade"}
            </p>
            <h2 className="text-2xl font-semibold md:text-3xl">
              {category ? `Related to ${category.name}` : "Related categories"}
            </h2>
          </div>
          <ul data-stagger className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {relatedCategories.map((item) => {
              const Icon = serviceIcons[item.slug];
              return (
                <li key={item.id}>
                  <Link
                    href={hrefFor(item.slug)}
                    className="flex items-center gap-3 rounded-xl border border-input bg-card px-3.5 py-3 transition-colors hover:border-primary/40 hover:bg-muted"
                  >
                    <span className="flex size-10 shrink-0 items-center justify-center">
                      <Icon className="size-5 text-primary" aria-hidden="true" />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold">{item.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {item.tagline}
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </Container>
    </Section>
  );
}
