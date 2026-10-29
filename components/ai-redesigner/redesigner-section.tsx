"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Camera,
  MoveHorizontal,
  Palette,
  Sparkles,
  SwatchBook,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Container, Section } from "@/components/layout/container";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  fetchRedesignCatalog,
  selectRedesignCatalog,
} from "@/store/aiRedesignerSlice";
import {
  AI_DESIGNER_LIVE,
  AI_DESIGNER_PATH,
} from "@/lib/api/ai-redesigner-client";
import { BeforeAfterSlider } from "./before-after-slider";
import { swatchStyle } from "./finish-swatch";

/** Shown only if the launch switch is turned back off. */
const showComingSoon = () =>
  toast.info("AI Kitchen & Bath Redesigner is coming soon!", {
    id: "ai-redesigner-coming-soon",
    description:
      "We're putting the finishing touches on it. Check back shortly.",
  });

const STEPS = [
  { icon: Camera, label: "Upload a photo" },
  { icon: SwatchBook, label: "Pick a style" },
  { icon: Palette, label: "Choose finishes" },
  { icon: Sparkles, label: "See it redesigned" },
] as const;

/**
 * Home page banner for the AI Kitchen & Bath Redesigner. Renders nothing until the admin
 * switches the feature on (the catalog then reports `enabled: true`).
 */
export function RedesignerSection() {
  const dispatch = useAppDispatch();
  const catalog = useAppSelector(selectRedesignCatalog);
  const router = useRouter();
  const openDesigner = () =>
    AI_DESIGNER_LIVE ? router.push(AI_DESIGNER_PATH) : showComingSoon();

  useEffect(() => {
    void dispatch(fetchRedesignCatalog());
  }, [dispatch]);

  if (!catalog?.enabled) return null;

  const showcase = catalog.section?.showcase;
  // Without a before/after pair yet (no admin test run), fall back to the style photos.
  const previews = showcase
    ? []
    : (catalog.styles || []).filter((style) => style.image).slice(0, 4);
  const swatches = (catalog.finishes || [])
    .filter((finish) => finish.kind === "color" && finish.color)
    .slice(0, 12);

  return (
    <Section density="tight">
      <Container>
        <div className="relative grid items-center gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
          <div className="relative flex flex-col gap-5">
            <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              <Sparkles className="size-3.5" aria-hidden="true" />
              AI designer · Free
            </span>
            <h2 className="text-3xl font-semibold tracking-tight md:text-[2.4rem] md:leading-[1.15]">
              {catalog.section?.title}
            </h2>
            <p className="max-w-lg text-sm leading-7 text-muted-foreground md:text-base">
              {catalog.section?.subtitle}
            </p>
            <ol className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4">
              {STEPS.map((step, index) => {
                const Icon = step.icon;
                return (
                  <li
                    key={step.label}
                    className="flex items-center gap-2 rounded-xl border border-border-card bg-background px-3 py-2.5 text-xs font-medium"
                  >
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                      <Icon className="size-3.5" aria-hidden="true" />
                    </span>
                    <span>
                      <span className="sr-only">Step {index + 1}: </span>
                      {step.label}
                    </span>
                  </li>
                );
              })}
            </ol>
            <div className="flex flex-wrap items-center gap-3">
              <Button size="xl" type="button" onClick={openDesigner}>
                Try the AI designer
                <ArrowRight data-icon="inline-end" />
              </Button>
              <span className="text-xs text-muted-foreground">
                Your layout stays — only the look changes.
              </span>
            </div>
          </div>

          {showcase ? (
            <figure className="flex flex-col gap-3">
              <BeforeAfterSlider
                before={showcase.before}
                after={showcase.after}
                alt={
                  showcase.style
                    ? `${showcase.style} AI redesign`
                    : "AI redesign"
                }
                className="aspect-[4/3] w-full rounded-2xl bg-muted shadow-[0_18px_40px_-24px_rgba(15,23,42,0.45)]"
              />
              <figcaption className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
                <MoveHorizontal className="size-3.5" aria-hidden="true" />
                Drag the handle to compare
                {showcase.style ? ` · ${showcase.style} style` : ""}
              </figcaption>
            </figure>
          ) : (
            <div className="relative rounded-2xl bg-muted/40 p-3">
              {previews.length ? (
                <div className="grid grid-cols-2 gap-3">
                  {previews.map((style) => (
                    <button
                      key={style.id}
                      type="button"
                      onClick={openDesigner}
                      aria-label={`Try the ${style.name} style`}
                      className="group relative cursor-pointer overflow-hidden rounded-xl"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element -- admin-uploaded style preview */}
                      <img
                        src={style.image}
                        alt={`${style.name} ${style.roomType}`}
                        className="aspect-[4/3] w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                        loading="lazy"
                      />
                      <span className="absolute bottom-1.5 left-1.5 rounded-full bg-black/55 px-2 py-0.5 text-[11px] font-medium text-white backdrop-blur-sm">
                        {style.name}
                      </span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="flex aspect-[16/10] items-center justify-center rounded-xl bg-[radial-gradient(circle_at_30%_20%,rgba(0,63,125,0.18),transparent_60%)]">
                  <Sparkles
                    className="size-10 text-primary"
                    aria-hidden="true"
                  />
                </div>
              )}

              {swatches.length ? (
                <div className="mt-3 flex flex-wrap items-center gap-1.5 rounded-xl bg-card px-3 py-2">
                  <span className="mr-1 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                    Finishes
                  </span>
                  {swatches.map((finish) => (
                    <span
                      key={finish.id}
                      title={finish.name}
                      className="size-5 rounded-md border border-black/10"
                      style={swatchStyle(finish)}
                    />
                  ))}
                </div>
              ) : null}
            </div>
          )}
        </div>
      </Container>
    </Section>
  );
}
