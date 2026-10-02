"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarClock,
  Check,
  ImagePlus,
  Loader2,
  Plus,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { extractUploadedUrl, uploadFile } from "@/components/api/uploadFile";
import {
  createEstimateV2SiteAssessment,
  updateEstimateV2SiteAssessment,
  type AssessmentWorkItem,
  type EstimateV2SiteAssessment,
  type VisitType,
} from "@/lib/api/estimate-v2-client";
import { WorkItemsEditor } from "@/components/portal/estimate-v2/work-items-editor";
import { employeeName, type PortalEmployee } from "@/lib/data/portal";
import { formatDate } from "@/lib/format";
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

const VISIT_TYPE_OPTIONS: Array<{ value: VisitType; label: string }> = [
  { value: "initial_assessment", label: "Initial Assessment" },
  { value: "follow_up_assessment", label: "Follow-up Assessment" },
  { value: "measurement", label: "Measurement" },
  { value: "inspection", label: "Inspection" },
  { value: "customer_walkthrough", label: "Customer Walkthrough" },
  { value: "estimate_review", label: "Estimate Review" },
  { value: "other", label: "Other" },
];

function visitTypeLabel(visit: EstimateV2SiteAssessment) {
  return (
    visit.visitTypeLabel ||
    VISIT_TYPE_OPTIONS.find((item) => item.value === visit.visitType)?.label ||
    "Site Visit"
  );
}

function statusLabel(status: string) {
  return status.replace(/_/g, " ");
}

