import { TechnicianProfileView } from "@/components/technician/views/technician-profile-view";
import { portalMetadata } from "@/lib/portal-meta";

export const metadata = portalMetadata("Profile", "Your technician profile.", "/technical/profile");

export default function TechnicianProfilePage() {
  return <TechnicianProfileView />;
}
