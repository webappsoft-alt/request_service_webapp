"use client";

import { useEffect } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { FaqList } from "@/components/shared/faq-list";
import { FaqCardsSkeleton } from "@/components/shared/loading-skeletons";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  fetchCustomerFaqs,
  selectCustomerFaqs,
  selectCustomerFaqsLoading,
} from "@/store/customerFaqsSlice";

/** Customer FAQ block for service/job detail pages (after How it works). */
export function JobDetailFaqSection() {
  const dispatch = useAppDispatch();
  const items = useAppSelector(selectCustomerFaqs);
  const loading = useAppSelector(selectCustomerFaqsLoading);

  useEffect(() => {
    void dispatch(fetchCustomerFaqs());
  }, [dispatch]);

  if (!loading && items.length === 0) return null;

  return (
    <div className="flex flex-col gap-4 border-t pt-8">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1.5">
          <p className="eyebrow text-primary">FAQ</p>
          <h2 className="text-xl font-semibold">Questions before you request</h2>
          <p className="max-w-xl text-sm leading-6 text-muted-foreground">
            Matching, estimates, and what happens after you hire.
          </p>
        </div>
        <Link
          href="/faq"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-brand transition-colors hover:text-foreground"
        >
          See all questions
          <ArrowRight className="size-3.5" aria-hidden="true" />
        </Link>
      </div>
      {loading && items.length === 0 ? (
        <FaqCardsSkeleton count={4} />
      ) : (
        <FaqList items={items} variant="cards" />
      )}
    </div>
  );
}
