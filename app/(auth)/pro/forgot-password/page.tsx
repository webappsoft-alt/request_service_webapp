import { AuthForm } from "@/components/auth/auth-form";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  title: "Provider Forgot Password",
  description: "Request a password reset for your Request Services provider account.",
  path: "/pro/forgot-password",
  index: false,
  follow: false,
});

export default function ProviderForgotPasswordPage() {
  return <AuthForm role="provider" mode="forgot" />;
}
