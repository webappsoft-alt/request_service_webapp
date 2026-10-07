"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarClock,
  Check,
  ChevronDown,
  ImagePlus,
  Loader2,
  Plus,
  Trash2,
  Upload,
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
import { CreateEmployeeDialog } from "@/components/portal/create-employee-dialog";
import { usePortalCrew } from "@/components/portal/use-portal-crew";
import {
  createEstimateV2SiteAssessment,
  deleteEstimateV2SiteAssessment,
  updateEstimateV2SiteAssessment,
  type AssessmentWorkItem,
  type EstimateV2SiteAssessment,
  type VisitType,
} from "@/lib/api/estimate-v2-client";
import { WorkItemsEditor } from "@/components/portal/estimate-v2/work-items-editor";
import { employeeName, type PortalEmployee } from "@/lib/data/portal";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { DateTimeField } from "@/components/ui/date-time-field";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { selectAuth } from "@/store/authSlice";
import { fetchTeam } from "@/store/teamSlice";

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

function statusTone(status: string) {
  const key = status.toLowerCase();
  if (key.includes("completed")) return "bg-emerald-50 text-emerald-800 ring-emerald-200/70";
  if (key.includes("scheduled") || key.includes("rescheduled") || key.includes("progress")) {
    return "bg-sky-50 text-sky-800 ring-sky-200/70";
  }
  if (key.includes("cancel")) return "bg-rose-50 text-rose-800 ring-rose-200/70";
  return "bg-slate-100 text-slate-700 ring-slate-200/70";
}

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

/** Shared look for every field in the schedule dialog — same height, stroke and fill. */
const DIALOG_FIELD = "h-10 w-full rounded-lg border-input bg-white px-3 text-sm shadow-none";
/** Radix Select cannot use "" as an item value. */
const UNASSIGNED = "__unassigned";

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
  /** From estimate create — used to prefill initial assessment fields when visit copies are empty. */
  opportunityDescription?: string;
  opportunityInternalNotes?: string;
  visits: EstimateV2SiteAssessment[];
  employees: PortalEmployee[];
  saving: boolean;
  onRefresh: (options?: { silent?: boolean }) => Promise<void>;
  onSavingChange: (value: boolean) => void;
  /** Show Build / View estimate in the visit header. */
  showBuildEstimate?: boolean;
  hasEstimate?: boolean;
  onBuildEstimate?: () => void | Promise<void>;
  /** Controlled collapse — when open, parent should hide the estimate builder. */
  collapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
};

