"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Wrench } from "lucide-react";
import { getData } from "@/components/api/apiFuntions";
import { publicApi } from "@/components/api/ApiRoutesFile";
import { JobDetail } from "@/components/marketplace/job-detail";
import { RelatedBrowse } from "@/components/marketplace/related-browse";
import { FixedServiceOrderDialog } from "@/components/marketplace/fixed-service-order-dialog";
import type { ServiceJobListing } from "@/components/marketplace/service-job-card";
import { Container } from "@/components/layout/container";
import { CenteredSpinner } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  fetchPublicFixedServiceBySlug,
  normalizePublicFixedService,
  selectPublicFixedServiceBySlug,
  setPublicFixedServiceDetail,
  type PublicFixedService,
} from "@/store/publicFixedServicesSlice";
import {
  normalizePublicProfessional,
  publicProfessionalToProvider,
} from "@/store/publicProfessionalsSlice";
import { setPendingOrderDraft } from "@/store/ordersSlice";
import type { JobRecord } from "@/lib/data/jobs";
import type { Provider, ServiceCategory, ServiceCategorySlug } from "@/lib/types";
import { getServiceCategoryBySlug } from "@/lib/data/services";
import { locationDisplayLabel } from "@/store/locationSlice";
import {
  pendingFixedOrderMatchesService,
  readPendingFixedOrder,
  type PendingFixedOrder,
} from "@/lib/booking/pending-fixed-order";

const RELATED_LIMIT = 8;

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function idOf(value: unknown): string {
  if (typeof value === "string" && value.trim()) return value.trim();
  const record = asRecord(value);
  if (!record) return "";
  if (typeof record.id === "string" && record.id.trim()) return record.id.trim();
  if (typeof record._id === "string" && record._id.trim()) return record._id.trim();
  return "";
}

function extractList(response: unknown): unknown[] {
  const root = asRecord(response) ?? {};
  const nested = asRecord(root.data);
  if (Array.isArray(root.data)) return root.data;
  if (nested && Array.isArray(nested.data)) return nested.data;
  if (Array.isArray(response)) return response;
  return [];
}

function categoryFromService(service: PublicFixedService): ServiceCategory {
  const slug = (service.category?.slug || "plumbing") as ServiceCategorySlug;
  const existing = getServiceCategoryBySlug(slug);
  if (existing) return existing;

  const name = service.category?.name || "Service";
  return {
    id: service.category?.id || service.id,
    slug,
    name,
    shortName: name,
    tagline: service.provider?.tagline || service.subcategory?.name || "",
    description: "",
    longDescription: "",
    commonServices: [],
    benefits: defaultBenefits(service),
    seoTitle: name,
    seoDescription: "",
    icon: service.category?.icon || "",
    image: service.category?.image,
  };
}

function defaultBenefits(service: PublicFixedService): string[] {
  const benefits: string[] = [];
  const profile = service.provider?.profile;
  if (profile?.licensed && profile?.insured) {
    benefits.push("Licensed and insured professionals");
  } else if (profile?.licensed) {
    benefits.push("Licensed professionals");
  } else if (profile?.insured) {
    benefits.push("Insured professionals");
  }
  benefits.push(
    "Written estimates before work begins",
    "Photo-supported requests",
    "Clear scheduling and follow-up",
  );
  return benefits.slice(0, 4);
}

function descriptionFromService(service: PublicFixedService): string {
  const fromProvider = service.provider?.description?.trim();
  if (fromProvider) return fromProvider;
  if (service.covered.length) {
    return `${service.servicesName} typically includes ${service.covered
      .slice(0, 3)
      .join(", ")
      .toLowerCase()}.`;
  }
  const company = service.provider?.companyName?.trim();
  return company
    ? `${service.servicesName} from ${company}.`
    : `${service.servicesName}.`;
}

