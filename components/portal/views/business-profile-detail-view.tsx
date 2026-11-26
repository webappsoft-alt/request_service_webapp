"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { CalendarDays, Globe, MapPin, Phone, ShieldCheck, Users } from "lucide-react";
import Image from "next/image";
import { PortfolioView } from "@/components/portal/views/portfolio-view";
import { PortalPage } from "@/components/portal/portal-page";
import {
  galleryBanner,
  galleryRest,
  normalizeBusinessGallery,
} from "@/lib/business-gallery";
import { usePortalSettings } from "@/components/portal/use-portal-settings";
import { usePortalWorkspace } from "@/components/portal/use-portal-workspace";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  coverageNeighborhoodIds,
  coverageNeighborhoodLabels,
  formatServiceAreaCoverageLabels,
} from "@/lib/coverage-areas";
import { getServiceCategoryById } from "@/lib/data/services";
import { formatHoursValue, formatLocation, formatWorkingDay } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  getUserAvatarSrc,
  selectAuthProvider,
  selectAuthUser,
} from "@/store/authSlice";
import {
  fetchServiceAreasPicker,
  type ServiceArea,
} from "@/store/serviceAreasSlice";
import { ProfileSetupChips, ProfileSetupSummary } from "@/components/portal/profile-setup-chips";
import { WalletBalanceCard } from "@/components/portal/wallet-balance-card";
import { PremiumProfileCard, useProviderPremium } from "@/components/portal/premium-profile-card";
import { PremiumBadge } from "@/components/shared/premium-badge";
import {
  getProfileSetupItems,
  profileSetupProgress,
} from "@/lib/business-profile-setup";

/** Gallery mosaic (right block) by photo count: always a full rectangle, no empty cells. */
const GALLERY_TILE_GRID: Record<number, string> = {
  1: "grid-cols-1 grid-rows-1",
  2: "grid-cols-2 grid-rows-1",
  3: "grid-cols-2 grid-rows-2",
  4: "grid-cols-2 grid-rows-2",
  5: "grid-cols-3 grid-rows-2",
  6: "grid-cols-3 grid-rows-2",
};
/** Counts where the first tile spans two columns (3 → 1 wide + 2; 5 → 1 wide + 1, then 3). */
const GALLERY_FIRST_TILE_WIDE = new Set([3, 5]);

function SectionEdit({ href }: { href: string }) {
  return (
    <Button asChild size="sm" variant="outline" className="h-8 border-border-soft">
      <Link href={href}>Edit</Link>
    </Button>
  );
}

function DetailRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-1 border-b border-border-soft py-3 last:border-b-0 sm:grid-cols-[10rem_minmax(0,1fr)] sm:gap-4">
      <p className="text-xs font-medium tracking-[0.12em] text-muted-foreground uppercase">
        {label}
      </p>
      <div className="min-w-0 text-sm font-medium">{children}</div>
    </div>
  );
}

const softCardClass = "rounded-md border-border-soft";

type FlexCardKey = "coverage" | "hours" | "services" | "jobs";
type ColumnMap = Record<FlexCardKey, "left" | "right">;
const FLEX_CARD_ORDER: FlexCardKey[] = ["coverage", "hours", "services", "jobs"];
/** Mobile / tablet order, and the desktop start before measuring (the previous fixed layout). */
const DEFAULT_COLUMNS: ColumnMap = { coverage: "left", hours: "left", services: "right", jobs: "right" };
const COLUMN_GAP_PX = 16; // gap-4
const sameColumns = (a: ColumnMap, b: ColumnMap) => FLEX_CARD_ORDER.every((key) => a[key] === b[key]);

/**
 * Two-column layout that balances itself on desktop (lg+): the movable cards are split between the
 * columns so they end as close as possible, and the last card of each column stretches to the
 * bottom so both columns end on one line (no empty gap). Re-runs only when the page width, the height of the fixed top cards (e.g.
 * the Premium card loading, or Premium on / off) or the data (`contentKey`) changes, so moving a
 * card can't trigger another move.
 */
