"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { FileStack, LayoutTemplate, Loader2, PencilLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  resolveEstimateTemplate,
  type EstimateTemplate,
  type EstimateTemplateCategory,
  type EstimateTemplateItem,
} from "@/lib/api/estimate-templates-client";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";

export const PROFILE_CATEGORIES_HREF = "/pro/dashboard/settings";

const KIND_LABEL: Record<EstimateTemplateItem["kind"], string> = {
  labor: "Labour",
  material: "Material",
  equipment: "Equipment",
};

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

/** Read-only table of a template's lines, grouped by trade, with cost totals. */
export function TemplatePreviewTable({
  items,
  className,
}: {
  items: EstimateTemplateItem[];
  className?: string;
}) {
  const groups = useMemo(() => {
    const map = new Map<string, EstimateTemplateItem[]>();
    for (const item of items) {
      const key = item.section || "General";
      map.set(key, [...(map.get(key) || []), item]);
    }
    return [...map];
  }, [items]);
  const totals = useMemo(() => {
    const sum = { labor: 0, material: 0, equipment: 0, hours: 0 };
    for (const item of items) {
      sum[item.kind] +=
        (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0);
      if (item.kind === "labor") sum.hours += Number(item.quantity) || 0;
    }
    return sum;
  }, [items]);

  if (!items.length) {
    return (
      <p className="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
        No line items.
      </p>
    );
  }

  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border border-[#b4becc]",
        className,
      )}
    >
      <div className="max-h-[22rem] overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-[#f7f8fa] text-[11px] tracking-[0.08em] text-slate-500 uppercase">
            <tr>
              <th className="px-3 py-2 text-left font-semibold">Description</th>
              <th className="px-2 py-2 text-left font-semibold">Type</th>
              <th className="px-2 py-2 text-right font-semibold">Qty</th>
              <th className="px-2 py-2 text-right font-semibold">Price</th>
              <th className="px-3 py-2 text-right font-semibold">Total</th>
            </tr>
          </thead>
          <tbody>
            {groups.map(([section, rows]) => (
              <SectionRows key={section} section={section} rows={rows} />
            ))}
          </tbody>
        </table>
      </div>
      <div className="grid gap-x-6 gap-y-1 border-t border-[#b4becc] bg-[#f8fafc] px-3 py-2.5 text-xs sm:grid-cols-5">
        <span className="text-slate-500">
          Labour{" "}
          <span className="font-semibold text-slate-800 tabular-nums">
            {formatMoney(round2(totals.labor))}
          </span>
        </span>
        <span className="text-slate-500">
          Hours{" "}
          <span className="font-semibold text-slate-800 tabular-nums">
            {round2(totals.hours)}
          </span>
        </span>
        <span className="text-slate-500">
          Material{" "}
          <span className="font-semibold text-slate-800 tabular-nums">
            {formatMoney(round2(totals.material))}
          </span>
        </span>
        <span className="text-slate-500">
          Equipment{" "}
          <span className="font-semibold text-slate-800 tabular-nums">
            {formatMoney(round2(totals.equipment))}
          </span>
        </span>
        <span className="font-semibold text-slate-900 sm:text-right">
          Total{" "}
          {formatMoney(
            round2(totals.labor + totals.material + totals.equipment),
          )}
        </span>
      </div>
    </div>
  );
}

function SectionRows({
  section,
  rows,
}: {
  section: string;
  rows: EstimateTemplateItem[];
}) {
  return (
    <>
      <tr className="border-t border-[#e2e8f0] bg-white">
        <td
          colSpan={5}
          className="px-3 pt-2.5 pb-1 text-xs font-semibold text-slate-700"
        >
          {section}
        </td>
      </tr>
      {rows.map((item, index) => (
        <tr key={`${section}-${index}`} className="bg-white">
          <td className="px-3 py-1.5 text-slate-800">{item.description}</td>
          <td className="px-2 py-1.5 text-slate-500">
            {KIND_LABEL[item.kind]}
          </td>
          <td className="px-2 py-1.5 text-right whitespace-nowrap text-slate-600 tabular-nums">
            {item.quantity} {item.unit}
          </td>
          <td className="px-2 py-1.5 text-right text-slate-600 tabular-nums">
            {formatMoney(item.unitPrice)}
          </td>
          <td className="px-3 py-1.5 text-right font-medium text-slate-900 tabular-nums">
            {formatMoney(round2(item.quantity * item.unitPrice))}
          </td>
        </tr>
      ))}
    </>
  );
}

