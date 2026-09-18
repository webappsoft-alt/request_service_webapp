"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { getData } from "@/components/api/apiFuntions";
import { publicApi } from "@/components/api/ApiRoutesFile";
import { Container } from "@/components/layout/container";
import { ProviderProfile } from "@/components/marketplace/provider-profile";
import { ProfessionalDetailSkeleton } from "@/components/shared/loading-skeletons";
import { galleryBanner, galleryRest, normalizeBusinessGallery } from "@/lib/business-gallery";
import type { ExplorePlace } from "@/lib/data/profile-explore";
import type { PortalFixedService } from "@/lib/data/portal";
import { getServiceAreaNames } from "@/lib/data/service-areas";
import { getServiceCategoryById, getServiceCategoryBySlug } from "@/lib/data/services";
import type {
  Provider,
  ProviderProject,
  ServiceCategory,
  ServiceCategorySlug,
} from "@/lib/types";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { trackLeadInteraction } from "@/lib/api/crm-client";
import { readChatGuest } from "@/lib/booking/chat-store";
import {
  normalizePortfolioProject,
  type PortfolioProject,
} from "@/store/portfolioSlice";
import {
  fetchPublicProfessionalBySlug,
  hasProfessionalDetailFields,
  normalizePublicProfessional,
  publicProfessionalToProvider,
  selectPublicProfessionalBySlug,
  setPublicPortfolioProjects,
  setPublicProfessionalDetail,
  type PublicProfessional,
  type PublicProfessionalActiveService,
} from "@/store/publicProfessionalsSlice";
import { selectAuthUser } from "@/store/authSlice";

const RELATED_LIMIT = 8;

type LivePortalFixedService = PortalFixedService & {
  liveCategorySlug?: string;
  liveSlug?: string;
};

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

function categoriesFromProfessional(
  categoryIds: string[],
  primary: {
    id: string;
    name: string;
    slug: string;
  } | null,
  tradeTitle = "",
): ServiceCategory[] {
  const fromIds = categoryIds
    .map((id) => getServiceCategoryById(id))
    .filter((item): item is ServiceCategory => Boolean(item));
  if (fromIds.length) return fromIds;

  if (!primary) return [];

  const slugCandidates = [
    primary.slug,
    primary.id,
    primary.name,
    tradeTitle,
  ]
    .map((value) => value.trim().toLowerCase().replace(/\s+/g, "-"))
    .filter(Boolean);

  for (const candidate of slugCandidates) {
    const byId = getServiceCategoryById(candidate);
    if (byId) return [byId];
    const bySlug = getServiceCategoryBySlug(candidate);
    if (bySlug) return [bySlug];
    if (candidate.startsWith("cat_")) {
      const stripped = candidate.slice(4).replace(/_/g, "-");
      const strippedCat =
        getServiceCategoryBySlug(stripped) ||
        getServiceCategoryById(`cat_${stripped.replace(/-/g, "_")}`);
      if (strippedCat) return [strippedCat];
    }
  }

  const name =
    primary.name.trim() ||
    tradeTitle.trim() ||
    primary.slug.trim() ||
    primary.id.trim();
  if (!name || name.startsWith("cat_")) return [];

  return [
    {
      id: primary.id || name,
      slug: (primary.slug || name.toLowerCase().replace(/\s+/g, "-")) as ServiceCategorySlug,
      name,
      shortName: name,
      tagline: "",
      description: "",
      longDescription: "",
      commonServices: [],
      benefits: [],
      seoTitle: name,
      seoDescription: "",
      icon: "",
    },
  ];
}

function serviceUnit(unit: string): PortalFixedService["unit"] {
  const normalized = unit.trim().toLowerCase();
  if (normalized === "hour" || normalized === "hours") return "hour";
  if (normalized === "visit" || normalized === "visits") return "visit";
  return "job";
}

function activeServicesToPortal(
  services: PublicProfessionalActiveService[] | undefined,
): LivePortalFixedService[] {
  if (!services?.length) return [];
  return services.map((service) => ({
    id: service.id,
    name: service.servicesName || "Fixed service",
    categoryId: service.category?.id || "",
    categoryName: service.category?.name || "Service",
    description: service.commonServices.slice(0, 2).join(" · ") || "",
    price: service.price,
    unit: serviceUnit(service.unit),
    active: true,
    images: service.images,
    coverage: service.commonServices.length
      ? service.commonServices
      : service.workingArea,
    areaZips: service.workingArea,
    availabilityMode: "office",
    customHours: [],
    liveCategorySlug:
      service.category?.slug ||
      getServiceCategoryById(service.category?.id || "")?.slug,
    liveSlug: service.slug || undefined,
  }));
}

