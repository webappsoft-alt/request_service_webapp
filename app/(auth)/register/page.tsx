import { CustomerRegisterForm } from "@/components/auth/customer-register-form";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  title: "Create a Customer Account",
  description: "Register as a homeowner to save service requests, estimates, and payment history.",
  path: "/register",
  index: false,
  follow: false,
});

export default function CustomerRegisterPage() {
  return <CustomerRegisterForm />;
}
