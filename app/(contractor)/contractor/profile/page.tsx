import { ContractorProfileView } from "@/components/contractor/views/contractor-profile-view";
import { portalMetadata } from "@/lib/portal-meta";

export const metadata = portalMetadata("Profile", "Your contractor profile.", "/contractor/profile");

export default function ContractorProfilePage() {
  return <ContractorProfileView />;
}
