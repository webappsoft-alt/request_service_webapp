import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Check, Clock, MapPin, Star } from "lucide-react";
import { formatLocation, formatStartingPrice } from "@/lib/format";
import { getJobDetail, getJobPath } from "@/lib/data/jobs";
import { getJobImage, getJobStartingPrice } from "@/lib/data/provider-media";
import { getProvidersByCategoryId } from "@/lib/data/providers";
import { getProviderPresence } from "@/lib/data/service-directory";
import { cn } from "@/lib/utils";
import type { ServiceCategory } from "@/lib/types";

export function ServiceJobCard({
  category,
  job,
  index,
  layout = "grid",
}: {
  category: ServiceCategory;
  job: string;
  index?: number;
  layout?: "grid" | "list";
}) {
  const price = getJobStartingPrice(category.id, job);
  const image = getJobImage(category.id, job, index);
  const detail = getJobDetail(job);
  const provider = getProvidersByCategoryId(category.id)[0];
  const presence = provider ? getProviderPresence(provider.id) : null;
  const isList = layout === "list";
  const review = provider?.reviews[0];

  const ticks = (
    <ul className="flex flex-col gap-0.5">
      {detail.points.slice(0, 3).map((point) => (
        <li
          key={point}
          className="flex items-start gap-1.5 text-sm leading-5 text-muted-foreground"
        >
          <Check
            className="mt-0.5 size-3.5 shrink-0 text-success"
            aria-hidden="true"
          />
          <span>{point}</span>
        </li>
      ))}
    </ul>
  );

  return (
    <Link
      href={getJobPath(category.slug, job)}
      className={cn(
        "group flex h-full overflow-hidden rounded-xl border border-foreground/35 bg-card transition-[transform,box-shadow,border-color] duration-300 ease-out hover:-translate-y-0.5 hover:border-foreground/50 hover:elevate focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        isList
          ? "flex-col p-5 sm:flex-row sm:items-stretch sm:gap-6"
          : "flex-col",
      )}
    >
      <div
        className={cn(
          "relative overflow-hidden bg-muted",
          isList
            ? "aspect-[4/3] rounded-xl sm:aspect-auto sm:min-h-[13.5rem] sm:w-72 sm:shrink-0 lg:w-80"
            : "aspect-[4/3]",
        )}
      >
        {image ? (
          <Image
            src={image}
            alt={job}
            fill
            sizes="(min-width: 1280px) 22vw, (min-width: 640px) 40vw, 90vw"
            className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.05]"
          />
        ) : null}
        {isList ? null : (
          <span
            className="absolute inset-0 bg-linear-to-t from-black/45 via-transparent to-transparent"
            aria-hidden="true"
          />
        )}
        <span className="absolute top-3 left-3 rounded-md bg-card/95 px-2.5 py-1 text-xs font-medium shadow-sm backdrop-blur-sm">
          {category.shortName}
        </span>
        {presence?.online ? (
          <span className="absolute top-3 right-3 inline-flex items-center gap-1.5 rounded-md bg-card/95 px-2.5 py-1 text-xs font-medium shadow-sm backdrop-blur-sm">
            <span className="size-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
            Available now
          </span>
        ) : null}
      </div>

      {isList ? (
        <div className="flex min-w-0 flex-1 flex-col gap-4 pt-4 sm:flex-row sm:items-stretch sm:gap-6 sm:pt-0">
          <div className="flex min-w-0 flex-1 flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              {provider ? (
                <p className="text-sm font-medium text-muted-foreground">
                  {provider.companyName}
                </p>
              ) : null}
              <h3 className="text-xl leading-snug font-semibold tracking-tight">
                {job}
              </h3>
              {provider ? (
                <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                  <span className="inline-flex items-center gap-1 font-medium text-foreground">
                    <Star
                      className="size-3.5 fill-current text-warning"
                      aria-hidden="true"
                    />
                    {provider.rating.toFixed(1)}
                    <span className="font-normal text-muted-foreground">
                      ({provider.reviewCount} reviews)
                    </span>
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="size-3.5" aria-hidden="true" />
                    {formatLocation(provider.city, provider.state)}
                  </span>
                </span>
              ) : null}
            </div>
            {review ? (
              <p className="max-w-xl text-sm leading-6 text-muted-foreground">
                {review.customerName.split(" ")[0]} says “{review.body.replace(/^Demo review:\s*/i, "")}”
              </p>
            ) : (
              ticks
            )}
            {presence ? (
              <p className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground">
                <Clock className="size-3.5 text-muted-foreground" aria-hidden="true" />
                {presence.responseLabel}
              </p>
            ) : null}
          </div>

          <div className="flex shrink-0 flex-row items-end justify-between gap-4 sm:w-44 sm:flex-col sm:items-end sm:justify-between">
            <span className="flex flex-col gap-1 sm:items-end">
              <span className="text-xs text-muted-foreground">Typical start</span>
              <span className="text-2xl leading-none font-semibold tabular-nums">
                {formatStartingPrice(price)}
              </span>
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground">
              View profile
              <ArrowRight
                className="size-3.5 transition-transform duration-300 ease-out group-hover:translate-x-0.5"
                aria-hidden="true"
              />
            </span>
          </div>
        </div>
      ) : (
        <div className="flex flex-1 flex-col">
          <div className="flex flex-col gap-2 p-4">
            <div className="flex flex-col gap-1">
              <h3 className="text-base leading-snug font-semibold tracking-tight">
                {job}
              </h3>

              {provider ? (
                <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1 font-medium text-foreground">
                    <Star
                      className="size-3.5 fill-current text-warning"
                      aria-hidden="true"
                    />
                    {provider.rating.toFixed(1)}
                  </span>
                  <span>({provider.reviewCount} reviews)</span>
                  <span aria-hidden="true">·</span>
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="size-3.5" aria-hidden="true" />
                    {formatLocation(provider.city, provider.state)}
                  </span>
                </span>
              ) : null}
            </div>

            {ticks}
            {presence ? (
              <p className="inline-flex items-center gap-1.5 text-xs font-medium">
                <Clock className="size-3.5 text-muted-foreground" aria-hidden="true" />
                {presence.responseLabel}
              </p>
            ) : null}
          </div>

          <div className="mt-auto flex items-end justify-between gap-3 border-t px-4 py-3">
            <span className="flex flex-col gap-0.5">
              <span className="text-xs text-muted-foreground">
                Typical start
              </span>
              <span className="text-lg leading-none font-semibold tabular-nums">
                {formatStartingPrice(price)}
              </span>
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground">
              View details
              <ArrowRight
                className="size-3.5 transition-transform duration-300 ease-out group-hover:translate-x-0.5"
                aria-hidden="true"
              />
            </span>
          </div>
        </div>
      )}
    </Link>
  );
}
