import { AuthForm } from "@/components/auth/auth-form";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  title: "Reset Password",
  description: "Choose a new password for your Request Services account.",
  path: "/reset-password",
  index: false,
  follow: false,
});

export default function ResetPasswordPage() {
  return <AuthForm role="customer" mode="reset" />;
}
