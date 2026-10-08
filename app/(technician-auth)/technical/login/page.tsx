import { TechnicianLoginView } from "@/components/technician/views/technician-login-view";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  title: "Technician Login",
  description: "Sign in to the Request Service technician portal.",
  path: "/technical/login",
  index: false,
  follow: false,
});

export default function TechnicianLoginPage() {
  return <TechnicianLoginView />;
}
