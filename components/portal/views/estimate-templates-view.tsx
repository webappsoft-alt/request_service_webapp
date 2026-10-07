"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Eye,
  LayoutTemplate,
  Loader2,
  Pencil,
  RotateCcw,
  SlidersHorizontal,
} from "lucide-react";
import { toast } from "sonner";
import { PortalPage } from "@/components/portal/portal-page";
import { PortalDataTable } from "@/components/portal/portal-data-table";
import { createEmptyLine } from "@/components/portal/line-items-editor";
import { SectionedLineItemsEditor } from "@/components/portal/estimate-v2/sectioned-line-items-editor";
import {
  PROFILE_CATEGORIES_HREF,
  TemplatePreviewTable,
} from "@/components/portal/estimate-v2/estimate-template-dialogs";
import {
  jobCostMix,
  type JobCostLine,
} from "@/components/portal/use-job-costing";
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
import { Textarea } from "@/components/ui/textarea";
import {
  deleteCustomEstimateTemplate,
  linesToTemplateItems,
  listEstimateTemplates,
  saveCustomEstimateTemplate,
  templateItemsToLines,
  type EstimateTemplate,
} from "@/lib/api/estimate-templates-client";
import { formatDate, formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";

/** One row per subcategory: the platform default, plus the provider's version when customized. */
type TemplateRow = {
  key: string;
  categoryKey: string;
  categoryName: string;
  subcategoryName: string;
  status: "default" | "custom";
  /** What new estimates load — the custom template when there is one. */
  effective: EstimateTemplate;
  platform: EstimateTemplate | null;
  custom: EstimateTemplate | null;
};

const ALL = "all";

function rowKeyOf(categoryKey: string, subcategoryName: string) {
  return `${categoryKey}|${subcategoryName.toLowerCase()}`;
}

function toRows(templates: EstimateTemplate[]): TemplateRow[] {
  const map = new Map<string, TemplateRow>();
  for (const template of templates) {
    const key = rowKeyOf(template.categoryKey, template.subcategoryName);
    const row = map.get(key) || {
      key,
      categoryKey: template.categoryKey,
      categoryName: template.categoryName,
      subcategoryName: template.subcategoryName,
      status: "default" as const,
      effective: template,
      platform: null,
      custom: null,
    };
    if (template.source === "custom") {
      row.custom = template;
      row.effective = template;
      row.status = "custom";
    } else {
      row.platform = template;
      if (!row.custom) row.effective = template;
    }
    map.set(key, row);
  }
  return [...map.values()];
}

function StatusBadge({ status }: { status: TemplateRow["status"] }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset",
        status === "custom"
          ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
          : "bg-slate-50 text-slate-600 ring-slate-200",
      )}
    >
      {status === "custom" ? "Customized" : "Default"}
    </span>
  );
}

/**
 * Office › Templates: every ready-made estimate template for the provider's
 * Business-profile categories, with filters, pagination and a detail view.
 */
