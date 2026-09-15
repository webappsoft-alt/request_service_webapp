import { Container } from "@/components/layout/container";
import { ProfessionalDetailSkeleton } from "@/components/shared/loading-skeletons";

export default function ProfessionalLoading() {
  return (
    <Container className="py-16">
      <ProfessionalDetailSkeleton />
    </Container>
  );
}
