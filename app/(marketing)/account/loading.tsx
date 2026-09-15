import { Container } from "@/components/layout/container";
import { CustomerOrderCardSkeleton } from "@/components/shared/loading-skeletons";

export default function AccountLoading() {
  return (
    <Container className="max-w-6xl space-y-6 py-10">
      <div className="space-y-2">
        <div className="h-8 w-48 animate-pulse rounded-md bg-muted" />
        <div className="h-4 w-72 animate-pulse rounded-md bg-muted" />
      </div>
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <CustomerOrderCardSkeleton key={i} />
        ))}
      </div>
    </Container>
  );
}
