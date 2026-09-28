"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { ImagePlus, Loader2, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import {
  extractUploadedUrl,
  uploadFile,
} from "@/components/api/uploadFile";
import { PhotoLightbox } from "@/components/marketplace/portfolio-lightbox";
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

/** Material line items allow exactly one image. */
const MAX_MATERIAL_IMAGES = 1;

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
    <div className={cn("w-full overflow-x-auto rounded-lg border border-border-soft bg-card", className)}>
      <Table className={cn(wideDescription ? "min-w-[820px]" : "min-w-[760px]", !showUnit && "min-w-[640px]")}>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className={cn(descriptionHeadClass, "h-8 bg-[#f7f8fa] px-2.5 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase")}>Description</TableHead>
            <TableHead className="h-8 w-32 min-w-[125px] bg-[#f7f8fa] px-2.5 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Type</TableHead>
            <TableHead className="h-8 w-24 min-w-[90px] bg-[#f7f8fa] px-2.5 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Qty</TableHead>
            {showUnit ? <TableHead className="h-8 w-36 min-w-[135px] bg-[#f7f8fa] px-2.5 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Unit</TableHead> : null}
            <TableHead className="h-8 w-28 min-w-[110px] bg-[#f7f8fa] px-2.5 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Price</TableHead>
            <TableHead className="h-8 w-24 min-w-[95px] bg-[#f7f8fa] px-2.5 text-right text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Total</TableHead>
            <TableHead className="h-8 w-10 min-w-[44px] bg-[#f7f8fa]">
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
                No line items yet. Add labour or material above.
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
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const currentUnit =
    line.kind === "labor"
      ? "hr"
      : line.unit && ["ea", "ft", "sq ft"].includes(line.unit)
        ? line.unit
        : "ea";
  const unitOptions = line.kind === "labor" ? LABOR_UNITS : MATERIAL_UNITS;
  const images = line.kind === "materials" ? (line.images ?? []).slice(0, MAX_MATERIAL_IMAGES) : [];
  const materialImage = images[0];
  const showImages = allowMaterialImages && line.kind === "materials";
  const descriptionCellClass = wideDescription
    ? "min-w-[320px] align-top py-2"
    : "min-w-[220px] align-top py-2";

  async function onUpload(files: FileList | null) {
    if (!files?.length || locked) return;
    const file = files[0];
    if (!file) return;
    setUploading(true);
    try {
      const response = await uploadFile(file);
      const url = extractUploadedUrl(response.data);
      if (!url) {
        toast.error("Could not upload material image.");
        return;
      }
      onChange(line.id, { images: [url] });
      toast.success("Material image uploaded.");
    } catch {
      toast.error("Could not upload material image.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const softField =
    "h-8 border-border-soft bg-[#fafbfc] shadow-none focus-visible:bg-card";

  return (
    <TableRow className="hover:bg-transparent">
      <TableCell className={descriptionCellClass}>
        <div className={cn("flex w-full flex-col gap-1.5", wideDescription && "min-w-[280px]")}>
          <div className="relative w-full min-w-0">
            <Input
              aria-label="Description"
              disabled={locked}
              placeholder={
                line.kind === "labor" ? "Labour description" : "Material description"
              }
              value={line.description}
              onChange={(event) => onChange(line.id, { description: event.target.value })}
              className={cn(
                softField,
                "w-full text-sm",
                showImages && materialImage ? "pr-14" : undefined,
              )}
            />
            {showImages && materialImage ? (
              <div className="absolute right-1.5 bottom-1 z-10">
                <div className="relative shrink-0">
                  <button
                    type="button"
                    className="relative block h-6 w-8 overflow-hidden rounded border border-border-soft bg-white text-left"
                    title="View full image"
                    onClick={() => setLightboxOpen(true)}
                  >
                    <Image
                      src={materialImage}
                      alt="Material photo"
                      fill
                      sizes="32px"
                      className="object-cover"
                      unoptimized={materialImage.startsWith("http")}
                    />
                  </button>
                  {!locked ? (
                    <button
                      type="button"
                      aria-label="Remove material image"
                      className="absolute -top-1.5 -right-1.5 flex size-4 items-center justify-center rounded-full bg-white text-foreground ring-1 ring-border-soft"
                      onClick={() => onChange(line.id, { images: [] })}
                    >
                      <X className="size-2.5" />
                    </button>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>
          {showImages ? (
            <>
              <div className="flex flex-wrap items-center gap-1.5">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(event) => void onUpload(event.target.files)}
                />
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={locked || uploading}
                  className="h-7 gap-1 px-2 text-xs text-primary hover:bg-secondary"
                  onClick={() => fileRef.current?.click()}
                >
                  {uploading ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <ImagePlus className="size-3.5" />
                  )}
                  {uploading
                    ? "Uploading…"
                    : materialImage
                      ? "Replace image"
                      : "Add image"}
                </Button>
              </div>
              <PhotoLightbox
                photos={
                  materialImage
                    ? [{ src: materialImage, alt: "Material photo" }]
                    : []
                }
                title="Material image"
                open={lightboxOpen && Boolean(materialImage)}
                onOpenChange={setLightboxOpen}
                index={0}
                onIndexChange={() => undefined}
              />
            </>
          ) : null}
        </div>
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
              ...(kind === "labor"
                ? { images: undefined }
                : { images: (line.images ?? []).slice(0, MAX_MATERIAL_IMAGES) }),
            });
          }}
        >
          <SelectTrigger aria-label="Type" size="sm" className={cn(softField, "w-full")}>
            <SelectValue placeholder="Type">
              {jobCostKindLabel(line.kind)}
            </SelectValue>
          </SelectTrigger>
          <SelectContent
            position="popper"
            align="start"
            className="z-[100] w-[var(--radix-select-trigger-width)]"
          >
            <SelectItem value="labor">Labour</SelectItem>
            <SelectItem value="materials">Material</SelectItem>
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell className="w-24 min-w-[90px] align-top py-2">
        <Input
          aria-label="Quantity"
          className={cn(softField, "w-full tabular-nums")}
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
            <SelectTrigger aria-label="Unit" size="sm" className={cn(softField, "w-full")}>
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
          className={cn(softField, "w-full tabular-nums")}
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
      <TableCell className="w-24 min-w-[95px] align-top py-2 text-right text-sm font-medium tabular-nums">
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
      <Button
        size="sm"
        variant="outline"
        type="button"
        disabled={locked || saving}
        onClick={onAddLabor}
        className="h-8 border-border-soft"
      >
        <Plus />
        Add labour
      </Button>
      <Button
        size="sm"
        variant="outline"
        type="button"
        disabled={locked || saving}
        onClick={onAddMaterial}
        className="h-8 border-border-soft"
      >
        <Plus />
        Add material
      </Button>
    </div>
  );
}
