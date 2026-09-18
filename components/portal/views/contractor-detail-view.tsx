"use client";

import { useEffect, useState, type DragEvent, type ReactNode } from "react";
import Link from "next/link";
import {
  Banknote,
  Briefcase,
  CalendarDays,
  Clock,
  FileText,
  Film,
  ImageIcon,
  Music,
  NotebookPen,
  Paperclip,
  Settings,
  Shield,
  Upload,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ATTACHMENT_ACCEPT_ATTRIBUTE,
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
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { CenteredSpinner } from "@/components/ui/spinner";
import {
  contractorAsEmployee,
  crmStatusLabel,
  type CrmDirectoryStatus,
  type PortalContractor,
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
  bindContractorDetail,
  clearContractorDetail,
  contractorsTabFilterKey,
  deleteContractorRecord,
  fetchContractorDetail,
  fetchContractorEstimates,
  fetchContractorJobs,
  fetchContractorSchedule,
  selectContractorsTabRows,
  selectContractorsTabShowLoader,
  setContractorAvailability,
  updateContractorRecord,
} from "@/store/contractorsSlice";

const DIRECTORY_STATUSES: CrmDirectoryStatus[] = ["active", "inactive", "on_stop"];

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
  const sessionHours = useAppSelector(
    (state) => state.contractors?.availabilityById?.[id] as PortalEmployeeWorkingHours[] | undefined,
  );
  const contractor =
    (detail?.id === id ? detail : null) ?? sliceItems.find((item) => item.id === id);
  const [editing, setEditing] = useState<PortalCalendarEvent | null>(null);
  const [assignOpen, setAssignOpen] = useState(false);
  const [removeOpen, setRemoveOpen] = useState(false);
  const [removing, setRemoving] = useState(false);

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
        <div className="border border-black/15 bg-card" aria-busy="true">
          <CenteredSpinner label="Loading contractor" className="min-h-[22rem]" />
        </div>
      );
    }
    return (
      <div className="border border-black/15 bg-card p-6">
        <h1 className="text-lg font-semibold">{detailError || "Contractor not found"}</h1>
        <Button asChild className="mt-4" size="sm">
          <Link href="/pro/dashboard/contractors">Back to contractors</Link>
        </Button>
      </div>
    );
  }

  const expired = isInsuranceExpired(contractor);
  const asEmployee = {
    ...contractorAsEmployee(contractor),
    workingHours: sessionHours,
  };
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
          <>
            <FileNotices kind="contractor" id={contractor.id} />
            {expired ? (
              <div className="border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
                Insurance expired on {formatDate(contractor.insuranceExpires.slice(0, 10))}. New
                dispatches are locked.
              </div>
            ) : null}
          </>
        }
        actions={
          <>
            <SetTaskButton subjectKind="contractor" subjectId={contractor.id} />
            <SetReminderButton subjectKind="contractor" subjectId={contractor.id} />
            <AddNoteButton subjectKind="contractor" subjectId={contractor.id} />
            <Button
              size="sm"
              disabled={expired}
              title={expired ? "Cannot assign contractor with expired insurance" : undefined}
              onClick={() => setAssignOpen(true)}
            >
              Assign job
            </Button>
            <Button size="sm" variant="outline" onClick={() => setRemoveOpen(true)}>
              Remove
            </Button>
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
                  onSave={(patch) => {
                    if (!patch.workingHours) return;
                    dispatch(
                      setContractorAvailability({
                        contractorId: contractor.id,
                        workingHours: patch.workingHours,
                      }),
                    );
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
            case "notes":
              return <NotesPanel kind="contractor" id={contractor.id} />;
            case "attachments":
              return <ContractorAttachmentsTab />;
            default:
              return <ContractorSettingsTab contractor={contractor} onSave={saveContractor} />;
          }
        }}
      </RecordWorkspace>
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

  useEffect(() => {
    setDraft(contractor);
  }, [contractor]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold">Contractor settings</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Outside crew you send to a job. Contact and company live here.
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => {
            void Promise.resolve(
              onSave({
                companyName: draft.companyName,
                trade: draft.trade,
                firstName: draft.firstName,
                lastName: draft.lastName,
                email: draft.email,
                phone: draft.phone,
                city: draft.city,
                state: draft.state,
                zip: draft.zip,
                license: draft.license,
                status: draft.status,
              }),
            )
              .then(() => toast.success("Contractor settings saved."))
              .catch((error) =>
                toast.error(error instanceof Error ? error.message : "Could not save settings."),
              );
          }}
        >
          Save settings
        </Button>
      </div>
      <div className="grid gap-3 rounded-[4px] border border-black/10 bg-card p-4 sm:grid-cols-2">
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
        <Field label="State">
          <Input
            value={draft.state}
            onChange={(event) => setDraft({ ...draft, state: event.target.value })}
          />
        </Field>
        <Field label="ZIP">
          <Input
            value={draft.zip}
            onChange={(event) => setDraft({ ...draft, zip: event.target.value })}
          />
        </Field>
        <Field label="Status">
          <NativeSelect
            className="w-full"
            value={draft.status}
            onChange={(event) =>
              setDraft({ ...draft, status: event.target.value as CrmDirectoryStatus })
            }
          >
            {DIRECTORY_STATUSES.map((status) => (
              <NativeSelectOption key={status} value={status}>
                {crmStatusLabel(status)}
              </NativeSelectOption>
            ))}
          </NativeSelect>
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

  useEffect(() => {
    setDraft({
      license: contractor.license,
      insuranceExpires: insuranceDateInput(contractor.insuranceExpires),
    });
  }, [contractor.id, contractor.license, contractor.insuranceExpires]);

  const expired = isInsuranceExpired(contractor);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold">Compliance</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            License and insurance required before they go on a customer site.
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => {
            const insuranceExpires = insuranceApiValue(draft.insuranceExpires);
            if (!insuranceExpires) {
              toast.error("Insurance expiration date is required.");
              return;
            }
            void Promise.resolve(
              onSave({
                license: draft.license,
                insuranceExpires,
              }),
            )
              .then(() => toast.success("Compliance saved."))
              .catch((error) =>
                toast.error(error instanceof Error ? error.message : "Could not save compliance."),
              );
          }}
        >
          Save compliance
        </Button>
      </div>
      {expired ? (
        <div className="border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          Insurance expired on {formatDate(contractor.insuranceExpires.slice(0, 10))}. New dispatches
          are locked.
        </div>
      ) : null}
      <div className="grid gap-3 rounded-[4px] border border-black/10 bg-card p-4 sm:grid-cols-2">
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
  const [hourlyRate, setHourlyRate] = useState(contractor.hourlyRate ?? 0);

  useEffect(() => {
    setHourlyRate(contractor.hourlyRate ?? 0);
  }, [contractor.id, contractor.hourlyRate]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold">Per hour price</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Quoted hourly rate for this contractor on jobs and estimates.
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => {
            void Promise.resolve(onSave({ hourlyRate }))
              .then(() => toast.success("Pay rate saved."))
              .catch((error) =>
                toast.error(error instanceof Error ? error.message : "Could not save pay rate."),
              );
          }}
        >
          Save rates
        </Button>
      </div>
      <div className="grid gap-3 rounded-[4px] border border-black/10 bg-card p-4 sm:grid-cols-2">
        <Field label="Hourly rate">
          <Input
            type="number"
            min="0"
            step="0.5"
            value={hourlyRate || ""}
            placeholder="0"
            onChange={(event) => setHourlyRate(Number(event.target.value) || 0)}
          />
        </Field>
        <div className="rounded-[4px] border border-black/10 bg-[#f7f9fc] px-3 py-2">
          <p className="text-[11px] font-semibold tracking-[0.12em] text-[#003F7D] uppercase">
            Straight time
          </p>
          <p className="mt-1 text-lg font-semibold tabular-nums">{formatMoney(hourlyRate)}</p>
          <p className="text-xs text-muted-foreground">Per hour</p>
        </div>
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
      <div className="border border-black/10" aria-busy="true">
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

