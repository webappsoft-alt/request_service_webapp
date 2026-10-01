"use client";

import { useEffect, useMemo, useState, type DragEvent } from "react";
import { ImageIcon, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import {
  extractUploadedUrl,
  uploadDoc,
  uploadFile,
} from "@/components/api/uploadFile";
import { PaginatedEntitySelect } from "@/components/portal/paginated-entity-select";
import { usePaginatedCrmOptions } from "@/components/portal/use-paginated-crm-options";
import { usePortalCrew } from "@/components/portal/use-portal-crew";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { employeeName } from "@/lib/data/portal";
import type { EstimateSiteVisitRecord } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useAppSelector } from "@/store/hooks";
import { selectAuth, selectAuthUser } from "@/store/authSlice";

const MAX_FILE = 15 * 1024 * 1024;

const TIME_SLOTS = (() => {
  const slots: {
    value: string;
    startMinutes: number;
    endMinutes: number;
    label: string;
  }[] = [];
  const formatClock = (totalMinutes: number) => {
    const clamped = ((totalMinutes % 1440) + 1440) % 1440;
    const hours24 = Math.floor(clamped / 60);
    const mins = clamped % 60;
    const period = hours24 >= 12 ? "PM" : "AM";
    const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
    return `${String(hours12).padStart(2, "0")}:${String(mins).padStart(2, "0")} ${period}`;
  };
  for (let min = 360; min < 1200; min += 30) {
    slots.push({
      value: String(min),
      startMinutes: min,
      endMinutes: min + 30,
      label: `${formatClock(min)} – ${formatClock(min + 30)}`,
    });
  }
  return slots;
})();

function todayIsoDate() {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
}

function dateFromVisit(visit?: EstimateSiteVisitRecord | null) {
  const raw = String(visit?.visitedAt || visit?.scheduledAt || "").trim();
  return raw.slice(0, 10) || todayIsoDate();
}

export type ScheduleAnotherSiteVisitResult = {
  visit: EstimateSiteVisitRecord;
  date: string;
  startMinutes: number;
  endMinutes: number;
  employeeId: string;
  technician: string;
};

export type SiteVisitDetailsResult = {
  visit: EstimateSiteVisitRecord;
  date: string;
  startMinutes: number;
  endMinutes: number;
};

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("grid gap-1.5 text-sm", className)}>
      <span className="font-medium">{label}</span>
      {children}
    </div>
  );
}

function useTechnicianOptions(open: boolean) {
  const auth = useAppSelector(selectAuth);
  const user = useAppSelector(selectAuthUser);
  const role = String(user?.role || auth.role || "").toLowerCase();
  const useApi =
    auth.hydrated &&
    Boolean(auth.token) &&
    (!role || role === "provider" || role === "pro" || role === "admin");
  const { employees } = usePortalCrew();
  const technicianFilter = useMemo(() => ({ role: "technician" }), []);
  const assigneePaging = usePaginatedCrmOptions(
    open && useApi ? "assignee" : null,
    open && useApi,
    undefined,
    technicianFilter,
  );
  const options = useMemo(() => {
    const rows = useApi
      ? assigneePaging.options
      : employees
          .filter((item) => {
            const r = String(item.role || "").toLowerCase().trim();
            return (
              item.active !== false && (r === "technician" || r === "tech")
            );
          })
          .map((item) => ({
            id: item.id,
            label: `${employeeName(item)}${item.trade ? ` · ${item.trade}` : ""}`,
          }));
    return rows;
  }, [assigneePaging.options, employees, useApi]);
  return { useApi, assigneePaging, options };
}

