"use client";

import { useState } from "react";
import { toast } from "sonner";
import { CategoryExplorer } from "@/components/marketplace/category-explorer";
import { QuoteGuide, QuoteHero } from "@/components/marketplace/quote-hero";
import { RequestIntake } from "@/components/marketplace/request-intake";
import { createQuoteFromIntake } from "@/lib/booking/create-marketplace-quote";
import { getIntakeEstimate, type IntakeAnswers } from "@/lib/data/intake";
import type { Provider, ServiceCategory } from "@/lib/types";

export function ProfessionalMarketplace({
  category,
  zip,
  location,
  job = "",
  ask = false,
  eyebrow = "Find a professional",
  plain = false,
  providers = [],
  liveProfessionals = false,
}: {
  category?: ServiceCategory;
  zip?: string;
  location?: string;
  job?: string;
  ask?: boolean;
  eyebrow?: string;
  plain?: boolean;
  providers?: Provider[];
  /** Enable GET /api/public/professionals (Find a Professional). */
  liveProfessionals?: boolean;
}) {
  const [answers, setAnswers] = useState<IntakeAnswers | null>(null);
  const [asking, setAsking] = useState(ask);
  const [sent, setSent] = useState<{ number: string; count: number } | null>(null);
  const estimate = answers ? getIntakeEstimate(answers) : undefined;
  const matchedCategory = estimate?.category ?? category;

  if (asking) {
    return (
      <>
        {plain ? <QuoteHero categoryName={category?.name} /> : null}
        <section
          className={
            plain
              ? "bg-[#f5f5f5] py-6 md:py-8"
              : "relative isolate min-h-[calc(100dvh-4.25rem)] overflow-y-auto"
          }
        >
          {plain ? null : (
            <>
              <div
                className="page-wash pointer-events-none absolute inset-0 -z-10"
                aria-hidden="true"
              />
              <div
                className="hero-grid pointer-events-none absolute inset-0 -z-10"
                aria-hidden="true"
              />
            </>
          )}
          <div
            className={
              plain
                ? "container-site grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_19rem] lg:gap-7"
                : "container-site flex min-h-[calc(100dvh-4.25rem)] items-center py-8"
            }
          >
            <div
              className={
                plain
                  ? "w-full rounded-xl border bg-card p-5 shadow-sm sm:p-7"
                  : "mx-auto w-full max-w-2xl rounded-2xl border bg-card p-5 shadow-sm sm:p-7"
              }
            >
              {plain ? null : (
                <p className="eyebrow text-muted-foreground">{eyebrow}</p>
              )}
              <RequestIntake
                onComplete={(next) => {
                  const result = createQuoteFromIntake(next);
                  setAnswers(next);
                  setAsking(false);
                  if (!result.requests.length) {
                    toast.error("Add a ZIP we can match, then send the request again.");
                    setAsking(true);
                    return;
                  }
                  setSent({ number: result.requests[0]?.number ?? "", count: result.requests.length });
                  toast.success(
                    `${result.requests[0]?.number} is in ${result.requests.length} matching ${result.requests.length === 1 ? "inbox" : "inboxes"}. They can send a written estimate.`,
                  );
                }}
              />
            </div>
            {plain ? <QuoteGuide /> : null}
          </div>
        </section>
      </>
    );
  }

  return (
    <CategoryExplorer
      marketplace
      liveProfessionals={liveProfessionals}
      category={matchedCategory}
      providers={providers}
      initialAddress={answers?.zip || location || zip}
      initialJob={job}
      match={
        estimate
          ? {
              job: estimate.job ?? estimate.category.name,
              zip: answers?.zip,
              low: estimate.low,
              high: estimate.high,
              sent,
              onEdit: () => setAsking(true),
            }
          : undefined
      }
    />
  );
}
