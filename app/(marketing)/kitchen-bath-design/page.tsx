import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  Camera,
  FileText,
  Palette,
  ShieldCheck,
  Sparkles,
  WandSparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { BeforeAfterSlider } from "@/components/ai-redesigner/before-after-slider";
import { RedesignerWizard } from "@/components/ai-redesigner/redesigner-wizard";
import { StyleShowcase, TryItNowButton } from "@/components/ai-redesigner/kitchen-bath-sections";
import { DESIGNER_ANCHOR } from "@/components/ai-redesigner/designer-events";
import { FaqList } from "@/components/shared/faq-list";
import { JsonLd } from "@/components/seo/json-ld";
import { breadcrumbJsonLd, faqJsonLd } from "@/lib/json-ld";
import { AI_DESIGNER_LIVE, AI_DESIGNER_PATH } from "@/lib/api/ai-redesigner-client";
import { fetchRedesignCatalogForSeo } from "@/lib/data/public-ai-redesigner";
import { KITCHEN_BATH_FAQ_DOMAIN, fetchFaqsForDomain } from "@/lib/data/public-faqs";
import type { FaqItem } from "@/lib/types";
import { buildMetadata } from "@/lib/seo";

const PATH = AI_DESIGNER_PATH; // "/kitchen-bath-design"
const PAGE_NAME = "Kitchen & Bath Design";
/** Hero fallback until the admin has a before/after showcase pair. */
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

const HOW_IT_WORKS = [
  {
    icon: Camera,
    title: "Snap & upload",
    body: "Take a photo of your current kitchen or bathroom, or upload one you already have.",
  },
  {
    icon: Palette,
    title: "Choose your look",
    body: "Pick the room type, a design style, and the cabinets, countertops and finishes you like.",
  },
  {
    icon: WandSparkles,
    title: "Preview & get quotes",
    body: "See your AI redesign in seconds, then request real written quotes from local pros.",
  },
] as const;

const TRUST = [
  { icon: Sparkles, label: "Free to try" },
  { icon: ShieldCheck, label: "Your photo stays private" },
  { icon: BadgeCheck, label: "Verified local pros" },
] as const;

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

function SectionIntro({ eyebrow, title, body }: { eyebrow: string; title: React.ReactNode; body?: string }) {
  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center gap-3 text-center">
      <p className="eyebrow text-primary">{eyebrow}</p>
      <h2 className="text-balance text-2xl font-semibold tracking-tight md:text-[2rem] md:leading-tight">{title}</h2>
      {body ? <p className="text-pretty text-[15px] leading-7 text-muted-foreground md:text-base">{body}</p> : null}
    </div>
  );
}

/**
 * Kitchen & Bath Design (/kitchen-bath-design), top to bottom:
 *  1. Hero: SEO h1, two-line value line, "Try It Now" (smooth scroll to #demo) + before/after slider
 *  2. #demo: the live AI designer (guests can use it; only generating asks for a free account)
 *  3. How it works (3 steps)
 *  4. Styles showcase: the admin's styles; a click selects that style in the designer
 *  5. Quote bridge: request quotes from local kitchen & bath pros
 *  6. FAQ: managed in the admin panel (Domain / Category "kitchen-bath-design")
 * Old URLs /ai-kitchen-redesign and /ai-kitchen-bath-designer redirect here.
 */
