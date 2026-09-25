"use client";

import { useEffect, useMemo, useState, type DragEvent, type ReactNode } from "react";
import Link from "next/link";
import {
  Banknote,
  Bell,
  Briefcase,
  CalendarDays,
  ChevronDown,
  Clock,
  Eye,
  FileText,
  Film,
  ImageIcon,
  ListTodo,
  Loader2,
  Music,
  NotebookPen,
  Paperclip,
  Settings,
  Shield,
  Trash2,
  Upload,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ATTACHMENT_ACCEPT_ATTRIBUTE,
  extractUploadedUrl,
  uploadAnyFile,
  validateAttachmentFile,
} from "@/components/api/uploadFile";
import { AssignEventDialog } from "@/components/portal/assign-event-dialog";
import {
  CreateReminderDialog,
  CreateTaskDialog,
} from "@/components/portal/create-person-dialogs";
import { CreateNoteDialogForSubject, NotesPanel } from "@/components/portal/notes-panel";
import { DeleteConfirmDialog } from "@/components/portal/delete-confirm-dialog";
import { EventCalendar, type CalendarMove } from "@/components/portal/event-calendar";
import { PortalDataTable } from "@/components/portal/portal-data-table";
import { RecordWorkspace } from "@/components/portal/record-workspace";
import { ReminderStatusSelect } from "@/components/portal/reminder-status-select";
import { StatusPill } from "@/components/portal/status-pill";
import { useCrmApiData } from "@/components/portal/use-crm-api-data";
import { useCrmDirectory } from "@/components/portal/use-crm-directory";
import { EmployeeAvailabilityTab } from "@/components/portal/views/employee-detail-view";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { CenteredSpinner } from "@/components/ui/spinner";
import {
  contractorAsEmployee,
  crmReminderStatusLabel,
  crmStatusLabel,
  crmTaskStatusLabel,
  type PortalContractor,
  type PortalReminder,
  type PortalTask,
} from "@/lib/data/crm-people";
import {
  calendarEventKindLabel,
  estimateCustomerName,
  estimateStatusLabel,
  estimateStatusTone,
  formatClock,
  timeWindowLabel,
  windowFromMinutes,
  type PortalCalendarEvent,
  type PortalEmployeeWorkingHours,
} from "@/lib/data/portal";
import { formatDate, formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  addContractorMemberAttachment,
  bindContractorDetail,
  clearContractorDetail,
  contractorsTabFilterKey,
  deleteContractorRecord,
  deleteContractorReminder,
  fetchContractorDetail,
  fetchContractorEstimates,
  fetchContractorJobs,
  fetchContractorReminders,
  fetchContractorSchedule,
  fetchContractorTasks,
  patchContractorReminderStatus,
  removeContractorMemberAttachment,
  selectContractorsTabRows,
  selectContractorsTabShowLoader,
  updateContractorRecord,
  upsertContractorReminder,
  upsertContractorTask,
} from "@/store/contractorsSlice";

function insuranceDateInput(value?: string) {
  if (!value) return "";
  return value.slice(0, 10);
}

function insuranceApiValue(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (trimmed.includes("T")) return trimmed;
  return `${trimmed}T00:00:00.000Z`;
}

function isInsuranceExpired(contractor: PortalContractor) {
  if (!contractor.insuranceExpires) return true;
  const expires = contractor.insuranceExpires.slice(0, 10);
  return expires < new Date().toISOString().slice(0, 10);
}

