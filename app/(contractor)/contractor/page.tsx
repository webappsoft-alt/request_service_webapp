import { redirect } from "next/navigation";
import { contractorPaths } from "@/lib/contractor-paths";

export default function ContractorIndexPage() {
  redirect(contractorPaths.dashboard);
}
