"use client";

import { useEffect, useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import { useHomeCategoryFilter } from "@/components/home/home-category-filter";
import { Container, Section } from "@/components/layout/container";
import { CardCarousel, CardCarouselItem } from "@/components/shared/card-carousel";
import { CategoryTileSkeleton } from "@/components/shared/loading-skeletons";
import { Skeleton } from "@/components/ui/skeleton";
import { resolveCategoryDisplayImage, assignCategoryDisplayImages } from "@/lib/data/category-images";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  fetchParentCategories,
  fetchSubcategories,
  selectParentCategories,
  selectSubcategoriesForParent,
  type PublicCategory,
} from "@/store/categoriesSlice";

const CATEGORY_SKELETON_COUNT = 8;

function servicesDirectoryHref(serviceKey: string, jobKey?: string) {
  const params = new URLSearchParams();
  if (serviceKey) params.set("service", serviceKey);
  if (jobKey) params.set("job", jobKey);
  const query = params.toString();
  return query ? `/services?${query}` : "/services";
}

function CategoryCard({
  item,
  href,
  image,
}: {
  item: PublicCategory;
  href: string;
  image: string;
}) {
  return (
    <Link
      href={href}
      className="group flex flex-col items-center gap-1.5 text-center focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
    >
      <span className="relative aspect-square w-full overflow-hidden rounded-xl bg-muted">
        {image ? (
          <Image
            src={image}
            alt=""
            fill
            sizes="(min-width: 1024px) 13vw, 40vw"
            className="object-cover transition-transform duration-500 group-hover:scale-[1.04]"
            unoptimized={image.startsWith("http")}
          />
        ) : (
          <Skeleton className="absolute inset-0 rounded-xl" />
        )}
      </span>
      <span className="text-sm font-semibold leading-5">{item.name}</span>
    </Link>
  );
}

