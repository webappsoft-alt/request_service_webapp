import { ProviderRegisterWizard } from "@/components/auth/provider-register-wizard";
import { proPaths } from "@/lib/pro-paths";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  title: "Join as a Pro | Create Your Contractor Account",
  description: "Create a Pro account, add your company profile, and choose the services you offer.",
  path: proPaths.join,
});

export default function ProviderRegisterPage() {
  return <ProviderRegisterWizard />;
}
