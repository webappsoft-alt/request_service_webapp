"use client";

import { useEffect, useMemo } from "react";
import { ProviderProfile } from "@/components/marketplace/provider-profile";
import { Container } from "@/components/layout/container";
import { CenteredSpinner } from "@/components/ui/spinner";
import type { ExplorePlace } from "@/lib/data/profile-explore";
import { getServiceCategoryById, getServiceCategoryBySlug } from "@/lib/data/services";
import type { Provider, ServiceCategory, ServiceCategorySlug } from "@/lib/types";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  fetchPublicProfessionalBySlug,
  publicProfessionalToProvider,
} from "@/store/publicProfessionalsSlice";

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
    // API sometimes sends "cat_plumbing" while catalog slug is "plumbing".
    if (candidate.startsWith("cat_")) {
      const stripped = candidate.slice(4).replace(/_/g, "-");
      const strippedCat = getServiceCategoryBySlug(stripped) || getServiceCategoryById(`cat_${stripped.replace(/-/g, "_")}`);
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
  const detailProfessional = useAppSelector((state) =>
    state.publicProfessionals.detail?.slug === professionalSlug
      ? state.publicProfessionals.detail
      : null,
  );
  const listedProfessional = useAppSelector((state) =>
    state.publicProfessionals.items.find((item) => item.slug === professionalSlug) ?? null,
  );
  const detailLoading = useAppSelector(
    (state) => state.publicProfessionals.detailLoading,
  );
  const detailError = useAppSelector(
    (state) => state.publicProfessionals.detailError,
  );

  useEffect(() => {
    if (!professionalSlug) return;
    if (detailProfessional?.slug === professionalSlug) {
      return;
    }
    void dispatch(fetchPublicProfessionalBySlug(professionalSlug));
  }, [detailProfessional?.slug, dispatch, professionalSlug]);

  const professional = detailProfessional ?? listedProfessional;

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

  const liveFixedServices = useMemo(
    () => professional?.activeServices ?? [],
    [professional],
  );

  const resolvedCategories = categories.length ? categories : fallbackCategories;

  if (provider) {
    return (
      <ProviderProfile
        provider={provider}
        categories={resolvedCategories}
        place={place}
        liveFixedServices={liveFixedServices}
      />
    );
  }

  if (detailLoading || !detailError) {
    return (
      <Container className="py-16">
        <CenteredSpinner label="Loading professional profile" />
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
