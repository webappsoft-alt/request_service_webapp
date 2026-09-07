import { Container } from "@/components/layout/container";
import { FaqList } from "@/components/shared/faq-list";
import { PageHeader } from "@/components/shared/section-header";
import { JsonLd } from "@/components/seo/json-ld";
import { faqCategories, faqs, getFaqsByCategory } from "@/lib/data/content";
import { breadcrumbJsonLd, faqJsonLd } from "@/lib/json-ld";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  title: "Frequently Asked Questions",
  description:
    "Answers for customers and providers covering bookings, estimates, payments, subscriptions, and jobs on Request Services.",
  path: "/faq",
});

export default function FaqPage() {
  return (
    <>
      <JsonLd
        data={[
          faqJsonLd(faqs),
          breadcrumbJsonLd([
            { name: "Home", path: "/" },
            { name: "FAQ", path: "/faq" },
          ]),
        ]}
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
      <div className="section-space">
        <Container className="flex flex-col gap-12">
          {faqCategories.map((category) => (
            <section key={category.id} id={category.id} className="flex flex-col gap-4">
              <h2 className="text-2xl">{category.label}</h2>
              <FaqList items={getFaqsByCategory(category.id)} />
            </section>
          ))}
        </Container>
      </div>
    </>
  );
}
