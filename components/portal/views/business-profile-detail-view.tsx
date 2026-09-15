"use client";

import { useEffect, useMemo } from "react";
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
import { coverageNeighborhoodLabels } from "@/lib/coverage-areas";
import { getServiceCategoryById } from "@/lib/data/services";
import { formatHoursValue, formatLocation, formatWorkingDay } from "@/lib/format";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  getUserAvatarSrc,
  selectAuthProvider,
  selectAuthUser,
} from "@/store/authSlice";
import { fetchServiceAreasPicker } from "@/store/serviceAreasSlice";
import { ProfileSetupChips, ProfileSetupSummary } from "@/components/portal/profile-setup-chips";
import {
  getProfileSetupItems,
  profileSetupProgress,
} from "@/lib/business-profile-setup";

function SectionEdit({ href }: { href: string }) {
  return (
    <Button asChild size="sm" variant="outline">
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
    <div className="grid gap-1 border-b border-border/70 py-3 last:border-b-0 sm:grid-cols-[10rem_minmax(0,1fr)] sm:gap-4">
      <p className="text-xs font-medium tracking-[0.12em] text-muted-foreground uppercase">
        {label}
      </p>
      <div className="min-w-0 text-sm font-medium">{children}</div>
    </div>
  );
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

  useEffect(() => {
    void dispatch(fetchServiceAreasPicker());
  }, [dispatch]);

  const areasById = useMemo(() => {
    const map = new Map<string, string>();
    for (const area of [...listItems, ...pickerItems]) {
      if (area?.id && area.title) map.set(area.id, area.title);
    }
    return map;
  }, [listItems, pickerItems]);

  const firstName = String(user?.firstName || "").trim();
  const lastName = String(user?.lastName || "").trim();
  const displayName =
    [firstName, lastName].filter(Boolean).join(" ").trim() ||
    String(user?.email || "Provider");
  const initials =
    `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase() ||
    displayName.charAt(0).toUpperCase();
  const avatar = getUserAvatarSrc(user);

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
  const neighborhoods = coverageNeighborhoodLabels(
    authProvider?.coverage?.neighborhoods,
    areasById,
  );
  const startingPrice =
    typeof authProvider?.services?.startingPrice === "number"
      ? authProvider.services.startingPrice
      : null;
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
  const tagline = String(authProvider?.tagline || provider.tagline || "").trim();
  const gallery = normalizeBusinessGallery(authProvider?.businessGallery);
  const banner = galleryBanner(gallery);
  const otherPhotos = galleryRest(gallery);
  const setupItems = getProfileSetupItems(user, authProvider, officeHours);
  const setup = profileSetupProgress(setupItems);

  return (
    <PortalPage
      eyebrow="Public listing"
      title="Business Profile"
      description="Review your public company details. Edit any section to finish what’s left."
      actions={
        <Button asChild>
          <Link href={setup.next?.href || "/pro/dashboard/profile"}>
            {setup.percent < 100 ? "Continue setup" : "Edit profile"}
          </Link>
        </Button>
      }
    >
      {setup.percent < 100 ? (
        <Card className="border-primary/20 bg-primary/[0.03]">
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
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(18rem,1fr)]">
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader className="border-b">
              <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex flex-wrap items-center gap-4">
                <Avatar className="size-16 border border-border">
                  {avatar ? <AvatarImage src={avatar} alt={displayName} /> : null}
                  <AvatarFallback className="bg-primary/10 text-lg font-semibold text-primary">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <CardTitle className="text-xl">
                    {provider.companyName || "Your company"}
                  </CardTitle>
                  {tagline ? (
                    <p className="mt-1 text-sm text-muted-foreground">{tagline}</p>
                  ) : null}
                  <p className="mt-1 text-sm text-muted-foreground">{displayName}</p>
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

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-3 border-b">
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

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-3 border-b">
              <CardTitle>Coverage areas</CardTitle>
              <SectionEdit href="/pro/dashboard/profile?step=business" />
            </CardHeader>
            <CardContent className="pt-4">
              {neighborhoods.length ? (
                <div className="flex flex-wrap gap-2">
                  {neighborhoods.map((area) => (
                    <Badge key={area} variant="outline">
                      {area}
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No coverage neighborhoods selected yet.
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-3 border-b">
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
              {startingPrice != null ? (
                <p className="text-sm">
                  Starting from{" "}
                  <span className="font-semibold tabular-nums">${startingPrice}</span>
                </p>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-3 border-b">
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

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-3 border-b">
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

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-3 border-b">
              <CardTitle>Main business gallery</CardTitle>
              <SectionEdit href="/pro/dashboard/profile?step=gallery" />
            </CardHeader>
            <CardContent className="pt-4">
              {banner ? (
                <div className="flex flex-col gap-3">
                  <div className="relative aspect-[16/8] overflow-hidden rounded-lg border">
                    <Image
                      src={banner.url}
                      alt="Main banner"
                      fill
                      unoptimized
                      className="object-cover"
                      sizes="360px"
                    />
                  </div>
                  {otherPhotos.length ? (
                    <div className="grid grid-cols-3 gap-2">
                      {otherPhotos.map((photo) => (
                        <div key={photo.url} className="relative aspect-square overflow-hidden rounded-md border">
                          <Image src={photo.url} alt="" fill unoptimized className="object-cover" sizes="120px" />
                        </div>
                      ))}
                    </div>
                  ) : null}
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
        </div>
      </div>

      <div className="mt-4">
        <PortfolioView embedded />
      </div>
    </PortalPage>
  );
}
