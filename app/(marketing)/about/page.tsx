import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Container } from "@/components/layout/container";
import { Section } from "@/components/layout/container";
import { CtaBanner } from "@/components/shared/cta-banner";
import { PageHeader } from "@/components/shared/section-header";
import { JsonLd } from "@/components/seo/json-ld";
import { breadcrumbJsonLd } from "@/lib/json-ld";
import { buildMetadata } from "@/lib/seo";
import { siteConfig } from "@/lib/site";

export const metadata = buildMetadata({
  title: "About Request Services",
  description:
    "Request Services is a USA-focused marketplace and operations platform for home-service businesses and the homeowners who hire them.",
  path: "/about",
});

export default function AboutPage() {
  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "About", path: "/about" },
        ])}
      />
      <PageHeader
        eyebrow="About"
        title="A professional marketplace with an operating system behind it"
        description={`${siteConfig.name} exists so homeowners can hire with a written record, and so local service companies can run estimates, jobs, invoices, and payments without improvising the process.`}
        breadcrumbs={[
          { label: "Home", href: "/" },
          { label: "About" },
        ]}
      />
      <Section>
        <Container className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Mission</CardTitle>
              <CardDescription>
                Make home-service work easier to request, easier to quote, and easier to complete with a preserved financial trail.
              </CardDescription>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Platform purpose</CardTitle>
              <CardDescription>
                Connect customers with local professionals, then give those professionals a subscription portal for the rest of the job lifecycle.
              </CardDescription>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Customer value</CardTitle>
              <CardDescription>
                Search by service and ZIP, review a company profile, receive an itemized estimate, approve digitally, and pay against a clear invoice.
              </CardDescription>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Provider value</CardTitle>
              <CardDescription>
                A public profile that matches the operating account, plus tools for requests, customers, change orders, invoices, payments, and reports.
              </CardDescription>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Trust</CardTitle>
              <CardDescription>
                The public site does not invent performance statistics. Demo reviews and testimonials are labeled until live accounts produce real records.
              </CardDescription>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Technology</CardTitle>
              <CardDescription>
                A single design system for the marketing site, customer experience, and provider portal. Data models are already shaped for API connection.
              </CardDescription>
            </CardHeader>
          </Card>
        </Container>
      </Section>
      <CtaBanner
        title="See the product from either side"
        description="Homeowners can search the marketplace. Service businesses can review the provider platform and placeholder plans."
        primary={{ href: "/find-a-professional", label: "Find a professional" }}
        secondary={{ href: "/pro", label: "For providers" }}
      />
    </>
  );
}
