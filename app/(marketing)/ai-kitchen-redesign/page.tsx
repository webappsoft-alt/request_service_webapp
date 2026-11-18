import Image from "next/image";
import Link from "next/link";
import {
  Bath,
  Camera,
  ChefHat,
  ChevronDown,
  Layers,
  Lightbulb,
  Clock,
  FileText,
  ImagePlus,
  Palette,
  Ruler,
  Sparkles,
  Users,
  Wand2,
  WalletCards,
} from "lucide-react";
import { Container } from "@/components/layout/container";
import { RedesignStartCta } from "@/components/ai-redesigner/redesign-start-cta";
import { JsonLd } from "@/components/seo/json-ld";
import { breadcrumbJsonLd } from "@/lib/json-ld";
import { buildMetadata } from "@/lib/seo";

const PATH = "/ai-kitchen-redesign";
const HERO_IMAGE = "/images/home/rs-ai-kitchen-repair.jpg";

export const metadata = buildMetadata({
  title: "AI Kitchen & Bathroom Redesign",
  description:
    "See your kitchen or bathroom redesigned by AI from a single photo. Pick a style and finishes, then get written estimates from local pros to build it.",
  path: PATH,
  keywords: ["AI kitchen redesign", "AI bathroom design", "kitchen remodel ideas", "bathroom remodel visualizer"],
});

const HERO_STEPS = [
  { n: "01", label: "Upload a photo", icon: ImagePlus },
  { n: "02", label: "Pick a style", icon: Palette },
  { n: "03", label: "See it redesigned", icon: Wand2 },
] as const;

const BENEFITS = [
  { icon: Camera, title: "Just one photo", body: "Snap the room as it is today. No measurements, plans or design software." },
  { icon: Ruler, title: "Your real layout", body: "Walls, windows and room shape stay the same, so you see what is possible in your space." },
  { icon: Palette, title: "Styles and finishes", body: "Try modern, farmhouse, coastal and more, then swap cabinets, counters and fixtures." },
  { icon: Clock, title: "Results in seconds", body: "Try as many looks as you like before you spend anything on the remodel." },
  { icon: WalletCards, title: "Free for customers", body: "Included with your free Request Service account. Your designs stay saved." },
  { icon: Users, title: "From idea to quote", body: "Send the design to local remodeling pros and get written estimates to build it." },
] as const;

const NEXT_STEPS = [
  { n: "1", title: "Log in or create a free account", body: "The designer is part of your customer dashboard, so every design is saved." },
  { n: "2", title: "Upload a photo and choose a style", body: "Pick the room, a style and the finishes you like." },
  { n: "3", title: "Request quotes for your design", body: "Local pros see your design and send an itemized written estimate." },
] as const;

/** Styles the designer offers — swatches show each look's palette. */
const STYLES_TO_TRY = [
  { name: "Modern", note: "Flat-panel cabinets, quartz, matte black", colors: ["#f4f4f2", "#2b2b2b", "#9aa3ab", "#d9d4cc"] },
  { name: "Farmhouse", note: "Shaker doors, butcher block, apron sink", colors: ["#f6f1e7", "#7d6a55", "#c9b79c", "#3f4a3c"] },
  { name: "Coastal", note: "White oak, soft blues, light stone", colors: ["#f8fafb", "#a9c6d8", "#d8c7a8", "#4f7b95"] },
  { name: "Transitional", note: "Warm whites, brass, marble look", colors: ["#f3efe8", "#b08d57", "#e6e1d8", "#5c5c5c"] },
  { name: "Industrial", note: "Concrete, open shelving, dark metal", colors: ["#d4d2cf", "#3a3a3a", "#8c6f5a", "#6b7075"] },
  { name: "Scandinavian", note: "Light wood, white walls, clean lines", colors: ["#fbfaf7", "#e1cfb2", "#c7ccd1", "#2f3a40"] },
] as const;

const ROOMS = [
  {
    icon: ChefHat,
    title: "Kitchens",
    items: ["Cabinet style and color", "Countertops and backsplash", "Flooring", "Sink, faucet and hardware", "Lighting and pendants"],
  },
  {
    icon: Bath,
    title: "Bathrooms",
    items: ["Vanity and mirror", "Shower or tub surround tile", "Flooring", "Fixtures and finishes", "Paint and lighting"],
  },
] as const;

const TIPS = [
  { icon: Lightbulb, title: "Shoot in daylight", body: "Natural light gives the AI the clearest view of your room." },
  { icon: Layers, title: "Stand in a corner", body: "Capture as much of the room as you can in one photo." },
  { icon: Camera, title: "Clear the counters", body: "Less clutter means a cleaner, more realistic redesign." },
] as const;

