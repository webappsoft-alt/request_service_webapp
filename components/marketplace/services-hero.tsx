"use client";

import { Container } from "@/components/layout/container";
import { ServiceSearchForm } from "@/components/shared/service-search-form";
import type { SearchIntent } from "@/lib/search";

type ServicesHeroProps = {
  query: string;
  onSearch: (intent: SearchIntent) => void;
};

export function ServicesHero({ query, onSearch }: ServicesHeroProps) {
  return (
    <section className="bg-[#f5f5f5]">
      <Container className="pt-4 pb-1 md:pt-5">
        <div className="grid items-center gap-3 rounded-xl border bg-card px-4 py-3 shadow-sm sm:px-5 lg:grid-cols-[auto_minmax(0,48rem)_1fr] lg:gap-4">
          <div className="min-w-0 max-w-56 text-left">
            <p className="text-xs font-semibold tracking-[0.14em] text-primary uppercase">
              Directory
            </p>
            <p className="mt-1 text-base font-semibold tracking-tight">
              Find a licensed local pro
            </p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Search a service and city or ZIP.
            </p>
          </div>
          <div className="relative z-20 w-full max-w-[47rem] justify-self-center">
            <ServiceSearchForm defaultCategory={query} onSearch={onSearch} />
          </div>
          <div className="hidden lg:block" aria-hidden="true" />
        </div>
      </Container>
    </section>
  );
}
