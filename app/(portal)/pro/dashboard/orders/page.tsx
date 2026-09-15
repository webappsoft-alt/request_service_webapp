import { PortalSuspense } from "@/components/portal/portal-suspense";
import { OrdersView } from "@/components/portal/views/orders-view";
import { portalMetadata } from "@/lib/portal-meta";

export const metadata = portalMetadata(
  "Fixed service orders",
  "Manage provider assigned fixed service orders, transit, and execution.",
  "/pro/dashboard/orders",
);

export default function OrdersPage() {
  return (
    <PortalSuspense>
      <OrdersView />
    </PortalSuspense>
  );
}
