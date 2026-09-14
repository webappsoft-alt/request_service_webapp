"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import Image from "next/image";
import { Check } from "lucide-react";
import { BookServiceButton } from "@/components/marketplace/book-service-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { readPublicFixedServices } from "@/lib/booking/public-services";
import { serviceUnitLabel, type PortalFixedService } from "@/lib/data/portal";
import { formatStartingPrice } from "@/lib/format";
import type { Provider } from "@/lib/types";

const OBJECT_ID_REGEX = /^[a-f\d]{24}$/i;

function liveServicePath(
  provider: Provider,
  service: PortalFixedService,
) {
  const liveService = service as PortalFixedService & {
    liveCategorySlug?: string;
    liveSlug?: string;
  };
  const categorySlug = liveService.liveCategorySlug?.trim();
  const serviceSlug = liveService.liveSlug?.trim();
  if (categorySlug && serviceSlug && OBJECT_ID_REGEX.test(service.id)) {
    return `/services/${categorySlug}/${serviceSlug}?book=1`;
  }
  return `/request-service?provider=${provider.slug}&intent=book&serviceId=${service.id}`;
}

export function FixedServiceCatalog({
  provider,
  services: servicesProp,
}: {
  provider: Provider;
  /** When provided (including `[]`), use live API data instead of portal/localStorage. */
  services?: PortalFixedService[];
}) {
  const [services, setServices] = useState<PortalFixedService[]>(() =>
    servicesProp ?? readPublicFixedServices(provider),
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
        <div className="grid gap-3 sm:grid-cols-2">
          {services.map((service) => {
            const photo = service.images[0];
            const bullets = service.coverage;
            return (
              <article
                key={service.id}
                className="flex flex-col overflow-hidden rounded-xl border border-black/15 bg-card"
              >
                <div className="relative aspect-[16/9] bg-[#003F7D]">
                  {photo ? (
                    <Image
                      src={photo}
                      alt={service.name}
                      fill
                      sizes="(min-width: 1024px) 22vw, 90vw"
                      className="object-cover"
                    />
                  ) : null}
                  {service.categoryName ? (
                    <Badge className="absolute top-3 left-3 border-0 bg-white/95 text-[#003F7D]">
                      {service.categoryName}
                    </Badge>
                  ) : null}
                </div>
                <div className="flex flex-1 flex-col gap-3 p-4">
                  <div>
                    <h3 className="font-semibold tracking-tight">{service.name}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {service.description || `${provider.companyName} offers this as a priced public service.`}
                    </p>
                  </div>
                  <p className="text-lg font-semibold text-[#003F7D]">
                    {formatStartingPrice(service.price)}{" "}
                    <span className="text-sm font-normal text-muted-foreground">
                      {serviceUnitLabel(service.unit)}
                    </span>
                  </p>
                  {bullets.length ? (
                    <ul className="flex flex-col gap-1.5">
                      {bullets.slice(0, 3).map((item) => (
                        <li key={item} className="flex items-start gap-2 text-sm text-muted-foreground">
                          <Check className="mt-0.5 size-3.5 shrink-0 text-[#003F7D]" aria-hidden="true" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {isLive ? (
                    <Button asChild variant="outline" size="xl">
                      <Link href={liveServicePath(provider, service)}>Book this service</Link>
                    </Button>
                  ) : (
                    <BookServiceButton serviceId={service.id} label="Book this service" />
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
    </section>
  );
}
