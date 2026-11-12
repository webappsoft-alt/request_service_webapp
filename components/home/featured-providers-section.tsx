"use client";

/**
 * Featured Pros marketplace cards for the customer home page:
 * 4 business profiles from the API + "See all professionals".
 */

import { useEffect, useMemo } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Container, Section } from "@/components/layout/container";
import { ProviderCard } from "@/components/shared/provider-card";
import { ProviderCardSkeleton } from "@/components/shared/loading-skeletons";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  detectCurrentLocation,
  LOCATION_WAIT_MS,
  hasLocation,
} from "@/store/locationSlice";
import {
  fetchPublicProfessionals,
  publicProfessionalToProvider,
} from "@/store/publicProfessionalsSlice";

const LANDING_PROVIDERS_LIMIT = 4;
const PROVIDER_SKELETON_COUNT = 4;
/** Two rows of four on desktop. */
const HOMEOWNERS_PROVIDERS_LIMIT = 8;

export function FeaturedProvidersSection({
  variant = "default",
}: {
  variant?: "default" | "homeowners";
}) {
  const isHomeowners = variant === "homeowners";
  const providerLimit = isHomeowners
    ? HOMEOWNERS_PROVIDERS_LIMIT
    : LANDING_PROVIDERS_LIMIT;
  const skeletonCount = isHomeowners
    ? HOMEOWNERS_PROVIDERS_LIMIT
    : PROVIDER_SKELETON_COUNT;
  const dispatch = useAppDispatch();
  const customerLocation = useAppSelector((state) => state.location);
  const items = useAppSelector((state) => state.publicProfessionals.items);
  const loading = useAppSelector((state) => state.publicProfessionals.loading);
  const loaded = useAppSelector((state) => state.publicProfessionals.loaded);

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
    // Performance: don't hold the list on the browser's location prompt (it can wait 8s+,
    // or forever if the visitor ignores it). After a short wait, load all areas; the
    // local list replaces it as soon as the location arrives.
    // Was: if (customerLocation.detecting) return;
    const usable = !customerLocation.detecting && hasLocation(customerLocation);
    const load = () =>
      dispatch(
      fetchPublicProfessionals({
        query: {
          zipCode:
            usable &&
            !(
              customerLocation.latitude != null &&
              customerLocation.longitude != null
            )
              ? customerLocation.zip || undefined
              : undefined,
          lat: usable ? customerLocation.latitude ?? undefined : undefined,
          lng: usable ? customerLocation.longitude ?? undefined : undefined,
          locationToken: usable
            ? [
                customerLocation.zip || "",
                customerLocation.city || "",
                String(customerLocation.latitude ?? ""),
                String(customerLocation.longitude ?? ""),
              ].join("|")
            : "all",
        },
      }),
    );
    if (customerLocation.detecting) {
      const timer = window.setTimeout(() => void load(), LOCATION_WAIT_MS);
      return () => window.clearTimeout(timer);
    }
    void load();
  }, [
    customerLocation.address,
    customerLocation.city,
    customerLocation.state,
    customerLocation.detecting,
    customerLocation.latitude,
    customerLocation.longitude,
    customerLocation.zip,
    dispatch,
  ]);

  const providers = useMemo(
    () => items.slice(0, providerLimit).map(publicProfessionalToProvider),
    [items, providerLimit],
  );

  const showSkeleton =
    !providers.length &&
    (customerLocation.detecting ||
      (!customerLocation.detectAttempted && !hasLocation(customerLocation)) ||
      loading ||
      !loaded);

  return (
    <Section tone="muted" density="tight">
      <Container className="flex flex-col gap-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          {isHomeowners ? (
            <div className="flex max-w-2xl flex-col gap-4">
              <p className="eyebrow text-primary">Built for homeowners</p>
              <h2 className="text-balance text-3xl font-semibold tracking-tight md:text-[2.75rem] md:leading-[1.1]">
                Find the Right Home Service Professional.{" "}
                <span className="text-primary">Get the Job Done.</span>
              </h2>
              <p className="max-w-xl text-sm leading-7 text-muted-foreground md:text-base">
                Tell us what you need, connect with local professionals, review
                written estimates, and manage your project—all in one place.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <p className="eyebrow text-muted-foreground">Featured Pros</p>
              <h2 className="text-3xl font-semibold md:text-[2.5rem]">
                Pros you can compare on more than stars
              </h2>
            </div>
          )}
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
          className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4"
          aria-busy={showSkeleton || undefined}
        >
          {showSkeleton ? (
            Array.from({ length: skeletonCount }, (_, index) => (
              <ProviderCardSkeleton key={`provider-skeleton-${index}`} />
            ))
          ) : providers.length > 0 ? (
            providers.map((provider, index) => (
              <ProviderCard
                key={provider.id}
                provider={provider}
                visual
                showLogo={isHomeowners}
                hideCredentials={index === 1 || index === 2}
              />
            ))
          ) : (
            <div className="col-span-full py-12 text-center text-muted-foreground">
              No professionals found in this location yet. Try exploring nearby areas.
            </div>
          )}
        </div>
      </Container>
    </Section>
  );
}
