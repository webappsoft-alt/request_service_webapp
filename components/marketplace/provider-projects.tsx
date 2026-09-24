"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Provider, ProviderProject } from "@/lib/types";

type PortfolioSlide = {
  key: string;
  src: string;
  alt: string;
  projectSlug: string;
  projectTitle: string;
  projectCategory: string;
  projectSubcategory: string;
  projectImageCount: number;
  imageIndexInProject: number;
};

function projectImageUrls(project: ProviderProject): string[] {
  const urls: string[] = [];
  const seen = new Set<string>();
  const push = (url?: string) => {
    const trimmed = url?.trim();
    if (!trimmed || seen.has(trimmed)) return;
    seen.add(trimmed);
    urls.push(trimmed);
  };
  push(project.cover);
  for (const url of project.images ?? []) push(url);
  return urls;
}

function buildPortfolioSlides(projects: ProviderProject[]): PortfolioSlide[] {
  const slides: PortfolioSlide[] = [];
  for (const project of projects) {
    const urls = projectImageUrls(project);
    urls.forEach((src, imageIndexInProject) => {
      slides.push({
        key: `${project.slug}-${imageIndexInProject}-${src}`,
        src,
        alt: `${project.title} — photo ${imageIndexInProject + 1}`,
        projectSlug: project.slug,
        projectTitle: project.title,
        projectCategory: project.categoryName || "",
        projectSubcategory: project.subcategoryName || "",
        projectImageCount: urls.length,
        imageIndexInProject,
      });
    });
  }
  return slides;
}

export function ProviderProjectCard({
  provider,
  project,
  onBeforeNavigate,
}: {
  provider: Provider;
  project: ProviderProject;
  onBeforeNavigate?: () => void;
}) {
  const extraCount = Math.max(0, projectImageUrls(project).length - 1);
  const meta = [project.categoryName, project.subcategoryName]
    .filter(Boolean)
    .join(" · ");

  return (
    <Link
      href={`/professionals/${provider.slug}/projects/${project.slug}`}
      onClick={() => onBeforeNavigate?.()}
      className="group flex flex-col overflow-hidden rounded-xl border border-black/15 bg-card focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-muted">
        {project.cover ? (
          <Image
            src={project.cover}
            alt={project.title}
            fill
            sizes="(min-width: 1024px) 18rem, (min-width: 640px) 45vw, 92vw"
            className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]"
            unoptimized={project.cover.startsWith("http")}
          />
        ) : null}
        {extraCount > 0 ? (
          <span className="absolute top-2 right-2 rounded-md bg-black/50 px-1.5 py-0.5 text-[11px] font-medium text-white backdrop-blur-sm">
            +{extraCount}
          </span>
        ) : null}
      </div>
      <div className="flex flex-col gap-0.5 px-3 py-2.5">
        <h3 className="line-clamp-2 text-sm font-semibold leading-snug">
          {project.title}
        </h3>
        {meta ? (
          <p className="line-clamp-1 text-xs text-muted-foreground">{meta}</p>
        ) : null}
        {project.summary ? (
          <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
            {project.summary}
          </p>
        ) : null}
      </div>
    </Link>
  );
}