function portfolioToPhotos(
  projects: PortfolioProject[],
  companyName: string,
): { src: string; alt: string }[] {
  const photos: { src: string; alt: string }[] = [];
  for (const project of projects) {
    for (const media of project.media) {
      if (media.type !== "image" || !media.url) continue;
      photos.push({
        src: media.url,
        alt: media.caption || project.title || `${companyName} project`,
      });
      if (photos.length >= 12) return photos;
    }
  }
  return photos;
}

function logoInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "PR";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}

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
  const zones = Array.isArray(record.operatingZones) ? record.operatingZones : [];
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
    serviceLabels: categories
      .map((item) => {
        const row = asRecord(item);
        return typeof row?.name === "string" ? row.name : "";
      })
      .filter(Boolean)
      .slice(0, 2),
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

function mergeProviders(primary: Provider[], extra: Provider[]): Provider[] {
  const seen = new Set(primary.map((item) => item.id));
  const merged = [...primary];
  for (const item of extra) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    merged.push(item);
  }
  return merged;
}

function areaLabelsFromProfessional(professional: PublicProfessional): string[] {
  const fromCoverage = (professional.coverage?.neighborhoods ?? [])
    .map((item) => item.title.trim() || item.city.trim())
    .filter(Boolean);
  if (fromCoverage.length) return [...new Set(fromCoverage)];

  const fromCities = professional.location.operatingCities
    .map((item) => item.trim())
    .filter(Boolean);
  if (fromCities.length) return [...new Set(fromCities)];

  return getServiceAreaNames(professional.location.coveredZipCodes);
}

function extractPortfolioProjects(response: unknown): PortfolioProject[] {
  const root = asRecord(response) ?? {};
  const nested = asRecord(root.data);
  const rawList: unknown[] =
    (Array.isArray(root.data) && root.data) ||
    (nested && Array.isArray(nested.data) && nested.data) ||
    (Array.isArray(root.projects) && root.projects) ||
    [];

  return rawList
    .map(normalizePortfolioProject)
    .filter((item): item is PortfolioProject => Boolean(item));
}

function stashRelatedProfessional(related: Provider): PublicProfessional {
  return {
    id: related.id,
    userId: "",
    fullName: "",
    companyName: related.companyName,
    slug: related.slug,
    tagline: related.tagline,
    avatarUrl: related.logoUrl || "",
    verificationBadge: {
      isVerified: false,
      status: "",
      licensed: related.licensed,
      insured: related.insured,
    },
    tradeDetails: {
      primaryCategory: related.categoryIds[0]
        ? {
            id: related.categoryIds[0],
            name: related.serviceLabels?.[0] || "",
            slug: "",
          }
        : null,
      categoryIds: related.categoryIds,
      tradeTitle: related.tagline,
      specialties: [],
    },
    performanceMetrics: {
      rating: {
        average: related.rating,
        totalReviews: related.reviewCount,
      },
      completedJobs: 0,
    },
    location: {
      city: related.city,
      state: related.state || "",
      country: "",
      zip: related.zip,
      address: related.street,
      coordinates: [related.lng, related.lat],
      operatingCities: [],
      coveredZipCodes: related.serviceArea,
      distanceMiles: null,
    },
    activeOfferings: {
      activeServicesCount: 0,
      startingPrice: related.startingPrice || 0,
      startingPriceDisplay: "",
    },
  };
}

