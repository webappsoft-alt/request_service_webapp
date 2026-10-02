import { redirect } from "next/navigation";
import { portalMetadata } from "@/lib/portal-meta";

export const metadata = portalMetadata(
  "Estimates",
  "Draft, sent, accepted, and expired written estimates.",
  "/pro/dashboard/new-estimate",
);

export default function EstimatesPage() {
  redirect("/pro/dashboard/new-estimate");
}
