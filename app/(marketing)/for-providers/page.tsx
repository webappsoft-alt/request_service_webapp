import { redirect } from "next/navigation";
import { proPaths } from "@/lib/pro-paths";

export default function ForProvidersRedirect() {
  redirect(proPaths.home);
}
