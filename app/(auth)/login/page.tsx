import { AuthForm } from "@/components/auth/auth-form";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  title: "Customer Login",
  description: "Sign in to your Request Services customer account to review estimates, approvals, and jobs.",
  path: "/login",
  index: false,
  follow: false,
});

export default function CustomerLoginPage() {
  return <AuthForm role="customer" mode="login" />;
}
