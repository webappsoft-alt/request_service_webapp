"use client";

import Link from "next/link";
import { CalendarDays, Globe, MapPin, Phone, ShieldCheck, Users } from "lucide-react";
import { PortalPage } from "@/components/portal/portal-page";
import { usePortalSettings } from "@/components/portal/use-portal-settings";
import { usePortalWorkspace } from "@/components/portal/use-portal-workspace";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getServiceCategoryById } from "@/lib/data/services";
import { formatHoursValue, formatLocation, formatWorkingDay } from "@/lib/format";
import { useAppSelector } from "@/store/hooks";
import {
  getUserAvatarSrc,
  selectAuthProvider,
  selectAuthUser,
} from "@/store/authSlice";

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
  const user = useAppSelector(selectAuthUser);
  const authProvider = useAppSelector(selectAuthProvider);
  const { provider } = usePortalWorkspace();
  const { officeHours } = usePortalSettings();

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
  const neighborhoods = Array.isArray(authProvider?.coverage?.neighborhoods)
    ? authProvider.coverage.neighborhoods.filter(
        (area): area is string => typeof area === "string",
      )
    : [];
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

  return (
    <PortalPage
      eyebrow="Public listing"
      title="Business Profile"
      description="Review your public company details. Use Edit to update them step by step."
      actions={
        <Button asChild>
          <Link href="/pro/dashboard/profile">Edit</Link>
        </Button>
      }
    >
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(18rem,1fr)]">
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader className="border-b">
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
            <CardHeader className="border-b">
              <CardTitle>About the company</CardTitle>
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
            <CardHeader className="border-b">
              <CardTitle>Coverage areas</CardTitle>
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
            <CardHeader className="border-b">
              <CardTitle>Services</CardTitle>
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
              {offeredJobs.length ? (
                <ul className="flex flex-col gap-1.5 text-sm text-muted-foreground">
                  {offeredJobs.slice(0, 8).map((job) => (
                    <li key={job}>• {job}</li>
                  ))}
                  {offeredJobs.length > 8 ? (
                    <li>+{offeredJobs.length - 8} more</li>
                  ) : null}
                </ul>
              ) : null}
              {startingPrice != null ? (
                <p className="text-sm">
                  Starting from{" "}
                  <span className="font-semibold tabular-nums">${startingPrice}</span>
                </p>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="border-b">
              <CardTitle>Working hours</CardTitle>
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
            <CardHeader className="border-b">
              <CardTitle>Portfolio</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 pt-4">
              <p className="text-sm text-muted-foreground">
                Manage showcase projects from the edit flow or the Portfolio page.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button asChild variant="outline" size="sm">
                  <Link href="/pro/dashboard/profile?step=portfolio">Manage in Edit</Link>
                </Button>
                <Button asChild variant="outline" size="sm">
                  <Link href="/pro/dashboard/portfolio">Open Portfolio</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </PortalPage>
  );
}
