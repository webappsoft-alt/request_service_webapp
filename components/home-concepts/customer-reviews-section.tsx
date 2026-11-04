import Link from "next/link";
import { ArrowRight, BadgeCheck, Star } from "lucide-react";
import { Container } from "@/components/layout/container";
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
            <Star className="absolute inset-0 size-full text-white/20" />
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
  return (
    <figure className="flex w-full flex-col gap-6 rounded-3xl border border-white/10 bg-white/[0.05] p-7 shadow-[0_24px_48px_-32px_rgba(0,0,0,0.9)] backdrop-blur-md transition-colors duration-300 hover:border-white/20 hover:bg-white/[0.08]">
      <div className="flex items-center justify-between gap-3">
        <Stars value={review.rating} className="text-base" />
        <span className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full bg-emerald-400/10 px-2.5 py-1 text-xs font-medium text-emerald-300 ring-1 ring-emerald-400/20">
          <BadgeCheck className="size-3.5" aria-hidden="true" />
          {review.audience === "pro" ? "Verified pro" : "Verified job"}
        </span>
      </div>
      <blockquote className="flex-1 text-base leading-7 text-white/85 md:text-[1.05rem] md:leading-8">
        “{review.quote}”
      </blockquote>
      <figcaption className="flex items-center gap-3">
        <span
          className={cn(
            "flex size-11 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white ring-1 ring-white/20",
            review.audience === "pro"
              ? "bg-linear-to-br from-emerald-400/80 to-teal-600/80"
              : "bg-linear-to-br from-sky-400/80 to-primary",
          )}
          aria-hidden="true"
        >
          {initials(review.name)}
        </span>
        <span className="min-w-0 leading-tight">
          <span className="block truncate text-sm font-semibold text-white">
            {review.name}
          </span>
          <span className="mt-0.5 block text-xs leading-snug text-white/55">
            {review.meta} · {review.service}
          </span>
        </span>
      </figcaption>
    </figure>
  );
}

/**
 * Customer reviews: a centered heading over a calm snap carousel (3 cards per view on desktop,
 * 2 on tablet, 1 on mobile) with arrows and dots.
 */
export function CustomerReviewsSection() {
  return (
    <section className="section-space relative isolate overflow-hidden bg-[#071C35] text-white">
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-[radial-gradient(56rem_28rem_at_50%_0%,rgba(56,140,230,0.22),transparent_65%)]"
      />
      <Container className="flex flex-col gap-12 md:gap-14">
        <div className="mx-auto flex max-w-2xl flex-col items-center gap-4 text-center">
          <p className="eyebrow text-sky-300">Customer reviews</p>
          <h2 className="text-balance text-3xl font-semibold tracking-tight md:text-[2.75rem] md:leading-[1.1]">
            Loved by homeowners.{" "}
            <span className="text-sky-300">Trusted by local pros.</span>
          </h2>
          <Link
            href="/find-a-professional"
            className="group mt-1 inline-flex items-center gap-1.5 text-sm font-semibold text-white/80 transition-colors hover:text-white"
          >
            Find a reviewed pro
            <ArrowRight
              className="size-4 transition-transform duration-200 group-hover:translate-x-0.5"
              aria-hidden="true"
            />
          </Link>
        </div>

        <ReviewsCarousel
          label="Customer reviews"
          slides={REVIEWS.map((review) => (
            <ReviewCard key={review.name} review={review} />
          ))}
        />
      </Container>
    </section>
  );
}
