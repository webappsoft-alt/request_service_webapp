import { redirect } from "next/navigation";
import { contractorPaths } from "@/lib/contractor-paths";

/**
 * Fixed-price orders now live inside Assigned Jobs (All · Jobs · Fixed price filter), so the
 * old list URL (bookmarks, "Removed from order" notifications) opens Jobs. Order detail pages
 * (/contractor/orders/[id]) are unchanged.
 * Previous: rendered <OrdersView viewer="contractor" /> as its own "Fixed Orders" page.
 */
export default function ContractorOrdersPage() {
  redirect(contractorPaths.jobs);
}
