import { Container } from "@/components/layout/container";
import { PageHeader } from "@/components/shared/section-header";
import { buildMetadata } from "@/lib/seo";
import { siteConfig } from "@/lib/site";

export const metadata = buildMetadata({
  title: "Privacy Policy",
  description: `How ${siteConfig.name} intends to handle personal information as the marketplace and provider portal come online.`,
  path: "/privacy",
});

export default function PrivacyPage() {
  return (
    <>
      <PageHeader
        eyebrow="Legal"
        title="Privacy Policy"
        description="This is a Phase 1 placeholder policy for the public website. It will be replaced with counsel-reviewed terms before launch."
        breadcrumbs={[
          { label: "Home", href: "/" },
          { label: "Privacy Policy" },
        ]}
      />
      <div className="section-space">
        <Container className="flex flex-col gap-5 text-sm leading-7 text-muted-foreground">
          <p>
            {siteConfig.name} collects only the information you submit through public forms, such as name, email, ZIP code, and service details. Demo submissions on this Phase 1 site are not dispatched to providers.
          </p>
          <p>
            We use that information to operate the marketplace, respond to inquiries, and — when accounts are connected — to match requests, estimates, jobs, and invoices.
          </p>
          <p>
            We do not sell personal information. Service providers who receive a request will see the details needed to quote and perform the work.
          </p>
          <p>
            Contact {siteConfig.email} for privacy questions.
          </p>
        </Container>
      </div>
    </>
  );
}
