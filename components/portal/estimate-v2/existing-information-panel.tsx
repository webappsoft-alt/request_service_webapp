"use client";

import { useRef, useState } from "react";
import { ImagePlus, Loader2, Plus, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { extractUploadedUrl, uploadFile } from "@/components/api/uploadFile";
import { WorkItemsEditor } from "@/components/portal/estimate-v2/work-items-editor";
import { Button } from "@/components/ui/button";
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
import type {
  AssessmentWorkItem,
  OpportunityAttachment,
  OpportunityMeasurement,
} from "@/lib/api/estimate-v2-client";
import { cn } from "@/lib/utils";

const MEASUREMENT_UNITS = [
  { value: "sq ft", label: "sq ft (area)" },
  { value: "sq m", label: "sq m (area)" },
  { value: "ft", label: "ft (length)" },
  { value: "in", label: "in (length)" },
  { value: "lf", label: "lf (linear feet)" },
  { value: "m", label: "m (meters)" },
  { value: "cm", label: "cm" },
  { value: "ton", label: "ton (HVAC capacity)" },
  { value: "gal", label: "gal (volume)" },
  { value: "cu ft", label: "cu ft (volume)" },
  { value: "lb", label: "lb (weight)" },
  { value: "ea", label: "ea (count)" },
  { value: "hr", label: "hr (time)" },
  { value: "PSI", label: "PSI (pressure)" },
  { value: "V", label: "V (voltage)" },
  { value: "A", label: "A (amps)" },
  { value: "%", label: "% (percent)" },
  { value: "°F", label: "°F" },
  { value: "°C", label: "°C" },
] as const;

function isImageAttachment(item: OpportunityAttachment) {
  const type = String(item.type || "").toLowerCase();
  const name = String(item.name || item.url || "").toLowerCase();
  return type.startsWith("image/") || /\.(png|jpe?g|gif|webp|bmp|heic)$/i.test(name);
}

type ExistingInformationPanelProps = {
  findings: string;
  onFindingsChange: (value: string) => void;
  measurements: OpportunityMeasurement[];
  onMeasurementsChange: (items: OpportunityMeasurement[]) => void;
  attachments: OpportunityAttachment[];
  onAttachmentsChange: (items: OpportunityAttachment[]) => void;
  workItems: AssessmentWorkItem[];
  onWorkItemsChange: (items: AssessmentWorkItem[]) => void;
  saving?: boolean;
  onSave: () => void | Promise<void>;
  onContinue: () => void | Promise<void>;
};

export function ExistingInformationPanel({
  findings,
  onFindingsChange,
  measurements,
  onMeasurementsChange,
  attachments,
  onAttachmentsChange,
  workItems,
  onWorkItemsChange,
  saving = false,
  onSave,
  onContinue,
}: ExistingInformationPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [measurementLabel, setMeasurementLabel] = useState("");
  const [measurementValue, setMeasurementValue] = useState("");
  const [measurementUnit, setMeasurementUnit] = useState("sq ft");

  async function uploadFiles(files: FileList | File[] | null) {
    if (!files?.length || saving) return;
    setUploading(true);
    try {
      const uploaded: OpportunityAttachment[] = [];
      for (const file of Array.from(files)) {
        const result = await uploadFile(file);
        const url = extractUploadedUrl(result.data);
        if (!url) continue;
        uploaded.push({
          name: file.name,
          url,
          type: file.type || "",
          size: file.size || 0,
          addedAt: new Date().toISOString(),
        });
      }
      if (!uploaded.length) throw new Error("No files uploaded.");
      onAttachmentsChange([...attachments, ...uploaded]);
      toast.success(
        uploaded.length === 1 ? "Attachment added." : `${uploaded.length} attachments added.`,
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not upload files.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function removeAttachment(url: string) {
    onAttachmentsChange(attachments.filter((item) => item.url !== url));
  }

  function addMeasurement() {
    if (!measurementLabel.trim()) {
      toast.error("Enter what you are measuring.");
      return;
    }
    if (!measurementValue.trim()) {
      toast.error("Enter a measurement value.");
      return;
    }
    onMeasurementsChange([
      ...measurements,
      {
        label: measurementLabel.trim(),
        value: measurementValue.trim(),
        unit: measurementUnit.trim(),
      },
    ]);
    setMeasurementLabel("");
    setMeasurementValue("");
  }

  function removeMeasurement(index: number) {
    onMeasurementsChange(measurements.filter((_, i) => i !== index));
  }

  return (
    <div className="rounded-xl border border-input bg-card p-5">
      <div>
        <h2 className="text-base font-semibold">Existing information</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Capture what you already know — no site visit required. Work items become the starting
          line items on the estimate.
        </p>
      </div>

      <div className="mt-5">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Photos & attachments
        </h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Optional. Customer photos, prior visit images, drawings, PDFs, or screenshots.
        </p>
        <div
          className={cn(
            "mt-2 rounded-xl border-2 border-dashed px-4 py-6 text-center transition",
            dragOver ? "border-primary bg-primary/5" : "border-input bg-secondary/20",
            (saving || uploading) && "opacity-70",
          )}
          onDragEnter={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            setDragOver(false);
          }}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            void uploadFiles(e.dataTransfer.files);
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv"
            multiple
            className="hidden"
            onChange={(e) => void uploadFiles(e.target.files)}
          />
          <div className="mx-auto flex size-10 items-center justify-center rounded-full border border-input bg-background">
            {uploading ? (
              <Loader2 className="size-4 animate-spin text-muted-foreground" />
            ) : (
              <Upload className="size-4 text-muted-foreground" />
            )}
          </div>
          <p className="mt-2 text-sm font-medium">
            {uploading ? "Uploading…" : "Drag & drop photos or files here"}
          </p>
          <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={uploading || saving}
              onClick={() => fileInputRef.current?.click()}
            >
              <ImagePlus className="size-3.5" />
              Add photos
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={uploading || saving}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="size-3.5" />
              Upload files
            </Button>
          </div>
        </div>
        {attachments.length ? (
          <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
            {attachments.map((item) => {
              const image = isImageAttachment(item);
              return (
                <div
                  key={item.url}
                  className="group relative aspect-square overflow-hidden rounded-lg border border-input bg-secondary/30"
                >
                  {image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.url}
                      alt={item.name || "Attachment"}
                      className="size-full object-cover"
                    />
                  ) : (
                    <div className="flex size-full flex-col items-center justify-center gap-1 p-2 text-center">
                      <Upload className="size-4 text-muted-foreground" />
                      <span className="line-clamp-3 text-[10px] leading-tight text-muted-foreground">
                        {item.name || "File"}
                      </span>
                    </div>
                  )}
                  {!saving ? (
                    <button
                      type="button"
                      className="absolute right-1 top-1 rounded-md bg-black/70 p-1 text-white opacity-0 transition group-hover:opacity-100"
                      onClick={() => removeAttachment(item.url)}
                      aria-label="Remove attachment"
                    >
                      <Trash2 className="size-3" />
                    </button>
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : null}
      </div>

      <div className="mt-5">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Measurements
        </h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Optional. What = the thing measured · Value = the number · Unit = how it is measured
        </p>
        {measurements.length ? (
          <ul className="mt-3 divide-y divide-input rounded-lg border border-input">
            {measurements.map((item, index) => (
              <li
                key={`${item.label}-${index}`}
                className="flex items-center justify-between gap-2 px-3 py-2 text-sm"
              >
                <span>
                  <span className="font-medium">{item.label}</span>
                  <span className="text-muted-foreground">
                    {" · "}
                    {item.value}
                    {item.unit ? ` ${item.unit}` : ""}
                  </span>
                </span>
                {!saving ? (
                  <button
                    type="button"
                    className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
                    onClick={() => removeMeasurement(index)}
                    aria-label="Remove measurement"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}
        <div className="mt-3 grid gap-2 sm:grid-cols-[1.2fr_0.7fr_0.9fr_auto]">
          <div className="space-y-1">
            <Label className="text-[11px] text-muted-foreground">What are you measuring?</Label>
            <Input
              placeholder="e.g. Square footage, Pipe length, System tonnage"
              value={measurementLabel}
              disabled={saving}
              onChange={(e) => setMeasurementLabel(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-[11px] text-muted-foreground">Value (number)</Label>
            <Input
              placeholder="e.g. 1800"
              value={measurementValue}
              disabled={saving}
              onChange={(e) => setMeasurementValue(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-[11px] text-muted-foreground">Unit</Label>
            <Select
              value={measurementUnit}
              disabled={saving}
              onValueChange={setMeasurementUnit}
            >
              <SelectTrigger>
                <SelectValue placeholder="Unit" />
              </SelectTrigger>
              <SelectContent>
                {MEASUREMENT_UNITS.map((unit) => (
                  <SelectItem key={unit.value} value={unit.value}>
                    {unit.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <Button
              size="sm"
              variant="outline"
              disabled={saving}
              onClick={addMeasurement}
            >
              <Plus className="size-3.5" />
              Add
            </Button>
          </div>
        </div>
      </div>

      <div className="mt-5 space-y-1.5">
        <Label htmlFor="existing-findings">Information / notes</Label>
        <Textarea
          id="existing-findings"
          rows={3}
          value={findings}
          disabled={saving}
          onChange={(e) => onFindingsChange(e.target.value)}
          placeholder="What you already know about the job…"
        />
      </div>

      <div className="mt-5">
        <WorkItemsEditor
          items={workItems}
          onChange={onWorkItemsChange}
          disabled={saving}
          hint="Labour, materials, and equipment identified here become the starting line items on the estimate."
        />
      </div>

      <div className="mt-5 flex flex-wrap gap-2 border-t border-input pt-4">
        <Button size="sm" variant="outline" disabled={saving} onClick={() => void onSave()}>
          Save information
        </Button>
        <Button size="sm" disabled={saving} onClick={() => void onContinue()}>
          Continue to estimate
        </Button>
      </div>
    </div>
  );
}
