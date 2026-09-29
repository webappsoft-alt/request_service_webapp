import Link from "next/link";
import { Container } from "@/components/layout/container";
import { ContactForm } from "@/components/contact/contact-form";
import { ContactFaqList } from "@/components/contact/contact-faq-list";
import {
  ContactConnectCards,
  ContactHeroActions,
  ContactReachAside,
} from "@/components/contact/contact-reach";
import { JsonLd } from "@/components/seo/json-ld";
import { breadcrumbJsonLd } from "@/lib/json-ld";
import { buildMetadata } from "@/lib/seo";
import { siteConfig } from "@/lib/site";

export const dynamic = "force-dynamic";

export const metadata = buildMetadata({
  title: "Contact Request Service",
  description: `Have a question or need support? Contact ${siteConfig.name} by form, email, or phone.`,
  path: "/contact",
});

export default function ContactPage() {
  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Contact", path: "/contact" },
        ])}
      />

      <section className="relative isolate overflow-hidden border-b">
        <div
          className="page-wash pointer-events-none absolute inset-0 -z-10"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute inset-0 -z-10 bg-primary/10"
          aria-hidden="true"
        />
        <div
          className="hero-grid pointer-events-none absolute inset-0 -z-10"
          aria-hidden="true"
        />

        <Container className="flex flex-col items-center gap-4 py-10 text-center md:py-14">
          <nav aria-label="Breadcrumb">
            <ol className="flex items-center gap-2 text-sm text-muted-foreground">
              <li>
                <Link href="/" className="transition-colors hover:text-primary">
                  Home
                </Link>
              </li>
              <li aria-hidden="true">/</li>
              <li className="font-medium text-foreground" aria-current="page">
                Contact
              </li>
            </ol>
          </nav>

          <h1 className="text-3xl font-semibold md:text-[2.75rem]">
            We’re here to help
          </h1>
          <p className="max-w-xl text-sm text-muted-foreground md:text-base">
            Have a question, need support, or want to learn more about Request
            Services? Send a message and the team will get back to you.
          </p>

          <ContactHeroActions />
        </Container>
      </section>

      <section className="py-10 md:py-12">
        <Container className="flex flex-col gap-8">
          <h2 className="text-center text-2xl font-semibold md:text-[1.7rem]">
            How would you like to connect?
          </h2>
          <ContactConnectCards />
        </Container>
      </section>

      <section className="pb-14 md:pb-16">
        <Container className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.65fr)_minmax(18rem,0.95fr)]">
          <div className="rounded-xl border bg-card p-6 shadow-sm md:p-8">
            <h2 className="text-2xl font-semibold">Send us a message</h2>
            <p className="mt-2 mb-7 text-muted-foreground">
              Fill out the form below and we’ll get back to you shortly.
            </p>
            <ContactForm />
          </div>

          <ContactReachAside />
        </Container>
      </section>

      <section className="bg-muted/60 py-14 md:py-16">
        <Container className="grid items-start gap-10 lg:grid-cols-[17.5rem_minmax(0,1fr)] lg:gap-14">
          <div>
            <h2 className="text-2xl font-semibold leading-tight md:text-[1.7rem]">
              Frequently Asked Questions
            </h2>
            <p className="mt-4 text-sm leading-7 text-muted-foreground md:text-base">
              Find answers to common questions about Request Service and how we
              can help you succeed.
            </p>
          </div>
          <ContactFaqList />
        </Container>
      </section>
    </>
  );
}
