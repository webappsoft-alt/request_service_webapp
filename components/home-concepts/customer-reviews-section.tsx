import Link from "next/link";
import { ArrowRight, BadgeCheck, Quote, Star } from "lucide-react";
import { Container, Section } from "@/components/layout/container";
import { cn } from "@/lib/utils";
import { ReviewsCarousel } from "./reviews-carousel";

type Review = {
  name: string;
  meta: string;
  service: string;
  rating: number;
  quote: string;
  audience: "homeowner" | "pro";
};

/**
 * Sample reviews: the site has no public review feed yet, so these are labelled as samples
 * (see /about and /terms). Swap in live reviews from completed jobs when they exist.
 */
const REVIEWS: Review[] = [
  {
    name: "Lauren C.",
    meta: "Homeowner · Austin, TX",
    service: "Plumbing",
    rating: 5,
    quote:
      "I sent photos of the leak and had a written estimate I could actually understand before anyone came out.",
    audience: "homeowner",
  },
  {
    name: "Marcus T.",
    meta: "Homeowner · Boston, MA",
    service: "Electrical",
    rating: 5,
    quote:
      "Booking from the company profile felt more professional than calling around. Scope and timing were in writing.",
    audience: "homeowner",
  },
  {
    name: "Diana H.",
    meta: "Owner · Electrical contractor",
    service: "Electrical",
    rating: 5,
    quote:
      "Request to estimate to job is how we already try to work on paper. Seeing it in one place is why we signed up.",
    audience: "pro",
  },
  {
    name: "Priya K.",
    meta: "Homeowner · Denver, CO",
    service: "HVAC",
    rating: 5,
    quote:
      "Three local pros looked at my request overnight. I compared the estimates side by side and picked one by lunch.",
    audience: "homeowner",
  },
  {
    name: "Daniel R.",
    meta: "Homeowner · Aurora, IL",
    service: "Water heater",
    rating: 4,
    quote:
      "The install took a day longer than planned, but every update and the final invoice were right there in the project file.",
    audience: "homeowner",
  },
  {
    name: "Chris N.",
    meta: "Operations manager · Home systems",
    service: "HVAC",
    rating: 5,
    quote:
      "Change orders stay attached to the original estimate. That is the difference between a clean job and an argument.",
    audience: "pro",
  },
  {
    name: "Sarah M.",
    meta: "Homeowner · Tampa, FL",
    service: "Roofing",
    rating: 5,
    quote:
      "A stressful storm repair turned into a checklist. I always knew who was coming, when, and what it would cost.",
    audience: "homeowner",
  },
  {
    name: "Owen B.",
    meta: "Homeowner · Portland, OR",
    service: "Painting",
    rating: 5,
    quote:
      "Signing the estimate on my phone and paying the invoice in the same place made the whole thing painless.",
    audience: "homeowner",
  },
];

/** Stars with a partially filled last star, so 4.9 reads as 4.9. */
function Stars({ value, className }: { value: number; className?: string }) {
  return (
    <span
      className={cn("flex gap-0.5", className)}
      role="img"
      aria-label={`${value.toFixed(1)} out of 5 stars`}
    >
      {Array.from({ length: 5 }).map((_, index) => {
        const fill = Math.max(0, Math.min(1, value - index));
        return (
          <span key={index} className="relative size-[1em]" aria-hidden="true">
            <Star className="absolute inset-0 size-full text-slate-200 dark:text-white/15" />
            <span
              className="absolute inset-0 overflow-hidden"
              style={{ width: `${fill * 100}%` }}
            >
              <Star className="size-[1em] fill-amber-400 text-amber-400" />
            </span>
          </span>
        );
      })}
    </span>
  );
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function ReviewCard({ review }: { review: Review }) {
  const pro = review.audience === "pro";
  return (
    <figure className="group relative flex w-full flex-col gap-5 overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_12px_32px_-20px_rgba(0,63,125,0.25)] transition-all duration-300 hover:-translate-y-1 hover:border-primary/20 hover:shadow-[0_1px_2px_rgba(15,23,42,0.04),0_24px_48px_-24px_rgba(0,63,125,0.35)] dark:border-border dark:bg-card">
      <div className="flex items-center justify-between gap-3">
        <span className="flex size-10 items-center justify-center rounded-xl bg-primary/[0.07] text-primary">
          <Quote className="size-4.5 fill-current" aria-hidden="true" />
        </span>
        <Stars value={review.rating} className="text-sm" />
      </div>
      <blockquote className="relative flex-1 text-[0.95rem] leading-7 text-slate-700 dark:text-foreground/85">
        {review.quote}
      </blockquote>
      <figcaption className="relative flex items-center gap-3 border-t border-slate-100 pt-5 dark:border-border">
        <span
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white shadow-sm ring-2 ring-white dark:ring-card",
            pro
              ? "bg-linear-to-br from-emerald-500 to-teal-600"
              : "bg-linear-to-br from-sky-500 to-primary",
          )}
          aria-hidden="true"
        >
          {initials(review.name)}
        </span>
        <span className="min-w-0 flex-1 leading-tight">
          <span className="flex items-center gap-1 text-sm font-semibold text-slate-900 dark:text-foreground">
            <span className="truncate">{review.name}</span>
            <BadgeCheck
              className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400"
              aria-label={pro ? "Verified pro" : "Verified job"}
            />
          </span>
          <span className="mt-0.5 block text-xs leading-snug text-slate-500 dark:text-muted-foreground">
            {review.meta} · {review.service}
          </span>
        </span>
      </figcaption>
    </figure>
  );
}

/**
 * Customer reviews: heading with arrows on the right, over a manual snap carousel with dots
 * (3 cards per view on desktop, 2 on tablet, 1 on mobile).
 */
export function CustomerReviewsSection() {
  return (
    <Section
      density="tight"
      className="relative isolate overflow-hidden bg-slate-50 text-slate-900 dark:bg-muted/30 dark:text-foreground"
    >
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-[radial-gradient(48rem_20rem_at_0%_0%,rgba(0,63,125,0.07),transparent_60%),radial-gradient(40rem_20rem_at_100%_100%,rgba(56,189,248,0.08),transparent_60%)]"
      />
      <Container>
        <ReviewsCarousel
          label="Customer reviews"
          header={
            <div className="flex flex-col gap-2">
              <p className="eyebrow text-primary">Customer reviews</p>
              <h2 className="text-balance text-2xl font-semibold tracking-tight md:text-3xl">
                Loved by homeowners. Trusted by local pros.
              </h2>
              <Link
                href="/find-a-professional"
                className="inline-flex w-fit items-center gap-1 text-sm font-medium text-primary hover:underline"
              >
                Find a reviewed pro
                <ArrowRight className="size-3.5" aria-hidden="true" />
              </Link>
            </div>
          }
          slides={REVIEWS.map((review) => (
            <ReviewCard key={review.name} review={review} />
          ))}
        />
      </Container>
    </Section>
  );
}
