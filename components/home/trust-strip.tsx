import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Container } from "@/components/layout/container";
import { serviceCategories } from "@/lib/data/services";
import { serviceAccents, serviceIcons } from "@/lib/icons";
import { cn } from "@/lib/utils";

const marqueeItems = [...serviceCategories, ...serviceCategories];

export function TrustStrip() {
  return (
    <div className="border-b bg-card">
      <Container className="flex flex-col gap-6 py-8 lg:flex-row lg:items-center lg:gap-12 lg:py-9">
        <div className="flex shrink-0 flex-col gap-3 lg:w-56">
          <p className="eyebrow text-muted-foreground">Built for the trades</p>
          <p className="text-lg font-semibold tracking-tight text-balance">
            Ten home-service trades, one marketplace
          </p>
          <Link
            href="/services"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-brand transition-colors hover:text-foreground"
          >
            View all services
            <ArrowRight className="size-3.5" aria-hidden="true" />
          </Link>
        </div>

        <div
          className="hidden h-16 w-px shrink-0 bg-border lg:block"
          aria-hidden="true"
        />

        <div className="marquee-mask group relative min-w-0 flex-1 overflow-hidden">
          <ul className="animate-marquee flex w-max items-center group-hover:[animation-play-state:paused]">
            {marqueeItems.map((category, index) => {
              const Icon = serviceIcons[category.slug];
              const isClone = index >= serviceCategories.length;

              return (
                <li
                  key={`${category.id}-${index}`}
                  className="flex items-center"
                  aria-hidden={isClone}
                >
                  <Link
                    href={`/services/${category.slug}`}
                    tabIndex={isClone ? -1 : undefined}
                    className="flex items-center gap-3 px-5 py-1 transition-opacity hover:opacity-80"
                  >
                    <span
                      className={cn(
                        "flex size-10 shrink-0 items-center justify-center rounded-xl",
                        serviceAccents[category.slug]
                      )}
                    >
                      <Icon className="size-5" aria-hidden="true" />
                    </span>
                    <span className="text-sm font-medium whitespace-nowrap">
                      {category.name}
                    </span>
                  </Link>
                  <span
                    className="h-8 w-px bg-border"
                    aria-hidden="true"
                  />
                </li>
              );
            })}
          </ul>
        </div>
      </Container>
    </div>
  );
}
