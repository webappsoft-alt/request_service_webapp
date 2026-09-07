import { ServiceFormView } from "@/components/portal/views/services-view";
import { portalMetadata } from "@/lib/portal-meta";

export const metadata = portalMetadata(
  "Add a fixed service",
  "Create a priced service customers can request from your profile.",
  "/pro/dashboard/services/new",
);

export default function NewServicePage() {
  return <ServiceFormView />;
}
