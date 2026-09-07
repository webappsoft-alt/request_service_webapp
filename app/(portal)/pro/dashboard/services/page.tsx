import { ServicesView } from "@/components/portal/views/services-view";
import { portalMetadata } from "@/lib/portal-meta";

export const metadata = portalMetadata(
  "Fixed services",
  "Create and edit the priced services on your public profile.",
  "/pro/dashboard/services",
);

export default function ServicesPage() {
  return <ServicesView />;
}
