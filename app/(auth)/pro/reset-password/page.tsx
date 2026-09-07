import { AuthForm } from "@/components/auth/auth-form";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  title: "Provider Reset Password",
  description: "Choose a new password for your Request Services provider account.",
  path: "/pro/reset-password",
  index: false,
  follow: false,
});

export default function ProviderResetPasswordPage() {
  return <AuthForm role="provider" mode="reset" />;
}
