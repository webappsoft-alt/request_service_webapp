"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Wrench } from "lucide-react";
import { JobDetail } from "@/components/marketplace/job-detail";
import { RelatedBrowse } from "@/components/marketplace/related-browse";
import { FixedServiceOrderDialog } from "@/components/marketplace/fixed-service-order-dialog";
import { Container } from "@/components/layout/container";
import { CenteredSpinner } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  fetchPublicFixedServiceBySlug,
  selectPublicFixedServiceBySlug,
  setPublicFixedServiceDetail,
  type PublicFixedService,
} from "@/store/publicFixedServicesSlice";
import { setPendingOrderDraft } from "@/store/ordersSlice";
import type { JobRecord } from "@/lib/data/jobs";
import type { Provider, ServiceCategory, ServiceCategorySlug } from "@/lib/types";
import { getServiceCategoryBySlug } from "@/lib/data/services";
import { locationDisplayLabel } from "@/store/locationSlice";
import {
  pendingFixedOrderMatchesService,
  readPendingFixedOrder,
  type PendingFixedOrder,
} from "@/lib/booking/pending-fixed-order";

function categoryFromService(service: PublicFixedService): ServiceCategory {
  const slug = (service.category?.slug || "plumbing") as ServiceCategorySlug;
  const existing = getServiceCategoryBySlug(slug);
  if (existing) return existing;

  const name = service.category?.name || "Service";
  return {
    id: service.category?.id || service.id,
    slug,
    name,
    shortName: name,
    tagline: service.provider?.tagline || service.subcategory?.name || "",
    description: "",
    longDescription: "",
    commonServices: [],
    benefits: defaultBenefits(service),
    seoTitle: name,
    seoDescription: "",
    icon: service.category?.icon || "",
    image: service.category?.image,
  };
}

function defaultBenefits(service: PublicFixedService): string[] {
  const benefits: string[] = [];
  const profile = service.provider?.profile;
  if (profile?.licensed && profile?.insured) {
    benefits.push("Licensed and insured professionals");
  } else if (profile?.licensed) {
    benefits.push("Licensed professionals");
  } else if (profile?.insured) {
    benefits.push("Insured professionals");
  }
  benefits.push(
    "Written estimates before work begins",
    "Photo-supported requests",
    "Clear scheduling and follow-up",
  );
  return benefits.slice(0, 4);
}

function descriptionFromService(service: PublicFixedService): string {
  const fromProvider = service.provider?.description?.trim();
  if (fromProvider) return fromProvider;
  if (service.covered.length) {
    return `${service.servicesName} typically includes ${service.covered
      .slice(0, 3)
      .join(", ")
      .toLowerCase()}.`;
  }
  const company = service.provider?.companyName?.trim();
  return company
    ? `${service.servicesName} from ${company}.`
    : `${service.servicesName}.`;
}

function jobRecordFromService(service: PublicFixedService): JobRecord {
  const category = categoryFromService(service);
  return {
    category,
    job: service.servicesName,
    index: 0,
    slug: service.slug,
    detail: {
      description: descriptionFromService(service),
      points: service.covered.length
        ? service.covered
        : ["Scope confirmed after booking"],
      icon: Wrench,
    },
  };
}

function providerFromService(service: PublicFixedService): Provider | null {
  const p = service.provider;
  if (!p) return null;
  const coords = Array.isArray(p.location?.coordinates)
    ? p.location.coordinates
    : [];
  const lng = typeof coords[0] === "number" ? coords[0] : 0;
  const lat = typeof coords[1] === "number" ? coords[1] : 0;
  const initials = p.companyName
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return {
    id: p.id,
    slug: p.slug || p.id,
    companyName: p.companyName,
    logoInitials: initials || "PR",
    coverImage: service.images[0],
    images: service.images,
    startingPrice: service.price,
    tagline: p.tagline || "",
    description: p.description || "",
    rating: p.rating.average,
    reviewCount: p.rating.totalReviews,
    yearsInBusiness: p.profile.yearsInBusiness,
    licensed: p.profile.licensed,
    insured: p.profile.insured,
    categoryIds: service.category?.id ? [service.category.id] : [],
    serviceArea: service.workingArea,
    street: p.location.address || "",
    city: p.location.city || "",
    state: "",
    zip: p.location.zip || "",
    lat,
    lng,
    phone: "",
    email: "",
    workingHours: [],
    gallery: service.images,
    foundedYear: 0,
    employeeCount: "",
    reviews: [],
  };
}

