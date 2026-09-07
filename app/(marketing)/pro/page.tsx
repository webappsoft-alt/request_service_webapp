import { HomeMotion } from "@/components/home/home-motion";
import { Container, Section } from "@/components/layout/container";
import { ProClose } from "@/components/pro/pro-close";
import { ProHero } from "@/components/pro/pro-hero";
import { ProProduct } from "@/components/pro/pro-product";
import { ProWorkflow } from "@/components/pro/pro-workflow";
import { FaqList } from "@/components/shared/faq-list";
import { PricingCard } from "@/components/shared/pricing-card";
import { JsonLd } from "@/components/seo/json-ld";
import { faqs } from "@/lib/data/content";
import { getActivePlans } from "@/lib/data/plans";
import { breadcrumbJsonLd, faqJsonLd } from "@/lib/json-ld";
import { proPaths } from "@/lib/pro-paths";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  title: "Join as a Pro | Business Software for Home Service Companies",
  description:
    "Put your company in front of local homeowners, then run requests, estimates, jobs, invoices, and your crew from one portal. No commission on the work you win.",
  path: proPaths.home,
  keywords: [
    "join as a pro",
    "service business software",
    "contractor estimates",
    "field service management",
    "home service CRM",
    "invoice software for contractors",
  ],
});

const proFaqIds = [
  "faq_p_4",
  "faq_p_5",
  "faq_p_6",
  "faq_p_7",
  "faq_p_8",
  "faq_p_9",
] as const;

const providerFaqs = proFaqIds
  .map((id) => faqs.find((item) => item.id === id))
  .filter((item): item is NonNullable<typeof item> => Boolean(item));

export default function ProLandingPage() {

  return (
    <>
      <JsonLd
        data={[
          breadcrumbJsonLd([
            { name: "Home", path: "/" },
            { name: "For Professionals", path: proPaths.home },
          ]),
          faqJsonLd(providerFaqs),
        ]}
      />
      <HomeMotion>
        <ProHero />
        <ProWorkflow />
        <ProProduct />

        <Section id="plans" density="tight">
          <Container className="flex flex-col gap-8">
            <div className="flex max-w-2xl flex-col gap-3">
              <p className="eyebrow text-primary">Subscription</p>
              <h2 className="text-3xl font-semibold tracking-tight md:text-[2.5rem]">
                Straightforward monthly plans
              </h2>
              <p className="max-w-xl text-sm leading-7 text-muted-foreground">
                Every plan includes the public profile, request matching, and the full desk above.
                Cancel anytime.
              </p>
            </div>
            <div className="mx-auto grid w-full max-w-7xl gap-5 md:grid-cols-3">
              {getActivePlans().map((plan) => (
                <PricingCard key={plan.id} plan={plan} />
              ))}
            </div>
          </Container>
        </Section>

        <Section id="faq" density="tight">
          <Container className="grid items-start gap-12 lg:grid-cols-[minmax(0,21rem)_minmax(0,1fr)] lg:gap-20">
            <div className="flex flex-col gap-5 lg:sticky lg:top-28">
              <p className="eyebrow text-primary">FAQ</p>
              <h2 className="text-3xl font-semibold tracking-tight md:text-[2.5rem]">
                Questions from the office
              </h2>
              <p className="max-w-sm text-sm leading-7 text-muted-foreground">
                Short answers on accounts, subscriptions, and how work reaches your portal.
              </p>
            </div>
            <FaqList items={providerFaqs} variant="cards" />
          </Container>
        </Section>

        <ProClose />
      </HomeMotion>
    </>
  );
}
