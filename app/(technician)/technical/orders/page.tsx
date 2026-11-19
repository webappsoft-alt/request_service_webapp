import { redirect } from "next/navigation";
import { technicianPaths } from "@/lib/technician-paths";

/**
 * Fixed-price orders now live inside Jobs (All · Jobs · Fixed price filter), so the old list
 * URL (bookmarks, "Removed from order" notifications) opens Jobs. Order detail pages
 * (/technical/orders/[id]) are unchanged.
 * Previous: rendered <OrdersView viewer="technician" /> as its own "Fixed Orders" page.
 */
export default function TechnicianOrdersPage() {
  redirect(technicianPaths.jobs);
}
