"use client";

import { useEffect, useMemo } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Container, Section } from "@/components/layout/container";
import { ProviderCard } from "@/components/shared/provider-card";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  detectCurrentLocation,
  hasLocation,
  isCommittedLocation,
} from "@/store/locationSlice";
import {
  fetchPublicProfessionals,
  publicProfessionalToProvider,
} from "@/store/publicProfessionalsSlice";

const LANDING_PROVIDERS_LIMIT = 10;

export function FeaturedProvidersSection() {
  const dispatch = useAppDispatch();
  const customerLocation = useAppSelector((state) => state.location);
  const items = useAppSelector((state) => state.publicProfessionals.items);

  const locationReady =
    customerLocation.detectAttempted && !customerLocation.detecting;
  const locationCommitted = isCommittedLocation(customerLocation);

  useEffect(() => {
    if (customerLocation.detectAttempted || customerLocation.detecting) return;
    if (hasLocation(customerLocation)) return;
    void dispatch(detectCurrentLocation());
  }, [
    customerLocation.address,
    customerLocation.city,
    customerLocation.detectAttempted,
    customerLocation.detecting,
    customerLocation.latitude,
    customerLocation.longitude,
    customerLocation.zip,
    dispatch,
  ]);

  useEffect(() => {
    if (!locationReady || !locationCommitted) return;
    void dispatch(
      fetchPublicProfessionals({
        query: {
          sortBy: "rating",
          sortOrder: "desc",
        },
      }),
    );
  }, [dispatch, locationCommitted, locationReady]);

  const providers = useMemo(
    () =>
      items
        .slice(0, LANDING_PROVIDERS_LIMIT)
        .map(publicProfessionalToProvider),
    [items],
  );

  return (
    <Section tone="muted" density="tight">
      <Container className="flex flex-col gap-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-col gap-2">
            <p className="eyebrow text-muted-foreground">Featured providers</p>
            <h2 className="text-3xl font-semibold md:text-[2.5rem]">
              Pros you can compare on more than stars
            </h2>
          </div>
          <Link
            href="/find-a-professional"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-brand transition-colors hover:text-foreground"
          >
            See all professionals
            <ArrowRight className="size-3.5" aria-hidden="true" />
          </Link>
        </div>
        <div data-stagger className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
          {providers.map((provider, index) => (
            <ProviderCard
              key={provider.id}
              provider={provider}
              visual
              hideCredentials={index === 1 || index === 2}
            />
          ))}
        </div>
      </Container>
    </Section>
  );
}