export function PublicFixedServiceDetail({
  categorySlug,
  serviceSlug,
}: {
  categorySlug: string;
  serviceSlug: string;
}) {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [orderOpen, setOrderOpen] = useState(false);
  const [restoreDraft, setRestoreDraft] = useState<PendingFixedOrder | null>(
    null,
  );

  const service = useAppSelector((state) =>
    selectPublicFixedServiceBySlug(state, serviceSlug),
  );
  const detailLoading = useAppSelector(
    (state) => state.publicFixedServices.detailLoading,
  );
  const detailError = useAppSelector(
    (state) => state.publicFixedServices.detailError,
  );
  const detailSlug = useAppSelector(
    (state) => state.publicFixedServices.detail?.slug,
  );
  const customerLocation = useAppSelector((state) => state.location);
  const loc = locationDisplayLabel(customerLocation);
  const zip = customerLocation.zip.trim();

  useEffect(() => {
    if (!serviceSlug) return;
    if (service) {
      if (detailSlug !== service.slug) {
        dispatch(setPublicFixedServiceDetail(service));
      }
      return;
    }
    void dispatch(fetchPublicFixedServiceBySlug(serviceSlug));
  }, [detailSlug, dispatch, service, serviceSlug]);

  // After login/register (`?book=1`): restore pending checkout onto this service page.
  useEffect(() => {
    if (!service) return;
    if (searchParams.get("book") !== "1") return;

    const pending = readPendingFixedOrder();
    const matches = pendingFixedOrderMatchesService(
      pending,
      service.id,
      service.slug,
    );
    if (matches && pending) {
      setRestoreDraft(pending);
      dispatch(setPendingOrderDraft(pending));
    }
    setOrderOpen(true);

    const next = new URLSearchParams(searchParams.toString());
    next.delete("book");
    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, {
      scroll: false,
    });
  }, [dispatch, pathname, router, searchParams, service]);

  const record = useMemo(
    () => (service ? jobRecordFromService(service) : null),
    [service],
  );
  const providers = useMemo(() => {
    if (!service) return [] as Provider[];
    const provider = providerFromService(service);
    return provider ? [provider] : [];
  }, [service]);

  if (service && record) {
    const categoryPath = `/services/${service.category?.slug || categorySlug}`;
    return (
      <>
        <JobDetail
          record={record}
          providers={providers}
          content={{
            price: service.price,
            imageUrl: service.images[0],
            imageUrls: service.images,
            description: descriptionFromService(service),
            points: service.covered,
            tagline:
              service.provider?.tagline ||
              service.subcategory?.name ||
              service.category?.name ||
              "",
            benefits: defaultBenefits(service),
            onRequestJob: () => {
              setRestoreDraft(null);
              setOrderOpen(true);
            },
            compareHref: categoryPath,
          }}
        />
        <RelatedBrowse
          category={record.category}
          currentJob={
            service.subcategory?.name || service.servicesName || undefined
          }
          basePath="/services"
          zip={zip || undefined}
          loc={loc || undefined}
        />
        <FixedServiceOrderDialog
          open={orderOpen}
          onOpenChange={(next) => {
            setOrderOpen(next);
            if (!next) setRestoreDraft(null);
          }}
          service={service}
          initialDraft={restoreDraft}
        />
      </>
    );
  }

  if (detailLoading || !detailError) {
    return (
      <CenteredSpinner
        label="Loading service"
        className="min-h-[50vh]"
        size="lg"
      />
    );
  }

  return (
    <Container className="flex min-h-[50vh] flex-col items-center justify-center gap-3 py-16 text-center">
      <p className="text-base font-medium">
        {detailError || "That service could not be found."}
      </p>
      <Button variant="outline" asChild>
        <Link href="/services">Back to services</Link>
      </Button>
    </Container>
  );
}
