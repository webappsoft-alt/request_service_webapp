"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Clock3, Loader2, MapPin, Plus, Star, Trash2, Upload } from "lucide-react";
import {
  extractUploadedUrl,
  uploadFile,
} from "@/components/api/uploadFile";
import { HoursEditor, ServiceHoursSummary } from "@/components/portal/hours-editor";
import { PortalPage } from "@/components/portal/portal-page";
import { StatusPill } from "@/components/portal/status-pill";
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
import { formatStartingPrice, formatHoursValue, formatWorkingDay } from "@/lib/format";
import type { WorkingHours } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  fetchParentCategories,
  fetchSubcategories,
} from "@/store/categoriesSlice";
import {
  clearFixedServiceDetail,
  createFixedService,
  fetchFixedServiceById,
  updateFixedService,
  unitToApi,
  type FixedServiceUnit,
} from "@/store/fixedServicesSlice";
import { fetchServiceAreasPicker } from "@/store/serviceAreasSlice";

function parseAvailability(value: string): ServiceAvailabilityMode {
  if (value === "office" || value === "custom") return value;
  return "office";
}

function parseUnit(value: string): FixedServiceUnit {
  if (value === "job" || value === "visit" || value === "hour") return value;
  return "job";
}

type DraftState = {
  name: string;
  categoryId: string;
  categoryName: string;
  subcategoryId: string;
  subcategoryName: string;
  description: string;
  price: number;
  unit: FixedServiceUnit;
  active: boolean;
  images: string[];
  coverage: string[];
  commonServices: string[];
  workingArea: string[];
  serviceAreaIds: string[];
  availabilityMode: ServiceAvailabilityMode;
  customHours: WorkingHours[];
};

function emptyDraft(officeHours: WorkingHours[]): DraftState {
  return {
    name: "",
    categoryId: "",
    categoryName: "",
    subcategoryId: "",
    subcategoryName: "",
    description: "",
    price: 149,
    unit: "job",
    active: true,
    images: [],
    coverage: [""],
    commonServices: [],
    workingArea: [],
    serviceAreaIds: [],
    availabilityMode: "office",
    customHours: cloneWorkingHours(officeHours),
  };
}

function toggleInList(list: string[], value: string, checked: boolean) {
  if (checked) return [...new Set([...list, value])];
  return list.filter((item) => item !== value);
}

