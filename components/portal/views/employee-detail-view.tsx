"use client";

import { useEffect, useMemo, useState, type DragEvent, type ReactNode } from "react";
import Link from "next/link";
import {
  Bell,
  Briefcase,
  Banknote,
  CalendarDays,
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
  Trash2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import {
  ATTACHMENT_ACCEPT_ATTRIBUTE,
  extractUploadedUrl,
  uploadAnyFile,
  validateAttachmentFile,
} from "@/components/api/uploadFile";
import { AuthPhoneInput } from "@/components/auth/auth-phone-input";
import { AssignEventDialog } from "@/components/portal/assign-event-dialog";
import {
  AddNoteButton,
  CreateReminderDialog,
  SetReminderButton,
  SetTaskButton,
} from "@/components/portal/create-person-dialogs";
import { DeleteConfirmDialog } from "@/components/portal/delete-confirm-dialog";
import { NotesPanel } from "@/components/portal/notes-panel";
import { FileNotices } from "@/components/portal/task-banner";
import { EventCalendar, type CalendarMove } from "@/components/portal/event-calendar";
import { PortalDataTable } from "@/components/portal/portal-data-table";
import { ReminderStatusSelect } from "@/components/portal/reminder-status-select";
import { RecordWorkspace } from "@/components/portal/record-workspace";
import { StatusPill } from "@/components/portal/status-pill";
import { useCrmApiData } from "@/components/portal/use-crm-api-data";
import { useCrmDirectory } from "@/components/portal/use-crm-directory";
import { useEmployeeFile, weekdayLabel, type EmployeeDayHours, defaultAvailability } from "@/components/portal/use-employee-file";
import { usePortalCrew } from "@/components/portal/use-portal-crew";
import { usePortalWorkspace } from "@/components/portal/use-portal-workspace";
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
import { CenteredSpinner } from "@/components/ui/spinner";
import {
  crmReminderStatusLabel,
  crmTaskStatusLabel,
  type PortalReminder,
} from "@/lib/data/crm-people";
import {
  calendarEventKindLabel,
  employeeName,
  employeeRoleLabel,
  estimateCustomerName,
  estimateStatusLabel,
  estimateStatusTone,
  formatClock,
  timeWindowLabel,
  windowFromMinutes,
  type PortalCalendarEvent,
  type PortalEmployee,
  type PortalEmployeeRole,
  type PortalEmployeeWorkingHours,
} from "@/lib/data/portal";
import { formatDate, formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  clearTeamDetail,
  bindTeamDetailEmployee,
  deleteTeamMember,
  deleteEmployeeReminder,
  fetchEmployeeEstimates,
  fetchEmployeeJobs,
  fetchEmployeeReminders,
  fetchEmployeeSchedule,
  fetchEmployeeTasks,
  fetchTeamMember,
  patchEmployeeReminderStatus,
  selectTeamTabRows,
  selectTeamTabShowLoader,
  teamTabFilterKey,
  updateTeamMember,
  addTeamMemberAttachment,
  removeTeamMemberAttachment,
  upsertEmployeeReminder,
  upsertEmployeeTask,
} from "@/store/teamSlice";
import { useRouter } from "next/navigation";

const ROLES: PortalEmployeeRole[] = ["technician", "estimator", "dispatcher", "owner"];

const WEEKDAY_INDEX: PortalEmployeeWorkingHours["day"][] = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

function minutesToTimeInput(minutes: number) {
  const clamped = Math.max(0, Math.min(24 * 60 - 1, Math.round(minutes)));
  const hours = Math.floor(clamped / 60);
  const mins = clamped % 60;
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}

function timeInputToMinutes(value: string) {
  const [hours, mins] = value.split(":").map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(mins)) return 0;
  return hours * 60 + mins;
}

function hireDateInputValue(value?: string) {
  if (!value) return "";
  return value.slice(0, 10);
}

function hireDateApiValue(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (trimmed.includes("T")) return trimmed;
  return `${trimmed}T00:00:00.000Z`;
}