export function TemplateSourceBadge({
  source,
}: {
  source: EstimateTemplate["source"];
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-[0.06em] uppercase ring-1 ring-inset",
        source === "custom"
          ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
          : "bg-slate-50 text-slate-600 ring-slate-200",
      )}
    >
      {source === "custom" ? "Your template" : "Platform default"}
    </span>
  );
}

/** Category + subcategory pickers limited to the provider's Business-profile services. */
function CategoryPickers({
  catalog,
  categoryKey,
  subcategoryName,
  onCategory,
  onSubcategory,
  disabled,
}: {
  catalog: EstimateTemplateCategory[];
  categoryKey: string;
  subcategoryName: string;
  onCategory: (key: string) => void;
  onSubcategory: (name: string) => void;
  disabled?: boolean;
}) {
  const category = catalog.find((row) => row.categoryKey === categoryKey);
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="space-y-1.5">
        <Label>Category</Label>
        <Select
          value={categoryKey || undefined}
          onValueChange={onCategory}
          disabled={disabled}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select category" />
          </SelectTrigger>
          <SelectContent>
            {catalog.map((row) => (
              <SelectItem key={row.categoryKey} value={row.categoryKey}>
                {row.categoryName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label>Subcategory</Label>
        <Select
          value={subcategoryName || undefined}
          onValueChange={onSubcategory}
          disabled={disabled || !category}
        >
          <SelectTrigger className="w-full">
            <SelectValue
              placeholder={
                category ? "Select subcategory" : "Pick a category first"
              }
            />
          </SelectTrigger>
          <SelectContent>
            {(category?.subcategories || []).map((sub) => (
              <SelectItem key={sub.name} value={sub.name}>
                {sub.name}
                {sub.hasCustom ? " · yours" : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

function NoCategories() {
  return (
    <p className="rounded-lg border border-dashed px-4 py-5 text-center text-sm text-muted-foreground">
      No service categories on your Business profile yet.{" "}
      <Link
        href={PROFILE_CATEGORIES_HREF}
        className="font-medium text-primary hover:underline"
      >
        Set them up
      </Link>{" "}
      to use ready-made templates.
    </p>
  );
}

/**
 * "Create estimate now" → Manual sheet or Ready-made template.
 * With a known category + subcategory the template loads straight away;
 * otherwise the provider picks one (restricted to their offered services).
 */
type StartDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** null while loading. */
  catalog: EstimateTemplateCategory[] | null;
  defaultCategoryKey?: string;
  defaultSubcategory?: string;
  /** Skip the Manual / Template choice (e.g. the "Use template" button). */
  startOnTemplates?: boolean;
  /** Line items already exist and will be replaced by the template. */
  replacesLines?: boolean;
  onManual: () => void;
  onApply: (template: EstimateTemplate) => void;
};

/** The default category + subcategory, when both are on the provider's catalog. */
function matchDefault(
  catalog: EstimateTemplateCategory[] | null,
  categoryKey?: string,
  subcategory?: string,
) {
  const category = catalog?.find((row) => row.categoryKey === categoryKey);
  const sub = category?.subcategories.find(
    (row) =>
      row.name.toLowerCase() ===
      String(subcategory || "")
        .trim()
        .toLowerCase(),
  );
  return {
    categoryKey: category?.categoryKey || "",
    subcategoryName: sub?.name || "",
  };
}

export function EstimateStartDialog(props: StartDialogProps) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      {/* Mounted per open, so every open starts from the current defaults. */}
      {props.open ? <StartDialogBody {...props} /> : null}
    </Dialog>
  );
}

function StartDialogBody({
  onOpenChange,
  catalog,
  defaultCategoryKey,
  defaultSubcategory,
  startOnTemplates = false,
  replacesLines = false,
  onManual,
  onApply,
}: StartDialogProps) {
  const validDefault = useMemo(
    () => matchDefault(catalog, defaultCategoryKey, defaultSubcategory),
    [catalog, defaultCategoryKey, defaultSubcategory],
  );
  const [step, setStep] = useState<"choose" | "pick">(
    startOnTemplates ? "pick" : "choose",
  );
  const [categoryKey, setCategoryKey] = useState(
    () =>
      validDefault.categoryKey ||
      (catalog?.length === 1 ? catalog[0].categoryKey : ""),
  );
  const [subcategoryName, setSubcategoryName] = useState(
    validDefault.subcategoryName,
  );
  const [choosing, setChoosing] = useState(false);
  const [chooseError, setChooseError] = useState("");

  // Preview whichever subcategory is picked; results are keyed so a stale one never shows.
  const previewKey =
    step === "pick" && categoryKey && subcategoryName
      ? `${categoryKey}|${subcategoryName}`
      : "";
  const [result, setResult] = useState<{
    key: string;
    template?: EstimateTemplate;
    error?: string;
  } | null>(null);
  useEffect(() => {
    if (!previewKey) return;
    let cancelled = false;
    resolveEstimateTemplate(categoryKey, subcategoryName)
      .then((template) => {
        if (!cancelled) setResult({ key: previewKey, template });
      })
      .catch((err) => {
        if (!cancelled) {
          setResult({
            key: previewKey,
            error:
              err instanceof Error
                ? err.message
                : "Could not load the template.",
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [previewKey, categoryKey, subcategoryName]);
  const current = previewKey && result?.key === previewKey ? result : null;
  const preview = current?.template || null;
  const loading = choosing || Boolean(previewKey && !current);
  const error = chooseError || current?.error || "";

  async function chooseTemplate() {
    // Category + subcategory already known from the work request: load it now.
    if (
      validDefault.categoryKey &&
      validDefault.subcategoryName &&
      !replacesLines
    ) {
      setChoosing(true);
      setChooseError("");
      try {
        const template = await resolveEstimateTemplate(
          validDefault.categoryKey,
          validDefault.subcategoryName,
        );
        onApply(template);
        onOpenChange(false);
      } catch (err) {
        setChooseError(
          err instanceof Error ? err.message : "Could not load the template.",
        );
        setStep("pick");
      } finally {
        setChoosing(false);
      }
      return;
    }
    setStep("pick");
  }

  return (
    <DialogContent
      className={cn(step === "pick" ? "sm:max-w-3xl" : "sm:max-w-xl")}
    >
      <DialogHeader>
        <DialogTitle>
          {step === "pick"
            ? "Choose a ready-made template"
            : "How do you want to build this estimate?"}
        </DialogTitle>
        <DialogDescription>
          {step === "pick"
            ? "Templates match the services on your Business profile. Quantities and prices stay fully editable."
            : "Start from a blank labour & material sheet, or load a pre-built template for this kind of job."}
        </DialogDescription>
      </DialogHeader>

      {step === "choose" ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => {
              onManual();
              onOpenChange(false);
            }}
            className="rounded-xl border border-input bg-card p-4 text-left transition hover:border-primary hover:bg-primary/5"
          >
            <PencilLine className="size-5 text-primary" />
            <p className="mt-2 text-sm font-semibold">Manual estimate</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Start with a blank labour & material sheet.
            </p>
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={() => void chooseTemplate()}
            className="rounded-xl border border-primary/40 bg-primary/[0.04] p-4 text-left transition hover:border-primary hover:bg-primary/[0.08] disabled:opacity-60"
          >
            {loading ? (
              <Loader2 className="size-5 animate-spin text-primary" />
            ) : (
              <LayoutTemplate className="size-5 text-primary" />
            )}
            <p className="mt-2 text-sm font-semibold">Ready-made template</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {validDefault.subcategoryName
                ? `Load the ${validDefault.subcategoryName} template now.`
                : "Pick a category and subcategory to pre-fill the sheet."}
            </p>
          </button>
          {error ? (
            <p className="text-sm text-destructive sm:col-span-2">{error}</p>
          ) : null}
        </div>
      ) : catalog === null ? (
        <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
          <Loader2 className="mr-2 size-4 animate-spin" /> Loading your
          services…
        </div>
      ) : !catalog.length ? (
        <NoCategories />
      ) : (
        <div className="space-y-4">
          <CategoryPickers
            catalog={catalog}
            categoryKey={categoryKey}
            subcategoryName={subcategoryName}
            onCategory={(key) => {
              setCategoryKey(key);
              setSubcategoryName("");
            }}
            onSubcategory={setSubcategoryName}
          />
          {loading ? (
            <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
              <Loader2 className="mr-2 size-4 animate-spin" /> Loading template…
            </div>
          ) : error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : preview ? (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <FileStack className="size-4 text-primary" />
                <p className="text-sm font-semibold">{preview.name}</p>
                <TemplateSourceBadge source={preview.source} />
              </div>
              {preview.scopeOfWork ? (
                <p className="line-clamp-3 text-xs leading-relaxed text-muted-foreground">
                  {preview.scopeOfWork}
                </p>
              ) : null}
              <TemplatePreviewTable items={preview.items} />
            </div>
          ) : (
            <p className="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
              Pick a subcategory to preview its line items.
            </p>
          )}
          {replacesLines && preview ? (
            <p className="text-xs text-amber-700">
              Loading this template replaces the line items already on the
              estimate.
            </p>
          ) : null}
        </div>
      )}

      {step === "pick" ? (
        <DialogFooter className="gap-2">
          {!startOnTemplates ? (
            <Button variant="outline" onClick={() => setStep("choose")}>
              Back
            </Button>
          ) : (
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
          )}
          <Button
            disabled={!preview || loading}
            onClick={() => {
              if (!preview) return;
              onApply(preview);
              onOpenChange(false);
            }}
          >
            Use this template
          </Button>
        </DialogFooter>
      ) : null}
    </DialogContent>
  );
}

/** After Save draft / Build / Send: offer to keep this sheet as the provider's own template. */
export function SaveTemplatePrompt({
  open,
  onOpenChange,
  catalog,
  mode,
  sourceName,
  defaultCategoryKey,
  defaultSubcategory,
  saving,
  onSave,
  onSkip,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  catalog: EstimateTemplateCategory[];
  /** "edited" = a loaded template was changed; "manual" = built from scratch. */
  mode: "edited" | "manual";
  sourceName?: string;
  defaultCategoryKey?: string;
  defaultSubcategory?: string;
  saving: boolean;
  onSave: (input: {
    categoryKey: string;
    subcategoryName: string;
    name: string;
  }) => void;
  onSkip: () => void;
}) {
  // The parent mounts this prompt per ask, so defaults are read once.
  const [initial] = useState(() =>
    matchDefault(catalog, defaultCategoryKey, defaultSubcategory),
  );
  const [categoryKey, setCategoryKey] = useState(
    initial.categoryKey || (catalog.length === 1 ? catalog[0].categoryKey : ""),
  );
  const [subcategoryName, setSubcategoryName] = useState(
    initial.subcategoryName,
  );
  const [name, setName] = useState(initial.subcategoryName);

  const replacing = catalog
    .find((row) => row.categoryKey === categoryKey)
    ?.subcategories.find((row) => row.name === subcategoryName)?.hasCustom;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && !saving) onSkip();
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Save this as a custom template?</DialogTitle>
          <DialogDescription>
            {mode === "edited"
              ? `You changed the ${sourceName || "template"} line items. Save this version so future estimates for this subcategory start from it.`
              : "Save these line items so future estimates for this subcategory start from them."}{" "}
            Only your business sees it — other providers keep the platform
            default.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <CategoryPickers
            catalog={catalog}
            categoryKey={categoryKey}
            subcategoryName={subcategoryName}
            onCategory={(key) => {
              setCategoryKey(key);
              setSubcategoryName("");
            }}
            onSubcategory={(sub) => {
              setSubcategoryName(sub);
              setName((current) => current || sub);
            }}
            disabled={saving}
          />
          <div className="space-y-1.5">
            <Label htmlFor="template-name">Template name</Label>
            <Input
              id="template-name"
              value={name}
              disabled={saving}
              placeholder={subcategoryName || "Template name"}
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          {replacing ? (
            <p className="text-xs text-amber-700">
              This replaces your saved template for {subcategoryName}.
            </p>
          ) : null}
        </div>
        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            disabled={saving}
            onClick={() => {
              onSkip();
              onOpenChange(false);
            }}
          >
            Not now
          </Button>
          <Button
            disabled={saving || !categoryKey || !subcategoryName}
            onClick={() =>
              onSave({
                categoryKey,
                subcategoryName,
                name: name.trim() || subcategoryName,
              })
            }
          >
            {saving ? <Loader2 className="size-3.5 animate-spin" /> : null}
            Save template
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