export function EstimateTemplatesView() {
  const [templates, setTemplates] = useState<EstimateTemplate[] | null>(null);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const reload = useCallback(() => setReloadKey((key) => key + 1), []);

  const [category, setCategory] = useState(ALL);
  const [subcategory, setSubcategory] = useState(ALL);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const [detailKey, setDetailKey] = useState<string | null>(null);
  const [detailEditing, setDetailEditing] = useState(false);
  const [resetting, setResetting] = useState<TemplateRow | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    listEstimateTemplates()
      .then((rows) => {
        if (cancelled) return;
        setTemplates(rows);
        setError("");
      })
      .catch((err) => {
        if (cancelled) return;
        setError(
          err instanceof Error ? err.message : "Could not load templates.",
        );
        setTemplates((current) => current || []);
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const rows = useMemo(() => toRows(templates || []), [templates]);

  const categories = useMemo(() => {
    const map = new Map<string, string>();
    for (const row of rows) map.set(row.categoryKey, row.categoryName);
    return [...map].map(([key, name]) => ({ key, name }));
  }, [rows]);


  const filtered = useMemo(
    () =>
      rows.filter(
        (row) =>
          (category === ALL || row.categoryKey === category) &&
          (subcategory === ALL || row.subcategoryName === subcategory),
      ),
    [rows, category, subcategory],
  );

  const detail = detailKey
    ? rows.find((row) => row.key === detailKey) || null
    : null;

  function openDetail(row: TemplateRow, edit = false) {
    setDetailKey(row.key);
    setDetailEditing(edit);
  }

  async function resetTemplate(row: TemplateRow) {
    if (!row.custom) return;
    setBusy(true);
    try {
      await deleteCustomEstimateTemplate(row.custom.id);
      toast.success(
        `${row.subcategoryName} now uses the platform default again.`,
      );
      setResetting(null);
      setDetailEditing(false);
      reload();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not reset the template.",
      );
    } finally {
      setBusy(false);
    }
  }

  const activeFilterCount =
    (category !== ALL ? 1 : 0) + (subcategory !== ALL ? 1 : 0);
  const categoryLabel = categories.find((row) => row.key === category)?.name;

  return (
    <PortalPage
      eyebrow="Office / Templates"
      title="Estimate templates"
      description="Ready-made labour, material and equipment sheets for the services on your Business profile. Customize one and future estimates for that subcategory load your version."
      actions={
        <Button variant="outline" size="sm" asChild>
          <Link href="/pro/dashboard/new-estimate">Estimates</Link>
        </Button>
      }
    >
      {error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      ) : null}

      {templates !== null && !rows.length ? (
        <div className="rounded-2xl border border-dashed border-[#94a3b8] bg-white px-6 py-12 text-center">
          <LayoutTemplate className="mx-auto size-8 text-slate-400" />
          <p className="mt-3 text-sm font-semibold text-slate-800">
            No templates yet
          </p>
          <p className="mt-1 text-sm text-slate-500">
            Templates follow the categories on your Business profile.{" "}
            <Link
              href={PROFILE_CATEGORIES_HREF}
              className="font-medium text-primary hover:underline"
            >
              Add your services
            </Link>{" "}
            to see them here.
          </p>
        </div>
      ) : (
        <div className="space-y-3 rounded-2xl border border-[#94a3b8] bg-white p-4">
          {activeFilterCount ? (
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="text-muted-foreground">Filtered by</span>
              {categoryLabel ? (
                <span className="rounded-full bg-primary/10 px-2.5 py-1 font-medium text-primary">
                  {categoryLabel}
                </span>
              ) : null}
              {subcategory !== ALL ? (
                <span className="rounded-full bg-primary/10 px-2.5 py-1 font-medium text-primary">
                  {subcategory}
                </span>
              ) : null}
              <button
                type="button"
                className="font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                onClick={() => {
                  setCategory(ALL);
                  setSubcategory(ALL);
                }}
              >
                Clear
              </button>
            </div>
          ) : null}
          <PortalDataTable
            filename="estimate-templates"
            countLabel="Templates"
            searchPlaceholder="Search category or subcategory"
            loading={templates === null}
            empty={
              activeFilterCount
                ? "No templates match these filters."
                : "No templates found."
            }
            rows={filtered}
            rowKey={(row) => row.key}
            toolbar={
              <Button
                variant={activeFilterCount ? "default" : "outline"}
                size="sm"
                className="h-8 gap-1.5 text-xs"
                onClick={() => setFiltersOpen(true)}
              >
                <SlidersHorizontal className="size-3.5" />
                Filters
                {activeFilterCount ? (
                  <span className="rounded-full bg-white/25 px-1.5 text-[10px] font-semibold">
                    {activeFilterCount}
                  </span>
                ) : null}
              </Button>
            }
            onRowClick={(row) => openDetail(row)}
            columns={[
              {
                id: "category",
                header: "Category",
                sortValue: (row) => row.categoryName,
                searchValue: (row) => row.categoryName,
                exportValue: (row) => row.categoryName,
                cell: (row) => (
                  <span className="text-sm text-slate-700">
                    {row.categoryName}
                  </span>
                ),
              },
              {
                id: "subcategory",
                header: "Subcategory",
                className: "min-w-52",
                sortValue: (row) => row.subcategoryName,
                searchValue: (row) =>
                  `${row.subcategoryName} ${row.effective.name}`,
                exportValue: (row) => row.subcategoryName,
                cell: (row) => (
                  <div>
                    <p className="font-medium text-slate-900">
                      {row.subcategoryName}
                    </p>
                    {row.effective.name !== row.subcategoryName ? (
                      <p className="text-xs text-muted-foreground">
                        {row.effective.name}
                      </p>
                    ) : null}
                  </div>
                ),
              },
              {
                id: "status",
                header: "Template type",
                sortValue: (row) => row.status,
                searchValue: () => "",
                exportValue: (row) =>
                  row.status === "custom" ? "Customized" : "Default",
                cell: (row) => (
                  <div>
                    <StatusBadge status={row.status} />
                    {row.custom?.updatedAt ? (
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        Edited {formatDate(row.custom.updatedAt)}
                      </p>
                    ) : null}
                  </div>
                ),
              },
              {
                id: "summary",
                header: "Summary",
                className: "min-w-56",
                sortValue: (row) => row.effective.totals.total,
                searchValue: () => "",
                exportValue: (row) =>
                  `${row.effective.totals.itemCount} items; ${row.effective.totals.laborHours} labour hrs; ${row.effective.totals.total}`,
                cell: (row) => (
                  <div className="text-xs text-slate-600">
                    <p className="text-sm font-semibold text-slate-900 tabular-nums">
                      {formatMoney(row.effective.totals.total)}
                    </p>
                    <p className="tabular-nums">
                      {row.effective.totals.itemCount} items ·{" "}
                      {row.effective.totals.laborHours} labour hrs
                    </p>
                  </div>
                ),
              },
            ]}
            actions={(row) => [
              {
                label: "View / Edit",
                icon: <Eye className="size-3.5" />,
                quick: true,
                onSelect: () => openDetail(row),
              },
              {
                label: row.status === "custom" ? "Edit template" : "Customize",
                icon: <Pencil className="size-3.5" />,
                onSelect: () => openDetail(row, true),
              },
              ...(row.status === "custom"
                ? [
                    {
                      label: "Reset to default",
                      icon: <RotateCcw className="size-3.5" />,
                      variant: "destructive" as const,
                      onSelect: () => setResetting(row),
                    },
                  ]
                : []),
            ]}
          />
        </div>
      )}

      <TemplateFiltersDialog
        open={filtersOpen}
        onOpenChange={setFiltersOpen}
        rows={rows}
        categories={categories}
        category={category}
        subcategory={subcategory}
        onApply={(next) => {
          setCategory(next.category);
          setSubcategory(next.subcategory);
          setFiltersOpen(false);
        }}
      />

      <TemplateDetailDialog
        row={detail}
        editing={detailEditing}
        onEditingChange={setDetailEditing}
        onClose={() => {
          setDetailKey(null);
          setDetailEditing(false);
        }}
        onSaved={() => {
          setDetailEditing(false);
          reload();
        }}
        onReset={(row) => setResetting(row)}
      />

      <Dialog
        open={Boolean(resetting)}
        onOpenChange={(open) => !open && !busy && setResetting(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reset to the platform default?</DialogTitle>
            <DialogDescription>
              Your {resetting?.subcategoryName} template is deleted and future
              estimates load the platform default again. Estimates already built
              from it are not changed.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => setResetting(null)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={busy}
              onClick={() => resetting && void resetTemplate(resetting)}
            >
              {busy ? <Loader2 className="size-3.5 animate-spin" /> : null}
              Reset to default
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PortalPage>
  );
}

