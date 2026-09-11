"use client";

import { useEffect, useMemo } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Container, Section } from "@/components/layout/container";
import { ProviderCard } from "@/components/shared/provider-card";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
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
const PROVIDER_SKELETON_COUNT = 4;

function ProviderCardSkeleton() {
  return (
    <Card
      className="h-full gap-0 overflow-hidden border-black/15 pt-0 pb-2"
      aria-hidden="true"
    >
      <div className="relative aspect-4/3 overflow-hidden bg-muted">
        <Skeleton className="absolute inset-0 rounded-none" />
        <Skeleton className="absolute top-2 left-2 z-10 h-6 w-16 rounded-md" />
        <Skeleton className="absolute top-2 right-2 z-10 size-7 rounded-full" />
        <Skeleton className="absolute bottom-2.5 left-2.5 z-10 size-9 rounded-md" />
      </div>
      <div className="flex flex-col gap-3 px-3 pt-3 pb-3 sm:px-4">
        <div className="flex items-start justify-between gap-2">
          <Skeleton className="h-4 w-[55%]" />
          <Skeleton className="h-4 w-12" />
        </div>
        <Skeleton className="h-3.5 w-4/5" />
        <Skeleton className="h-3.5 w-2/5" />
        <Skeleton className="h-5 w-20 rounded-full" />
        <div className="mt-auto flex w-full flex-col gap-2 sm:flex-row">
          <Skeleton className="h-8 w-full rounded-md sm:flex-1" />
          <Skeleton className="h-8 w-full rounded-md sm:flex-1" />
        </div>
      </div>
    </Card>
  );
}

export function FeaturedProvidersSection() {
  const dispatch = useAppDispatch();
  const customerLocation = useAppSelector((state) => state.location);
  const items = useAppSelector((state) => state.publicProfessionals.items);
  const loading = useAppSelector((state) => state.publicProfessionals.loading);
  const loaded = useAppSelector((state) => state.publicProfessionals.loaded);

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

  const showSkeleton =
    !providers.length &&
    (customerLocation.detecting ||
      !customerLocation.detectAttempted ||
      loading ||
      (locationCommitted && !loaded));

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
        <div
          data-stagger
          className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4"
          aria-busy={showSkeleton || undefined}
        >
          {showSkeleton
            ? Array.from({ length: PROVIDER_SKELETON_COUNT }, (_, index) => (
                <ProviderCardSkeleton key={`provider-skeleton-${index}`} />
              ))
            : providers.map((provider, index) => (
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
