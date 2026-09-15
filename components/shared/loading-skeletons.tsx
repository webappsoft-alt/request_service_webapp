import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/** Visual ProviderCard (find-a-pro / home featured). */
export function ProviderCardSkeleton({ className }: { className?: string }) {
  return (
    <Card
      className={cn(
        "h-full gap-0 overflow-hidden border-black/15 pt-0 pb-2",
        className,
      )}
      aria-hidden="true"
    >
      <div className="relative aspect-4/3 overflow-hidden bg-muted">
        <Skeleton className="absolute inset-0 rounded-none" />
        <Skeleton className="absolute top-2 left-2 z-10 h-6 w-16 rounded-md" />
        <Skeleton className="absolute top-2 right-2 z-10 size-7 rounded-full" />
        <Skeleton className="absolute bottom-2.5 left-2.5 z-10 size-9 rounded-md" />
      </div>
      <div className="flex flex-col gap-3 px-3 pt-3 pb-3 sm:px-4">
        <div className="flex items-start justify-between gap-2">
          <Skeleton className="h-4 w-[55%]" />
          <Skeleton className="h-4 w-12" />
        </div>
        <Skeleton className="h-3.5 w-4/5" />
        <Skeleton className="h-3.5 w-2/5" />
        <Skeleton className="h-5 w-20 rounded-full" />
        <div className="mt-auto flex w-full flex-col gap-2 sm:flex-row">
          <Skeleton className="h-8 w-full rounded-md sm:flex-1" />
          <Skeleton className="h-8 w-full rounded-md sm:flex-1" />
        </div>
      </div>
    </Card>
  );
}

/** Horizontal / list-style provider row used on /services results. */
export function ProviderListCardSkeleton({ className }: { className?: string }) {
  return (
    <Card
      className={cn(
        "flex h-full flex-col gap-5 border-black/15 p-5 sm:flex-row sm:items-stretch sm:gap-6",
        className,
      )}
      aria-hidden="true"
    >
      <Skeleton className="aspect-[4/3] w-full rounded-xl sm:aspect-auto sm:min-h-[13.5rem] sm:w-72 sm:shrink-0 lg:w-80" />
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <Skeleton className="h-6 w-2/3" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-4 w-24" />
        <div className="mt-auto flex gap-2">
          <Skeleton className="h-9 w-28 rounded-md" />
          <Skeleton className="h-9 w-28 rounded-md" />
        </div>
      </div>
    </Card>
  );
}

/** Matches ServiceJobCard grid / list layouts. */
export function ServiceJobCardSkeleton({
  layout = "grid",
  className,
}: {
  layout?: "grid" | "list";
  className?: string;
}) {
  const isList = layout === "list";

  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border border-foreground/20 bg-card",
        isList ? "flex flex-col p-5 sm:flex-row sm:gap-6" : "flex flex-col",
        className,
      )}
      aria-hidden="true"
    >
      <Skeleton
        className={cn(
          isList
            ? "aspect-[4/3] w-full rounded-xl sm:aspect-auto sm:min-h-[13.5rem] sm:w-72 sm:shrink-0 lg:w-80"
            : "aspect-[4/3] w-full rounded-none",
        )}
      />
      <div
        className={cn(
          "flex min-w-0 flex-1 flex-col gap-3",
          isList ? "pt-4 sm:pt-0" : "p-4",
        )}
      >
        <Skeleton className="h-3.5 w-24" />
        <Skeleton className="h-6 w-4/5" />
        <Skeleton className="h-4 w-1/2" />
        <div className="flex flex-col gap-1.5">
          <Skeleton className="h-3.5 w-full" />
          <Skeleton className="h-3.5 w-5/6" />
          <Skeleton className="h-3.5 w-2/3" />
        </div>
        <div className="mt-auto flex items-center justify-between gap-3 pt-2">
          <Skeleton className="h-5 w-16" />
          <Skeleton className="h-4 w-20" />
        </div>
      </div>
    </div>
  );
}

