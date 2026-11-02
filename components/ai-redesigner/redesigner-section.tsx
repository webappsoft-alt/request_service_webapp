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
import { selectIsAuthenticated } from "@/store/authSlice";
import { showLoginRequired } from "./login-guard";
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
export function RedesignerSection({
  variant = "default",
  tone = "dark",
}: {
  /** "showcase": full-width split-screen (home-v1 prototype). Same data and switch. */
  variant?: "default" | "showcase";
  /** Showcase copy panel palette. "light" follows the page's light tokens (home-v3). */
  tone?: "dark" | "light";
} = {}) {
  const dispatch = useAppDispatch();
  const catalog = useAppSelector(selectRedesignCatalog);
  const router = useRouter();
  const isLoggedIn = useAppSelector(selectIsAuthenticated);
  const openDesigner = () => {
    if (!AI_DESIGNER_LIVE) return showComingSoon();
    // Everyone sees the section; only logged-in users can open the designer.
    if (!isLoggedIn) return showLoginRequired((href) => router.push(href));
    router.push(AI_DESIGNER_PATH);
  };

  // Logout / session expiry resets the store (catalog back to null) while this stays
  // mounted, so fetch again whenever the catalog is missing or the sign-in state changes.
  useEffect(() => {
    if (!catalog) void dispatch(fetchRedesignCatalog());
  }, [dispatch, catalog, isLoggedIn]);

  if (!catalog?.enabled) return null;

  const showcase = catalog.section?.showcase;
  // Without a before/after pair yet (no admin test run), fall back to the style photos.
  const previews = showcase
    ? []
    : (catalog.styles || []).filter((style) => style.image).slice(0, 4);
  const swatches = (catalog.finishes || [])
    .filter((finish) => finish.kind === "color" && finish.color)
    .slice(0, 12);

  if (variant === "showcase") {
    const light = tone === "light";
    const Wrapper = light ? Container : "div";
    return (
      <section
        className={
          light
            ? "py-8 md:py-10"
            : "relative overflow-hidden bg-[#071a33] text-white"
        }
      >
        <Wrapper
          className={
            light
              ? "relative overflow-hidden rounded-2xl border border-[#D5DFEB] bg-[linear-gradient(135deg,#f7fafd_0%,#eaf2fb_100%)] text-foreground"
              : undefined
          }
        >
          <div
            aria-hidden="true"
            className={
              light
                ? "pointer-events-none absolute -left-40 top-1/3 size-[40rem] rounded-full bg-[radial-gradient(circle,rgba(0,63,125,0.10),transparent_65%)]"
                : "pointer-events-none absolute -left-40 top-1/3 size-[40rem] rounded-full bg-[radial-gradient(circle,rgba(56,189,248,0.16),transparent_65%)]"
            }
          />
          <div className="relative grid lg:grid-cols-2">
            <div
              className={
                light
                  ? "flex flex-col justify-center gap-6 p-7 md:p-10 lg:pr-10"
                  : "flex flex-col justify-center gap-7 px-[10vw] py-16 md:py-24 lg:pr-16 lg:pl-[max(10vw,calc((100vw-90rem)/2))]"
              }
            >
              <span
                className={
                  light
                    ? "inline-flex w-fit items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary"
                    : "inline-flex w-fit items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-sky-200"
                }
              >
                <Sparkles className="size-3.5" aria-hidden="true" />
                AI designer · Free
              </span>
              <h2 className="text-balance text-3xl font-semibold tracking-tight md:text-[2.9rem] md:leading-[1.08]">
                {catalog.section?.title}
              </h2>
              <p
                className={
                  light
                    ? "max-w-lg text-sm leading-7 text-muted-foreground md:text-base"
                    : "max-w-lg text-sm leading-7 text-white/70 md:text-base"
                }
              >
                {catalog.section?.subtitle}
              </p>
              {light ? (
                <ol className="grid grid-cols-2 gap-3 sm:max-w-md">
                  {STEPS.map((step, index) => {
                    const Icon = step.icon;
                    return (
                      <li
                        key={step.label}
                        className="flex items-center gap-3 rounded-xl border border-border-card bg-background/80 px-3 py-2.5 text-sm shadow-[0_8px_20px_-16px_rgba(15,23,42,0.35)] backdrop-blur-sm"
                      >
                        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                          <Icon className="size-4" aria-hidden="true" />
                        </span>
                        <span className="flex flex-col leading-tight">
                          <span className="font-mono text-[10px] tracking-wider text-primary">
                            {String(index + 1).padStart(2, "0")}
                          </span>
                          <span className="font-medium">{step.label}</span>
                        </span>
                      </li>
                    );
                  })}
                </ol>
              ) : (
                <ol className="flex flex-col gap-3 border-l border-white/15 pl-5">
                  {STEPS.map((step, index) => (
                    <li
                      key={step.label}
                      className="flex items-baseline gap-3 text-sm"
                    >
                      <span className="font-mono text-xs text-sky-300">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <span className="font-medium text-white/90">
                        {step.label}
                      </span>
                    </li>
                  ))}
                </ol>
              )}
              <div className="flex flex-wrap items-center gap-4">
                <Button
                  size="xl"
                  type="button"
                  onClick={openDesigner}
                  className={
                    light
                      ? undefined
                      : "bg-white text-[#071a33] hover:bg-white/90"
                  }
                >
                  Try the AI designer
                  <ArrowRight data-icon="inline-end" />
                </Button>
                <span
                  className={
                    light
                      ? "text-xs text-muted-foreground"
                      : "text-xs text-white/60"
                  }
                >
                  Your layout stays — only the look changes.
                </span>
              </div>
            </div>

            <div className={light ? "relative min-h-[20rem] lg:min-h-[30rem]" : "relative min-h-[22rem] lg:min-h-[38rem]"}>
              {showcase ? (
                <>
                  <BeforeAfterSlider
                    before={showcase.before}
                    after={showcase.after}
                    alt={
                      showcase.style
                        ? `${showcase.style} AI redesign`
                        : "AI redesign"
                    }
                    className="absolute inset-0 h-full w-full"
                  />
                  <p className="pointer-events-none absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-black/55 px-3 py-1 text-xs text-white backdrop-blur-sm">
                    <MoveHorizontal className="size-3.5" aria-hidden="true" />
                    Drag to compare
                    {showcase.style ? ` · ${showcase.style}` : ""}
                  </p>
                </>
              ) : previews.length ? (
                <div className="absolute inset-0 grid grid-cols-2">
                  {previews.map((style) => (
                    <button
                      key={style.id}
                      type="button"
                      onClick={openDesigner}
                      aria-label={`Try the ${style.name} style`}
                      className="group relative cursor-pointer overflow-hidden"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element -- admin-uploaded style preview */}
                      <img
                        src={style.image}
                        alt={`${style.name} ${style.roomType}`}
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                        loading="lazy"
                      />
                      <span className="absolute bottom-3 left-3 rounded-full bg-black/55 px-2.5 py-0.5 text-xs font-medium text-white backdrop-blur-sm">
                        {style.name}
                      </span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="absolute inset-0 flex items-center justify-center">
                  <Sparkles
                    className={
                      light ? "size-12 text-primary" : "size-12 text-sky-300"
                    }
                    aria-hidden="true"
                  />
                </div>
              )}
            </div>
          </div>
        </Wrapper>
      </section>
    );
  }

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
