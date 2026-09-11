import { CustomerOrdersView } from "@/components/account/customer-orders-view";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  title: "My Orders",
  description: "Private account page for your Request Services bookings.",
  path: "/account/orders",
  index: false,
  follow: false,
});

export default function CustomerOrdersPage() {
  return <CustomerOrdersView />;
}
