import { Container } from "@/components/layout/container";
import { Skeleton } from "@/components/ui/skeleton";

export default function BlogDetailsLoading() {
  return (
    <article className="animate-in fade-in duration-300">
      {/* Top Header Section Skeleton */}
      <section className="relative isolate overflow-hidden border-b">
        <div
          className="page-wash pointer-events-none absolute inset-0 -z-10"
          aria-hidden="true"
        />
        <div
          className="hero-grid pointer-events-none absolute inset-0 -z-10"
          aria-hidden="true"
        />

        <Container className="flex flex-col gap-5 py-10 md:py-14">
          {/* Breadcrumb Skeleton */}
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-12 rounded-sm" />
            <span className="text-muted-foreground/40">/</span>
            <Skeleton className="h-4 w-12 rounded-sm" />
            <span className="text-muted-foreground/40">/</span>
            <Skeleton className="h-4 w-28 rounded-sm" />
          </div>

          {/* Title & Description Skeleton */}
          <div className="flex max-w-3xl flex-col gap-4">
            <Skeleton className="h-6 w-28 rounded-full" />
            <Skeleton className="h-10 w-full max-w-2xl rounded-lg" />
            <Skeleton className="h-6 w-4/5 rounded-md" />
            <Skeleton className="h-4 w-32 rounded-sm" />
          </div>
        </Container>
      </section>

      {/* Content Space */}
      <div className="section-space">
        <Container className="grid gap-10 lg:grid-cols-[minmax(0,42rem)_minmax(0,16rem)] lg:justify-between">
          {/* Main Article Body Skeleton */}
          <div className="flex flex-col gap-6">
            {/* Lead paragraph */}
            <div className="flex flex-col gap-2.5">
              <Skeleton className="h-4 w-full rounded-sm" />
              <Skeleton className="h-4 w-11/12 rounded-sm" />
              <Skeleton className="h-4 w-4/5 rounded-sm" />
            </div>

            {/* In-content image skeleton */}
            <div className="my-2">
              <Skeleton className="aspect-[16/10] w-full rounded-2xl" />
            </div>

            {/* Following paragraphs */}
            <div className="flex flex-col gap-2.5">
              <Skeleton className="h-4 w-full rounded-sm" />
              <Skeleton className="h-4 w-full rounded-sm" />
              <Skeleton className="h-4 w-3/4 rounded-sm" />
            </div>

            <div className="flex flex-col gap-2.5">
              <Skeleton className="h-4 w-full rounded-sm" />
              <Skeleton className="h-4 w-5/6 rounded-sm" />
            </div>

            {/* Back to blog button */}
            <div className="mt-4 border-t pt-6">
              <Skeleton className="h-10 w-36 rounded-xl" />
            </div>

            {/* Comments skeleton */}
            <div className="mt-8 flex flex-col gap-4">
              <Skeleton className="h-7 w-40 rounded-md" />
              <Skeleton className="h-28 w-full rounded-2xl border" />
            </div>
          </div>

          {/* Sticky Sidebar Skeleton */}
          <aside className="flex flex-col gap-4 lg:sticky lg:top-24 lg:self-start">
            <Skeleton className="h-5 w-24 rounded-sm" />
            <div className="flex flex-col gap-4 rounded-xl border bg-card p-4">
              <div className="flex flex-col gap-1.5">
                <Skeleton className="h-3 w-16 rounded-sm" />
                <Skeleton className="h-4 w-28 rounded-sm" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Skeleton className="h-3 w-16 rounded-sm" />
                <Skeleton className="h-4 w-24 rounded-sm" />
              </div>
            </div>
          </aside>
        </Container>
      </div>
    </article>
  );
}
