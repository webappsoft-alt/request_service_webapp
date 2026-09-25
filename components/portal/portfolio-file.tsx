"use client";

import {
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
import {
  extractUploadedUrl,
  uploadFile,
} from "@/components/api/uploadFile";
import { PaginatedCategorySelect } from "@/components/portal/paginated-category-select";
import { usePaginatedCategoryOptions } from "@/components/portal/use-paginated-category-options";
import { PortalPage } from "@/components/portal/portal-page";
import { StatusPill } from "@/components/portal/status-pill";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { CenteredSpinner, Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { getServiceCategoryById } from "@/lib/data/services";
import { toTitleCase } from "@/lib/format";
import { cn } from "@/lib/utils";
import { selectAuthProvider } from "@/store/authSlice";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { type PublicCategory } from "@/store/categoriesSlice";
import {
  clearPortfolioDetail,
  createPortfolio,
  fetchPortfolioById,
  updatePortfolio,
  type PortfolioMedia,
  type PortfolioStatus,
} from "@/store/portfolioSlice";

type DraftMedia = PortfolioMedia;

type DraftState = {
  title: string;
  description: string;
  media: DraftMedia[];
  categoryId: string;
  categoryName: string;
  subcategoryId: string;
  subcategoryName: string;
  status: "ACTIVE" | "HIDDEN" | "ARCHIVED";
};

function emptyDraft(): DraftState {
  return {
    title: "",
    description: "",
    media: [],
    categoryId: "",
    categoryName: "",
    subcategoryId: "",
    subcategoryName: "",
    status: "ACTIVE",
  };
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

/** Match signup catalog ids (`cat_plumbing`, etc.) to API parent categories. */
function parentMatchesSignupId(
  parent: PublicCategory,
  signupId: string,
): boolean {
  const needle = signupId.trim().toLowerCase();
  if (!needle) return false;

  const parentId = parent.id?.trim().toLowerCase() ?? "";
  const parentSlug = parent.slug?.trim().toLowerCase() ?? "";
  const parentName = parent.name?.trim().toLowerCase() ?? "";

  if (parentId === needle || parentSlug === needle || parentName === needle) {
    return true;
  }

  const catalog = getServiceCategoryById(signupId);
  if (!catalog) return false;

  const catalogId = catalog.id.trim().toLowerCase();
  const catalogSlug = catalog.slug.trim().toLowerCase();
  const catalogName = catalog.name.trim().toLowerCase();

  return (
    parentId === catalogId ||
    parentSlug === catalogSlug ||
    parentName === catalogName ||
    parentSlug === catalogId.replace(/^cat_/, "") ||
    parentId === catalogSlug
  );
}

type PortfolioFormViewProps = {
  id?: string;
  embedded?: boolean;
  deferSubmit?: boolean;
  submitRef?: MutableRefObject<(() => Promise<boolean>) | null>;
  allowedCategoryIds?: string[];
};

export function PortfolioFormView({
  id,
  embedded = false,
  deferSubmit = false,
  submitRef,
  allowedCategoryIds,
}: PortfolioFormViewProps) {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const authProvider = useAppSelector(selectAuthProvider);
  const detail = useAppSelector((state) => state.portfolio?.detail ?? null);
  const detailLoading = useAppSelector(
    (state) => state.portfolio?.detailLoading ?? false,
  );
  const mutating = useAppSelector(
    (state) => state.portfolio?.mutating ?? false,
  );

  const [draft, setDraft] = useState<DraftState>(emptyDraft);
  const [hydrated, setHydrated] = useState(!id);
  const [uploading, setUploading] = useState(false);

  const signupCategoryIds = useMemo(() => {
    if (allowedCategoryIds !== undefined) {
      return allowedCategoryIds.filter((id): id is string => Boolean(id?.trim()));
    }
    const fromProvider = authProvider?.services?.categoryIds;
    return Array.isArray(fromProvider)
      ? fromProvider.filter((id): id is string => Boolean(id?.trim()))
      : [];
  }, [allowedCategoryIds, authProvider?.services?.categoryIds]);

  const noSignupCategories = !signupCategoryIds.length;

  const parentPaging = usePaginatedCategoryOptions(
    "parents",
    !noSignupCategories,
  );
  const subPaging = usePaginatedCategoryOptions(
    draft.categoryId ? "subs" : null,
    Boolean(draft.categoryId),
    draft.categoryId || undefined,
  );

  const loadingParents = parentPaging.loading;
  const loadingMoreParents = parentPaging.loadingMore;
  const loadingSubcategories = subPaging.loading;
  const loadingMoreSubcategories = subPaging.loadingMore;
  const subcategoryHasMore = subPaging.hasMore;

  const categoryOptions = useMemo(() => {
    if (!signupCategoryIds.length) return [];

    const matched = parentPaging.categories.filter((parent) =>
      signupCategoryIds.some((signupId) =>
        parentMatchesSignupId(parent, signupId),
      ),
    );

    const list = matched.map((item) => ({ id: item.id, name: item.name }));

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
  }, [
    parentPaging.categories,
    signupCategoryIds,
    draft.categoryId,
    draft.categoryName,
  ]);

  const categoryHasMore = parentPaging.hasMore;

  const subcategoryOptions = useMemo(() => {
    const list = subPaging.options.map((item) => ({
      id: item.id,
      name: item.name,
    }));
    if (
      draft.subcategoryId &&
      !list.some((item) => item.id === draft.subcategoryId)
    ) {
      list.unshift({
        id: draft.subcategoryId,
        name: draft.subcategoryName || "Selected subcategory",
      });
    }
    return list;
  }, [subPaging.options, draft.subcategoryId, draft.subcategoryName]);

  // Keep loading parents until all signup categories are matched (or exhausted).
  useEffect(() => {
    if (!signupCategoryIds.length || loadingParents || loadingMoreParents) {
      return;
    }
    if (!categoryHasMore) return;
    if (parentPaging.search.trim()) return;

    const matchedCount = parentPaging.categories.filter((parent) =>
      signupCategoryIds.some((signupId) =>
        parentMatchesSignupId(parent, signupId),
      ),
    ).length;
    if (matchedCount >= signupCategoryIds.length) return;

    parentPaging.loadMore();
  }, [
    signupCategoryIds,
    parentPaging.categories,
    parentPaging.search,
    categoryHasMore,
    loadingParents,
    loadingMoreParents,
    parentPaging.loadMore,
  ]);

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
      categoryId: detail.categoryId,
      categoryName: detail.categoryName,
      subcategoryId: detail.subcategoryId ?? "",
      subcategoryName: detail.subcategoryName ?? "",
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

  const cover =
    draft.media.find((item) => item.isCover)?.url || draft.media[0]?.url;

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

  function buildPayload() {
    const media = draft.media
      .filter((item) => item.url.trim())
      .map((item, index, list) => ({
        url: item.url.trim(),
        type: item.type || "image",
        caption: undefined,
        isBefore: false,
        isAfter: false,
        isCover: item.isCover || (index === 0 && !list.some((m) => m.isCover)),
      }));

    return {
      title: draft.title.trim(),
      description: draft.description.trim(),
      media,
      fixedServiceIds: [] as string[],
      category: draft.categoryId || undefined,
      subcategory: draft.subcategoryId || undefined,
      tags: undefined as string[] | undefined,
      projectDate: undefined as string | undefined,
      duration: undefined as string | undefined,
      cost: undefined as number | undefined,
      isFeatured: false,
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
      <div className="grid gap-4 sm:grid-cols-2">
        <Field>
          <FieldLabel htmlFor="pf-category">Category</FieldLabel>
          <PaginatedCategorySelect
            id="pf-category"
            className="w-full"
            value={draft.categoryId}
            options={categoryOptions}
            disabled={
              noSignupCategories ||
              (loadingParents && !categoryOptions.length)
            }
            loading={loadingParents}
            loadingMore={loadingMoreParents}
            hasMore={categoryHasMore && !noSignupCategories}
            placeholder={
              noSignupCategories
                ? "No categories selected"
                : "Select category"
            }
            searchable={!noSignupCategories}
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
              }));
            }}
            onLoadMore={() => {
              if (noSignupCategories) return;
              parentPaging.loadMore();
            }}
          />
          {noSignupCategories ? (
            <p className="mt-1.5 text-xs text-muted-foreground">
              No categories on your profile yet. Add services first.
            </p>
          ) : null}
        </Field>
        <Field>
          <FieldLabel htmlFor="pf-subcategory">Subcategory</FieldLabel>
          <PaginatedCategorySelect
            id="pf-subcategory"
            className="w-full"
            value={draft.subcategoryId}
            options={subcategoryOptions}
            disabled={
              !draft.categoryId ||
              (loadingSubcategories && !subcategoryOptions.length)
            }
            loading={loadingSubcategories}
            loadingMore={loadingMoreSubcategories}
            hasMore={subcategoryHasMore}
            placeholder={
              !draft.categoryId
                ? "Select category first"
                : loadingSubcategories && !subcategoryOptions.length
                  ? "Loading subcategories…"
                  : "Select subcategory"
            }
            searchable={Boolean(draft.categoryId)}
            searchValue={subPaging.search}
            onSearchChange={subPaging.setSearch}
            searchPlaceholder="Search subcategories…"
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
    </FieldGroup>
  );

  const photosSection = (
    <>
      <p className="text-sm font-semibold">Project photos</p>
      <p className="mt-1 text-xs text-muted-foreground">
        Upload project photos.
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
        <ul className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4">
          {draft.media.map((item, index) => (
            <li
              key={`${item.url}-${index}`}
              className="group relative aspect-square overflow-hidden rounded-lg border border-input"
            >
              <Image
                src={item.url}
                alt=""
                fill
                sizes="80px"
                className="object-cover"
                unoptimized={item.url.startsWith("http")}
              />
              <button
                type="button"
                className="absolute top-1 right-1 flex size-6 items-center justify-center rounded-full bg-white text-foreground shadow-sm ring-1 ring-black/10 transition hover:bg-red-50 hover:text-red-600"
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
                <Trash2 className="size-3" />
              </button>
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
      description="Showcase a completed job with photos, category, and a short project summary."
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
          <section className="overflow-hidden rounded-2xl border border-input bg-white shadow-[0_18px_40px_-28px_rgba(0,63,125,0.45)]">
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
                {(draft.categoryName || draft.subcategoryName) && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {[draft.categoryName, draft.subcategoryName]
                      .filter(Boolean)
                      .map((label) => toTitleCase(label))
                      .join(" · ")}
                  </p>
                )}
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {draft.description.trim() ||
                    "Customer-facing project summary appears here."}
                </p>
              </div>
            </div>
          </section>
        </aside>
      </div>
    </PortalPage>
  );
}
