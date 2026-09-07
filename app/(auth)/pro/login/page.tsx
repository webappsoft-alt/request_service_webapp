import { AuthForm } from "@/components/auth/auth-form";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  title: "Provider Login",
  description: "Sign in to the Request Services provider portal.",
  path: "/pro/login",
  index: false,
  follow: false,
});

export default function ProviderLoginPage() {
  return <AuthForm role="provider" mode="login" />;
}