const FAQS = [
  { q: "Is the AI designer really free?", a: "Yes. It's included with your free Request Service customer account — log in and start designing." },
  {
    q: "Will it change the layout of my room?",
    a: "No. The AI keeps your walls, windows and room shape and only changes the finishes, so you see a realistic result.",
  },
  {
    q: "Can I get a real quote for the design?",
    a: "Yes. Send your design with a quote request and local remodeling pros reply with itemized written estimates.",
  },
  {
    q: "Where are my designs saved?",
    a: "In your customer dashboard, next to your quote requests, estimates and orders, so you can come back to them anytime.",
  },
  { q: "Does it work for bathrooms too?", a: "Yes — kitchens and bathrooms. Pick the room type when you upload your photo." },
] as const;

/**
 * AI Kitchen Redesign — info page (navbar → benefits/details → log in to use the tool at
 * /ai-kitchen-bath-designer). Built from the site's own patterns (client: match the project):
 * photo hero like Get a quote, cards on the light grey band, "What happens next" guide.
 * Previous version: plain navy hero, full-width button and the before/after slider section —
 * removed at the client's request.
 */
export default function AiKitchenRedesignPage() {
  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "AI Kitchen Redesign", path: PATH },
        ])}
      />

      {/* Hero — same structure as the Get a quote hero (components/marketplace/quote-hero.tsx). */}
      <section className="relative isolate overflow-hidden">
        <div className="relative min-h-[17rem] w-full sm:min-h-[19rem] lg:min-h-[21rem]">
          <Image src={HERO_IMAGE} alt="" fill sizes="100vw" className="object-cover object-[70%_35%]" preload />
          <div className="absolute inset-0 bg-[rgba(4,26,54,0.62)] lg:hidden" aria-hidden="true" />
          <div
            className="absolute inset-0 hidden bg-[linear-gradient(100deg,rgba(4,26,54,0.92)_0%,rgba(4,26,54,0.76)_36%,rgba(4,26,54,0.44)_60%,rgba(4,26,54,0.16)_80%)] lg:block"
            aria-hidden="true"
          />
          <Container className="relative flex min-h-[17rem] flex-col justify-center gap-5 py-8 text-white sm:min-h-[19rem] md:py-10 lg:min-h-[21rem]">
            <nav aria-label="Breadcrumb">
              <ol className="flex items-center gap-2 text-sm text-white/70">
                <li>
                  <Link href="/" className="transition-colors hover:text-white">
                    Home
                  </Link>
                </li>
                <li aria-hidden="true">/</li>
                <li className="font-medium text-white" aria-current="page">
                  AI Kitchen Redesign
                </li>
              </ol>
            </nav>

            <div className="max-w-2xl">
              <p className="eyebrow text-white/75">AI designer · Free</p>
              <h1 className="mt-2 text-[1.85rem] leading-[1.08] sm:text-[2.35rem] lg:text-[2.75rem]">
                See your kitchen or bathroom, redesigned
              </h1>
              <p className="mt-3 max-w-lg text-sm text-white/80 md:text-base">
                Upload a photo, choose a style and finishes, and our AI shows you the finished room — same layout,
                all-new look.
              </p>
            </div>

            <ol className="grid gap-2 sm:grid-cols-3 sm:gap-3 lg:max-w-3xl">
              {HERO_STEPS.map((step) => (
                <li
                  key={step.n}
                  className="flex items-center gap-3 rounded-xl border border-white/15 bg-white/8 px-3.5 py-3 backdrop-blur-sm"
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-white/12">
                    <step.icon className="size-4" aria-hidden="true" />
                  </span>
                  <span>
                    <span className="block text-[11px] font-semibold tracking-wide text-white/55 uppercase">
                      Step {step.n}
                    </span>
                    <span className="text-sm font-medium">{step.label}</span>
                  </span>
                </li>
              ))}
            </ol>

            <RedesignStartCta inverse />
          </Container>
        </div>
      </section>

      {/* Benefits + "What happens next" — same light band and card style as the Get a quote page. */}
      <section className="bg-[#f5f5f5] py-8 md:py-12 dark:bg-muted/30">
        <Container className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(18rem,22rem)] xl:gap-8">
          <div className="rounded-xl border bg-card p-5 shadow-sm sm:p-7">
            <p className="eyebrow text-primary">Why homeowners use it</p>
            <h2 className="mt-2 text-xl font-semibold tracking-tight md:text-2xl">Plan your remodel with confidence</h2>
            <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {BENEFITS.map(({ icon: Icon, title, body }) => (
                <div key={title} className="flex flex-col gap-2 rounded-xl border bg-background p-4">
                  <span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="size-5" aria-hidden="true" />
                  </span>
                  <h3 className="text-sm font-semibold">{title}</h3>
                  <p className="text-sm leading-6 text-muted-foreground">{body}</p>
                </div>
              ))}
            </div>
          </div>

          <aside className="flex w-full min-w-0 flex-col gap-4 xl:sticky xl:top-24">
            <div className="rounded-xl border bg-card p-5 shadow-sm">
              <h2 className="text-sm font-semibold">What happens next</h2>
              <ol className="mt-4 flex flex-col gap-4">
                {NEXT_STEPS.map((step) => (
                  <li key={step.n} className="flex gap-3">
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                      {step.n}
                    </span>
                    <span>
                      <span className="block text-sm font-medium">{step.title}</span>
                      <span className="block text-sm leading-6 text-muted-foreground">{step.body}</span>
                    </span>
                  </li>
                ))}
              </ol>
            </div>
            <div className="rounded-xl border bg-card p-5 shadow-sm">
              <div className="flex items-center gap-2">
                <FileText className="size-4 text-primary" aria-hidden="true" />
                <h2 className="text-sm font-semibold">Saved in your dashboard</h2>
              </div>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Your designs sit next to your quote requests, estimates and orders, so the pro you hire sees exactly
                what you have in mind.
              </p>
            </div>
          </aside>
        </Container>
      </section>

      {/* Styles to try (client: page was too short). */}
      <section className="py-12 md:py-16">
        <Container className="flex flex-col gap-8">
          <div className="flex flex-col gap-2 md:max-w-2xl">
            <p className="eyebrow text-primary">Styles to try</p>
            <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">Find the look you love</h2>
            <p className="text-sm leading-7 text-muted-foreground md:text-base">
              Start from a style, then fine-tune every finish. Switch between looks as often as you like.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {STYLES_TO_TRY.map((style) => (
              <div key={style.name} className="overflow-hidden rounded-xl border bg-card shadow-sm">
                <div className="flex h-20" aria-hidden="true">
                  {style.colors.map((color) => (
                    <span key={color} className="flex-1" style={{ backgroundColor: color }} />
                  ))}
                </div>
                <div className="p-4">
                  <h3 className="text-sm font-semibold">{style.name}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{style.note}</p>
                </div>
              </div>
            ))}
          </div>
        </Container>
      </section>

      {/* What you can change — kitchens and bathrooms, plus photo tips. */}
      <section className="bg-[#f5f5f5] py-12 md:py-16 dark:bg-muted/30">
        <Container className="grid gap-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-center">
          <div className="flex flex-col gap-3">
            <p className="eyebrow text-primary">What you can change</p>
            <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">Every finish, one room at a time</h2>
            <p className="text-sm leading-7 text-muted-foreground md:text-base">
              Choose the room, then swap the pieces that matter most. Your space stays exactly as it is — only the
              finishes change.
            </p>
            <ul className="mt-2 grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
              {TIPS.map(({ icon: Icon, title, body }) => (
                <li key={title} className="flex gap-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="size-4" aria-hidden="true" />
                  </span>
                  <span>
                    <span className="block text-sm font-semibold">{title}</span>
                    <span className="block text-sm leading-6 text-muted-foreground">{body}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {ROOMS.map(({ icon: Icon, title, items }) => (
              <div key={title} className="rounded-xl border bg-card p-5 shadow-sm">
                <div className="flex items-center gap-2.5">
                  <span className="flex size-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                    <Icon className="size-5" aria-hidden="true" />
                  </span>
                  <h3 className="text-base font-semibold">{title}</h3>
                </div>
                <ul className="mt-4 flex flex-col gap-2.5">
                  {items.map((item) => (
                    <li key={item} className="flex items-center gap-2 text-sm">
                      <span className="size-1.5 shrink-0 rounded-full bg-primary" aria-hidden="true" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </Container>
      </section>

      {/* FAQ */}
      <section className="py-12 md:py-16">
        <Container className="grid gap-8 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
          <div className="flex flex-col gap-3">
            <p className="eyebrow text-primary">Questions</p>
            <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">AI designer FAQ</h2>
            <p className="text-sm leading-7 text-muted-foreground md:text-base">
              Still unsure?{" "}
              <Link href="/contact" className="font-medium text-primary hover:underline">
                Contact us
              </Link>{" "}
              and we&apos;ll help.
            </p>
          </div>
          <div className="divide-y rounded-xl border bg-card">
            {FAQS.map((item) => (
              <details key={item.q} className="group px-5 py-4">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold [&::-webkit-details-marker]:hidden">
                  {item.q}
                  <ChevronDown
                    className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
                    aria-hidden="true"
                  />
                </summary>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.a}</p>
              </details>
            ))}
          </div>
        </Container>
      </section>

      {/* Closing call to action — dark band in the site's blue. */}
      <section className="bg-[#003F7D] py-10 text-white md:py-14">
        <Container className="flex flex-col items-center gap-4 text-center">
          <Sparkles className="size-7 text-sky-200" aria-hidden="true" />
          <h2 className="max-w-2xl text-balance text-2xl font-semibold tracking-tight md:text-3xl">
            Ready to see what your room could look like?
          </h2>
          <RedesignStartCta inverse center />
        </Container>
      </section>
    </>
  );
}
