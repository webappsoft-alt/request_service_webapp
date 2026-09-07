import { Star } from "lucide-react";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Review } from "@/lib/types";

function initials(name: string) {
  return name
    .replace(/\./g, "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function Stars({ value }: { value: number }) {
  return (
    <span className="flex items-center gap-0.5" aria-label={`${value} out of 5 stars`}>
      {Array.from({ length: 5 }, (_, index) => (
        <Star
          key={index}
          className={cn(
            "size-3.5",
            index < Math.round(value)
              ? "fill-warning text-warning"
              : "text-muted-foreground/30"
          )}
          aria-hidden="true"
        />
      ))}
    </span>
  );
}

export function ProviderReviews({
  reviews,
  rating,
  reviewCount,
}: {
  reviews: Review[];
  rating: number;
  reviewCount: number;
}) {
  if (!reviews.length) {
    return (
      <p className="text-sm text-muted-foreground">
        Reviews will appear here when customers finish jobs with this company.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-input bg-card px-4 py-3">
        <p className="text-3xl font-semibold tracking-tight">{rating.toFixed(1)}</p>
        <div className="min-w-0">
          <Stars value={rating} />
          <p className="mt-1 text-sm text-muted-foreground">
            {reviewCount.toLocaleString("en-US")} reviews
          </p>
        </div>
      </div>

      <ul className="overflow-hidden rounded-xl border border-input bg-card">
        {reviews.map((review, index) => (
          <li
            key={review.id}
            className={cn("flex gap-3.5 px-4 py-4", index > 0 && "border-t")}
          >
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold text-brand">
              {initials(review.customerName)}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
                <div className="min-w-0">
                  <p className="font-medium">{review.customerName}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {formatDate(review.createdAt)}
                    {review.serviceName ? ` · ${review.serviceName}` : ""}
                  </p>
                </div>
                <Stars value={review.rating} />
              </div>
              {review.title ? (
                <p className="mt-2.5 text-sm font-medium">{review.title}</p>
              ) : null}
              <p className="mt-1 text-sm leading-6 text-muted-foreground">{review.body}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
