import Link from "next/link";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export function SectionHeader({
  eyebrow,
  title,
  description,
  align = "left",
  inverse = false,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  align?: "left" | "center";
  inverse?: boolean;
  action?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-4",
        align === "center" && "mx-auto max-w-2xl items-center text-center",
        action && "lg:flex-row lg:items-end lg:justify-between lg:text-left"
      )}
    >
      <div className={cn("flex max-w-2xl flex-col gap-3", align === "center" && !action && "items-center")}>
        {eyebrow ? (
          <p
            className={cn(
              "text-xs font-medium tracking-[0.14em] uppercase",
              inverse ? "text-primary-foreground/70" : "text-muted-foreground"
            )}
          >
            {eyebrow}
          </p>
        ) : null}
        <h2
          className={cn(
            "text-3xl font-semibold md:text-[2.5rem]",
            inverse ? "text-primary-foreground" : "text-foreground"
          )}
        >
          {title}
        </h2>
        {description ? (
          <p
            className={cn(
              "max-w-xl text-base leading-7 text-pretty",
              inverse ? "text-primary-foreground/75" : "text-muted-foreground",
              align === "center" && "mx-auto"
            )}
          >
            {description}
          </p>
        ) : null}
      </div>
      {action}
    </div>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  breadcrumbs,
  actions,
  highlights,
  aside,
  compact = false,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  breadcrumbs?: { label: string; href?: string }[];
  actions?: React.ReactNode;
  highlights?: string[];
  aside?: React.ReactNode;
  compact?: boolean;
}) {
  return (
    <section className="relative isolate overflow-hidden border-b">
      <div className="page-wash pointer-events-none absolute inset-0 -z-10" aria-hidden="true" />
      <div className="hero-grid pointer-events-none absolute inset-0 -z-10" aria-hidden="true" />

      <div
        className={cn(
          "container-site enter-stagger flex flex-col",
          compact ? "gap-4 py-8 md:py-10" : "gap-6 py-14 md:py-18"
        )}
      >
        {breadcrumbs?.length ? (
          <nav aria-label="Breadcrumb">
            <ol className="flex flex-wrap items-center gap-2 text-sm">
              {breadcrumbs.map((item, index) => {
                const isCurrent = !item.href || index === breadcrumbs.length - 1;
                return (
                  <li key={`${item.label}-${index}`} className="inline-flex items-center gap-2">
                    {item.href && !isCurrent ? (
                      <Link
                        href={item.href}
                        className="text-muted-foreground transition-colors hover:text-primary"
                      >
                        {item.label}
                      </Link>
                    ) : (
                      <span className="font-medium text-foreground" aria-current="page">
                        {item.label}
                      </span>
                    )}
                    {index < breadcrumbs.length - 1 ? (
                      <span className="text-muted-foreground/70" aria-hidden="true">
                        /
                      </span>
                    ) : null}
                  </li>
                );
              })}
            </ol>
          </nav>
        ) : null}

        <div
          className={cn(
            aside &&
              "grid items-center gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(16rem,22rem)] lg:gap-10"
          )}
        >
          <div className={cn("flex flex-col", compact ? "gap-4" : "gap-6")}>
            <div className="flex max-w-3xl flex-col gap-2.5">
              {eyebrow ? <p className="eyebrow text-muted-foreground">{eyebrow}</p> : null}
              <h1 className={compact ? "text-3xl md:text-4xl" : "text-4xl md:text-5xl"}>{title}</h1>
              {description ? (
                <p
                  className={cn(
                    "max-w-2xl text-muted-foreground text-pretty",
                    compact ? "text-sm leading-6 md:text-base" : "text-base leading-7 md:text-lg"
                  )}
                >
                  {description}
                </p>
              ) : null}
            </div>

            {actions ? (
              <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
                {actions}
              </div>
            ) : null}

            {highlights?.length ? (
              <ul className="flex flex-wrap items-center gap-x-5 gap-y-2">
                {highlights.map((item) => (
                  <li key={item} className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Check className="size-4 shrink-0 text-primary" aria-hidden="true" />
                    {item}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          {aside}
        </div>
      </div>
    </section>
  );
}
