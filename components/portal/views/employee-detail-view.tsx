"use client";

import { useEffect, useMemo, useState, type DragEvent, type ReactNode } from "react";
import Link from "next/link";
import {
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
import { AssignEventDialog } from "@/components/portal/assign-event-dialog";
import { AddNoteButton, SetReminderButton, SetTaskButton } from "@/components/portal/create-person-dialogs";
import { NotesPanel } from "@/components/portal/notes-panel";
import { FileNotices } from "@/components/portal/task-banner";
import { EventCalendar, type CalendarMove } from "@/components/portal/event-calendar";
import { PortalDataTable } from "@/components/portal/portal-data-table";
import { RecordWorkspace } from "@/components/portal/record-workspace";
import { StatusPill } from "@/components/portal/status-pill";
import { useCrmApiData } from "@/components/portal/use-crm-api-data";
import { useCrmDirectory } from "@/components/portal/use-crm-directory";
import { useEmployeeFile, weekdayLabel, type EmployeeDayHours } from "@/components/portal/use-employee-file";
import { usePortalCrew } from "@/components/portal/use-portal-crew";
import { usePortalRecords } from "@/components/portal/use-portal-records";
import { usePortalWorkspace } from "@/components/portal/use-portal-workspace";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { crmTaskStatusLabel } from "@/lib/data/crm-people";
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
  type PortalEmployeeActiveAssignments,
  type PortalEmployeeAssignmentSchedule,
  type PortalEmployeeRole,
  type PortalEmployeeWorkingHours,
} from "@/lib/data/portal";
import { formatDate, formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  clearTeamDetail,
  deleteTeamMember,
  fetchTeamMember,
  updateTeamMember,
} from "@/store/teamSlice";

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

function scheduleToCalendarEvents(
  employeeId: string,
  schedule: PortalEmployeeAssignmentSchedule[],
): PortalCalendarEvent[] {
  return schedule.map((item) => {
    const date = item.date ? item.date.slice(0, 10) : undefined;
    return {
      id: item.id,
      kind: "job" as const,
      recordId: item.id,
      title: item.title || "Schedule",
      detail: item.status || "",
      date,
      timeWindow: windowFromMinutes(item.startMinutes, item.endMinutes) || "all_day",
      startMinutes: item.startMinutes,
      endMinutes: item.endMinutes,
      employeeId,
      href: `/pro/dashboard/schedule?employee=${employeeId}`,
      status: item.status || "scheduled",
    };
  });
}

