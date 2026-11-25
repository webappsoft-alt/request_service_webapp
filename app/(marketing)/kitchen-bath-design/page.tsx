import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  Camera,
  Check,
  LockKeyhole,
  Palette,
  ShieldCheck,
  Sparkles,
  WandSparkles,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Container, Section } from "@/components/layout/container";
import { HomeMotion } from "@/components/home/home-motion";
import { BeforeAfterSlider } from "@/components/ai-redesigner/before-after-slider";
import { RedesignerWizard } from "@/components/ai-redesigner/redesigner-wizard";
import { CustomizeShowcase, StyleShowcase, TryItNowButton } from "@/components/ai-redesigner/kitchen-bath-sections";
import { DESIGNER_ANCHOR } from "@/components/ai-redesigner/designer-events";
import { FaqList } from "@/components/shared/faq-list";
import { JsonLd } from "@/components/seo/json-ld";
import { breadcrumbJsonLd, faqJsonLd } from "@/lib/json-ld";
import { AI_DESIGNER_LIVE, AI_DESIGNER_PATH } from "@/lib/api/ai-redesigner-client";
import { fetchRedesignCatalogForSeo } from "@/lib/data/public-ai-redesigner";
import { KITCHEN_BATH_FAQ_DOMAIN, fetchFaqsForDomain } from "@/lib/data/public-faqs";
import type { FaqItem } from "@/lib/types";
import type { RedesignCatalog } from "@/lib/api/ai-redesigner-client";
import { buildMetadata } from "@/lib/seo";

const PATH = AI_DESIGNER_PATH; // "/kitchen-bath-design"
const PAGE_NAME = "Kitchen & Bath Design";
/** Hero backdrop: a remodeled kitchen opening onto a bathroom, with finish samples on the island (2026-11-25). */
const HERO_BACKDROP_IMAGE = "/images/home/kitchen-bath-design-hero.jpg";
/** Showcase photo until the admin has a before/after pair. */
const FALLBACK_HERO_IMAGE = "/images/home/rs-ai-kitchen-repair.jpg";

export const metadata = buildMetadata({
  title: "AI Kitchen & Bathroom Design Tool",
  description:
    "Upload a photo of your kitchen or bathroom, choose a style and finishes, and preview an AI redesign in seconds. Then get written quotes from verified local pros.",
  path: PATH,
  keywords: [
    "AI kitchen design tool",
    "AI bathroom design tool",
    "kitchen remodel visualizer",
    "bathroom remodel visualizer",
    "kitchen and bath design",
  ],
});

const HOW_IT_WORKS: { icon: LucideIcon; title: string; body: string; status: string }[] = [
  {
    icon: Camera,
    title: "Snap & upload",
    body: "Take a photo of your current kitchen or bathroom, or upload one you already have.",
    status: "Photo added",
  },
  {
    icon: Palette,
    title: "Choose your look",
    body: "Pick the room type, a design style, and the cabinets, countertops and finishes you like.",
    status: "Style · 4 finishes",
  },
  {
    icon: WandSparkles,
    title: "Preview & get quotes",
    body: "See your AI redesign in seconds, then request real written quotes from local pros.",
    status: "Design ready",
  },
];

const TRUST: { icon: LucideIcon; label: string }[] = [
  { icon: BadgeCheck, label: "Free to try" },
  { icon: LockKeyhole, label: "Your photo stays private" },
  { icon: ShieldCheck, label: "Verified local pros" },
];

const QUOTE_POINTS = ["Share your project once", "Itemized written estimates", "Compare local pros side by side"] as const;

/**
 * Shown only until the admin adds FAQs with Domain / Category "kitchen-bath-design" (audience
 * Customer). Display text only, nothing is written to the database.
 */
