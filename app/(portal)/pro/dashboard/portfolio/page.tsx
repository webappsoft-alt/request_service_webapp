import { PortfolioView } from "@/components/portal/views/portfolio-view";
import { portalMetadata } from "@/lib/portal-meta";

export const metadata = portalMetadata(
  "Portfolio",
  "Create and edit showcase projects on your public profile.",
  "/pro/dashboard/portfolio",
);

export default function PortfolioPage() {
  return <PortfolioView />;
}
