"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Clock3, ImagePlus, MapPin, Plus, Star, Trash2 } from "lucide-react";
import {
  extractUploadedUrl,
  uploadFile,
} from "@/components/api/uploadFile";
import { HoursEditor, ServiceHoursSummary } from "@/components/portal/hours-editor";
import { PaginatedCategorySelect } from "@/components/portal/paginated-category-select";
import { usePaginatedCategoryOptions } from "@/components/portal/use-paginated-category-options";
import { PortalPage } from "@/components/portal/portal-page";
import { StatusPill } from "@/components/portal/status-pill";
import { usePortalSettings } from "@/components/portal/use-portal-settings";
import { usePortalWorkspace } from "@/components/portal/use-portal-workspace";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CenteredSpinner, Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import {
  cloneWorkingHours,
  serviceHours,
  serviceUnitLabel,
  type PortalFixedService,
  type ServiceAvailabilityMode,
} from "@/lib/data/portal";
import {
  formatStartingPrice,
  formatHoursValue,
  formatWorkingDay,
  toTitleCase,
} from "@/lib/format";
import type { WorkingHours } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  clearFixedServiceDetail,
  createFixedService,
  fetchFixedServiceById,
  updateFixedService,
  unitToApi,
  type FixedServiceUnit,
} from "@/store/fixedServicesSlice";
import { fetchServiceAreasPicker } from "@/store/serviceAreasSlice";

const selectTriggerClass =
  "h-10 w-full min-w-0 justify-between rounded-lg border border-input bg-transparent px-3 text-sm shadow-none";

const selectContentClass = "z-50 rounded-lg border border-input bg-popover p-1 shadow-md";

const selectItemClass =
  "cursor-pointer rounded-md py-2 pr-8 pl-2.5 text-sm focus:bg-accent focus:text-accent-foreground data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground";

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
  /** Raw price input; empty while cleared. Parsed to a non-negative number on save. */
  price: string;
  unit: FixedServiceUnit;
  active: boolean;
  images: string[];
  coverage: string[];
  faqs: { question: string; answer: string }[];
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
    price: "",
    unit: "job",
    active: true,
    images: [],
    coverage: [""],
    faqs: [{ question: "", answer: "" }],
    commonServices: [],
    workingArea: [],
    serviceAreaIds: [],
    availabilityMode: "office",
    customHours: cloneWorkingHours(officeHours),
  };
}

function parsePriceInput(raw: string): string | null {
  if (raw === "") return "";
  if (!/^\d*\.?\d*$/.test(raw)) return null;
  if (raw.startsWith("-")) return null;
  const value = Number(raw);
  if (raw !== "." && Number.isFinite(value) && value < 0) return null;
  return raw;
}