function ContractorAttachmentsTab() {
  const [over, setOver] = useState(false);

  function rejectUpload(list: FileList | File[]) {
    const files = Array.from(list);
    if (!files.length) return;
    for (const fileItem of files) {
      const check = validateAttachmentFile(fileItem);
      if (!check.valid) {
        toast.error(check.error);
        return;
      }
    }
    toast.error("Contractor attachments API is not available yet.");
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold">Attachments</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          W-9, COI, licenses, and trade documents for this contractor.
        </p>
      </div>
      <label
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-[4px] border border-dashed border-black/20 bg-card px-4 py-10 text-center transition-colors",
          over ? "border-primary bg-primary/5" : "",
        )}
        onDragOver={(event: DragEvent) => {
          event.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(event: DragEvent) => {
          event.preventDefault();
          setOver(false);
          if (event.dataTransfer.files?.length) rejectUpload(event.dataTransfer.files);
        }}
      >
        <Upload className="size-5 text-muted-foreground" />
        <span className="text-sm font-medium">Drop files or click to upload</span>
        <span className="text-xs text-muted-foreground">PDF, images, and common office files</span>
        <input
          type="file"
          className="sr-only"
          accept={ATTACHMENT_ACCEPT_ATTRIBUTE}
          multiple
          onChange={(event) => {
            if (event.target.files?.length) rejectUpload(event.target.files);
            event.target.value = "";
          }}
        />
      </label>
      <div className="rounded-[4px] border border-black/10 px-4 py-8 text-center text-sm text-muted-foreground">
        <div className="mx-auto mb-2 flex justify-center gap-2 text-muted-foreground/70">
          <FileText className="size-4" />
          <ImageIcon className="size-4" />
          <Film className="size-4" />
          <Music className="size-4" />
        </div>
        No documents yet. Upload support requires the contractor attachments API.
      </div>
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
