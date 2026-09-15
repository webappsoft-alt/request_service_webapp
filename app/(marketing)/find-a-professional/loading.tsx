import { ProviderCardSkeletonGrid } from "@/components/shared/loading-skeletons";

export default function FindProfessionalLoading() {
  return (
    <div className="container-site flex flex-col gap-4 py-6">
      <div className="h-10 w-full max-w-xl animate-pulse rounded-lg bg-muted" />
      <div className="space-y-2">
        <div className="h-6 w-64 animate-pulse rounded-md bg-muted" />
        <div className="h-4 w-32 animate-pulse rounded-md bg-muted" />
      </div>
      <ProviderCardSkeletonGrid count={6} className="xl:grid-cols-2" />
    </div>
  );
}
