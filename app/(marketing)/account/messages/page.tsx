import { redirect } from "next/navigation";
import { customerPaths } from "@/lib/customer-paths";

export default function CustomerMessagesPage() {
  redirect(customerPaths.messages);
}
