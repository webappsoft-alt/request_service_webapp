"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { AlertTriangle, CheckCircle2, FileText, FolderPlus, ImagePlus, Loader2, MapPin, Pencil, Plus, Search, Trash2, UserRound, X } from "lucide-react";
import { toast } from "sonner";
import { extractUploadedUrl, uploadFile } from "@/components/api/uploadFile";
import { PhotoLightbox } from "@/components/marketplace/portfolio-lightbox";
import { defaultPricingUnit, normalizePricingUnit, pricingUnitOptions } from "@/lib/pricing-units";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import { extractErrorMessage } from "@/components/api/extractErrorMessage";
import { getServiceCategoryById } from "@/lib/data/services";
import { findTemplateCategory, getEstimateTemplateCatalog } from "@/lib/api/estimate-templates-client";
import { useAppSelector } from "@/store/hooks";
import { selectAuthProvider } from "@/store/authSlice";
import {
  createAssistantEstimate,
  searchAssistantCustomers,
  type PaCustomerOption,
  type PaDraftItem,
  type PaEstimateDraft,
} from "./pro-assistant-api";

const KIND_LABEL: Record<PaDraftItem["kind"], string> = { labor: "Labor", material: "Material", equipment: "Equipment" };
const PROFILE_CATEGORIES_HREF = "/pro/dashboard/profile?step=categories";

function money2(n: number) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

type CardItem = PaDraftItem & { key: string; section: string };
type SectionGroup = { key: string; label: string; items: CardItem[]; total: number };

let keySeq = 0;
const nextKey = () => `l${++keySeq}`;
const lineTotal = (i: PaDraftItem) => money2((Number(i.quantity) || 0) * (Number(i.unitPrice) || 0));

/** Same grouping as the estimate builder (line-sections.ts): first-seen order, "" = General. */
function groupBySection(items: CardItem[]): SectionGroup[] {
  const order: string[] = [];
  const map = new Map<string, CardItem[]>();
  for (const item of items) {
    if (!map.has(item.section)) {
      map.set(item.section, []);
      order.push(item.section);
    }
    map.get(item.section)!.push(item);
  }
  return order.map((key) => {
    const list = map.get(key) || [];
    return { key, label: key || "General", items: list, total: money2(list.reduce((t, i) => t + lineTotal(i), 0)) };
  });
}

