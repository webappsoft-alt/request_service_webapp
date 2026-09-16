import { redirect } from "next/navigation";
import { customerPaths } from "@/lib/customer-paths";
import type { PageParams } from "@/lib/page-props";

export default async function CustomerOrderDetailPage({
  params,
}: PageParams<{ id: string }>) {
  const { id } = await params;
  redirect(customerPaths.order(id));
}
