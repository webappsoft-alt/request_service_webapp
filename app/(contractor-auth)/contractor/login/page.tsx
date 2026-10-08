import { ContractorLoginView } from "@/components/contractor/views/contractor-login-view";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  title: "Contractor Login",
  description: "Sign in to the Request Service contractor portal.",
  path: "/contractor/login",
  index: false,
  follow: false,
});

export default function ContractorLoginPage() {
  return <ContractorLoginView />;
}
