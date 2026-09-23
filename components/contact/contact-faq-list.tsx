"use client";

import { useEffect } from "react";
import { FaqList } from "@/components/shared/faq-list";
import { FaqCardsSkeleton } from "@/components/shared/loading-skeletons";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  fetchCustomerFaqs,
  selectCustomerFaqs,
  selectCustomerFaqsLoading,
} from "@/store/customerFaqsSlice";

export function ContactFaqList() {
  const dispatch = useAppDispatch();
  const items = useAppSelector(selectCustomerFaqs);
  const loading = useAppSelector(selectCustomerFaqsLoading);

  useEffect(() => {
    void dispatch(fetchCustomerFaqs());
  }, [dispatch]);

  if (loading && items.length === 0) {
    return <FaqCardsSkeleton count={4} />;
  }

  if (!items.length) return null;

  return <FaqList items={items} variant="cards" />;
}