export default async function KitchenBathDesignPage() {
  const [adminFaqs, catalog] = await Promise.all([
    fetchFaqsForDomain(KITCHEN_BATH_FAQ_DOMAIN),
    fetchRedesignCatalogForSeo(),
  ]);
  const faqs = adminFaqs.length ? adminFaqs : FALLBACK_FAQS;
  const showcase = catalog?.enabled ? catalog.section?.showcase : null;
  const styles = catalog?.enabled ? catalog.styles || [] : [];

  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: PAGE_NAME, path: PATH },
        ])}
      />
      <JsonLd data={faqJsonLd(faqs)} />

      {/* 1. Hero */}
      <section className="relative overflow-hidden border-b bg-[linear-gradient(180deg,#f4f7fb_0%,#ffffff_100%)] dark:bg-none dark:bg-muted/20">
        <div className="container-site grid gap-8 pt-6 pb-12 md:pt-8 md:pb-16 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:items-center lg:gap-12">
          <div className="flex flex-col gap-5">
            <nav aria-label="Breadcrumb">
              <ol className="flex items-center gap-2 text-sm text-muted-foreground">
                <li>
                  <Link href="/" className="transition-colors hover:text-primary">
                    Home
                  </Link>
                </li>
                <li aria-hidden="true">/</li>
                <li className="font-medium text-foreground" aria-current="page">
                  {PAGE_NAME}
                </li>
              </ol>
            </nav>

            <div className="flex flex-col items-start gap-4 lg:pt-6">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold tracking-wide text-primary uppercase">
                <Sparkles className="size-3.5" aria-hidden="true" />
                {PAGE_NAME}
              </span>
              <h1 className="text-balance text-[2rem] leading-[1.08] font-semibold tracking-tight sm:text-[2.5rem] lg:text-[2.9rem]">
                AI Kitchen &amp; Bathroom Design Tool
              </h1>
              <p className="max-w-xl text-pretty text-[15px] leading-7 text-muted-foreground md:text-base">
                Upload a photo of your kitchen or bathroom and preview it redesigned in seconds, in your style and
                finishes. Love it? Get written quotes from verified local pros to build it.
              </p>
              <div className="flex flex-wrap items-center gap-3 pt-1">
                <TryItNowButton />
                <Button size="lg" variant="outline" className="h-12 rounded-full px-6 text-[15px]" asChild>
                  <Link href="/get-a-quote">Get a free quote</Link>
                </Button>
              </div>
              <ul className="flex flex-wrap gap-x-5 gap-y-2 pt-1">
                {TRUST.map(({ icon: Icon, label }) => (
                  <li key={label} className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
                    <Icon className="size-4 text-primary" aria-hidden="true" />
                    {label}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Before / after preview: the admin's showcase pair (a real run), else a still photo. */}
          <div className="relative">
            <div className="overflow-hidden rounded-3xl border bg-card p-2 shadow-[0_30px_70px_-40px_rgba(11,59,112,0.45)]">
              {showcase?.before && showcase?.after ? (
                <BeforeAfterSlider
                  before={showcase.before}
                  after={showcase.after}
                  alt={showcase.style ? `${showcase.style} AI redesign` : "AI kitchen redesign"}
                  className="aspect-[4/3] w-full rounded-2xl"
                />
              ) : (
                <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl">
                  <Image
                    src={FALLBACK_HERO_IMAGE}
                    alt="A kitchen redesigned with the AI design tool"
                    fill
                    preload
                    sizes="(min-width: 1024px) 560px, 100vw"
                    className="object-cover"
                  />
                </div>
              )}
            </div>
            {showcase?.before && showcase?.after ? (
              <p className="mt-3 text-center text-[13px] text-muted-foreground">
                Drag the handle to compare. Same room, new finishes.
              </p>
            ) : null}
          </div>
        </div>
      </section>

      {/* 2. The designer (#demo) */}
      <section id={DESIGNER_ANCHOR} className="scroll-mt-20 bg-[#f5f5f5] py-12 md:py-16 dark:bg-muted/30">
        <div className="container-site flex flex-col gap-8">
          <SectionIntro
            eyebrow="Live designer"
            title="Try it yourself, free"
            body="Upload any kitchen or bathroom photo, pick a style and finishes, and see your new room."
          />
          {AI_DESIGNER_LIVE ? (
            <RedesignerWizard showHeader={false} />
          ) : (
            <div className="flex flex-col items-center gap-4 rounded-3xl border bg-card px-6 py-16 text-center">
              <Sparkles className="size-8 text-primary" aria-hidden="true" />
              <p className="text-lg font-semibold">The designer is coming soon</p>
              <Button asChild>
                <Link href="/get-a-quote">Get a free quote</Link>
              </Button>
            </div>
          )}
        </div>
      </section>

      {/* 3. How it works */}
      <section className="py-12 md:py-16">
        <div className="container-site flex flex-col gap-10">
          <SectionIntro eyebrow="How it works" title="From photo to real quotes in three steps" />
          <ol className="grid gap-4 md:grid-cols-3 md:gap-6">
            {HOW_IT_WORKS.map(({ icon: Icon, title, body }, index) => (
              <li key={title} className="relative flex flex-col gap-3 rounded-2xl border bg-card p-6 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Icon className="size-6" aria-hidden="true" />
                  </span>
                  <span className="text-[2.5rem] leading-none font-semibold text-primary/10 tabular-nums" aria-hidden="true">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                </div>
                <h3 className="text-lg font-semibold">
                  <span className="sr-only">Step {index + 1}: </span>
                  {title}
                </h3>
                <p className="text-sm leading-6 text-muted-foreground">{body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* 4. Styles showcase */}
      {styles.length ? (
        <section className="bg-[#f5f5f5] py-12 md:py-16 dark:bg-muted/30">
          <div className="container-site flex flex-col gap-8">
            <SectionIntro
              eyebrow="Style library"
              title={
                <>
                  Explore curated <span className="text-primary">kitchen &amp; bath styles</span>
                </>
              }
              body="Pick a starting aesthetic, then customize cabinetry, surfaces, fixtures and finishes in the designer."
            />
            <StyleShowcase styles={styles} finishes={catalog?.finishes || []} rooms={catalog?.rooms || []} />
          </div>
        </section>
      ) : null}

      {/* 5. Quote bridge */}
      <section className="py-12 md:py-16">
        <div className="container-site">
          <div className="relative overflow-hidden rounded-3xl bg-[#0B3B70] px-6 py-10 text-white shadow-[0_30px_60px_-35px_rgba(11,59,112,0.8)] md:px-12 md:py-12">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -top-24 -right-24 size-72 rounded-full bg-white/8 blur-2xl"
            />
            <div className="relative flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
              <div className="flex max-w-2xl flex-col gap-3">
                <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-white/12 px-3 py-1 text-xs font-semibold tracking-wide uppercase">
                  <FileText className="size-3.5" aria-hidden="true" />
                  Written estimates
                </span>
                <h2 className="text-balance text-2xl font-semibold tracking-tight md:text-[2rem] md:leading-tight">
                  Love your new design? Get real quotes from verified local kitchen &amp; bath contractors.
                </h2>
                <p className="text-[15px] leading-7 text-white/75">
                  Share your project once. Local pros reply with itemized written estimates, so you can compare and
                  choose with confidence.
                </p>
              </div>
              <Button size="lg" className="h-12 shrink-0 rounded-full bg-white px-6 text-[15px] text-[#0B3B70] hover:bg-white/90" asChild>
                <Link href="/get-a-quote">
                  Get free quotes
                  <ArrowRight className="size-4" aria-hidden="true" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* 6. FAQ (admin panel → FAQs, Domain / Category "kitchen-bath-design", audience Customer) */}
      <section className="border-t py-12 md:py-16">
        <div className="container-site grid gap-8 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
          <div className="flex flex-col gap-3">
            <p className="eyebrow text-primary">Questions</p>
            <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">Kitchen &amp; Bath Design FAQ</h2>
            <p className="text-sm leading-7 text-muted-foreground md:text-base">
              Still unsure?{" "}
              <Link href="/contact" className="font-medium text-primary hover:underline">
                Contact us
              </Link>{" "}
              and we&apos;ll help.
            </p>
          </div>
          <FaqList items={faqs} variant="cards" />
        </div>
      </section>
    </>
  );
}
