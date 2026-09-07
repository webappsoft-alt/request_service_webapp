"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Clock3, MapPin, Plus, Star, Trash2 } from "lucide-react";
import { HoursEditor, ServiceHoursSummary } from "@/components/portal/hours-editor";
import { PortalPage } from "@/components/portal/portal-page";
import { StatusPill } from "@/components/portal/status-pill";
import { usePortalRecords } from "@/components/portal/use-portal-records";
import { usePortalSettings } from "@/components/portal/use-portal-settings";
import { usePortalWorkspace } from "@/components/portal/use-portal-workspace";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import {
  cloneWorkingHours,
  serviceHours,
  serviceUnitLabel,
  type PortalFixedService,
  type ServiceAvailabilityMode,
} from "@/lib/data/portal";
import { getServiceImagePool } from "@/lib/data/provider-media";
import { getAreaName } from "@/lib/data/service-areas";
import { formatStartingPrice } from "@/lib/format";
import type { WorkingHours } from "@/lib/types";
import { cn } from "@/lib/utils";

function parseAvailability(value: string): ServiceAvailabilityMode {
  if (value === "office" || value === "custom") return value;
  return "office";
}

function parseUnit(value: string): PortalFixedService["unit"] {
  if (value === "job" || value === "visit" || value === "hour") return value;
  return "job";
}