function useBalancedColumns(contentKey: string) {
  const gridRef = useRef<HTMLDivElement>(null);
  const leftFixedRef = useRef<HTMLDivElement>(null);
  const rightFixedRef = useRef<HTMLDivElement>(null);
  const cards = useRef<Partial<Record<FlexCardKey, HTMLDivElement | null>>>({});
  const [columnOf, setColumnOf] = useState<ColumnMap>(DEFAULT_COLUMNS);
  const lastInputs = useRef("");

  const cardRef = useCallback(
    (key: FlexCardKey) => (node: HTMLDivElement | null) => {
      cards.current[key] = node;
    },
    [],
  );

  useEffect(() => {
    const grid = gridRef.current;
    if (!grid || typeof ResizeObserver === "undefined") return;
    const desktop = window.matchMedia("(min-width: 1024px)");
    let frame = 0;
    lastInputs.current = "";

    const balance = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (!desktop.matches) {
          lastInputs.current = "";
          setColumnOf((prev) => (sameColumns(prev, DEFAULT_COLUMNS) ? prev : DEFAULT_COLUMNS));
          return;
        }
        const leftTop = leftFixedRef.current?.offsetHeight ?? 0;
        const rightTop = rightFixedRef.current?.offsetHeight ?? 0;
        const inputs = [grid.clientWidth, Math.round(leftTop / 8), Math.round(rightTop / 8), contentKey].join("|");
        if (inputs === lastInputs.current) return;
        lastInputs.current = inputs;

        // Natural heights: switch the bottom stretch off just for this read (same frame, no paint).
        const nodes = FLEX_CARD_ORDER.map((key) => cards.current[key] ?? null);
        nodes.forEach((node) => node && (node.style.flex = "none"));
        const heights = nodes.map((node) => (node?.offsetHeight ?? 0) + COLUMN_GAP_PX);
        nodes.forEach((node) => node && (node.style.flex = ""));

        // 4 movable cards = 16 ways to split them; keep the one where the columns end closest
        // (ties keep the default layout). Order inside each column stays the same.
        let best = DEFAULT_COLUMNS;
        let bestDiff = Number.POSITIVE_INFINITY;
        for (let mask = 0; mask < 1 << FLEX_CARD_ORDER.length; mask += 1) {
          let left = leftTop;
          let right = rightTop;
          const next = { ...DEFAULT_COLUMNS };
          FLEX_CARD_ORDER.forEach((key, index) => {
            if (mask & (1 << index)) {
              next[key] = "right";
              right += heights[index];
            } else {
              next[key] = "left";
              left += heights[index];
            }
          });
          const diff = Math.abs(left - right);
          if (diff < bestDiff - 1 || (Math.abs(diff - bestDiff) <= 1 && sameColumns(next, DEFAULT_COLUMNS))) {
            best = next;
            bestDiff = diff;
          }
        }
        setColumnOf((prev) => (sameColumns(prev, best) ? prev : best));
      });
    };

    const observer = new ResizeObserver(balance);
    observer.observe(grid);
    if (leftFixedRef.current) observer.observe(leftFixedRef.current);
    if (rightFixedRef.current) observer.observe(rightFixedRef.current);
    desktop.addEventListener("change", balance);
    balance();
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      desktop.removeEventListener("change", balance);
    };
  }, [contentKey]);

  return { gridRef, leftFixedRef, rightFixedRef, cardRef, columnOf };
}

