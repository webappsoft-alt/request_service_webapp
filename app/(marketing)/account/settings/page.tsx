import { redirect } from "next/navigation";
import { customerPaths } from "@/lib/customer-paths";

export default function AccountSettingsPage() {
  redirect(customerPaths.settings);
}
