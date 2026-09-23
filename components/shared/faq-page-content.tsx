"use client";

import { useEffect } from "react";
import { Container } from "@/components/layout/container";
import { FaqList } from "@/components/shared/faq-list";
import {
  FaqListSkeleton,
} from "@/components/shared/loading-skeletons";
import { JsonLd } from "@/components/seo/json-ld";
import { faqJsonLd } from "@/lib/json-ld";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  fetchCustomerFaqs,
  selectCustomerFaqs,
  selectCustomerFaqsLoading,
} from "@/store/customerFaqsSlice";
import {
  fetchProviderFaqs,
  selectProviderFaqs,
  selectProviderFaqsLoading,
} from "@/store/providerFaqsSlice";

export function FaqPageContent() {
  const dispatch = useAppDispatch();
  const customerItems = useAppSelector(selectCustomerFaqs);
  const customerLoading = useAppSelector(selectCustomerFaqsLoading);
  const providerItems = useAppSelector(selectProviderFaqs);
  const providerLoading = useAppSelector(selectProviderFaqsLoading);

  useEffect(() => {
    void dispatch(fetchCustomerFaqs());
    void dispatch(fetchProviderFaqs());
  }, [dispatch]);

  const allItems = [...customerItems, ...providerItems];
  const showCustomer =
    customerLoading || customerItems.length > 0;
  const showProvider = providerLoading || providerItems.length > 0;

  return (
    <>
      {allItems.length > 0 ? <JsonLd data={faqJsonLd(allItems)} /> : null}
      <div className="section-space">
        <Container className="flex flex-col gap-12">
          {showCustomer ? (
            <section id="customers" className="flex flex-col gap-4">
              <h2 className="text-2xl">For customers</h2>
              {customerLoading && customerItems.length === 0 ? (
                <FaqListSkeleton count={6} />
              ) : (
                <FaqList items={customerItems} />
              )}
            </section>
          ) : null}

          {showProvider ? (
            <section id="providers" className="flex flex-col gap-4">
              <h2 className="text-2xl">For professionals</h2>
              {providerLoading && providerItems.length === 0 ? (
                <FaqListSkeleton count={6} />
              ) : (
                <FaqList items={providerItems} />
              )}
            </section>
          ) : null}

          {!showCustomer && !showProvider ? (
            <p className="text-sm text-muted-foreground">
              FAQ answers will appear here once they are published.
            </p>
          ) : null}
        </Container>
      </div>
    </>
  );
}
