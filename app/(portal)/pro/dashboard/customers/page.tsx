import { CustomersView } from "@/components/portal/views/customers-view";
import { portalMetadata } from "@/lib/portal-meta";

export const metadata = portalMetadata(
  "Customers",
  "Household records, addresses, and service history.",
  "/pro/dashboard/customers",
);

export default function CustomersPage() {
  return <CustomersView />;
}
