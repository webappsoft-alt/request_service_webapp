import { PortfolioFormView } from "@/components/portal/views/portfolio-view";
import { portalMetadata } from "@/lib/portal-meta";

export const metadata = portalMetadata(
  "Add a portfolio project",
  "Create a showcase project customers can browse on your profile.",
  "/pro/dashboard/portfolio/new",
);

export default function NewPortfolioPage() {
  return <PortfolioFormView />;
}