export function PublicProfessionalDetail({
  slug,
  place,
  fallbackProvider,
  fallbackCategories = [],
}: {
  slug: string;
  place?: ExplorePlace;
  fallbackProvider?: Provider | null;
  fallbackCategories?: ServiceCategory[];
}) {
  const dispatch = useAppDispatch();
  const professionalSlug = String(slug || "").trim();
  const professional = useAppSelector((state) =>
    selectPublicProfessionalBySlug(state, professionalSlug),
  );
  const detailSlug = useAppSelector(
    (state) => state.publicProfessionals.detail?.slug ?? null,
  );
  const detailId = useAppSelector(
    (state) => state.publicProfessionals.detail?.id ?? null,
  );
  const detailLoading = useAppSelector(
    (state) => state.publicProfessionals.detailLoading,
  );
  const detailError = useAppSelector(
    (state) => state.publicProfessionals.detailError,
  );

  const [portfolioProjects, setPortfolioProjects] = useState<PortfolioProject[]>(
    [],
  );
  const [portfolioLoading, setPortfolioLoading] = useState(false);
  const [relatedProviders, setRelatedProviders] = useState<Provider[]>([]);
  const [relatedLoading, setRelatedLoading] = useState(false);
  const authUser = useAppSelector(selectAuthUser);
  const trackedRef = useRef<string | null>(null);

  useEffect(() => {
    const targetSlug = professionalSlug || professional?.slug || fallbackProvider?.slug;
    const targetId = professional?.id || fallbackProvider?.id;
    if (!targetSlug && !targetId) return;
    const trackKey = `${targetId || targetSlug}`;
    if (trackedRef.current === trackKey) return;
    trackedRef.current = trackKey;

    const guest = readChatGuest();
    const customerName =
      [authUser?.firstName, authUser?.lastName].filter(Boolean).join(" ") ||
      authUser?.name ||
      guest?.name ||
      "";
    const customerEmail = authUser?.email || guest?.email || "";
    const phone = authUser?.phone || "";

    void trackLeadInteraction({
      providerId: targetId && /^[a-f\d]{24}$/i.test(targetId) ? targetId : undefined,
      providerSlug: targetSlug || undefined,
      source: "profile_view",
      customerName,
      customerEmail,
      phone,
      details: "Customer viewed provider profile on public directory.",
    });
  }, [authUser, fallbackProvider?.id, fallbackProvider?.slug, professional?.id, professional?.slug, professionalSlug]);

  useEffect(() => {
    if (!professionalSlug) return;

    if (professional) {
      const matchesDetail =
        detailSlug === professional.slug || detailId === professional.id;
      if (!matchesDetail) {
        dispatch(setPublicProfessionalDetail(professional));
      }
      if (!hasProfessionalDetailFields(professional)) {
        void dispatch(fetchPublicProfessionalBySlug(professionalSlug));
      }
      return;
    }

    void dispatch(fetchPublicProfessionalBySlug(professionalSlug));
  }, [detailId, detailSlug, dispatch, professional, professionalSlug]);

  const professionalId = professional?.id || "";
  const categoryId = professional?.tradeDetails.primaryCategory?.id || "";

  useEffect(() => {
    if (!professionalSlug) {
      setPortfolioProjects([]);
      setPortfolioLoading(false);
      return;
    }

    let cancelled = false;
    setPortfolioLoading(true);

    async function loadPortfolio() {
      try {
        const response = await getData(
          publicApi.professionalPortfolio(professionalSlug),
          { page: 1, limit: 12 },
          { silent: true },
        );
        if (cancelled) return;
        setPortfolioProjects(extractPortfolioProjects(response));
      } catch {
        if (!cancelled) setPortfolioProjects([]);
      } finally {
        if (!cancelled) setPortfolioLoading(false);
      }
    }

    void loadPortfolio();
    return () => {
      cancelled = true;
    };
  }, [professionalSlug]);

  useEffect(() => {
    if (!professionalId) {
      setRelatedProviders([]);
      setRelatedLoading(false);
      return;
    }

    let cancelled = false;
    setRelatedLoading(true);
    setRelatedProviders([]);

    async function loadRelated() {
      try {
        const relatedRes = await getData(
          publicApi.professionalsRelated,
          { proId: professionalId, limit: RELATED_LIMIT },
          { silent: true },
        );
        if (cancelled) return;

        let providers = extractList(relatedRes)
          .map(providerFromRelatedProfessional)
          .filter((item): item is Provider => Boolean(item))
          .filter((item) => item.id !== professionalId);

        if (providers.length < 4 && categoryId) {
          try {
            const fallbackRes = await getData(
              publicApi.professionals,
              {
                page: 1,
                limit: RELATED_LIMIT,
                category: categoryId,
                sortBy: "rating",
                sortOrder: "desc",
              },
              { silent: true },
            );
            if (!cancelled) {
              const fallback = extractList(fallbackRes)
                .map(normalizePublicProfessional)
                .filter(Boolean)
                .map((item) => publicProfessionalToProvider(item!))
                .filter((item) => item.id !== professionalId);
              providers = mergeProviders(providers, fallback);
            }
          } catch {
            // Keep related-only results.
          }
        }

        if (!cancelled) {
          setRelatedProviders(providers.slice(0, RELATED_LIMIT));
          setRelatedLoading(false);
        }
      } catch {
        if (!cancelled) {
          setRelatedProviders([]);
          setRelatedLoading(false);
        }
      }
    }

    void loadRelated();
    return () => {
      cancelled = true;
    };
  }, [categoryId, professionalId]);

  const provider = useMemo(
    () => (professional ? publicProfessionalToProvider(professional) : (fallbackProvider ?? null)),
    [fallbackProvider, professional],
  );

  const categories = useMemo(() => {
    if (!professional || !provider) return [] as ServiceCategory[];
    return categoriesFromProfessional(
      provider.categoryIds,
      professional.tradeDetails.primaryCategory,
      professional.tradeDetails.tradeTitle || professional.tagline,
    );
  }, [professional, provider]);

  const resolvedCategories = categories.length ? categories : fallbackCategories;

  const livePhotos = useMemo(() => {
    if (!provider) return [];
    const gallery = normalizeBusinessGallery(professional?.businessGallery);
    if (gallery.length) {
      const banner = galleryBanner(gallery);
      const rest = galleryRest(gallery);
      const ordered = banner ? [banner, ...rest] : rest;
      return ordered.map((item) => ({
        src: item.url,
        alt: `${provider.companyName} gallery`,
      }));
    }
    return portfolioToPhotos(portfolioProjects, provider.companyName);
  }, [portfolioProjects, professional?.businessGallery, provider]);

  const liveProjects = useMemo((): ProviderProject[] => {
    if (!provider) return [];
    return portfolioProjects.map((project) => {
      const images = project.media
        .filter((item) => item.type === "image" && item.url)
        .map((item) => item.url);
      const cover =
        project.media.find((item) => item.isCover && item.url)?.url ||
        images[0] ||
        "";
      return {
        slug: project.slug || project.id,
        title: project.title || "Project",
        summary: project.description || "",
        location: provider.city
          ? `${provider.city}${provider.state ? `, ${provider.state}` : ""}`
          : provider.companyName,
        completedOn: project.projectDate || project.createdAt || "",
        categoryName: project.categoryName || "Project",
        cover,
        images,
        details: project.description ? [project.description] : [],
      };
    });
  }, [portfolioProjects, provider]);

  useEffect(() => {
    if (!professionalSlug || !portfolioProjects.length) return;
    dispatch(
      setPublicPortfolioProjects({
        providerSlug: professionalSlug,
        projects: portfolioProjects,
      }),
    );
  }, [dispatch, portfolioProjects, professionalSlug]);

  const liveFixedServices = useMemo(
    () => activeServicesToPortal(professional?.activeServices),
    [professional?.activeServices],
  );

  const areaLabels = useMemo(
    () => (professional ? areaLabelsFromProfessional(professional) : []),
    [professional],
  );

  if (provider) {
    return (
      <ProviderProfile
        provider={provider}
        categories={resolvedCategories}
        place={place}
        live={
          professional
            ? {
                photos: livePhotos,
                projects: liveProjects,
                relatedProviders,
                fixedServices: liveFixedServices,
                areaLabels,
                portfolioLoading,
                relatedLoading,
                onProjectBeforeNavigate: () => {
                  dispatch(
                    setPublicPortfolioProjects({
                      providerSlug: provider.slug,
                      projects: portfolioProjects,
                    }),
                  );
                },
                onRelatedBeforeNavigate: (related) => {
                  if (related.slug) {
                    dispatch(setPublicProfessionalDetail(stashRelatedProfessional(related)));
                  }
                },
              }
            : undefined
        }
      />
    );
  }

  if (detailLoading || !detailError) {
    return (
      <Container className="py-16">
        <ProfessionalDetailSkeleton />
      </Container>
    );
  }

  return (
    <Container className="flex min-h-[50vh] flex-col items-center justify-center py-16 text-center">
      <p className="max-w-md text-base text-muted-foreground">
        This professional profile is not available right now.
      </p>
    </Container>
  );
}
