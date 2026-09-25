"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { ImagePlus, Loader2, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import {
  extractUploadedUrl,
  uploadFile,
} from "@/components/api/uploadFile";
import {
  jobCostKindLabel,
  lineTotal,
  type JobCostKind,
  type JobCostLine,
} from "@/components/portal/use-job-costing";
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
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";

const MATERIAL_UNITS = [
  { value: "ea", label: "Each" },
  { value: "ft", label: "Feet" },
  { value: "sq ft", label: "Square feet" },
] as const;

const LABOR_UNITS = [{ value: "hr", label: "Hour" }] as const;

const MAX_MATERIAL_IMAGES = 6;

export function createEmptyLine(kind: JobCostKind): JobCostLine {
  const stamp = Date.now();
  return {
    id: `extra_${kind}_${stamp}`,
    description: "",
    kind,
    quantity: 1,
    unit: kind === "labor" ? "hr" : "ea",
    unitPrice: 0,
    ...(kind === "materials" ? { images: [] } : {}),
  };
}

export type LineItemsEditorProps = {
  lines: JobCostLine[];
  onChange: (lines: JobCostLine[]) => void;
  locked?: boolean;
  /** Show unit column (default true). */
  showUnit?: boolean;
  /** Allow uploading optional images on material rows (default true). */
  allowMaterialImages?: boolean;
  /** Minimum rows required before delete is disabled (default 0). */
  minLines?: number;
  /** Wider description column — use in modals only. */
  wideDescription?: boolean;
  className?: string;
};

