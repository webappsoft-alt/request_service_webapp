import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  Camera,
  Check,
  FileText,
  Palette,
  Sparkles,
  WandSparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
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

const TRUST = ["Free to try", "Your photo stays private", "Verified local pros"] as const;

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

/** Editorial section header: index + eyebrow and serif title on the left, the intro on the right. */
function SectionIntro({ eyebrow, title, body }: { eyebrow: string; title: React.ReactNode; body?: string }) {
  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center gap-3 text-center">
      <span className="inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold tracking-wide text-primary uppercase">
        {eyebrow}
      </span>
      <h2 className="text-balance text-2xl font-semibold tracking-tight md:text-[2rem] md:leading-tight">{title}</h2>
      {body ? <p className="text-pretty text-[15px] leading-7 text-muted-foreground md:text-base">{body}</p> : null}
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
 *  1. Light compact hero: SEO h1, "Start Designing Free" (smooth scroll to #demo) + before/after showcase card
 *  2. #demo: the live AI designer (navy studio bar, sample rooms to try instantly; only generating asks for an account)
 *  3. Process timeline + "What you can customize" finish explorer
 *  4. Style lookbook: the admin's styles; a click loads that style in the designer
 *  5. Quote bridge  6. FAQ (admin panel, Domain / Category "kitchen-bath-design")
 * Look (2026-11-25, client): a flagship "AI interior studio" page that is structurally distinct from
 * the standard pages, within the brand palette (navy #082447–#0F3868, slate, white). Earlier same-day
 * attempts (editorial/blueprint, serif, then plain rounded cards) were rejected.
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

      {/* 1. Hero: light and compact, blends into the white navbar (2026-11-25; previously a full-bleed deep-navy hero) */}
      <section className="relative isolate overflow-hidden border-b bg-gradient-to-b from-slate-50/90 via-white to-white dark:from-slate-900 dark:via-slate-900/70 dark:to-background">
        <div aria-hidden="true" className="pointer-events-none absolute -top-40 right-[-8%] -z-10 size-[32rem] rounded-full bg-primary/[0.06] blur-3xl dark:bg-primary/10" />

        <div className="container-site grid gap-10 pt-5 pb-12 md:pt-6 md:pb-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-center lg:gap-14">
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

            <div className="flex flex-col items-start gap-4 lg:pt-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/15 bg-primary/[0.07] px-3 py-1 text-xs font-semibold tracking-wide text-primary uppercase">
                <Sparkles className="size-3.5" aria-hidden="true" />
                AI Interior Remodeling Studio
              </span>
              <h1 className="text-balance text-[2rem] leading-[1.08] font-semibold tracking-tight text-foreground sm:text-[2.4rem] lg:text-[2.75rem]">
                AI Kitchen &amp; Bathroom <span className="text-primary">Design Tool</span>
              </h1>
              <p className="max-w-xl text-pretty text-[15px] leading-7 text-muted-foreground md:text-base">
                Upload a photo of your kitchen or bathroom and preview it redesigned in seconds, in your style and
                finishes. Love it? Get written quotes from verified local pros to build it.
              </p>
              <div className="flex w-full flex-col gap-3 pt-1 sm:w-auto sm:flex-row sm:items-center">
                <TryItNowButton
                  label="Start Designing Free"
                  className="rounded-xl shadow-[0_12px_24px_-14px_rgba(0,63,125,0.9)]"
                />
                <Button size="lg" variant="outline" className="h-12 rounded-xl bg-card px-6 text-[15px]" asChild>
                  <Link href="/get-a-quote">Get a Free Quote</Link>
                </Button>
              </div>
              <ul className="flex flex-wrap gap-x-5 gap-y-2 pt-1">
                {TRUST.map((label) => (
                  <li key={label} className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span className="flex size-5 items-center justify-center rounded-full bg-emerald-500/12 text-emerald-600 dark:text-emerald-400">
                      <Check className="size-3" strokeWidth={3} aria-hidden="true" />
                    </span>
                    {label}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Showcase card: the admin's before/after pair (a real run), else a still photo. */}
          <div className="relative pb-6">
            <div className="relative rounded-3xl border bg-card p-2 shadow-xl shadow-slate-900/10 dark:shadow-black/40">
              {showcase?.before && showcase?.after ? (
                <BeforeAfterSlider
                  before={showcase.before}
                  after={showcase.after}
                  alt={showcase.style ? `${showcase.style} AI redesign` : "AI kitchen redesign"}
                  variant="glass"
                  className="aspect-[16/11] max-h-[400px] w-full rounded-2xl"
                />
              ) : (
                <div className="relative aspect-[16/11] max-h-[400px] w-full overflow-hidden rounded-2xl">
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
              {/* Floating finishes card (light frosted) */}
              <div
                className="pointer-events-none absolute inset-x-6 -bottom-6 flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-white/90 px-4 py-2.5 shadow-lg shadow-slate-900/10 backdrop-blur-xl dark:border-white/10 dark:bg-slate-800/90 dark:shadow-black/40"
              >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <WandSparkles className="size-4" aria-hidden="true" />
                </span>
                <span className="min-w-0">
                  <span className="block text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                    {showcase?.style ? `${showcase.style} · previewed finishes` : "Previewed finishes"}
                  </span>
                  <span className="block truncate text-sm font-medium text-foreground">
                    {heroFinishes.length ? heroFinishes.join(" · ") : "Same room, new cabinets, counters & fixtures"}
                  </span>
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. The designer (#demo) */}
      <section id={DESIGNER_ANCHOR} className="scroll-mt-20 bg-slate-50/70 py-14 md:py-20 dark:bg-slate-900/40">
        <div className="container-site flex flex-col gap-8 md:gap-10">
          <SectionIntro
            eyebrow="Live studio"
            title={
              <>
                Design your room, <span className="text-primary">free</span>
              </>
            }
            body="Upload your own photo, or start instantly with a sample room. Pick a style and finishes, and see it redesigned."
          />
          {AI_DESIGNER_LIVE ? (
            <RedesignerWizard showHeader={false} studio initialCatalog={live} />
          ) : (
            <div className="flex flex-col items-center gap-4 rounded-2xl border bg-card px-6 py-16 text-center shadow-lg shadow-slate-900/5">
              <Sparkles className="size-8 text-primary" aria-hidden="true" />
              <p className="text-lg font-semibold">The designer is coming soon</p>
              <Button asChild className="rounded-xl">
                <Link href="/get-a-quote">Get a free quote</Link>
              </Button>
            </div>
          )}
        </div>
      </section>

      {/* 3. Process timeline + material explorer */}
      <section className="py-14 md:py-20">
        <div className="container-site grid gap-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-center lg:gap-16">
          <div className="flex flex-col gap-8">
            <div className="flex flex-col items-start gap-3">
              <span className="inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold tracking-wide text-primary uppercase">
                How it works
              </span>
              <h2 className="text-balance text-2xl font-semibold tracking-tight md:text-[2rem] md:leading-tight">
                From photo to real quotes in three steps
              </h2>
            </div>
            <ol className="relative flex flex-col gap-7">
              <span aria-hidden="true" className="absolute top-6 bottom-6 left-6 w-px bg-gradient-to-b from-primary/40 via-primary/20 to-transparent" />
              {HOW_IT_WORKS.map(({ icon: Icon, title, body }, index) => (
                <li key={title} className="relative flex gap-5">
                  <span className="relative z-10 flex size-12 shrink-0 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#082447_0%,#0f3868_100%)] text-white shadow-lg shadow-[#082447]/25 ring-4 ring-background">
                    <Icon className="size-5" aria-hidden="true" />
                  </span>
                  <div className="flex flex-col gap-1 pt-1">
                    <p className="text-xs font-semibold tracking-wide text-primary uppercase">Step {index + 1}</p>
                    <h3 className="text-lg font-semibold">{title}</h3>
                    <p className="max-w-md text-[15px] leading-7 text-muted-foreground">{body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
          {finishes.length ? (
            <CustomizeShowcase finishes={finishes} rooms={live?.rooms || []} />
          ) : null}
        </div>
      </section>

      {/* 4. Style lookbook */}
      {styles.length ? (
        <section className="bg-slate-50/70 py-14 md:py-20 dark:bg-slate-900/40">
          <div className="container-site flex flex-col gap-8 md:gap-10">
            <SectionIntro
              eyebrow="Style lookbook"
              title={
                <>
                  Curated <span className="text-primary">kitchen &amp; bath styles</span>
                </>
              }
              body="Pick a starting look and load it straight into the studio, then fine-tune every finish."
            />
            <StyleShowcase styles={styles} finishes={finishes} rooms={live?.rooms || []} />
          </div>
        </section>
      ) : null}

      {/* 5. Quote bridge */}
      <section className="py-14 md:py-20">
        <div className="container-site">
          <div className="relative overflow-hidden rounded-3xl bg-[linear-gradient(135deg,#0b3b6f_0%,#082447_100%)] text-white shadow-2xl shadow-[#082447]/25">
            <div aria-hidden="true" className="pointer-events-none absolute -top-24 -right-24 size-80 rounded-full bg-white/[0.07] blur-2xl" />
            <div aria-hidden="true" className="pointer-events-none absolute -bottom-32 left-1/3 size-80 rounded-full bg-sky-300/10 blur-3xl" />
            <div className="relative grid gap-8 px-6 py-10 md:px-12 md:py-14 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] lg:items-center lg:gap-12">
              <div className="flex flex-col gap-4">
                <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-white/12 px-3 py-1 text-xs font-semibold tracking-wide uppercase">
                  <FileText className="size-3.5" aria-hidden="true" />
                  Written estimates
                </span>
                <h2 className="text-balance text-2xl font-semibold tracking-tight md:text-[2rem] md:leading-tight">
                  Love your new design? Get real quotes from verified local kitchen &amp; bath contractors.
                </h2>
                <p className="max-w-xl text-[15px] leading-7 text-white/75">
                  Share your project once. Local pros reply with itemized written estimates, so you can compare and
                  choose with confidence.
                </p>
              </div>
              <div className="flex flex-col gap-5 rounded-2xl border border-white/10 bg-white/[0.06] p-6 backdrop-blur-sm">
                <ul className="flex flex-col gap-3">
                  {QUOTE_POINTS.map((point) => (
                    <li key={point} className="flex items-center gap-3 text-[15px] text-white/90">
                      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-white/15">
                        <Check className="size-3.5" strokeWidth={3} aria-hidden="true" />
                      </span>
                      {point}
                    </li>
                  ))}
                </ul>
                <Button
                  size="lg"
                  className="h-12 w-full rounded-xl bg-white px-6 text-[15px] text-[#0b3b6f] hover:bg-white/90"
                  data-keep-white
                  asChild
                >
                  <Link href="/get-a-quote">
                    Get free quotes
                    <ArrowRight className="size-4" aria-hidden="true" />
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 6. FAQ (admin panel → FAQs, Domain / Category "kitchen-bath-design", audience Customer) */}
      <section className="border-t py-14 md:py-20">
        <div className="container-site grid gap-8 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-12">
          <div className="flex flex-col items-start gap-3">
            <span className="inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold tracking-wide text-primary uppercase">
              Questions
            </span>
            <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">Kitchen &amp; Bath Design FAQ</h2>
            <p className="text-[15px] leading-7 text-muted-foreground">
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
