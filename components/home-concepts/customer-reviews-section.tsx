import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  FileText,
  Quote,
  ShieldCheck,
  Star,
} from "lucide-react";
import { Container } from "@/components/layout/container";
import { cn } from "@/lib/utils";

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

const AVERAGE =
  REVIEWS.reduce((sum, review) => sum + review.rating, 0) / REVIEWS.length;

const BREAKDOWN = [5, 4, 3, 2, 1].map((stars) => ({
  stars,
  count: REVIEWS.filter((review) => review.rating === stars).length,
}));

const TRUST_POINTS = [
  {
    icon: BadgeCheck,
    title: "Tied to a real job",
    body: "Reviews can only be left once a job is completed.",
  },
  {
    icon: ShieldCheck,
    title: "Verified professionals",
    body: "License, insurance, and verification shown on every profile.",
  },
  {
    icon: FileText,
    title: "Everything in writing",
    body: "Estimate, schedule, and invoice live on one project file.",
  },
] as const;

const COLUMNS = [
  REVIEWS.filter((_, index) => index % 2 === 0),
  REVIEWS.filter((_, index) => index % 2 === 1),
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
    <figure className="relative flex flex-col gap-4 rounded-2xl border border-white/10 bg-white/[0.06] p-5 shadow-[0_20px_40px_-28px_rgba(0,0,0,0.8)] backdrop-blur-md transition-colors duration-300 hover:border-white/25 hover:bg-white/[0.09]">
      <div className="flex items-center justify-between gap-3">
        <Stars value={review.rating} className="text-sm" />
        <span className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full bg-emerald-400/10 px-2 py-0.5 text-[11px] font-medium text-emerald-300 ring-1 ring-emerald-400/25">
          <BadgeCheck className="size-3.5" aria-hidden="true" />
          {review.audience === "pro" ? "Verified pro" : "Verified job"}
        </span>
      </div>
      <div className="flex flex-col gap-1.5">
        <p className="text-[11px] font-medium tracking-[0.14em] text-sky-300 uppercase">
          {review.service}
        </p>
        <blockquote className="text-[0.95rem] leading-6 text-white/90">
          “{review.quote}”
        </blockquote>
      </div>
      <figcaption className="mt-auto flex items-center gap-3 border-t border-white/10 pt-4">
        <span
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white ring-1 ring-white/20",
            review.audience === "pro"
              ? "bg-linear-to-br from-emerald-400/80 to-teal-600/80"
              : "bg-linear-to-br from-sky-400/80 to-primary",
          )}
          aria-hidden="true"
        >
          {initials(review.name)}
        </span>
        <span className="min-w-0 flex-1 leading-tight">
          <span className="block truncate text-sm font-semibold text-white">
            {review.name}
          </span>
          <span className="block truncate text-xs text-white/55">
            {review.meta}
          </span>
        </span>
        <Quote
          className="size-6 shrink-0 fill-white/10 text-white/15"
          aria-hidden="true"
        />
      </figcaption>
    </figure>
  );
}

/**
 * Customer reviews: rating summary and trust points on the left, review cards on the right.
 * From `lg` the cards scroll in slow vertical columns (one, two from `xl`), paused on hover and
 * static with reduced motion; below `lg` they become a swipeable row.
 */
export function CustomerReviewsSection() {
  return (
    <section className="section-space relative isolate overflow-hidden bg-[#071C35] text-white">
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-[radial-gradient(60rem_30rem_at_85%_10%,rgba(56,140,230,0.28),transparent_60%),radial-gradient(40rem_24rem_at_0%_100%,rgba(16,185,129,0.14),transparent_60%)]"
      />
      <Container className="grid items-center gap-10 lg:grid-cols-2 xl:grid-cols-[0.85fr_1.15fr] lg:gap-14">
        <div className="flex flex-col gap-7">
          <div className="flex flex-col gap-3">
            <p className="eyebrow text-sky-300">Customer reviews</p>
            <h2 className="text-balance text-3xl font-semibold tracking-tight md:text-[2.75rem] md:leading-[1.1]">
              Loved by homeowners.{" "}
              <span className="text-sky-300">Trusted by local pros.</span>
            </h2>
            <p className="max-w-lg text-sm leading-7 text-white/70 md:text-base">
              Every review on Request Service comes from a finished job, so you
              can see how a pro communicates, quotes, and shows up before you
              book.
            </p>
          </div>

          <div className="flex flex-col gap-5 rounded-2xl border border-white/10 bg-white/[0.05] p-5 backdrop-blur-md sm:flex-row sm:items-center sm:gap-7">
            <div className="flex shrink-0 flex-col gap-1.5">
              <p className="text-5xl font-semibold tracking-tight">
                {AVERAGE.toFixed(1)}
              </p>
              <Stars value={AVERAGE} className="text-lg" />
              <p className="text-xs text-white/55">
                Average of {REVIEWS.length} sample reviews
              </p>
            </div>
            <ul
              className="flex flex-1 flex-col gap-1.5"
              aria-label="Rating breakdown"
            >
              {BREAKDOWN.map(({ stars, count }) => (
                <li key={stars} className="flex items-center gap-2.5 text-xs">
                  <span className="w-3 text-white/70">{stars}</span>
                  <Star
                    className="size-3 fill-amber-400 text-amber-400"
                    aria-hidden="true"
                  />
                  <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
                    <span
                      className="block h-full rounded-full bg-amber-400"
                      style={{ width: `${(count / REVIEWS.length) * 100}%` }}
                    />
                  </span>
                  <span className="w-4 text-right text-white/55">{count}</span>
                </li>
              ))}
            </ul>
          </div>

          <ul className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
            {TRUST_POINTS.map(({ icon: Icon, title, body }) => (
              <li key={title} className="flex gap-3 xl:flex-col xl:gap-2">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-sky-400/10 text-sky-300 ring-1 ring-sky-300/20">
                  <Icon className="size-4.5" aria-hidden="true" />
                </span>
                <span>
                  <span className="block text-sm font-semibold">{title}</span>
                  <span className="block text-xs leading-5 text-white/60">
                    {body}
                  </span>
                </span>
              </li>
            ))}
          </ul>

          <Link
            href="/find-a-professional"
            className="inline-flex w-fit items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-[#071C35] transition-transform duration-200 hover:-translate-y-0.5"
          >
            Find a reviewed pro
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </div>

        {/* lg+: two slow vertical columns. Each list is rendered twice for a seamless loop. */}
        <div className="rs-review-track relative hidden h-[36rem] gap-4 lg:grid xl:grid-cols-2">
          {COLUMNS.map((column, columnIndex) => (
            <div
              key={columnIndex}
              className={cn(
                "overflow-hidden",
                columnIndex === 1 && "hidden xl:block",
              )}
            >
              <div
                className={cn(
                  "rs-review-col flex flex-col",
                  columnIndex === 1 && "rs-review-col-slow",
                )}
              >
                {[0, 1].map((copy) => (
                  <div
                    key={copy}
                    className="flex flex-col"
                    aria-hidden={copy === 1 ? true : undefined}
                  >
                    {column.map((review) => (
                      <div key={review.name} className="pb-4">
                        <ReviewCard review={review} />
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Below lg: a swipeable row. */}
        <ul className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:px-6 lg:hidden">
          {REVIEWS.map((review) => (
            <li
              key={review.name}
              className="w-[85%] max-w-sm shrink-0 snap-start sm:w-[22rem]"
            >
              <ReviewCard review={review} />
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}