const FALLBACK_FAQS: FaqItem[] = [
  {
    id: "kb-free",
    question: "Is the Kitchen & Bath Design tool free?",
    answer:
      "Yes. Upload a photo, pick a style and finishes, and explore as much as you like. A free Request Service account is needed only to generate the design, so it can be saved for you.",
  },
  {
    id: "kb-layout",
    question: "Will it change the layout of my room?",
    answer:
      "No. Walls, windows and the room's shape stay the same. Only the finishes change, so you see a realistic result for your own space.",
  },
  {
    id: "kb-photo",
    question: "What kind of photo works best?",
    answer:
      "A wide shot in good daylight, taken from a corner so most of the room is in view. Clearing the counters helps the result look cleaner.",
  },
  {
    id: "kb-bath",
    question: "Does it work for bathrooms too?",
    answer: "Yes. Switch between Kitchen and Bathroom at the first step, then choose the style and finishes for that room.",
  },
  {
    id: "kb-quote",
    question: "Can I get a real quote for my design?",
    answer:
      "Yes. Request a quote and verified local kitchen and bath pros reply with itemized written estimates to build it.",
  },
];

/** Section header in the home page's voice: tracked eyebrow, large tight headline, muted intro. */
function SectionHeading({
  eyebrow,
  title,
  body,
  className,
}: {
  eyebrow: string;
  title: React.ReactNode;
  body?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex max-w-3xl flex-col gap-3 ${className ?? ""}`}>
      <p className="eyebrow text-primary">{eyebrow}</p>
      <h2 className="text-balance text-3xl font-semibold tracking-tight md:text-[2.5rem] md:leading-[1.1]">{title}</h2>
      {body ? <p className="text-sm leading-7 text-muted-foreground md:text-base">{body}</p> : null}
    </div>
  );
}

/** Finish names of the showcase style ("White Shaker · Calacatta Quartz · Brushed Brass"), when the admin set one. */
function showcaseFinishes(catalog: RedesignCatalog | null, styleName?: string) {
  if (!catalog || !styleName) return [];
  const style = (catalog.styles || []).find((item) => item.name.toLowerCase() === styleName.toLowerCase());
  if (!style) return [];
  const byId = new Map((catalog.finishes || []).map((finish) => [finish.id, finish]));
  const names: string[] = [];
  for (const pick of Object.values(style.defaults || {})) {
    const name = [pick?.color && byId.get(pick.color)?.name, pick?.style && byId.get(pick.style)?.name]
      .filter(Boolean)
      .join(" ");
    if (name && !names.includes(name)) names.push(name);
  }
  return names.slice(0, 3);
}

/**
 * Kitchen & Bath Design (/kitchen-bath-design), top to bottom:
 *  1. Photo hero with a navy scrim (same language as the home hero): SEO h1, "Start Designing Free"
 *     (smooth scroll to #demo), quote link, trust markers + the before/after showcase card
 *  2. #demo: the live AI designer (studio bar, sample rooms to try instantly; only generating asks for an account)
 *  3. How it works (home-style timeline) + "What you can customize" finish explorer
 *  4. Style lookbook: the admin's styles; a click loads that style in the designer
 *  5. Navy quote band  6. FAQ (admin panel, Domain / Category "kitchen-bath-design")
 * Look (2026-11-25, client): aligned with the finalized home page — tracked eyebrows, large tight
 * headlines, hairline cards, navy #0B2A4F bands, `Section` rhythm. Earlier same-day attempts
 * (editorial/blueprint, serif, plain rounded cards, light compact hero) were rejected.
 * Old URLs /ai-kitchen-redesign and /ai-kitchen-bath-designer redirect here.
 */
export default async function KitchenBathDesignPage() {
  const [adminFaqs, catalog] = await Promise.all([
    fetchFaqsForDomain(KITCHEN_BATH_FAQ_DOMAIN),
    fetchRedesignCatalogForSeo(),
  ]);
  const faqs = adminFaqs.length ? adminFaqs : FALLBACK_FAQS;
  const live = catalog?.enabled ? catalog : null;
  const showcase = live?.section?.showcase || null;
  const styles = live?.styles || [];
  const finishes = live?.finishes || [];
  const heroFinishes = showcaseFinishes(live, showcase?.style);

  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: PAGE_NAME, path: PATH },
        ])}
      />
      <JsonLd data={faqJsonLd(faqs)} />

      <HomeMotion>
        {/* 1. Hero: full-width photo under a navy scrim, copy left, showcase card right (home hero language) */}
        <section className="relative isolate overflow-hidden">
          <Image
            src={HERO_BACKDROP_IMAGE}
            alt=""
            fill
            preload
            sizes="100vw"
            quality={75}
            className="-z-20 object-cover object-[50%_38%]"
          />
          <div className="absolute inset-0 -z-10 bg-[rgba(4,26,54,0.8)] lg:hidden" aria-hidden="true" />
          <div
            className="absolute inset-0 -z-10 hidden bg-[linear-gradient(100deg,rgba(4,26,54,0.94)_0%,rgba(4,26,54,0.86)_34%,rgba(4,26,54,0.6)_56%,rgba(4,26,54,0.38)_78%,rgba(4,26,54,0.42)_100%)] lg:block"
            aria-hidden="true"
          />
          <div className="absolute inset-x-0 bottom-0 -z-10 h-32 bg-linear-to-t from-[rgba(4,26,54,0.55)] to-transparent" aria-hidden="true" />

          <Container className="grid gap-10 pt-6 pb-12 md:pt-8 md:pb-14 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:items-center lg:gap-16 lg:py-16 xl:py-20">
            <div className="enter-stagger flex flex-col items-start gap-4 text-white">
              <nav aria-label="Breadcrumb">
                <ol className="flex items-center gap-2 text-[13px] text-white/60">
                  <li>
                    <Link href="/" className="transition-colors hover:text-white">
                      Home
                    </Link>
                  </li>
                  <li aria-hidden="true">/</li>
                  <li className="font-medium text-white/85" aria-current="page">
                    {PAGE_NAME}
                  </li>
                </ol>
              </nav>

              <span className="flex items-center gap-3 pt-2">
                <span className="h-px w-8 bg-white/50" aria-hidden="true" />
                <span className="eyebrow text-white/80">AI interior remodeling studio</span>
              </span>

              <h1 className="text-balance text-[2rem] leading-[1.08] font-semibold tracking-tight sm:text-[2.5rem] lg:text-[3rem]">
                AI Kitchen &amp; Bathroom Design Tool
              </h1>

              <p className="max-w-xl text-pretty text-sm leading-7 text-white/80 md:text-base">
                Upload a photo of your kitchen or bathroom and preview it redesigned in seconds, in your style and
                finishes. Love it? Get written quotes from verified local pros to build it.
              </p>

              <div className="flex w-full flex-col gap-3 pt-2 sm:w-auto sm:flex-row sm:items-center">
                <TryItNowButton
                  label="Start Designing Free"
                  className="rounded-lg bg-white text-[#0B2A4F] shadow-[0_12px_28px_-14px_rgba(0,0,0,0.6)] hover:bg-white/90"
                />
                <Button
                  size="lg"
                  variant="outline"
                  className="h-12 rounded-lg border-white/30 bg-transparent px-6 text-[15px] text-white hover:bg-white/10 hover:text-white"
                  asChild
                >
                  <Link href="/get-a-quote">Get a Free Quote</Link>
                </Button>
              </div>

              <ul className="flex flex-wrap items-center gap-x-5 gap-y-1.5 pt-1">
                {TRUST.map(({ icon: Icon, label }) => (
                  <li key={label} className="flex items-center gap-2 text-sm text-white/75">
                    <Icon className="size-4 text-white/60" aria-hidden="true" />
                    {label}
                  </li>
                ))}
              </ul>
            </div>

            {/* Showcase card: the admin's before/after pair (a real run), else a still photo. */}
            <div className="relative lg:justify-self-end lg:w-full lg:max-w-[36rem]">
              <div className="overflow-hidden rounded-2xl bg-white p-2 shadow-[0_30px_80px_-30px_rgba(0,0,0,0.65)] dark:bg-slate-900" data-keep-white>
                {showcase?.before && showcase?.after ? (
                  <BeforeAfterSlider
                    before={showcase.before}
                    after={showcase.after}
                    alt={showcase.style ? `${showcase.style} AI redesign` : "AI kitchen redesign"}
                    variant="glass"
                    className="aspect-[16/11] max-h-[400px] w-full rounded-xl"
                  />
                ) : (
                  <div className="relative aspect-[16/11] max-h-[400px] w-full overflow-hidden rounded-xl">
                    <Image
                      src={FALLBACK_HERO_IMAGE}
                      alt="A kitchen redesigned with the AI design tool"
                      fill
                      preload
                      sizes="(min-width: 1024px) 580px, 100vw"
                      className="object-cover"
                    />
                  </div>
                )}
                <div className="flex items-center gap-3 px-3 pt-3 pb-1.5">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <WandSparkles className="size-4" aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
                      {showcase?.style ? `${showcase.style} · previewed finishes` : "Previewed finishes"}
                    </span>
                    <span className="block truncate text-sm font-medium text-foreground">
                      {heroFinishes.length ? heroFinishes.join(" · ") : "Same room, new cabinets, counters & fixtures"}
                    </span>
                  </span>
                  <span className="hidden shrink-0 rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground sm:inline-flex">
                    AI preview
                  </span>
                </div>
              </div>
            </div>
          </Container>
        </section>

        {/* 2. The designer (#demo) */}
        <Section id={DESIGNER_ANCHOR} density="tight" className="scroll-mt-20 bg-background">
          <Container className="flex flex-col gap-8 lg:gap-10">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <SectionHeading
                eyebrow="Live studio"
                title="Design your room, free."
                body="Upload your own photo, or start instantly with a sample room. Pick a style and finishes, and see it redesigned."
              />
              <ul className="flex flex-wrap gap-x-5 gap-y-2 lg:pb-1.5">
                {["No account to explore", "Sample rooms included", "About a minute"].map((label) => (
                  <li key={label} className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span className="flex size-5 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <Check className="size-3" strokeWidth={3} aria-hidden="true" />
                    </span>
                    {label}
                  </li>
                ))}
              </ul>
            </div>

            {AI_DESIGNER_LIVE ? (
              <RedesignerWizard showHeader={false} studio initialCatalog={live} />
            ) : (
              <div className="flex flex-col items-center gap-4 rounded-2xl border border-border/70 bg-background px-6 py-16 text-center">
                <Sparkles className="size-8 text-primary" aria-hidden="true" />
                <p className="text-lg font-semibold">The designer is coming soon</p>
                <Button asChild className="rounded-lg">
                  <Link href="/get-a-quote">Get a free quote</Link>
                </Button>
              </div>
            )}
          </Container>
        </Section>

        {/* 3. How it works (home timeline language) + material explorer */}
        <Section tone="muted" density="tight">
          <Container className="flex flex-col gap-8 lg:gap-10">
            <SectionHeading
              eyebrow="How it works"
              title="From photo to real quotes in three steps."
              body="No measuring, no design software. Your room's walls and windows stay where they are; only the finishes change."
            />

            <div className="grid gap-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-start lg:gap-14">
              <ol className="flex flex-col pt-1" data-stagger>
                {HOW_IT_WORKS.map(({ icon: Icon, title, body, status }, index) => {
                  const last = index === HOW_IT_WORKS.length - 1;
                  return (
                    <li key={title} className="relative flex gap-4 pb-8 last:pb-0">
                      {!last ? (
                        <span aria-hidden="true" className="absolute top-11 bottom-0 left-5 w-0.5 bg-primary/80" />
                      ) : null}
                      <span className="relative z-10 flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground ring-4 ring-muted">
                        <Icon className="size-4.5" aria-hidden="true" />
                      </span>
                      <div className="flex min-w-0 flex-1 flex-col gap-1.5 pt-0.5">
                        <p className="font-mono text-[11px] tracking-[0.14em] text-muted-foreground">
                          STEP {String(index + 1).padStart(2, "0")}
                        </p>
                        <h3 className="text-base font-semibold tracking-tight md:text-lg">{title}</h3>
                        <p className="max-w-md text-sm leading-6 text-muted-foreground">{body}</p>
                        <span className="mt-1 inline-flex w-fit items-center rounded-full border border-border/70 bg-background px-2.5 py-0.5 text-xs font-medium text-primary">
                          {status}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ol>

              {finishes.length ? <CustomizeShowcase finishes={finishes} rooms={live?.rooms || []} /> : null}
            </div>
          </Container>
        </Section>

        {/* 4. Style lookbook */}
        {styles.length ? (
          <Section density="tight" className="bg-background">
            <Container>
              <StyleShowcase
                styles={styles}
                finishes={finishes}
                rooms={live?.rooms || []}
                header={
                  <SectionHeading
                    eyebrow="Style lookbook"
                    title="Curated kitchen & bath styles."
                    body="Pick a starting look and load it straight into the studio, then fine-tune every finish."
                  />
                }
              />
            </Container>
          </Section>
        ) : null}

        {/* 5. Quote band (same navy band as the home page's "Ready to solve it?") */}
        <section className="bg-[#0B2A4F] py-10 text-white md:py-12">
          <Container className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between lg:gap-12">
            <div className="flex max-w-2xl flex-col gap-3">
              <p className="eyebrow text-white/70">Written estimates</p>
              <h2 className="text-balance text-2xl font-semibold tracking-tight md:text-[2rem] md:leading-[1.15]">
                Love your new design? Get real quotes from verified local kitchen &amp; bath pros.
              </h2>
              <ul className="mt-1 flex flex-wrap gap-x-6 gap-y-2">
                {QUOTE_POINTS.map((point) => (
                  <li key={point} className="flex items-center gap-2 text-sm text-white/80">
                    <Check className="size-4 text-white/60" strokeWidth={2.5} aria-hidden="true" />
                    {point}
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex flex-wrap gap-3 lg:shrink-0">
              <Button
                size="lg"
                className="h-12 rounded-lg bg-white px-6 text-[15px] text-[#0B2A4F] hover:bg-white/90"
                data-keep-white
                asChild
              >
                <Link href="/get-a-quote">
                  Get free quotes
                  <ArrowRight className="size-4" aria-hidden="true" />
                </Link>
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="h-12 rounded-lg border-white/30 bg-transparent px-6 text-[15px] text-white hover:bg-white/10 hover:text-white"
                asChild
              >
                <Link href="/find-a-professional">Browse local pros</Link>
              </Button>
            </div>
          </Container>
        </section>

        {/* 6. FAQ (admin panel → FAQs, Domain / Category "kitchen-bath-design", audience Customer) */}
        <Section>
          <Container className="grid items-start gap-12 lg:grid-cols-[minmax(0,21rem)_minmax(0,1fr)] lg:gap-20">
            <div className="flex flex-col gap-5 lg:sticky lg:top-28">
              <p className="eyebrow text-primary">FAQ</p>
              <h2 className="text-3xl font-semibold tracking-tight md:text-[2.5rem] md:leading-[1.1]">
                Kitchen &amp; Bath Design questions
              </h2>
              <p className="max-w-sm text-sm leading-7 text-muted-foreground">
                How the studio works, what happens to your photo, and how to turn a design into a real written estimate.
              </p>
              <Link
                href="/contact"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-brand transition-colors hover:text-foreground"
              >
                Still unsure? Contact us
                <ArrowRight className="size-3.5" aria-hidden="true" />
              </Link>
            </div>
            <FaqList items={faqs} variant="cards" />
          </Container>
        </Section>
      </HomeMotion>
    </>
  );
}
