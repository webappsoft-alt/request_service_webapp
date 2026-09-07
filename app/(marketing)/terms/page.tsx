import { Container } from "@/components/layout/container";
import { PageHeader } from "@/components/shared/section-header";
import { buildMetadata } from "@/lib/seo";
import { siteConfig } from "@/lib/site";

export const metadata = buildMetadata({
  title: "Terms of Service",
  description: `Placeholder terms of use for the ${siteConfig.name} public website and future provider portal.`,
  path: "/terms",
});

export default function TermsPage() {
  return (
    <>
      <PageHeader
        eyebrow="Legal"
        title="Terms of Service"
        description="These terms are a Phase 1 placeholder and do not constitute a live customer or provider agreement."
        breadcrumbs={[
          { label: "Home", href: "/" },
          { label: "Terms of Service" },
        ]}
      />
      <div className="section-space">
        <Container className="flex flex-col gap-5 text-sm leading-7 text-muted-foreground">
          <p>
            The public website is provided for evaluation of the Request Services product. Marketplace listings, reviews, testimonials, and prices are demo or placeholder content unless stated otherwise.
          </p>
          <p>
            Provider subscriptions, payments, and portal access will be governed by a later agreement. Customers remain responsible for evaluating professionals before approving work.
          </p>
          <p>
            {siteConfig.legalName} does not currently perform the underlying home services. Licensed local businesses do.
          </p>
        </Container>
      </div>
    </>
  );
}
