import { Container } from "@/components/layout/container";
import { ServiceJobCardSkeletonList } from "@/components/shared/loading-skeletons";

export default function ServicesLoading() {
  return (
    <Container className="py-8">
      <div className="mb-6 space-y-2">
        <div className="h-7 w-48 animate-pulse rounded-md bg-muted" />
        <div className="h-4 w-64 animate-pulse rounded-md bg-muted" />
      </div>
      <ServiceJobCardSkeletonList count={6} layout="list" />
    </Container>
  );
}