function priceNumber(value: string): number | null {
  if (value.trim() === "" || value === ".") return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return parsed;
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
  showBookButton = false,
  priceUnset = false,
}: {
  service: PortalFixedService;
  companyName: string;
  providerSlug: string;
  hours: WorkingHours[];
  areaLabels: string[];
  /** Hidden while creating/editing; keep wired for later. */
  showBookButton?: boolean;
  priceUnset?: boolean;
}) {
  const [active, setActive] = useState(0);
  const images = service.images ?? [];
  const photo = images[Math.min(active, Math.max(images.length - 1, 0))];
  const displayName = service.name.trim()
    ? toTitleCase(service.name)
    : "Untitled service";
  const displayCompany = toTitleCase(companyName);
  const displayCategory = service.categoryName
    ? toTitleCase(service.categoryName)
    : "";

  useEffect(() => {
    setActive(0);
  }, [service.id, images.length]);

  useEffect(() => {
    if (images.length < 2) return;
    const timer = window.setInterval(() => {
      setActive((current) => (current + 1) % images.length);
    }, 4000);
    return () => window.clearInterval(timer);
  }, [images.length, service.id, active]);

  return (
    <article className="overflow-hidden rounded-2xl border border-black/10 bg-white shadow-[0_18px_40px_-28px_rgba(0,63,125,0.45)]">
      <div className="relative aspect-[16/10] bg-[#003F7D]">
        {photo ? (
          <Image
            src={photo}
            alt={displayName}
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
        {displayCategory ? (
          <Badge className="absolute top-3 left-3 border-0 bg-white/95 text-[#003F7D]">
            {displayCategory}
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
          <p className="text-[11px] font-semibold tracking-[0.08em] text-[#003F7D]">
            {displayCompany}
          </p>
          <h2 className="mt-1 text-xl font-semibold tracking-tight">{displayName}</h2>
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
              {priceUnset ? "—" : formatStartingPrice(service.price)}
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
        {(service.faqs ?? []).filter(
          (item) => item.question.trim() && item.answer.trim(),
        ).length ? (
          <div>
            <p className="text-sm font-semibold">FAQ</p>
            <ul className="mt-2 flex flex-col gap-2">
              {(service.faqs ?? [])
                .filter((item) => item.question.trim() && item.answer.trim())
                .map((item) => (
                  <li key={item.question} className="text-sm">
                    <p className="font-medium text-foreground">{item.question}</p>
                    <p className="mt-0.5 text-muted-foreground">{item.answer}</p>
                  </li>
                ))}
            </ul>
          </div>
        ) : null}
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
        {showBookButton ? (
          <Button className="w-full bg-[#003F7D] hover:bg-[#003F7D]/90" asChild>
            <Link
              href={`/request-service?provider=${providerSlug}&serviceId=${service.id}&intent=book`}
            >
              Book this service
            </Link>
          </Button>
        ) : null}
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
              {toTitleCase(option)}
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

  const selectedCategoryId =
    draft.categoryId || (detail && detail.id === id ? detail.categoryId : "") || "";
  const selectedSubcategoryId =
    draft.subcategoryId ||
    (detail && detail.id === id ? detail.subcategoryId : "") ||
    "";

  const parentPaging = usePaginatedCategoryOptions("parents", true);
  const subPaging = usePaginatedCategoryOptions(
    selectedCategoryId ? "subs" : null,
    Boolean(selectedCategoryId),
    selectedCategoryId || undefined,
  );

  const loadingParents = parentPaging.loading;
  const loadingMoreParents = parentPaging.loadingMore;
  const categoryHasMore = parentPaging.hasMore;
  const loadingSubcategories = subPaging.loading;
  const loadingMoreSubcategories = subPaging.loadingMore;
  const subcategoryHasMore = subPaging.hasMore;

  const categoryOptions = useMemo(() => {
    const list = [...parentPaging.options];
    const ensure = (cid: string, cname: string) => {
      if (!cid) return;
      if (list.some((item) => item.id === cid)) return;
      list.unshift({ id: cid, name: cname || "Selected category" });
    };
    ensure(draft.categoryId, draft.categoryName);
    if (detail && detail.id === id) {
      ensure(detail.categoryId, detail.categoryName);
    }
    return list;
  }, [
    parentPaging.options,
    draft.categoryId,
    draft.categoryName,
    detail,
    id,
  ]);

  const subcategoryOptions = useMemo(() => {
    const list = [...subPaging.options];
    const ensure = (sid: string, sname: string) => {
      if (!sid) return;
      if (list.some((item) => item.id === sid)) return;
      list.unshift({ id: sid, name: sname || "Selected sub-category" });
    };
    ensure(draft.subcategoryId, draft.subcategoryName);
    if (detail && detail.id === id) {
      ensure(detail.subcategoryId, detail.subcategoryName);
    }
    return list;
  }, [
    subPaging.options,
    draft.subcategoryId,
    draft.subcategoryName,
    detail,
    id,
  ]);

  const selectedCategory = useMemo(
    () =>
      parentPaging.categories.find((item) => item.id === selectedCategoryId) ??
      null,
    [parentPaging.categories, selectedCategoryId],
  );

  const whatNeedsWorkOptions = selectedCategory?.commonServices ?? [];
  const whereIsWorkOptions = selectedCategory?.workingArea ?? [];

  useEffect(() => {
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
    if (!id || !detail || detail.id !== id) return;

    setDraft((current) => {
      const shouldReplace =
        !hydrated ||
        (Boolean(detail.categoryId) && !current.categoryId) ||
        (Boolean(detail.subcategoryId) &&
          !current.subcategoryId &&
          (current.categoryId === detail.categoryId || !current.categoryId));

      if (!shouldReplace && hydrated) return current;

      if (!hydrated) {
        return {
          name: detail.servicesName,
          categoryId: detail.categoryId,
          categoryName: detail.categoryName,
          subcategoryId: detail.subcategoryId,
          subcategoryName: detail.subcategoryName,
          description: detail.description,
          price: String(detail.price),
          unit: detail.unit,
          active: detail.isPublic,
          images: (detail.images ?? []).slice(0, 1),
          coverage: detail.covered.length ? detail.covered : [""],
          faqs: detail.faqs?.length
            ? detail.faqs.map((item) => ({
                question: item.question,
                answer: item.answer,
              }))
            : [{ question: "", answer: "" }],
          commonServices: detail.commonServices,
          workingArea: detail.workingArea,
          serviceAreaIds: detail.serviceAreaIds,
          availabilityMode:
            detail.availabilityType === "custom" ? "custom" : "office",
          customHours: cloneWorkingHours(officeHours),
        };
      }

      return {
        ...current,
        categoryId: current.categoryId || detail.categoryId,
        categoryName: current.categoryName || detail.categoryName,
        subcategoryId: current.subcategoryId || detail.subcategoryId,
        subcategoryName: current.subcategoryName || detail.subcategoryName,
        commonServices: current.commonServices.length
          ? current.commonServices
          : detail.commonServices,
        workingArea: current.workingArea.length
          ? current.workingArea
          : detail.workingArea,
      };
    });

    if (!hydrated) setHydrated(true);
  }, [detail, hydrated, id, officeHours]);

  const previewPrice = priceNumber(draft.price);
  const previewService: PortalFixedService = {
    id: id || "svc_new",
    name: draft.name,
    categoryId: draft.categoryId,
    categoryName: draft.categoryName,
    description: draft.description,
    price: previewPrice ?? 0,
    unit: draft.unit,
    active: draft.active,
    images: draft.images,
    coverage: draft.coverage,
    faqs: draft.faqs,
    areaZips: [],
    availabilityMode: draft.availabilityMode,
    customHours: draft.customHours,
  };
  const previewPriceUnset = previewPrice === null;

  const previewHours = serviceHours(previewService, officeHours);
  const areaLabels = pickerItems
    .filter((area) => draft.serviceAreaIds.includes(area.id))
    .map((area) =>
      area.location.zip
        ? `${area.title} · ${area.location.zip}`
        : area.title || area.location.city,
    );

  const title = id
    ? toTitleCase(draft.name || detail?.servicesName || "Fixed service")
    : "New fixed service";
  const pickerHasMore = pickerPage < pickerTotalPages;

  async function onUploadPhotos(files: FileList | null) {
    if (!files?.length) return;
    if (draft.images.length >= 1) {
      toast.error("A fixed service can have only 1 image. Remove the current photo to replace it.");
      if (fileRef.current) fileRef.current.value = "";
      return;
    }
    setUploading(true);
    try {
      const file = Array.from(files)[0];
      if (!file) return;
      const response = await uploadFile(file);
      const url = extractUploadedUrl(response.data);
      if (!url) {
        toast.error("Could not upload photo.");
        return;
      }
      setDraft((current) => ({
        ...current,
        images: [url],
      }));
      toast.success("Photo uploaded.");
    } catch {
      toast.error("Could not upload photo.");
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
    if (!draft.categoryId && !selectedCategoryId) {
      toast.error("Select a category.");
      return;
    }
    if (!draft.subcategoryId && !selectedSubcategoryId) {
      toast.error("Select a sub-category.");
      return;
    }
    const price = priceNumber(draft.price);
    if (price === null) {
      toast.error("Add a price.");
      return;
    }

    const payload = {
      servicesName: draft.name.trim(),
      category: draft.categoryId || selectedCategoryId,
      subcategory: draft.subcategoryId || selectedSubcategoryId,
      price,
      unit: unitToApi(draft.unit),
      isPublic: draft.active,
      customerSee: draft.active,
      images: draft.images.slice(0, 1),
      covered: draft.coverage.map((item) => item.trim()).filter(Boolean),
      faqs: (Array.isArray(draft.faqs) ? draft.faqs : [])
        .map((item) => ({
          question: String(item?.question || "").trim(),
          answer: String(item?.answer || "").trim(),
        }))
        .filter((item) => item.question && item.answer),
      commonServices: draft.commonServices,
      workingArea: draft.workingArea,
      serviceAreas: draft.serviceAreaIds,
      availabilityType:
        draft.availabilityMode === "custom"
          ? "custom_hours"
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
      <PortalPage eyebrow="Fixed service" title="Fixed service">
        <div className="px-4 pb-8">
          <CenteredSpinner label="Loading service" className="min-h-[22rem] border-0 bg-transparent" />
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
            {mutating ? <Spinner size="sm" label="Saving" /> : null}
            {id ? "Update service" : "Create service"}
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
              <div className="grid gap-4 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="svc-category">Category</FieldLabel>
                  <PaginatedCategorySelect
                    id="svc-category"
                    className="w-full"
                    value={selectedCategoryId}
                    options={categoryOptions}
                    disabled={loadingParents && !categoryOptions.length}
                    loading={loadingParents}
                    loadingMore={loadingMoreParents}
                    hasMore={categoryHasMore}
                    placeholder="Select category"
                    searchable
                    searchValue={parentPaging.search}
                    onSearchChange={parentPaging.setSearch}
                    searchPlaceholder="Search categories…"
                    onChange={(nextId, category) => {
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
                    onLoadMore={() => {
                      parentPaging.loadMore();
                    }}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="svc-subcategory">Sub-Category</FieldLabel>
                  <PaginatedCategorySelect
                    id="svc-subcategory"
                    className="w-full"
                    value={selectedSubcategoryId}
                    options={subcategoryOptions}
                    disabled={
                      !selectedCategoryId ||
                      (loadingSubcategories && !subcategoryOptions.length)
                    }
                    loading={loadingSubcategories}
                    loadingMore={loadingMoreSubcategories}
                    hasMore={subcategoryHasMore}
                    placeholder={
                      !selectedCategoryId
                        ? "Select category first"
                        : loadingSubcategories && !subcategoryOptions.length
                          ? "Loading sub-categories…"
                          : "Select sub-category"
                    }
                    searchable={Boolean(selectedCategoryId)}
                    searchValue={subPaging.search}
                    onSearchChange={subPaging.setSearch}
                    searchPlaceholder="Search sub-categories…"
                    onChange={(nextId, sub) => {
                      setDraft((current) => ({
                        ...current,
                        subcategoryId: nextId,
                        subcategoryName: sub?.name ?? "",
                      }));
                    }}
                    onLoadMore={() => {
                      subPaging.loadMore();
                    }}
                  />
                </Field>
              </div>
              {selectedCategoryId ? (
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
                    type="text"
                    inputMode="decimal"
                    placeholder="0"
                    value={draft.price}
                    onChange={(event) => {
                      const next = parsePriceInput(event.target.value);
                      if (next === null) return;
                      setDraft((current) => ({ ...current, price: next }));
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "-" || event.key === "e" || event.key === "E" || event.key === "+") {
                        event.preventDefault();
                      }
                    }}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="svc-unit">Unit</FieldLabel>
                  <Select
                    value={draft.unit}
                    onValueChange={(value) =>
                      setDraft((current) => ({
                        ...current,
                        unit: parseUnit(value),
                      }))
                    }
                  >
                    <SelectTrigger id="svc-unit" className={selectTriggerClass}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent position="popper" align="start" className={selectContentClass}>
                      <SelectItem value="job" className={selectItemClass}>
                        Per job
                      </SelectItem>
                      <SelectItem value="visit" className={selectItemClass}>
                        Per visit
                      </SelectItem>
                      <SelectItem value="hour" className={selectItemClass}>
                        Per hour
                      </SelectItem>
                    </SelectContent>
                  </Select>
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
            <p className="text-sm font-semibold">Service photo</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Add one photo for this fixed service. It is used as the cover image.
            </p>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) => void onUploadPhotos(event.target.files)}
            />
            <button
              type="button"
              disabled={uploading || draft.images.length >= 1}
              onClick={() => fileRef.current?.click()}
              className={cn(
                "mt-3 flex w-44 flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-input bg-transparent px-3 py-4 text-center transition-colors sm:w-52",
                "hover:border-primary/40 hover:bg-muted/30",
                "disabled:pointer-events-none disabled:opacity-60",
              )}
            >
              {uploading ? (
                <Spinner size="sm" label="Uploading photo" />
              ) : (
                <span className="flex size-8 items-center justify-center rounded-full border border-input bg-card">
                  <ImagePlus className="size-3.5 text-primary" aria-hidden="true" />
                </span>
              )}
              <span className="text-sm font-medium text-foreground">
                {uploading
                  ? "Uploading…"
                  : draft.images.length >= 1
                    ? "Photo added"
                    : "Upload photo"}
              </span>
              <span className="text-[11px] leading-snug text-muted-foreground">
                PNG, JPG, or WEBP · 1 image max
              </span>
            </button>
            {draft.images.length ? (
              <div className="mt-3">
                <ul className="mt-1 flex flex-wrap gap-3">
                  {draft.images.slice(0, 1).map((src, index) => (
                    <li
                      key={`${src}-${index}`}
                      className="group relative h-28 w-36 overflow-hidden rounded-xl border border-primary ring-2 ring-primary/20 sm:h-32 sm:w-40"
                    >
                      <Image
                        src={src}
                        alt=""
                        fill
                        sizes="160px"
                        className="object-cover"
                        unoptimized={src.startsWith("http")}
                      />
                      <span className="absolute top-1.5 left-1.5 rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold tracking-wide text-white shadow-sm">
                        Cover
                      </span>
                      <button
                        type="button"
                        className="absolute top-1.5 right-1.5 flex size-7 items-center justify-center rounded-full bg-white text-foreground shadow-sm ring-1 ring-black/10 transition hover:bg-red-50 hover:text-red-600"
                        aria-label="Remove photo"
                        onClick={() =>
                          setDraft((current) => ({
                            ...current,
                            images: [],
                          }))
                        }
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">No photo yet.</p>
            )}
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
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">FAQ</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Optional. Add questions customers often ask about this service.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  setDraft((current) => ({
                    ...current,
                    faqs: [
                      ...(current.faqs || []),
                      { question: "", answer: "" },
                    ],
                  }))
                }
              >
                <Plus className="size-4" />
                Add FAQ
              </Button>
            </div>
            <ul className="mt-3 flex flex-col gap-3">
              {(draft.faqs?.length
                ? draft.faqs
                : [{ question: "", answer: "" }]
              ).map((item, index) => (
                <li
                  key={index}
                  className="flex flex-col gap-2 rounded-lg border border-input p-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs font-medium text-muted-foreground">
                      Question {index + 1}
                    </p>
                    {(draft.faqs?.length || 0) > 1 ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        aria-label="Remove FAQ"
                        onClick={() =>
                          setDraft((current) => ({
                            ...current,
                            faqs: current.faqs.filter(
                              (_, faqIndex) => faqIndex !== index,
                            ),
                          }))
                        }
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    ) : null}
                  </div>
                  <Input
                    value={item.question}
                    placeholder="e.g. How long does this job take?"
                    onChange={(event) =>
                      setDraft((current) => {
                        const faqs = current.faqs?.length
                          ? [...current.faqs]
                          : [{ question: "", answer: "" }];
                        faqs[index] = {
                          ...faqs[index],
                          question: event.target.value,
                        };
                        return { ...current, faqs };
                      })
                    }
                  />
                  <Textarea
                    value={item.answer}
                    placeholder="Short answer for customers"
                    rows={3}
                    onChange={(event) =>
                      setDraft((current) => {
                        const faqs = current.faqs?.length
                          ? [...current.faqs]
                          : [{ question: "", answer: "" }];
                        faqs[index] = {
                          ...faqs[index],
                          answer: event.target.value,
                        };
                        return { ...current, faqs };
                      })
                    }
                  />
                </li>
              ))}
            </ul>
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
                <Spinner size="sm" label="Loading service areas" />
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
                {pickerLoading ? <Spinner size="sm" label="Loading more areas" /> : null}
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
                  <Link href="/pro/dashboard/profile?step=hours">
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
              {mutating ? <Spinner size="sm" label="Saving" /> : null}
              {id ? "Update service" : "Create service"}
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
            priceUnset={previewPriceUnset}
            showBookButton={false}
          />
        </aside>
      </div>
    </PortalPage>
  );
}