function ServicePreview({
  service,
  companyName,
  providerSlug,
  hours,
  areaLabels,
}: {
  service: PortalFixedService;
  companyName: string;
  providerSlug: string;
  hours: WorkingHours[];
  areaLabels: string[];
}) {
  const [active, setActive] = useState(0);
  const images = service.images ?? [];
  const photo = images[Math.min(active, Math.max(images.length - 1, 0))];

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
            unoptimized={photo.startsWith("http")}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-sm font-medium text-white/70">
            Add a service photo
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 h-24 bg-linear-to-t from-black/45 to-transparent" />
        {service.categoryName ? (
          <Badge className="absolute top-3 left-3 border-0 bg-white/95 text-[#003F7D]">
            {service.categoryName}
          </Badge>
        ) : null}
      </div>
      {images.length > 1 ? (
        <div className="flex gap-2 px-3 pt-3">
          {images.map((src, index) => (
            <button
              key={`${src}-${index}`}
              type="button"
              onClick={() => setActive(index)}
              className={cn(
                "relative size-12 overflow-hidden rounded-md border",
                index === active ? "border-[#003F7D] ring-2 ring-[#003F7D]/30" : "border-black/10",
              )}
              aria-label={`Show photo ${index + 1}`}
            >
              <Image
                src={src}
                alt=""
                fill
                sizes="48px"
                className="object-cover"
                unoptimized={src.startsWith("http")}
              />
            </button>
          ))}
        </div>
      ) : null}
      <div className="flex flex-col gap-5 p-5">
        <div>
          <p className="text-[11px] font-medium tracking-[0.14em] text-[#003F7D] uppercase">
            {companyName}
          </p>
          <h2 className="mt-1 text-xl font-semibold tracking-tight">
            {service.name || "Untitled service"}
          </h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {service.description || "Describe what this fixed service includes for the customer."}
          </p>
        </div>
        <div className="flex items-end justify-between gap-3 rounded-xl bg-[#eef1f5] px-4 py-3">
          <div>
            <p className="text-[11px] font-medium tracking-[0.12em] text-muted-foreground uppercase">
              Typical start
            </p>
            <p className="text-2xl font-semibold text-[#003F7D]">
              {formatStartingPrice(service.price)}
            </p>
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
          {areaLabels.length ? (
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {areaLabels.map((area) => (
                <li key={area} className="rounded-full bg-[#eef1f5] px-2.5 py-1 text-xs">
                  {area}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">Choose the areas this service covers.</p>
          )}
        </div>
        <div>
          <p className="flex items-center gap-1.5 text-sm font-semibold">
            <Clock3 className="size-3.5" aria-hidden="true" />
            Availability
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {service.availabilityMode === "office"
              ? "Company office hours"
              : "Hours for this service only"}
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

function MultiSelectChips({
  options,
  selected,
  onToggle,
  empty,
}: {
  options: string[];
  selected: string[];
  onToggle: (value: string, checked: boolean) => void;
  empty: string;
}) {
  if (!options.length) {
    return <p className="text-sm text-muted-foreground">{empty}</p>;
  }
  return (
    <ul className="flex flex-wrap gap-2">
      {options.map((option) => {
        const checked = selected.includes(option);
        return (
          <li key={option}>
            <label
              className={cn(
                "flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-xs",
                checked
                  ? "border-[#003F7D] bg-[#003F7D]/8 text-[#003F7D]"
                  : "border-input text-muted-foreground",
              )}
            >
              <Checkbox
                checked={checked}
                onCheckedChange={(value) => onToggle(option, value === true)}
              />
              {option}
            </label>
          </li>
        );
      })}
    </ul>
  );
}

export function ServiceFormView({ id }: { id?: string }) {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const { provider } = usePortalWorkspace();
  const { officeHours } = usePortalSettings();
  const fileRef = useRef<HTMLInputElement>(null);

  const parents = useAppSelector((state) => state.categories?.parents ?? []);
  const loadingParents = useAppSelector(
    (state) => state.categories?.loadingParents ?? false,
  );
  const loadingSubcategories = useAppSelector(
    (state) => state.categories?.loadingSubcategories ?? false,
  );
  const subcategoriesByParent = useAppSelector(
    (state) => state.categories?.subcategoriesByParent ?? {},
  );

  const detail = useAppSelector((state) => state.fixedServices?.detail ?? null);
  const detailLoading = useAppSelector(
    (state) => state.fixedServices?.detailLoading ?? false,
  );
  const mutating = useAppSelector(
    (state) => state.fixedServices?.mutating ?? false,
  );

  const pickerItems = useAppSelector(
    (state) => state.serviceAreas?.pickerItems ?? [],
  );
  const pickerPage = useAppSelector((state) => state.serviceAreas?.pickerPage ?? 0);
  const pickerTotalPages = useAppSelector(
    (state) => state.serviceAreas?.pickerTotalPages ?? 1,
  );
  const pickerLoading = useAppSelector(
    (state) => state.serviceAreas?.pickerLoading ?? false,
  );

  const [draft, setDraft] = useState<DraftState>(() => emptyDraft(officeHours));
  const [uploading, setUploading] = useState(false);
  const [hydrated, setHydrated] = useState(!id);
  const lastSubFetchRef = useRef<string>("");

  const subcategories = draft.categoryId
    ? subcategoriesByParent[draft.categoryId] ?? []
    : [];

  const selectedCategory = useMemo(
    () => parents.find((item) => item.id === draft.categoryId),
    [parents, draft.categoryId],
  );

  const whatNeedsWorkOptions = selectedCategory?.commonServices ?? [];
  const whereIsWorkOptions = selectedCategory?.workingArea ?? [];

  useEffect(() => {
    void dispatch(fetchParentCategories());
    void dispatch(fetchServiceAreasPicker());
  }, [dispatch]);

  useEffect(() => {
    if (!id) {
      dispatch(clearFixedServiceDetail());
      return;
    }
    void dispatch(fetchFixedServiceById(id));
    return () => {
      dispatch(clearFixedServiceDetail());
    };
  }, [dispatch, id]);

  useEffect(() => {
    if (!id || !detail || detail.id !== id || hydrated) return;
    setDraft({
      name: detail.servicesName,
      categoryId: detail.categoryId,
      categoryName: detail.categoryName,
      subcategoryId: detail.subcategoryId,
      subcategoryName: detail.subcategoryName,
      description: detail.description,
      price: detail.price,
      unit: detail.unit,
      active: detail.isPublic,
      images: detail.images,
      coverage: detail.covered.length ? detail.covered : [""],
      commonServices: detail.commonServices,
      workingArea: detail.workingArea,
      serviceAreaIds: detail.serviceAreaIds,
      availabilityMode:
        detail.availabilityType === "custom" ? "custom" : "office",
      customHours: cloneWorkingHours(officeHours),
    });
    setHydrated(true);
    if (detail.categoryId) {
      lastSubFetchRef.current = detail.categoryId;
      void dispatch(fetchSubcategories(detail.categoryId));
    }
  }, [detail, dispatch, hydrated, id, officeHours]);

  useEffect(() => {
    if (!draft.categoryId) return;
    if (lastSubFetchRef.current === draft.categoryId) return;
    if (subcategoriesByParent[draft.categoryId]) {
      lastSubFetchRef.current = draft.categoryId;
      return;
    }
    lastSubFetchRef.current = draft.categoryId;
    void dispatch(fetchSubcategories(draft.categoryId));
  }, [dispatch, draft.categoryId, subcategoriesByParent]);

  const previewService: PortalFixedService = {
    id: id || "svc_new",
    name: draft.name,
    categoryId: draft.categoryId,
    categoryName: draft.categoryName,
    description: draft.description,
    price: draft.price,
    unit: draft.unit,
    active: draft.active,
    images: draft.images,
    coverage: draft.coverage,
    areaZips: [],
    availabilityMode: draft.availabilityMode,
    customHours: draft.customHours,
  };

  const previewHours = serviceHours(previewService, officeHours);
  const areaLabels = pickerItems
    .filter((area) => draft.serviceAreaIds.includes(area.id))
    .map((area) =>
      area.location.zip
        ? `${area.title} · ${area.location.zip}`
        : area.title || area.location.city,
    );

  const title = id
    ? draft.name || detail?.servicesName || "Fixed service"
    : "New fixed service";
  const pickerHasMore = pickerPage < pickerTotalPages;

  async function onUploadPhotos(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    try {
      const uploaded: string[] = [];
      for (const file of Array.from(files)) {
        const response = await uploadFile(file);
        const url = extractUploadedUrl(response.data);
        if (url) uploaded.push(url);
      }
      if (!uploaded.length) {
        toast.error("Could not upload photos.");
        return;
      }
      setDraft((current) => ({
        ...current,
        images: [...current.images, ...uploaded],
      }));
      toast.success(
        uploaded.length === 1
          ? "Photo uploaded."
          : `${uploaded.length} photos uploaded.`,
      );
    } catch {
      toast.error("Could not upload photos.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function save() {
    if (!draft.name.trim()) {
      toast.error("Add a service name.");
      return;
    }
    if (!draft.categoryId) {
      toast.error("Select a category.");
      return;
    }
    if (!draft.subcategoryId) {
      toast.error("Select a sub-category.");
      return;
    }

    const payload = {
      servicesName: draft.name.trim(),
      category: draft.categoryId,
      subcategory: draft.subcategoryId,
      price: draft.price,
      unit: unitToApi(draft.unit),
      isPublic: draft.active,
      customerSee: draft.active,
      images: draft.images,
      covered: draft.coverage.map((item) => item.trim()).filter(Boolean),
      commonServices: draft.commonServices,
      workingArea: draft.workingArea,
      serviceAreas: draft.serviceAreaIds,
      availabilityType:
        draft.availabilityMode === "custom"
          ? "custom"
          : "company_office_hours",
      description: draft.description.trim() || undefined,
    };

    if (id) {
      const result = await dispatch(updateFixedService({ id, ...payload }));
      if (updateFixedService.fulfilled.match(result)) {
        toast.success("Fixed service updated. The preview is what customers will see.");
        router.push("/pro/dashboard/services");
      } else {
        toast.error(
          typeof result.payload === "string"
            ? result.payload
            : "Could not update fixed service.",
        );
      }
      return;
    }

    const result = await dispatch(createFixedService(payload));
    if (createFixedService.fulfilled.match(result)) {
      toast.success("Fixed service added to your catalog.");
      router.push("/pro/dashboard/services");
    } else {
      toast.error(
        typeof result.payload === "string"
          ? result.payload
          : "Could not create fixed service.",
      );
    }
  }

  if (id && detailLoading && !hydrated) {
    return (
      <PortalPage eyebrow="Fixed service" title="Loading…">
        <div className="flex min-h-48 items-center justify-center">
          <Loader2 className="size-6 animate-spin text-primary" />
        </div>
      </PortalPage>
    );
  }

  if (id && hydrated && !detail && !detailLoading) {
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

  return (
    <PortalPage
      eyebrow="Fixed service"
      title={title}
      description="Edit the catalog card on the left. The right side is the live customer preview."
      badge={
        <StatusPill
          label={draft.active ? "Active" : "Hidden"}
          tone={draft.active ? "success" : "neutral"}
        />
      }
      actions={
        <div className="flex gap-2">
          <Button type="button" onClick={() => void save()} disabled={mutating || uploading}>
            {mutating ? <Loader2 className="size-4 animate-spin" /> : null}
            {id ? "Save service" : "Create service"}
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
            void save();
          }}
        >
          <section className="rounded-xl border border-input bg-card p-5">
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="svc-name">Service name</FieldLabel>
                <Input
                  id="svc-name"
                  value={draft.name}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, name: event.target.value }))
                  }
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
                  disabled={loadingParents}
                  onChange={(event) => {
                    const nextId = event.target.value;
                    const category = parents.find((item) => item.id === nextId);
                    setDraft((current) => ({
                      ...current,
                      categoryId: nextId,
                      categoryName: category?.name ?? "",
                      subcategoryId: "",
                      subcategoryName: "",
                      commonServices: [],
                      workingArea: [],
                    }));
                  }}
                >
                  <NativeSelectOption value="">
                    {loadingParents ? "Loading categories…" : "Select category"}
                  </NativeSelectOption>
                  {parents.map((category) => (
                    <NativeSelectOption key={category.id} value={category.id}>
                      {category.name}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </Field>
              {draft.categoryId ? (
                <Field>
                  <FieldLabel htmlFor="svc-subcategory">Sub-Category</FieldLabel>
                  <NativeSelect
                    id="svc-subcategory"
                    className="w-full"
                    value={draft.subcategoryId}
                    disabled={loadingSubcategories}
                    onChange={(event) => {
                      const nextId = event.target.value;
                      const sub = subcategories.find((item) => item.id === nextId);
                      setDraft((current) => ({
                        ...current,
                        subcategoryId: nextId,
                        subcategoryName: sub?.name ?? "",
                      }));
                    }}
                  >
                    <NativeSelectOption value="">
                      {loadingSubcategories
                        ? "Loading sub-categories…"
                        : "Select sub-category"}
                    </NativeSelectOption>
                    {subcategories.map((item) => (
                      <NativeSelectOption key={item.id} value={item.id}>
                        {item.name}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                </Field>
              ) : null}
              {draft.categoryId ? (
                <>
                  <Field>
                    <FieldLabel>What needs work?</FieldLabel>
                    <MultiSelectChips
                      options={whatNeedsWorkOptions}
                      selected={draft.commonServices}
                      onToggle={(value, checked) =>
                        setDraft((current) => ({
                          ...current,
                          commonServices: toggleInList(
                            current.commonServices,
                            value,
                            checked,
                          ),
                        }))
                      }
                      empty="No options on this category yet."
                    />
                  </Field>
                  <Field>
                    <FieldLabel>Where is the work?</FieldLabel>
                    <MultiSelectChips
                      options={whereIsWorkOptions}
                      selected={draft.workingArea}
                      onToggle={(value, checked) =>
                        setDraft((current) => ({
                          ...current,
                          workingArea: toggleInList(
                            current.workingArea,
                            value,
                            checked,
                          ),
                        }))
                      }
                      empty="No options on this category yet."
                    />
                  </Field>
                </>
              ) : null}
              <div className="grid gap-4 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="svc-price">Price</FieldLabel>
                  <Input
                    id="svc-price"
                    type="number"
                    min={0}
                    value={draft.price}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        price: Number(event.target.value) || 0,
                      }))
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
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      description: event.target.value,
                    }))
                  }
                />
              </Field>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={draft.active}
                  onCheckedChange={(checked) =>
                    setDraft((current) => ({
                      ...current,
                      active: checked === true,
                    }))
                  }
                />
                Show this service on the public catalog
              </label>
            </FieldGroup>
          </section>

          <section className="rounded-xl border border-input bg-card p-5">
            <p className="text-sm font-semibold">Service photos</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Pick photos for this job. The first selected photo is the cover.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(event) => void onUploadPhotos(event.target.files)}
              />
              <Button
                type="button"
                variant="outline"
                disabled={uploading}
                onClick={() => fileRef.current?.click()}
              >
                {uploading ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Upload className="size-4" />
                )}
                Upload photos
              </Button>
            </div>
            {draft.images.length ? (
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {draft.images.map((src, index) => {
                  const cover = index === 0;
                  return (
                    <div
                      key={`${src}-${index}`}
                      className={cn(
                        "relative aspect-[4/3] overflow-hidden rounded-lg border",
                        cover
                          ? "border-[#003F7D] ring-2 ring-[#003F7D]/25"
                          : "border-input",
                      )}
                    >
                      <Image
                        src={src}
                        alt=""
                        fill
                        sizes="160px"
                        className="object-cover"
                        unoptimized={src.startsWith("http")}
                      />
                      <span className="absolute top-1.5 left-1.5 rounded-full bg-[#003F7D] px-2 py-0.5 text-[10px] font-medium text-white">
                        {cover ? "Cover" : "Selected"}
                      </span>
                      <button
                        type="button"
                        className="absolute top-1.5 right-1.5 rounded-full bg-black/55 p-1 text-white"
                        aria-label="Remove photo"
                        onClick={() =>
                          setDraft((current) => ({
                            ...current,
                            images: current.images.filter((_, i) => i !== index),
                          }))
                        }
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">No photos yet.</p>
            )}
            {draft.images.length > 1 ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {draft.images.slice(1).map((src, index) => (
                  <Button
                    key={`${src}-cover-${index}`}
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setDraft((current) => ({
                        ...current,
                        images: [
                          src,
                          ...current.images.filter((item) => item !== src),
                        ],
                      }))
                    }
                  >
                    Use {index + 2} as cover
                  </Button>
                ))}
              </div>
            ) : null}
          </section>

          <section className="rounded-xl border border-input bg-card p-5">
            <p className="text-sm font-semibold">What’s covered in this price</p>
            <p className="mt-1 text-xs text-muted-foreground">
              List the work a customer can expect for the starting price.
            </p>
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
                        coverage: current.coverage.filter(
                          (_, lineIndex) => lineIndex !== index,
                        ),
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
              onClick={() =>
                setDraft((current) => ({
                  ...current,
                  coverage: [...current.coverage, ""],
                }))
              }
            >
              <Plus className="size-4" />
              Add coverage
            </Button>
          </section>

          <section className="rounded-xl border border-input bg-card p-5">
            <p className="text-sm font-semibold">Service areas</p>
            <p className="mt-1 text-xs text-muted-foreground">
              These areas come from this company’s coverage. Uncheck any area this
              service does not cover.
            </p>
            <ul className="mt-3 flex flex-wrap gap-2">
              {pickerItems.map((area) => {
                const selected = draft.serviceAreaIds.includes(area.id);
                const label = area.location.zip
                  ? `${area.title} · ${area.location.zip}`
                  : area.title || area.location.city || area.id;
                return (
                  <li key={area.id}>
                    <label
                      className={cn(
                        "flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-xs",
                        selected
                          ? "border-[#003F7D] bg-[#003F7D]/8 text-[#003F7D]"
                          : "border-input text-muted-foreground",
                      )}
                    >
                      <Checkbox
                        checked={selected}
                        onCheckedChange={(checked) =>
                          setDraft((current) => ({
                            ...current,
                            serviceAreaIds: toggleInList(
                              current.serviceAreaIds,
                              area.id,
                              checked === true,
                            ),
                          }))
                        }
                      />
                      {label}
                    </label>
                  </li>
                );
              })}
            </ul>
            {pickerLoading && !pickerItems.length ? (
              <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                Loading service areas…
              </div>
            ) : null}
            {pickerHasMore ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-3"
                disabled={pickerLoading}
                onClick={() => void dispatch(fetchServiceAreasPicker({ append: true }))}
              >
                {pickerLoading ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : null}
                See More
              </Button>
            ) : null}
          </section>

          <section className="rounded-xl border border-input bg-card p-5">
            <p className="text-sm font-semibold">Availability</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Use the company office hours from Settings, or set different hours for
              this service only.
            </p>
            <RadioGroup
              className="mt-4 gap-3"
              value={draft.availabilityMode}
              onValueChange={(value) =>
                setDraft((current) => ({
                  ...current,
                  availabilityMode: parseAvailability(value),
                  customHours:
                    parseAvailability(value) === "custom" &&
                    !current.customHours.length
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
                  <span className="block text-sm font-medium">
                    Different hours for this service
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Evenings, weekends, or a narrower window.
                  </span>
                </span>
              </label>
            </RadioGroup>
            {draft.availabilityMode === "office" ? (
              <div className="mt-4 rounded-lg bg-[#eef1f5] p-4">
                <ul className="flex flex-col gap-1.5 text-sm">
                  {officeHours.map((hours) => (
                    <li key={hours.day} className="flex justify-between gap-3">
                      <span className="text-muted-foreground">
                        {formatWorkingDay(hours.day)}
                      </span>
                      <span className="tabular-nums">{formatHoursValue(hours)}</span>
                    </li>
                  ))}
                </ul>
                <Button type="button" variant="outline" size="sm" className="mt-3" asChild>
                  <Link href="/pro/dashboard/settings#office-hours">
                    Edit office hours in Settings
                  </Link>
                </Button>
              </div>
            ) : (
              <div className="mt-4">
                <HoursEditor
                  hours={draft.customHours}
                  onChange={(customHours) =>
                    setDraft((current) => ({ ...current, customHours }))
                  }
                />
              </div>
            )}
          </section>

          <div className="flex gap-2">
            <Button type="submit" disabled={mutating || uploading}>
              {mutating ? <Loader2 className="size-4 animate-spin" /> : null}
              {id ? "Save service" : "Create service"}
            </Button>
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
            service={previewService}
            companyName={provider.companyName}
            providerSlug={provider.slug}
            hours={previewHours}
            areaLabels={areaLabels}
          />
        </aside>
      </div>
    </PortalPage>
  );
}
