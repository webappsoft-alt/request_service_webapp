import { Container } from "@/components/layout/container";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
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
      <div className="relative aspect-[4/3] overflow-hidden bg-muted">
        <Skeleton className="absolute inset-0 rounded-none" />
        <Skeleton className="absolute top-2 left-2 z-10 h-6 w-16 rounded-md" />
        <Skeleton className="absolute top-2 right-2 z-10 size-7 rounded-full" />
        <Skeleton className="absolute bottom-2.5 left-2.5 z-10 size-9 rounded-md" />
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-3 px-3 pt-3 pb-3 sm:px-4">
        <div className="flex items-start justify-between gap-2">
          <Skeleton className="h-4 w-[55%]" />
          <Skeleton className="h-4 w-12" />
        </div>
        <Skeleton className="h-3.5 w-4/5" />
        <Skeleton className="h-3.5 w-2/5" />
        <div className="flex flex-wrap gap-1.5">
          <Skeleton className="h-5 w-[7.5rem] rounded-full" />
          <Skeleton className="h-5 w-24 rounded-full" />
          <Skeleton className="h-5 w-[6.5rem] rounded-full" />
          <Skeleton className="h-5 w-20 rounded-full" />
        </div>
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
    <section
      className={cn("pt-6 pb-10 md:pt-7 md:pb-12", className)}
      aria-busy="true"
      aria-label="Loading service details"
    >
      <Container className="flex flex-col gap-8">
        <nav aria-hidden="true">
          <div className="flex flex-wrap items-center gap-2">
            <Skeleton className="h-4 w-12" />
            <Skeleton className="size-1 rounded-full" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="size-1 rounded-full" />
            <Skeleton className="h-4 w-28" />
            <Skeleton className="size-1 rounded-full" />
            <Skeleton className="h-4 w-40" />
          </div>
        </nav>

        <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(18rem,22rem)] lg:gap-12">
          <div className="flex flex-col gap-6">
            <div className="overflow-hidden rounded-2xl border border-black/10 bg-card">
              <Skeleton className="aspect-[16/10] w-full rounded-none" />
              <div className="flex gap-2 p-2">
                {Array.from({ length: 4 }, (_, i) => (
                  <Skeleton
                    key={`svc-thumb-${i}`}
                    className="h-20 w-[calc((100%-1.5rem)/4)] shrink-0 rounded-lg sm:h-24"
                  />
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Skeleton className="h-4 w-full max-w-2xl" />
              <Skeleton className="h-4 w-5/6 max-w-xl" />
              <Skeleton className="h-4 w-2/3 max-w-lg" />
            </div>

            <div className="flex flex-col gap-3">
              <Skeleton className="h-6 w-56" />
              <div className="grid gap-2.5 sm:grid-cols-2">
                {Array.from({ length: 4 }, (_, i) => (
                  <div key={`svc-point-${i}`} className="flex items-start gap-2.5">
                    <Skeleton className="mt-0.5 size-4 shrink-0 rounded-full" />
                    <Skeleton className="h-4 flex-1" />
                  </div>
                ))}
              </div>
            </div>
          </div>

          <aside className="rounded-2xl border bg-card p-5 shadow-sm">
            <Skeleton className="h-6 w-20 rounded-md" />
            <Skeleton className="mt-3 h-8 w-4/5" />
            <Skeleton className="mt-2 h-4 w-3/5" />
            <div className="mt-5 space-y-1.5">
              <Skeleton className="h-3 w-28" />
              <Skeleton className="h-9 w-24" />
            </div>
            <div className="mt-5 flex flex-col gap-2.5">
              <Skeleton className="h-12 w-full rounded-lg" />
              <Skeleton className="h-12 w-full rounded-lg" />
            </div>
            <ul className="mt-5 flex flex-col gap-2 border-t pt-4">
              {Array.from({ length: 4 }, (_, i) => (
                <li key={`svc-benefit-${i}`} className="flex items-start gap-2">
                  <Skeleton className="mt-0.5 size-4 shrink-0 rounded-full" />
                  <Skeleton className="h-4 flex-1" />
                </li>
              ))}
            </ul>
          </aside>
        </div>
      </Container>
    </section>
  );
}

export function ProfessionalDetailSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={className}
      aria-busy="true"
      aria-label="Loading professional profile"
    >
      <section className="pt-6 pb-10 md:pt-7 md:pb-10">
        <Container>
          <nav className="mb-4" aria-hidden="true">
            <div className="flex flex-wrap items-center gap-2">
              <Skeleton className="h-4 w-12" />
              <Skeleton className="size-1 rounded-full" />
              <Skeleton className="h-4 w-32" />
              <Skeleton className="size-1 rounded-full" />
              <Skeleton className="h-4 w-40" />
            </div>
          </nav>

          <div className="mb-4">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="mt-2 h-7 w-24" />
          </div>

          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_26rem]">
            <div className="flex flex-col gap-8">
              <div className="overflow-hidden rounded-xl border border-black/15 bg-card">
                <Skeleton className="h-[min(22rem,50svh)] w-full rounded-none md:h-[min(28rem,48svh)] lg:h-[min(32rem,46svh)]" />
                <div className="flex gap-2 p-2">
                  {Array.from({ length: 3 }, (_, i) => (
                    <Skeleton
                      key={`gallery-thumb-${i}`}
                      className="h-24 w-[calc((100%-1rem)/3)] shrink-0 rounded-lg sm:h-28 sm:w-[calc((100%-1.5rem)/4)] lg:w-[calc((100%-2rem)/5)]"
                    />
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-4">
                <div className="flex items-start gap-4">
                  <Skeleton className="size-14 shrink-0 rounded-xl" />
                  <div className="min-w-0 flex-1">
                    <Skeleton className="h-9 w-3/4 md:h-10" />
                    <Skeleton className="mt-2 h-4 w-2/3" />
                    <div className="mt-3 flex flex-wrap items-center gap-3">
                      <Skeleton className="h-5 w-32" />
                      <Skeleton className="h-5 w-28 rounded-full" />
                      <Skeleton className="h-4 w-32" />
                    </div>
                  </div>
                </div>
                <div>
                  <Skeleton className="h-7 w-48" />
                  <Skeleton className="mt-3 h-4 w-full max-w-3xl" />
                  <Skeleton className="mt-2 h-4 w-full max-w-3xl" />
                  <Skeleton className="mt-2 h-4 w-2/3 max-w-2xl" />
                </div>
              </div>

              <section className="flex flex-col gap-4">
                <div>
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="mt-2 h-7 w-56" />
                  <Skeleton className="mt-2 h-4 w-full max-w-2xl" />
                  <Skeleton className="mt-1.5 h-4 w-4/5 max-w-xl" />
                </div>
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
                  {Array.from({ length: 3 }, (_, i) => (
                    <FixedServiceCardSkeleton key={`fixed-sk-${i}`} />
                  ))}
                </div>
              </section>

              <section className="flex flex-col gap-4">
                <div>
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="mt-2 h-7 w-52" />
                </div>
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
                  {Array.from({ length: 6 }, (_, i) => (
                    <ServiceOfferCardSkeleton key={`offer-sk-${i}`} />
                  ))}
                </div>
              </section>

              <section className="flex flex-col gap-4">
                <div>
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="mt-2 h-7 w-44" />
                </div>
                <Skeleton className="h-4 w-72" />
                <div className="relative h-80 overflow-hidden rounded-xl border border-black/15">
                  <MapPaneSkeleton />
                </div>
                <div className="flex flex-wrap gap-2">
                  {Array.from({ length: 5 }, (_, i) => (
                    <Skeleton key={`area-sk-${i}`} className="h-6 w-24 rounded-full" />
                  ))}
                </div>
              </section>

              <section className="flex flex-col gap-4">
                <div>
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="mt-2 h-7 w-56" />
                  <Skeleton className="mt-2 h-4 w-full max-w-2xl" />
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {Array.from({ length: 3 }, (_, i) => (
                    <ProjectCardSkeleton key={`project-sk-${i}`} />
                  ))}
                </div>
              </section>

              <section className="flex flex-col gap-4">
                <div>
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="mt-2 h-7 w-52" />
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-input bg-card px-4 py-3">
                  <Skeleton className="h-9 w-12" />
                  <div className="flex flex-col gap-2">
                    <Skeleton className="h-3.5 w-24" />
                    <Skeleton className="h-3.5 w-20" />
                  </div>
                </div>
                <div className="overflow-hidden rounded-xl border border-input bg-card">
                  {Array.from({ length: 3 }, (_, i) => (
                    <div
                      key={`review-sk-${i}`}
                      className={cn("flex gap-3.5 px-4 py-4", i > 0 && "border-t")}
                    >
                      <Skeleton className="size-10 shrink-0 rounded-full" />
                      <div className="min-w-0 flex-1">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="mt-2 h-3 w-40" />
                        <Skeleton className="mt-3 h-3.5 w-full" />
                        <Skeleton className="mt-1.5 h-3.5 w-4/5" />
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </div>

            <aside className="flex flex-col gap-3 lg:sticky lg:top-24 lg:self-start">
              <Card>
                <CardHeader className="border-b">
                  <Skeleton className="h-5 w-44" />
                </CardHeader>
                <CardContent className="grid gap-4 pt-4">
                  {Array.from({ length: 7 }, (_, i) => (
                    <div key={`info-sk-${i}`} className="flex min-w-0 gap-3">
                      <Skeleton className="size-9 shrink-0 rounded-lg" />
                      <div className="min-w-0 flex-1">
                        <Skeleton className="h-2.5 w-14" />
                        <Skeleton className="mt-2 h-4 w-3/4" />
                        {i === 0 || i === 3 ? (
                          <Skeleton className="mt-1.5 h-3.5 w-1/2" />
                        ) : null}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="border-b">
                  <Skeleton className="h-5 w-48" />
                </CardHeader>
                <CardContent className="flex flex-col gap-3 pt-4">
                  <Skeleton className="h-3.5 w-full" />
                  <Skeleton className="h-3.5 w-4/5" />
                  <Skeleton className="h-12 w-full rounded-md" />
                  <Skeleton className="h-10 w-full rounded-md" />
                  <Skeleton className="h-12 w-full rounded-md" />
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="border-b">
                  <Skeleton className="h-5 w-36" />
                </CardHeader>
                <CardContent className="flex flex-col gap-4 pt-4">
                  <Skeleton className="h-3.5 w-full" />
                  <div className="flex items-center justify-between">
                    <Skeleton className="size-8 rounded-md" />
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="size-8 rounded-md" />
                  </div>
                  <div className="grid grid-cols-7 gap-1">
                    {Array.from({ length: 35 }, (_, i) => (
                      <Skeleton key={`cal-sk-${i}`} className="aspect-square w-full rounded-md" />
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card size="sm">
                <CardHeader>
                  <Skeleton className="h-5 w-20" />
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {Array.from({ length: 4 }, (_, i) => (
                      <Skeleton key={`social-sk-${i}`} className="size-10 rounded-lg" />
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card size="sm">
                <CardHeader>
                  <Skeleton className="h-5 w-32" />
                </CardHeader>
                <CardContent className="flex flex-col gap-1.5">
                  {Array.from({ length: 7 }, (_, i) => (
                    <div key={`hours-sk-${i}`} className="flex items-center justify-between gap-3">
                      <Skeleton className="h-3.5 w-16" />
                      <Skeleton className="h-3.5 w-24" />
                    </div>
                  ))}
                </CardContent>
              </Card>
            </aside>
          </div>
        </Container>
      </section>

      <section className="pb-10 md:pb-14">
        <Container className="flex flex-col gap-4">
          <div>
            <Skeleton className="h-3 w-36" />
            <Skeleton className="mt-2 h-7 w-64" />
          </div>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }, (_, i) => (
              <ProviderCardSkeleton key={`related-sk-${i}`} />
            ))}
          </div>
        </Container>
      </section>
    </div>
  );
}

function FixedServiceCardSkeleton() {
  return (
    <article className="flex flex-col overflow-hidden rounded-xl border border-black/10 bg-card">
      <Skeleton className="aspect-[2/1] w-full rounded-none" />
      <div className="flex flex-1 flex-col gap-2 p-3">
        <Skeleton className="h-4 w-4/5" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-3/4" />
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-3 w-5/6" />
        <Skeleton className="h-3 w-2/3" />
        <Skeleton className="mt-auto h-8 w-full rounded-md" />
      </div>
    </article>
  );
}

function ServiceOfferCardSkeleton() {
  return (
    <div className="flex h-full flex-col gap-3 rounded-xl border border-black/10 bg-card p-4">
      <div className="flex items-start gap-3">
        <Skeleton className="size-10 shrink-0 rounded-lg" />
        <div className="min-w-0 flex-1">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="mt-1.5 h-3.5 w-full" />
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <Skeleton className="h-3.5 w-5/6" />
        <Skeleton className="h-3.5 w-4/5" />
        <Skeleton className="h-3.5 w-2/3" />
      </div>
    </div>
  );
}

function ProjectCardSkeleton() {
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-xl border border-black/15 bg-card">
      <Skeleton className="aspect-[16/10] w-full rounded-none" />
      <div className="flex flex-1 flex-col gap-2 p-4">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-5 w-4/5" />
        <Skeleton className="h-3.5 w-full" />
        <Skeleton className="h-3.5 w-2/3" />
        <Skeleton className="mt-auto h-3 w-32" />
        <Skeleton className="h-4 w-24" />
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
        <li key={`provider-sk-${i}`} className="h-full">
          <ProviderCardSkeleton />
        </li>
      ))}
    </ul>
  );
}

/** Left map + right visual pro cards — matches CategoryExplorer marketplace layout. */
export function FindProfessionalSkeleton({
  cardCount = 6,
}: {
  cardCount?: number;
}) {
  return (
    <div
      className="container-site flex flex-col bg-background lg:h-[calc(100dvh-4.25rem)]"
      aria-busy="true"
      aria-label="Loading professionals"
    >
      <div className="relative z-[1200] shrink-0 overflow-visible border-b bg-background">
        <div className="flex flex-col gap-2 py-3 lg:flex-row lg:items-center lg:gap-3">
          <Skeleton className="h-10 w-full max-w-56 rounded-lg" />
          <div className="grid min-w-0 grid-cols-2 gap-2 sm:flex sm:flex-1 sm:flex-wrap sm:items-center">
            <Skeleton className="h-10 w-full rounded-lg sm:w-36" />
            <Skeleton className="h-10 w-full rounded-lg sm:w-28" />
            <Skeleton className="h-10 w-full rounded-lg sm:w-32" />
          </div>
        </div>
      </div>

      <div className="relative z-0 flex flex-col lg:min-h-0 lg:flex-1 lg:flex-row lg:overflow-hidden">
        <div className="relative h-[32vh] min-h-52 shrink-0 overflow-hidden border-b bg-muted sm:h-[36vh] lg:h-auto lg:min-h-[24rem] lg:w-[48%] lg:flex-none lg:border-r lg:border-b-0">
          <MapPaneSkeleton />
        </div>

        <aside className="flex w-full flex-col bg-background lg:min-h-0 lg:w-[52%] lg:flex-none">
          <div className="flex shrink-0 flex-col gap-2 border-b px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <Skeleton className="h-5 w-48 sm:w-64" />
              <Skeleton className="h-3.5 w-28" />
            </div>
            <Skeleton className="h-9 w-32 rounded-lg" />
          </div>
          <ul className="grid content-start grid-cols-1 gap-4 p-3 sm:p-4 xl:grid-cols-2 lg:min-h-0 lg:flex-1 lg:overflow-auto">
            {Array.from({ length: cardCount }, (_, i) => (
              <li key={`find-pro-sk-${i}`} className="h-full">
                <ProviderCardSkeleton />
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </div>
  );
}

export function MapPaneSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn("absolute inset-0 overflow-hidden bg-[#e8eef2]", className)}
      aria-hidden="true"
    >
      <div className="absolute inset-0 animate-pulse bg-white/25" />
      <div className="absolute inset-0 opacity-40">
        <div className="absolute top-[18%] left-0 h-px w-full bg-[#c5d0d8]" />
        <div className="absolute top-[42%] left-0 h-px w-full bg-[#c5d0d8]" />
        <div className="absolute top-[68%] left-0 h-px w-full bg-[#c5d0d8]" />
        <div className="absolute top-0 left-[28%] h-full w-px bg-[#c5d0d8]" />
        <div className="absolute top-0 left-[61%] h-full w-px bg-[#c5d0d8]" />
        <div className="absolute top-[30%] left-[8%] h-px w-[55%] rotate-12 bg-[#b7c4ce]" />
        <div className="absolute top-[58%] left-[22%] h-px w-[48%] -rotate-6 bg-[#b7c4ce]" />
      </div>
      <span className="absolute top-[28%] left-[36%] size-3 rounded-full border-2 border-white bg-brand shadow-sm" />
      <span className="absolute top-[46%] left-[58%] size-3 rounded-full border-2 border-white bg-brand shadow-sm" />
      <span className="absolute top-[62%] left-[44%] size-3 rounded-full border-2 border-white bg-brand shadow-sm" />
      <span className="absolute top-[38%] left-[72%] size-3 rounded-full border-2 border-white bg-brand/70 shadow-sm" />
    </div>
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

/** Full /services directory layout — hero, sidebar filters, and service cards. */
export function ServicesDirectorySkeleton({
  className,
}: {
  className?: string;
}) {
  return (
    <div className={cn("bg-background", className)} aria-busy="true" aria-label="Loading services">
      <div className="border-b bg-card">
        <Container className="flex flex-col gap-4 py-8 md:py-10">
          <Skeleton className="h-3 w-40" />
          <Skeleton className="h-8 w-72 max-w-full" />
          <div className="flex flex-col gap-3 rounded-xl border bg-background p-3 sm:flex-row sm:items-center">
            <Skeleton className="h-11 flex-1 rounded-lg" />
            <Skeleton className="h-11 flex-1 rounded-lg" />
            <Skeleton className="h-11 w-full rounded-lg sm:w-28" />
          </div>
        </Container>
      </div>

      <section className="bg-[#f5f5f5] py-6 md:py-8">
        <Container className="grid items-start gap-6 lg:grid-cols-[17.5rem_minmax(0,1fr)] lg:gap-7">
          <aside className="max-lg:hidden sticky top-24 self-start rounded-xl border bg-card p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3 border-b pb-3.5">
              <Skeleton className="h-5 w-20" />
              <Skeleton className="h-4 w-12" />
            </div>
            <div className="flex flex-col gap-3 pt-3.5">
              <Skeleton className="h-4 w-16" />
              {Array.from({ length: 8 }, (_, i) => (
                <div key={`filter-sk-${i}`} className="flex items-center gap-2.5">
                  <Skeleton className="size-4 rounded-sm" />
                  <Skeleton className="h-4 w-28" />
                </div>
              ))}
            </div>
          </aside>

          <div className="flex min-w-0 flex-col gap-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-2">
                <Skeleton className="h-7 w-48" />
                <Skeleton className="h-4 w-40" />
              </div>
              <div className="flex items-center gap-2.5">
                <Skeleton className="h-9 w-28 rounded-md" />
                <Skeleton className="size-9 rounded-md" />
                <Skeleton className="size-9 rounded-md" />
              </div>
            </div>
            <Skeleton className="h-4 w-32" />
            <ServiceJobCardSkeletonList count={4} layout="list" />
            <div className="flex flex-col gap-3 pt-2">
              <Skeleton className="h-6 w-52" />
              <ul className="flex flex-col gap-5" aria-hidden="true">
                {Array.from({ length: 2 }, (_, i) => (
                  <li key={`dir-pro-sk-${i}`}>
                    <ProviderListCardSkeleton />
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Container>
      </section>
    </div>
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

/** Full dual-pane chat skeleton (used across pro and customer messages). */
export function ChatWorkspaceSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex h-full min-h-0 w-full flex-1 overflow-hidden bg-background",
        className,
      )}
      aria-hidden="true"
    >
      {/* Left Sidebar Skeleton */}
      <aside className="flex h-full w-full flex-col border-r border-border bg-card md:w-80 lg:w-[23rem]">
        <div className="flex flex-col gap-2.5 border-b border-border p-3 sm:p-4">
          <div className="flex items-center justify-between">
            <Skeleton className="h-5 w-24 rounded" />
            <Skeleton className="h-5 w-8 rounded-full" />
          </div>
          <Skeleton className="h-8.5 w-full rounded-lg" />
          <div className="flex gap-1">
            <Skeleton className="h-6 flex-1 rounded-md" />
            <Skeleton className="h-6 flex-1 rounded-md" />
          </div>
        </div>
        <div className="flex-1 divide-y divide-border/60 p-2 space-y-2">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="flex items-start gap-3 p-2.5">
              <Skeleton className="size-10 rounded-full shrink-0" />
              <div className="flex-1 space-y-1.5">
                <div className="flex justify-between">
                  <Skeleton className="h-3.5 w-24 rounded" />
                  <Skeleton className="h-3 w-10 rounded" />
                </div>
                <Skeleton className="h-3 w-3/4 rounded" />
              </div>
            </div>
          ))}
        </div>
      </aside>

      {/* Right Main Area Skeleton */}
      <main className="hidden md:flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-background">
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-border bg-card px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <Skeleton className="size-10 rounded-full" />
            <div className="space-y-1.5">
              <Skeleton className="h-4 w-32 rounded" />
              <Skeleton className="h-3 w-20 rounded" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-8 w-24 rounded-md" />
            <Skeleton className="h-8 w-28 rounded-md" />
          </div>
        </header>
        <div className="flex-1 p-6 space-y-4">
          <Skeleton className="h-10 w-48 rounded-2xl" />
          <Skeleton className="h-14 w-64 rounded-2xl ml-auto" />
          <Skeleton className="h-10 w-52 rounded-2xl" />
          <Skeleton className="h-12 w-60 rounded-2xl ml-auto" />
        </div>
        <div className="border-t border-border bg-card p-3 sm:p-4">
          <Skeleton className="h-10 w-full rounded-lg" />
        </div>
      </main>
    </div>
  );
}

/** Standalone chat panel skeleton for lead detail tabs or embedded chat. */
export function ChatPanelSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-background",
        className,
      )}
      aria-hidden="true"
    >
      <header className="flex h-16 shrink-0 items-center justify-between border-b border-border bg-card px-4 sm:px-6">
        <div className="flex items-center gap-3">
          <Skeleton className="size-10 rounded-full" />
          <div className="space-y-1.5">
            <Skeleton className="h-4 w-32 rounded" />
            <Skeleton className="h-3 w-20 rounded" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-24 rounded-md" />
          <Skeleton className="h-8 w-28 rounded-md" />
        </div>
      </header>
      <div className="flex-1 p-6 space-y-4">
        <Skeleton className="h-10 w-48 rounded-2xl" />
        <Skeleton className="h-14 w-64 rounded-2xl ml-auto" />
        <Skeleton className="h-10 w-52 rounded-2xl" />
      </div>
      <div className="border-t border-border bg-card p-3 sm:p-4">
        <Skeleton className="h-10 w-full rounded-lg" />
      </div>
    </div>
  );
}

