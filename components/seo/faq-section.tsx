import { Container, Section } from "@/components/layout/container";
import { JsonLd } from "@/components/seo/json-ld";
import { FaqList } from "@/components/shared/faq-list";
import { SectionHeader } from "@/components/shared/section-header";
import { faqJsonLd } from "@/lib/json-ld";
import type { FaqItem } from "@/lib/types";

/** Visible FAQ accordion + matching FAQPage JSON-LD (same questions, same answers). */
export function FaqSection({
  title,
  description,
  items,
}: {
  title: string;
  description?: string;
  items: FaqItem[];
}) {
  if (!items.length) return null;
  return (
    <Section density="tight">
      <JsonLd data={faqJsonLd(items)} />
      <Container className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <SectionHeader eyebrow="FAQ" title={title} description={description} />
        <FaqList items={items} variant="cards" />
      </Container>
    </Section>
  );
}
