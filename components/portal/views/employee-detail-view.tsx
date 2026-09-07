"use client";

import { useMemo, useState, type DragEvent, type ReactNode } from "react";
import Link from "next/link";
import {
  Briefcase,
  Banknote,
  CalendarDays,
  Clock,
  FileText,
  ImageIcon,
  ListTodo,
  NotebookPen,
  Paperclip,
  Settings,
  Trash2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { AssignEventDialog } from "@/components/portal/assign-event-dialog";
import { AddNoteButton, SetReminderButton, SetTaskButton } from "@/components/portal/create-person-dialogs";
import { NotesPanel } from "@/components/portal/notes-panel";
import { FileNotices } from "@/components/portal/task-banner";
import { EventCalendar, type CalendarMove } from "@/components/portal/event-calendar";
import { jobBoardColumns } from "@/components/portal/job-columns";
import { PortalDataTable } from "@/components/portal/portal-data-table";
import { RecordWorkspace } from "@/components/portal/record-workspace";
import { StatusPill } from "@/components/portal/status-pill";
import { useCrmDirectory } from "@/components/portal/use-crm-directory";
import { useEmployeeFile, weekdayLabel, type EmployeeDayHours } from "@/components/portal/use-employee-file";
import type { JobAttachment } from "@/components/portal/use-job-file";
import { usePortalCrew } from "@/components/portal/use-portal-crew";
import { usePortalRecords } from "@/components/portal/use-portal-records";
import { usePortalWorkspace } from "@/components/portal/use-portal-workspace";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { crmCustomerName, crmTaskStatusLabel, taskMatches } from "@/lib/data/crm-people";
import {
  calendarEventKindLabel,
  employeeName,
  employeeRoleLabel,
  estimateStatusLabel,
  estimateStatusTone,
  formatClock,
  getPortalCustomerName,
  timeWindowLabel,
  windowFromMinutes,
  type PortalCalendarEvent,
  type PortalEmployee,
  type PortalEmployeeRole,
} from "@/lib/data/portal";
import { formatDate, formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";

const ROLES: PortalEmployeeRole[] = ["technician", "estimator", "dispatcher", "owner"];
const MAX_FILE = 2 * 1024 * 1024;

export function TeamMemberView({ id }: { id: string }) {
  const { estimates, jobs, invoices, requests, provider } = usePortalWorkspace();
  const { customers, tasks } = useCrmDirectory();
  const { employees, events, assign, updateEmployee, removeEmployee, employeeById, employeeLabel } = usePortalCrew();
  const records = usePortalRecords();
  const employee = employees.find((item) => item.id === id);
  const [editing, setEditing] = useState<PortalCalendarEvent | null>(null);

  if (!employee) {
    return (
      <div className="border border-black/15 bg-card p-6">
        <h1 className="text-lg font-semibold">Employee not found</h1>
        <Button asChild className="mt-4" size="sm">
          <Link href="/pro/dashboard/team">Back to employees</Link>
        </Button>
      </div>
    );
  }

  const member = employee;
  const name = employeeName(member);
  const assigned = events
    .filter((item) => item.employeeId === member.id)
    .sort((a, b) => (a.date ?? "9999").localeCompare(b.date ?? "9999"));
  const allJobs = records.mergeJobs(jobs);
  const allEstimates = records.mergeEstimates(estimates);
  const jobIds = new Set(assigned.filter((item) => item.kind === "job").map((item) => item.recordId));
  const estimateIds = new Set(assigned.filter((item) => item.kind === "estimate").map((item) => item.recordId));
  const relatedJobs = allJobs.filter((item) => jobIds.has(item.id) || item.assignedTo === name);
  const relatedEstimates = allEstimates.filter((item) => estimateIds.has(item.id));
  const relatedTasks = tasks.filter(
    (item) => item.assignedEmployeeId === member.id || taskMatches(item, "employee", member.id),
  );

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
                  removeEmployee(employee.id);
                  toast.success(`${name} removed from the crew list.`);
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
              return <EmployeeSettingsTab employee={employee} onSave={updateEmployee} />;
            case "availability":
              return <EmployeeAvailabilityTab employee={employee} />;
            case "pay":
              return <EmployeePayTab employee={employee} onSave={updateEmployee} />;
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
                  columns={jobBoardColumns({
                    estimates: allEstimates,
                    requests,
                    invoices,
                    events,
                    employeeLabel,
                    customerName: (customerId) => {
                      const customer = customers.find((item) => item.id === customerId);
                      return customer ? crmCustomerName(customer) : getPortalCustomerName(provider, customerId);
                    },
                  })}
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
                      sortValue: (row) => getPortalCustomerName(provider, row.customerId),
                      searchValue: (row) => getPortalCustomerName(provider, row.customerId),
                      exportValue: (row) => getPortalCustomerName(provider, row.customerId),
                      cell: (row) => getPortalCustomerName(provider, row.customerId),
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
                      sortValue: (row) => row.number,
                      searchValue: (row) => `${row.number} ${row.title}`,
                      exportValue: (row) => row.number,
                      cell: (row) => (
                        <div>
                          <Link href={`/pro/dashboard/tasks/${row.id}`} className="font-semibold text-primary hover:underline">
                            {row.number}
                          </Link>
                          <p className="text-xs text-muted-foreground">{row.title}</p>
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
                      exportValue: (row) => crmTaskStatusLabel(row.status),
                      cell: (row) => <StatusPill label={crmTaskStatusLabel(row.status)} />,
                    },
                  ]}
                />
              );
            case "notes":
              return <NotesPanel kind="employee" id={employee.id} />;
            case "attachments":
              return <EmployeeAttachmentsTab employee={employee} />;
            default:
              return <EmployeeSettingsTab employee={employee} onSave={updateEmployee} />;
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
  onSave: (id: string, patch: Partial<PortalEmployee>) => void;
}) {
  const [draft, setDraft] = useState(employee);

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
            onSave(employee.id, draft);
            toast.success("Employee settings saved.");
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
          <Input type="date" value={draft.hireDate ?? ""} onChange={(event) => setDraft({ ...draft, hireDate: event.target.value })} />
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

export function EmployeeAvailabilityTab({ employee }: { employee: PortalEmployee }) {
  const file = useEmployeeFile(employee);
  const [days, setDays] = useState<EmployeeDayHours[]>(file.availability);

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
            file.saveAvailability(days);
            toast.success("Availability saved.");
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
  onSave: (id: string, patch: Partial<PortalEmployee>) => void;
}) {
  const file = useEmployeeFile(employee);
  const [pay, setPay] = useState(file.pay);
  const weekHours = useMemo(() => {
    return file.availability.reduce((total, day) => {
      if (day.off) return total;
      const [startH, startM] = day.start.split(":").map(Number);
      const [endH, endM] = day.end.split(":").map(Number);
      return total + Math.max(0, endH * 60 + endM - (startH * 60 + startM)) / 60;
    }, 0);
  }, [file.availability]);

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
            file.savePay(pay);
            onSave(employee.id, pay);
            toast.success("Pay rate saved.");
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

export function EmployeeAttachmentsTab({ employee }: { employee: PortalEmployee }) {
  const file = useEmployeeFile(employee);
  const [over, setOver] = useState(false);
  const [preview, setPreview] = useState<JobAttachment | null>(null);

  function readFiles(list: FileList | File[]) {
    for (const fileItem of Array.from(list)) {
      if (fileItem.size > MAX_FILE) {
        toast.error(`${fileItem.name} is over 2 MB.`);
        continue;
      }
      const reader = new FileReader();
      reader.onload = () => {
        file.addAttachments([
          {
            id: `att_${Date.now()}_${fileItem.name}`,
            name: fileItem.name,
            type: fileItem.type || "application/octet-stream",
            size: fileItem.size,
            dataUrl: String(reader.result),
            addedAt: new Date().toISOString(),
            actor: file.actor,
          },
        ]);
        toast.success(`${fileItem.name} attached.`);
      };
      reader.readAsDataURL(fileItem);
    }
  }

  function onDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setOver(false);
    if (event.dataTransfer.files.length) readFiles(event.dataTransfer.files);
  }

  return (
    <div>
      <h2 className="text-base font-semibold">Attachments</h2>
      <p className="mt-1 text-sm text-muted-foreground">License, W-4, certifications, and other employee files.</p>
      <label
        className={cn(
          "mt-4 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-[4px] border border-dashed px-6 py-10 text-center",
          over ? "border-primary bg-[#003F7D]/5" : "border-black/20 bg-[#f8fafc]",
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
        <Upload className="size-6 text-primary" />
        <p className="text-sm font-medium">Drop files here or browse</p>
        <p className="text-xs text-muted-foreground">PDF, images, and documents up to 2 MB</p>
        <input
          className="sr-only"
          type="file"
          multiple
          onChange={(event) => {
            if (event.target.files?.length) readFiles(event.target.files);
            event.target.value = "";
          }}
        />
      </label>
      {file.attachments.length ? (
        <ul className="mt-4 divide-y divide-black/10 border border-black/10">
          {file.attachments.map((item) => (
            <li key={item.id} className="flex items-center gap-3 px-3 py-3">
              <span className="flex size-9 items-center justify-center rounded-[4px] bg-[#eef1f5] text-primary">
                {item.type.startsWith("image/") ? <ImageIcon className="size-4" /> : <FileText className="size-4" />}
              </span>
              <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setPreview(item)}>
                <p className="truncate text-sm font-medium">{item.name}</p>
                <p className="text-xs text-muted-foreground">{item.actor}</p>
              </button>
              <button
                type="button"
                className="text-destructive"
                aria-label={`Remove ${item.name}`}
                onClick={() => file.removeAttachment(item.id)}
              >
                <Trash2 className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">No files yet.</p>
      )}
      {preview ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6" onClick={() => setPreview(null)}>
          {preview.type.startsWith("image/") ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img alt={preview.name} src={preview.dataUrl} className="max-h-full max-w-full rounded-[4px]" />
          ) : (
            <a href={preview.dataUrl} download={preview.name} className="rounded-[4px] bg-white px-4 py-3 text-sm font-semibold">
              Download {preview.name}
            </a>
          )}
        </div>
      ) : null}
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