export function TeamMemberView({ id }: { id: string }) {
  const dispatch = useAppDispatch();
  const { estimates, requests } = usePortalWorkspace();
  const { customers, tasks } = useCrmDirectory();
  const { employees, events, assign, removeEmployee, employeeById, employeeLabel } = usePortalCrew();
  const records = usePortalRecords();
  const crm = useCrmApiData();
  const sliceItems = useAppSelector((state) => state.team?.items ?? []);
  const detail = useAppSelector((state) => state.team?.detail ?? null);
  const detailAssignments = useAppSelector(
    (state) => state.team?.detailAssignments ?? { jobs: [], tasks: [], schedule: [] },
  );
  const detailLoading = useAppSelector((state) => Boolean(state.team?.detailLoading));
  const detailError = useAppSelector((state) => state.team?.detailError ?? null);
  const employee =
    (detail?.id === id ? detail : null) ??
    sliceItems.find((item) => item.id === id) ??
    employees.find((item) => item.id === id);
  const [editing, setEditing] = useState<PortalCalendarEvent | null>(null);

  useEffect(() => {
    if (!crm.enabled) return;
    void crm.ensureLoaded();
  }, [crm.enabled, crm.ensureLoaded]);

  useEffect(() => {
    dispatch(clearTeamDetail());
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

  if (!employee) {
    const loading = detailLoading || crm.enabled;
    return (
      <div className="border border-black/15 bg-card p-6">
        <h1 className="text-lg font-semibold">
          {loading ? "Loading employee…" : detailError || "Employee not found"}
        </h1>
        {!loading ? (
          <Button asChild className="mt-4" size="sm">
            <Link href="/pro/dashboard/team">Back to employees</Link>
          </Button>
        ) : null}
      </div>
    );
  }

  const member = employee;
  const name = employeeName(member);
  const assignments: PortalEmployeeActiveAssignments =
    detail?.id === id ? detailAssignments : { jobs: [], tasks: [], schedule: [] };
  const assignedFromApi = scheduleToCalendarEvents(member.id, assignments.schedule);
  const assignedFromCrew = events
    .filter((item) => item.employeeId === member.id)
    .sort((a, b) => (a.date ?? "9999").localeCompare(b.date ?? "9999"));
  const assigned = assignedFromApi.length ? assignedFromApi : assignedFromCrew;
  const allEstimates = records.mergeEstimates(estimates);
  const estimateIds = new Set(assigned.filter((item) => item.kind === "estimate").map((item) => item.recordId));
  const relatedEstimates = allEstimates.filter((item) => estimateIds.has(item.id));
  const relatedJobs = assignments.jobs;
  const relatedTasks = assignments.tasks.length
    ? assignments.tasks
    : tasks.filter((item) => item.assignedEmployeeId === member.id);

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
            <SetTaskButton subjectKind="employee" subjectId={employee.id} />
            <SetReminderButton subjectKind="employee" subjectId={employee.id} />
            <AddNoteButton subjectKind="employee" subjectId={employee.id} />
            <Button size="sm" asChild>
              <Link href={`/pro/dashboard/schedule?employee=${employee.id}`}>Open calendar</Link>
            </Button>
            {employee.role === "owner" ? null : (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  void Promise.resolve(
                    crm.enabled
                      ? dispatch(deleteTeamMember(employee.id)).unwrap()
                      : removeEmployee(employee.id),
                  )
                    .then(() => toast.success(`${name} removed from the crew list.`))
                    .catch((error) =>
                      toast.error(error instanceof Error ? error.message : "Could not remove this employee."),
                    );
                }}
              >
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
                  assigned={assigned}
                  onOpen={setEditing}
                  onMove={moveEvent}
                  employeeLabel={employeeLabel}
                />
              );
            case "jobs":
              return (
                <PortalDataTable
                  filename={`${employee.lastName}-jobs`}
                  countLabel="Jobs"
                  searchPlaceholder="Search jobs"
                  empty="No jobs assigned to this employee yet."
                  rows={relatedJobs}
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
                      sortValue: (row) => row.title,
                      searchValue: (row) => row.title,
                      exportValue: (row) => row.title,
                      cell: (row) => row.title || "—",
                    },
                    {
                      id: "status",
                      header: "Status",
                      sortValue: (row) => row.status,
                      searchValue: (row) => row.status,
                      exportValue: (row) => row.status,
                      cell: (row) => <StatusPill label={row.status || "—"} />,
                    },
                  ]}
                />
              );
            case "estimates":
              return (
                <PortalDataTable
                  filename={`${employee.lastName}-estimates`}
                  countLabel="Estimates"
                  searchPlaceholder="Search estimates"
                  empty="No estimate visits assigned to this employee."
                  rows={relatedEstimates}
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
            case "tasks":
              return (
                <PortalDataTable
                  filename={`${employee.lastName}-tasks`}
                  countLabel="Tasks"
                  searchPlaceholder="Search tasks"
                  empty="No tasks assigned to or linked to this employee."
                  rows={relatedTasks}
                  rowKey={(row) => row.id}
                  rowHref={(row) => `/pro/dashboard/tasks/${row.id}`}
                  columns={[
                    {
                      id: "number",
                      header: "Task",
                      sortValue: (row) => ("number" in row ? String(row.number ?? "") : row.id),
                      searchValue: (row) =>
                        `${"number" in row ? row.number ?? "" : ""} ${"title" in row ? row.title ?? "" : ""}`,
                      exportValue: (row) => ("number" in row ? String(row.number ?? row.id) : row.id),
                      cell: (row) => (
                        <div>
                          <Link href={`/pro/dashboard/tasks/${row.id}`} className="font-semibold text-primary hover:underline">
                            {"number" in row && row.number ? row.number : row.id}
                          </Link>
                          {"title" in row && row.title ? (
                            <p className="text-xs text-muted-foreground">{row.title}</p>
                          ) : null}
                        </div>
                      ),
                    },
                    {
                      id: "due",
                      header: "Due",
                      sortValue: (row) => ("dueAt" in row ? String(row.dueAt ?? "") : ""),
                      searchValue: (row) =>
                        "dueAt" in row && row.dueAt ? formatDate(String(row.dueAt)) : "",
                      exportValue: (row) =>
                        "dueAt" in row && row.dueAt ? formatDate(String(row.dueAt)) : "",
                      cell: (row) =>
                        "dueAt" in row && row.dueAt ? formatDate(String(row.dueAt)) : "—",
                    },
                    {
                      id: "status",
                      header: "Status",
                      sortValue: (row) => ("status" in row ? String(row.status ?? "") : ""),
                      searchValue: (row) =>
                        "status" in row && row.status
                          ? crmTaskStatusLabel(row.status as never) || String(row.status)
                          : "",
                      exportValue: (row) => ("status" in row ? String(row.status ?? "") : ""),
                      cell: (row) =>
                        "status" in row && row.status ? (
                          <StatusPill label={crmTaskStatusLabel(row.status as never) || String(row.status)} />
                        ) : (
                          "—"
                        ),
                    },
                  ]}
                />
              );
            case "notes":
              return <NotesPanel kind="employee" id={employee.id} />;
            case "attachments":
              return <EmployeeAttachmentsTab employee={employee} />;
            default:
              return <EmployeeSettingsTab employee={employee} onSave={saveEmployee} />;
          }
        }}
      </RecordWorkspace>
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
          const next = employeeById(assignment.employeeId);
          toast.success(`Updated. ${next ? employeeName(next) : "Crew"} has this visit.`);
        }}
      />
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

  useEffect(() => {
    setDraft(employee);
  }, [employee]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold">Employee settings</h2>
          <p className="mt-1 text-sm text-muted-foreground">Name, role, trade, and contact. Changes apply across jobs and the calendar.</p>
        </div>
        <Button
          size="sm"
          onClick={() => {
            void Promise.resolve(
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
            )
              .then(() => toast.success("Employee settings saved."))
              .catch((error) =>
                toast.error(error instanceof Error ? error.message : "Could not save employee settings."),
              );
          }}
        >
          Save settings
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
          <NativeSelect
            className="w-full"
            value={draft.role}
            onChange={(event) => setDraft({ ...draft, role: event.target.value as PortalEmployeeRole })}
          >
            {ROLES.map((role) => (
              <NativeSelectOption key={role} value={role}>
                {employeeRoleLabel(role)}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Trade">
          <Input value={draft.trade} onChange={(event) => setDraft({ ...draft, trade: event.target.value })} />
        </Field>
        <Field label="Email">
          <Input type="email" value={draft.email} onChange={(event) => setDraft({ ...draft, email: event.target.value })} />
        </Field>
        <Field label="Phone">
          <Input value={draft.phone} onChange={(event) => setDraft({ ...draft, phone: event.target.value })} />
        </Field>
        <Field label="Status">
          <NativeSelect
            className="w-full"
            value={draft.active ? "active" : "inactive"}
            onChange={(event) => setDraft({ ...draft, active: event.target.value === "active" })}
          >
            <NativeSelectOption value="active">Active</NativeSelectOption>
            <NativeSelectOption value="inactive">Inactive</NativeSelectOption>
          </NativeSelect>
        </Field>
        <Field label="Hire date">
          <Input
            type="date"
            value={hireDateInputValue(draft.hireDate)}
            onChange={(event) => setDraft({ ...draft, hireDate: event.target.value })}
          />
        </Field>
        <Field label="Emergency contact">
          <Input
            value={draft.emergencyName ?? ""}
            placeholder="Name"
            onChange={(event) => setDraft({ ...draft, emergencyName: event.target.value })}
          />
        </Field>
        <Field label="Emergency phone">
          <Input
            value={draft.emergencyPhone ?? ""}
            placeholder="Phone"
            onChange={(event) => setDraft({ ...draft, emergencyPhone: event.target.value })}
          />
        </Field>
      </div>
    </div>
  );
}

export function EmployeeAvailabilityTab({
  employee,
  onSave,
}: {
  employee: PortalEmployee;
  onSave?: (patch: Partial<PortalEmployee>) => void | Promise<unknown>;
}) {
  const file = useEmployeeFile(employee);
  const [days, setDays] = useState<EmployeeDayHours[]>(() =>
    employee.workingHours?.length
      ? availabilityFromWorkingHours(employee.workingHours)
      : file.availability,
  );

  useEffect(() => {
    setDays(
      employee.workingHours?.length
        ? availabilityFromWorkingHours(employee.workingHours)
        : file.availability,
    );
  }, [employee.id, employee.workingHours, file.availability]);

  function patch(day: number, next: Partial<EmployeeDayHours>) {
    setDays((current) => current.map((item) => (item.day === day ? { ...item, ...next } : item)));
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold">Availability</h2>
          <p className="mt-1 text-sm text-muted-foreground">Working hours used when assigning this employee on the calendar.</p>
        </div>
        <Button
          size="sm"
          onClick={() => {
            const workingHours = workingHoursFromAvailability(days);
            void Promise.resolve(
              onSave ? onSave({ workingHours }) : Promise.resolve(file.saveAvailability(days)),
            )
              .then(() => toast.success("Availability saved."))
              .catch((error) =>
                toast.error(error instanceof Error ? error.message : "Could not save availability."),
              );
          }}
        >
          Save hours
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
                  <NativeSelect
                    className="w-36"
                    value={item.off ? "off" : "on"}
                    onChange={(event) => patch(item.day, { off: event.target.value === "off" })}
                  >
                    <NativeSelectOption value="on">Available</NativeSelectOption>
                    <NativeSelectOption value="off">Off</NativeSelectOption>
                  </NativeSelect>
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold">Per hour price</h2>
          <p className="mt-1 text-sm text-muted-foreground">Labor rate for this employee on jobs, estimates, and overtime.</p>
        </div>
        <Button
          size="sm"
          onClick={() => {
            void Promise.resolve(onSave(pay))
              .then(() => toast.success("Pay rate saved."))
              .catch((error) =>
                toast.error(error instanceof Error ? error.message : "Could not save pay rates."),
              );
          }}
        >
          Save rates
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
  assigned,
  onOpen,
  onMove,
  employeeLabel,
}: {
  employee: PortalEmployee;
  assigned: PortalCalendarEvent[];
  onOpen: (event: PortalCalendarEvent) => void;
  onMove: (event: PortalCalendarEvent, move: CalendarMove) => void;
  employeeLabel: (id?: string) => string;
}) {
  return (
    <div className="space-y-4">
      <EventCalendar
        events={assigned}
        employees={[employee]}
        employeeLabel={employeeLabel}
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

export function EmployeeAttachmentsTab({ employee }: { employee: PortalEmployee }) {
  const file = useEmployeeFile(employee);
  const [over, setOver] = useState(false);
  const [uploading, setUploading] = useState(false);

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
      {file.attachments.length ? (
        <ul className="mt-4 divide-y divide-black/10 border border-black/10">
          {file.attachments.map((item) => (
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
                  {stamp(item.addedAt)}
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
                onClick={() => {
                  file.removeAttachment(item.id);
                  toast.success("Attachment removed.");
                }}
              >
                <Trash2 />
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
    <label className="grid gap-1.5 text-sm">
      <span className="font-medium">{label}</span>
      {children}
    </label>
  );
}