function jobRecordFromService(service: PublicFixedService): JobRecord {
  const category = categoryFromService(service);
  return {
    category,
    job: service.servicesName,
    index: 0,
    slug: service.slug,
    detail: {
      description: descriptionFromService(service),
      points: service.covered.length
        ? service.covered
        : ["Scope confirmed after booking"],
      icon: Wrench,
    },
  };
}

function providerFromService(service: PublicFixedService): Provider | null {
  const p = service.provider;
  if (!p) return null;
  const coords = Array.isArray(p.location?.coordinates)
    ? p.location.coordinates
    : [];
  const lng = typeof coords[0] === "number" ? coords[0] : 0;
  const lat = typeof coords[1] === "number" ? coords[1] : 0;
  const initials = p.companyName
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return {
    id: p.id,
    slug: p.slug || p.id,
    companyName: p.companyName,
    logoInitials: initials || "PR",
    coverImage: service.images[0],
    images: service.images,
    startingPrice: service.price,
    tagline: p.tagline || "",
    description: p.description || "",
    rating: p.rating.average,
    reviewCount: p.rating.totalReviews,
    yearsInBusiness: p.profile.yearsInBusiness,
    licensed: p.profile.licensed,
    insured: p.profile.insured,
    categoryIds: service.category?.id ? [service.category.id] : [],
    serviceArea: service.workingArea,
    street: p.location.address || "",
    city: p.location.city || "",
    state: "",
    zip: p.location.zip || "",
    lat,
    lng,
    phone: "",
    email: "",
    workingHours: [],
    gallery: service.images,
    foundedYear: 0,
    employeeCount: "",
    reviews: [],
  };
}

function logoInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "PR";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}

/** Map `GET /public/professionals/related` rows → Provider cards. */
function providerFromRelatedProfessional(raw: unknown): Provider | null {
  const record = asRecord(raw);
  if (!record) return null;
  const id = idOf(record);
  if (!id) return null;

  const companyName =
    (typeof record.companyName === "string" && record.companyName.trim()) ||
    (typeof record.providerName === "string" && record.providerName.trim()) ||
    "Professional";
  const metrics = asRecord(record.metrics) || asRecord(record.pricing) || {};
  const verification = asRecord(record.verification) || {};
  const zones = Array.isArray(record.operatingZones)
    ? record.operatingZones
    : [];
  const firstZone = asRecord(zones[0]);
  const categories = Array.isArray(record.categories) ? record.categories : [];
  const categoryIds = categories.map(idOf).filter(Boolean);

  return {
    id,
    slug: (typeof record.slug === "string" && record.slug.trim()) || id,
    companyName,
    logoInitials: logoInitials(companyName),
    logoUrl:
      (typeof record.avatar === "string" && record.avatar) ||
      (typeof record.avatarUrl === "string" && record.avatarUrl) ||
      undefined,
    coverImage: undefined,
    startingPrice:
      typeof metrics.startingPrice === "number" ? metrics.startingPrice : undefined,
    tagline:
      (typeof record.headline === "string" && record.headline) ||
      (typeof record.tagline === "string" && record.tagline) ||
      "",
    description:
      (typeof record.bio === "string" && record.bio) ||
      (typeof record.description === "string" && record.description) ||
      "",
    rating:
      typeof metrics.averageRating === "number" ? metrics.averageRating : 0,
    reviewCount:
      typeof metrics.totalReviews === "number" ? metrics.totalReviews : 0,
    yearsInBusiness:
      typeof record.experienceYears === "number" ? record.experienceYears : 0,
    licensed: Boolean(verification.isLicensed ?? verification.licensed),
    insured: Boolean(verification.isInsured ?? verification.insured),
    categoryIds,
    serviceArea: zones
      .map((zone) => {
        const item = asRecord(zone);
        return typeof item?.zipCode === "string" ? item.zipCode : "";
      })
      .filter(Boolean),
    street: "",
    city:
      (typeof firstZone?.city === "string" && firstZone.city) ||
      (typeof record.city === "string" && record.city) ||
      "",
    state: (typeof firstZone?.state === "string" && firstZone.state) || "",
    zip: (typeof firstZone?.zipCode === "string" && firstZone.zipCode) || "",
    lat: 0,
    lng: 0,
    phone: "",
    email: "",
    workingHours: [],
    gallery: [],
    foundedYear: 0,
    employeeCount: "",
    reviews: [],
  };
}