export function LineItemsEditor({
  lines,
  onChange,
  locked = false,
  showUnit = true,
  allowMaterialImages = true,
  minLines = 0,
  wideDescription = false,
  className,
}: LineItemsEditorProps) {
  function patch(id: string, next: Partial<JobCostLine>) {
    if (locked) return;
    onChange(
      lines.map((line) => {
        if (line.id !== id) return line;
        const merged = { ...line, ...next };
        if (merged.kind === "labor") {
          const { images: _drop, ...rest } = merged;
          return { ...rest, images: undefined };
        }
        return merged;
      }),
    );
  }

  function remove(id: string) {
    if (locked) return;
    if (lines.length <= minLines) return;
    onChange(lines.filter((line) => line.id !== id));
  }

  const colSpan = showUnit ? 7 : 6;
  const descriptionHeadClass = wideDescription
    ? "min-w-[320px] w-[45%]"
    : "min-w-[220px]";

  return (
    <div className={cn("w-full overflow-x-auto rounded-[4px] border border-input", className)}>
      <Table className={cn(wideDescription ? "min-w-[820px]" : "min-w-[760px]", !showUnit && "min-w-[640px]")}>
        <TableHeader>
          <TableRow>
            <TableHead className={descriptionHeadClass}>Description</TableHead>
            <TableHead className="w-32 min-w-[125px]">Type</TableHead>
            <TableHead className="w-24 min-w-[90px]">Qty</TableHead>
            {showUnit ? <TableHead className="w-36 min-w-[135px]">Unit</TableHead> : null}
            <TableHead className="w-28 min-w-[110px]">Price</TableHead>
            <TableHead className="w-24 min-w-[95px] text-right">Total</TableHead>
            <TableHead className="w-10 min-w-[44px]">
              <span className="sr-only">Remove</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {lines.length ? (
            lines.map((line) => (
              <LineItemRow
                key={line.id}
                line={line}
                locked={locked}
                showUnit={showUnit}
                allowMaterialImages={allowMaterialImages}
                wideDescription={wideDescription}
                canRemove={!locked && lines.length > minLines}
                onChange={patch}
                onRemove={() => remove(line.id)}
              />
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={colSpan} className="py-8 text-center text-sm text-muted-foreground">
                No line items yet. Add labor or material above.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}

function LineItemRow({
  line,
  locked,
  showUnit,
  allowMaterialImages,
  wideDescription,
  canRemove,
  onChange,
  onRemove,
}: {
  line: JobCostLine;
  locked: boolean;
  showUnit: boolean;
  allowMaterialImages: boolean;
  wideDescription: boolean;
  canRemove: boolean;
  onChange: (id: string, patch: Partial<JobCostLine>) => void;
  onRemove: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const currentUnit =
    line.kind === "labor"
      ? "hr"
      : line.unit && ["ea", "ft", "sq ft"].includes(line.unit)
        ? line.unit
        : "ea";
  const unitOptions = line.kind === "labor" ? LABOR_UNITS : MATERIAL_UNITS;
  const images = line.kind === "materials" ? line.images ?? [] : [];
  const showImages = allowMaterialImages && line.kind === "materials";
  const descriptionCellClass = wideDescription
    ? "min-w-[320px] align-top py-2"
    : "min-w-[220px] align-top py-2";

  async function onUpload(files: FileList | null) {
    if (!files?.length || locked) return;
    const remaining = MAX_MATERIAL_IMAGES - images.length;
    if (remaining <= 0) {
      toast.error(`You can upload up to ${MAX_MATERIAL_IMAGES} material images.`);
      return;
    }
    setUploading(true);
    try {
      const uploaded: string[] = [];
      for (const file of Array.from(files).slice(0, remaining)) {
        const response = await uploadFile(file);
        const url = extractUploadedUrl(response.data);
        if (url) uploaded.push(url);
      }
      if (!uploaded.length) {
        toast.error("Could not upload material image.");
        return;
      }
      onChange(line.id, { images: [...images, ...uploaded] });
      toast.success(uploaded.length === 1 ? "Material image uploaded." : `${uploaded.length} images uploaded.`);
    } catch {
      toast.error("Could not upload material image.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <>
      <TableRow>
        <TableCell className={descriptionCellClass}>
          <Input
            aria-label="Description"
            disabled={locked}
            placeholder={
              line.kind === "labor" ? "Labor description" : "Material description"
            }
            value={line.description}
            onChange={(event) => onChange(line.id, { description: event.target.value })}
            className={cn("w-full", wideDescription && "min-w-[280px]")}
          />
        </TableCell>
        <TableCell className="w-32 min-w-[125px] align-top py-2">
          <Select
            disabled={locked}
            value={line.kind}
            onValueChange={(value) => {
              const kind = value as JobCostKind;
              const unit = kind === "labor" ? "hr" : line.unit === "hr" || !line.unit ? "ea" : line.unit;
              onChange(line.id, {
                kind,
                unit,
                ...(kind === "labor" ? { images: undefined } : { images: line.images ?? [] }),
              });
            }}
          >
            <SelectTrigger aria-label="Type" className="w-full">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent
              position="popper"
              align="start"
              className="z-[100] w-[var(--radix-select-trigger-width)]"
            >
              <SelectItem value="labor">Labor</SelectItem>
              <SelectItem value="materials">Material</SelectItem>
            </SelectContent>
          </Select>
        </TableCell>
        <TableCell className="w-24 min-w-[90px] align-top py-2">
          <Input
            aria-label="Quantity"
            className="w-full tabular-nums"
            disabled={locked}
            inputMode="decimal"
            min={0}
            step="any"
            type="number"
            value={Number.isFinite(line.quantity) ? line.quantity : 0}
            onChange={(event) =>
              onChange(line.id, { quantity: Number(event.target.value) || 0 })
            }
          />
        </TableCell>
        {showUnit ? (
          <TableCell className="w-36 min-w-[135px] align-top py-2">
            <Select
              disabled={locked}
              value={currentUnit}
              onValueChange={(unit) => onChange(line.id, { unit })}
            >
              <SelectTrigger aria-label="Unit" className="w-full">
                <SelectValue placeholder="Unit" />
              </SelectTrigger>
              <SelectContent
                position="popper"
                align="start"
                className="z-[100] w-[var(--radix-select-trigger-width)]"
              >
                {unitOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </TableCell>
        ) : null}
        <TableCell className="w-28 min-w-[110px] align-top py-2">
          <Input
            aria-label="Unit price"
            className="w-full tabular-nums"
            disabled={locked}
            inputMode="decimal"
            min={0}
            placeholder="0"
            step="0.01"
            type="number"
            value={line.unitPrice ? line.unitPrice : ""}
            onChange={(event) =>
              onChange(line.id, { unitPrice: Number(event.target.value) || 0 })
            }
          />
        </TableCell>
        <TableCell className="w-24 min-w-[95px] align-top py-2 text-right font-medium tabular-nums">
          {formatMoney(lineTotal(line))}
        </TableCell>
        <TableCell className="w-10 min-w-[44px] align-top py-2 text-center">
          {canRemove ? (
            <Button
              aria-label={`Remove ${line.description || jobCostKindLabel(line.kind)}`}
              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
              size="icon-sm"
              variant="ghost"
              type="button"
              onClick={onRemove}
            >
              <Trash2 />
            </Button>
          ) : null}
        </TableCell>
      </TableRow>
      {showImages ? (
        <TableRow className="border-b border-input bg-[#fafbfc] hover:bg-[#fafbfc]">
          <TableCell colSpan={showUnit ? 7 : 6} className="py-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Material images
              </span>
              <span className="text-xs text-muted-foreground">(optional)</span>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(event) => void onUpload(event.target.files)}
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={locked || uploading || images.length >= MAX_MATERIAL_IMAGES}
                className="h-7 gap-1 text-xs"
                onClick={() => fileRef.current?.click()}
              >
                {uploading ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <ImagePlus className="size-3.5" />
                )}
                {uploading ? "Uploading…" : "Add image"}
              </Button>
            </div>
            {images.length ? (
              <ul className="mt-2 flex flex-wrap gap-2">
                {images.map((src, index) => (
                  <li
                    key={`${src}-${index}`}
                    className="group relative h-16 w-20 overflow-hidden rounded-md border border-input bg-white"
                  >
                    <Image
                      src={src}
                      alt={`Material photo ${index + 1}`}
                      fill
                      sizes="80px"
                      className="object-cover"
                      unoptimized={src.startsWith("http")}
                    />
                    <span className="absolute bottom-0 inset-x-0 bg-black/55 px-1 py-0.5 text-[9px] font-medium text-white">
                      Material
                    </span>
                    {!locked ? (
                      <button
                        type="button"
                        aria-label="Remove material image"
                        className="absolute top-0.5 right-0.5 flex size-5 items-center justify-center rounded-full bg-white/95 text-foreground shadow-sm ring-1 ring-black/10 opacity-0 transition group-hover:opacity-100"
                        onClick={() =>
                          onChange(line.id, {
                            images: images.filter((_, i) => i !== index),
                          })
                        }
                      >
                        <X className="size-3" />
                      </button>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-1.5 text-xs text-muted-foreground">
                No material images attached.
              </p>
            )}
          </TableCell>
        </TableRow>
      ) : null}
    </>
  );
}

export function LineItemsActions({
  locked,
  saving,
  onAddLabor,
  onAddMaterial,
  className,
}: {
  locked?: boolean;
  saving?: boolean;
  onAddLabor: () => void;
  onAddMaterial: () => void;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-center justify-end gap-2", className)}>
      <Button size="sm" variant="outline" type="button" disabled={locked || saving} onClick={onAddLabor}>
        <Plus />
        Add labor
      </Button>
      <Button
        size="sm"
        variant="outline"
        type="button"
        disabled={locked || saving}
        onClick={onAddMaterial}
      >
        <Plus />
        Add material
      </Button>
    </div>
  );
}