/** Section title (tap the pencil to rename), subtotal and remove. */
function SectionHeader({
  group,
  locked,
  onRename,
  onRemove,
}: {
  group: SectionGroup;
  locked: boolean;
  /** false = name taken (kept editing). */
  onRename: (name: string) => boolean;
  /** Undefined = the only section (kept). */
  onRemove?: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(group.label);
  const [taken, setTaken] = useState(false);

  function commit() {
    const next = name.trim() || "General";
    if (next === group.label) {
      setEditing(false);
      return;
    }
    if (onRename(next)) {
      setEditing(false);
      setTaken(false);
    } else setTaken(true);
  }

  return (
    <div className="flex items-center gap-1.5 border-b bg-muted/60 px-2.5 py-1.5">
      {editing ? (
        <input
          autoFocus
          value={name}
          onChange={(event) => {
            setName(event.target.value);
            setTaken(false);
          }}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              commit();
            }
            if (event.key === "Escape") {
              setName(group.label);
              setEditing(false);
              setTaken(false);
            }
          }}
          aria-label="Section name"
          aria-invalid={taken || undefined}
          title={taken ? "A section with this name already exists" : undefined}
          className={cn(
            "h-7 min-w-0 flex-1 rounded border bg-background px-2 text-xs font-semibold outline-none focus:border-primary/50",
            taken && "border-rose-400",
          )}
        />
      ) : (
        <span className="flex min-w-0 flex-1 items-center gap-1">
          <span className="truncate text-xs font-semibold text-foreground">{group.label}</span>
          <span className="shrink-0 text-[10px] text-muted-foreground">
            · {group.items.length} item{group.items.length === 1 ? "" : "s"}
          </span>
          {!locked ? (
            <button
              type="button"
              onClick={() => {
                setName(group.label);
                setEditing(true);
              }}
              aria-label={`Rename section ${group.label}`}
              className="flex size-6 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-background hover:text-foreground max-sm:size-8"
            >
              <Pencil className="size-3" />
            </button>
          ) : null}
        </span>
      )}
      <span className="shrink-0 text-xs font-semibold text-foreground tabular-nums">{formatMoney(group.total)}</span>
      {!locked && onRemove ? (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove section ${group.label}`}
          className="flex size-6 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-rose-50 hover:text-rose-600 max-sm:size-8"
        >
          <Trash2 className="size-3.5" />
        </button>
      ) : null}
    </div>
  );
}


/** Radix needs a non-empty value for the "nothing picked" option (Optional / Select category). */
const NONE_VALUE = "__none__";

/**
 * The app's dropdown (components/ui/select — same as the estimate builder), sized for the card.
 * Client: the card used the browser's native <select>. `emptyLabel` adds a first "nothing picked"
 * option that maps to "" (e.g. Sub-service "Optional"); without it "" shows the placeholder.
 */
function CardSelect({
  value,
  onChange,
  options,
  ariaLabel,
  placeholder,
  emptyLabel,
  disabled,
  triggerClassName,
}: {
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  ariaLabel: string;
  placeholder?: string;
  emptyLabel?: string;
  disabled?: boolean;
  triggerClassName?: string;
}) {
  const current = value ? value : emptyLabel ? NONE_VALUE : undefined;
  return (
    <Select value={current} disabled={disabled} onValueChange={(next) => onChange(next === NONE_VALUE ? "" : next)}>
      <SelectTrigger
        size="sm"
        aria-label={ariaLabel}
        className={cn(
          "w-full min-w-0 justify-between gap-1 text-xs [&_svg:not([class*='size-'])]:size-3.5 *:data-[slot=select-value]:truncate",
          triggerClassName,
        )}
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      {/* Above the co-pilot panel (z-index 61); data-lenis-prevent so the list scrolls, not the page. */}
      <SelectContent position="popper" align="start" className="z-[100] min-w-[var(--radix-select-trigger-width)]" data-lenis-prevent>
        {emptyLabel ? (
          <SelectItem value={NONE_VALUE} className="text-xs">
            {emptyLabel}
          </SelectItem>
        ) : null}
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value} className="text-xs">
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/**
 * Wide card: one table row per line, the same columns as the Manual Estimate Builder
 * (Description · Type · Qty · Unit · Rate · Total). Narrow card: two rows.
 */
const WIDE_LINE_GRID = "@2xl:grid-cols-[minmax(0,1fr)_6.5rem_4.25rem_6.75rem_6.5rem_5.5rem_1.75rem]";

/** Same as the builder: a material line carries one photo (stored on the estimate line). */
const MAX_LINE_IMAGES = 1;

/** One editable line: description (+ material photo), type, qty, unit (12 units), rate, total. */
function DraftLineRow({
  item,
  label,
  locked,
  canRemove,
  divider,
  onChange,
  onRemove,
}: {
  item: CardItem;
  label: string;
  locked: boolean;
  canRemove: boolean;
  divider: boolean;
  onChange: (patch: Partial<PaDraftItem>) => void;
  onRemove: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const unit = normalizePricingUnit(item.unit, defaultPricingUnit(item.kind));
  const isMaterial = item.kind === "material";
  const image = isMaterial ? (item.images ?? [])[0] : undefined;

  async function onUpload(files: FileList | null) {
    const file = files?.[0];
    if (!file || locked) return;
    setUploading(true);
    try {
      const response = await uploadFile(file);
      const url = extractUploadedUrl(response.data);
      if (!url) {
        toast.error("Could not upload material image.");
        return;
      }
      onChange({ images: [url] });
      toast.success("Material image uploaded.");
    } catch (err) {
      toast.error((err as { message?: string })?.message || "Could not upload material image.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const removeButton = (className: string) =>
    !locked && canRemove ? (
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${label}`}
        className={cn("items-center justify-center rounded text-muted-foreground hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10", className)}
      >
        <Trash2 className="size-3.5" />
      </button>
    ) : null;

  return (
    <div
      className={cn(
        "flex flex-col gap-1.5 px-2.5 py-2 @2xl:grid @2xl:items-start @2xl:gap-2 @2xl:py-1.5",
        WIDE_LINE_GRID,
        divider && "border-t",
      )}
    >
      <div className="flex items-start gap-1.5 @2xl:contents">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <textarea
            value={item.description}
            disabled={locked}
            rows={1}
            placeholder="Title / description of the work or material"
            onChange={(event) => onChange({ description: event.target.value })}
            aria-label={`${label} description`}
            className="min-h-7 min-w-0 resize-none rounded border border-transparent bg-transparent px-1 py-1 text-xs leading-snug font-medium outline-none [field-sizing:content] placeholder:font-normal placeholder:text-muted-foreground/70 hover:border-border focus:border-primary/50 focus:bg-background"
          />
          {/* Material photo — same as the builder's "+ Add image" (upload, preview, replace, remove). */}
          {isMaterial ? (
            <div className="flex flex-wrap items-center gap-1.5 px-1">
              {image ? (
                <span className="relative inline-block">
                  <button
                    type="button"
                    onClick={() => setLightboxOpen(true)}
                    title="View full image"
                    aria-label={`View ${label} image`}
                    className="relative block h-8 w-11 overflow-hidden rounded border bg-white"
                  >
                    <Image
                      src={image}
                      alt="Material photo"
                      fill
                      sizes="44px"
                      className="object-cover"
                      unoptimized={/^(https?:|data:|blob:)/i.test(image.trim())}
                    />
                  </button>
                  {!locked ? (
                    <button
                      type="button"
                      onClick={() => onChange({ images: [] })}
                      aria-label={`Remove ${label} image`}
                      className="absolute -top-1.5 -right-1.5 flex size-4 items-center justify-center rounded-full bg-background text-foreground ring-1 ring-border"
                    >
                      <X className="size-2.5" />
                    </button>
                  ) : null}
                </span>
              ) : null}
              {!locked ? (
                <>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    aria-label={`${label} image file`}
                    onChange={(event) => void onUpload(event.target.files)}
                  />
                  <button
                    type="button"
                    disabled={uploading}
                    onClick={() => fileRef.current?.click()}
                    className="inline-flex h-6 items-center gap-1 rounded px-1 text-[11px] font-medium text-primary hover:bg-primary/5 disabled:opacity-60 max-sm:h-8"
                  >
                    {uploading ? <Loader2 className="size-3 animate-spin" /> : <ImagePlus className="size-3" />}
                    {uploading ? "Uploading…" : image ? "Replace image" : "Add image"}
                  </button>
                </>
              ) : null}
              <PhotoLightbox
                photos={image ? [{ src: image, alt: "Material photo" }] : []}
                title="Material image"
                open={lightboxOpen && Boolean(image)}
                onOpenChange={setLightboxOpen}
                index={0}
                onIndexChange={() => undefined}
              />
            </div>
          ) : null}
        </div>
        <div className="mt-0.5 w-[6.5rem] shrink-0 @2xl:w-full">
          <CardSelect
            value={item.kind}
            disabled={locked}
            onChange={(next) => {
              const kind = next as PaDraftItem["kind"];
              // Builder rule: only material lines keep a photo.
              onChange({ kind, ...(kind === "material" ? {} : { images: [] }) });
            }}
            options={(Object.keys(KIND_LABEL) as PaDraftItem["kind"][]).map((k) => ({ value: k, label: KIND_LABEL[k] }))}
            ariaLabel={`${label} type`}
            triggerClassName={cn(
              "h-7! rounded-full border-0 px-2.5 text-[11px] font-medium",
              item.kind === "labor"
                ? "bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300"
                : item.kind === "material"
                  ? "bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-300"
                  : "bg-muted text-muted-foreground",
            )}
          />
        </div>
        {/* Narrow card: remove sits on the first row. */}
        {removeButton("-mt-0.5 flex size-6 shrink-0 max-sm:size-9 @2xl:hidden")}
      </div>
      <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground @2xl:contents">
        <label className="flex shrink-0 items-center gap-1 @2xl:mt-0.5 @2xl:block">
          <span className="@2xl:hidden">Qty</span>
          <input
            type="number"
            min={0.01}
            step="any"
            value={item.quantity}
            disabled={locked}
            onChange={(event) => onChange({ quantity: Number(event.target.value) })}
            aria-label={`${label} quantity`}
            className="h-7 w-14 rounded border bg-background px-1.5 text-right text-xs text-foreground tabular-nums outline-none focus:border-primary/50 @2xl:w-full"
          />
        </label>
        <div className="w-[6.75rem] shrink-0 @2xl:mt-0.5 @2xl:w-full">
          <CardSelect
            value={unit}
            disabled={locked}
            onChange={(next) => onChange({ unit: next })}
            options={pricingUnitOptions(unit)}
            ariaLabel={`${label} unit`}
            triggerClassName="h-7! rounded px-1.5 text-foreground"
          />
        </div>
        <span className="@2xl:hidden">×</span>
        <span className="relative @2xl:mt-0.5">
          <span className="pointer-events-none absolute top-1/2 left-1.5 -translate-y-1/2 text-xs">$</span>
          <input
            type="number"
            min={0}
            step="0.01"
            value={item.unitPrice}
            disabled={locked}
            onChange={(event) => onChange({ unitPrice: Number(event.target.value) })}
            aria-label={`${label} unit price`}
            className="h-7 w-20 rounded border bg-background pr-1.5 pl-4 text-right text-xs text-foreground tabular-nums outline-none focus:border-primary/50 @2xl:w-full"
          />
        </span>
        <span className="ml-auto shrink-0 text-xs font-semibold text-foreground tabular-nums @2xl:mt-1.5 @2xl:ml-0 @2xl:text-right">
          {formatMoney(lineTotal(item))}
        </span>
        {/* Wide card: remove is the last column. */}
        {removeButton("hidden size-7 @2xl:flex") ?? <span className="hidden @2xl:block" />}
      </div>
    </div>
  );
}

