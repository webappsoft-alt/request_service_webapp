"use client";

import { useEffect, useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import { Check, Clock3, MapPin, Pencil } from "lucide-react";
import { ServiceHoursSummary } from "@/components/portal/hours-editor";
import { PortalPage } from "@/components/portal/portal-page";
import { StatusPill } from "@/components/portal/status-pill";
import { usePortalSettings } from "@/components/portal/use-portal-settings";
import { usePortalWorkspace } from "@/components/portal/use-portal-workspace";
import { Button } from "@/components/ui/button";
import { CenteredSpinner } from "@/components/ui/spinner";
import {
  cloneWorkingHours,
  serviceHours,
  serviceUnitLabel,
  type PortalFixedService,
} from "@/lib/data/portal";
import { formatMoney, formatStartingPrice, toTitleCase } from "@/lib/format";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  clearFixedServiceDetail,
  fetchFixedServiceById,
} from "@/store/fixedServicesSlice";
import { fetchServiceAreasPicker } from "@/store/serviceAreasSlice";

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-medium tracking-[0.12em] text-muted-foreground uppercase">
        {label}
      </p>
      <p className="mt-1 text-sm font-medium break-words">{value}</p>
    </div>
  );
}

export function ServiceDetailView({ id }: { id: string }) {
  const dispatch = useAppDispatch();
  const { provider } = usePortalWorkspace();
  const { officeHours } = usePortalSettings();

  const detail = useAppSelector((state) => state.fixedServices?.detail ?? null);
  const detailLoading = useAppSelector(
    (state) => state.fixedServices?.detailLoading ?? false,
  );
  const pickerItems = useAppSelector(
    (state) => state.serviceAreas?.pickerItems ?? [],
  );

  useEffect(() => {
    void dispatch(fetchFixedServiceById(id));
    void dispatch(fetchServiceAreasPicker());
    return () => {
      dispatch(clearFixedServiceDetail());
    };
  }, [dispatch, id]);

  const service: PortalFixedService | null = useMemo(() => {
    if (!detail || detail.id !== id) return null;
    return {
      id: detail.id,
      name: detail.servicesName,
      categoryId: detail.categoryId,
      categoryName: detail.categoryName,
      description: detail.description,
      price: detail.price,
      unit: detail.unit,
      active: detail.isPublic,
      images: detail.images,
      coverage: detail.covered,
      areaZips: [],
      availabilityMode:
        detail.availabilityType === "custom" ? "custom" : "office",
      customHours: cloneWorkingHours(officeHours),
    };
  }, [detail, id, officeHours]);

  const areaLabels = useMemo(() => {
    if (!detail) return [];
    return pickerItems
      .filter((area) => detail.serviceAreaIds.includes(area.id))
      .map((area) =>
        area.location.zip
          ? `${area.title} · ${area.location.zip}`
          : area.title || area.location.city,
      );
  }, [detail, pickerItems]);

  if (detailLoading && !service) {
    return (
      <PortalPage eyebrow="Fixed service" title="Fixed service">
        <div className="px-4 pb-8">
          <CenteredSpinner
            label="Loading service"
            className="min-h-[22rem] border-0 bg-transparent"
          />
        </div>
      </PortalPage>
    );
  }

  if (!service || !detail) {
    return (
      <PortalPage
        eyebrow="Fixed service"
        title="Service not found"
        description="This catalog item is no longer on this account."
      >
        <div className="px-4">
          <Button asChild>
            <Link href="/pro/dashboard/services">Back to fixed services</Link>
          </Button>
        </div>
      </PortalPage>
    );
  }

  const hours = serviceHours(service, officeHours);
  const cover = service.images[0];
  const title = toTitleCase(service.name) || "Untitled service";

  return (
    <PortalPage
      eyebrow="Fixed service"
      title={title}
      description="Catalog details customers can request from your public profile."
      badge={
        <StatusPill
          label={service.active ? "Active" : "Hidden"}
          tone={service.active ? "success" : "neutral"}
        />
      }
      actions={
        <div className="flex gap-2">
          <Button asChild>
            <Link href={`/pro/dashboard/services/${id}`}>
              <Pencil className="size-4" />
              Edit
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/pro/dashboard/services">Back</Link>
          </Button>
        </div>
      }
    >
      <div className="grid items-start gap-6 px-4 pb-8 lg:grid-cols-[minmax(0,1.2fr)_minmax(18rem,22rem)]">
        <div className="flex flex-col gap-4">
          <section className="overflow-hidden rounded-xl border border-black/10 bg-card">
            <div className="relative aspect-[16/9] bg-[#003F7D]">
              {cover ? (
                <Image
                  src={cover}
                  alt={title}
                  fill
                  sizes="(min-width: 1024px) 55vw, 100vw"
                  className="object-cover"
                  unoptimized={cover.startsWith("http")}
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-sm text-white/70">
                  No cover photo
                </div>
              )}
            </div>
            {service.images.length > 1 ? (
              <div className="flex gap-2 overflow-x-auto p-3">
                {service.images.map((src, index) => (
                  <span
                    key={`${src}-${index}`}
                    className="relative size-16 shrink-0 overflow-hidden rounded-lg border border-black/10"
                  >
                    <Image
                      src={src}
                      alt=""
                      fill
                      sizes="64px"
                      className="object-cover"
                      unoptimized={src.startsWith("http")}
                    />
                  </span>
                ))}
              </div>
            ) : null}
            <div className="flex flex-col gap-4 p-5">
              <div>
                <p className="text-[11px] font-semibold tracking-[0.08em] text-[#003F7D]">
                  {toTitleCase(provider.companyName)}
                </p>
                <h2 className="mt-1 text-2xl font-semibold tracking-tight">{title}</h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {service.description || "No customer-facing description yet."}
                </p>
              </div>
              <div className="grid gap-4 rounded-xl bg-[#eef1f5] p-4 sm:grid-cols-3">
                <Fact label="Price" value={formatStartingPrice(service.price)} />
                <Fact label="Unit" value={toTitleCase(serviceUnitLabel(service.unit))} />
                <Fact
                  label="Catalog"
                  value={service.active ? "Public" : "Hidden"}
                />
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-black/10 bg-card p-5">
            <p className="text-sm font-semibold">Service details</p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Fact
                label="Category"
                value={toTitleCase(detail.categoryName) || "—"}
              />
              <Fact
                label="Sub-category"
                value={toTitleCase(detail.subcategoryName) || "—"}
              />
              <Fact label="Amount" value={formatMoney(detail.price)} />
              <Fact
                label="Pricing unit"
                value={toTitleCase(serviceUnitLabel(detail.unit))}
              />
            </div>
            {detail.commonServices.length ? (
              <div className="mt-5">
                <p className="text-[11px] font-medium tracking-[0.12em] text-muted-foreground uppercase">
                  What needs work
                </p>
                <ul className="mt-2 flex flex-wrap gap-1.5">
                  {detail.commonServices.map((item) => (
                    <li
                      key={item}
                      className="rounded-full bg-[#eef1f5] px-2.5 py-1 text-xs font-medium"
                    >
                      {toTitleCase(item)}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {detail.workingArea.length ? (
              <div className="mt-5">
                <p className="text-[11px] font-medium tracking-[0.12em] text-muted-foreground uppercase">
                  Where is the work
                </p>
                <ul className="mt-2 flex flex-wrap gap-1.5">
                  {detail.workingArea.map((item) => (
                    <li
                      key={item}
                      className="rounded-full bg-[#eef1f5] px-2.5 py-1 text-xs font-medium"
                    >
                      {toTitleCase(item)}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </section>

          <section className="rounded-xl border border-black/10 bg-card p-5">
            <p className="text-sm font-semibold">What’s covered</p>
            {service.coverage.filter((item) => item.trim()).length ? (
              <ul className="mt-3 flex flex-col gap-2">
                {service.coverage
                  .filter((item) => item.trim())
                  .map((item) => (
                    <li
                      key={item}
                      className="flex items-start gap-2 text-sm text-muted-foreground"
                    >
                      <Check
                        className="mt-0.5 size-3.5 shrink-0 text-[#003F7D]"
                        aria-hidden="true"
                      />
                      <span>{item}</span>
                    </li>
                  ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">
                No coverage lines yet.
              </p>
            )}
          </section>
        </div>

        <aside className="flex flex-col gap-4 lg:sticky lg:top-4">
          <section className="rounded-xl border border-black/10 bg-card p-5">
            <p className="flex items-center gap-1.5 text-sm font-semibold">
              <MapPin className="size-3.5" aria-hidden="true" />
              Service areas
            </p>
            {areaLabels.length ? (
              <ul className="mt-3 flex flex-wrap gap-1.5">
                {areaLabels.map((area) => (
                  <li
                    key={area}
                    className="rounded-full bg-[#eef1f5] px-2.5 py-1 text-xs"
                  >
                    {area}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">
                No service areas selected.
              </p>
            )}
          </section>

          <section className="rounded-xl border border-black/10 bg-card p-5">
            <p className="flex items-center gap-1.5 text-sm font-semibold">
              <Clock3 className="size-3.5" aria-hidden="true" />
              Availability
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {service.availabilityMode === "office"
                ? "Company office hours"
                : "Hours for this service only"}
            </p>
            <div className="mt-3">
              <ServiceHoursSummary hours={hours} />
            </div>
          </section>
        </aside>
      </div>
    </PortalPage>
  );
}
