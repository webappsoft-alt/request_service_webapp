"use client";

import Image from "next/image";
import Link from "next/link";
import { useHomeCategoryFilter } from "@/components/home/home-category-filter";
import { Container, Section } from "@/components/layout/container";
import { CardCarousel, CardCarouselItem } from "@/components/shared/card-carousel";
import { getAllJobs, getJobPath } from "@/lib/data/jobs";
import { getJobImage } from "@/lib/data/provider-media";
import { getServiceCategoryBySlug } from "@/lib/data/services";

const allJobs = getAllJobs();

export function ServicesSection() {
  const { selectedSlug } = useHomeCategoryFilter();
  const selectedCategory = selectedSlug ? getServiceCategoryBySlug(selectedSlug) : undefined;
  const jobs = selectedSlug
    ? allJobs.filter((item) => item.category.slug === selectedSlug)
    : allJobs;

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
          countLabel={`${jobs.length} ${jobs.length === 1 ? "service" : "services"}`}
          seeAllHref={selectedCategory ? `/services/${selectedCategory.slug}` : "/services"}
          seeAllLabel={selectedCategory ? `See all ${selectedCategory.shortName}` : "See all services"}
          ariaLabel={selectedCategory ? `${selectedCategory.name} services` : "Browse services"}
        >
          {jobs.map((item) => {
            const image = getJobImage(item.category.id, item.job, item.index);
            return (
              <CardCarouselItem
                key={`${item.category.slug}-${item.slug}`}
                className="w-[min(9rem,40vw)] shrink-0 snap-start sm:w-40 md:w-40 lg:w-40"
              >
                <Link
                  href={getJobPath(item.category.slug, item.job)}
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
                  <span className="flex flex-col">
                    <span className="text-sm font-semibold leading-5">{item.job}</span>
                    <span className="text-xs leading-4 text-muted-foreground">
                      {item.category.shortName}
                    </span>
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
