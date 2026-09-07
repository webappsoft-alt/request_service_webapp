import Link from "next/link";
import { ArrowRight, AtSign, Clock, Mail, MapPin, Phone } from "lucide-react";
import { Container } from "@/components/layout/container";
import { Button } from "@/components/ui/button";
import { ContactForm } from "@/components/contact/contact-form";
import { FaqList } from "@/components/shared/faq-list";
import { JsonLd } from "@/components/seo/json-ld";
import { faqs } from "@/lib/data/content";
import { breadcrumbJsonLd } from "@/lib/json-ld";
import { buildMetadata } from "@/lib/seo";
import { siteConfig } from "@/lib/site";

export const dynamic = "force-dynamic";

export const metadata = buildMetadata({
  title: "Contact Request Services",
  description: `Have a question or need support? Contact ${siteConfig.name} by form, email, or phone.`,
  path: "/contact",
});

const contactFaqs = faqs.filter((item) =>
  ["customers", "bookings", "estimates"].includes(item.category)
);

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

          <div className="mt-1 flex flex-col gap-2 sm:flex-row sm:items-center">
            <Button size="xl" asChild>
              <a href="#contact-form">
                Send a message
                <ArrowRight data-icon="inline-end" />
              </a>
            </Button>
            <Button size="xl" variant="outline" asChild>
              <a href={`mailto:${siteConfig.email}`}>Email us</a>
            </Button>
          </div>

          <dl className="mt-2 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm">
            <div className="flex items-center gap-1.5">
              <Mail className="size-3.5 text-muted-foreground" aria-hidden="true" />
              <dd className="font-medium">{siteConfig.email}</dd>
            </div>
            <div className="flex items-center gap-1.5">
              <Phone className="size-3.5 text-muted-foreground" aria-hidden="true" />
              <dd className="font-medium">{siteConfig.phone}</dd>
            </div>
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Clock className="size-3.5" aria-hidden="true" />
              <dd>Mon–Fri, 8am–6pm</dd>
            </div>
          </dl>
        </Container>
      </section>

      <section className="py-10 md:py-12">
        <Container className="flex flex-col gap-8">
          <h2 className="text-center text-2xl font-semibold md:text-[1.7rem]">
            How would you like to connect?
          </h2>
          <div className="mx-auto grid w-full max-w-3xl gap-6 md:grid-cols-2">
            <article className="flex items-center gap-5 rounded-xl border bg-card px-6 py-7 shadow-sm">
              <Mail className="size-10 shrink-0 text-primary" aria-hidden="true" />
              <div className="min-w-0">
                <h3 className="text-lg font-semibold">Send a message</h3>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  We’ll get back to you as soon as possible.
                </p>
                <a
                  href="#contact-form"
                  className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-brand hover:underline"
                >
                  Send a message
                  <ArrowRight className="size-3.5" aria-hidden="true" />
                </a>
              </div>
            </article>
            <article className="flex items-center gap-5 rounded-xl border bg-card px-6 py-7 shadow-sm">
              <AtSign className="size-10 shrink-0 text-primary" aria-hidden="true" />
              <div className="min-w-0">
                <h3 className="text-lg font-semibold">Send an email</h3>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  Reach us anytime at {siteConfig.email}
                </p>
                <a
                  href={`mailto:${siteConfig.email}`}
                  className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-brand hover:underline"
                >
                  Send an email
                  <ArrowRight className="size-3.5" aria-hidden="true" />
                </a>
              </div>
            </article>
          </div>
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

          <aside className="rounded-xl border bg-card p-6 shadow-sm md:p-8">
            <h2 className="mb-8 text-2xl font-semibold">Other ways to reach us</h2>
            <ul className="flex flex-col gap-8">
              <li className="grid grid-cols-[2.5rem_minmax(0,1fr)] gap-4">
                <Clock className="mt-0.5 size-6 text-muted-foreground" aria-hidden="true" />
                <div>
                  <h3 className="font-semibold">Business Hours</h3>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    Mon – Fri: 8:00 AM – 6:00 PM
                  </p>
                </div>
              </li>
              <li className="grid grid-cols-[2.5rem_minmax(0,1fr)] gap-4">
                <Mail className="mt-0.5 size-6 text-muted-foreground" aria-hidden="true" />
                <div>
                  <h3 className="font-semibold">Email</h3>
                  <p className="mt-1 text-sm leading-6">
                    <a href={`mailto:${siteConfig.email}`} className="font-medium text-brand hover:underline">
                      {siteConfig.email}
                    </a>
                  </p>
                </div>
              </li>
              <li className="grid grid-cols-[2.5rem_minmax(0,1fr)] gap-4">
                <MapPin className="mt-0.5 size-6 text-muted-foreground" aria-hidden="true" />
                <div>
                  <h3 className="font-semibold">Mailing Address</h3>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    {siteConfig.address.street}
                    <br />
                    {siteConfig.address.city}, {siteConfig.address.state}{" "}
                    {siteConfig.address.postalCode}
                  </p>
                </div>
              </li>
              <li className="grid grid-cols-[2.5rem_minmax(0,1fr)] gap-4">
                <Phone className="mt-0.5 size-6 text-muted-foreground" aria-hidden="true" />
                <div>
                  <h3 className="font-semibold">Phone</h3>
                  <p className="mt-1 text-sm leading-6">
                    <a href={siteConfig.phoneHref} className="font-medium text-brand hover:underline">
                      {siteConfig.phone}
                    </a>
                  </p>
                </div>
              </li>
            </ul>
          </aside>
        </Container>
      </section>

      <section className="bg-muted/60 py-14 md:py-16">
        <Container className="grid items-start gap-10 lg:grid-cols-[17.5rem_minmax(0,1fr)] lg:gap-14">
          <div>
            <h2 className="text-2xl font-semibold leading-tight md:text-[1.7rem]">
              Frequently Asked Questions
            </h2>
            <p className="mt-4 text-sm leading-7 text-muted-foreground md:text-base">
              Find answers to common questions about Request Services and how we
              can help you succeed.
            </p>
          </div>
          <FaqList items={contactFaqs} variant="cards" />
        </Container>
      </section>
    </>
  );
}
