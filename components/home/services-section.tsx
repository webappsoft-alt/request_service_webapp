"use client";

import { useEffect, useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import { useHomeCategoryFilter } from "@/components/home/home-category-filter";
import { Container, Section } from "@/components/layout/container";
import { CardCarousel, CardCarouselItem } from "@/components/shared/card-carousel";
import { Skeleton } from "@/components/ui/skeleton";
import { getServiceCategoryBySlug } from "@/lib/data/services";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  fetchParentCategories,
  selectParentCategories,
} from "@/store/categoriesSlice";

const LANDING_CATEGORIES_LIMIT = 10;
const CATEGORY_SKELETON_COUNT = 8;

function categoryImage(slug: string, name: string, index: number): string | undefined {
  const staticCat = getServiceCategoryBySlug(slug);
  if (staticCat?.image) return staticCat.image;
  const byName = getServiceCategoryBySlug(
    name.toLowerCase().replace(/\s+/g, "-"),
  );
  if (byName?.image) return byName.image;
  const fallbacks = [
    "/images/services/service-plumbing.jpg",
    "/images/services/service-hvac.jpg",
    "/images/services/service-electrical.jpg",
    "/images/services/service-handyman.jpg",
    "/images/services/service-cleaning.jpg",
    "/images/services/service-roofing.jpg",
    "/images/services/service-landscaping.jpg",
    "/images/services/service-painting.jpg",
    "/images/services/service-bathroom.jpg",
    "/images/services/service-pest.jpg",
  ];
  return fallbacks[index % fallbacks.length];
}

function servicesDirectoryHref(serviceKey: string) {
  const params = new URLSearchParams();
  if (serviceKey) params.set("service", serviceKey);
  const query = params.toString();
  return query ? `/services?${query}` : "/services";
}

function CategoryCardSkeleton() {
  return (
    <div
      className="flex flex-col items-center gap-1.5 text-center"
      aria-hidden="true"
    >
      <Skeleton className="aspect-square w-full rounded-xl" />
      <Skeleton className="h-4 w-3/4 max-w-28" />
    </div>
  );
}

export function ServicesSection() {
  const dispatch = useAppDispatch();
  const { selectedSlug } = useHomeCategoryFilter();
  const parents = useAppSelector(selectParentCategories);
  const parentsLoaded = useAppSelector((state) => state.categories.parentsLoaded);
  const loadingParents = useAppSelector((state) => state.categories.loadingParents);

  useEffect(() => {
    void dispatch(fetchParentCategories());
  }, [dispatch]);

  const selectedCategory = selectedSlug
    ? getServiceCategoryBySlug(selectedSlug)
    : undefined;

  const categories = useMemo(() => {
    const list = selectedSlug
      ? parents.filter(
          (item) =>
            item.slug === selectedSlug ||
            item.slug === selectedCategory?.slug ||
            item.name.toLowerCase() === selectedCategory?.name.toLowerCase(),
        )
      : parents;
    return list.slice(0, LANDING_CATEGORIES_LIMIT);
  }, [parents, selectedCategory?.name, selectedCategory?.slug, selectedSlug]);

  const showSkeleton = !categories.length && (loadingParents || !parentsLoaded);
  const count = categories.length;

  return (
    <Section id="browse-by-job" density="tight" className="scroll-mt-52">
      <Container className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <p className="eyebrow text-muted-foreground">
            {selectedCategory ? selectedCategory.shortName : "Services"}
          </p>
          <h2 className="text-3xl font-semibold md:text-[2.5rem]">
            {selectedCategory ? `${selectedCategory.name} services` : "Browse services"}
          </h2>
          <p className="text-sm text-muted-foreground md:text-base">
            {selectedCategory
              ? `Pick a ${selectedCategory.shortName.toLowerCase()} service to see typical starting prices and local companies.`
              : "Pick a category above, or browse every service we list. Each card is a specific service with a typical starting price."}
          </p>
        </div>

        <CardCarousel
          key={selectedSlug ?? "all"}
          countLabel={`${count} ${count === 1 ? "service" : "services"}`}
          seeAllHref={
            selectedCategory
              ? servicesDirectoryHref(selectedCategory.slug)
              : "/services"
          }
          seeAllLabel={
            selectedCategory
              ? `See all ${selectedCategory.shortName}`
              : "See all services"
          }
          ariaLabel={selectedCategory ? `${selectedCategory.name} services` : "Browse services"}
        >
          {showSkeleton
            ? Array.from({ length: CATEGORY_SKELETON_COUNT }, (_, index) => (
                <CardCarouselItem
                  key={`category-skeleton-${index}`}
                  className="w-[min(9rem,40vw)] shrink-0 snap-start sm:w-40 md:w-40 lg:w-40"
                >
                  <CategoryCardSkeleton />
                </CardCarouselItem>
              ))
            : categories.map((item, index) => {
                const image = categoryImage(item.slug, item.name, index);
                const serviceKey = item.slug || item.id;

                return (
                  <CardCarouselItem
                    key={item.id}
                    className="w-[min(9rem,40vw)] shrink-0 snap-start sm:w-40 md:w-40 lg:w-40"
                  >
                    <Link
                      href={servicesDirectoryHref(serviceKey)}
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
                          />
                        ) : null}
                      </span>
                      <span className="text-sm font-semibold leading-5">
                        {item.name}
                      </span>
                    </Link>
                  </CardCarouselItem>
                );
              })}
        </CardCarousel>
      </Container>
    </Section>
  );
}