function availabilityFromWorkingHours(hours?: PortalEmployeeWorkingHours[]): EmployeeDayHours[] {
  const byDay = new Map((hours ?? []).map((item) => [item.day, item]));
  return WEEKDAY_INDEX.map((day, index) => {
    const match = byDay.get(day);
    if (!match) {
      return {
        day: index,
        off: index === 0 || index === 6,
        start: "08:00",
        end: "17:00",
      };
    }
    return {
      day: index,
      off: !match.active,
      start: minutesToTimeInput(match.startMinutes),
      end: minutesToTimeInput(match.endMinutes),
    };
  });
}

function workingHoursFromAvailability(days: EmployeeDayHours[]): PortalEmployeeWorkingHours[] {
  return days.map((item) => ({
    day: WEEKDAY_INDEX[item.day] ?? "monday",
    startMinutes: timeInputToMinutes(item.start || "08:00"),
    endMinutes: timeInputToMinutes(item.end || "17:00"),
    active: !item.off,
  }));
}

export function TeamMemberView({ id }: { id: string }) {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const { requests } = usePortalWorkspace();
  const { customers } = useCrmDirectory();
  const { employees, events, assign, removeEmployee, employeeById, employeeLabel } = usePortalCrew();
  const crm = useCrmApiData();
  const sliceItems = useAppSelector((state) => state.team?.items ?? []);
  const detail = useAppSelector((state) => state.team?.detail ?? null);
  const detailLoading = useAppSelector((state) => Boolean(state.team?.detailLoading));
  const detailError = useAppSelector((state) => state.team?.detailError ?? null);
  const employee =
    (detail?.id === id ? detail : null) ??
    sliceItems.find((item) => item.id === id) ??
    employees.find((item) => item.id === id);
  const [editing, setEditing] = useState<PortalCalendarEvent | null>(null);
  const [removeOpen, setRemoveOpen] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [reminderOpen, setReminderOpen] = useState(false);

  useEffect(() => {
    if (!crm.enabled) return;
    void crm.ensureLoaded();
  }, [crm.enabled, crm.ensureLoaded]);

  useEffect(() => {
    dispatch(bindTeamDetailEmployee(id));
    void dispatch(fetchTeamMember(id));
    return () => {
      dispatch(clearTeamDetail());
    };
  }, [dispatch, id]);

  async function saveEmployee(patch: Partial<PortalEmployee>) {
    const result = await dispatch(updateTeamMember({ id, patch }));
    if (updateTeamMember.rejected.match(result)) {
      throw new Error(result.payload || "Could not save employee.");
    }
    return result.payload?.employee;
  }

  async function confirmRemove() {
    if (!employee || removing) return;
    const name = employeeName(employee);
    setRemoving(true);
    try {
      if (crm.enabled) {
        const result = await dispatch(deleteTeamMember(employee.id)).unwrap();
        if (result.requiresReassignment) {
          toast.warning(
            `Employee deactivated. ${result.pendingTasksCount ?? 0} pending tasks or jobs need reassignment.`,
          );
        } else {
          toast.success(`${name} removed from the crew list.`);
        }
      } else {
        await Promise.resolve(removeEmployee(employee.id));
        toast.success(`${name} removed from the crew list.`);
      }
      setRemoveOpen(false);
      router.push("/pro/dashboard/team");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : typeof error === "string" ? error : "Could not remove this employee.");
    } finally {
      setRemoving(false);
    }
  }

  if (!employee) {
    if (detailLoading) {
      return (
        <div className="border border-black/15 bg-card" aria-busy="true">
          <CenteredSpinner label="Loading employee" className="min-h-[22rem]" />
        </div>
      );
    }
    return (
      <div className="border border-black/15 bg-card p-6">
        <h1 className="text-lg font-semibold">{detailError || "Employee not found"}</h1>
        <Button asChild className="mt-4" size="sm">
          <Link href="/pro/dashboard/team">Back to employees</Link>
        </Button>
      </div>
    );
  }

  const member = employee;
  const name = employeeName(member);

  function moveEvent(event: PortalCalendarEvent, move: CalendarMove) {
    assign({
      kind: event.kind,
      recordId: event.recordId,
      date: move.date,
      endDate: move.endDate,
      startMinutes: move.startMinutes,
      endMinutes: move.endMinutes,
      timeWindow: windowFromMinutes(move.startMinutes, move.endMinutes) || event.timeWindow,
      employeeId: member.id,
    });
    void dispatch(fetchEmployeeSchedule({ employeeId: member.id, force: true }));
  }

  return (
    <>
      <RecordWorkspace
        href={`/pro/dashboard/team/${employee.id}`}
        label={name}
        kind="employee"
        tabs={[
          { id: "settings", label: "Settings", icon: Settings },
          { id: "availability", label: "Availability", icon: Clock },
          { id: "pay", label: "Pay rate", icon: Banknote },
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
            <StatusPill label={employeeRoleLabel(employee.role)} tone="primary" />
            <StatusPill label={employee.active ? "Active" : "Inactive"} tone={employee.active ? "success" : "neutral"} />
          </>
        }
        notice={<FileNotices kind="employee" id={employee.id} />}
        actions={
          <>
            <SetTaskButton
              subjectKind="employee"
              subjectId={employee.id}
              onCreated={(item) => {
                dispatch(upsertEmployeeTask({ employeeId: employee.id, item }));
                void dispatch(fetchEmployeeTasks({ employeeId: employee.id, force: true }));
              }}
            />
            <SetReminderButton
              subjectKind="employee"
              subjectId={employee.id}
              onCreated={(item) => {
                dispatch(upsertEmployeeReminder({ employeeId: employee.id, item }));
                void dispatch(fetchEmployeeReminders({ employeeId: employee.id, force: true }));
                if (crm.enabled) crm.addReminder(item);
              }}
            />
            <AddNoteButton subjectKind="employee" subjectId={employee.id} />
            <Button size="sm" asChild>
              <Link href={`/pro/dashboard/schedule?employeeId=${employee.id}`}>Open calendar</Link>
            </Button>
            {employee.role === "owner" ? null : (
              <Button size="sm" variant="outline" onClick={() => setRemoveOpen(true)}>
                Remove
              </Button>
            )}
          </>
        }
      >
        {(tab) => {
          switch (tab) {
            case "settings":
              return <EmployeeSettingsTab employee={employee} onSave={saveEmployee} />;
            case "availability":
              return <EmployeeAvailabilityTab employee={employee} onSave={saveEmployee} />;
            case "pay":
              return <EmployeePayTab employee={employee} onSave={saveEmployee} />;
            case "schedule":
              return (
                <EmployeeScheduleTab
                  employee={employee}
                  onOpen={setEditing}
                  onMove={moveEvent}
                  employeeLabel={employeeLabel}
                />
              );
            case "jobs":
              return <EmployeeJobsTab employeeId={employee.id} />;
            case "estimates":
              return (
                <EmployeeEstimatesTab
                  employeeId={employee.id}
                  customers={customers}
                  requests={requests}
                />
              );
            case "tasks":
              return <EmployeeTasksTab employeeId={employee.id} />;
            case "reminders":
              return (
                <EmployeeRemindersTab
                  employeeId={employee.id}
                  onSetReminder={() => setReminderOpen(true)}
                />
              );
            case "notes":
              return <NotesPanel kind="employee" id={employee.id} />;
            case "attachments":
              return <EmployeeAttachmentsTab employee={employee} useApi />;
            default:
              return <EmployeeSettingsTab employee={employee} onSave={saveEmployee} />;
          }
        }}
      </RecordWorkspace>
      <CreateReminderDialog
        open={reminderOpen}
        onOpenChange={setReminderOpen}
        subjectKind="employee"
        subjectId={employee.id}
        onCreated={(item) => {
          dispatch(upsertEmployeeReminder({ employeeId: employee.id, item }));
          void dispatch(fetchEmployeeReminders({ employeeId: employee.id, force: true }));
          if (crm.enabled) crm.addReminder(item);
        }}
      />
      <AssignEventDialog
        open={Boolean(editing)}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
        event={editing}
        events={events}
        employees={employees}
        onSave={(assignment) => {
          assign(assignment);
          void dispatch(fetchEmployeeSchedule({ employeeId: member.id, force: true }));
          const next = employeeById(assignment.employeeId);
          toast.success(`Updated. ${next ? employeeName(next) : "Crew"} has this visit.`);
        }}
      />
      <Dialog
        open={removeOpen}
        onOpenChange={(next) => {
          if (!next && !removing) setRemoveOpen(false);
        }}
      >
        <DialogContent showCloseButton={!removing} className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Deactivate employee?</DialogTitle>
            <DialogDescription>
              Are you sure you want to deactivate this employee? All pending work orders and tasks will
              require reassignment.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" disabled={removing} onClick={() => setRemoveOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" disabled={removing} onClick={() => void confirmRemove()}>
              {removing ? "Removing…" : "Deactivate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function EmployeeSettingsTab({
  employee,
  onSave,
}: {
  employee: PortalEmployee;
  onSave: (patch: Partial<PortalEmployee>) => void | Promise<unknown>;
}) {
  const [draft, setDraft] = useState(employee);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDraft(employee);
  }, [employee]);

  async function save() {
    if (saving) return;
    setSaving(true);
    try {
      await Promise.resolve(
        onSave({
          firstName: draft.firstName,
          lastName: draft.lastName,
          role: draft.role,
          trade: draft.trade,
          email: draft.email,
          phone: draft.phone,
          active: draft.active,
          hireDate: hireDateApiValue(hireDateInputValue(draft.hireDate) || ""),
          emergencyName: draft.emergencyName,
          emergencyPhone: draft.emergencyPhone,
        }),
      );
      toast.success("Employee settings saved.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save employee settings.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold">Employee settings</h2>
          <p className="mt-1 text-sm text-muted-foreground">Name, role, trade, and contact. Changes apply across jobs and the calendar.</p>
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
      <div className="grid gap-3 rounded-[4px] border border-black/10 bg-card p-4 sm:grid-cols-2">
        <Field label="First name">
          <Input value={draft.firstName} onChange={(event) => setDraft({ ...draft, firstName: event.target.value })} />
        </Field>
        <Field label="Last name">
          <Input value={draft.lastName} onChange={(event) => setDraft({ ...draft, lastName: event.target.value })} />
        </Field>
        <Field label="Role">
          <Select
            value={draft.role}
            onValueChange={(value) => setDraft({ ...draft, role: value as PortalEmployeeRole })}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select role" />
            </SelectTrigger>
            <SelectContent position="popper">
              {ROLES.map((role) => (
                <SelectItem key={role} value={role}>
                  {employeeRoleLabel(role)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Trade">
          <Input value={draft.trade} onChange={(event) => setDraft({ ...draft, trade: event.target.value })} />
        </Field>
        <Field label="Email">
          <Input type="email" value={draft.email} onChange={(event) => setDraft({ ...draft, email: event.target.value })} />
        </Field>
        <Field label="Phone">
          <AuthPhoneInput
            value={draft.phone}
            onChange={(phone) => setDraft({ ...draft, phone })}
            placeholder="(555) 123-4567"
          />
        </Field>
        <Field label="Status">
          <Select
            value={draft.active ? "active" : "inactive"}
            onValueChange={(value) => setDraft({ ...draft, active: value === "active" })}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select status" />
            </SelectTrigger>
            <SelectContent position="popper">
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Hire date">
          <Input
            type="date"
            value={hireDateInputValue(draft.hireDate)}
            onChange={(event) => setDraft({ ...draft, hireDate: event.target.value })}
          />
        </Field>
        <Field label="Emergency contact name">
          <Input
            value={draft.emergencyName ?? ""}
            placeholder="Name"
            onChange={(event) => setDraft({ ...draft, emergencyName: event.target.value })}
          />
        </Field>
        <Field label="Emergency phone">
          <AuthPhoneInput
            value={draft.emergencyPhone ?? ""}
            onChange={(emergencyPhone) => setDraft({ ...draft, emergencyPhone })}
            placeholder="(555) 123-4567"
          />
        </Field>
      </div>
    </div>
  );
}

export function EmployeeAvailabilityTab({
  employee,
  onSave,
  description = "Working hours used when assigning this employee on the calendar.",
}: {
  employee: PortalEmployee;
  onSave?: (patch: Partial<PortalEmployee>) => void | Promise<unknown>;
  description?: string;
}) {
  const hoursKey = JSON.stringify(employee.workingHours ?? null);
  const [days, setDays] = useState<EmployeeDayHours[]>(() =>
    employee.workingHours?.length
      ? availabilityFromWorkingHours(employee.workingHours)
      : defaultAvailability(),
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDays(
      employee.workingHours?.length
        ? availabilityFromWorkingHours(employee.workingHours)
        : defaultAvailability(),
    );
    // hoursKey captures workingHours content without unstable array identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sync when employee or hours payload changes
  }, [employee.id, hoursKey]);

  function patch(day: number, next: Partial<EmployeeDayHours>) {
    setDays((current) => current.map((item) => (item.day === day ? { ...item, ...next } : item)));
  }

  async function save() {
    if (saving) return;
    setSaving(true);
    try {
      const workingHours = workingHoursFromAvailability(days);
      await Promise.resolve(onSave?.({ workingHours }));
      toast.success("Availability saved.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save availability.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold">Availability</h2>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
        <Button size="sm" disabled={saving || !onSave} onClick={() => void save()}>
          {saving ? (
            <>
              <Loader2 className="mr-1.5 size-4 animate-spin" />
              Saving…
            </>
          ) : (
            "Save hours"
          )}
        </Button>
      </div>
      <div className="overflow-hidden rounded-[4px] border border-black/10">
        <table className="w-full text-sm">
          <thead className="bg-[#e8eef5] text-[11px] tracking-[0.12em] text-[#003F7D] uppercase">
            <tr>
              <th className="px-3 py-2 text-left font-semibold">Day</th>
              <th className="px-3 py-2 text-left font-semibold">Working</th>
              <th className="px-3 py-2 text-left font-semibold">Start</th>
              <th className="px-3 py-2 text-left font-semibold">End</th>
            </tr>
          </thead>
          <tbody>
            {days.map((item) => (
              <tr key={item.day} className="border-t border-black/10">
                <td className="px-3 py-2 font-medium">{weekdayLabel(item.day)}</td>
                <td className="px-3 py-2">
                  <Select
                    value={item.off ? "off" : "on"}
                    onValueChange={(value) => patch(item.day, { off: value === "off" })}
                  >
                    <SelectTrigger className="w-36">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent position="popper">
                      <SelectItem value="on">Available</SelectItem>
                      <SelectItem value="off">Off</SelectItem>
                    </SelectContent>
                  </Select>
                </td>
                <td className="px-3 py-2">
                  <Input
                    type="time"
                    className="w-32"
                    disabled={item.off}
                    value={item.start}
                    onChange={(event) => patch(item.day, { start: event.target.value })}
                  />
                </td>
                <td className="px-3 py-2">
                  <Input
                    type="time"
                    className="w-32"
                    disabled={item.off}
                    value={item.end}
                    onChange={(event) => patch(item.day, { end: event.target.value })}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function EmployeePayTab({
  employee,
  onSave,
}: {
  employee: PortalEmployee;
  onSave: (patch: Partial<PortalEmployee>) => void | Promise<unknown>;
}) {
  const [pay, setPay] = useState({
    hourlyRate: employee.hourlyRate ?? 0,
    overtimeRate: employee.overtimeRate ?? 0,
    travelRate: employee.travelRate ?? 0,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setPay({
      hourlyRate: employee.hourlyRate ?? 0,
      overtimeRate: employee.overtimeRate ?? 0,
      travelRate: employee.travelRate ?? 0,
    });
  }, [employee.id, employee.hourlyRate, employee.overtimeRate, employee.travelRate]);

  const weekHours = useMemo(() => {
    return availabilityFromWorkingHours(employee.workingHours).reduce((total, day) => {
      if (day.off) return total;
      const [startH, startM] = day.start.split(":").map(Number);
      const [endH, endM] = day.end.split(":").map(Number);
      return total + Math.max(0, endH * 60 + endM - (startH * 60 + startM)) / 60;
    }, 0);
  }, [employee.workingHours]);

  async function save() {
    if (saving) return;
    setSaving(true);
    try {
      await Promise.resolve(onSave(pay));
      toast.success("Pay rate saved.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save pay rates.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold">Per hour price</h2>
          <p className="mt-1 text-sm text-muted-foreground">Labor rate for this employee on jobs, estimates, and overtime.</p>
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
      <div className="grid gap-3 rounded-[4px] border border-black/10 bg-card p-4 sm:grid-cols-3">
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
        <PayStat label="Weekly labor" value={formatMoney(pay.hourlyRate * weekHours)} hint="Hours × rate" />
      </div>
    </div>
  );
}

function EmployeeScheduleTab({
  employee,
  onOpen,
  onMove,
  employeeLabel,
}: {
  employee: PortalEmployee;
  onOpen: (event: PortalCalendarEvent) => void;
  onMove: (event: PortalCalendarEvent, move: CalendarMove) => void;
  employeeLabel: (id?: string) => string;
}) {
  const dispatch = useAppDispatch();
  const filterKey = teamTabFilterKey({});
  const tab = useAppSelector((state) => state.team?.schedule);
  const { events } = usePortalCrew();

  useEffect(() => {
    void dispatch(fetchEmployeeSchedule({ employeeId: employee.id, force: true }));
  }, [dispatch, employee.id]);

  const apiRows = selectTeamTabRows(tab, employee.id, filterKey, []);
  const fallback = events.filter((item) => item.employeeId === employee.id);
  const assigned = (apiRows.length ? apiRows : fallback).map((item) => ({
    ...item,
    // API list is already scoped; ensure client filters can match this employee.
    employeeId: item.employeeId || employee.id,
  }));
  const listLoading = selectTeamTabShowLoader(tab, employee.id, filterKey);

  if (listLoading) {
    return (
      <div className="border border-black/10" aria-busy="true">
        <CenteredSpinner label="Loading schedule" className="min-h-[16rem]" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <EventCalendar
        events={assigned}
        employees={[employee]}
        employeeLabel={employeeLabel}
        initialEmployeeId={employee.id}
        lockEmployeeId={employee.id}
        onMove={onMove}
        onEventOpen={onOpen}
      />
      <PortalDataTable
        filename="team-schedule"
        countLabel="Assignments"
        searchPlaceholder="Search assignments"
        empty="Nothing assigned yet. Use the calendar to put work on their day."
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
            searchValue: (row) => (row.date ? formatDate(row.date) : "Unscheduled"),
            exportValue: (row) => (row.date ? formatDate(row.date) : "Unscheduled"),
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

function EmployeeJobsTab({ employeeId }: { employeeId: string }) {
  const dispatch = useAppDispatch();
  const filterKey = teamTabFilterKey({});
  const tab = useAppSelector((state) => state.team?.jobs);

  useEffect(() => {
    void dispatch(fetchEmployeeJobs({ employeeId, force: true }));
  }, [dispatch, employeeId]);

  const rows = selectTeamTabRows(tab, employeeId, filterKey, []);
  const listLoading = selectTeamTabShowLoader(tab, employeeId, filterKey);

  return (
    <PortalDataTable
      filename="employee-jobs"
      countLabel="Jobs"
      searchPlaceholder="Search jobs"
      loading={listLoading}
      empty="No jobs assigned to this employee yet."
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
            <Link href={`/pro/dashboard/jobs/${row.id}`} className="font-semibold text-primary hover:underline">
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

function EmployeeEstimatesTab({
  employeeId,
  customers,
  requests,
}: {
  employeeId: string;
  customers: Parameters<typeof estimateCustomerName>[1];
  requests: Parameters<typeof estimateCustomerName>[2];
}) {
  const dispatch = useAppDispatch();
  const filterKey = teamTabFilterKey({});
  const tab = useAppSelector((state) => state.team?.estimates);

  useEffect(() => {
    void dispatch(fetchEmployeeEstimates({ employeeId, force: true }));
  }, [dispatch, employeeId]);

  const rows = selectTeamTabRows(tab, employeeId, filterKey, []);
  const listLoading = selectTeamTabShowLoader(tab, employeeId, filterKey);

  return (
    <PortalDataTable
      filename="employee-estimates"
      countLabel="Estimates"
      searchPlaceholder="Search estimates"
      loading={listLoading}
      empty="No estimate visits assigned to this employee."
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
            <Link href={`/pro/dashboard/estimates/${row.id}`} className="font-semibold text-primary hover:underline">
              {row.number}
            </Link>
          ),
        },
        {
          id: "customer",
          header: "Customer",
          sortValue: (row) => estimateCustomerName(row, customers, requests),
          searchValue: (row) => estimateCustomerName(row, customers, requests),
          exportValue: (row) => estimateCustomerName(row, customers, requests),
          cell: (row) => estimateCustomerName(row, customers, requests),
        },
        {
          id: "service",
          header: "Work",
          sortValue: (row) => row.items[0]?.description ?? "",
          searchValue: (row) => row.items.map((item) => item.description).join(" "),
          exportValue: (row) => row.items[0]?.description ?? "",
          cell: (row) => row.items[0]?.description ?? "—",
        },
        {
          id: "total",
          header: "Total",
          sortValue: (row) => row.total,
          searchValue: (row) => formatMoney(row.total),
          exportValue: (row) => formatMoney(row.total),
          cell: (row) => formatMoney(row.total),
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

function EmployeeTasksTab({ employeeId }: { employeeId: string }) {
  const dispatch = useAppDispatch();
  const filterKey = teamTabFilterKey({});
  const tab = useAppSelector((state) => state.team?.tasks);

  useEffect(() => {
    void dispatch(fetchEmployeeTasks({ employeeId, force: true }));
  }, [dispatch, employeeId]);

  const rows = selectTeamTabRows(tab, employeeId, filterKey, []);
  const listLoading = selectTeamTabShowLoader(tab, employeeId, filterKey);

  return (
    <PortalDataTable
      filename="employee-tasks"
      countLabel="Tasks"
      searchPlaceholder="Search tasks"
      loading={listLoading}
      empty="No tasks assigned to or linked to this employee."
      rows={rows}
      rowKey={(row) => row.id}
      rowHref={(row) => `/pro/dashboard/tasks/${row.id}`}
      columns={[
        {
          id: "number",
          header: "Task",
          sortValue: (row) => row.number || row.title,
          searchValue: (row) => `${row.number ?? ""} ${row.title ?? ""}`,
          exportValue: (row) => row.number || row.id,
          cell: (row) => (
            <div>
              <Link href={`/pro/dashboard/tasks/${row.id}`} className="font-semibold text-primary hover:underline">
                {row.number || row.id}
              </Link>
              {row.title ? <p className="text-xs text-muted-foreground">{row.title}</p> : null}
            </div>
          ),
        },
        {
          id: "due",
          header: "Due",
          sortValue: (row) => row.dueAt ?? "",
          searchValue: (row) => (row.dueAt ? formatDate(row.dueAt) : ""),
          exportValue: (row) => (row.dueAt ? formatDate(row.dueAt) : ""),
          cell: (row) => (row.dueAt ? formatDate(row.dueAt) : "—"),
        },
        {
          id: "status",
          header: "Status",
          sortValue: (row) => row.status,
          searchValue: (row) => crmTaskStatusLabel(row.status),
          exportValue: (row) => row.status,
          cell: (row) => <StatusPill label={crmTaskStatusLabel(row.status)} />,
        },
      ]}
    />
  );
}

function EmployeeRemindersTab({
  employeeId,
  onSetReminder,
}: {
  employeeId: string;
  onSetReminder: () => void;
}) {
  const dispatch = useAppDispatch();
  const crm = useCrmApiData();
  const filterKey = teamTabFilterKey({});
  const tab = useAppSelector((state) => state.team?.reminders);
  const [editing, setEditing] = useState<PortalReminder | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PortalReminder | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [busyReminderId, setBusyReminderId] = useState<string | null>(null);

  useEffect(() => {
    if (!employeeId) return;
    void dispatch(fetchEmployeeReminders({ employeeId, force: true }));
  }, [dispatch, employeeId]);

  const rows = selectTeamTabRows(tab, employeeId, filterKey, []);
  const listLoading = selectTeamTabShowLoader(tab, employeeId, filterKey);

  async function setReminderStatus(item: PortalReminder, nextStatus: PortalReminder["status"]) {
    if (item.status === nextStatus || busyReminderId === item.id) return;
    setBusyReminderId(item.id);
    try {
      const result = await dispatch(
        patchEmployeeReminderStatus({ id: item.id, status: nextStatus, employeeId }),
      );
      if (patchEmployeeReminderStatus.rejected.match(result)) {
        toast.error(
          typeof result.payload === "string" ? result.payload : "Could not update reminder.",
        );
        return;
      }
      if (patchEmployeeReminderStatus.fulfilled.match(result)) {
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
        deleteEmployeeReminder({ id: deleteTarget.id, employeeId }),
      );
      if (deleteEmployeeReminder.rejected.match(result)) {
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
        filename="employee-reminders"
        countLabel="Reminders"
        searchPlaceholder="Search reminders"
        loading={listLoading}
        busyRowIds={busyReminderId ? [busyReminderId] : []}
        empty="No reminders yet. Set a reminder to follow up on this employee."
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
        subjectKind="employee"
        subjectId={employeeId}
        onCreated={(item) => {
          dispatch(upsertEmployeeReminder({ employeeId, item }));
          void dispatch(fetchEmployeeReminders({ employeeId, force: true }));
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
  const date = new Date(value.includes("T") ? value : `${value}T12:00:00`);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function fileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function EmployeeAttachmentsTab({
  employee,
  useApi = false,
}: {
  employee: PortalEmployee;
  /** When true, list/upload/delete via team attachment APIs. */
  useApi?: boolean;
}) {
  const dispatch = useAppDispatch();
  const detail = useAppSelector((state) => state.team?.detail ?? null);
  const file = useEmployeeFile(employee);
  const [over, setOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const liveEmployee = detail?.id === employee.id ? detail : employee;
  const apiAttachments = liveEmployee.attachments ?? [];
  const localAttachments = file.attachments;
  const attachments = useApi
    ? apiAttachments.map((item) => ({
        id: item.id,
        name: item.name,
        type: item.fileType || "application/octet-stream",
        size: item.sizeBytes ?? 0,
        dataUrl: item.url,
        addedAt: item.uploadedAt || "",
        actor: "",
      }))
    : localAttachments;

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

        if (useApi) {
          const result = await dispatch(
            addTeamMemberAttachment({
              id: employee.id,
              attachment: {
                name: fileItem.name,
                url,
                fileType: fileItem.type || "application/octet-stream",
                sizeBytes: fileItem.size,
                category: "other",
              },
            }),
          );
          if (addTeamMemberAttachment.rejected.match(result)) {
            throw new Error(
              typeof result.payload === "string" ? result.payload : `Could not attach ${fileItem.name}.`,
            );
          }
        } else {
          file.addAttachments([
            {
              id: `att_${Date.now()}_${fileItem.name}`,
              name: fileItem.name,
              type: fileItem.type || "application/octet-stream",
              size: fileItem.size,
              dataUrl: url,
              addedAt: new Date().toISOString(),
              actor: file.actor,
            },
          ]);
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
      if (useApi) {
        const result = await dispatch(
          removeTeamMemberAttachment({ id: employee.id, attachmentId: id }),
        );
        if (removeTeamMemberAttachment.rejected.match(result)) {
          throw new Error(
            typeof result.payload === "string" ? result.payload : "Could not remove attachment.",
          );
        }
      } else {
        file.removeAttachment(id);
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
      <p className="mt-1 text-sm text-muted-foreground">License, W-4, certifications, and other employee files.</p>
      <label
        className={cn(
          "mt-4 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-[4px] border border-dashed px-6 py-10 text-center",
          over ? "border-primary bg-[#003F7D]/5" : "border-black/20 bg-[#f8fafc]",
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
        <ul className="mt-4 divide-y divide-black/10 border border-black/10">
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
        <p className="mt-4 text-sm text-muted-foreground">No files on this employee record yet.</p>
      )}
    </div>
  );
}

function PayStat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-[4px] border border-black/10 bg-[#f8fafc] px-4 py-3">
      <p className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">{label}</p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
      <p className="text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-1.5 text-sm">
      <span className="font-medium">{label}</span>
      {children}
    </div>
  );
}
