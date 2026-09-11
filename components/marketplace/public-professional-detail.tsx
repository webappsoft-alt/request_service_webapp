"use client";

import { useEffect, useMemo } from "react";
import { ProviderProfile } from "@/components/marketplace/provider-profile";
import { Container } from "@/components/layout/container";
import { CenteredSpinner } from "@/components/ui/spinner";
import type { ExplorePlace } from "@/lib/data/profile-explore";
import { getServiceCategoryById, getServiceCategoryBySlug } from "@/lib/data/services";
import type { ServiceCategory, ServiceCategorySlug } from "@/lib/types";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  fetchPublicProfessionalBySlug,
  publicProfessionalToProvider,
  selectPublicProfessionalBySlug,
  setPublicProfessionalDetail,
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
}: {
  slug: string;
  place?: ExplorePlace;
}) {
  const dispatch = useAppDispatch();
  const professionalSlug = String(slug || "").trim();
  const professional = useAppSelector((state) =>
    selectPublicProfessionalBySlug(state, professionalSlug),
  );
  const detailSlug = useAppSelector(
    (state) => state.publicProfessionals.detail?.slug ?? null,
  );
  const detailLoading = useAppSelector(
    (state) => state.publicProfessionals.detailLoading,
  );
  const detailError = useAppSelector(
    (state) => state.publicProfessionals.detailError,
  );

  useEffect(() => {
    if (!professionalSlug) return;
    if (professional) {
      if (detailSlug !== professional.slug) {
        dispatch(setPublicProfessionalDetail(professional));
      }
      return;
    }
    void dispatch(fetchPublicProfessionalBySlug(professionalSlug));
  }, [detailSlug, dispatch, professional, professionalSlug]);

  const provider = useMemo(
    () => (professional ? publicProfessionalToProvider(professional) : null),
    [professional],
  );

  const categories = useMemo(() => {
    if (!professional || !provider) return [] as ServiceCategory[];
    return categoriesFromProfessional(
      provider.categoryIds,
      professional.tradeDetails.primaryCategory,
      professional.tradeDetails.tradeTitle || professional.tagline,
    );
  }, [professional, provider]);

  if (provider && professional) {
    return (
      <ProviderProfile
        provider={provider}
        categories={categories}
        place={place}
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
