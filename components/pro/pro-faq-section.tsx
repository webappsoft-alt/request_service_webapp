"use client";

import { useEffect } from "react";
import { Container, Section } from "@/components/layout/container";
import { FaqList } from "@/components/shared/faq-list";
import { FaqCardsSkeleton } from "@/components/shared/loading-skeletons";
import { JsonLd } from "@/components/seo/json-ld";
import { faqJsonLd } from "@/lib/json-ld";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  fetchProviderFaqs,
  selectProviderFaqs,
  selectProviderFaqsLoading,
} from "@/store/providerFaqsSlice";

export function ProFaqSection() {
  const dispatch = useAppDispatch();
  const items = useAppSelector(selectProviderFaqs);
  const loading = useAppSelector(selectProviderFaqsLoading);

  useEffect(() => {
    void dispatch(fetchProviderFaqs());
  }, [dispatch]);

  if (!loading && items.length === 0) return null;

  return (
    <Section id="faq" density="tight">
      {items.length > 0 ? <JsonLd data={faqJsonLd(items)} /> : null}
      <Container className="grid items-start gap-12 lg:grid-cols-[minmax(0,21rem)_minmax(0,1fr)] lg:gap-20">
        <div className="flex flex-col gap-5 lg:sticky lg:top-28">
          <p className="eyebrow text-primary">FAQ</p>
          <h2 className="text-3xl font-semibold tracking-tight md:text-[2.5rem]">
            Questions from the office
          </h2>
          <p className="max-w-sm text-sm leading-7 text-muted-foreground">
            Short answers on accounts, subscriptions, and how work reaches your
            portal.
          </p>
        </div>
        {loading && items.length === 0 ? (
          <FaqCardsSkeleton count={6} />
        ) : (
          <FaqList items={items} variant="cards" />
        )}
      </Container>
    </Section>
  );
}
