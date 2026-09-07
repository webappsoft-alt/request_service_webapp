import { CardCarousel, CardCarouselItem } from "@/components/shared/card-carousel";
import { ServiceCard } from "@/components/shared/service-card";
import type { ServiceCategory } from "@/lib/types";

export function ServiceCarousel({ categories }: { categories: ServiceCategory[] }) {
  return (
    <CardCarousel
      countLabel={`${categories.length} categories`}
      seeAllHref="/services"
      ariaLabel="Service categories"
    >
      {categories.map((category) => (
        <CardCarouselItem key={category.id}>
          <ServiceCard category={category} />
        </CardCarouselItem>
      ))}
    </CardCarousel>
  );
}