function listingFromRelatedService(raw: unknown): ServiceJobListing | null {
  const normalized = normalizePublicFixedService(raw);
  if (normalized) {
    const categorySlug = normalized.category?.slug || "";
    return {
      id: normalized.id,
      title: normalized.servicesName,
      categoryName: normalized.category?.name || "Service",
      categorySlug,
      imageUrl: normalized.images[0],
      price: normalized.price,
      covered: normalized.covered,
      companyName: normalized.provider?.companyName,
      rating: normalized.provider?.rating.average,
      reviewCount: normalized.provider?.rating.totalReviews,
      city: normalized.provider?.location.city,
      state: "",
      href: categorySlug
        ? `/services/${categorySlug}/${normalized.slug}`
        : `/services/${normalized.slug}`,
      online: true,
    };
  }

  const record = asRecord(raw);
  if (!record) return null;
  const id = idOf(record);
  const title =
    typeof record.servicesName === "string" ? record.servicesName : "";
  const slug = typeof record.slug === "string" ? record.slug : "";
  if (!id || !title) return null;
  const category = asRecord(record.category);
  const provider = asRecord(record.provider);
  const rating = asRecord(provider?.rating);
  const categorySlug =
    (typeof category?.slug === "string" && category.slug) || "";
  const images = Array.isArray(record.images)
    ? record.images.filter((item): item is string => typeof item === "string")
    : [];

  return {
    id,
    title,
    categoryName:
      (typeof category?.name === "string" && category.name) || "Service",
    categorySlug,
    imageUrl: images[0],
    price: typeof record.price === "number" ? record.price : 0,
    covered: Array.isArray(record.covered)
      ? record.covered.filter((item): item is string => typeof item === "string")
      : [],
    companyName:
      typeof provider?.companyName === "string"
        ? provider.companyName
        : undefined,
    rating: typeof rating?.average === "number" ? rating.average : undefined,
    reviewCount:
      typeof rating?.totalReviews === "number" ? rating.totalReviews : undefined,
    city: typeof provider?.city === "string" ? provider.city : undefined,
    state: "",
    href:
      categorySlug && slug
        ? `/services/${categorySlug}/${slug}`
        : slug
          ? `/services/${slug}`
          : "#",
    online: true,
  };
}

function mergeProviders(...lists: Provider[][]): Provider[] {
  const seen = new Set<string>();
  const next: Provider[] = [];
  for (const list of lists) {
    for (const item of list) {
      if (!item.id || seen.has(item.id)) continue;
      seen.add(item.id);
      next.push(item);
    }
  }
  return next;
}

