"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CategoryExplorer } from "@/components/marketplace/category-explorer";
import { QuoteGuide, QuoteHero } from "@/components/marketplace/quote-hero";
import { RequestIntake } from "@/components/marketplace/request-intake";
import { createQuoteFromIntake } from "@/lib/booking/create-marketplace-quote";
import { customerPaths } from "@/lib/customer-paths";
import { getIntakeEstimate, type IntakeAnswers } from "@/lib/data/intake";
import type { Provider, ServiceCategory } from "@/lib/types";
import { useAppSelector } from "@/store/hooks";
import { selectAuthUser, selectIsAuthenticated } from "@/store/authSlice";

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
  const router = useRouter();
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  const authUser = useAppSelector(selectAuthUser);
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
                ? "container-site grid items-start gap-6 lg:grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(18rem,22rem)] xl:gap-8"
                : "container-site flex min-h-[calc(100dvh-4.25rem)] items-center py-8"
            }
          >
            <div
              className={
                plain
                  ? "w-full min-w-0 rounded-xl border bg-card p-5 shadow-sm sm:p-7"
                  : "mx-auto w-full max-w-2xl rounded-2xl border bg-card p-5 shadow-sm sm:p-7"
              }
            >
              {plain ? null : (
                <p className="eyebrow text-muted-foreground">{eyebrow}</p>
              )}
              <RequestIntake
                onComplete={async (next) => {
                  setAnswers(next);
                  try {
                    const result = await createQuoteFromIntake(next);
                    if (!result.requests.length) {
                      toast.error(
                        "No matching professionals found near that address. Try another location.",
                      );
                      throw new Error("No matching professionals found.");
                    }
                    const requestNumber =
                      result.requestNumber || result.requests[0]?.number || "";
                    const providerCount = result.count || result.requests.length;
                    setSent({ number: requestNumber, count: providerCount });
                    setAnswers(null);
                    toast.success(
                      `${requestNumber} sent to ${providerCount} matching ${providerCount === 1 ? "professional" : "professionals"}.`,
                    );
                    const estimatesHref = customerPaths.estimateRequests;
                    const role = String(authUser?.role || "").toLowerCase();
                    const isCustomer =
                      role === "customer" ||
                      role === "consumer" ||
                      role === "user";
                    if (isAuthenticated && isCustomer) {
                      router.push(estimatesHref);
                      return;
                    }
                    router.push(
                      `/login?next=${encodeURIComponent(estimatesHref)}`,
                    );
                  } catch (error) {
                    toast.error(
                      error instanceof Error
                        ? error.message
                        : "Unable to send the quote request.",
                    );
                    throw error;
                  }
                }}
              />
            </div>
            {plain ? (
              <div className="min-w-0 w-full xl:max-w-[22rem]">
                <QuoteGuide />
              </div>
            ) : null}
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
      initialAddress={
        [location, answers?.zip || zip].filter(Boolean).join(", ") ||
        answers?.zip ||
        zip ||
        location ||
        ""
      }
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
