"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Pencil } from "lucide-react";
import { PortalPage } from "@/components/portal/portal-page";
import { StatusPill } from "@/components/portal/status-pill";
import { Button } from "@/components/ui/button";
import { CenteredSpinner } from "@/components/ui/spinner";
import { toTitleCase } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  clearPortfolioDetail,
  fetchPortfolioById,
  portfolioCoverUrl,
  type PortfolioStatus,
} from "@/store/portfolioSlice";

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-medium tracking-[0.12em] text-muted-foreground uppercase">
        {label}
      </p>
      <p className="mt-1 text-sm font-medium break-words">{value}</p>
    </div>
  );
}

function statusLabel(status: PortfolioStatus) {
  if (status === "ACTIVE") return "Active";
  if (status === "ARCHIVED") return "Archived";
  return "Hidden";
}

function statusTone(status: PortfolioStatus) {
  if (status === "ACTIVE") return "success" as const;
  if (status === "ARCHIVED") return "warning" as const;
  return "neutral" as const;
}

export function PortfolioDetailView({ id }: { id: string }) {
  const dispatch = useAppDispatch();
  const detail = useAppSelector((state) => state.portfolio?.detail ?? null);
  const detailLoading = useAppSelector(
    (state) => state.portfolio?.detailLoading ?? false,
  );

  const photos = detail?.media.map((item) => item.url).filter(Boolean) ?? [];
  const [activePhoto, setActivePhoto] = useState(0);

  useEffect(() => {
    void dispatch(fetchPortfolioById(id));
    return () => {
      dispatch(clearPortfolioDetail());
    };
  }, [dispatch, id]);

  useEffect(() => {
    setActivePhoto(0);
  }, [detail?.id, photos.length]);

  useEffect(() => {
    if (photos.length < 2) return;
    const timer = window.setInterval(() => {
      setActivePhoto((current) => (current + 1) % photos.length);
    }, 4000);
    return () => window.clearInterval(timer);
  }, [photos.length, detail?.id, activePhoto]);

  if (detailLoading && (!detail || detail.id !== id)) {
    return (
      <PortalPage eyebrow="Portfolio" title="Portfolio project">
        <div className="px-4 pb-8">
          <CenteredSpinner
            label="Loading project"
            className="min-h-[22rem] border-0 bg-transparent"
          />
        </div>
      </PortalPage>
    );
  }

  if (!detail || detail.id !== id) {
    return (
      <PortalPage
        eyebrow="Portfolio"
        title="Project not found"
        description="This portfolio item is no longer on this account."
      >
        <div className="px-4">
          <Button asChild>
            <Link href="/pro/dashboard/portfolio">Back to portfolio</Link>
          </Button>
        </div>
      </PortalPage>
    );
  }

  const cover =
    photos[Math.min(activePhoto, Math.max(photos.length - 1, 0))] ||
    portfolioCoverUrl(detail);
  const title = toTitleCase(detail.title) || "Untitled project";

  return (
    <PortalPage
      eyebrow="Portfolio"
      title={title}
      description="Showcase details customers can browse on your public profile."
      badge={
        <div className="flex flex-wrap items-center gap-2">
          <StatusPill
            label={statusLabel(detail.status)}
            tone={statusTone(detail.status)}
          />
        </div>
      }
      actions={
        <div className="flex gap-2">
          <Button asChild>
            <Link href={`/pro/dashboard/portfolio/${id}`}>
              <Pencil className="size-4" />
              Edit
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/pro/dashboard/portfolio">Back</Link>
          </Button>
        </div>
      }
    >
      <div className="grid items-start gap-6 px-4 pb-8 lg:grid-cols-[minmax(0,1.2fr)_minmax(18rem,22rem)]">
        <div className="flex flex-col gap-4">
          <section className="overflow-hidden rounded-xl border border-black/10 bg-card">
            <div className="relative aspect-[16/9] bg-[#003F7D]">
              {cover ? (
                <Image
                  src={cover}
                  alt={title}
                  fill
                  sizes="(min-width: 1024px) 55vw, 100vw"
                  className="object-cover"
                  unoptimized={cover.startsWith("http")}
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-sm text-white/70">
                  No cover photo
                </div>
              )}
            </div>
            {photos.length > 1 ? (
              <div className="flex gap-2 overflow-x-auto p-3">
                {photos.map((src, index) => (
                  <button
                    key={`${src}-${index}`}
                    type="button"
                    onClick={() => setActivePhoto(index)}
                    className={cn(
                      "relative size-16 shrink-0 overflow-hidden rounded-lg border transition",
                      index === activePhoto
                        ? "border-[#003F7D] ring-2 ring-[#003F7D]/30"
                        : "border-black/10 hover:border-[#003F7D]/40",
                    )}
                    aria-label={`Show photo ${index + 1}`}
                    aria-pressed={index === activePhoto}
                  >
                    <Image
                      src={src}
                      alt=""
                      fill
                      sizes="64px"
                      className="object-cover"
                      unoptimized={src.startsWith("http")}
                    />
                  </button>
                ))}
              </div>
            ) : null}
            <div className="flex flex-col gap-4 p-5">
              <div>
                <p className="text-[11px] font-semibold tracking-[0.08em] text-[#003F7D]">
                  Portfolio project
                </p>
                <h2 className="mt-1 text-2xl font-semibold tracking-tight">
                  {title}
                </h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {detail.description || "No customer-facing description yet."}
                </p>
              </div>
              <div className="grid gap-4 rounded-xl bg-[#eef1f5] p-4 sm:grid-cols-2">
                <Fact
                  label="Category"
                  value={toTitleCase(detail.categoryName) || "—"}
                />
                <Fact
                  label="Subcategory"
                  value={toTitleCase(detail.subcategoryName) || "—"}
                />
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-black/10 bg-card p-5">
            <p className="text-sm font-semibold">Project details</p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Fact label="Status" value={statusLabel(detail.status)} />
              <Fact
                label="Photos"
                value={`${detail.media.length} ${detail.media.length === 1 ? "photo" : "photos"}`}
              />
            </div>
          </section>
        </div>

        <aside className="flex flex-col gap-4 lg:sticky lg:top-4">
          <section className="rounded-xl border border-black/10 bg-card p-5">
            <p className="text-sm font-semibold">Summary</p>
            <div className="mt-3 grid gap-3">
              <Fact
                label="Category"
                value={toTitleCase(detail.categoryName) || "—"}
              />
              <Fact
                label="Subcategory"
                value={toTitleCase(detail.subcategoryName) || "—"}
              />
              <Fact label="Status" value={statusLabel(detail.status)} />
            </div>
          </section>
        </aside>
      </div>
    </PortalPage>
  );
}