/**
 * Pick one of the Pro's customers — the same list as the Customers tab, 20 at a time; scrolling to
 * the bottom loads more, typing searches.
 */
function CustomerPicker({
  value,
  initialQuery,
  onChange,
  disabled,
}: {
  value: PaCustomerOption | null;
  initialQuery: string;
  onChange: (customer: PaCustomerOption | null) => void;
  disabled?: boolean;
}) {
  const [query, setQuery] = useState(initialQuery);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<PaCustomerOption[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [total, setTotal] = useState(0);
  const requestRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  function load(term: string, nextPage: number) {
    const request = ++requestRef.current;
    setLoading(true);
    searchAssistantCustomers(term, nextPage)
      .then((res) => {
        if (request !== requestRef.current) return;
        setItems((prev) => {
          const base = nextPage === 1 ? [] : prev;
          const seen = new Set(base.map((c) => c.id));
          return [...base, ...res.items.filter((c) => !seen.has(c.id))];
        });
        setPage(nextPage);
        setHasMore(res.hasMore);
        setTotal(res.total);
      })
      .catch(() => {
        if (request === requestRef.current) setHasMore(false);
      })
      .finally(() => {
        if (request === requestRef.current) setLoading(false);
      });
  }

  if (value) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-lg border bg-background px-2.5 py-1.5">
        <span className="flex min-w-0 items-center gap-2">
          <UserRound className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
          <span className="min-w-0">
            <span className="block truncate text-xs font-semibold">{value.name}</span>
            {value.subtitle ? <span className="block truncate text-[11px] text-muted-foreground">{value.subtitle}</span> : null}
          </span>
        </span>
        {!disabled ? (
          <button type="button" onClick={() => onChange(null)} aria-label="Change customer" className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground">
            <X className="size-3.5" />
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="flex items-center gap-1.5 rounded-lg border bg-background px-2.5">
        <Search className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
        <input
          value={query}
          disabled={disabled}
          onFocus={() => {
            setOpen(true);
            if (page === 0) load(query, 1);
          }}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onChange={(event) => {
            const next = event.target.value;
            setQuery(next);
            setOpen(true);
            if (timerRef.current) clearTimeout(timerRef.current);
            timerRef.current = setTimeout(() => load(next, 1), 250);
          }}
          placeholder="Search your customers…"
          aria-label="Customer for this estimate"
          className="h-8 min-w-0 flex-1 bg-transparent text-xs outline-none"
        />
        {loading ? <Loader2 className="size-3.5 animate-spin text-muted-foreground" /> : null}
      </div>
      {open ? (
        <div
          role="listbox"
          aria-label="Customers"
          onScroll={(event) => {
            const el = event.currentTarget;
            if (hasMore && !loading && el.scrollTop + el.clientHeight >= el.scrollHeight - 24) load(query, page + 1);
          }}
          className="absolute inset-x-0 top-full z-20 mt-1 max-h-56 overflow-y-auto rounded-lg border bg-popover shadow-lg"
        >
          {items.map((c) => (
            <button
              key={c.id}
              type="button"
              role="option"
              aria-selected={false}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                onChange(c);
                setOpen(false);
              }}
              className="flex w-full items-center justify-between gap-2 px-2.5 py-1.5 text-left hover:bg-muted"
            >
              <span className="min-w-0">
                <span className="block truncate text-xs font-medium">{c.name}</span>
                {c.subtitle ? <span className="block truncate text-[11px] text-muted-foreground">{c.subtitle}</span> : null}
              </span>
              {c.hasAddress === false ? <span className="shrink-0 text-[10px] text-amber-700">No address</span> : null}
            </button>
          ))}
          {loading ? (
            <p className="px-2.5 py-2 text-[11px] text-muted-foreground">{items.length ? "Loading more…" : "Loading…"}</p>
          ) : !items.length ? (
            <p className="px-2.5 py-2 text-[11px] text-muted-foreground">No customers match.</p>
          ) : (
            <p className="border-t px-2.5 py-1.5 text-[10px] text-muted-foreground">
              {items.length} of {total} customers{hasMore ? " · scroll for more" : ""}
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}

/**
 * AI-drafted estimate in the chat. Same details as the portal's Create estimate — customer,
 * property, service category (required), sub-service — plus editable line items and notes.
 * "Create estimate" goes through the existing estimate services (flow unchanged).
 */
export function EstimateDraftCard({
  draft,
  created,
  onCreated,
  conversationId,
  messageId,
  initialCustomer = null,
  onCustomerChange,
}: {
  draft: PaEstimateDraft;
  /** Customer picked on an earlier version of this draft (kept when it is changed in chat). */
  initialCustomer?: PaCustomerOption | null;
  onCustomerChange?: (customer: PaCustomerOption | null) => void;
  created: { href: string; number: string } | null | undefined;
  onCreated: (result: { href: string; number: string }) => void;
  /** Saved chat + message this draft belongs to (marked "created" in history). */
  conversationId?: string | null;
  messageId?: string;
}) {
  const authProvider = useAppSelector(selectAuthProvider);
  const categoryIds = authProvider?.services?.categoryIds;
  // The Pro's own service categories (same list as Create estimate).
  const providerCategories = useMemo(() => {
    const ids = Array.isArray(categoryIds) ? categoryIds : [];
    const seen = new Set<string>();
    const list: Array<{ id: string; name: string }> = [];
    for (const id of ids) {
      const category = getServiceCategoryById(String(id));
      const name = (category?.name || category?.shortName || "").trim();
      if (!name || seen.has(name.toLowerCase())) continue;
      seen.add(name.toLowerCase());
      list.push({ id: String(id), name });
    }
    return list;
  }, [categoryIds]);

  // Category the AI read from the scope → the matching one of the Pro's categories (else the only one).
  const suggestedCategory = useMemo(() => {
    const hint = String(draft.serviceCategory || "").trim().toLowerCase();
    if (hint) {
      const match = providerCategories.find(
        (c) => c.name.toLowerCase() === hint || c.name.toLowerCase().includes(hint) || hint.includes(c.name.toLowerCase()),
      );
      if (match) return match.name;
    }
    return providerCategories.length === 1 ? providerCategories[0].name : "";
  }, [draft.serviceCategory, providerCategories]);

  const [title, setTitle] = useState(draft.title);
  // Previous: useState(draft.customer) — a customer tapped on the card was lost on the next chat edit.
  const [customer, setCustomerState] = useState<PaCustomerOption | null>(draft.customer || initialCustomer || null);
  const setCustomer = (next: PaCustomerOption | null) => {
    setCustomerState(next);
    onCustomerChange?.(next);
  };
  const [addressId, setAddressId] = useState("");
  const [categoryName, setCategoryName] = useState<string | null>(null);
  const [subcategoryName, setSubcategoryName] = useState("");
  // Lines keep a local key (stable React keys while sections are added / removed / renamed).
  const [items, setItems] = useState<CardItem[]>(() =>
    draft.items.map(({ description, kind, quantity, unit, unitPrice, section, images }) => ({
      key: nextKey(),
      description,
      kind,
      quantity,
      unit,
      unitPrice,
      section: String(section || "").trim(),
      images: kind === "material" && Array.isArray(images) ? images.slice(0, MAX_LINE_IMAGES) : [],
    })),
  );
  const groups = useMemo(() => groupBySection(items), [items]);
  const [newSection, setNewSection] = useState("");
  const [notes, setNotes] = useState(draft.notes);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [catalog, setCatalog] = useState<Awaited<ReturnType<typeof getEstimateTemplateCatalog>>>([]);
  const locked = Boolean(created) || saving;
  const category = categoryName ?? suggestedCategory;

  // Sub-services (offered jobs) for the category — same catalog as Create estimate.
  useEffect(() => {
    let cancelled = false;
    getEstimateTemplateCatalog()
      .then((rows) => {
        if (!cancelled) setCatalog(rows);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);
  const subcategoryOptions = useMemo(() => findTemplateCategory(catalog, category)?.subcategories || [], [catalog, category]);
  const validSubcategory = subcategoryOptions.some((s) => s.name === subcategoryName) ? subcategoryName : "";

  const addresses = customer?.addresses || [];
  const selectedAddressId = addresses.some((a) => a.id === addressId) ? addressId : addresses[0]?.id || "";

  const total = useMemo(() => money2(items.reduce((t, i) => t + (Number(i.quantity) || 0) * (Number(i.unitPrice) || 0), 0)), [items]);
  const validItems = items.filter((i) => i.description.trim() && Number(i.quantity) > 0);
  const missing = !customer
    ? "Pick a customer to create"
    : customer.hasAddress === false
      ? "Customer needs a service address"
      : !category
        ? "Pick a service category"
        : !validItems.length
          ? "Add a line item"
          : !title.trim()
            ? "Add a title"
            : null;

  function update(key: string, patch: Partial<PaDraftItem>) {
    setItems((prev) => prev.map((item) => (item.key === key ? { ...item, ...patch } : item)));
  }

  /** New line at the end of its section (sections stay together, like the estimate builder). */
  function addItem(section: string, kind: PaDraftItem["kind"] = "labor") {
    setItems((prev) => {
      const line: CardItem = { key: nextKey(), description: "", kind, quantity: 1, unit: defaultPricingUnit(kind), unitPrice: 0, section, images: [] };
      const last = prev.map((i) => i.section).lastIndexOf(section);
      return last < 0 ? [...prev, line] : [...prev.slice(0, last + 1), line, ...prev.slice(last + 1)];
    });
  }

  const sectionTaken = (name: string, except?: string) => {
    const wanted = name.trim().replace(/\s+/g, " ").toLowerCase();
    return groups.some((g) => g.key !== except && (g.key.toLowerCase() === wanted || (!g.key && wanted === "general")));
  };
  const newSectionTaken = Boolean(newSection.trim()) && sectionTaken(newSection);

  function addSection() {
    const name = newSection.trim().replace(/\s+/g, " ").slice(0, 60);
    if (!name || newSectionTaken) return;
    addItem(name.toLowerCase() === "general" ? "" : name);
    setNewSection("");
  }

  function renameSection(from: string, to: string) {
    const next = to.trim().replace(/\s+/g, " ").slice(0, 60);
    const target = next.toLowerCase() === "general" ? "" : next;
    if (target === from || sectionTaken(target || "general", from)) return false;
    setItems((prev) => prev.map((i) => (i.section === from ? { ...i, section: target } : i)));
    return true;
  }

  async function create() {
    if (missing || !customer) return;
    setSaving(true);
    setError(null);
    try {
      const result = await createAssistantEstimate({
        customerId: customer.id,
        title: title.trim(),
        notes: notes.trim(),
        // Section by section (same order as the card) → the builder shows the same sections.
        items: groups.flatMap((g) =>
          g.items
            .filter((i) => i.description.trim() && Number(i.quantity) > 0)
            .map(({ description, kind, quantity, unit, unitPrice, images }) => ({
              description,
              kind,
              unit,
              quantity: money2(quantity),
              unitPrice: money2(unitPrice),
              section: g.key,
              // Material photos go onto the created estimate's lines (same field as the builder).
              ...(kind === "material" && images?.length ? { images: images.slice(0, MAX_LINE_IMAGES) } : {}),
            })),
        ),
        addressId: selectedAddressId || undefined,
        categoryName: category,
        subcategoryName: validSubcategory || undefined,
        conversationId: conversationId || null,
        messageId,
      });
      onCreated({ href: result.href, number: result.number });
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="w-full overflow-hidden rounded-xl border bg-card shadow-sm">
      <div className="flex items-center gap-2 border-b bg-linear-to-r from-primary/[0.07] to-transparent px-3 py-2">
        <span className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <FileText className="size-4" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">Draft estimate</p>
          <input
            value={title}
            disabled={locked}
            onChange={(event) => setTitle(event.target.value)}
            aria-label="Estimate title"
            className="w-full truncate bg-transparent text-sm font-semibold outline-none disabled:opacity-100"
          />
        </div>
      </div>

      {/* How the AI priced it (site-photo estimates): market, pricing history, dimensions. */}
      {draft.pricing?.label ? (
        <p
          className="flex items-start gap-1.5 border-b bg-muted/40 px-3 py-1.5 text-[11px] leading-4 text-muted-foreground"
          title="Every line, quantity and rate stays editable"
        >
          <MapPin className="mt-px size-3 shrink-0 text-primary" aria-hidden />
          <span>
            {draft.pricing.label}
            <span className="text-muted-foreground/70"> · edit anything below</span>
          </span>
        </p>
      ) : null}

      <div className="flex flex-col gap-2.5 p-3">
        <div className="flex flex-col gap-1">
          <span className="text-[11px] font-medium text-muted-foreground">Customer</span>
          <CustomerPicker
            value={customer}
            initialQuery={draft.customerName || ""}
            onChange={(next) => {
              setCustomer(next);
              setAddressId("");
            }}
            disabled={locked}
          />
          {/* Several customers match the name the Pro said → one tap to link the right one. */}
          {!customer && draft.customerCandidates?.length ? (
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Matching customers">
              {draft.customerCandidates.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  disabled={locked}
                  onClick={() => {
                    setCustomer(c);
                    setAddressId("");
                  }}
                  className="inline-flex max-w-full items-center gap-1.5 rounded-full border bg-background px-2.5 py-1 text-xs font-medium transition hover:border-primary/40 hover:bg-primary/5 hover:text-primary max-sm:min-h-9"
                  title={c.subtitle || undefined}
                >
                  <UserRound className="size-3.5 shrink-0" aria-hidden />
                  <span className="truncate">{c.name}</span>
                </button>
              ))}
            </div>
          ) : null}
          {draft.customerName && !draft.customer && !customer ? (
            <p className="text-[11px] text-muted-foreground">
              {draft.customerCandidates?.length
                ? `Tap the right “${draft.customerName}”, or search another customer.`
                : `Pick the right “${draft.customerName}”, or search another customer.`}
            </p>
          ) : null}
          {customer?.hasAddress === false ? (
            <p className="text-[11px] text-amber-700">
              This customer has no service address —{" "}
              <Link href={`/pro/dashboard/customers/${customer.id}`} className="font-semibold underline underline-offset-2">
                add one
              </Link>{" "}
              first.
            </p>
          ) : null}
        </div>

        {customer && addresses.length ? (
          <div className="flex flex-col gap-1">
            <span className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
              <MapPin className="size-3" aria-hidden /> Property
            </span>
            <CardSelect
              value={selectedAddressId}
              disabled={locked || addresses.length === 1}
              onChange={setAddressId}
              options={addresses.map((a) => ({ value: a.id, label: `${a.label ? `${a.label} — ` : ""}${a.line || "Address"}` }))}
              ariaLabel="Property address"
            />
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-2">
          <div className="flex min-w-0 flex-col gap-1">
            <span className="text-[11px] font-medium text-muted-foreground">Service category *</span>
            {providerCategories.length ? (
              <CardSelect
                value={category}
                disabled={locked}
                onChange={(next) => {
                  setCategoryName(next);
                  setSubcategoryName("");
                }}
                options={providerCategories.map((c) => ({ value: c.name, label: c.name }))}
                placeholder="Select category"
                ariaLabel="Service category"
              />
            ) : (
              <Link href={PROFILE_CATEGORIES_HREF} className="text-[11px] font-semibold text-primary underline underline-offset-2">
                Set your service categories first
              </Link>
            )}
          </div>
          <div className="flex min-w-0 flex-col gap-1">
            <span className="text-[11px] font-medium text-muted-foreground">Sub-service</span>
            <CardSelect
              value={validSubcategory}
              disabled={locked || !subcategoryOptions.length}
              onChange={setSubcategoryName}
              options={subcategoryOptions.map((sub) => ({ value: sub.name, label: sub.name }))}
              emptyLabel={category ? (subcategoryOptions.length ? "Optional" : "None listed") : "Pick a category first"}
              ariaLabel="Sub-service"
            />
          </div>
        </div>

        {/* Line items by work / trade section (same `section` field as the estimate builder).
            Previous: one flat "Line items" list. The card is a size container: in the expanded
            co-pilot each line is one table row (description · type · qty · rate · total). */}
        <div className="@container flex flex-col gap-2">
          <div className="flex items-center justify-between px-0.5 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
            <span>Line items by section</span>
            <span>
              {groups.length} section{groups.length === 1 ? "" : "s"} · {items.length} item{items.length === 1 ? "" : "s"}
            </span>
          </div>

          {groups.map((group) => (
            <section key={group.key || "__general"} aria-label={`${group.label} section`} className="overflow-hidden rounded-lg border bg-background">
              <SectionHeader
                group={group}
                locked={locked}
                onRename={(name) => renameSection(group.key, name)}
                onRemove={groups.length > 1 ? () => setItems((prev) => prev.filter((i) => i.section !== group.key)) : undefined}
              />
              {/* Column labels (wide card only) — same columns as the Manual Estimate Builder. */}
              <div className={cn("hidden border-b px-2.5 py-1 text-[10px] font-medium text-muted-foreground @2xl:grid @2xl:gap-2", WIDE_LINE_GRID)}>
                <span>Description</span>
                <span>Type</span>
                <span className="text-right">Qty</span>
                <span>Unit</span>
                <span className="text-right">Rate</span>
                <span className="text-right">Total</span>
                <span />
              </div>
              {group.items.map((item, index) => (
                <DraftLineRow
                  key={item.key}
                  item={item}
                  label={`${group.label} line ${index + 1}`}
                  locked={locked}
                  canRemove={items.length > 1}
                  divider={index > 0}
                  onChange={(patch) => update(item.key, patch)}
                  onRemove={() => setItems((prev) => prev.filter((i) => i.key !== item.key))}
                />
              ))}
              <div className="flex flex-wrap items-center justify-between gap-2 border-t bg-muted/30 px-2.5 py-1.5">
                {!locked ? (
                  <span className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={() => addItem(group.key, "labor")}
                      className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline max-sm:min-h-9 max-sm:text-xs"
                      aria-label={`Add labor item to ${group.label}`}
                    >
                      <Plus className="size-3" /> Add item
                    </button>
                    <button
                      type="button"
                      onClick={() => addItem(group.key, "material")}
                      className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-primary hover:underline max-sm:min-h-9 max-sm:text-xs"
                      aria-label={`Add material to ${group.label}`}
                    >
                      <Plus className="size-3" /> Material
                    </button>
                  </span>
                ) : (
                  <span />
                )}
                <span className="text-[11px] text-muted-foreground">
                  {group.label} subtotal{" "}
                  <span className="font-semibold text-foreground tabular-nums">{formatMoney(group.total)}</span>
                </span>
              </div>
            </section>
          ))}

          {!locked ? (
            <div className="flex items-center gap-1.5">
              <div className="flex min-w-0 flex-1 items-center gap-1.5 rounded-lg border border-dashed bg-background px-2.5">
                <FolderPlus className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                <input
                  value={newSection}
                  onChange={(event) => setNewSection(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      addSection();
                    }
                  }}
                  placeholder="New section (e.g. Electrical)"
                  aria-label="New section name"
                  aria-invalid={newSectionTaken || undefined}
                  className="h-8 min-w-0 flex-1 bg-transparent text-xs outline-none max-sm:h-9"
                />
              </div>
              <button
                type="button"
                onClick={addSection}
                disabled={!newSection.trim() || newSectionTaken}
                className="inline-flex h-8 shrink-0 items-center gap-1 rounded-lg border bg-background px-2.5 text-[11px] font-semibold text-primary transition hover:border-primary/40 hover:bg-primary/5 disabled:opacity-50 max-sm:h-9"
              >
                <Plus className="size-3" /> Add section
              </button>
            </div>
          ) : null}
          {newSectionTaken ? <p className="text-[11px] text-rose-600">A section with this name already exists.</p> : null}

          <div className="flex items-center justify-between rounded-lg bg-muted/50 px-2.5 py-2">
            <span className="text-[11px] text-muted-foreground">
              {groups.length > 1 ? `${groups.length} sections` : "Estimate"} total
            </span>
            <span className="text-sm font-semibold tabular-nums">{formatMoney(total)}</span>
          </div>
        </div>

        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-medium text-muted-foreground">Scope notes for the customer</span>
          <textarea
            value={notes}
            disabled={locked}
            rows={2}
            onChange={(event) => setNotes(event.target.value)}
            className="resize-none rounded-lg border bg-background px-2.5 py-1.5 text-xs outline-none focus:border-primary/50"
          />
        </label>

        {error ? (
          <p className="flex items-start gap-1.5 rounded-md bg-rose-50 px-2.5 py-1.5 text-[11px] text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            {error}
          </p>
        ) : null}

        {created ? (
          <div className="flex items-center justify-between gap-2 rounded-lg bg-emerald-50 px-2.5 py-2 text-xs text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300">
            <span className="inline-flex items-center gap-1.5 font-medium">
              <CheckCircle2 className="size-4" aria-hidden />
              Estimate {created.number || ""} created
            </span>
            <Link href={created.href} className="font-semibold underline underline-offset-2">
              Open
            </Link>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => void create()}
            disabled={saving || Boolean(missing)}
            className={cn(
              "inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50",
            )}
          >
            {saving ? <Loader2 className="size-3.5 animate-spin" /> : <CheckCircle2 className="size-3.5" />}
            {saving ? "Creating…" : missing || "Create estimate"}
          </button>
        )}
      </div>
    </div>
  );
}