export function ServicesSection() {
  const dispatch = useAppDispatch();
  const { selected, setSelected } = useHomeCategoryFilter();
  const parents = useAppSelector(selectParentCategories);
  const parentsLoaded = useAppSelector((state) => state.categories.parentsLoaded);
  const loadingParents = useAppSelector((state) => state.categories.loadingParents);
  const parentsHasMore = useAppSelector((state) => state.categories.parentsHasMore);
  const loadingMoreParents = useAppSelector(
    (state) => state.categories.loadingMoreParents,
  );
  const loadingSubcategories = useAppSelector(
    (state) => state.categories.loadingSubcategories,
  );
  const loadingMoreSubcategories = useAppSelector(
    (state) => state.categories.loadingMoreSubcategories,
  );
  const subMetaByParent = useAppSelector(
    (state) => state.categories.subMetaByParent,
  );

  const selectedParent = useMemo(() => {
    if (!selected) return null;
    return (
      parents.find(
        (item) =>
          item.id === selected.id ||
          (!!selected.slug && item.slug === selected.slug),
      ) ?? null
    );
  }, [parents, selected]);

  const parentId = selectedParent?.id ?? (selected?.id || "");
  const subcategories = useAppSelector((state) =>
    parentId ? selectSubcategoriesForParent(state, parentId) : [],
  );
  const subMeta = parentId ? subMetaByParent[parentId] : undefined;

  useEffect(() => {
    void dispatch(fetchParentCategories());
  }, [dispatch]);

  useEffect(() => {
    if (!parentsLoaded || !parentsHasMore || loadingParents || loadingMoreParents) {
      return;
    }
    void dispatch(fetchParentCategories({ append: true }));
  }, [
    dispatch,
    loadingMoreParents,
    loadingParents,
    parentsHasMore,
    parentsLoaded,
  ]);

  // Resolve slug-only selection once parents load (legacy setSelectedSlug callers).
  useEffect(() => {
    if (!selected?.slug || selected.id) return;
    const match = parents.find((item) => item.slug === selected.slug);
    if (!match) return;
    setSelected({
      id: match.id,
      slug: match.slug || match.id,
      name: match.name,
    });
  }, [parents, selected, setSelected]);

  useEffect(() => {
    if (!parentId) return;
    void dispatch(fetchSubcategories({ parentId }));
  }, [dispatch, parentId]);

  useEffect(() => {
    if (!parentId || !subMeta?.hasMore) return;
    if (loadingSubcategories || loadingMoreSubcategories) return;
    void dispatch(fetchSubcategories({ parentId, append: true }));
  }, [
    dispatch,
    loadingMoreSubcategories,
    loadingSubcategories,
    parentId,
    subMeta?.hasMore,
    subMeta?.page,
  ]);

  const showingSubs = Boolean(selectedParent || (selected?.id && parentId));
  const cards = showingSubs ? subcategories : parents;
  const cardImages = useMemo(() => {
    if (!showingSubs) {
      return cards.map((item) =>
        resolveCategoryDisplayImage({
          id: item.id,
          name: item.name,
          slug: item.slug,
          images: item.images,
          isSubcategory: false,
        }),
      );
    }
    return assignCategoryDisplayImages(
      cards.map((item) => ({
        id: item.id,
        name: item.name,
        slug: item.slug,
        images: item.images,
      })),
      selectedParent
        ? {
            id: selectedParent.id,
            name: selectedParent.name,
            slug: selectedParent.slug,
            images: selectedParent.images,
          }
        : null,
    );
  }, [cards, selectedParent, showingSubs]);
  const showSkeleton =
    !cards.length &&
    (showingSubs
      ? loadingSubcategories || (Boolean(parentId) && !subMeta)
      : loadingParents || !parentsLoaded);

  const eyebrow = selectedParent?.name ?? selected?.name ?? "Services";
  const heading = selectedParent
    ? `${selectedParent.name} services`
    : selected?.name
      ? `${selected.name} services`
      : "Browse services";
  const description = selectedParent
    ? `Pick a ${selectedParent.name.toLowerCase()} job to see local companies and typical starting prices.`
    : "Pick a category above, or browse every main service we list. Select a category to see its sub-services.";
  const seeAllHref = selectedParent
    ? servicesDirectoryHref(selectedParent.slug || selectedParent.id)
    : "/services";
  const seeAllLabel = selectedParent
    ? `See all ${selectedParent.name}`
    : "See all services";
  const count = cards.length;

  return (
    <Section id="browse-by-job" density="tight" className="scroll-mt-52">
      <Container className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <p className="eyebrow text-muted-foreground">{eyebrow}</p>
          <h2 className="text-3xl font-semibold md:text-[2.5rem]">{heading}</h2>
          <p className="text-sm text-muted-foreground md:text-base">{description}</p>
        </div>

        <CardCarousel
          key={selectedParent?.id ?? selected?.slug ?? "all"}
          countLabel={`${count} ${count === 1 ? "service" : "services"}`}
          seeAllHref={seeAllHref}
          seeAllLabel={seeAllLabel}
          ariaLabel={heading}
        >
          {showSkeleton
            ? Array.from({ length: CATEGORY_SKELETON_COUNT }, (_, index) => (
                <CardCarouselItem
                  key={`category-skeleton-${index}`}
                  className="w-[min(9rem,40vw)] shrink-0 snap-start sm:w-40 md:w-40 lg:w-40"
                >
                  <CategoryTileSkeleton />
                </CardCarouselItem>
              ))
            : cards.map((item, index) => {
                const parentKey =
                  selectedParent?.slug ||
                  selectedParent?.id ||
                  item.slug ||
                  item.id;
                const href = showingSubs
                  ? servicesDirectoryHref(parentKey, item.slug || item.id)
                  : servicesDirectoryHref(item.slug || item.id);

                return (
                  <CardCarouselItem
                    key={item.id}
                    className="w-[min(9rem,40vw)] shrink-0 snap-start sm:w-40 md:w-40 lg:w-40"
                  >
                    <CategoryCard
                      item={item}
                      href={href}
                      image={cardImages[index] || ""}
                    />
                  </CardCarouselItem>
                );
              })}
        </CardCarousel>

        {!showSkeleton && !cards.length ? (
          <p className="text-sm text-muted-foreground">
            {showingSubs
              ? "No sub-services in this category yet. Try another category, or browse all services."
              : "No services are published yet. Check back soon."}
          </p>
        ) : null}
      </Container>
    </Section>
  );
}
