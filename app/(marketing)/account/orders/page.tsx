import { redirect } from "next/navigation";
import { customerPaths } from "@/lib/customer-paths";

export default function CustomerOrdersPage() {
  redirect(customerPaths.orders);
}
