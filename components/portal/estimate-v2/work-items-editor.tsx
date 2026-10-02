"use client";

import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { AssessmentWorkItem, AssessmentWorkItemType } from "@/lib/api/estimate-v2-client";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { JobCostKind, JobCostLine } from "@/components/portal/use-job-costing";

const WORK_ITEM_TYPES: Array<{ value: AssessmentWorkItemType; label: string }> = [
  { value: "labor", label: "Labour" },
  { value: "material", label: "Material" },
  { value: "equipment", label: "Equipment" },
];

const LABOR_UNITS = [{ value: "hr", label: "Hour" }] as const;
const MATERIAL_UNITS = [
  { value: "ea", label: "Each" },
  { value: "ft", label: "Feet" },
  { value: "sq ft", label: "Sqft" },
] as const;

function defaultUnit(type: AssessmentWorkItemType) {
  return type === "labor" ? "hr" : "ea";
}

function newLocalId() {
  return `wi_${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeType(raw?: string): AssessmentWorkItemType {
  const value = String(raw || "labor").toLowerCase();
  if (value === "material" || value === "materials") return "material";
  if (value === "equipment") return "equipment";
  // Service is treated as labour — same commercial meaning.
  return "labor";
}

function lineTotal(item: AssessmentWorkItem) {
  const qty = Number(item.quantity);
  const price = Number(item.unitPrice);
  if (!Number.isFinite(qty) || !Number.isFinite(price)) return 0;
  return Math.round(qty * price * 100) / 100;
}

export function createEmptyWorkItem(
  type: AssessmentWorkItemType = "labor",
): AssessmentWorkItem {
  const resolved = normalizeType(type);
  return {
    id: newLocalId(),
    description: "",
    type: resolved,
    quantity: 1,
    unit: defaultUnit(resolved),
    unitPrice: null,
    notes: "",
  };
}

type WorkItemsEditorProps = {
  items: AssessmentWorkItem[];
  onChange: (items: AssessmentWorkItem[]) => void;
  disabled?: boolean;
  className?: string;
  title?: string;
  hint?: string;
};

export function WorkItemsEditor({
  items,
  onChange,
  disabled = false,
  className,
  title = "Work items",
  hint = "Labour, materials, and equipment identified here become the starting line items on the estimate.",
}: WorkItemsEditorProps) {
  function patch(index: number, next: Partial<AssessmentWorkItem>) {
    onChange(
      items.map((item, i) => {
        if (i !== index) return item;
        const merged = { ...item, ...next };
        if (next.type && next.type !== item.type && !next.unit) {
          merged.unit = defaultUnit(normalizeType(next.type));
        }
        if (merged.type) merged.type = normalizeType(merged.type);
        return merged;
      }),
    );
  }

  function remove(index: number) {
    onChange(items.filter((_, i) => i !== index));
  }

  function add(type: AssessmentWorkItemType = "labor") {
    onChange([...items, createEmptyWorkItem(type)]);
  }

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-[11px] font-semibold tracking-[0.1em] text-slate-500 uppercase">
            {title}
          </h3>
          <p className="mt-1 text-xs leading-relaxed text-slate-500">{hint}</p>
        </div>
        {!disabled ? (
          <div className="flex flex-wrap gap-1.5">
            <Button type="button" size="sm" variant="outline" onClick={() => add("labor")}>
              <Plus className="size-3.5" />
              Labour
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => add("material")}>
              <Plus className="size-3.5" />
              Material
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => add("equipment")}>
              <Plus className="size-3.5" />
              Equipment
            </Button>
          </div>
        ) : null}
      </div>

      <div className="w-full overflow-x-auto rounded-xl border border-[#94a3b8] bg-white">
        <Table className="w-full min-w-0 table-fixed">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="h-8 min-w-0 bg-[#f8fafc] px-2 text-[11px] font-semibold tracking-wide text-slate-500 uppercase">
                Description
              </TableHead>
              <TableHead className="h-8 w-px whitespace-nowrap bg-[#f8fafc] px-1 text-center text-[11px] font-semibold tracking-wide text-slate-500 uppercase">
                Type
              </TableHead>
              <TableHead className="h-8 w-12 bg-[#f8fafc] px-0.5 text-center text-[11px] font-semibold tracking-wide text-slate-500 uppercase">
                Qty
              </TableHead>
              <TableHead className="h-8 w-14 bg-[#f8fafc] px-0.5 text-center text-[11px] font-semibold tracking-wide text-slate-500 uppercase">
                Unit
              </TableHead>
              <TableHead className="h-8 w-16 bg-[#f8fafc] px-0.5 text-center text-[11px] font-semibold tracking-wide text-slate-500 uppercase">
                Price
              </TableHead>
              <TableHead className="h-8 w-[4.75rem] bg-[#f8fafc] px-0.5 text-center text-[11px] font-semibold tracking-wide text-slate-500 uppercase">
                Total
              </TableHead>
              <TableHead className="h-8 w-8 bg-[#f8fafc]">
                <span className="sr-only">Remove</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length ? (
              items.map((item, index) => {
                const type = normalizeType(item.type);
                const unitOptions = type === "labor" ? LABOR_UNITS : MATERIAL_UNITS;
                const currentUnit =
                  type === "labor"
                    ? "hr"
                    : item.unit && ["ea", "ft", "sq ft"].includes(item.unit)
                      ? item.unit
                      : "ea";
                const softField =
                  "h-8 border-[#94a3b8] bg-[#fafbfc] shadow-none focus-visible:bg-card";
                const numberField =
                  "[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none";

                return (
                  <TableRow key={item.id || `${item.description}-${index}`} className="hover:bg-transparent">
                    <TableCell className="min-w-0 whitespace-normal align-top py-2">
                      <Input
                        aria-label="Description"
                        disabled={disabled}
                        placeholder={
                          type === "labor"
                            ? "Labour description"
                            : type === "equipment"
                              ? "Equipment description"
                              : "Material description"
                        }
                        value={item.description}
                        onChange={(e) => patch(index, { description: e.target.value })}
                        className={cn(softField, "w-full min-w-0 text-sm")}
                      />
                    </TableCell>
                    <TableCell className="w-px whitespace-nowrap align-top px-1 py-2">
                      <Select
                        value={type}
                        disabled={disabled}
                        onValueChange={(value) =>
                          patch(index, { type: value as AssessmentWorkItemType })
                        }
                      >
                        <SelectTrigger
                          aria-label="Type"
                          size="sm"
                          className={cn(
                            softField,
                            "w-auto justify-between gap-1 px-2 py-0 text-xs [&_svg:not([class*='size-'])]:size-3.5",
                          )}
                        >
                          <SelectValue placeholder="Type" />
                        </SelectTrigger>
                        <SelectContent
                          position="popper"
                          align="start"
                          className="z-[100] min-w-[var(--radix-select-trigger-width)]"
                        >
                          {WORK_ITEM_TYPES.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="w-12 align-top px-0.5 py-2">
                      <Input
                        aria-label="Quantity"
                        className={cn(softField, numberField, "w-full px-1 text-center text-xs tabular-nums")}
                        disabled={disabled}
                        inputMode="decimal"
                        min={0}
                        step="any"
                        type="number"
                        value={Number.isFinite(item.quantity) ? item.quantity : 0}
                        onChange={(e) => {
                          const raw = e.target.value;
                          patch(index, {
                            quantity: raw === "" ? 0 : Number(raw) || 0,
                          });
                        }}
                      />
                    </TableCell>
                    <TableCell className="w-14 align-top px-0.5 py-2">
                      <Select
                        disabled={disabled}
                        value={currentUnit}
                        onValueChange={(unit) => patch(index, { unit })}
                      >
                        <SelectTrigger
                          aria-label="Unit"
                          size="sm"
                          className={cn(
                            softField,
                            "w-full min-w-0 justify-between gap-1 py-0 pl-2.5 pr-1.5 text-xs [&_svg:not([class*='size-'])]:size-3.5 *:data-[slot=select-value]:line-clamp-none *:data-[slot=select-value]:truncate",
                          )}
                        >
                          <SelectValue placeholder="Unit" />
                        </SelectTrigger>
                        <SelectContent
                          position="popper"
                          align="center"
                          className="z-[100] w-auto min-w-[7.5rem]"
                        >
                          {unitOptions.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="w-16 align-top px-0.5 py-2">
                      <div className="relative mx-auto w-full">
                        <span
                          aria-hidden="true"
                          className="pointer-events-none absolute top-1/2 left-1 -translate-y-1/2 text-xs text-muted-foreground"
                        >
                          $
                        </span>
                        <Input
                          aria-label="Unit price"
                          className={cn(
                            softField,
                            numberField,
                            "w-full pl-4 pr-0.5 text-center text-xs tabular-nums",
                          )}
                          disabled={disabled}
                          inputMode="decimal"
                          min={0}
                          placeholder="0"
                          step="0.01"
                          type="number"
                          value={item.unitPrice ? item.unitPrice : ""}
                          onChange={(e) => {
                            const raw = e.target.value;
                            patch(index, {
                              unitPrice: raw === "" ? null : Number(raw) || 0,
                            });
                          }}
                        />
                      </div>
                    </TableCell>
                    <TableCell className="w-[4.75rem] whitespace-nowrap align-top px-0.5 py-2 text-center text-xs font-medium tabular-nums">
                      <div className="flex h-8 items-center justify-center self-start leading-none">
                        {formatMoney(lineTotal(item))}
                      </div>
                    </TableCell>
                    <TableCell className="w-8 align-top px-0 py-2 text-center">
                      {!disabled ? (
                        <div className="flex h-8 items-center justify-center self-start">
                          <Button
                            aria-label={`Remove ${item.description || "work item"}`}
                            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                            size="icon-sm"
                            variant="ghost"
                            type="button"
                            onClick={() => remove(index)}
                          >
                            <Trash2 />
                          </Button>
                        </div>
                      ) : null}
                    </TableCell>
                  </TableRow>
                );
              })
            ) : (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">
                  No work items yet. Add labour, material, or equipment above.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

/** Map assessment work items → estimate JobCostLine kinds. */
export function workItemsToJobCostLines(items: AssessmentWorkItem[]): JobCostLine[] {
  return items
    .filter((item) => String(item.description || "").trim())
    .map((item) => {
      const type = normalizeType(item.type);
      const kind: JobCostKind =
        type === "labor" ? "labor" : type === "equipment" ? "equipment" : "materials";
      return {
        id: item.id || newLocalId(),
        description: String(item.description).trim(),
        kind,
        quantity: Math.max(0.01, Number(item.quantity) || 1),
        unit: item.unit || defaultUnit(type),
        unitPrice: Math.max(0, Number(item.unitPrice) || 0),
        ...(kind === "materials" ? { images: [] as string[] } : {}),
      };
    });
}