function toLocalInput(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

type SiteVisitsPanelProps = {
  opportunityId: string;
  opportunityTitle?: string;
  visits: EstimateV2SiteAssessment[];
  employees: PortalEmployee[];
  saving: boolean;
  onRefresh: () => Promise<void>;
  onSavingChange: (value: boolean) => void;
};

export function SiteVisitsPanel({
  opportunityId,
  opportunityTitle,
  visits,
  employees,
  saving,
  onRefresh,
  onSavingChange,
}: SiteVisitsPanelProps) {
  const photoInputRef = useRef<HTMLInputElement>(null);
  const sortedVisits = useMemo(
    () =>
      [...visits].sort(
        (a, b) =>
          (a.sequenceNumber || 0) - (b.sequenceNumber || 0) ||
          String(a.createdAt || "").localeCompare(String(b.createdAt || "")),
      ),
    [visits],
  );

  const [selectedId, setSelectedId] = useState<string>("");
  const selected =
    sortedVisits.find((item) => item.id === selectedId) ||
    sortedVisits[sortedVisits.length - 1] ||
    null;

  useEffect(() => {
    if (!sortedVisits.length) {
      setSelectedId("");
      return;
    }
    if (!selectedId || !sortedVisits.some((item) => item.id === selectedId)) {
      const open =
        sortedVisits.find((item) =>
          ["scheduled", "rescheduled", "in_progress"].includes(item.status),
        ) || sortedVisits[sortedVisits.length - 1];
      setSelectedId(open.id);
    }
  }, [sortedVisits, selectedId]);

  const [employeeId, setEmployeeId] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [findings, setFindings] = useState("");
  const [customerRequirements, setCustomerRequirements] = useState("");
  const [workItems, setWorkItems] = useState<AssessmentWorkItem[]>([]);
  const [measurementLabel, setMeasurementLabel] = useState("");
  const [measurementValue, setMeasurementValue] = useState("");
  const [measurementUnit, setMeasurementUnit] = useState("sq ft");
  const [photoDragOver, setPhotoDragOver] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const [followUpOpen, setFollowUpOpen] = useState(false);
  const [followUpType, setFollowUpType] = useState<VisitType>("follow_up_assessment");
  const [followUpAt, setFollowUpAt] = useState("");
  const [followUpEmployeeId, setFollowUpEmployeeId] = useState("");
  const [followUpInstructions, setFollowUpInstructions] = useState("");

  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [rescheduleAt, setRescheduleAt] = useState("");
  const [rescheduleReason, setRescheduleReason] = useState("");

  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");

  useEffect(() => {
    if (!selected) {
      setEmployeeId("");
      setScheduledAt("");
      setFindings("");
      setCustomerRequirements("");
      setWorkItems([]);
      return;
    }
    setEmployeeId(String(selected.assignedEmployeeId || ""));
    setScheduledAt(toLocalInput(selected.scheduledAt));
    setFindings(selected.findings || "");
    setCustomerRequirements(selected.customerRequirements || "");
    setWorkItems(
      (selected.workItems || []).map((item, index) => {
        const typeRaw = String(item.type || "labor").toLowerCase();
        const type =
          typeRaw === "equipment"
            ? ("equipment" as const)
            : typeRaw === "material" || typeRaw === "materials"
              ? ("material" as const)
              : ("labor" as const);
        return {
          ...item,
          id: item.id || `wi_${selected.id}_${index}`,
          description: item.description || "",
          type,
          quantity: item.quantity ?? 1,
          unit: item.unit || (type === "labor" ? "hr" : "ea"),
          unitPrice: item.unitPrice ?? null,
        };
      }),
    );
  }, [selected?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const canEditCapture =
    Boolean(selected) && !["cancelled", "no_show"].includes(selected?.status || "");

  const canReschedule =
    Boolean(selected) &&
    ["scheduled", "rescheduled", "in_progress"].includes(selected?.status || "");

  const canCancel =
    Boolean(selected) &&
    ["scheduled", "rescheduled", "in_progress"].includes(selected?.status || "");

  async function saveVisit(patch: { complete?: boolean } = {}) {
    if (!selected) return;
    onSavingChange(true);
    try {
      const employee = employees.find((item) => item.id === employeeId);
      await updateEstimateV2SiteAssessment(selected.id, {
        assignedEmployeeId: employeeId || null,
        assignedEmployeeName: employee
          ? employeeName(employee)
          : selected.assignedEmployeeName,
        scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : null,
        findings,
        customerRequirements,
        measurements: selected.measurements || [],
        workItems: workItems.filter((item) => String(item.description || "").trim()),
        photos: selected.photos || [],
        status: patch.complete
          ? "completed"
          : selected.status === "completed"
            ? "completed"
            : "in_progress",
      });
      toast.success(patch.complete ? "Visit completed." : "Visit saved.");
      await onRefresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save visit.");
    } finally {
      onSavingChange(false);
    }
  }

  async function addMeasurement() {
    if (!selected) return;
    if (!measurementLabel.trim()) {
      toast.error("Enter what you measured (e.g. Square footage, Pipe length).");
      return;
    }
    if (!measurementValue.trim()) {
      toast.error("Enter the numeric value (e.g. 1800).");
      return;
    }
    onSavingChange(true);
    try {
      await updateEstimateV2SiteAssessment(selected.id, {
        measurements: [
          ...(selected.measurements || []),
          {
            label: measurementLabel.trim(),
            value: measurementValue.trim(),
            unit: measurementUnit.trim(),
          },
        ],
      });
      setMeasurementLabel("");
      setMeasurementValue("");
      setMeasurementUnit("sq ft");
      await onRefresh();
      toast.success("Measurement added.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not add measurement.");
    } finally {
      onSavingChange(false);
    }
  }

  async function removeMeasurement(index: number) {
    if (!selected) return;
    onSavingChange(true);
    try {
      await updateEstimateV2SiteAssessment(selected.id, {
        measurements: (selected.measurements || []).filter((_, i) => i !== index),
      });
      await onRefresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not remove measurement.");
    } finally {
      onSavingChange(false);
    }
  }

  async function uploadPhotos(files: FileList | File[] | null) {
    if (!files || !files.length || !selected) return;
    setUploadingPhoto(true);
    try {
      const uploaded: Array<{ url: string; caption?: string }> = [];
      for (const file of Array.from(files)) {
        if (!file.type.startsWith("image/")) continue;
        const result = await uploadFile(file);
        const url = extractUploadedUrl(result);
        if (url) uploaded.push({ url, caption: file.name });
      }
      if (!uploaded.length) throw new Error("No images uploaded.");
      await updateEstimateV2SiteAssessment(selected.id, {
        photos: [...(selected.photos || []), ...uploaded],
      });
      await onRefresh();
      toast.success(uploaded.length === 1 ? "Photo added." : `${uploaded.length} photos added.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not upload photos.");
    } finally {
      setUploadingPhoto(false);
      if (photoInputRef.current) photoInputRef.current.value = "";
    }
  }

  async function removePhoto(url: string) {
    if (!selected) return;
    onSavingChange(true);
    try {
      await updateEstimateV2SiteAssessment(selected.id, {
        photos: (selected.photos || []).filter((item) => item.url !== url),
      });
      await onRefresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not remove photo.");
    } finally {
      onSavingChange(false);
    }
  }

  async function scheduleFollowUp() {
    if (!followUpAt) {
      toast.error("Pick a date and time for the follow-up visit.");
      return;
    }
    onSavingChange(true);
    try {
      const employee = employees.find((item) => item.id === followUpEmployeeId);
      const created = await createEstimateV2SiteAssessment(opportunityId, {
        visitType: followUpType,
        visitTypeLabel: VISIT_TYPE_OPTIONS.find((item) => item.value === followUpType)?.label,
        scheduledAt: new Date(followUpAt).toISOString(),
        assignedEmployeeId: followUpEmployeeId || undefined,
        assignedEmployeeName: employee ? employeeName(employee) : undefined,
        instructions:
          followUpInstructions.trim() || opportunityTitle || "Follow-up site visit",
        status: "scheduled",
      });
      setFollowUpOpen(false);
      setFollowUpAt("");
      setFollowUpInstructions("");
      setFollowUpEmployeeId("");
      setFollowUpType("follow_up_assessment");
      await onRefresh();
      setSelectedId(created.id);
      toast.success(
        `${created.number} scheduled — Visit #${created.sequenceNumber || ""}`,
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not schedule follow-up.");
    } finally {
      onSavingChange(false);
    }
  }

  async function confirmReschedule() {
    if (!selected || !rescheduleAt) {
      toast.error("Pick the new date and time.");
      return;
    }
    onSavingChange(true);
    try {
      await updateEstimateV2SiteAssessment(selected.id, {
        reschedule: true,
        scheduledAt: new Date(rescheduleAt).toISOString(),
        rescheduleReason: rescheduleReason.trim() || "Customer requested",
        assignedEmployeeId: employeeId || selected.assignedEmployeeId || null,
      });
      setRescheduleOpen(false);
      setRescheduleReason("");
      await onRefresh();
      toast.success("Visit rescheduled (same visit, new time).");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not reschedule.");
    } finally {
      onSavingChange(false);
    }
  }

  async function confirmCancel() {
    if (!selected) return;
    onSavingChange(true);
    try {
      await updateEstimateV2SiteAssessment(selected.id, {
        status: "cancelled",
        cancellationReason: cancelReason.trim() || "Cancelled",
      });
      setCancelOpen(false);
      setCancelReason("");
      await onRefresh();
      toast.success("Visit cancelled.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not cancel visit.");
    } finally {
      onSavingChange(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-input bg-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">Site visits</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              One estimate can have many visits. Reschedule changes the same appointment;
              follow-up creates a new visit.
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            disabled={saving}
            onClick={() => {
              setFollowUpType(sortedVisits.length ? "follow_up_assessment" : "initial_assessment");
              setFollowUpOpen(true);
            }}
          >
            <Plus className="size-3.5" />
            Schedule {sortedVisits.length ? "follow-up" : ""} visit
          </Button>
        </div>

        {sortedVisits.length ? (
          <div className="mt-4 grid gap-2">
            {sortedVisits.map((visit) => {
              const active = visit.id === selected?.id;
              const photoCount = visit.photos?.length || 0;
              const measureCount = visit.measurements?.length || 0;
              const workCount = (visit.workItems || []).filter((item) =>
                String(item.description || "").trim(),
              ).length;
              const noteBits = [
                visit.findings,
                visit.customerRequirements,
                visit.notes,
              ].filter((part) => String(part || "").trim()).length;
              return (
                <button
                  key={visit.id}
                  type="button"
                  onClick={() => setSelectedId(visit.id)}
                  className={cn(
                    "w-full rounded-lg border px-3 py-3 text-left transition",
                    active
                      ? "border-primary bg-primary/5 shadow-[inset_0_0_0_1px_hsl(var(--primary))]"
                      : "border-input hover:border-primary/40 hover:bg-secondary/40",
                  )}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold">
                        Visit #{visit.sequenceNumber || "—"} · {visitTypeLabel(visit)}
                      </p>
                      <p className="mt-0.5 text-xs capitalize text-muted-foreground">
                        {statusLabel(visit.status)}
                        {visit.scheduledAt ? ` · ${formatDate(visit.scheduledAt)}` : ""}
                        {visit.assignedEmployeeName ? ` · ${visit.assignedEmployeeName}` : ""}
                      </p>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        {photoCount} photo{photoCount === 1 ? "" : "s"} · {noteBits} note
                        {noteBits === 1 ? "" : "s"} · {measureCount} measurement
                        {measureCount === 1 ? "" : "s"} · {workCount} work item
                        {workCount === 1 ? "" : "s"}
                        {visit.number ? ` · ${visit.number}` : ""}
                      </p>
                    </div>
                    {active ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-primary-foreground">
                        <Check className="size-2.5" />
                        Viewing
                      </span>
                    ) : null}
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <p className="mt-4 rounded-lg border border-dashed border-input px-4 py-6 text-center text-sm text-muted-foreground">
            No visits yet. Schedule an initial assessment or skip visits and build the estimate from
            known details.
          </p>
        )}
      </div>

      {selected ? (
        <div className="rounded-xl border border-input bg-card p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-semibold">
                Visit #{selected.sequenceNumber || "—"} · {visitTypeLabel(selected)}
              </h2>
              <p className="text-xs capitalize text-muted-foreground">
                {selected.number} · {statusLabel(selected.status)}
              </p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {canReschedule ? (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={saving}
                  onClick={() => {
                    setRescheduleAt(toLocalInput(selected.scheduledAt) || scheduledAt);
                    setRescheduleOpen(true);
                  }}
                >
                  <CalendarClock className="size-3.5" />
                  Reschedule
                </Button>
              ) : null}
              {canCancel ? (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={saving}
                  onClick={() => setCancelOpen(true)}
                >
                  <X className="size-3.5" />
                  Cancel
                </Button>
              ) : null}
            </div>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Assigned technician</Label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                value={employeeId}
                disabled={!canEditCapture || saving}
                onChange={(e) => setEmployeeId(e.target.value)}
              >
                <option value="">Unassigned</option>
                {employees.map((item) => (
                  <option key={item.id} value={item.id}>
                    {employeeName(item)}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="visit-when">Date / time</Label>
              <Input
                id="visit-when"
                type="datetime-local"
                value={scheduledAt}
                disabled={!canEditCapture || saving}
                onChange={(e) => setScheduledAt(e.target.value)}
              />
              <p className="text-[11px] text-muted-foreground">
                Use Reschedule to change time with a reason and keep history on this visit.
              </p>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="visit-findings">Findings</Label>
              <Textarea
                id="visit-findings"
                rows={3}
                value={findings}
                disabled={!canEditCapture || saving}
                onChange={(e) => setFindings(e.target.value)}
                placeholder="What the technician discovered on site…"
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="visit-req">Customer requirements</Label>
              <Textarea
                id="visit-req"
                rows={2}
                value={customerRequirements}
                disabled={!canEditCapture || saving}
                onChange={(e) => setCustomerRequirements(e.target.value)}
                placeholder="What the customer wants (efficiency, finish date, preferences)…"
              />
            </div>
          </div>

          <div className="mt-5">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Photos
            </h3>
            <div
              className={cn(
                "mt-2 rounded-xl border-2 border-dashed px-4 py-6 text-center transition",
                photoDragOver ? "border-primary bg-primary/5" : "border-input bg-secondary/20",
                (!canEditCapture || uploadingPhoto) && "opacity-70",
              )}
              onDragEnter={(e) => {
                e.preventDefault();
                setPhotoDragOver(true);
              }}
              onDragOver={(e) => {
                e.preventDefault();
                setPhotoDragOver(true);
              }}
              onDragLeave={(e) => {
                e.preventDefault();
                setPhotoDragOver(false);
              }}
              onDrop={(e) => {
                e.preventDefault();
                setPhotoDragOver(false);
                if (canEditCapture) void uploadPhotos(e.dataTransfer.files);
              }}
            >
              <input
                ref={photoInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => void uploadPhotos(e.target.files)}
              />
              <div className="mx-auto flex size-10 items-center justify-center rounded-full border border-input bg-background">
                {uploadingPhoto ? (
                  <Loader2 className="size-4 animate-spin text-muted-foreground" />
                ) : (
                  <Upload className="size-4 text-muted-foreground" />
                )}
              </div>
              <p className="mt-2 text-sm font-medium">
                {uploadingPhoto ? "Uploading…" : "Drag & drop photos here"}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Photos stay on this visit only — not shared with other visits
              </p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="mt-3"
                disabled={uploadingPhoto || !canEditCapture}
                onClick={() => photoInputRef.current?.click()}
              >
                <ImagePlus className="size-3.5" />
                Browse files
              </Button>
            </div>
            {(selected.photos?.length || 0) > 0 ? (
              <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
                {selected.photos?.map((photo) => (
                  <div
                    key={photo.url}
                    className="group relative aspect-square overflow-hidden rounded-lg border border-input bg-secondary/30"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={photo.url}
                      alt={photo.caption || "Visit photo"}
                      className="size-full object-cover"
                    />
                    {canEditCapture ? (
                      <button
                        type="button"
                        className="absolute right-1 top-1 rounded-md bg-black/70 p-1 text-white opacity-0 transition group-hover:opacity-100"
                        onClick={() => void removePhoto(photo.url)}
                        aria-label="Remove photo"
                      >
                        <Trash2 className="size-3" />
                      </button>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          <div className="mt-5">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Measurements
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              What = the thing measured · Value = the number · Unit = how it is measured
            </p>
            {(selected.measurements?.length || 0) > 0 ? (
              <ul className="mt-3 divide-y divide-input rounded-lg border border-input">
                {selected.measurements?.map((item, index) => (
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
                    {canEditCapture ? (
                      <button
                        type="button"
                        className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
                        onClick={() => void removeMeasurement(index)}
                        aria-label="Remove measurement"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : null}
            {canEditCapture ? (
              <div className="mt-3 grid gap-2 sm:grid-cols-[1.2fr_0.7fr_0.9fr_auto]">
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground">What are you measuring?</Label>
                  <Input
                    placeholder="e.g. Square footage, Pipe length, System tonnage"
                    value={measurementLabel}
                    onChange={(e) => setMeasurementLabel(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground">Value (number)</Label>
                  <Input
                    placeholder="e.g. 1800"
                    value={measurementValue}
                    onChange={(e) => setMeasurementValue(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground">Unit</Label>
                  <Select value={measurementUnit} onValueChange={setMeasurementUnit}>
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
                    onClick={() => void addMeasurement()}
                  >
                    <Plus className="size-3.5" />
                    Add
                  </Button>
                </div>
              </div>
            ) : null}
          </div>

          <div className="mt-5 border-t border-input pt-5">
            <WorkItemsEditor
              items={workItems}
              onChange={setWorkItems}
              disabled={!canEditCapture || saving}
            />
            {canEditCapture ? (
              <p className="mt-2 text-[11px] text-muted-foreground">
                Save or complete the visit to persist work items. They seed the estimate automatically.
              </p>
            ) : null}
          </div>

          {(selected.scheduleHistory?.length || 0) > 0 ? (
            <div className="mt-5 rounded-lg border border-input bg-secondary/20 px-3 py-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Visit schedule history
              </h3>
              <ol className="mt-2 space-y-1.5">
                {[...(selected.scheduleHistory || [])]
                  .slice()
                  .reverse()
                  .slice(0, 6)
                  .map((item, index) => (
                    <li key={`${item.at}-${index}`} className="text-xs text-muted-foreground">
                      <span className="font-medium capitalize text-foreground">
                        {(item.action || "update").replace(/_/g, " ")}
                      </span>
                      {item.fromScheduledAt || item.toScheduledAt
                        ? ` · ${item.fromScheduledAt ? formatDate(item.fromScheduledAt) : "—"} → ${
                            item.toScheduledAt ? formatDate(item.toScheduledAt) : "—"
                          }`
                        : ""}
                      {item.reason ? ` · ${item.reason}` : ""}
                    </li>
                  ))}
              </ol>
            </div>
          ) : null}

          {canEditCapture ? (
            <div className="mt-5 flex flex-wrap gap-2 border-t border-input pt-4">
              <Button size="sm" variant="outline" disabled={saving} onClick={() => void saveVisit()}>
                Save visit
              </Button>
              {selected.status !== "completed" ? (
                <Button size="sm" disabled={saving} onClick={() => void saveVisit({ complete: true })}>
                  Complete visit
                </Button>
              ) : null}
            </div>
          ) : null}
          {selected.completedAt ? (
            <p className="mt-2 text-xs text-muted-foreground">
              Completed {formatDate(selected.completedAt)}
            </p>
          ) : null}
          {selected.cancellationReason ? (
            <p className="mt-2 text-xs text-amber-700">Cancelled: {selected.cancellationReason}</p>
          ) : null}
        </div>
      ) : null}

      <Dialog open={followUpOpen} onOpenChange={setFollowUpOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {sortedVisits.length ? "Schedule follow-up visit" : "Schedule site visit"}
            </DialogTitle>
            <DialogDescription>
              Creates a <span className="font-medium text-foreground">new</span> visit on this
              estimate. Photos and measurements stay on each visit separately.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="space-y-1.5">
              <Label>Visit type</Label>
              <Select
                value={followUpType}
                onValueChange={(value) => setFollowUpType(value as VisitType)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {VISIT_TYPE_OPTIONS.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Date / time</Label>
              <Input
                type="datetime-local"
                value={followUpAt}
                onChange={(e) => setFollowUpAt(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Technician</Label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                value={followUpEmployeeId}
                onChange={(e) => setFollowUpEmployeeId(e.target.value)}
              >
                <option value="">Unassigned</option>
                {employees.map((item) => (
                  <option key={item.id} value={item.id}>
                    {employeeName(item)}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Instructions</Label>
              <Textarea
                rows={2}
                value={followUpInstructions}
                onChange={(e) => setFollowUpInstructions(e.target.value)}
                placeholder="What should this visit accomplish?"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFollowUpOpen(false)}>
              Back
            </Button>
            <Button disabled={saving} onClick={() => void scheduleFollowUp()}>
              Schedule visit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={rescheduleOpen} onOpenChange={setRescheduleOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reschedule visit</DialogTitle>
            <DialogDescription>
              Updates <span className="font-medium text-foreground">this same visit</span> — does not
              create Visit #{(selected?.sequenceNumber || 0) + 1}.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="space-y-1.5">
              <Label>New date / time</Label>
              <Input
                type="datetime-local"
                value={rescheduleAt}
                onChange={(e) => setRescheduleAt(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Reason</Label>
              <Input
                value={rescheduleReason}
                onChange={(e) => setRescheduleReason(e.target.value)}
                placeholder="Customer requested, weather, technician conflict…"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRescheduleOpen(false)}>
              Back
            </Button>
            <Button disabled={saving} onClick={() => void confirmReschedule()}>
              Save new time
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel visit</DialogTitle>
            <DialogDescription>
              Cancels this visit only. Other visits and the estimate stay unchanged.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5 py-2">
            <Label>Reason</Label>
            <Input
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="Customer cancelled, no access…"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelOpen(false)}>
              Back
            </Button>
            <Button variant="destructive" disabled={saving} onClick={() => void confirmCancel()}>
              Cancel visit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
