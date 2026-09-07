import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Container, Section } from "@/components/layout/container";
import { FaqList } from "@/components/shared/faq-list";
import { JsonLd } from "@/components/seo/json-ld";
import { faqs } from "@/lib/data/content";
import { faqJsonLd } from "@/lib/json-ld";

const homeFaqIds = [
  "faq_c_1",
  "faq_c_3",
  "faq_b_1",
  "faq_e_1",
  "faq_e_2",
  "faq_pay_1",
] as const;

const homeFaqs = homeFaqIds
  .map((id) => faqs.find((item) => item.id === id))
  .filter((item): item is NonNullable<typeof item> => Boolean(item));

export function HomeFaqSection() {
  return (
    <Section>
      <JsonLd data={faqJsonLd(homeFaqs)} />
      <Container className="grid items-start gap-12 lg:grid-cols-[minmax(0,21rem)_minmax(0,1fr)] lg:gap-20">
        <div className="flex flex-col gap-5 lg:sticky lg:top-28">
          <p className="eyebrow text-primary">FAQ</p>
          <h2 className="text-3xl font-semibold tracking-tight md:text-[2.5rem]">
            Questions before you request
          </h2>
          <p className="max-w-sm text-sm leading-7 text-muted-foreground">
            How matching works, what a written estimate includes, and how you pay once the job is
            done.
          </p>
          <Link
            href="/faq"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-brand transition-colors hover:text-foreground"
          >
            See all questions
            <ArrowRight className="size-3.5" aria-hidden="true" />
          </Link>
        </div>

        <FaqList items={homeFaqs} variant="cards" />
      </Container>
    </Section>
  );
}