export function SiteVisitsPanel({
  opportunityId,
  opportunityTitle,
  opportunityDescription = "",
  opportunityInternalNotes = "",
  visits,
  employees,
  saving,
  onRefresh,
  onSavingChange,
  showBuildEstimate = false,
  hasEstimate = false,
  onBuildEstimate,
  collapsed,
  onCollapsedChange,
}: SiteVisitsPanelProps) {
  const photoInputRef = useRef<HTMLInputElement>(null);
  const dispatch = useAppDispatch();
  const auth = useAppSelector(selectAuth);
  const { employees: liveEmployees } = usePortalCrew();
  const [selectedId, setSelectedId] = useState<string>("");
  const [detailOpen, setDetailOpen] = useState(true);
  const [internalCollapsed, setInternalCollapsed] = useState(Boolean(hasEstimate));
  const visitsCollapsed = collapsed ?? internalCollapsed;

  function setVisitsCollapsed(next: boolean) {
    setInternalCollapsed(next);
    onCollapsedChange?.(next);
  }
  const [locallyRemovedIds, setLocallyRemovedIds] = useState<string[]>([]);
  const sortedVisits = useMemo(
    () =>
      [...visits]
        .filter((item) => !locallyRemovedIds.includes(item.id))
        .sort(
          (a, b) =>
            (a.sequenceNumber || 0) - (b.sequenceNumber || 0) ||
            String(a.createdAt || "").localeCompare(String(b.createdAt || "")),
        ),
    [visits, locallyRemovedIds],
  );
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

  useEffect(() => {
    setDetailOpen(true);
  }, [selected?.id]);

  useEffect(() => {
    if (!locallyRemovedIds.length) return;
    const liveIds = new Set(visits.map((item) => item.id));
    setLocallyRemovedIds((prev) => prev.filter((id) => liveIds.has(id)));
  }, [visits, locallyRemovedIds.length]);

  const [employeeId, setEmployeeId] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [findings, setFindings] = useState("");
  const [customerRequirements, setCustomerRequirements] = useState("");
  const [workItems, setWorkItems] = useState<AssessmentWorkItem[]>([]);
  const [measurements, setMeasurements] = useState<
    Array<{ label: string; value?: string; unit?: string }>
  >([]);
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

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [createEmployeeOpen, setCreateEmployeeOpen] = useState(false);
  const [createEmployeeTarget, setCreateEmployeeTarget] = useState<"visit" | "followUp">("visit");
  const [createdEmployees, setCreatedEmployees] = useState<PortalEmployee[]>([]);
  const [savedVisitIds, setSavedVisitIds] = useState<string[]>([]);

  const assignableEmployees = useMemo(() => {
    const byId = new Map<string, PortalEmployee>();
    for (const item of [...employees, ...liveEmployees, ...createdEmployees]) {
      if (!item?.id) continue;
      if (item.active === false) continue;
      // Ignore legacy local-only fake ids — technicians must come from the team API.
      if (String(item.id).startsWith("emp_custom_")) continue;
      byId.set(String(item.id), item);
    }
    return Array.from(byId.values()).sort((a, b) =>
      employeeName(a).localeCompare(employeeName(b)),
    );
  }, [createdEmployees, employees, liveEmployees]);

  const showTechnicianDropdown = assignableEmployees.length > 0;

  function openCreateEmployee(target: "visit" | "followUp") {
    setCreateEmployeeTarget(target);
    setCreateEmployeeOpen(true);
  }

  function handleEmployeeCreated(created: PortalEmployee) {
    const id = String(created?.id || "").trim();
    if (!id || id.startsWith("emp_custom_")) {
      toast.error("Technician was not saved to the server. Try again.");
      return;
    }
    const next = { ...created, id, active: created.active !== false };
    setCreatedEmployees((prev) =>
      prev.some((item) => String(item.id) === id) ? prev : [...prev, next],
    );
    if (createEmployeeTarget === "followUp") {
      setFollowUpEmployeeId(id);
    } else {
      setEmployeeId(id);
    }
  }

  useEffect(() => {
    if (!auth.token) return;
    void dispatch(fetchTeam({ force: true, limit: 100 }));
  }, [auth.token, dispatch]);

  // Drop any previously cached local fake technicians from this panel.
  useEffect(() => {
    setCreatedEmployees((prev) => prev.filter((item) => !String(item.id).startsWith("emp_custom_")));
    setEmployeeId((prev) => (String(prev).startsWith("emp_custom_") ? "" : prev));
    setFollowUpEmployeeId((prev) => (String(prev).startsWith("emp_custom_") ? "" : prev));
  }, []);

  useEffect(() => {
    if (!selected) {
      setEmployeeId("");
      setScheduledAt("");
      setFindings("");
      setCustomerRequirements("");
      setWorkItems([]);
      setMeasurements([]);
      return;
    }

    const isInitialVisit =
      selected.visitType === "initial_assessment" ||
      Number(selected.sequenceNumber || 0) <= 1;
    const defaultRequirements = String(opportunityDescription || "").trim();
    const defaultFindings =
      String(opportunityInternalNotes || "").trim() || defaultRequirements;

    setEmployeeId(String(selected.assignedEmployeeId || ""));
    setScheduledAt(toLocalInput(selected.scheduledAt));
    // Prefer visit-owned copies; fall back to estimate-create text for initial visits only.
    setFindings(
      String(selected.findings || "").trim()
        ? String(selected.findings)
        : isInitialVisit
          ? defaultFindings
          : "",
    );
    setCustomerRequirements(
      String(selected.customerRequirements || "").trim()
        ? String(selected.customerRequirements)
        : isInitialVisit
          ? defaultRequirements
          : "",
    );
    setMeasurements(selected.measurements || []);
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
  }, [selected?.id, opportunityDescription, opportunityInternalNotes]); // eslint-disable-line react-hooks/exhaustive-deps

  const canEditCapture =
    Boolean(selected) && !["cancelled", "no_show"].includes(selected?.status || "");

  const canReschedule =
    Boolean(selected) &&
    ["scheduled", "rescheduled", "in_progress"].includes(selected?.status || "");

  async function saveVisit(patch: { complete?: boolean } = {}) {
    if (!selected) return;
    onSavingChange(true);
    try {
      const employee = assignableEmployees.find((item) => item.id === employeeId);
      const rawEmployeeId = String(employeeId || "").trim();
      const validEmployeeId = /^[a-f\d]{24}$/i.test(rawEmployeeId) ? rawEmployeeId : null;
      if (rawEmployeeId && !validEmployeeId) {
        throw new Error(
          "Selected technician is not a saved team member. Create them again — they must be stored on the server.",
        );
      }

      let nextScheduledAt: string | null = null;
      if (scheduledAt) {
        const parsed = new Date(scheduledAt);
        if (Number.isNaN(parsed.getTime())) {
          throw new Error("Enter a valid date / time for the visit.");
        }
        nextScheduledAt = parsed.toISOString();
      }

      const payload: Parameters<typeof updateEstimateV2SiteAssessment>[1] = {
        assignedEmployeeId: validEmployeeId,
        assignedEmployeeName: validEmployeeId
          ? employee
            ? employeeName(employee)
            : selected.assignedEmployeeName || ""
          : "",
        scheduledAt: nextScheduledAt,
        findings,
        customerRequirements,
        measurements,
        workItems: workItems.filter((item) => String(item.description || "").trim()),
        photos: selected.photos || [],
      };

      if (patch.complete) {
        payload.status = "completed";
      } else if (
        selected.status === "scheduled" ||
        selected.status === "rescheduled" ||
        selected.status === "in_progress"
      ) {
        payload.status = "in_progress";
      }

      await updateEstimateV2SiteAssessment(selected.id, payload);
      setSavedVisitIds((prev) =>
        prev.includes(selected.id) ? prev : [...prev, selected.id],
      );
      toast.success(
        patch.complete
          ? "Visit completed."
          : savedVisitIds.includes(selected.id) ||
              selected.status === "in_progress" ||
              selected.status === "completed"
            ? "Visit updated."
            : "Visit saved.",
      );
      await onRefresh({ silent: true });
      if (patch.complete) {
        setVisitsCollapsed(true);
      }
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

    const previous = measurements;
    const next = [
      ...measurements,
      {
        label: measurementLabel.trim(),
        value: measurementValue.trim(),
        unit: measurementUnit.trim(),
      },
    ];
    // Append locally + persist quietly — do not reload the whole estimate workspace.
    setMeasurements(next);
    setMeasurementLabel("");
    setMeasurementValue("");

    try {
      await updateEstimateV2SiteAssessment(selected.id, { measurements: next });
    } catch (err) {
      setMeasurements(previous);
      toast.error(err instanceof Error ? err.message : "Could not add measurement.");
    }
  }

  async function removeMeasurement(index: number) {
    if (!selected) return;
    const previous = measurements;
    const next = measurements.filter((_, i) => i !== index);
    setMeasurements(next);
    try {
      await updateEstimateV2SiteAssessment(selected.id, { measurements: next });
    } catch (err) {
      setMeasurements(previous);
      toast.error(err instanceof Error ? err.message : "Could not remove measurement.");
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
      const employee = assignableEmployees.find((item) => item.id === followUpEmployeeId);
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

  async function confirmDeleteVisit() {
    if (!selected) return;
    const deletedId = selected.id;
    const label = `Visit #${selected.sequenceNumber || "—"}`;
    onSavingChange(true);
    try {
      await deleteEstimateV2SiteAssessment(deletedId);
      setDeleteOpen(false);
      setLocallyRemovedIds((prev) =>
        prev.includes(deletedId) ? prev : [...prev, deletedId],
      );
      setSelectedId("");
      await onRefresh({ silent: true });
      toast.success(`${label} deleted.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not delete visit.");
    } finally {
      onSavingChange(false);
    }
  }

  async function handleBuildEstimate() {
    setDetailOpen(false);
    setVisitsCollapsed(true);
    await onBuildEstimate?.();
  }

  if (visitsCollapsed) {
    const completedCount = sortedVisits.filter((visit) => visit.status === "completed").length;
    return (
      <div className="space-y-4">
        <div className="rounded-2xl border border-[#94a3b8] bg-white px-4 py-3 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              aria-expanded={false}
              onClick={() => setVisitsCollapsed(false)}
              className="group flex min-w-0 flex-1 items-center gap-2.5 rounded-lg text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              <span
                className="inline-flex size-7 shrink-0 items-center justify-center rounded-md border border-[#94a3b8] bg-[#f1f5f9] text-slate-700 transition-colors group-hover:border-slate-400 group-hover:bg-slate-200"
                aria-hidden="true"
              >
                <ChevronDown className="size-4 -rotate-90 stroke-[2.5]" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold tracking-tight text-slate-900">
                  Site visits
                </p>
                <p className="text-xs text-slate-500">
                  {sortedVisits.length
                    ? `${sortedVisits.length} visit${sortedVisits.length === 1 ? "" : "s"}${
                        completedCount ? ` · ${completedCount} completed` : ""
                      } — expand to manage`
                    : "No visits yet — expand to schedule"}
                </p>
              </div>
            </button>
            {showBuildEstimate && onBuildEstimate ? (
              <Button
                size="sm"
                disabled={saving}
                onClick={() => {
                  void handleBuildEstimate();
                }}
              >
                {hasEstimate ? "View estimate" : "Build estimate"}
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-[#94a3b8] bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-slate-900">Site visits</h2>
            <p className="mt-1 max-w-xl text-sm leading-relaxed text-slate-500">
              One estimate can have many visits. Reschedule changes the same appointment;
              follow-up creates a new visit.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={saving}
              onClick={() => setVisitsCollapsed(true)}
            >
              Collapse
            </Button>
            <Button
              size="sm"
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
                    "w-full rounded-xl border px-3.5 py-3 text-left transition",
                    active
                      ? "border-primary bg-primary/[0.05] ring-1 ring-primary/25"
                      : "border-[#94a3b8] bg-[#fafbfc] hover:border-primary/40 hover:bg-white",
                  )}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold tracking-tight text-slate-900">
                          Visit #{visit.sequenceNumber || "—"} · {visitTypeLabel(visit)}
                        </p>
                        <span
                          className={cn(
                            "inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ring-1 ring-inset",
                            statusTone(visit.status),
                          )}
                        >
                          {statusLabel(visit.status)}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-slate-500">
                        {visit.scheduledAt ? formatDate(visit.scheduledAt) : "No time set"}
                        {visit.assignedEmployeeName ? ` · ${visit.assignedEmployeeName}` : ""}
                      </p>
                      <p className="mt-1.5 text-[11px] text-slate-400">
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
          <p className="mt-4 rounded-xl border border-dashed border-[#94a3b8] bg-[#fafbfc] px-4 py-8 text-center text-sm text-slate-500">
            No visits yet. Schedule an initial assessment or skip visits and build the estimate from
            known details.
          </p>
        )}
      </div>

      {selected ? (
        <div className="rounded-2xl border border-[#94a3b8] bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#d8dee8] pb-4">
            <button
              type="button"
              aria-expanded={detailOpen}
              onClick={() => setDetailOpen((open) => !open)}
              className="group flex min-w-0 flex-1 items-start gap-2.5 rounded-lg text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              <span
                className={cn(
                  "mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-md border border-[#94a3b8] bg-[#f1f5f9] text-slate-700 transition-colors",
                  "group-hover:border-slate-400 group-hover:bg-slate-200",
                )}
                aria-hidden="true"
              >
                <ChevronDown
                  className={cn(
                    "size-4 stroke-[2.5] transition-transform duration-200",
                    detailOpen ? "rotate-0" : "-rotate-90",
                  )}
                />
              </span>
              <div className="min-w-0">
                <h2 className="text-lg font-semibold tracking-tight text-slate-900">
                  Visit #{selected.sequenceNumber || "—"} · {visitTypeLabel(selected)}
                </h2>
                <p className="mt-0.5 text-sm text-slate-500">
                  {selected.number} ·{" "}
                  <span className="capitalize">{statusLabel(selected.status)}</span>
                </p>
              </div>
            </button>
            <div className="flex flex-wrap gap-1.5">
              {showBuildEstimate && onBuildEstimate ? (
                <Button
                  size="sm"
                  disabled={saving}
                  onClick={() => {
                    void handleBuildEstimate();
                  }}
                >
                  {hasEstimate ? "View estimate" : "Build estimate"}
                </Button>
              ) : null}
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
              <Button
                size="sm"
                variant="outline"
                disabled={saving}
                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={() => setDeleteOpen(true)}
              >
                <Trash2 className="size-3.5" />
                Delete
              </Button>
            </div>
          </div>

          {!detailOpen ? (
            <p className="mt-4 text-sm leading-relaxed text-slate-500">
              {[
                selected.assignedEmployeeName || (employeeId ? "Technician assigned" : "Unassigned"),
                selected.scheduledAt ? formatDate(selected.scheduledAt) : null,
                `${selected.photos?.length || 0} photos`,
                `${(selected.workItems || []).filter((item) => String(item.description || "").trim()).length} work items`,
              ]
                .filter(Boolean)
                .join(" · ")}
              <span className="text-slate-400"> — expand to edit visit details</span>
            </p>
          ) : (
            <>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="visit-tech">Assigned technician</Label>
                {showTechnicianDropdown ? (
                  <button
                    type="button"
                    className="text-xs font-medium text-primary hover:underline"
                    disabled={!canEditCapture || saving}
                    onClick={() => openCreateEmployee("visit")}
                  >
                    + Create new
                  </button>
                ) : null}
              </div>
              {!showTechnicianDropdown ? (
                <button
                  type="button"
                  disabled={!canEditCapture || saving}
                  onClick={() => openCreateEmployee("visit")}
                  className="flex h-10 w-full items-center justify-center rounded-lg border border-dashed border-[#94a3b8] bg-[#fafbfc] px-3 text-sm font-medium text-primary transition hover:border-primary/50 hover:bg-primary/[0.04] disabled:opacity-60"
                >
                  No technicians yet — create one
                </button>
              ) : (
                <Select
                  value={employeeId || UNASSIGNED}
                  disabled={!canEditCapture || saving}
                  onValueChange={(value) => setEmployeeId(value === UNASSIGNED ? "" : value)}
                >
                  <SelectTrigger id="visit-tech" className={cn(DIALOG_FIELD, "bg-[#fafbfc]")}>
                    <SelectValue placeholder="Unassigned" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>
                    {assignableEmployees.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {employeeName(item)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="visit-when">Date / time</Label>
              <DateTimeField
                id="visit-when"
                value={scheduledAt}
                disabled={!canEditCapture || saving}
                onChange={setScheduledAt}
                fieldClassName={cn(DIALOG_FIELD, "bg-[#fafbfc]")}
              />
              <p className="text-[11px] leading-relaxed text-slate-400">
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
                className="bg-[#fafbfc]"
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
                className="bg-[#fafbfc]"
              />
            </div>
          </div>

          <div className="mt-6 border-t border-[#d8dee8] pt-5">
            <h3 className="text-[11px] font-semibold tracking-[0.1em] text-slate-500 uppercase">
              Photos
            </h3>
            <div
              className={cn(
                "mt-2.5 rounded-xl border-2 border-dashed px-4 py-7 text-center transition",
                photoDragOver ? "border-primary bg-primary/5" : "border-[#94a3b8] bg-[#fafbfc]",
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
              <div className="mx-auto flex size-10 items-center justify-center rounded-full border border-[#b4becc] bg-white">
                {uploadingPhoto ? (
                  <Loader2 className="size-4 animate-spin text-slate-400" />
                ) : (
                  <Upload className="size-4 text-slate-400" />
                )}
              </div>
              <p className="mt-2 text-sm font-medium text-slate-800">
                {uploadingPhoto ? "Uploading…" : "Drag & drop photos here"}
              </p>
              <p className="mt-0.5 text-xs text-slate-500">
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
                    className="group relative aspect-square overflow-hidden rounded-xl border border-[#b4becc] bg-[#f1f5f9]"
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

          <div className="mt-6 border-t border-[#d8dee8] pt-5">
            <h3 className="text-[11px] font-semibold tracking-[0.1em] text-slate-500 uppercase">
              Measurements
            </h3>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">
              What = the thing measured · Value = the number · Unit = how it is measured
            </p>
            {(measurements.length || 0) > 0 ? (
              <ul className="mt-3 divide-y divide-[#eef1f5] overflow-hidden rounded-xl border border-[#b4becc] bg-[#fafbfc]">
                {measurements.map((item, index) => (
                  <li
                    key={`${item.label}-${item.value}-${item.unit}-${index}`}
                    className="flex items-start justify-between gap-2 bg-white px-3.5 py-2.5 text-sm"
                  >
                    <span className="min-w-0 flex-1 break-words whitespace-normal leading-relaxed text-slate-900">
                      <span className="font-medium">{item.label}</span>
                      <span className="text-slate-500">
                        {" · "}
                        {item.value}
                        {item.unit ? ` ${item.unit}` : ""}
                      </span>
                    </span>
                    {canEditCapture ? (
                      <button
                        type="button"
                        className="mt-0.5 shrink-0 rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
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
              <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_5.5rem_8.5rem_auto] sm:items-center">
                <div className="min-w-0 space-y-1">
                  <Label className="text-[11px] text-slate-500">What are you measuring?</Label>
                  <Input
                    placeholder="e.g. Square footage, Pipe length, System tonnage"
                    value={measurementLabel}
                    onChange={(e) => setMeasurementLabel(e.target.value)}
                    className="h-9 bg-[#fafbfc]"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        void addMeasurement();
                      }
                    }}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] text-slate-500">Value</Label>
                  <Input
                    placeholder="1800"
                    value={measurementValue}
                    onChange={(e) => setMeasurementValue(e.target.value)}
                    className="h-9 bg-[#fafbfc]"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        void addMeasurement();
                      }
                    }}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] text-slate-500">Unit</Label>
                  <Select value={measurementUnit} onValueChange={setMeasurementUnit}>
                    <SelectTrigger className="h-9 bg-[#fafbfc]">
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
                <Button
                  type="button"
                  size="sm"
                  onClick={() => void addMeasurement()}
                  className="mt-5 h-8 px-2.5 text-xs"
                >
                  <Plus className="size-3" />
                  Add more
                </Button>
              </div>
            ) : null}
          </div>

          <div className="mt-6 border-t border-[#d8dee8] pt-5">
            <WorkItemsEditor
              items={workItems}
              onChange={setWorkItems}
              disabled={!canEditCapture || saving}
            />
            {canEditCapture ? (
              <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
                Save or complete the visit to persist work items. They seed the estimate automatically.
              </p>
            ) : null}
          </div>

          {(selected.scheduleHistory?.length || 0) > 0 ? (
            <div className="mt-6 rounded-xl border border-[#b4becc] bg-[#f8fafc] px-4 py-3.5">
              <h3 className="text-[11px] font-semibold tracking-[0.1em] text-slate-500 uppercase">
                Visit schedule history
              </h3>
              <ol className="mt-2.5 space-y-2">
                {[...(selected.scheduleHistory || [])]
                  .slice()
                  .reverse()
                  .slice(0, 6)
                  .map((item, index) => (
                    <li key={`${item.at}-${index}`} className="text-xs leading-relaxed text-slate-500">
                      <span className="font-medium capitalize text-slate-800">
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
            <div className="mt-6 flex flex-wrap gap-2 border-t border-[#d8dee8] pt-4">
              <Button
                size="sm"
                disabled={saving}
                onClick={() => void saveVisit()}
              >
                {savedVisitIds.includes(selected.id) ||
                selected.status === "in_progress" ||
                selected.status === "completed"
                  ? "Update visit"
                  : "Save visit"}
              </Button>
              {selected.status !== "completed" ? (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={saving}
                  onClick={() => void saveVisit({ complete: true })}
                >
                  Complete visit
                </Button>
              ) : null}
            </div>
          ) : null}
          {selected.completedAt ? (
            <p className="mt-2 text-xs text-slate-500">
              Completed {formatDate(selected.completedAt)}
            </p>
          ) : null}
          {selected.cancellationReason ? (
            <p className="mt-2 text-xs text-amber-700">Cancelled: {selected.cancellationReason}</p>
          ) : null}
            </>
          )}
        </div>
      ) : null}

      <Dialog open={followUpOpen} onOpenChange={setFollowUpOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {sortedVisits.length ? "Schedule follow-up visit" : "Schedule site visit"}
            </DialogTitle>
            <DialogDescription>
              Creates a <span className="font-medium text-foreground">new</span> visit on this
              estimate. Photos and measurements stay on each visit separately.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="follow-up-type">Visit type</Label>
              <Select
                value={followUpType}
                onValueChange={(value) => setFollowUpType(value as VisitType)}
              >
                <SelectTrigger id="follow-up-type" className={DIALOG_FIELD}>
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
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="follow-up-tech">Technician</Label>
                {showTechnicianDropdown ? (
                  <button
                    type="button"
                    className="text-xs font-medium text-primary hover:underline"
                    disabled={saving}
                    onClick={() => openCreateEmployee("followUp")}
                  >
                    + Create new
                  </button>
                ) : null}
              </div>
              {!showTechnicianDropdown ? (
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => openCreateEmployee("followUp")}
                  className="flex h-10 w-full items-center justify-center rounded-lg border border-dashed border-input bg-white px-3 text-sm font-medium text-primary transition hover:border-primary/50 hover:bg-primary/[0.04] disabled:opacity-60"
                >
                  No technicians yet — create one
                </button>
              ) : (
                <Select
                  value={followUpEmployeeId || UNASSIGNED}
                  onValueChange={(value) => setFollowUpEmployeeId(value === UNASSIGNED ? "" : value)}
                >
                  <SelectTrigger id="follow-up-tech" className={DIALOG_FIELD}>
                    <SelectValue placeholder="Unassigned" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>
                    {assignableEmployees.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {employeeName(item)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="follow-up-at">Date / time</Label>
              <DateTimeField
                id="follow-up-at"
                value={followUpAt}
                onChange={setFollowUpAt}
                fieldClassName={DIALOG_FIELD}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="follow-up-instructions">Instructions</Label>
              <Textarea
                id="follow-up-instructions"
                rows={3}
                value={followUpInstructions}
                onChange={(e) => setFollowUpInstructions(e.target.value)}
                placeholder="What should this visit accomplish?"
                className="min-h-20 w-full rounded-lg border-input bg-white text-sm"
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
              <Label htmlFor="reschedule-at">New date / time</Label>
              <DateTimeField
                id="reschedule-at"
                value={rescheduleAt}
                onChange={setRescheduleAt}
                fieldClassName={DIALOG_FIELD}
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

      <Dialog
        open={deleteOpen}
        onOpenChange={(next) => {
          if (!next && !saving) setDeleteOpen(false);
        }}
      >
        <DialogContent
          showCloseButton={!saving}
          shell={false}
          className="gap-0 overflow-hidden p-0 sm:max-w-md"
        >
          <div className="space-y-2 px-4 pt-4 pb-3 pr-12">
            <DialogTitle>Delete visit?</DialogTitle>
            <DialogDescription>
              {selected
                ? `This permanently removes Visit #${selected.sequenceNumber || "—"} (${
                    selected.number || visitTypeLabel(selected)
                  }), including its photos, measurements, and calendar event.`
                : "This permanently removes this visit and its calendar event."}
            </DialogDescription>
          </div>
          <div className="flex flex-col-reverse gap-2 border-t border-input px-4 py-3 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              disabled={saving}
              onClick={() => setDeleteOpen(false)}
            >
              Keep visit
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={saving}
              onClick={() => {
                void confirmDeleteVisit();
              }}
            >
              {saving ? "Deleting…" : "Delete visit"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <CreateEmployeeDialog
        open={createEmployeeOpen}
        onOpenChange={setCreateEmployeeOpen}
        defaultRole="technician"
        onCreated={handleEmployeeCreated}
      />
    </div>
  );
}
