import { AuthForm } from "@/components/auth/auth-form";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  title: "Forgot Password",
  description: "Request a password reset for your Request Services account.",
  path: "/forgot-password",
  index: false,
  follow: false,
});

export default function ForgotPasswordPage() {
  return <AuthForm role="customer" mode="forgot" />;
}