export function PublicFixedServiceDetail({
  categorySlug,
  serviceSlug,
}: {
  categorySlug: string;
  serviceSlug: string;
}) {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [orderOpen, setOrderOpen] = useState(false);
  const [restoreDraft, setRestoreDraft] = useState<PendingFixedOrder | null>(
    null,
  );
  const [relatedProviders, setRelatedProviders] = useState<Provider[]>([]);
  const [relatedListings, setRelatedListings] = useState<ServiceJobListing[]>(
    [],
  );
  const [relatedLoading, setRelatedLoading] = useState(false);

  const service = useAppSelector((state) =>
    selectPublicFixedServiceBySlug(state, serviceSlug),
  );
  const detailLoading = useAppSelector(
    (state) => state.publicFixedServices.detailLoading,
  );
  const detailError = useAppSelector(
    (state) => state.publicFixedServices.detailError,
  );
  const detailSlug = useAppSelector(
    (state) => state.publicFixedServices.detail?.slug,
  );
  const customerLocation = useAppSelector((state) => state.location);
  const loc = locationDisplayLabel(customerLocation);
  const zip = customerLocation.zip.trim();
  const lat = customerLocation.latitude;
  const lng = customerLocation.longitude;

  useEffect(() => {
    if (!serviceSlug) return;
    if (service) {
      if (detailSlug !== service.slug) {
        dispatch(setPublicFixedServiceDetail(service));
      }
      return;
    }
    void dispatch(fetchPublicFixedServiceBySlug(serviceSlug));
  }, [detailSlug, dispatch, service, serviceSlug]);

  useEffect(() => {
    if (!service) return;
    if (searchParams.get("book") !== "1") return;

    const pending = readPendingFixedOrder();
    const matches = pendingFixedOrderMatchesService(
      pending,
      service.id,
      service.slug,
    );
    if (matches && pending) {
      setRestoreDraft(pending);
      dispatch(setPendingOrderDraft(pending));
    }
    setOrderOpen(true);

    const next = new URLSearchParams(searchParams.toString());
    next.delete("book");
    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, {
      scroll: false,
    });
  }, [dispatch, pathname, router, searchParams, service]);

  const serviceId = service?.id || "";
  const categoryId = service?.category?.id || "";

  useEffect(() => {
    if (!serviceId || !service) {
      setRelatedProviders([]);
      setRelatedListings([]);
      setRelatedLoading(false);
      return;
    }

    let cancelled = false;
    const categorySlug = service.category?.slug || "";
    setRelatedLoading(true);
    setRelatedProviders([]);
    setRelatedListings([]);

    async function loadRelated(source: PublicFixedService) {
      const ownProvider = providerFromService(source);
      const query: Record<string, string | number> = {
        fixedServiceId: source.id,
        limit: RELATED_LIMIT,
      };

      try {
        const [relatedProsRes, relatedJobsRes] = await Promise.all([
          getData(publicApi.professionalsRelated, query, { silent: true }),
          getData(publicApi.fixedServicesRelated, query, { silent: true }),
        ]);

        if (cancelled) return;

        let providers = extractList(relatedProsRes)
          .map(providerFromRelatedProfessional)
          .filter((item): item is Provider => Boolean(item));

        // Related scoring can return few/no rows (strict geo overlap). Fall back
        // to the public professionals directory for the same category.
        if (providers.length < 4 && categoryId) {
          const fallbackQuery: Record<string, string | number> = {
            page: 1,
            limit: RELATED_LIMIT,
            category: categoryId,
            sortBy: "rating",
            sortOrder: "desc",
          };
          if (typeof lat === "number" && Number.isFinite(lat)) {
            fallbackQuery.lat = lat;
          }
          if (typeof lng === "number" && Number.isFinite(lng)) {
            fallbackQuery.lng = lng;
          }
          try {
            const fallbackRes = await getData(
              publicApi.professionals,
              fallbackQuery,
              { silent: true },
            );
            if (!cancelled) {
              const fallback = extractList(fallbackRes)
                .map(normalizePublicProfessional)
                .filter(Boolean)
                .map((item) => publicProfessionalToProvider(item!));
              providers = mergeProviders(providers, fallback);
            }
          } catch {
            // Keep related-only results.
          }
        }

        if (ownProvider) {
          providers = mergeProviders([ownProvider], providers);
        }

        let relatedRaw = extractList(relatedJobsRes);
        let listings = relatedRaw
          .map(listingFromRelatedService)
          .filter((item): item is ServiceJobListing => Boolean(item))
          .filter((item) => item.id !== source.id);

        // fixed-services/related often returns [] (geo/scoring). Fall back to
        // same-category public fixed services so Related jobs still populates.
        if (!listings.length && categoryId) {
          const jobsFallbackQuery: Record<string, string | number> = {
            page: 1,
            limit: RELATED_LIMIT + 1,
            category: JSON.stringify([categoryId]),
            sortBy: "recommended",
          };
          if (typeof lat === "number" && Number.isFinite(lat)) {
            jobsFallbackQuery.lat = lat;
          }
          if (typeof lng === "number" && Number.isFinite(lng)) {
            jobsFallbackQuery.lng = lng;
          }
          try {
            const jobsFallbackRes = await getData(
              publicApi.fixedServices,
              jobsFallbackQuery,
              { silent: true },
            );
            if (!cancelled) {
              relatedRaw = extractList(jobsFallbackRes);
              listings = relatedRaw
                .map(listingFromRelatedService)
                .filter((item): item is ServiceJobListing => Boolean(item))
                .filter((item) => item.id !== source.id);
            }
          } catch {
            // Leave listings empty.
          }
        }

        listings = listings.slice(0, RELATED_LIMIT).map((listing) => ({
          ...listing,
          onBeforeNavigate: () => {
            const match = relatedRaw
              .map(normalizePublicFixedService)
              .find((item) => item?.id === listing.id);
            if (match) dispatch(setPublicFixedServiceDetail(match));
          },
          href:
            listing.href && listing.href !== "#"
              ? listing.href
              : categorySlug
                ? `/services/${categorySlug}/${listing.id}`
                : listing.href,
        }));

        if (!cancelled) {
          setRelatedProviders(providers.slice(0, RELATED_LIMIT));
          setRelatedListings(listings);
          setRelatedLoading(false);
        }
      } catch {
        if (cancelled) return;
        setRelatedProviders(ownProvider ? [ownProvider] : []);
        setRelatedListings([]);
        setRelatedLoading(false);
      }
    }

    void loadRelated(service);
    return () => {
      cancelled = true;
    };
  }, [categoryId, dispatch, lat, lng, service, serviceId]);

  const record = useMemo(
    () => (service ? jobRecordFromService(service) : null),
    [service],
  );

  const providers = useMemo(() => {
    if (relatedLoading) return [] as Provider[];
    if (relatedProviders.length) return relatedProviders;
    if (!service) return [] as Provider[];
    const provider = providerFromService(service);
    return provider ? [provider] : [];
  }, [relatedLoading, relatedProviders, service]);

  if (service && record) {
    const categoryPath = `/services/${service.category?.slug || categorySlug}`;
    return (
      <>
        <JobDetail
          record={record}
          providers={providers}
          relatedListings={relatedListings}
          relatedLoading={relatedLoading}
          providersLoading={relatedLoading}
          content={{
            price: service.price,
            imageUrl: service.images[0],
            imageUrls: service.images,
            description: descriptionFromService(service),
            points: service.covered,
            tagline:
              service.provider?.tagline ||
              service.subcategory?.name ||
              service.category?.name ||
              "",
            benefits: defaultBenefits(service),
            hideRelated: true,
            onRequestJob: () => {
              setRestoreDraft(null);
              setOrderOpen(true);
            },
            compareHref: categoryPath,
          }}
        />
        <RelatedBrowse
          category={record.category}
          currentJob={
            service.subcategory?.name || service.servicesName || undefined
          }
          basePath="/services"
          zip={zip || undefined}
          loc={loc || undefined}
        />
        <FixedServiceOrderDialog
          open={orderOpen}
          onOpenChange={(next) => {
            setOrderOpen(next);
            if (!next) setRestoreDraft(null);
          }}
          service={service}
          initialDraft={restoreDraft}
        />
      </>
    );
  }

  if (detailLoading || !detailError) {
    return (
      <Container className="py-16">
        <CenteredSpinner label="Loading service" className="min-h-[22rem]" />
      </Container>
    );
  }

  return (
    <Container className="flex flex-col items-start gap-4 py-16">
      <h1 className="text-2xl font-semibold">Service not found</h1>
      <p className="text-muted-foreground">
        This fixed service is no longer available.
      </p>
      <Button asChild>
        <Link href={`/services/${categorySlug}`}>Back to services</Link>
      </Button>
    </Container>
  );
}