export function ProviderProjects({
  provider,
  projects,
  keepVisible = false,
  onBeforeNavigate,
}: {
  provider: Provider;
  projects: ProviderProject[];
  /** Keep the Portfolio section shell visible even when there are no projects. */
  keepVisible?: boolean;
  onBeforeNavigate?: () => void;
}) {
  const router = useRouter();
  const slides = useMemo(() => buildPortfolioSlides(projects), [projects]);
  const scrollerRef = useRef<HTMLUListElement>(null);
  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(false);

  const updateScrollState = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) {
      setCanScrollPrev(false);
      setCanScrollNext(false);
      return;
    }
    const maxScroll = el.scrollWidth - el.clientWidth;
    setCanScrollPrev(el.scrollLeft > 4);
    setCanScrollNext(el.scrollLeft < maxScroll - 4);
  }, []);

  const scrollByCard = useCallback((direction: -1 | 1) => {
    const el = scrollerRef.current;
    if (!el) return;
    const card = el.querySelector<HTMLElement>("[data-portfolio-slide]");
    const amount = card ? card.offsetWidth + 12 : el.clientWidth * 0.8;
    el.scrollBy({ left: direction * amount, behavior: "smooth" });
  }, []);

  const openProjectLightbox = useCallback(
    (slide: PortfolioSlide) => {
      onBeforeNavigate?.();
      router.push(
        `/professionals/${provider.slug}/projects/${slide.projectSlug}?photo=${slide.imageIndexInProject}`,
      );
    },
    [onBeforeNavigate, provider.slug, router],
  );

  if (!projects.length && !keepVisible) return null;

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-2xl font-semibold">Portfolio</h2>
      {slides.length ? (
        <div className="relative">
          <ul
            ref={(node) => {
              scrollerRef.current = node;
              if (node) {
                requestAnimationFrame(updateScrollState);
              }
            }}
            onScroll={updateScrollState}
            className="no-scrollbar flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth pb-1"
            aria-label={`${provider.companyName} portfolio photos`}
          >
            {slides.map((slide) => {
              return (
                <li
                  key={slide.key}
                  data-portfolio-slide
                  className="w-[min(100%,18.5rem)] shrink-0 snap-start sm:w-[min(48%,20rem)] lg:w-[min(42%,22rem)]"
                >
                  <div className="group relative aspect-[4/3] overflow-hidden rounded-xl border border-black/15 bg-muted">
                    <button
                      type="button"
                      className="absolute inset-0 z-10 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring focus-visible:outline-none"
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        openProjectLightbox(slide);
                      }}
                      aria-label={`Open ${slide.projectTitle} gallery`}
                    >
                      <Image
                        src={slide.src}
                        alt={slide.alt}
                        fill
                        sizes="(min-width: 1024px) 22rem, (min-width: 640px) 45vw, 92vw"
                        className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]"
                        unoptimized={slide.src.startsWith("http")}
                      />
                    </button>
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[5] bg-gradient-to-t from-black/70 via-black/35 to-transparent px-3 pt-8 pb-2.5">
                      <p className="line-clamp-1 text-sm font-semibold text-white">
                        {slide.projectTitle}
                      </p>
                      {[slide.projectCategory, slide.projectSubcategory]
                        .filter(Boolean)
                        .length ? (
                        <p className="mt-0.5 line-clamp-1 text-[11px] text-white/85">
                          {[slide.projectCategory, slide.projectSubcategory]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>

          {slides.length > 1 ? (
            <>
              <button
                type="button"
                className={cn(
                  "absolute top-1/2 left-0 z-20 flex size-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-black/10 bg-white text-foreground shadow-md transition-[opacity,transform] hover:scale-105 hover:bg-white md:size-11",
                  canScrollPrev
                    ? "opacity-100"
                    : "pointer-events-none opacity-0",
                )}
                onClick={() => scrollByCard(-1)}
                aria-label="Previous portfolio photos"
              >
                <ChevronLeft className="size-5" />
              </button>
              <button
                type="button"
                className={cn(
                  "absolute top-1/2 right-0 z-20 flex size-10 translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-black/10 bg-white text-foreground shadow-md transition-[opacity,transform] hover:scale-105 hover:bg-white md:size-11",
                  canScrollNext
                    ? "opacity-100"
                    : "pointer-events-none opacity-0",
                )}
                onClick={() => scrollByCard(1)}
                aria-label="Next portfolio photos"
              >
                <ChevronRight className="size-5" />
              </button>
            </>
          ) : null}
        </div>
      ) : (
        <p className="rounded-xl border border-dashed border-black/15 bg-card px-4 py-8 text-sm text-muted-foreground">
          Photos of completed work will appear here.
        </p>
      )}
    </section>
  );
}