/** Step 1: schedule date/time (+ optional tech). Creates a pending visit. */
export function ScheduleAnotherSiteVisitDialog({
  open,
  onOpenChange,
  visitNumber,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  visitNumber: number;
  onSubmit: (result: ScheduleAnotherSiteVisitResult) => void | Promise<void>;
}) {
  const { useApi, assigneePaging, options } = useTechnicianOptions(open);
  const technicianOptions = useMemo(
    () => [{ id: "", label: "Assign later (optional)" }, ...options],
    [options],
  );
  const [date, setDate] = useState("");
  const [timeSlot, setTimeSlot] = useState("540");
  const [employeeId, setEmployeeId] = useState("");
  const [employeeLabel, setEmployeeLabel] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDate(todayIsoDate());
    setTimeSlot("540");
    setEmployeeId("");
    setEmployeeLabel("");
    setSaving(false);
  }, [open]);

  async function handleSave() {
    if (!date || saving) return;
    setSaving(true);
    const slot =
      TIME_SLOTS.find((item) => item.value === timeSlot) ?? TIME_SLOTS[6];
    const tech =
      employeeLabel.trim() ||
      technicianOptions.find((item) => item.id === employeeId)?.label ||
      "";
    const visitIso = `${date}T00:00:00.000Z`;
    const visit: EstimateSiteVisitRecord = {
      id: `visit_${Date.now()}`,
      label: `Site Visit #${visitNumber}`,
      employeeId: employeeId || "",
      technician: tech.replace(/^Assign later \(optional\)$/, ""),
      visitedAt: visitIso,
      scheduledAt: visitIso,
      accessNotes: "",
      findings: "",
      recommendations: "",
      measurements: "",
      photos: [],
      createdAt: new Date().toISOString(),
      detailsPending: true,
    };
    try {
      await onSubmit({
        visit,
        date,
        startMinutes: slot.startMinutes,
        endMinutes: slot.endMinutes,
        employeeId,
        technician: visit.technician || "",
      });
      onOpenChange(false);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not schedule this site visit.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Schedule Another Site Visit</DialogTitle>
          <DialogDescription>
            Schedule Site Visit #{visitNumber}. You can add notes and photos
            next.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-1">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Visit date">
              <Input
                type="date"
                value={date}
                onChange={(event) => setDate(event.target.value)}
              />
            </Field>
            <Field label="Time">
              <Select value={timeSlot} onValueChange={setTimeSlot}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select time" />
                </SelectTrigger>
                <SelectContent className="max-h-64">
                  {TIME_SLOTS.map((slot) => (
                    <SelectItem key={slot.value} value={slot.value}>
                      {slot.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
          <Field label="Technician / team member (optional)">
            <PaginatedEntitySelect
              id="schedule-another-tech"
              value={employeeId}
              options={technicianOptions}
              placeholder="Assign later (optional)"
              selectedLabel={employeeLabel || undefined}
              emptyLabel="No team members found."
              loading={useApi ? assigneePaging.loading : false}
              loadingMore={useApi ? assigneePaging.loadingMore : false}
              hasMore={useApi ? assigneePaging.hasMore : false}
              onLoadMore={useApi ? assigneePaging.loadMore : () => {}}
              searchable={useApi}
              searchValue={useApi ? assigneePaging.search : ""}
              onSearchChange={useApi ? assigneePaging.setSearch : undefined}
              searchPlaceholder="Search team members…"
              onChange={(id, option) => {
                setEmployeeId(id);
                setEmployeeLabel(id ? String(option?.label || "").trim() : "");
              }}
            />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={!date || saving} onClick={() => void handleSave()}>
            {saving ? "Scheduling…" : "Schedule visit"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Step 2 / Edit: date/time, notes, and images for one visit. */
export function SiteVisitDetailsDialog({
  open,
  onOpenChange,
  visit,
  visitNumber,
  mode,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  visit: EstimateSiteVisitRecord | null;
  visitNumber: number;
  mode: "add" | "edit";
  onSubmit: (result: SiteVisitDetailsResult) => void | Promise<void>;
}) {
  const [date, setDate] = useState("");
  const [timeSlot, setTimeSlot] = useState("540");
  const [notes, setNotes] = useState("");
  const [photos, setPhotos] = useState<
    Array<{
      id: string;
      name: string;
      type: string;
      size: number;
      url: string;
      addedAt: string;
      actor: string;
    }>
  >([]);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dropOver, setDropOver] = useState(false);

  useEffect(() => {
    if (!open || !visit) return;
    setDate(dateFromVisit(visit));
    setTimeSlot("540");
    setNotes(String(visit.accessNotes || visit.findings || "").trim());
    setPhotos(
      (visit.photos || []).map((photo) => ({
        id: photo.id,
        name: photo.name,
        type: photo.type,
        size: photo.size,
        url: photo.url,
        addedAt: photo.addedAt,
        actor: photo.actor || "",
      })),
    );
    setSaving(false);
    setUploading(false);
    setDropOver(false);
  }, [open, visit]);

  async function uploadPhotos(list: FileList | File[]) {
    const files = Array.from(list);
    if (!files.length || uploading) return;
    setUploading(true);
    const added: typeof photos = [];
    try {
      for (const file of files) {
        if (file.size > MAX_FILE) {
          toast.error(`${file.name} is over 15 MB.`);
          continue;
        }
        const isPdf =
          file.type === "application/pdf" ||
          file.name.toLowerCase().endsWith(".pdf");
        const response = isPdf ? await uploadDoc(file) : await uploadFile(file);
        const url = extractUploadedUrl(response.data);
        if (!url) throw new Error(`Could not upload ${file.name}.`);
        added.push({
          id: `photo_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          name: file.name,
          type: file.type || (isPdf ? "application/pdf" : "image/jpeg"),
          size: file.size,
          url,
          addedAt: new Date().toISOString(),
          actor: "",
        });
      }
      if (added.length) setPhotos((prev) => [...added, ...prev]);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not upload photo.",
      );
    } finally {
      setUploading(false);
    }
  }

  function onDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setDropOver(false);
    if (event.dataTransfer.files.length) {
      void uploadPhotos(event.dataTransfer.files);
    }
  }

  async function handleSave() {
    if (!visit || !date || saving) return;
    setSaving(true);
    const slot =
      TIME_SLOTS.find((item) => item.value === timeSlot) ?? TIME_SLOTS[6];
    const visitIso = `${date}T00:00:00.000Z`;
    const next: EstimateSiteVisitRecord = {
      ...visit,
      visitedAt: visitIso,
      scheduledAt: visit.scheduledAt || visitIso,
      accessNotes: notes,
      findings: String(visit.findings || "").trim() || notes,
      photos,
      detailsPending: false,
    };
    try {
      await onSubmit({
        visit: next,
        date,
        startMinutes: slot.startMinutes,
        endMinutes: slot.endMinutes,
      });
      onOpenChange(false);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not save visit details.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(92vh,40rem)] w-[calc(100%-1.5rem)] flex-col gap-0 overflow-hidden sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {mode === "add"
              ? `Add Visit Details — Site Visit #${visitNumber}`
              : `Edit Site Visit #${visitNumber}`}
          </DialogTitle>
          <DialogDescription>
            {mode === "add"
              ? "Add notes and photos for this scheduled visit. Previous visits stay unchanged."
              : "Update date, notes, and photos for this visit only."}
          </DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-1 py-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Visit date">
              <Input
                type="date"
                value={date}
                onChange={(event) => setDate(event.target.value)}
              />
            </Field>
            <Field label="Time">
              <Select value={timeSlot} onValueChange={setTimeSlot}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select time" />
                </SelectTrigger>
                <SelectContent className="max-h-64">
                  {TIME_SLOTS.map((slot) => (
                    <SelectItem key={slot.value} value={slot.value}>
                      {slot.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
          <Field label="Notes">
            <Textarea
              rows={4}
              placeholder="Access notes, gate codes, findings…"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
          </Field>
          <div className="space-y-2">
            <p className="text-sm font-medium">Images</p>
            <label
              className={cn(
                "flex cursor-pointer items-center gap-3 rounded-lg border border-dashed px-3 py-3 transition-colors",
                dropOver
                  ? "border-primary bg-secondary"
                  : "border-input bg-transparent",
              )}
              onDragEnter={(event) => {
                event.preventDefault();
                setDropOver(true);
              }}
              onDragOver={(event) => {
                event.preventDefault();
                setDropOver(true);
              }}
              onDragLeave={(event) => {
                event.preventDefault();
                setDropOver(false);
              }}
              onDrop={onDrop}
            >
              <input
                type="file"
                accept="image/*,application/pdf"
                multiple
                className="sr-only"
                disabled={uploading}
                onChange={(event) => {
                  if (event.target.files?.length) {
                    void uploadPhotos(event.target.files);
                    event.target.value = "";
                  }
                }}
              />
              {uploading ? (
                <Loader2 className="size-5 animate-spin text-primary" />
              ) : (
                <Upload className="size-5 text-muted-foreground" />
              )}
              <div>
                <p className="text-sm font-medium">
                  {uploading ? "Uploading…" : "Drop photos here or browse"}
                </p>
                <p className="text-xs text-muted-foreground">
                  PNG, JPG, or PDF up to 15 MB
                </p>
              </div>
            </label>
            {photos.length ? (
              <ul className="grid gap-2 sm:grid-cols-2">
                {photos.map((photo) => (
                  <li
                    key={photo.id}
                    className="flex items-center gap-2 rounded-md border border-input px-2 py-1.5 text-sm"
                  >
                    <ImageIcon className="size-4 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate">{photo.name}</span>
                    <button
                      type="button"
                      className="text-xs text-destructive hover:underline"
                      onClick={() =>
                        setPhotos((prev) =>
                          prev.filter((item) => item.id !== photo.id),
                        )
                      }
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={!date || saving || uploading}
            onClick={() => void handleSave()}
          >
            {saving ? "Saving…" : "Save details"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ChangeVisitAssignmentDialog({
  open,
  onOpenChange,
  currentEmployeeId,
  currentLabel,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentEmployeeId?: string;
  currentLabel?: string;
  onSubmit: (input: {
    employeeId: string;
    technician: string;
  }) => void | Promise<void>;
}) {
  const { useApi, assigneePaging, options } = useTechnicianOptions(open);
  const technicianOptions = useMemo(
    () => [{ id: "", label: "Unassigned" }, ...options],
    [options],
  );
  const [employeeId, setEmployeeId] = useState("");
  const [employeeLabel, setEmployeeLabel] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setEmployeeId(currentEmployeeId || "");
    setEmployeeLabel(currentLabel || "");
    setSaving(false);
  }, [open, currentEmployeeId, currentLabel]);

  async function handleSave() {
    setSaving(true);
    try {
      await onSubmit({
        employeeId,
        technician: employeeId
          ? employeeLabel.trim() ||
            technicianOptions.find((item) => item.id === employeeId)?.label ||
            ""
          : "",
      });
      onOpenChange(false);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not update assignment.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Change assignment</DialogTitle>
          <DialogDescription>
            Update the technician for the current site visit only. This does
            not create a new visit.
          </DialogDescription>
        </DialogHeader>
        <Field label="Technician / team member">
          <PaginatedEntitySelect
            id="change-visit-tech"
            value={employeeId}
            options={technicianOptions}
            placeholder="Select technician"
            selectedLabel={employeeLabel || undefined}
            emptyLabel="No team members found."
            loading={useApi ? assigneePaging.loading : false}
            loadingMore={useApi ? assigneePaging.loadingMore : false}
            hasMore={useApi ? assigneePaging.hasMore : false}
            onLoadMore={useApi ? assigneePaging.loadMore : () => {}}
            searchable={useApi}
            searchValue={useApi ? assigneePaging.search : ""}
            onSearchChange={useApi ? assigneePaging.setSearch : undefined}
            searchPlaceholder="Search team members…"
            onChange={(id, option) => {
              setEmployeeId(id);
              setEmployeeLabel(id ? String(option?.label || "").trim() : "");
            }}
          />
        </Field>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={saving} onClick={() => void handleSave()}>
            {saving ? "Saving…" : "Save assignment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