function ServicePreview({
  service,
  companyName,
  providerSlug,
  hours,
}: {
  service: PortalFixedService;
  companyName: string;
  providerSlug: string;
  hours: WorkingHours[];
}) {
  const [active, setActive] = useState(0);
  const images = service.images ?? [];
  const photo = images[Math.min(active, Math.max(images.length - 1, 0))];
  const areas = (service.areaZips ?? []).map((zip) => `${getAreaName(zip)} · ${zip}`);

  return (
    <article className="overflow-hidden rounded-2xl border border-black/10 bg-white shadow-[0_18px_40px_-28px_rgba(0,63,125,0.45)]">
      <div className="relative aspect-[16/10] bg-[#003F7D]">
        {photo ? (
          <Image
            src={photo}
            alt={service.name || "Service photo"}
            fill
            sizes="(min-width: 1024px) 28vw, 90vw"
            className="object-cover"
            loading="eager"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-sm font-medium text-white/70">
            Add a service photo
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 h-24 bg-linear-to-t from-black/45 to-transparent" />
        {service.categoryName ? (
          <Badge className="absolute top-3 left-3 border-0 bg-white/95 text-[#003F7D]">{service.categoryName}</Badge>
        ) : null}
      </div>
      {images.length > 1 ? (
        <div className="flex gap-2 px-3 pt-3">
          {images.map((src, index) => (
            <button
              key={src}
              type="button"
              onClick={() => setActive(index)}
              className={cn(
                "relative size-12 overflow-hidden rounded-md border",
                index === active ? "border-[#003F7D] ring-2 ring-[#003F7D]/30" : "border-black/10",
              )}
              aria-label={`Show photo ${index + 1}`}
            >
              <Image src={src} alt="" fill sizes="48px" className="object-cover" />
            </button>
          ))}
        </div>
      ) : null}
      <div className="flex flex-col gap-5 p-5">
        <div>
          <p className="text-[11px] font-medium tracking-[0.14em] text-[#003F7D] uppercase">{companyName}</p>
          <h2 className="mt-1 text-xl font-semibold tracking-tight">{service.name || "Untitled service"}</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {service.description || "Describe what this fixed service includes for the customer."}
          </p>
        </div>
        <div className="flex items-end justify-between gap-3 rounded-xl bg-[#eef1f5] px-4 py-3">
          <div>
            <p className="text-[11px] font-medium tracking-[0.12em] text-muted-foreground uppercase">Typical start</p>
            <p className="text-2xl font-semibold text-[#003F7D]">{formatStartingPrice(service.price)}</p>
          </div>
          <p className="text-sm text-muted-foreground">{serviceUnitLabel(service.unit)}</p>
        </div>
        <div>
          <p className="text-sm font-semibold">What’s covered</p>
          {(service.coverage ?? []).filter((item) => item.trim()).length ? (
            <ul className="mt-2 flex flex-col gap-1.5">
              {(service.coverage ?? [])
                .filter((item) => item.trim())
                .map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <Check className="mt-0.5 size-3.5 shrink-0 text-[#003F7D]" aria-hidden="true" />
                    <span>{item}</span>
                  </li>
                ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">Add the work this price covers.</p>
          )}
        </div>
        <div>
          <p className="flex items-center gap-1.5 text-sm font-semibold">
            <MapPin className="size-3.5" aria-hidden="true" />
            Service areas
          </p>
          {areas.length ? (
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {areas.map((area) => (
                <li key={area} className="rounded-full bg-[#eef1f5] px-2.5 py-1 text-xs">
                  {area}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">Choose the ZIPs this service covers.</p>
          )}
        </div>
        <div>
          <p className="flex items-center gap-1.5 text-sm font-semibold">
            <Clock3 className="size-3.5" aria-hidden="true" />
            Availability
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {service.availabilityMode === "office" ? "Company office hours" : "Hours for this service only"}
          </p>
          <div className="mt-2">
            <ServiceHoursSummary hours={hours} />
          </div>
        </div>
        <Button className="w-full bg-[#003F7D] hover:bg-[#003F7D]/90" asChild>
          <Link
            href={`/request-service?provider=${providerSlug}&serviceId=${service.id}&intent=book`}
          >
            Book this service
          </Link>
        </Button>
        <p className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
          <Star className="size-3 fill-current" aria-hidden="true" />
          Live customer preview
        </p>
      </div>
    </article>
  );
}

export function ServiceFormView({ id }: { id?: string }) {
  const router = useRouter();
  const { services, categories, provider } = usePortalWorkspace();
  const records = usePortalRecords();
  const { officeHours } = usePortalSettings();
  const catalog = records.mergeServices(services);
  const seeded = id ? services.find((item) => item.id === id) : undefined;
  const existing = id ? catalog.find((item) => item.id === id) : undefined;

  const [draft, setDraft] = useState<PortalFixedService>(
    () =>
      seeded ?? {
        id: "svc_new",
        name: "",
        categoryId: categories[0]?.id ?? "",
        categoryName: categories[0]?.name ?? "",
        description: "",
        price: 149,
        unit: "job",
        active: true,
        images: getServiceImagePool(categories[0]?.id ?? "").slice(0, 2),
        coverage: [""],
        areaZips: [...provider.serviceArea],
        availabilityMode: "office",
        customHours: cloneWorkingHours(officeHours),
      },
  );
  const synced = useRef(false);

  useEffect(() => {
    if (synced.current || !existing) return;
    synced.current = true;
    setDraft(existing);
  }, [existing]);

  const pool = useMemo(() => getServiceImagePool(draft.categoryId), [draft.categoryId]);
  const previewHours = serviceHours(draft, officeHours);
  const title = existing ? draft.name || existing.name : "New fixed service";

  if (id && !existing) {
    return (
      <PortalPage eyebrow="Fixed service" title="Service not found" description="This catalog item is no longer on this account.">
        <div className="px-4">
          <Button asChild>
            <Link href="/pro/dashboard/services">Back to fixed services</Link>
          </Button>
        </div>
      </PortalPage>
    );
  }

  function save() {
    if (!draft.name.trim()) {
      toast.error("Add a service name.");
      return;
    }
    const next: PortalFixedService = {
      ...draft,
      id: existing?.id ?? `svc_custom_${Date.now()}`,
      name: draft.name.trim(),
      description: draft.description.trim(),
      coverage: draft.coverage.map((item) => item.trim()).filter(Boolean),
      customHours: cloneWorkingHours(draft.customHours),
    };
    if (existing) {
      records.patchService(existing.id, next);
      records.setStatus("service", existing.id, next.active ? "active" : "hidden");
      toast.success("Fixed service updated. The preview is what customers will see.");
    } else {
      records.addService(next);
      records.setStatus("service", next.id, next.active ? "active" : "hidden");
      toast.success("Fixed service added to your catalog.");
    }
    router.push("/pro/dashboard/services");
  }

  return (
    <PortalPage
      eyebrow="Fixed service"
      title={title}
      description="Edit the catalog card on the left. The right side is the live customer preview."
      badge={<StatusPill label={draft.active ? "Active" : "Hidden"} tone={draft.active ? "success" : "neutral"} />}
      actions={
        <div className="flex gap-2">
          <Button type="button" onClick={save}>
            {existing ? "Save service" : "Create service"}
          </Button>
          <Button type="button" variant="outline" asChild>
            <Link href="/pro/dashboard/services">Cancel</Link>
          </Button>
        </div>
      }
    >
      <div className="grid items-start gap-6 px-4 pb-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(20rem,24rem)]">
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            save();
          }}
        >
          <section className="rounded-xl border border-input bg-card p-5">
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="svc-name">Service name</FieldLabel>
                <Input
                  id="svc-name"
                  value={draft.name}
                  onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
                  placeholder="Leak detection and repair"
                  required
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="svc-category">Category</FieldLabel>
                <NativeSelect
                  id="svc-category"
                  className="w-full"
                  value={draft.categoryId}
                  onChange={(event) => {
                    const category = categories.find((item) => item.id === event.target.value);
                    const nextPool = getServiceImagePool(event.target.value);
                    setDraft((current) => ({
                      ...current,
                      categoryId: event.target.value,
                      categoryName: category?.name ?? current.categoryName,
                      images: current.images.filter((src) => nextPool.includes(src)).length
                        ? current.images.filter((src) => nextPool.includes(src))
                        : nextPool.slice(0, 2),
                    }));
                  }}
                >
                  {categories.map((category) => (
                    <NativeSelectOption key={category.id} value={category.id}>
                      {category.name}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="svc-price">Price</FieldLabel>
                  <Input
                    id="svc-price"
                    type="number"
                    min={0}
                    value={draft.price}
                    onChange={(event) =>
                      setDraft((current) => ({ ...current, price: Number(event.target.value) || 0 }))
                    }
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="svc-unit">Unit</FieldLabel>
                  <NativeSelect
                    id="svc-unit"
                    className="w-full"
                    value={draft.unit}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        unit: parseUnit(event.target.value),
                      }))
                    }
                  >
                    <NativeSelectOption value="job">Per job</NativeSelectOption>
                    <NativeSelectOption value="visit">Per visit</NativeSelectOption>
                    <NativeSelectOption value="hour">Per hour</NativeSelectOption>
                  </NativeSelect>
                </Field>
              </div>
              <Field>
                <FieldLabel htmlFor="svc-details">What customers see</FieldLabel>
                <Textarea
                  id="svc-details"
                  rows={4}
                  value={draft.description}
                  onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))}
                />
              </Field>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={draft.active}
                  onCheckedChange={(checked) => setDraft((current) => ({ ...current, active: checked === true }))}
                />
                Show this service on the public catalog
              </label>
            </FieldGroup>
          </section>

          <section className="rounded-xl border border-input bg-card p-5">
            <p className="text-sm font-semibold">Service photos</p>
            <p className="mt-1 text-xs text-muted-foreground">Pick photos for this job. The first selected photo is the cover.</p>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {pool.map((src) => {
                const selected = draft.images.includes(src);
                const cover = draft.images[0] === src;
                return (
                  <button
                    key={src}
                    type="button"
                    onClick={() =>
                      setDraft((current) => ({
                        ...current,
                        images: selected
                          ? current.images.filter((item) => item !== src)
                          : [...current.images, src],
                      }))
                    }
                    className={cn(
                      "relative aspect-[4/3] overflow-hidden rounded-lg border",
                      selected ? "border-[#003F7D] ring-2 ring-[#003F7D]/25" : "border-input",
                    )}
                  >
                    <Image src={src} alt="" fill sizes="160px" className="object-cover" />
                    {selected ? (
                      <span className="absolute top-1.5 left-1.5 rounded-full bg-[#003F7D] px-2 py-0.5 text-[10px] font-medium text-white">
                        {cover ? "Cover" : "Selected"}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
            {draft.images.length > 1 ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {draft.images.slice(1).map((src) => (
                  <Button
                    key={src}
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setDraft((current) => ({
                        ...current,
                        images: [src, ...current.images.filter((item) => item !== src)],
                      }))
                    }
                  >
                    Use {draft.images.indexOf(src) + 1} as cover
                  </Button>
                ))}
              </div>
            ) : null}
          </section>

          <section className="rounded-xl border border-input bg-card p-5">
            <p className="text-sm font-semibold">What’s covered in this price</p>
            <p className="mt-1 text-xs text-muted-foreground">List the work a customer can expect for the starting price.</p>
            <ul className="mt-3 flex flex-col gap-2">
              {draft.coverage.map((item, index) => (
                <li key={index} className="flex gap-2">
                  <Input
                    value={item}
                    placeholder="Find the leak and stop the water"
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        coverage: current.coverage.map((line, lineIndex) =>
                          lineIndex === index ? event.target.value : line,
                        ),
                      }))
                    }
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    aria-label="Remove coverage line"
                    onClick={() =>
                      setDraft((current) => ({
                        ...current,
                        coverage: current.coverage.filter((_, lineIndex) => lineIndex !== index),
                      }))
                    }
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </li>
              ))}
            </ul>
            <Button
              type="button"
              variant="outline"
              className="mt-3"
              onClick={() => setDraft((current) => ({ ...current, coverage: [...current.coverage, ""] }))}
            >
              <Plus className="size-4" />
              Add coverage
            </Button>
          </section>

          <section className="rounded-xl border border-input bg-card p-5">
            <p className="text-sm font-semibold">Service areas</p>
            <p className="mt-1 text-xs text-muted-foreground">
              These ZIPs come from this company’s coverage. Uncheck any area this service does not cover.
            </p>
            <ul className="mt-3 flex flex-wrap gap-2">
              {provider.serviceArea.map((zip) => {
                const selected = draft.areaZips.includes(zip);
                return (
                  <li key={zip}>
                    <label
                      className={cn(
                        "flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-xs",
                        selected ? "border-[#003F7D] bg-[#003F7D]/8 text-[#003F7D]" : "border-input text-muted-foreground",
                      )}
                    >
                      <Checkbox
                        checked={selected}
                        onCheckedChange={(checked) =>
                          setDraft((current) => ({
                            ...current,
                            areaZips:
                              checked === true
                                ? [...new Set([...current.areaZips, zip])]
                                : current.areaZips.filter((item) => item !== zip),
                          }))
                        }
                      />
                      {getAreaName(zip)} · {zip}
                    </label>
                  </li>
                );
              })}
            </ul>
          </section>

          <section className="rounded-xl border border-input bg-card p-5">
            <p className="text-sm font-semibold">Availability</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Use the company office hours from Settings, or set different hours for this service only.
            </p>
            <RadioGroup
              className="mt-4 gap-3"
              value={draft.availabilityMode}
              onValueChange={(value) =>
                setDraft((current) => ({
                  ...current,
                  availabilityMode: parseAvailability(value),
                  customHours:
                    parseAvailability(value) === "custom" && !current.customHours.length
                      ? cloneWorkingHours(officeHours)
                      : current.customHours,
                }))
              }
            >
              <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-input p-3">
                <RadioGroupItem value="office" className="mt-0.5" />
                <span>
                  <span className="block text-sm font-medium">Company office hours</span>
                  <span className="text-xs text-muted-foreground">
                    Same hours selected for {provider.companyName} in Settings.
                  </span>
                </span>
              </label>
              <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-input p-3">
                <RadioGroupItem value="custom" className="mt-0.5" />
                <span>
                  <span className="block text-sm font-medium">Different hours for this service</span>
                  <span className="text-xs text-muted-foreground">Evenings, weekends, or a narrower window.</span>
                </span>
              </label>
            </RadioGroup>
            {draft.availabilityMode === "office" ? (
              <div className="mt-4 rounded-lg bg-[#eef1f5] p-4">
                <ServiceHoursSummary hours={officeHours} />
                <Button type="button" variant="outline" size="sm" className="mt-3" asChild>
                  <Link href="/pro/dashboard/settings#office-hours">Edit office hours in Settings</Link>
                </Button>
              </div>
            ) : (
              <div className="mt-4">
                <HoursEditor
                  hours={draft.customHours}
                  onChange={(customHours) => setDraft((current) => ({ ...current, customHours }))}
                />
              </div>
            )}
          </section>

          <div className="flex gap-2">
            <Button type="submit">{existing ? "Save service" : "Create service"}</Button>
            <Button type="button" variant="outline" asChild>
              <Link href="/pro/dashboard/services">Cancel</Link>
            </Button>
          </div>
        </form>

        <aside className="lg:sticky lg:top-4">
          <p className="mb-2 text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
            Customer preview
          </p>
          <ServicePreview
            service={draft}
            companyName={provider.companyName}
            providerSlug={provider.slug}
            hours={previewHours}
          />
        </aside>
      </div>
    </PortalPage>
  );
}
