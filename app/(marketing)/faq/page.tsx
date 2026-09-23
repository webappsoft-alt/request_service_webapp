import { FaqPageContent } from "@/components/shared/faq-page-content";
import { PageHeader } from "@/components/shared/section-header";
import { JsonLd } from "@/components/seo/json-ld";
import { breadcrumbJsonLd } from "@/lib/json-ld";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  title: "Frequently Asked Questions",
  description:
    "Answers for customers and providers covering bookings, estimates, payments, subscriptions, and jobs on Request Service.",
  path: "/faq",
});

export default function FaqPage() {
  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "FAQ", path: "/faq" },
        ])}
      />
      <PageHeader
        eyebrow="FAQ"
        title="Questions, organized by how the product actually works"
        description="These answers describe the intended operating model. Live billing and dispatch will follow the same rules."
        breadcrumbs={[
          { label: "Home", href: "/" },
          { label: "FAQ" },
        ]}
      />
      <FaqPageContent />
    </>
  );
}
