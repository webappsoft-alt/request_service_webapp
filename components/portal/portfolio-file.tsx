"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
} from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ImagePlus, Trash2 } from "lucide-react";
import { getData } from "@/components/api/apiFuntions";
import { providerApi } from "@/components/api/ApiRoutesFile";
import {
  extractUploadedUrl,
  uploadFile,
} from "@/components/api/uploadFile";
import { PaginatedCategorySelect } from "@/components/portal/paginated-category-select";
import { PaginatedMultiSelect } from "@/components/portal/paginated-multi-select";
import { PortalPage } from "@/components/portal/portal-page";
import { StatusPill } from "@/components/portal/status-pill";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { CenteredSpinner, Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { formatMoney, toTitleCase } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { fetchParentCategories } from "@/store/categoriesSlice";
import {
  normalizeFixedService,
  type FixedService,
} from "@/store/fixedServicesSlice";
import {
  clearPortfolioDetail,
  createPortfolio,
  fetchPortfolioById,
  updatePortfolio,
  type PortfolioMedia,
  type PortfolioStatus,
} from "@/store/portfolioSlice";

const SERVICES_PAGE_SIZE = 10;

type DraftMedia = PortfolioMedia;

type DraftState = {
  title: string;
  description: string;
  media: DraftMedia[];
  fixedServiceIds: string[];
  categoryId: string;
  categoryName: string;
  tagsInput: string;
  projectDate: string;
  duration: string;
  cost: string;
  isFeatured: boolean;
  status: "ACTIVE" | "HIDDEN" | "ARCHIVED";
};

function emptyDraft(): DraftState {
  return {
    title: "",
    description: "",
    media: [],
    fixedServiceIds: [],
    categoryId: "",
    categoryName: "",
    tagsInput: "",
    projectDate: "",
    duration: "",
    cost: "",
    isFeatured: false,
    status: "ACTIVE",
  };
}

function parseCostInput(raw: string): string | null {
  if (raw === "") return "";
  if (!/^\d*\.?\d*$/.test(raw)) return null;
  if (raw.startsWith("-")) return null;
  const value = Number(raw);
  if (raw !== "." && Number.isFinite(value) && value < 0) return null;
  return raw;
}

function costNumber(value: string): number | null {
  if (value.trim() === "" || value === ".") return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return parsed;
}

function toDateInputValue(iso: string): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso.slice(0, 10);
  }
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(date.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function fromDateInputValue(value: string): string | undefined {
  if (!value.trim()) return undefined;
  return `${value.trim()}T00:00:00.000Z`;
}

function parseTags(raw: string): string[] {
  return raw
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function extractFixedServicePage(response: unknown): {
  items: FixedService[];
  page: number;
  totalPages: number;
} {
  const root = asRecord(response) ?? {};
  const nested = asRecord(root.data);
  const list =
    (Array.isArray(root.data) && root.data) ||
    (nested && Array.isArray(nested.data) && nested.data) ||
    (Array.isArray(root.fixedServices) && root.fixedServices) ||
    (Array.isArray(response) && response) ||
    [];
  const items = list
    .map(normalizeFixedService)
    .filter((item): item is FixedService => Boolean(item));

  const paginationRaw =
    asRecord(root.pagination) ||
    (nested ? asRecord(nested.pagination) : null) ||
    {};
  const page = Math.max(1, Number(paginationRaw.page) || 1);
  const limit = Math.max(
    1,
    Number(paginationRaw.limit) || SERVICES_PAGE_SIZE,
  );
  const total = Math.max(
    0,
    Number(paginationRaw.total ?? paginationRaw.totalDocs ?? items.length) || 0,
  );
  const totalPages = Math.max(
    1,
    Number(paginationRaw.totalPages) ||
      Math.max(1, Math.ceil(total / limit) || 1),
  );

  return { items, page, totalPages };
}

function statusLabel(status: PortfolioStatus | DraftState["status"]) {
  if (status === "ACTIVE") return "Active";
  if (status === "ARCHIVED") return "Archived";
  return "Hidden";
}

function statusTone(status: PortfolioStatus | DraftState["status"]) {
  if (status === "ACTIVE") return "success" as const;
  if (status === "ARCHIVED") return "warning" as const;
  return "neutral" as const;
}

type PortfolioFormViewProps = {
  id?: string;
  embedded?: boolean;
  deferSubmit?: boolean;
  submitRef?: MutableRefObject<(() => Promise<boolean>) | null>;
};

export function PortfolioFormView({
  id,
  embedded = false,
  deferSubmit = false,
  submitRef,
}: PortfolioFormViewProps) {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const detail = useAppSelector((state) => state.portfolio?.detail ?? null);
  const detailLoading = useAppSelector(
    (state) => state.portfolio?.detailLoading ?? false,
  );
  const mutating = useAppSelector(
    (state) => state.portfolio?.mutating ?? false,
  );

  const parents = useAppSelector((state) => state.categories?.parents ?? []);
  const parentsHasMore = useAppSelector(
    (state) => state.categories?.parentsHasMore ?? false,
  );
  const parentsPage = useAppSelector(
    (state) => state.categories?.parentsPage ?? 0,
  );
  const parentsTotalPages = useAppSelector(
    (state) => state.categories?.parentsTotalPages ?? 1,
  );
  const loadingParents = useAppSelector(
    (state) => state.categories?.loadingParents ?? false,
  );
  const loadingMoreParents = useAppSelector(
    (state) => state.categories?.loadingMoreParents ?? false,
  );

  const [draft, setDraft] = useState<DraftState>(emptyDraft);
  const [hydrated, setHydrated] = useState(!id);
  const [uploading, setUploading] = useState(false);
  const [linkedServices, setLinkedServices] = useState<FixedService[]>([]);
  const [servicesPage, setServicesPage] = useState(0);
  const [servicesTotalPages, setServicesTotalPages] = useState(1);
  const [loadingServices, setLoadingServices] = useState(false);
  const [loadingMoreServices, setLoadingMoreServices] = useState(false);
  const servicesLoadRef = useRef(false);

  const categoryHasMore =
    Boolean(parentsHasMore) || parentsPage < parentsTotalPages;
  const servicesHasMore = servicesPage < servicesTotalPages;

  const categoryOptions = useMemo(() => {
    const list = parents.map((item) => ({ id: item.id, name: item.name }));
    if (
      draft.categoryId &&
      !list.some((item) => item.id === draft.categoryId)
    ) {
      list.unshift({
        id: draft.categoryId,
        name: draft.categoryName || "Selected category",
      });
    }
    return list;
  }, [parents, draft.categoryId, draft.categoryName]);

  const serviceOptions = useMemo(() => {
    const list = linkedServices.map((item) => ({
      id: item.id,
      name: item.servicesName,
    }));
    const namesById = new Map(
      (detail?.linkedServices ?? []).map((item) => [item.id, item.name]),
    );
    for (const serviceId of draft.fixedServiceIds) {
      if (list.some((item) => item.id === serviceId)) continue;
      list.unshift({
        id: serviceId,
        name: namesById.get(serviceId) || "Selected service",
      });
    }
    return list;
  }, [linkedServices, draft.fixedServiceIds, detail?.linkedServices]);

  const loadFixedServicesPage = useCallback(async (page: number, append: boolean) => {
    if (append) setLoadingMoreServices(true);
    else setLoadingServices(true);
    try {
      const response = await getData(
        providerApi.fixedServices,
        { page, limit: SERVICES_PAGE_SIZE },
        { silent: true },
      );
      const parsed = extractFixedServicePage(response);
      setLinkedServices((current) => {
        if (!append) return parsed.items;
        const seen = new Set(current.map((item) => item.id));
        const next = [...current];
        for (const item of parsed.items) {
          if (seen.has(item.id)) continue;
          seen.add(item.id);
          next.push(item);
        }
        return next;
      });
      setServicesPage(parsed.page);
      setServicesTotalPages(parsed.totalPages);
    } catch {
      if (!append) {
        setLinkedServices([]);
        setServicesPage(0);
        setServicesTotalPages(1);
      }
    } finally {
      if (append) setLoadingMoreServices(false);
      else setLoadingServices(false);
    }
  }, []);

  useEffect(() => {
    void dispatch(fetchParentCategories());
  }, [dispatch]);

  useEffect(() => {
    if (servicesLoadRef.current) return;
    servicesLoadRef.current = true;
    void loadFixedServicesPage(1, false);
  }, [loadFixedServicesPage]);

  useEffect(() => {
    if (!id) {
      dispatch(clearPortfolioDetail());
      return;
    }
    void dispatch(fetchPortfolioById(id));
    return () => {
      dispatch(clearPortfolioDetail());
    };
  }, [dispatch, id]);

  useEffect(() => {
    if (!id || !detail || detail.id !== id || hydrated) return;
    setDraft({
      title: detail.title,
      description: detail.description,
      media: detail.media.length
        ? detail.media.map((item) => ({ ...item }))
        : [],
      fixedServiceIds: detail.fixedServiceIds,
      categoryId: detail.categoryId,
      categoryName: detail.categoryName,
      tagsInput: detail.tags.join(", "),
      projectDate: toDateInputValue(detail.projectDate),
      duration: detail.duration,
      cost: detail.cost ? String(detail.cost) : "",
      isFeatured: detail.isFeatured,
      status:
        detail.status === "ARCHIVED"
          ? "ARCHIVED"
          : detail.status === "HIDDEN"
            ? "HIDDEN"
            : "ACTIVE",
    });
    setHydrated(true);
  }, [detail, hydrated, id]);

  const title = id
    ? toTitleCase(draft.title || detail?.title || "Portfolio project")
    : "New portfolio project";

  const cover = draft.media.find((item) => item.isCover)?.url || draft.media[0]?.url;

  async function onUploadPhotos(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    try {
      const uploaded: DraftMedia[] = [];
      for (const file of Array.from(files)) {
        const response = await uploadFile(file);
        const url = extractUploadedUrl(response.data);
        if (url) {
          uploaded.push({
            url,
            type: "image",
            caption: "",
            isBefore: false,
            isAfter: false,
            isCover: false,
          });
        }
      }
      if (!uploaded.length) {
        toast.error("Could not upload photos.");
        return;
      }
      setDraft((current) => {
        const next = [...current.media, ...uploaded];
        if (!next.some((item) => item.isCover) && next[0]) {
          next[0] = { ...next[0], isCover: true };
        }
        return { ...current, media: next };
      });
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

  function updateMedia(index: number, patch: Partial<DraftMedia>) {
    setDraft((current) => ({
      ...current,
      media: current.media.map((item, i) => {
        if (i !== index) {
          if (patch.isCover) return { ...item, isCover: false };
          return item;
        }
        return { ...item, ...patch };
      }),
    }));
  }

  function buildPayload() {
    const cost = costNumber(draft.cost);
    const tags = parseTags(draft.tagsInput);
    const media = draft.media
      .filter((item) => item.url.trim())
      .map((item, index, list) => ({
        url: item.url.trim(),
        type: item.type || "image",
        caption: item.caption?.trim() || undefined,
        isBefore: Boolean(item.isBefore),
        isAfter: Boolean(item.isAfter),
        isCover: item.isCover || (index === 0 && !list.some((m) => m.isCover)),
      }));

    return {
      title: draft.title.trim(),
      description: draft.description.trim(),
      media,
      fixedServiceIds: draft.fixedServiceIds,
      category: draft.categoryId || undefined,
      tags: tags.length ? tags : undefined,
      projectDate: fromDateInputValue(draft.projectDate),
      duration: draft.duration.trim() || undefined,
      cost: cost ?? undefined,
      isFeatured: draft.isFeatured,
      status: draft.status === "ARCHIVED" ? ("ARCHIVED" as const) : draft.status,
    };
  }

  function validateDraft(options?: { allowEmpty?: boolean }): boolean {
    const hasTitle = Boolean(draft.title.trim());
    const hasMedia =
      draft.media.length > 0 && draft.media.some((item) => item.url.trim());

    if (options?.allowEmpty && !hasTitle && !hasMedia) {
      return true;
    }

    if (!hasTitle) {
      toast.error("Add a project title.");
      return false;
    }
    if (!draft.description.trim()) {
      toast.error("Add a project description.");
      return false;
    }
    if (!hasMedia) {
      toast.error("Upload at least one photo.");
      return false;
    }
    return true;
  }

  async function saveDeferred(): Promise<boolean> {
    const hasTitle = Boolean(draft.title.trim());
    const hasMedia =
      draft.media.length > 0 && draft.media.some((item) => item.url.trim());

    // Empty draft — skip without error.
    if (!hasTitle && !hasMedia) {
      return true;
    }

    if (!validateDraft()) return false;

    const payload = buildPayload();
    const createPayload = {
      ...payload,
      status:
        draft.status === "ARCHIVED"
          ? ("HIDDEN" as const)
          : (draft.status as "ACTIVE" | "HIDDEN"),
    };
    const result = await dispatch(createPortfolio(createPayload));
    if (createPortfolio.fulfilled.match(result)) {
      return true;
    }
    toast.error(
      typeof result.payload === "string"
        ? result.payload
        : "Could not create portfolio project.",
    );
    return false;
  }

  if (deferSubmit && submitRef) {
    submitRef.current = saveDeferred;
  }

  async function save() {
    if (deferSubmit) return;
    if (!validateDraft()) return;

    const payload = buildPayload();

    if (id) {
      const result = await dispatch(updatePortfolio({ id, ...payload }));
      if (updatePortfolio.fulfilled.match(result)) {
        toast.success("Portfolio project updated.");
        router.push("/pro/dashboard/portfolio");
      } else {
        toast.error(
          typeof result.payload === "string"
            ? result.payload
            : "Could not update portfolio project.",
        );
      }
      return;
    }

    const createPayload = {
      ...payload,
      status:
        draft.status === "ARCHIVED"
          ? ("HIDDEN" as const)
          : (draft.status as "ACTIVE" | "HIDDEN"),
    };
    const result = await dispatch(createPortfolio(createPayload));
    if (createPortfolio.fulfilled.match(result)) {
      toast.success("Portfolio project added.");
      router.push("/pro/dashboard/portfolio");
    } else {
      toast.error(
        typeof result.payload === "string"
          ? result.payload
          : "Could not create portfolio project.",
      );
    }
  }

  const formFields = (
    <FieldGroup>
      <Field>
        <FieldLabel htmlFor="pf-title">Project title</FieldLabel>
        <Input
          id="pf-title"
          value={draft.title}
          onChange={(event) =>
            setDraft((current) => ({
              ...current,
              title: event.target.value,
            }))
          }
          placeholder="Full bathroom plumbing overhaul"
          required={!deferSubmit}
        />
      </Field>
      <Field>
        <FieldLabel htmlFor="pf-description">Description</FieldLabel>
        <Textarea
          id="pf-description"
          rows={4}
          value={draft.description}
          onChange={(event) =>
            setDraft((current) => ({
              ...current,
              description: event.target.value,
            }))
          }
          placeholder="What work was done and the outcome for the customer."
          required={!deferSubmit}
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field>
          <FieldLabel htmlFor="pf-category">Category</FieldLabel>
          <PaginatedCategorySelect
            id="pf-category"
            className="w-full"
            value={draft.categoryId}
            options={categoryOptions}
            disabled={loadingParents && !categoryOptions.length}
            loading={loadingParents}
            loadingMore={loadingMoreParents}
            hasMore={categoryHasMore}
            placeholder="Select category"
            onChange={(nextId, category) => {
              setDraft((current) => ({
                ...current,
                categoryId: nextId,
                categoryName: category?.name ?? "",
              }));
            }}
            onLoadMore={() => {
              void dispatch(fetchParentCategories({ append: true }));
            }}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="pf-services">Fixed services</FieldLabel>
          <PaginatedMultiSelect
            id="pf-services"
            className="w-full"
            values={draft.fixedServiceIds}
            options={serviceOptions}
            disabled={loadingServices && !serviceOptions.length}
            loading={loadingServices}
            loadingMore={loadingMoreServices}
            hasMore={servicesHasMore}
            placeholder="Select fixed services"
            emptyLabel="No fixed services yet. Add packages under Fixed service first."
            onChange={(ids) =>
              setDraft((current) => ({
                ...current,
                fixedServiceIds: ids,
              }))
            }
            onLoadMore={() => {
              if (loadingMoreServices || !servicesHasMore) return;
              void loadFixedServicesPage(servicesPage + 1, true);
            }}
          />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field>
          <FieldLabel htmlFor="pf-date">Project date</FieldLabel>
          <Input
            id="pf-date"
            type="date"
            value={draft.projectDate}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                projectDate: event.target.value,
              }))
            }
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="pf-duration">Duration</FieldLabel>
          <Input
            id="pf-duration"
            value={draft.duration}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                duration: event.target.value,
              }))
            }
            placeholder="3 days"
          />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field>
          <FieldLabel htmlFor="pf-cost">Cost</FieldLabel>
          <Input
            id="pf-cost"
            type="text"
            inputMode="decimal"
            placeholder="0"
            value={draft.cost}
            onChange={(event) => {
              const next = parseCostInput(event.target.value);
              if (next === null) return;
              setDraft((current) => ({ ...current, cost: next }));
            }}
            onKeyDown={(event) => {
              if (
                event.key === "-" ||
                event.key === "e" ||
                event.key === "E" ||
                event.key === "+"
              ) {
                event.preventDefault();
              }
            }}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="pf-tags">Tags</FieldLabel>
          <Input
            id="pf-tags"
            value={draft.tagsInput}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                tagsInput: event.target.value,
              }))
            }
            placeholder="bathroom, remodel, plumbing"
          />
        </Field>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <Checkbox
          checked={draft.isFeatured}
          onCheckedChange={(checked) =>
            setDraft((current) => ({
              ...current,
              isFeatured: checked === true,
            }))
          }
        />
        Feature this project on the public profile
      </label>
    </FieldGroup>
  );

  const photosSection = (
    <>
      <p className="text-sm font-semibold">Project photos</p>
      <p className="mt-1 text-xs text-muted-foreground">
        Upload media assets. Mark cover, before, and after as needed.
        {deferSubmit
          ? " Optional — leave empty to skip adding a project on Submit."
          : ""}
      </p>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(event) => void onUploadPhotos(event.target.files)}
      />
      <button
        type="button"
        disabled={uploading}
        onClick={() => fileRef.current?.click()}
        className={cn(
          "mt-3 flex w-44 flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-input bg-transparent px-3 py-4 text-center transition-colors sm:w-52",
          "hover:border-primary/40 hover:bg-muted/30",
          "disabled:pointer-events-none disabled:opacity-60",
        )}
      >
        {uploading ? (
          <Spinner size="sm" label="Uploading photos" />
        ) : (
          <span className="flex size-8 items-center justify-center rounded-full border border-input bg-card">
            <ImagePlus
              className="size-3.5 text-primary"
              aria-hidden="true"
            />
          </span>
        )}
        <span className="text-sm font-medium text-foreground">
          {uploading ? "Uploading…" : "Upload photos"}
        </span>
        <span className="text-[11px] leading-snug text-muted-foreground">
          PNG, JPG, or WEBP
        </span>
      </button>

      {draft.media.length ? (
        <ul className="mt-4 flex flex-col gap-3">
          {draft.media.map((item, index) => (
            <li
              key={`${item.url}-${index}`}
              className={cn(
                "flex flex-col gap-3 rounded-xl border p-3 sm:flex-row",
                item.isCover
                  ? "border-primary ring-2 ring-primary/20"
                  : "border-input",
              )}
            >
              <div className="relative h-28 w-full overflow-hidden rounded-lg sm:h-32 sm:w-40 shrink-0">
                <Image
                  src={item.url}
                  alt=""
                  fill
                  sizes="160px"
                  className="object-cover"
                  unoptimized={item.url.startsWith("http")}
                />
                <button
                  type="button"
                  className="absolute top-1.5 right-1.5 flex size-7 items-center justify-center rounded-full bg-white text-foreground shadow-sm ring-1 ring-black/10 transition hover:bg-red-50 hover:text-red-600"
                  aria-label="Remove photo"
                  onClick={() =>
                    setDraft((current) => {
                      const next = current.media.filter((_, i) => i !== index);
                      if (
                        next.length &&
                        !next.some((media) => media.isCover)
                      ) {
                        next[0] = { ...next[0], isCover: true };
                      }
                      return { ...current, media: next };
                    })
                  }
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <Input
                  value={item.caption}
                  placeholder="Caption"
                  onChange={(event) =>
                    updateMedia(index, { caption: event.target.value })
                  }
                />
                <div className="flex flex-wrap gap-3 text-xs">
                  <label className="flex items-center gap-2">
                    <Checkbox
                      checked={item.isCover}
                      onCheckedChange={(checked) =>
                        updateMedia(index, {
                          isCover: checked === true,
                        })
                      }
                    />
                    Cover
                  </label>
                  <label className="flex items-center gap-2">
                    <Checkbox
                      checked={item.isBefore}
                      onCheckedChange={(checked) =>
                        updateMedia(index, {
                          isBefore: checked === true,
                        })
                      }
                    />
                    Before
                  </label>
                  <label className="flex items-center gap-2">
                    <Checkbox
                      checked={item.isAfter}
                      onCheckedChange={(checked) =>
                        updateMedia(index, {
                          isAfter: checked === true,
                        })
                      }
                    />
                    After
                  </label>
                </div>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">No photos yet.</p>
      )}
    </>
  );

  if (id && detailLoading && !hydrated) {
    if (embedded) {
      return (
        <div className="rounded-xl border border-input bg-card p-5">
          <CenteredSpinner
            label="Loading project"
            className="min-h-[12rem] border-0 bg-transparent"
          />
        </div>
      );
    }
    return (
      <PortalPage eyebrow="Portfolio" title="Portfolio project">
        <div className="px-4 pb-8">
          <CenteredSpinner
            label="Loading project"
            className="min-h-[22rem] border-0 bg-transparent"
          />
        </div>
      </PortalPage>
    );
  }

  if (id && hydrated && !detail && !detailLoading) {
    if (embedded) {
      return (
        <div className="rounded-xl border border-input bg-card p-5">
          <p className="text-sm font-semibold">Project not found</p>
          <p className="mt-1 text-xs text-muted-foreground">
            This portfolio item is no longer on this account.
          </p>
        </div>
      );
    }
    return (
      <PortalPage
        eyebrow="Portfolio"
        title="Project not found"
        description="This portfolio item is no longer on this account."
      >
        <div className="px-4">
          <Button asChild>
            <Link href="/pro/dashboard/portfolio">Back to portfolio</Link>
          </Button>
        </div>
      </PortalPage>
    );
  }

  if (embedded) {
    return (
      <section className="rounded-xl border border-input bg-card p-5">
        <p className="text-sm font-semibold">Add portfolio project</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Optional — showcase a completed job. Leave blank to skip on Submit.
        </p>
        <form
          className="mt-4 flex flex-col gap-6"
          onSubmit={(event) => {
            event.preventDefault();
            if (!deferSubmit) void save();
          }}
        >
          {formFields}
          <div>{photosSection}</div>
        </form>
      </section>
    );
  }

  return (
    <PortalPage
      eyebrow="Portfolio"
      title={title}
      description="Showcase a completed job with before/after photos, cost, and linked fixed services."
      badge={
        <StatusPill
          label={statusLabel(draft.status)}
          tone={statusTone(draft.status)}
        />
      }
      actions={
        <div className="flex gap-2">
          {!deferSubmit ? (
            <Button
              type="button"
              onClick={() => void save()}
              disabled={mutating || uploading}
            >
              {mutating ? <Spinner size="sm" label="Saving" /> : null}
              {id ? "Update project" : "Create project"}
            </Button>
          ) : null}
          <Button type="button" variant="outline" asChild>
            <Link href="/pro/dashboard/portfolio">Cancel</Link>
          </Button>
        </div>
      }
    >
      <div className="grid items-start gap-6 px-4 pb-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(20rem,24rem)]">
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (!deferSubmit) void save();
          }}
        >
          <section className="rounded-xl border border-input bg-card p-5">
            {formFields}
          </section>

          <section className="rounded-xl border border-input bg-card p-5">
            {photosSection}
          </section>
        </form>

        <aside className="flex flex-col gap-4 lg:sticky lg:top-4">
          <section className="overflow-hidden rounded-2xl border border-black/10 bg-white shadow-[0_18px_40px_-28px_rgba(0,63,125,0.45)]">
            <div className="relative aspect-[16/10] bg-[#003F7D]">
              {cover ? (
                <Image
                  src={cover}
                  alt={title}
                  fill
                  sizes="(min-width: 1024px) 28vw, 90vw"
                  className="object-cover"
                  unoptimized={cover.startsWith("http")}
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-sm font-medium text-white/70">
                  Add a project photo
                </div>
              )}
            </div>
            <div className="flex flex-col gap-3 p-5">
              <div>
                <p className="text-[11px] font-semibold tracking-[0.08em] text-[#003F7D]">
                  Portfolio
                </p>
                <h2 className="mt-1 text-xl font-semibold tracking-tight">
                  {draft.title.trim()
                    ? toTitleCase(draft.title)
                    : "Untitled project"}
                </h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {draft.description.trim() ||
                    "Customer-facing project summary appears here."}
                </p>
              </div>
              <div className="grid gap-3 rounded-xl bg-[#eef1f5] p-3 sm:grid-cols-2">
                <div>
                  <p className="text-[11px] font-medium tracking-[0.12em] text-muted-foreground uppercase">
                    Cost
                  </p>
                  <p className="mt-1 text-sm font-medium">
                    {costNumber(draft.cost) !== null
                      ? formatMoney(costNumber(draft.cost)!)
                      : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] font-medium tracking-[0.12em] text-muted-foreground uppercase">
                    Duration
                  </p>
                  <p className="mt-1 text-sm font-medium">
                    {draft.duration.trim() || "—"}
                  </p>
                </div>
              </div>
              {parseTags(draft.tagsInput).length ? (
                <ul className="flex flex-wrap gap-1.5">
                  {parseTags(draft.tagsInput).map((tag) => (
                    <li
                      key={tag}
                      className="rounded-full bg-[#eef1f5] px-2.5 py-1 text-xs font-medium"
                    >
                      {tag}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </section>
        </aside>
      </div>
    </PortalPage>
  );
}
