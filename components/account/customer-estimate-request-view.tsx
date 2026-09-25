"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { QuoteGuide } from "@/components/marketplace/quote-hero";
import { RequestIntake } from "@/components/marketplace/request-intake";
import { PortalPage } from "@/components/portal/portal-page";
import { Button } from "@/components/ui/button";
import { createQuoteFromIntake } from "@/lib/booking/create-marketplace-quote";
import { writePendingQuote } from "@/lib/booking/format-quote-answers";
import type { IntakeAnswers } from "@/lib/data/intake";
import { customerPaths } from "@/lib/customer-paths";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { selectAuthUser } from "@/store/authSlice";
import {
  fetchCustomerQuoteRequests,
  fetchCustomerEstimates,
} from "@/store/customerQuotesSlice";

/**
 * Same Get a Quote questionnaire + guide, hosted in the customer dashboard.
 * Submits through the existing public quote-requests API (multi-pro fan-out).
 */
export function CustomerEstimateRequestView() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const user = useAppSelector(selectAuthUser);
  const [submitting, setSubmitting] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const name = [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim();
    const email = String(user?.email || "").trim();
    const phone = String(user?.phone || "").trim();
    if (name || email || phone) {
      writePendingQuote({
        name: name || undefined,
        email: email || undefined,
        phone: phone || undefined,
      } as IntakeAnswers);
    }
    setReady(true);
  }, [user?.email, user?.firstName, user?.lastName, user?.phone]);

  async function handleComplete(answers: IntakeAnswers) {
    if (submitting) return;
    const lat = Number(answers.lat);
    const lng = Number(answers.lng);
    const hasCoords = Number.isFinite(lat) && Number.isFinite(lng);
    const zip = String(answers.zip || "").trim();
    if (!answers.street?.trim() || (!hasCoords && !/^\d{5}$/.test(zip))) {
      toast.error("Select a complete service address before sending.");
      return;
    }
    setSubmitting(true);
    try {
      const prefilled: IntakeAnswers = {
        ...answers,
        zip,
        name:
          answers.name?.trim() ||
          [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim() ||
          answers.name,
        email: answers.email?.trim() || String(user?.email || "").trim(),
        phone: answers.phone?.trim() || String(user?.phone || "").trim(),
      };
      const result = await createQuoteFromIntake(prefilled);
      const count = result.count || result.requests?.length || 0;
      toast.success(
        count > 1
          ? `Request sent to ${count} matching professionals.`
          : result.message || "Request sent to the professional.",
      );
      void dispatch(fetchCustomerQuoteRequests());
      void dispatch(fetchCustomerEstimates());
      router.push(customerPaths.estimateRequests);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not send your request.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <PortalPage
      eyebrow="Estimates"
      title="Request new estimate"
      description="Same questions as Get a Quote on the website. Matching professionals receive your answers as a lead."
      actions={
        <Button asChild variant="outline" size="sm">
          <Link href={customerPaths.estimates}>Back to estimates</Link>
        </Button>
      }
    >
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(18rem,22rem)] xl:gap-8">
        <div className="min-w-0 rounded-[4px] border border-input bg-card p-4 sm:p-6">
          {submitting ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              Sending your request to matching professionals…
            </p>
          ) : ready ? (
            <RequestIntake onComplete={handleComplete} />
          ) : (
            <p className="py-10 text-center text-sm text-muted-foreground">
              Loading questionnaire…
            </p>
          )}
        </div>
        <div className="min-w-0 w-full">
          <QuoteGuide />
        </div>
      </div>
    </PortalPage>
  );
}