export function ContractorDetailView({ id }: { id: string }) {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const { customers } = useCrmDirectory();
  const { employees, events, assign, employeeLabel } = usePortalCrew();
  const crm = useCrmApiData();
  const sliceItems = useAppSelector((state) => state.contractors?.items ?? []);
  const detail = useAppSelector((state) => state.contractors?.detail ?? null);
  const detailLoading = useAppSelector((state) => Boolean(state.contractors?.detailLoading));
  const detailError = useAppSelector((state) => state.contractors?.detailError ?? null);
  const contractor =
    (detail?.id === id ? detail : null) ?? sliceItems.find((item) => item.id === id);
  const [editing, setEditing] = useState<PortalCalendarEvent | null>(null);
  const [assignOpen, setAssignOpen] = useState(false);
  const [removeOpen, setRemoveOpen] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [reminderOpen, setReminderOpen] = useState(false);
  const [taskOpen, setTaskOpen] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);

  useEffect(() => {
    if (!crm.enabled) return;
    void crm.ensureLoaded();
  }, [crm.enabled, crm.ensureLoaded]);

  useEffect(() => {
    dispatch(bindContractorDetail(id));
    void dispatch(fetchContractorDetail(id));
    return () => {
      dispatch(clearContractorDetail());
    };
  }, [dispatch, id]);

  async function saveContractor(patch: Partial<PortalContractor>) {
    const result = await dispatch(updateContractorRecord({ id, patch }));
    if (updateContractorRecord.rejected.match(result)) {
      throw new Error(result.payload || "Could not save contractor.");
    }
    return result.payload;
  }

  async function confirmRemove() {
    if (!contractor || removing) return;
    setRemoving(true);
    try {
      await dispatch(deleteContractorRecord(contractor.id)).unwrap();
      toast.success(`${contractor.companyName || "Contractor"} archived.`);
      setRemoveOpen(false);
      router.push("/pro/dashboard/contractors");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : typeof error === "string"
            ? error
            : "Could not remove this contractor.",
      );
    } finally {
      setRemoving(false);
    }
  }

  if (!contractor) {
    if (detailLoading) {
      return (
        <div className="border border-input bg-card" aria-busy="true">
          <CenteredSpinner label="Loading contractor" className="min-h-[22rem]" />
        </div>
      );
    }
    return (
      <div className="border border-input bg-card p-6">
        <h1 className="text-lg font-semibold">{detailError || "Contractor not found"}</h1>
        <Button asChild className="mt-4" size="sm">
          <Link href="/pro/dashboard/contractors">Back to contractors</Link>
        </Button>
      </div>
    );
  }

  const expired = isInsuranceExpired(contractor);
  const asEmployee = contractorAsEmployee(contractor);
  const partner = contractor;

  function moveEvent(event: PortalCalendarEvent, move: CalendarMove) {
    assign({
      kind: event.kind,
      recordId: event.recordId,
      date: move.date,
      endDate: move.endDate,
      startMinutes: move.startMinutes,
      endMinutes: move.endMinutes,
      timeWindow: windowFromMinutes(move.startMinutes, move.endMinutes) || event.timeWindow,
      employeeId: partner.id,
    });
    void dispatch(fetchContractorSchedule({ contractorId: partner.id, force: true }));
  }

  return (
    <>
      <RecordWorkspace
        href={`/pro/dashboard/contractors/${contractor.id}`}
        label={`${contractor.companyName} · ${contractor.number}`}
        kind="contractor"
        tabs={[
          { id: "settings", label: "Settings", icon: Settings },
          { id: "compliance", label: "Compliance", icon: Shield },
          { id: "pay", label: "Pay rate", icon: Banknote },
          { id: "availability", label: "Availability", icon: Clock },
          { id: "schedule", label: "Schedule", icon: CalendarDays },
          { id: "jobs", label: "Jobs", icon: Briefcase },
          { id: "estimates", label: "Estimates", icon: FileText },
          { id: "tasks", label: "Tasks", icon: ListTodo },
          { id: "reminders", label: "Reminders", icon: Bell },
          { id: "notes", label: "Notes", icon: NotebookPen },
          { id: "attachments", label: "Attachments", icon: Paperclip },
        ]}
        badge={
          <>
            <StatusPill label={contractor.trade} />
            <StatusPill
              label={crmStatusLabel(contractor.status)}
              tone={contractor.status === "active" ? "success" : "neutral"}
            />
            {expired ? (
              <StatusPill label="Insurance expired" className="bg-red-50 text-red-800" />
            ) : (
              <StatusPill label="Insurance valid" tone="success" />
            )}
          </>
        }
        notice={
          expired ? (
            <div className="border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
              Insurance expired on {formatDate(contractor.insuranceExpires.slice(0, 10))}. New
              dispatches are locked.
            </div>
          ) : null
        }
        actions={
          <>
            <Button
              size="sm"
              disabled={expired}
              title={expired ? "Cannot assign contractor with expired insurance" : undefined}
              onClick={() => setAssignOpen(true)}
            >
              Assign job
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  More actions
                  <ChevronDown className="size-3.5" aria-hidden="true" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-44">
                <DropdownMenuItem onSelect={() => setTaskOpen(true)}>Create task</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setNoteOpen(true)}>Add note</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setReminderOpen(true)}>Set reminder</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setRemoveOpen(true)}>Remove</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        }
      >
        {(tab) => {
          switch (tab) {
            case "settings":
              return <ContractorSettingsTab contractor={contractor} onSave={saveContractor} />;
            case "compliance":
              return <ContractorComplianceTab contractor={contractor} onSave={saveContractor} />;
            case "pay":
              return <ContractorPayTab contractor={contractor} onSave={saveContractor} />;
            case "availability":
              return (
                <EmployeeAvailabilityTab
                  employee={asEmployee}
                  description="Working hours used when assigning this contractor on the calendar."
                  onSave={async (patch) => {
                    if (!patch.workingHours) return;
                    await saveContractor({ workingHours: patch.workingHours });
                  }}
                />
              );
            case "schedule":
              return (
                <ContractorScheduleTab
                  contractor={contractor}
                  onOpen={setEditing}
                  onMove={moveEvent}
                  employeeLabel={employeeLabel}
                />
              );
            case "jobs":
              return <ContractorJobsTab contractorId={contractor.id} />;
            case "estimates":
              return (
                <ContractorEstimatesTab contractorId={contractor.id} customers={customers} />
              );
            case "tasks":
              return <ContractorTasksTab contractorId={contractor.id} />;
            case "reminders":
              return (
                <ContractorRemindersTab
                  contractorId={contractor.id}
                  onSetReminder={() => setReminderOpen(true)}
                />
              );
            case "notes":
              return <NotesPanel kind="contractor" id={contractor.id} />;
            case "attachments":
              return <ContractorAttachmentsTab contractor={contractor} />;
            default:
              return <ContractorSettingsTab contractor={contractor} onSave={saveContractor} />;
          }
        }}
      </RecordWorkspace>
      <CreateReminderDialog
        open={reminderOpen}
        onOpenChange={setReminderOpen}
        subjectKind="contractor"
        subjectId={contractor.id}
        onCreated={(item) => {
          dispatch(upsertContractorReminder({ contractorId: contractor.id, item }));
          void dispatch(fetchContractorReminders({ contractorId: contractor.id, force: true }));
          if (crm.enabled) crm.addReminder(item);
        }}
      />
      <CreateTaskDialog
        open={taskOpen}
        onOpenChange={setTaskOpen}
        subjectKind="contractor"
        subjectId={contractor.id}
        onCreated={(item) => {
          dispatch(upsertContractorTask({ contractorId: contractor.id, item }));
          void dispatch(fetchContractorTasks({ contractorId: contractor.id, force: true }));
          if (crm.enabled) crm.addTask(item);
        }}
      />
      <CreateNoteDialogForSubject
        open={noteOpen}
        onOpenChange={setNoteOpen}
        subjectKind="contractor"
        subjectId={contractor.id}
      />
      <AssignEventDialog
        open={Boolean(editing) || assignOpen}
        onOpenChange={(open) => {
          if (!open) {
            setEditing(null);
            setAssignOpen(false);
          }
        }}
        event={editing}
        events={events}
        employees={employees}
        defaultEmployeeId={contractor.id}
        onSave={async (assignment) => {
          await assign({
            ...assignment,
            employeeId: assignment.employeeId || contractor.id,
          });
          toast.success("Work assigned.");
          void dispatch(fetchContractorSchedule({ contractorId: contractor.id, force: true }));
          void dispatch(fetchContractorJobs({ contractorId: contractor.id, force: true }));
        }}
      />
      <Dialog open={removeOpen} onOpenChange={setRemoveOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Archive contractor</DialogTitle>
            <DialogDescription>
              Are you sure you want to archive {contractor.companyName || "this contractor"}? Their
              status will be set to inactive.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setRemoveOpen(false)} disabled={removing}>
              Cancel
            </Button>
            <Button size="sm" variant="destructive" onClick={() => void confirmRemove()} disabled={removing}>
              {removing ? "Removing…" : "Remove"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function ContractorSettingsTab({
  contractor,
  onSave,
}: {
  contractor: PortalContractor;
  onSave: (patch: Partial<PortalContractor>) => void | Promise<unknown>;
}) {
  const [draft, setDraft] = useState(contractor);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDraft(contractor);
  }, [contractor]);

  async function save() {
    if (saving) return;
    setSaving(true);
    try {
      await Promise.resolve(
        onSave({
          companyName: draft.companyName,
          trade: draft.trade,
          firstName: draft.firstName,
          lastName: draft.lastName,
          email: draft.email,
          phone: draft.phone,
          city: draft.city,
          zip: draft.zip,
          license: draft.license,
        }),
      );
      toast.success("Contractor settings saved.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save settings.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold">Contractor settings</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Outside crew you send to a job. Contact and company live here.
          </p>
        </div>
        <Button size="sm" disabled={saving} onClick={() => void save()}>
          {saving ? (
            <>
              <Loader2 className="mr-1.5 size-4 animate-spin" />
              Saving…
            </>
          ) : (
            "Save settings"
          )}
        </Button>
      </div>
      <div className="grid gap-3 rounded-[4px] border border-input bg-card p-4 sm:grid-cols-2">
        <Field label="Company">
          <Input
            value={draft.companyName}
            onChange={(event) => setDraft({ ...draft, companyName: event.target.value })}
          />
        </Field>
        <Field label="Trade">
          <Input
            value={draft.trade}
            onChange={(event) => setDraft({ ...draft, trade: event.target.value })}
          />
        </Field>
        <Field label="First name">
          <Input
            value={draft.firstName}
            onChange={(event) => setDraft({ ...draft, firstName: event.target.value })}
          />
        </Field>
        <Field label="Last name">
          <Input
            value={draft.lastName}
            onChange={(event) => setDraft({ ...draft, lastName: event.target.value })}
          />
        </Field>
        <Field label="Email">
          <Input
            value={draft.email}
            onChange={(event) => setDraft({ ...draft, email: event.target.value })}
          />
        </Field>
        <Field label="Phone">
          <Input
            value={draft.phone}
            onChange={(event) => setDraft({ ...draft, phone: event.target.value })}
          />
        </Field>
        <Field label="License">
          <Input
            value={draft.license}
            onChange={(event) => setDraft({ ...draft, license: event.target.value })}
          />
        </Field>
        <Field label="City">
          <Input
            value={draft.city}
            onChange={(event) => setDraft({ ...draft, city: event.target.value })}
          />
        </Field>
        <Field label="ZIP">
          <Input
            value={draft.zip}
            onChange={(event) => setDraft({ ...draft, zip: event.target.value })}
          />
        </Field>
      </div>
    </div>
  );
}

function ContractorComplianceTab({
  contractor,
  onSave,
}: {
  contractor: PortalContractor;
  onSave: (patch: Partial<PortalContractor>) => void | Promise<unknown>;
}) {
  const [draft, setDraft] = useState({
    license: contractor.license,
    insuranceExpires: insuranceDateInput(contractor.insuranceExpires),
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDraft({
      license: contractor.license,
      insuranceExpires: insuranceDateInput(contractor.insuranceExpires),
    });
  }, [contractor.id, contractor.license, contractor.insuranceExpires]);

  const expired = isInsuranceExpired(contractor);

  async function save() {
    if (saving) return;
    const insuranceExpires = insuranceApiValue(draft.insuranceExpires);
    if (!insuranceExpires) {
      toast.error("Insurance expiration date is required.");
      return;
    }
    setSaving(true);
    try {
      await Promise.resolve(
        onSave({
          license: draft.license,
          insuranceExpires,
        }),
      );
      toast.success("Compliance saved.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save compliance.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold">Compliance</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            License and insurance required before they go on a customer site.
          </p>
        </div>
        <Button size="sm" disabled={saving} onClick={() => void save()}>
          {saving ? (
            <>
              <Loader2 className="mr-1.5 size-4 animate-spin" />
              Saving…
            </>
          ) : (
            "Save compliance"
          )}
        </Button>
      </div>
      {expired ? (
        <div className="border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          Insurance expired on {formatDate(contractor.insuranceExpires.slice(0, 10))}. New dispatches
          are locked.
        </div>
      ) : null}
      <div className="grid gap-3 rounded-[4px] border border-input bg-card p-4 sm:grid-cols-2">
        <Field label="License">
          <Input
            value={draft.license}
            onChange={(event) => setDraft({ ...draft, license: event.target.value })}
          />
        </Field>
        <Field label="Insurance expires">
          <Input
            type="date"
            value={draft.insuranceExpires}
            onChange={(event) => setDraft({ ...draft, insuranceExpires: event.target.value })}
          />
        </Field>
      </div>
    </div>
  );
}

function ContractorPayTab({
  contractor,
  onSave,
}: {
  contractor: PortalContractor;
  onSave: (patch: Partial<PortalContractor>) => void | Promise<unknown>;
}) {
  const [pay, setPay] = useState({
    hourlyRate: contractor.hourlyRate ?? 0,
    overtimeRate: contractor.overtimeRate ?? 0,
    travelRate: contractor.travelRate ?? 0,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setPay({
      hourlyRate: contractor.hourlyRate ?? 0,
      overtimeRate: contractor.overtimeRate ?? 0,
      travelRate: contractor.travelRate ?? 0,
    });
  }, [contractor.id, contractor.hourlyRate, contractor.overtimeRate, contractor.travelRate]);

  const weekHours = useMemo(() => {
    const hours = contractor.workingHours ?? [];
    return hours.reduce((total, day: PortalEmployeeWorkingHours) => {
      if (!day.active) return total;
      return total + Math.max(0, day.endMinutes - day.startMinutes) / 60;
    }, 0);
  }, [contractor.workingHours]);

  async function save() {
    if (saving) return;
    setSaving(true);
    try {
      await Promise.resolve(onSave(pay));
      toast.success("Pay rate saved.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save pay rate.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold">Per hour price</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Quoted hourly rate for this contractor on jobs and estimates.
          </p>
        </div>
        <Button size="sm" disabled={saving} onClick={() => void save()}>
          {saving ? (
            <>
              <Loader2 className="mr-1.5 size-4 animate-spin" />
              Saving…
            </>
          ) : (
            "Save rates"
          )}
        </Button>
      </div>
      <div className="grid gap-3 rounded-[4px] border border-input bg-card p-4 sm:grid-cols-3">
        <Field label="Hourly rate">
          <Input
            type="number"
            min="0"
            step="0.5"
            value={pay.hourlyRate || ""}
            placeholder="0"
            onChange={(event) => setPay({ ...pay, hourlyRate: Number(event.target.value) || 0 })}
          />
        </Field>
        <Field label="Overtime rate">
          <Input
            type="number"
            min="0"
            step="0.5"
            value={pay.overtimeRate || ""}
            placeholder="0"
            onChange={(event) => setPay({ ...pay, overtimeRate: Number(event.target.value) || 0 })}
          />
        </Field>
        <Field label="Travel / trip">
          <Input
            type="number"
            min="0"
            step="0.5"
            value={pay.travelRate || ""}
            placeholder="0"
            onChange={(event) => setPay({ ...pay, travelRate: Number(event.target.value) || 0 })}
          />
        </Field>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <PayStat label="Straight time" value={formatMoney(pay.hourlyRate)} hint="Per hour" />
        <PayStat label="Typical week" value={`${weekHours} hrs`} hint="From availability" />
        <PayStat
          label="Weekly labor"
          value={formatMoney(pay.hourlyRate * weekHours)}
          hint="Hours × rate"
        />
      </div>
    </div>
  );
}

function ContractorScheduleTab({
  contractor,
  onOpen,
  onMove,
  employeeLabel,
}: {
  contractor: PortalContractor;
  onOpen: (event: PortalCalendarEvent) => void;
  onMove: (event: PortalCalendarEvent, move: CalendarMove) => void;
  employeeLabel: (id?: string) => string;
}) {
  const dispatch = useAppDispatch();
  const filterKey = contractorsTabFilterKey({});
  const tab = useAppSelector((state) => state.contractors?.schedule);
  const { events } = usePortalCrew();
  const asEmployee = contractorAsEmployee(contractor);

  useEffect(() => {
    void dispatch(fetchContractorSchedule({ contractorId: contractor.id, force: true }));
  }, [dispatch, contractor.id]);

  const apiRows = selectContractorsTabRows(tab, contractor.id, filterKey, []);
  const fallback = events.filter((item) => item.employeeId === contractor.id);
  const assigned = (apiRows.length ? apiRows : fallback).map((item) => ({
    ...item,
    employeeId: item.employeeId || contractor.id,
  }));
  const listLoading = selectContractorsTabShowLoader(tab, contractor.id, filterKey);

  if (listLoading) {
    return (
      <div className="border border-input" aria-busy="true">
        <CenteredSpinner label="Loading schedule" className="min-h-[16rem]" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <EventCalendar
        events={assigned}
        employees={[asEmployee]}
        employeeLabel={employeeLabel}
        initialEmployeeId={contractor.id}
        lockEmployeeId={contractor.id}
        onMove={onMove}
        onEventOpen={onOpen}
      />
      <PortalDataTable
        filename="contractor-schedule"
        countLabel="Assignments"
        searchPlaceholder="Search assignments"
        empty="Nothing assigned yet. Use Assign job to put them on a visit."
        rows={assigned}
        rowKey={(row) => row.id}
        columns={[
          {
            id: "title",
            header: "Work",
            sortValue: (row) => row.title,
            searchValue: (row) => `${row.title} ${row.detail}`,
            exportValue: (row) => row.title,
            cell: (row) => (
              <div>
                <p className="font-medium">{row.title}</p>
                <p className="text-xs text-muted-foreground">{row.detail}</p>
              </div>
            ),
          },
          {
            id: "kind",
            header: "Type",
            sortValue: (row) => row.kind,
            searchValue: (row) => calendarEventKindLabel(row.kind),
            exportValue: (row) => calendarEventKindLabel(row.kind),
            cell: (row) => calendarEventKindLabel(row.kind),
          },
          {
            id: "date",
            header: "Date",
            sortValue: (row) => row.date ?? "",
            searchValue: (row) => (row.date ? formatDate(row.date) : ""),
            exportValue: (row) => (row.date ? formatDate(row.date) : ""),
            cell: (row) => (row.date ? formatDate(row.date) : "—"),
          },
          {
            id: "window",
            header: "Window",
            sortValue: (row) => row.timeWindow,
            searchValue: (row) => timeWindowLabel(row.timeWindow),
            exportValue: (row) => timeWindowLabel(row.timeWindow),
            cell: (row) =>
              row.startMinutes != null && row.endMinutes != null
                ? `${formatClock(row.startMinutes)}–${formatClock(row.endMinutes)}`
                : timeWindowLabel(row.timeWindow),
          },
        ]}
        actions={(row) => [
          { label: "Open", href: row.href },
          { label: "Reassign", onSelect: () => onOpen(row) },
        ]}
      />
    </div>
  );
}

function ContractorJobsTab({ contractorId }: { contractorId: string }) {
  const dispatch = useAppDispatch();
  const filterKey = contractorsTabFilterKey({});
  const tab = useAppSelector((state) => state.contractors?.jobs);

  useEffect(() => {
    void dispatch(fetchContractorJobs({ contractorId, force: true }));
  }, [dispatch, contractorId]);

  const rows = selectContractorsTabRows(tab, contractorId, filterKey, []);
  const listLoading = selectContractorsTabShowLoader(tab, contractorId, filterKey);

  return (
    <PortalDataTable
      filename="contractor-jobs"
      countLabel="Jobs"
      searchPlaceholder="Search jobs"
      loading={listLoading}
      empty="No jobs for this contractor yet. Assign one from their schedule."
      rows={rows}
      rowKey={(row) => row.id}
      rowHref={(row) => `/pro/dashboard/jobs/${row.id}`}
      columns={[
        {
          id: "number",
          header: "Job #",
          sortValue: (row) => row.number,
          searchValue: (row) => `${row.number} ${row.title}`,
          exportValue: (row) => row.number,
          cell: (row) => (
            <Link
              href={`/pro/dashboard/jobs/${row.id}`}
              className="font-semibold text-primary hover:underline"
            >
              {row.number || row.id}
            </Link>
          ),
        },
        {
          id: "title",
          header: "Title",
          sortValue: (row) => row.title || "",
          searchValue: (row) => row.title || "",
          exportValue: (row) => row.title || "",
          cell: (row) => row.title || "—",
        },
        {
          id: "status",
          header: "Status",
          sortValue: (row) => row.status || "",
          searchValue: (row) => row.status || "",
          exportValue: (row) => row.status || "",
          cell: (row) => <StatusPill label={row.status || "—"} />,
        },
      ]}
    />
  );
}

function ContractorEstimatesTab({
  contractorId,
  customers,
}: {
  contractorId: string;
  customers: Parameters<typeof estimateCustomerName>[1];
}) {
  const dispatch = useAppDispatch();
  const filterKey = contractorsTabFilterKey({});
  const tab = useAppSelector((state) => state.contractors?.estimates);

  useEffect(() => {
    void dispatch(fetchContractorEstimates({ contractorId, force: true }));
  }, [dispatch, contractorId]);

  const rows = selectContractorsTabRows(tab, contractorId, filterKey, []);
  const listLoading = selectContractorsTabShowLoader(tab, contractorId, filterKey);

  return (
    <PortalDataTable
      filename="contractor-estimates"
      countLabel="Estimates"
      searchPlaceholder="Search estimates"
      loading={listLoading}
      empty="No estimate visits assigned to this contractor yet."
      rows={rows}
      rowKey={(row) => row.id}
      rowHref={(row) => `/pro/dashboard/estimates/${row.id}`}
      columns={[
        {
          id: "number",
          header: "Quote #",
          sortValue: (row) => row.number,
          searchValue: (row) => row.number,
          exportValue: (row) => row.number,
          cell: (row) => (
            <Link
              href={`/pro/dashboard/estimates/${row.id}`}
              className="font-semibold text-primary hover:underline"
            >
              {row.number}
            </Link>
          ),
        },
        {
          id: "customer",
          header: "Customer",
          sortValue: (row) => estimateCustomerName(row, customers),
          searchValue: (row) => estimateCustomerName(row, customers),
          exportValue: (row) => estimateCustomerName(row, customers),
          cell: (row) => estimateCustomerName(row, customers),
        },
        {
          id: "status",
          header: "Status",
          sortValue: (row) => row.status,
          searchValue: (row) => estimateStatusLabel(row.status),
          exportValue: (row) => estimateStatusLabel(row.status),
          cell: (row) => (
            <StatusPill label={estimateStatusLabel(row.status)} className={estimateStatusTone(row.status)} />
          ),
        },
      ]}
    />
  );
}

function ContractorTasksTab({ contractorId }: { contractorId: string }) {
  const dispatch = useAppDispatch();
  const filterKey = contractorsTabFilterKey({});
  const tab = useAppSelector((state) => state.contractors?.tasks);

  useEffect(() => {
    void dispatch(fetchContractorTasks({ contractorId, force: true }));
  }, [dispatch, contractorId]);

  const rows = selectContractorsTabRows(tab, contractorId, filterKey, []);
  const listLoading = selectContractorsTabShowLoader(tab, contractorId, filterKey);

  return (
    <PortalDataTable
      filename="contractor-tasks"
      countLabel="Tasks"
      searchPlaceholder="Search tasks"
      loading={listLoading}
      empty="No tasks for this contractor yet. Create one from More actions."
      rows={rows}
      rowKey={(row) => row.id}
      rowHref={(row) => `/pro/dashboard/tasks/${row.id}`}
      columns={[
        {
          id: "number",
          header: "Task",
          sortValue: (row: PortalTask) => row.number || row.title,
          searchValue: (row: PortalTask) => `${row.number ?? ""} ${row.title ?? ""}`,
          exportValue: (row: PortalTask) => row.number || row.id,
          cell: (row: PortalTask) => (
            <div>
              <Link
                href={`/pro/dashboard/tasks/${row.id}`}
                className="font-semibold text-primary hover:underline"
              >
                {row.number || row.id}
              </Link>
              {row.title ? <p className="text-xs text-muted-foreground">{row.title}</p> : null}
            </div>
          ),
        },
        {
          id: "due",
          header: "Due",
          sortValue: (row: PortalTask) => row.dueAt ?? "",
          searchValue: (row: PortalTask) => (row.dueAt ? formatDate(row.dueAt) : ""),
          exportValue: (row: PortalTask) => (row.dueAt ? formatDate(row.dueAt) : ""),
          cell: (row: PortalTask) => (row.dueAt ? formatDate(row.dueAt) : "—"),
        },
        {
          id: "status",
          header: "Status",
          sortValue: (row: PortalTask) => row.status,
          searchValue: (row: PortalTask) => crmTaskStatusLabel(row.status),
          exportValue: (row: PortalTask) => row.status,
          cell: (row: PortalTask) => <StatusPill label={crmTaskStatusLabel(row.status)} />,
        },
      ]}
    />
  );
}

function ContractorRemindersTab({
  contractorId,
  onSetReminder,
}: {
  contractorId: string;
  onSetReminder: () => void;
}) {
  const dispatch = useAppDispatch();
  const crm = useCrmApiData();
  const filterKey = contractorsTabFilterKey({});
  const tab = useAppSelector((state) => state.contractors?.reminders);
  const [editing, setEditing] = useState<PortalReminder | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PortalReminder | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [busyReminderId, setBusyReminderId] = useState<string | null>(null);

  useEffect(() => {
    if (!contractorId) return;
    void dispatch(fetchContractorReminders({ contractorId, force: true }));
  }, [dispatch, contractorId]);

  const rows = selectContractorsTabRows(tab, contractorId, filterKey, []);
  const listLoading = selectContractorsTabShowLoader(tab, contractorId, filterKey);

  async function setReminderStatus(item: PortalReminder, nextStatus: PortalReminder["status"]) {
    if (item.status === nextStatus || busyReminderId === item.id) return;
    setBusyReminderId(item.id);
    try {
      const result = await dispatch(
        patchContractorReminderStatus({ id: item.id, status: nextStatus, contractorId }),
      );
      if (patchContractorReminderStatus.rejected.match(result)) {
        toast.error(
          typeof result.payload === "string" ? result.payload : "Could not update reminder.",
        );
        return;
      }
      if (patchContractorReminderStatus.fulfilled.match(result)) {
        crm.patchReminder(item.id, result.payload ?? { status: nextStatus });
      }
    } finally {
      setBusyReminderId(null);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    try {
      const result = await dispatch(
        deleteContractorReminder({ id: deleteTarget.id, contractorId }),
      );
      if (deleteContractorReminder.rejected.match(result)) {
        toast.error(
          typeof result.payload === "string" ? result.payload : "Could not delete this reminder.",
        );
        return;
      }
      crm.removeReminder(deleteTarget.id);
      toast.success("Reminder removed.");
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-3">
      <PortalDataTable
        filename="contractor-reminders"
        countLabel="Reminders"
        searchPlaceholder="Search reminders"
        loading={listLoading}
        busyRowIds={busyReminderId ? [busyReminderId] : []}
        empty="No reminders yet. Set a reminder to follow up on this contractor."
        rows={rows}
        rowKey={(row) => row.id}
        rowHref={(row) => `/pro/dashboard/reminders/${row.id}`}
        toolbar={
          <Button size="sm" onClick={onSetReminder}>
            Set reminder
          </Button>
        }
        columns={[
          {
            id: "reminder",
            header: "Reminder",
            sortValue: (row) => row.title,
            searchValue: (row) => `${row.title} ${row.note}`,
            exportValue: (row) => row.title,
            cell: (row) => (
              <div className="min-w-0">
                <Link
                  href={`/pro/dashboard/reminders/${row.id}`}
                  className="font-medium text-primary hover:underline"
                  onClick={(event) => event.stopPropagation()}
                >
                  {row.title}
                </Link>
                {row.note ? (
                  <p className="truncate text-xs text-muted-foreground">{row.note}</p>
                ) : null}
              </div>
            ),
          },
          {
            id: "due",
            header: "Due",
            sortValue: (row) => row.dueAt,
            searchValue: (row) => formatDate(row.dueAt),
            exportValue: (row) => formatDate(row.dueAt),
            cell: (row) => formatDate(row.dueAt),
          },
          {
            id: "status",
            header: "Status",
            sortValue: (row) => row.status,
            searchValue: (row) => crmReminderStatusLabel(row.status),
            exportValue: (row) => crmReminderStatusLabel(row.status),
            cell: (row) => (
              <ReminderStatusSelect
                value={row.status}
                disabled={busyReminderId === row.id}
                onChange={(next) => void setReminderStatus(row, next)}
              />
            ),
          },
        ]}
        actions={(row) => [
          { label: "Open", href: `/pro/dashboard/reminders/${row.id}` },
          { label: "Edit", onSelect: () => setEditing(row) },
          {
            label: "Delete",
            variant: "destructive",
            onSelect: () => setDeleteTarget(row),
          },
        ]}
      />
      <CreateReminderDialog
        open={Boolean(editing)}
        reminder={editing}
        onOpenChange={(next) => {
          if (!next) setEditing(null);
        }}
        subjectKind="contractor"
        subjectId={contractorId}
        onCreated={(item) => {
          dispatch(upsertContractorReminder({ contractorId, item }));
          void dispatch(fetchContractorReminders({ contractorId, force: true }));
          if (crm.enabled) crm.addReminder(item);
        }}
      />
      <DeleteConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(next) => {
          if (!next && !deleting) setDeleteTarget(null);
        }}
        title="Delete reminder?"
        description={
          deleteTarget
            ? `This will permanently remove “${deleteTarget.title}”.`
            : "This will permanently remove this reminder."
        }
        confirmLabel="Delete"
        loading={deleting}
        onConfirm={confirmDelete}
      />
    </div>
  );
}

function stamp(value: string) {
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

function fileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function ContractorAttachmentsTab({ contractor }: { contractor: PortalContractor }) {
  const dispatch = useAppDispatch();
  const detail = useAppSelector((state) => state.contractors?.detail ?? null);
  const [over, setOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const liveContractor = detail?.id === contractor.id ? detail : contractor;
  const attachments = (liveContractor.attachments ?? []).map((item) => ({
    id: item.id,
    name: item.name,
    type: item.fileType || "application/octet-stream",
    size: item.sizeBytes ?? 0,
    dataUrl: item.url,
    addedAt: item.uploadedAt || "",
  }));

  async function readFiles(list: FileList | File[]) {
    if (uploading) return;
    const files = Array.from(list);
    if (!files.length) return;

    for (const fileItem of files) {
      const check = validateAttachmentFile(fileItem);
      if (!check.valid) {
        toast.error(check.error);
        return;
      }
    }

    setUploading(true);
    try {
      for (const fileItem of files) {
        const response = await uploadAnyFile(fileItem);
        const url = extractUploadedUrl(response.data);
        if (!url) throw new Error(`Could not upload ${fileItem.name}.`);

        const result = await dispatch(
          addContractorMemberAttachment({
            id: contractor.id,
            attachment: {
              name: fileItem.name,
              url,
              fileType: fileItem.type || "application/octet-stream",
              sizeBytes: fileItem.size,
              category: "other",
            },
          }),
        );
        if (addContractorMemberAttachment.rejected.match(result)) {
          throw new Error(
            typeof result.payload === "string"
              ? result.payload
              : `Could not attach ${fileItem.name}.`,
          );
        }
        toast.success(`${fileItem.name} attached.`);
      }
    } catch (error) {
      const message =
        error instanceof Error && error.message.trim()
          ? error.message
          : error && typeof error === "object" && "message" in error
            ? String((error as { message?: unknown }).message || "").trim()
            : "";
      toast.error(message || "Could not upload that file.");
    } finally {
      setUploading(false);
    }
  }

  async function removeAttachment(id: string, name: string) {
    if (deletingId) return;
    setDeletingId(id);
    try {
      const result = await dispatch(
        removeContractorMemberAttachment({ id: contractor.id, attachmentId: id }),
      );
      if (removeContractorMemberAttachment.rejected.match(result)) {
        throw new Error(
          typeof result.payload === "string" ? result.payload : "Could not remove attachment.",
        );
      }
      toast.success(`${name} removed.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not remove attachment.");
    } finally {
      setDeletingId(null);
    }
  }

  function onDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setOver(false);
    if (event.dataTransfer.files.length) void readFiles(event.dataTransfer.files);
  }

  return (
    <div>
      <h2 className="text-base font-semibold">Attachments</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        W-9, COI, licenses, and trade documents for this contractor.
      </p>
      <label
        className={cn(
          "mt-4 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-[4px] border border-dashed px-6 py-10 text-center",
          over ? "border-primary bg-[#003F7D]/5" : "border-input bg-[#f8fafc]",
          uploading && "pointer-events-none opacity-60",
        )}
        onDragEnter={(event) => {
          event.preventDefault();
          setOver(true);
        }}
        onDragOver={(event) => {
          event.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={onDrop}
      >
        {uploading ? (
          <Loader2 className="size-6 animate-spin text-primary" />
        ) : (
          <Upload className="size-6 text-primary" />
        )}
        <p className="text-sm font-medium">
          {uploading ? "Uploading files…" : "Drop files here or browse"}
        </p>
        <p className="text-xs text-muted-foreground">Images, PDF, Video, and Audio up to 500 MB</p>
        <input
          className="sr-only"
          type="file"
          multiple
          accept={ATTACHMENT_ACCEPT_ATTRIBUTE}
          disabled={uploading}
          onChange={(event) => {
            if (event.target.files?.length) void readFiles(event.target.files);
            event.target.value = "";
          }}
        />
      </label>
      {attachments.length ? (
        <ul className="mt-4 divide-y divide-input border border-input">
          {attachments.map((item) => (
            <li key={item.id} className="flex items-center gap-3 px-3 py-3">
              <span className="flex size-9 items-center justify-center rounded-[4px] bg-[#eef1f5] text-primary">
                {item.type.startsWith("image/") ? (
                  <ImageIcon className="size-4" />
                ) : item.type.startsWith("video/") ? (
                  <Film className="size-4" />
                ) : item.type.startsWith("audio/") ? (
                  <Music className="size-4" />
                ) : (
                  <FileText className="size-4" />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <a
                  href={item.dataUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block truncate text-sm font-medium hover:text-primary hover:underline"
                >
                  {item.name}
                </a>
                <p className="text-xs text-muted-foreground">
                  {item.addedAt ? stamp(item.addedAt) : fileSize(item.size)}
                </p>
              </div>
              <Button size="sm" variant="outline" asChild>
                <a
                  href={item.dataUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Preview ${item.name} in a new tab`}
                >
                  <Eye className="size-3.5" />
                  Preview
                </a>
              </Button>
              <Button
                size="icon-sm"
                variant="ghost"
                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                aria-label={`Delete ${item.name}`}
                disabled={deletingId === item.id || uploading}
                onClick={() => void removeAttachment(item.id, item.name)}
              >
                {deletingId === item.id ? <Loader2 className="size-4 animate-spin" /> : <Trash2 />}
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-sm text-muted-foreground">No documents yet for this contractor.</p>
      )}
    </div>
  );
}

function PayStat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-[4px] border border-input bg-[#f8fafc] px-4 py-3">
      <p className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
        {label}
      </p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
      <p className="text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

function Field({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <label className={cn("grid gap-1.5 text-sm", className)}>
      <span className="font-medium text-foreground">{label}</span>
      {children}
    </label>
  );
}
