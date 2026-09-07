import { ProviderRegisterWizard } from "@/components/auth/provider-register-wizard";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  title: "Join as a Pro",
  description: "Create a provider account, add your company profile, and choose the services you offer.",
  path: "/pro/register",
  index: false,
  follow: false,
});

export default function ProviderRegisterPage() {
  return <ProviderRegisterWizard />;
}