export function BusinessProfileDetailView() {
  const dispatch = useAppDispatch();
  const user = useAppSelector(selectAuthUser);
  const authProvider = useAppSelector(selectAuthProvider);
  const pickerItems = useAppSelector(
    (state) => state.serviceAreas?.pickerItems ?? [],
  );
  const listItems = useAppSelector((state) => state.serviceAreas?.items ?? []);
  const { provider } = usePortalWorkspace();
  const { officeHours } = usePortalSettings();
  // Premium badge in the header (the Premium card below loads it).
  const isPremium = Boolean(useProviderPremium().data?.isPremium);

  useEffect(() => {
    void dispatch(fetchServiceAreasPicker());
  }, [dispatch]);

  const areasById = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const area of [...listItems, ...pickerItems]) {
      if (area?.id) map.set(area.id, formatServiceAreaCoverageLabels(area));
    }
    return map;
  }, [listItems, pickerItems]);

  const serviceAreasById = useMemo(() => {
    const map = new Map<string, ServiceArea>();
    for (const area of [...listItems, ...pickerItems]) {
      if (area?.id) map.set(area.id, area);
    }
    return map;
  }, [listItems, pickerItems]);

  const categoryIds = Array.isArray(authProvider?.services?.categoryIds)
    ? authProvider.services.categoryIds
    : [];
  const offeredJobs = Array.isArray(authProvider?.services?.offeredJobs)
    ? authProvider.services.offeredJobs.filter(
        (job): job is string => typeof job === "string",
      )
    : [];
  const categories = categoryIds
    .map((id) => getServiceCategoryById(id))
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  const neighborhoods = useMemo(() => {
    const selectedIds = coverageNeighborhoodIds(
      authProvider?.coverage?.neighborhoods,
    );
    const fromServiceAreas: string[] = [];
    for (const id of selectedIds) {
      const area = serviceAreasById.get(id);
      if (!area) continue;
      const city = [area.location?.city, area.location?.state]
        .filter(Boolean)
        .join(", ");
      const names = (area.areas || [])
        .map((item) => item.name?.trim())
        .filter((name): name is string => Boolean(name));
      if (names.length) {
        for (const name of names) {
          const label = city ? `${name} · ${city}` : name;
          if (!fromServiceAreas.includes(label)) fromServiceAreas.push(label);
        }
      } else {
        for (const label of formatServiceAreaCoverageLabels(area)) {
          if (label && !fromServiceAreas.includes(label)) {
            fromServiceAreas.push(label);
          }
        }
      }
    }
    if (fromServiceAreas.length) return fromServiceAreas;
    return coverageNeighborhoodLabels(
      authProvider?.coverage?.neighborhoods,
      areasById,
    );
  }, [
    areasById,
    authProvider?.coverage?.neighborhoods,
    serviceAreasById,
  ]);

  const firstName = String(user?.firstName || "").trim();
  const lastName = String(user?.lastName || "").trim();
  const displayName =
    [firstName, lastName].filter(Boolean).join(" ").trim() ||
    String(user?.email || "Provider");
  const initials =
    `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase() ||
    displayName.charAt(0).toUpperCase();
  const avatar = getUserAvatarSrc(user);

  const years =
    typeof authProvider?.profile?.yearsInBusiness === "number"
      ? authProvider.profile.yearsInBusiness
      : null;
  const team = String(authProvider?.profile?.employeeCount || "").trim();
  const website = String(authProvider?.website || provider.website || "").trim();
  const role = String(authProvider?.contactRole || "").trim();
  const phone = String(provider.phone || "").trim();
  const email = String(provider.email || user?.email || "").trim();
  const about = String(authProvider?.description || provider.description || "").trim();
  const gallery = normalizeBusinessGallery(authProvider?.businessGallery);
  const banner = galleryBanner(gallery);
  const otherPhotos = galleryRest(gallery);
  const setupItems = getProfileSetupItems(user, authProvider, officeHours);
  const setup = profileSetupProgress(setupItems);

  const { gridRef, leftFixedRef, rightFixedRef, cardRef, columnOf } = useBalancedColumns(
    [neighborhoods.length, officeHours.length, categories.length, offeredJobs.length].join("|"),
  );
  // Client: the page must look the same with or without the Premium card. The top cards stay put
  // (profile + about left, Premium + wallet right); these four go to whichever column is shorter.
  const flexCards: Record<FlexCardKey, ReactNode> = {
    coverage: (
      <Card className={softCardClass}>
        <CardHeader className="flex flex-row items-center justify-between gap-3 border-b border-border-soft">
          <CardTitle>Coverage areas</CardTitle>
          <SectionEdit href="/pro/dashboard/profile?step=business" />
        </CardHeader>
        <CardContent className="pt-4">
          {neighborhoods.length ? (
            <div className="flex flex-wrap gap-2">
              {neighborhoods.map((area) => (
                <span
                  key={area}
                  className="rounded-md bg-secondary px-2.5 py-1 text-xs font-medium"
                >
                  {area}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No coverage neighborhoods selected yet.
            </p>
          )}
        </CardContent>
      </Card>
    ),
    hours: (
      <Card className={softCardClass}>
        <CardHeader className="flex flex-row items-center justify-between gap-3 border-b border-border-soft">
          <CardTitle>Working hours</CardTitle>
          <SectionEdit href="/pro/dashboard/profile?step=hours" />
        </CardHeader>
        <CardContent className="pt-4">
          {officeHours.length ? (
            <ul className="flex flex-col gap-1.5 text-sm">
              {officeHours.map((hours) => (
                <li key={hours.day} className="flex justify-between gap-3">
                  <span className="text-muted-foreground">
                    {formatWorkingDay(hours.day)}
                  </span>
                  <span className="font-medium tabular-nums">
                    {formatHoursValue(hours)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">Hours not listed yet.</p>
          )}
        </CardContent>
      </Card>
    ),
    services: (
      <Card className={softCardClass}>
        <CardHeader className="flex flex-row items-center justify-between gap-3 border-b border-border-soft">
          <CardTitle>Services</CardTitle>
          <SectionEdit href="/pro/dashboard/profile?step=categories" />
        </CardHeader>
        <CardContent className="flex flex-col gap-4 pt-4">
          {categories.length ? (
            <div className="flex flex-wrap gap-2">
              {categories.map((category) => (
                <Badge key={category.id} variant="secondary">
                  {category.name}
                </Badge>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No service categories selected yet.
            </p>
          )}
        </CardContent>
      </Card>
    ),
    jobs: (
      <Card className={softCardClass}>
        <CardHeader className="flex flex-row items-center justify-between gap-3 border-b border-border-soft">
          <CardTitle>Jobs you offer</CardTitle>
          <SectionEdit href="/pro/dashboard/profile?step=subservices" />
        </CardHeader>
        <CardContent className="pt-4">
          {offeredJobs.length ? (
            <ul className="flex flex-col gap-1.5 text-sm text-muted-foreground">
              {offeredJobs.slice(0, 8).map((job) => (
                <li key={job}>• {job}</li>
              ))}
              {offeredJobs.length > 8 ? (
                <li>+{offeredJobs.length - 8} more</li>
              ) : null}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              No jobs selected yet.
            </p>
          )}
        </CardContent>
      </Card>
    ),
  };
  const renderFlex = (column: "left" | "right") => {
    const keys = FLEX_CARD_ORDER.filter((key) => columnOf[key] === column);
    return keys.map((key, index) => (
      <div
        key={key}
        ref={cardRef(key)}
        // Desktop: the column's last card fills down to the other column's end (no gap below it).
        className={cn("flex min-w-0 flex-col *:flex-1", index === keys.length - 1 && "lg:flex-1")}
      >
        {flexCards[key]}
      </div>
    ));
  };

  return (
    <PortalPage
      eyebrow="Public listing"
      title="Business Profile"
      description="Review your public company details. Edit any section to finish what’s left."
      actions={
        <Button asChild size="sm" className="h-8">
          <Link href={setup.next?.href || "/pro/dashboard/profile"}>
            {setup.percent < 100 ? "Continue setup" : "Edit profile"}
          </Link>
        </Button>
      }
    >
      {setup.percent < 100 ? (
        <Card className={`${softCardClass} bg-primary/[0.03]`}>
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-base">Set up your business profile</CardTitle>
              <ProfileSetupSummary
                done={setup.done}
                total={setup.total}
                percent={setup.percent}
                nextLabel={setup.next?.label}
              />
            </div>
          </CardHeader>
          <CardContent>
            <div className="mb-3 h-2 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary" style={{ width: `${setup.percent}%` }} />
            </div>
            <ProfileSetupChips items={setupItems} />
          </CardContent>
        </Card>
      ) : null}
      {/* Balanced 7/5 split; min-w-0 keeps wide content (gallery, long URLs) inside its column.
          Columns balance themselves (useBalancedColumns), so the Premium card — shown or not, long or
          short — never leaves a gap under one column. */}
      <div ref={gridRef} className="grid items-start gap-4 lg:grid-cols-12 lg:items-stretch">
        <div className="flex min-w-0 flex-col gap-4 lg:col-span-7">
          <div ref={leftFixedRef} className="flex min-w-0 flex-col gap-4">
            <Card className={softCardClass}>
              <CardHeader className="border-b border-border-soft">
                <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex flex-wrap items-center gap-4">
                  <Avatar className="size-16 border border-border-soft">
                    {avatar ? <AvatarImage src={avatar} alt={displayName} /> : null}
                    <AvatarFallback className="bg-primary text-lg font-semibold text-primary-foreground">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
                      Business profile
                    </p>
                    <h2 className="mt-1 flex flex-wrap items-center gap-2 text-xl font-semibold tracking-tight text-foreground">
                      {provider.companyName || "Your company"}
                      {isPremium ? <PremiumBadge size="xs" /> : null}
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {displayName}
                      {role ? ` · ${role}` : ""}
                    </p>
                  </div>
                </div>
                <SectionEdit href="/pro/dashboard/profile?step=account" />
                </div>
              </CardHeader>
              <CardContent className="pt-1">
                <DetailRow label="Owner">{displayName}</DetailRow>
                {role ? <DetailRow label="Role">{role}</DetailRow> : null}
                <DetailRow label="Phone">
                  {phone ? (
                    <span className="inline-flex items-center gap-1.5">
                      <Phone className="size-3.5 text-muted-foreground" aria-hidden />
                      {phone}
                    </span>
                  ) : (
                    <span className="font-normal text-muted-foreground">Not listed</span>
                  )}
                </DetailRow>
                <DetailRow label="Email">
                  {email || (
                    <span className="font-normal text-muted-foreground">Not listed</span>
                  )}
                </DetailRow>
                <DetailRow label="Address">
                  <span className="inline-flex items-start gap-1.5">
                    <MapPin className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                    <span>
                      {provider.street ? <span className="block">{provider.street}</span> : null}
                      <span className="font-normal text-muted-foreground">
                        {formatLocation(provider.city, provider.state, provider.zip) ||
                          "Not listed"}
                      </span>
                    </span>
                  </span>
                </DetailRow>
                <DetailRow label="Website">
                  {website ? (
                    <a
                      href={website.startsWith("http") ? website : `https://${website}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 text-primary hover:underline"
                    >
                      <Globe className="size-3.5" aria-hidden />
                      {website.replace(/^https?:\/\//, "")}
                    </a>
                  ) : (
                    <span className="font-normal text-muted-foreground">Not listed</span>
                  )}
                </DetailRow>
              </CardContent>
            </Card>

            <Card className={softCardClass}>
              <CardHeader className="flex flex-row items-center justify-between gap-3 border-b border-border-soft">
                <CardTitle>About the company</CardTitle>
                <SectionEdit href="/pro/dashboard/profile?step=profile" />
              </CardHeader>
              <CardContent className="pt-4">
                <p className="text-sm leading-6 text-foreground">
                  {about || (
                    <span className="text-muted-foreground">
                      No company description yet.
                    </span>
                  )}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {years != null ? (
                    <Badge variant="secondary">
                      <CalendarDays className="size-3.5" aria-hidden />
                      {years} years in business
                    </Badge>
                  ) : null}
                  {team ? (
                    <Badge variant="secondary">
                      <Users className="size-3.5" aria-hidden />
                      Team · {team}
                    </Badge>
                  ) : null}
                  {provider.licensed ? (
                    <Badge variant="secondary">
                      <ShieldCheck className="size-3.5" aria-hidden />
                      Licensed
                    </Badge>
                  ) : null}
                  {provider.insured ? (
                    <Badge variant="secondary">
                      <ShieldCheck className="size-3.5" aria-hidden />
                      Insured
                    </Badge>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          </div>
          {renderFlex("left")}
        </div>

        <div className="flex min-w-0 flex-col gap-4 lg:col-span-5">
          <div ref={rightFixedRef} className="flex min-w-0 flex-col gap-4">
            {/* Client: Premium Business Profile — top of city / state searches, paid from the wallet. */}
            <PremiumProfileCard />
            {/* Client: read-only wallet balance (collected − payouts − expenses), calculated by the API. */}
            <WalletBalanceCard />
          </div>
          {renderFlex("right")}
        </div>
      </div>

      {/* Main business gallery: full width under both columns (banner + photos side by side).
          It used to end the right column, leaving a large gap under Working hours on the left;
          the two columns now end at about the same height. */}
      <Card className={`${softCardClass} mt-4`}>
        <CardHeader className="flex flex-row items-center justify-between gap-3 border-b border-border-soft">
          <CardTitle>Main business gallery</CardTitle>
          <SectionEdit href="/pro/dashboard/profile?step=gallery" />
        </CardHeader>
        <CardContent className="pt-4">
          {banner ? (
            <div className="flex flex-col gap-3">
              {/* Mosaic: banner on the left, the other photos fill a block of the same height on
                  the right, with a tile layout per photo count (1–6) so there are no empty cells.
                  Previous: square thumbnails that left gaps beside the banner. */}
              <div className={cn("grid gap-2", otherPhotos.length ? "lg:h-[26rem] lg:grid-cols-2" : "")}>
                <div
                  className={cn(
                    "relative w-full overflow-hidden rounded-lg border border-border-soft",
                    otherPhotos.length ? "aspect-video lg:aspect-auto lg:h-full" : "aspect-[21/9]",
                  )}
                >
                  <Image
                    src={banner.url}
                    alt="Main banner"
                    fill
                    unoptimized
                    className="object-cover"
                    sizes="(min-width: 1024px) 50vw, 100vw"
                  />
                  <span className="absolute top-2 left-2 rounded-full bg-black/60 px-2 py-0.5 text-[11px] font-medium text-white">
                    Main banner
                  </span>
                </div>
                {otherPhotos.length ? (
                  <div className={cn("grid h-64 gap-2 sm:h-80 lg:h-full", GALLERY_TILE_GRID[Math.min(otherPhotos.length, 6)])}>
                    {otherPhotos.slice(0, 6).map((photo, index) => (
                      <div
                        key={photo.url}
                        className={cn(
                          "relative min-h-0 min-w-0 overflow-hidden rounded-lg border border-border-soft",
                          index === 0 && GALLERY_FIRST_TILE_WIDE.has(otherPhotos.length) && "col-span-2",
                        )}
                      >
                        <Image src={photo.url} alt="" fill unoptimized className="object-cover" sizes="(min-width: 1024px) 25vw, 50vw" />
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
              <p className="text-xs text-muted-foreground">
                {gallery.length} of 7 photos · banner shows first on your public profile
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Add 3–7 photos and choose a main banner for your public profile.
            </p>
          )}
        </CardContent>
      </Card>

      <div className="mt-4">
        <PortfolioView embedded />
      </div>
    </PortalPage>
  );
}
