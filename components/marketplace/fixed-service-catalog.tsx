"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Check } from "lucide-react";
import { BookServiceButton } from "@/components/marketplace/book-service-panel";
import { Badge } from "@/components/ui/badge";
import { readPublicFixedServices } from "@/lib/booking/public-services";
import { serviceUnitLabel, type PortalFixedService } from "@/lib/data/portal";
import { formatStartingPrice } from "@/lib/format";
import type { Provider } from "@/lib/types";

export function FixedServiceCatalog({ provider }: { provider: Provider }) {
  const [services, setServices] = useState<PortalFixedService[]>(() =>
    readPublicFixedServices(provider),
  );

  useEffect(() => {
    setServices(readPublicFixedServices(provider));
  }, [provider]);

  if (!services.length) return null;

  return (
    <section className="flex flex-col gap-4">
      <div>
        <p className="eyebrow text-muted-foreground">Fixed services</p>
        <h2 className="mt-1 text-2xl font-semibold">Book a priced service</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          These jobs already have a price and scope. Booking one opens work immediately — no
          estimate, no back-and-forth. Pick a time and {provider.companyName} starts the job.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {services.map((service) => {
          const photo = service.images[0];
          return (
            <article
              key={service.id}
              className="flex flex-col overflow-hidden rounded-xl border border-black/15 bg-card"
            >
              <div className="relative aspect-[16/9] bg-[#003F7D]">
                {photo ? (
                  <Image src={photo} alt={service.name} fill sizes="(min-width: 1024px) 22vw, 90vw" className="object-cover" />
                ) : null}
                <Badge className="absolute top-3 left-3 border-0 bg-white/95 text-[#003F7D]">
                  {service.categoryName}
                </Badge>
              </div>
              <div className="flex flex-1 flex-col gap-3 p-4">
                <div>
                  <h3 className="font-semibold tracking-tight">{service.name}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{service.description}</p>
                </div>
                <p className="text-lg font-semibold text-[#003F7D]">
                  {formatStartingPrice(service.price)}{" "}
                  <span className="text-sm font-normal text-muted-foreground">
                    {serviceUnitLabel(service.unit)}
                  </span>
                </p>
                {service.coverage.length ? (
                  <ul className="flex flex-col gap-1.5">
                    {service.coverage.slice(0, 3).map((item) => (
                      <li key={item} className="flex items-start gap-2 text-sm text-muted-foreground">
                        <Check className="mt-0.5 size-3.5 shrink-0 text-[#003F7D]" aria-hidden="true" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
                <BookServiceButton serviceId={service.id} label="Book this service" />
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
