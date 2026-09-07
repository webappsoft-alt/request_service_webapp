import { Container } from "@/components/layout/container";
import { Section } from "@/components/layout/container";
import { CtaBanner } from "@/components/shared/cta-banner";
import { PageHeader } from "@/components/shared/section-header";
import { SectionHeader } from "@/components/shared/section-header";
import { JsonLd } from "@/components/seo/json-ld";
import { customerWorkflow, providerWorkflow } from "@/lib/data/navigation";
import { breadcrumbJsonLd } from "@/lib/json-ld";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  title: "How Request Services Works",
  description:
    "See the customer path from service request to payment, and the provider path from profile creation through reporting.",
  path: "/how-it-works",
});

export default function HowItWorksPage() {
  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "How It Works", path: "/how-it-works" },
        ])}
      />
      <PageHeader
        eyebrow="How it works"
        title="Two workflows. One product."
        description="Customers request and approve work. Providers quote, complete, invoice, and get paid. Extra materials never overwrite the original estimate."
        breadcrumbs={[
          { label: "Home", href: "/" },
          { label: "How it works" },
        ]}
      />
      <Section>
        <Container className="flex flex-col gap-8">
          <SectionHeader
            eyebrow="Customers"
            title="From choosing a service to paying the invoice"
          />
          <ol className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {customerWorkflow.map((item) => (
              <li key={item.step} className="rounded-xl border bg-card p-5">
                <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  Step {item.step}
                </p>
                <h2 className="mt-2 text-lg font-medium">{item.title}</h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.body}</p>
              </li>
            ))}
          </ol>
        </Container>
      </Section>
      <Section tone="muted">
        <Container className="flex flex-col gap-8">
          <SectionHeader
            eyebrow="Providers"
            title="From business profile to performance tracking"
          />
          <ol className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
            {providerWorkflow.map((item) => (
              <li key={item.step} className="rounded-xl border bg-background p-5">
                <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  Step {item.step}
                </p>
                <h2 className="mt-2 text-base font-medium">{item.title}</h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.body}</p>
              </li>
            ))}
          </ol>
        </Container>
      </Section>
      <CtaBanner
        title="Start on the path that matches you"
        description="Homeowners can request service now. Providers can create an account and review subscription plans."
        primary={{ href: "/request-service", label: "Request service" }}
        secondary={{ href: "/pro", label: "Join as a pro" }}
      />
    </>
  );
}