export function BlogCardSkeleton({ className }: { className?: string }) {
  return (
    <Card
      className={cn("h-full gap-0 border-black/15 pt-0", className)}
      aria-hidden="true"
    >
      <Skeleton className="aspect-[16/10] w-full rounded-none rounded-t-xl" />
      <div className="flex flex-col gap-3 px-4 pt-4 pb-4">
        <Skeleton className="h-3.5 w-1/3" />
        <Skeleton className="h-5 w-4/5" />
        <Skeleton className="h-3.5 w-full" />
        <Skeleton className="h-3.5 w-2/3" />
        <Skeleton className="mt-auto h-3 w-1/4" />
      </div>
    </Card>
  );
}

/** Square category tile on the home services carousel. */
export function CategoryTileSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn("flex flex-col items-center gap-1.5 text-center", className)}
      aria-hidden="true"
    >
      <Skeleton className="aspect-square w-full rounded-xl" />
      <Skeleton className="h-4 w-3/4 max-w-28" />
    </div>
  );
}

export function CustomerOrderCardSkeleton({ className }: { className?: string }) {
  return (
    <article
      className={cn(
        "overflow-hidden rounded-xl border border-border bg-card shadow-sm",
        className,
      )}
      aria-hidden="true"
    >
      <Skeleton className="aspect-[16/10] w-full rounded-none" />
      <div className="flex flex-col gap-3 p-4">
        <Skeleton className="h-5 w-4/5" />
        <Skeleton className="h-3 w-1/3" />
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-4 w-1/2" />
        <div className="mt-auto flex items-center justify-between border-t border-border pt-3">
          <Skeleton className="h-5 w-16" />
          <Skeleton className="h-6 w-20 rounded-full" />
        </div>
      </div>
    </article>
  );
}

export function MessageThreadSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-xl border bg-card p-4",
        className,
      )}
      aria-hidden="true"
    >
      <Skeleton className="size-11 shrink-0 rounded-full" />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-3.5 w-4/5" />
      </div>
      <Skeleton className="h-3 w-10" />
    </div>
  );
}

export function ServiceDetailSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("flex flex-col gap-8", className)} aria-hidden="true">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        <Skeleton className="aspect-[16/10] w-full rounded-2xl" />
        <div className="flex flex-col gap-4">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-9 w-4/5" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-10 w-40 rounded-lg" />
          <Skeleton className="h-10 w-full rounded-lg" />
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="h-28 w-full rounded-xl" />
        ))}
      </div>
    </div>
  );
}

export function ProfessionalDetailSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("flex flex-col gap-8", className)} aria-hidden="true">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <Skeleton className="size-20 shrink-0 rounded-xl" />
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <Skeleton className="h-8 w-1/2" />
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-4 w-1/3" />
          <div className="flex gap-2">
            <Skeleton className="h-9 w-28 rounded-md" />
            <Skeleton className="h-9 w-28 rounded-md" />
          </div>
        </div>
      </div>
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 3 }, (_, i) => (
          <ServiceJobCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}

export function ProviderCardSkeletonGrid({
  count = 6,
  className,
}: {
  count?: number;
  className?: string;
}) {
  return (
    <ul
      className={cn("grid grid-cols-1 gap-4 sm:grid-cols-2", className)}
      aria-busy="true"
      aria-label="Loading professionals"
    >
      {Array.from({ length: count }, (_, i) => (
        <li key={`provider-sk-${i}`}>
          <ProviderCardSkeleton />
        </li>
      ))}
    </ul>
  );
}

export function ServiceJobCardSkeletonList({
  count = 6,
  layout = "list",
  className,
}: {
  count?: number;
  layout?: "grid" | "list";
  className?: string;
}) {
  return (
    <ul
      className={cn(
        layout === "grid"
          ? "grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3"
          : "flex flex-col gap-5",
        className,
      )}
      aria-busy="true"
      aria-label="Loading services"
    >
      {Array.from({ length: count }, (_, i) => (
        <li key={`job-sk-${i}`}>
          <ServiceJobCardSkeleton layout={layout} />
        </li>
      ))}
    </ul>
  );
}

/** Chip under home search (HeroServiceScroller). */
export function CategoryChipSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-1 px-1.5 pt-1 pb-[5px]",
        className,
      )}
      aria-hidden="true"
    >
      <Skeleton className="size-5 rounded-md" />
      <Skeleton className="h-3 w-12 rounded-sm" />
    </div>
  );
}
