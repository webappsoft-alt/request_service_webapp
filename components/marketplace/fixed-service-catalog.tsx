"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Check } from "lucide-react";
import { BookServiceButton } from "@/components/marketplace/book-service-panel";
import { FixedServiceOrderDialog } from "@/components/marketplace/fixed-service-order-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { readPublicFixedServices } from "@/lib/booking/public-services";
import { serviceUnitLabel, type PortalFixedService } from "@/lib/data/portal";
import { formatStartingPrice } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Provider } from "@/lib/types";
import { useAppDispatch } from "@/store/hooks";
import {
  publicFixedServicePath,
  setPublicFixedServiceDetail,
  type PublicFixedService,
} from "@/store/publicFixedServicesSlice";

type LivePortalFixedService = PortalFixedService & {
  liveCategorySlug?: string;
  liveSlug?: string;
};

function toPublicFixedService(
  provider: Provider,
  service: LivePortalFixedService,
): PublicFixedService {
  const categorySlug = service.liveCategorySlug?.trim() || "";
  const serviceSlug = service.liveSlug?.trim() || service.id;

  return {
    id: service.id,
    servicesName: service.name,
    slug: serviceSlug,
    category: service.categoryId || service.categoryName
      ? {
          id: service.categoryId || service.categoryName,
          name: service.categoryName || "Service",
          slug: categorySlug,
        }
      : null,
    subcategory: null,
    price: service.price,
    unit: service.unit,
    images: service.images,
    covered: service.coverage,
    commonServices: service.coverage,
    workingArea: service.areaZips,
    availabilityType: service.availabilityMode || "office",
    provider: {
      id: provider.id,
      companyName: provider.companyName,
      slug: provider.slug,
      tagline: provider.tagline,
      avatarUrl: provider.logoUrl,
      coverImage: provider.coverImage,
      rating: {
        average: provider.rating,
        totalReviews: provider.reviewCount,
      },
      location: {
        city: provider.city,
        state: provider.state,
        country: "",
        zip: provider.zip,
        address: provider.street,
        coordinates: [provider.lng, provider.lat],
      },
      profile: {
        yearsInBusiness: provider.yearsInBusiness,
        licensed: provider.licensed,
        insured: provider.insured,
      },
    },
    distanceMiles: null,
  };
}

function liveServiceDetailHref(
  provider: Provider,
  service: LivePortalFixedService,
) {
  const categorySlug = service.liveCategorySlug?.trim();
  const serviceSlug = service.liveSlug?.trim();
  if (categorySlug && serviceSlug) {
    return publicFixedServicePath(
      toPublicFixedService(provider, service),
    );
  }
  return null;
}

export function FixedServiceCatalog({
  provider,
  services: servicesProp,
}: {
  provider: Provider;
  /** When provided (including `[]`), use live API data instead of portal/localStorage. */
  services?: PortalFixedService[];
}) {
  const dispatch = useAppDispatch();
  const [services, setServices] = useState<PortalFixedService[]>(() =>
    servicesProp ?? readPublicFixedServices(provider),
  );
  const [bookingService, setBookingService] = useState<PublicFixedService | null>(
    null,
  );

  useEffect(() => {
    if (servicesProp !== undefined) {
      setServices(servicesProp);
      return;
    }
    setServices(readPublicFixedServices(provider));
  }, [provider, servicesProp]);

  const isLive = servicesProp !== undefined;

  if (!services.length && !isLive) return null;

  return (
    <section className="flex flex-col gap-4">
      <div>
        <p className="eyebrow text-muted-foreground">Fixed services</p>
        <h2 className="mt-1 text-2xl font-semibold">Book a priced service</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          {isLive
            ? "These live services come from this provider's public catalog. Booking one opens the real checkout flow instead of the estimate pipeline."
            : `These jobs already have a price and scope. Booking one opens work immediately - no estimate, no back-and-forth. Pick a time and ${provider.companyName} starts the job.`}
        </p>
      </div>
      {services.length ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          {services.map((service) => {
            const liveService = service as LivePortalFixedService;
            const photo = service.images[0];
            const bullets = service.coverage;
            const detailHref = isLive
              ? liveServiceDetailHref(provider, liveService)
              : null;
            const publicService = isLive
              ? toPublicFixedService(provider, liveService)
              : null;

            return (
              <article
                key={service.id}
                className={cn(
                  "relative flex flex-col overflow-hidden rounded-xl border border-black/10 bg-card",
                  detailHref &&
                    "transition-all duration-300 ease-out hover:-translate-y-0.5 hover:border-black/20 hover:elevate",
                )}
              >
                {detailHref ? (
                  <Link
                    href={detailHref}
                    aria-label={`View ${service.name} details`}
                    className="absolute inset-0 z-0"
                    onClick={() => {
                      if (publicService) {
                        dispatch(setPublicFixedServiceDetail(publicService));
                      }
                    }}
                  />
                ) : null}
                <div className="relative aspect-[2/1] bg-[#003F7D]">
                  {photo ? (
                    <Image
                      src={photo}
                      alt={service.name}
                      fill
                      sizes="(min-width: 1024px) 18vw, 45vw"
                      className="object-cover"
                    />
                  ) : null}
                  {service.categoryName ? (
                    <Badge className="absolute top-2 left-2 border-0 bg-white/95 text-[#003F7D]">
                      {service.categoryName}
                    </Badge>
                  ) : null}
                </div>
                <div className="relative z-10 flex flex-1 flex-col gap-2 p-3 pointer-events-none">
                  <div>
                    <h3 className="line-clamp-2 text-sm font-semibold tracking-tight">
                      {service.name}
                    </h3>
                    <p className="mt-0.5 line-clamp-2 text-xs leading-5 text-muted-foreground">
                      {service.description || `${provider.companyName} offers this as a priced public service.`}
                    </p>
                  </div>
                  <p className="text-sm font-semibold text-[#003F7D]">
                    {formatStartingPrice(service.price)}{" "}
                    <span className="text-xs font-normal text-muted-foreground">
                      {serviceUnitLabel(service.unit)}
                    </span>
                  </p>
                  {bullets.length ? (
                    <ul className="flex flex-col gap-1">
                      {bullets.slice(0, 2).map((item) => (
                        <li key={item} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                          <Check className="mt-0.5 size-3 shrink-0 text-[#003F7D]" aria-hidden="true" />
                          <span className="line-clamp-1">{item}</span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {isLive ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="pointer-events-auto mt-auto w-full"
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        if (publicService) setBookingService(publicService);
                      }}
                    >
                      Book this service
                    </Button>
                  ) : (
                    <div className="pointer-events-auto mt-auto">
                      <BookServiceButton
                        serviceId={service.id}
                        label="Book this service"
                        size="sm"
                        className="w-full"
                      />
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <p className="rounded-xl border border-dashed border-black/15 bg-card px-4 py-8 text-sm text-muted-foreground">
          Fixed services will appear here when this company publishes priced jobs.
        </p>
      )}

      {bookingService ? (
        <FixedServiceOrderDialog
          open
          onOpenChange={(next) => {
            if (!next) setBookingService(null);
          }}
          service={bookingService}
        />
      ) : null}
    </section>
  );
}