function TemplateFiltersDialog({
  open,
  onOpenChange,
  ...props
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rows: TemplateRow[];
  categories: Array<{ key: string; name: string }>;
  category: string;
  subcategory: string;
  onApply: (next: { category: string; subcategory: string }) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {/* Mounted per open so the draft starts from the applied filters. */}
        {open ? (
          <TemplateFiltersBody
            {...props}
            onCancel={() => onOpenChange(false)}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function TemplateFiltersBody({
  rows,
  categories,
  category,
  subcategory,
  onApply,
  onCancel,
}: {
  rows: TemplateRow[];
  categories: Array<{ key: string; name: string }>;
  category: string;
  subcategory: string;
  onApply: (next: { category: string; subcategory: string }) => void;
  onCancel: () => void;
}) {
  const [draftCategory, setDraftCategory] = useState(category);
  const [draftSubcategory, setDraftSubcategory] = useState(subcategory);
  const subcategories = rows
    .filter((row) => row.categoryKey === draftCategory)
    .map((row) => row.subcategoryName);

  return (
    <>
      <DialogHeader>
        <DialogTitle>Filter templates</DialogTitle>
        <DialogDescription>
          Pick a category, then narrow it to one of its subcategories.
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label>Category</Label>
          <Select
            value={draftCategory}
            onValueChange={(value) => {
              setDraftCategory(value);
              setDraftSubcategory(ALL);
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All categories</SelectItem>
              {categories.map((row) => (
                <SelectItem key={row.key} value={row.key}>
                  {row.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Subcategory</Label>
          <Select
            value={draftSubcategory}
            onValueChange={setDraftSubcategory}
            disabled={draftCategory === ALL}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>
                {draftCategory === ALL
                  ? "Pick a category first"
                  : "All subcategories"}
              </SelectItem>
              {subcategories.map((name) => (
                <SelectItem key={name} value={name}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <DialogFooter className="gap-2 sm:justify-between">
        <Button
          variant="ghost"
          disabled={draftCategory === ALL && draftSubcategory === ALL}
          onClick={() => {
            setDraftCategory(ALL);
            setDraftSubcategory(ALL);
          }}
        >
          Reset
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            onClick={() =>
              onApply({
                category: draftCategory,
                subcategory: draftSubcategory,
              })
            }
          >
            Apply filters
          </Button>
        </div>
      </DialogFooter>
    </>
  );
}

/** Full breakdown of one template, with edit / save and reset. */
function TemplateDetailDialog({
  row,
  editing,
  onEditingChange,
  onClose,
  onSaved,
  onReset,
}: {
  row: TemplateRow | null;
  editing: boolean;
  onEditingChange: (editing: boolean) => void;
  onClose: () => void;
  onSaved: () => void;
  onReset: (row: TemplateRow) => void;
}) {
  const [saving, setSaving] = useState(false);
  return (
    <Dialog
      open={Boolean(row)}
      onOpenChange={(open) => !open && !saving && onClose()}
    >
      <DialogContent
        className={cn(
          "max-h-[92vh] overflow-y-auto",
          editing ? "sm:max-w-6xl" : "sm:max-w-4xl",
        )}
      >
        {row ? (
          editing ? (
            <TemplateEditorBody
              key={`${row.key}|${row.effective.id}`}
              row={row}
              saving={saving}
              setSaving={setSaving}
              onCancel={() => onEditingChange(false)}
              onSaved={onSaved}
            />
          ) : (
            <TemplateViewBody
              key={row.key}
              row={row}
              onEdit={() => onEditingChange(true)}
              onClose={onClose}
              onReset={() => onReset(row)}
            />
          )
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function TemplateViewBody({
  row,
  onEdit,
  onClose,
  onReset,
}: {
  row: TemplateRow;
  onEdit: () => void;
  onClose: () => void;
  onReset: () => void;
}) {
  // Both versions side by side: Customized (what estimates load) and the platform Default.
  const [showing, setShowing] = useState<"custom" | "default">(
    row.custom ? "custom" : "default",
  );
  const template =
    showing === "custom" && row.custom
      ? row.custom
      : row.platform || row.effective;
  const totals = template.totals;
  const viewingStatus =
    showing === "custom" && row.custom ? "custom" : "default";

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex flex-wrap items-center gap-2">
          {row.subcategoryName} <StatusBadge status={viewingStatus} />
        </DialogTitle>
        <DialogDescription>
          {row.categoryName}
          {template.name !== row.subcategoryName ? ` · ${template.name}` : ""}
        </DialogDescription>
      </DialogHeader>

      <div className="flex border-b border-[#d8dee8]">
        {(
          [
            ["custom", "Customized", row.custom],
            ["default", "Default", row.platform],
          ] as const
        ).map(([value, label, version]) => (
          <button
            key={value}
            type="button"
            disabled={!version}
            onClick={() => setShowing(value)}
            className={cn(
              "-mb-px flex items-center gap-1.5 border-b-2 px-4 py-2 text-sm font-medium transition",
              showing === value
                ? "border-primary text-primary"
                : "border-transparent text-slate-500 hover:text-slate-800",
              !version && "cursor-not-allowed opacity-50 hover:text-slate-500",
            )}
          >
            {label}
            {version ? (
              <span className="text-xs font-normal text-slate-400 tabular-nums">
                {formatMoney(version.totals.total)}
              </span>
            ) : (
              <span className="text-xs font-normal">· none yet</span>
            )}
          </button>
        ))}
      </div>
      <p className="-mt-1 text-xs text-muted-foreground">
        {!row.custom
          ? "You haven't customized this template — new estimates load the platform default. Customize it to save your own version."
          : showing === "custom"
            ? "Your customized version. New estimates for this subcategory load this one."
            : "The platform default, shown for comparison. Your estimates load the Customized version."}
      </p>

      <div className="grid gap-2 sm:grid-cols-5">
        {(
          [
            ["Line items", String(totals.itemCount)],
            ["Labour hours", String(totals.laborHours)],
            ["Labour", formatMoney(totals.labor)],
            ["Material", formatMoney(totals.material)],
            ["Equipment", formatMoney(totals.equipment)],
          ] as const
        ).map(([label, value]) => (
          <div
            key={label}
            className="rounded-lg border border-[#d8dee8] bg-[#f8fafc] px-3 py-2"
          >
            <p className="text-[10px] font-semibold tracking-widest text-slate-500 uppercase">
              {label}
            </p>
            <p className="mt-0.5 text-sm font-semibold text-slate-900 tabular-nums">
              {value}
            </p>
          </div>
        ))}
      </div>

      {template.scopeOfWork ? (
        <div>
          <p className="text-[11px] font-semibold tracking-widest text-slate-500 uppercase">
            Scope of work
          </p>
          <p className="mt-1 text-sm leading-relaxed text-slate-700">
            {template.scopeOfWork}
          </p>
        </div>
      ) : null}

      <TemplatePreviewTable items={template.items} />

      <DialogFooter className="gap-2 sm:justify-between">
        <div>
          {row.custom ? (
            <Button
              variant="ghost"
              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={onReset}
            >
              <RotateCcw className="size-3.5" /> Reset to default
            </Button>
          ) : null}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          <Button onClick={onEdit}>
            <Pencil className="size-3.5" />{" "}
            {row.custom ? "Edit template" : "Customize"}
          </Button>
        </div>
      </DialogFooter>
    </>
  );
}

/** Edit scope and line items; saving a default creates the provider's own copy. */
function TemplateEditorBody({
  row,
  saving,
  setSaving,
  onCancel,
  onSaved,
}: {
  row: TemplateRow;
  saving: boolean;
  setSaving: (saving: boolean) => void;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const template = row.effective;
  const [name, setName] = useState(template.name);
  const [scope, setScope] = useState(template.scopeOfWork);
  const [lines, setLines] = useState<JobCostLine[]>(() => {
    const next = templateItemsToLines(template.items);
    return next.length ? next : [createEmptyLine("labor")];
  });
  const mix = useMemo(() => jobCostMix(lines), [lines]);

  async function save() {
    const items = linesToTemplateItems(lines);
    if (!items.length) {
      toast.error("Add at least one line item.");
      return;
    }
    setSaving(true);
    try {
      await saveCustomEstimateTemplate({
        categoryKey: row.categoryKey,
        subcategoryName: row.subcategoryName,
        name: name.trim() || row.subcategoryName,
        scopeOfWork: scope,
        items,
      });
      toast.success(
        row.custom
          ? "Template updated."
          : `Saved your ${row.subcategoryName} template — new estimates will load it.`,
      );
      onSaved();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not save the template.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>
          {row.custom ? "Edit template" : "Customize template"}
        </DialogTitle>
        <DialogDescription>
          {row.categoryName} › {row.subcategoryName}
          {row.custom
            ? ""
            : " · Saving creates your own version; the platform default stays unchanged for other providers."}
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="tpl-name">Template name</Label>
          <Input
            id="tpl-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="tpl-scope">Scope of work</Label>
          <Textarea
            id="tpl-scope"
            rows={3}
            value={scope}
            onChange={(event) => setScope(event.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Line items</Label>
          <SectionedLineItemsEditor lines={lines} onChange={setLines} />
        </div>
        <div className="flex flex-wrap justify-end gap-x-6 gap-y-1 text-sm text-slate-600">
          <span>
            Labour{" "}
            <span className="font-semibold text-slate-900 tabular-nums">
              {formatMoney(mix.labor)}
            </span>
          </span>
          <span>
            Material{" "}
            <span className="font-semibold text-slate-900 tabular-nums">
              {formatMoney(mix.materials)}
            </span>
          </span>
          <span>
            Equipment{" "}
            <span className="font-semibold text-slate-900 tabular-nums">
              {formatMoney(mix.equipment)}
            </span>
          </span>
          <span className="font-semibold text-slate-900">
            Total <span className="tabular-nums">{formatMoney(mix.total)}</span>
          </span>
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" disabled={saving} onClick={onCancel}>
          Back
        </Button>
        <Button disabled={saving} onClick={() => void save()}>
          {saving ? <Loader2 className="size-3.5 animate-spin" /> : null}
          Save changes
        </Button>
      </DialogFooter>
    </>
  );
}
