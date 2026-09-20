"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  Ban,
  Bell,
  Briefcase,
  Building2,
  CalendarDays,
  ChevronDown,
  FileText,
  Globe,
  History,
  ListTodo,
  Loader2,
  Mail,
  MapPin,
  NotebookPen,
  Phone,
  Receipt,
  Shield,
  UserRound,
  Wallet,
  ArchiveRestore,
} from "lucide-react";
import { toast } from "sonner";
import { archiveRowAction, ConfirmArchiveDialog, matchesArchiveFilter } from "@/components/portal/archive-control";
import { DeleteConfirmDialog } from "@/components/portal/delete-confirm-dialog";
import {
  CreateReminderDialog,
  CreateTaskDialog,
  SetTaskButton,
} from "@/components/portal/create-person-dialogs";
import {
  CreateCustomerNoteDialog,
  UniversalNotesPanel,
} from "@/components/portal/universal-notes-panel";
import { FileNotices } from "@/components/portal/task-banner";
import { CreateEstimateDialog, CreateJobDialog } from "@/components/portal/create-work-dialogs";
import { AssignEventDialog } from "@/components/portal/assign-event-dialog";
import { CrmMark } from "@/components/portal/crm-mark";
import { CustomerEventCalendar } from "@/components/portal/customer-event-calendar";
import { CustomerLocationMapLazy } from "@/components/portal/customer-location-map-lazy";
import { ApplyPaymentDialog } from "@/components/portal/invoice-file";
import { invoiceBoardColumns } from "@/components/portal/invoice-columns";
import { jobBoardColumns } from "@/components/portal/job-columns";
import { LocalFilterTabs } from "@/components/portal/local-filter-tabs";
import { PortalDataTable } from "@/components/portal/portal-data-table";
import { RecordWorkspace } from "@/components/portal/record-workspace";
import { StatusPill } from "@/components/portal/status-pill";
import { useCrmDirectory } from "@/components/portal/use-crm-directory";
import { useCrmApiData } from "@/components/portal/use-crm-api-data";
import { useCrmRecordPending } from "@/components/portal/use-crm-record-pending";
import { readCostLines } from "@/components/portal/use-job-costing";
import { usePortalCrew } from "@/components/portal/use-portal-crew";
import { usePortalRecords } from "@/components/portal/use-portal-records";
import { usePortalWorkspace } from "@/components/portal/use-portal-workspace";
import { buildInvoice, nextRecordNumber, todayISO } from "@/components/portal/work-builders";
import { convertJobToInvoice as convertJobToInvoiceApi, updateEstimateArchive, updateJobArchive } from "@/lib/api/crm-client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { CenteredSpinner } from "@/components/ui/spinner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Field, FieldLabel } from "@/components/ui/field";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  crmCustomerName,
  crmReminderStatusLabel,
  crmTaskStatusLabel,
  crmSourceLabel,
  crmTypeLabel,
  noteMatches,
  reminderMatches,
  taskMatches,
  type CustomerDossier,
  type CustomerTimelineEvent,
  type PortalCustomerCrm,
  type PortalNote,
  type PortalReminder,
  type PortalTask,
} from "@/lib/data/crm-people";
import {
  ESTIMATE_STATUS_FILTERS,
  estimateStatusLabel,
  estimateStatusTone,
  getPortalCustomerName,
  INVOICE_BOARD_FILTERS,
  invoiceMatchesBoardFilter,
  invoiceStatusLabel,
  JOB_STATUS_FILTERS,
  JOB_STATUSES,
  withArchiveFilter,
  jobStatusLabel,
  minutesForWindow,
  requestStatusLabel,
  type PortalCalendarEvent,
  type PortalRequest,
} from "@/lib/data/portal";
import type { Estimate, Invoice, Job, JobStatus, Payment } from "@/lib/types";
import { formatDate, formatLocation, formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  clearCustomerDetail,
  customerTabFilterKey,
  deleteCustomerJob,
  deleteCustomerReminder,
  deleteCustomerTask,
  fetchCustomerDetail,
  fetchCustomerEstimates,
  fetchCustomerInvoices,
  fetchCustomerJobs,
  fetchCustomerReminders,
  fetchCustomerSchedule,
  fetchCustomerTasks,
  fetchCustomerTimeline,
  patchCustomerJobStatus,
  patchCustomerReminderStatus,
  patchCustomerTaskStatus,
  selectCustomerTabRows,
  selectCustomerTabShowLoader,
  updateCustomerDetail,
  upsertCustomerEstimate,
  upsertCustomerJob,
  upsertCustomerReminder,
  upsertCustomerTask,
  removeCustomerEstimate,
  removeCustomerJobLocal,
} from "@/store/customersSlice";
import { useRouter } from "next/navigation";

const TABS = [
  { id: "profile", label: "Profile", icon: UserRound },
  { id: "estimates", label: "Estimates", icon: FileText },
  { id: "jobs", label: "Jobs", icon: Briefcase },
  { id: "schedule", label: "Schedules", icon: CalendarDays },
  { id: "invoices", label: "Invoices", icon: Receipt },
  { id: "history", label: "History", icon: History },
  { id: "notes", label: "Notes", icon: NotebookPen },
  { id: "tasks", label: "Tasks", icon: ListTodo },
  { id: "reminders", label: "Reminders", icon: Bell },
];

export function CustomerDetailView({ id }: { id: string }) {
  const dispatch = useAppDispatch();
  const { estimates, jobs, invoices, payments, requests, provider } = usePortalWorkspace();
  const { customers, reminders, employees, tasks, notes, updateCustomer } = useCrmDirectory();
  const crm = useCrmApiData();
  const { events, employeeLabel } = usePortalCrew();
  const records = usePortalRecords();
  const detail = useAppSelector((state) => state.customers?.detail ?? null);
  const dossier = useAppSelector((state) => state.customers?.dossier ?? null);
  const detailLoading = useAppSelector((state) => Boolean(state.customers?.detailLoading));
  const detailError = useAppSelector((state) => state.customers?.detailError ?? null);
  const sliceItems = useAppSelector((state) => state.customers?.items ?? []);
  const [reminderOpen, setReminderOpen] = useState(false);
  const [taskOpen, setTaskOpen] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [createEstimateOpen, setCreateEstimateOpen] = useState(false);
  const [createJobOpen, setCreateJobOpen] = useState(false);
  const [paying, setPaying] = useState<Invoice | null>(null);
  const [estimateFilter, setEstimateFilter] = useState("");
  const [jobFilter, setJobFilter] = useState("");
  const [invoiceFilter, setInvoiceFilter] = useState("");
  const pending = useCrmRecordPending();

  useEffect(() => {
    dispatch(clearCustomerDetail());
    void dispatch(fetchCustomerDetail(id));
    return () => {
      dispatch(clearCustomerDetail());
    };
  }, [dispatch, id]);

  const customer =
    (detail?.id === id ? detail : null) ??
    sliceItems.find((item) => item.id === id) ??
    customers.find((item) => item.id === id);

  if (!customer) {
    if (detailLoading || pending) {
      return (
        <div className="border border-black/15 bg-card" aria-busy="true">
          <CenteredSpinner label="Loading customer" className="min-h-[22rem]" />
        </div>
      );
    }
    return (
      <div className="border border-black/15 bg-card p-6">
        <h1 className="text-lg font-semibold">{detailError || "Customer not found"}</h1>
        <Button asChild className="mt-4" size="sm">
          <Link href="/pro/dashboard/customers">Back to customers</Link>
        </Button>
      </div>
    );
  }

  const amountOwing = dossier?.balanceDue ?? customer.amountOwing;
  const address = customer.addresses[0];
  const relatedEstimates = records.mergeEstimates(estimates).filter((item) => item.customerId === id);
  const relatedJobs = records.mergeJobs(jobs).filter((item) => item.customerId === id);
  const relatedInvoices = records.mergeInvoices(invoices).filter((item) => item.customerId === id);
  const relatedPayments = records
    .mergePayments(payments)
    .filter((payment) => relatedInvoices.some((invoice) => invoice.id === payment.invoiceId));
  const relatedReminders = reminders.filter((item) => reminderMatches(item, "customer", id));
  const relatedRequests = requests.filter((item) => item.customerId === id);
  const relatedTasks = tasks.filter((item) => taskMatches(item, "customer", id));
  const relatedNotes = notes.filter((item) => noteMatches(item, "customer", id));
  const history = buildCustomerHistory({
    customer,
    requests: relatedRequests,
    estimates: relatedEstimates,
    jobs: relatedJobs,
    invoices: relatedInvoices,
    payments: relatedPayments,
    reminders: relatedReminders,
    notes: relatedNotes,
    tasks: relatedTasks,
  });
  const relatedEvents = events.filter((event) => {
    switch (event.kind) {
      case "job":
        return relatedJobs.some((job) => job.id === event.recordId);
      case "estimate":
        return relatedEstimates.some((estimate) => estimate.id === event.recordId);
      case "request":
        return relatedRequests.some((request) => request.id === event.recordId);
      case "invoice":
        return relatedInvoices.some((invoice) => invoice.id === event.recordId);
      case "task":
        return relatedTasks.some((task) => task.id === event.recordId);
      default: {
        const _never: never = event.kind;
        return _never;
      }
    }
  });
  const assigned = employees.find((item) => item.id === customer.preferredEmployeeId);
  const name = crmCustomerName(customer);
  const file: PortalCustomerCrm = customer;

  function saveCustomer() {
    if (crm.enabled) {
      void dispatch(updateCustomerDetail({ id: file.id, patch: file })).then((result) => {
        if (updateCustomerDetail.fulfilled.match(result)) {
          toast.success("Customer file saved.");
          return;
        }
        toast.error(
          typeof result.payload === "string" ? result.payload : "Could not save this customer.",
        );
      });
      return;
    }
    void Promise.resolve(updateCustomer(file.id, file))
      .then(() => toast.success("Customer file saved."))
      .catch((error) =>
        toast.error(error instanceof Error ? error.message : "Could not save this customer."),
      );
  }

  return (
    <>
      <RecordWorkspace
        href={`/pro/dashboard/customers/${customer.id}`}
        label={`${customer.entityKind === "company" ? "Customer" : "Customer"} #${customer.customerNumber}`}
        kind="customer"
        tabs={TABS}
        badge={
          amountOwing > 0 ? (
            <span className="rounded-sm bg-[#f4e4c4] px-2 py-1 text-[11px] font-semibold tracking-wide text-[#7a4a00] uppercase">
              Balance owing {formatMoney(amountOwing)}
            </span>
          ) : (
            <StatusPill label="Current" tone="success" />
          )
        }
        actions={
          <>
            <Button asChild variant="outline" size="sm">
              <Link href="/pro/dashboard/customers">Close</Link>
            </Button>
            <Button size="sm" onClick={saveCustomer}>
              Save
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
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        }
        notice={
          <>
            {customer.onStop ? (
              <div className="mb-3 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm font-medium text-red-800">
                Account on Credit Hold
              </div>
            ) : null}
            <FileNotices kind="customer" id={customer.id} />
          </>
        }
      >
        {(tab) => {
          switch (tab) {
            case "profile":
              return (
                <div className="space-y-4">
                <div className="grid gap-4 lg:grid-cols-[1.35fr_0.85fr]">
                  <section className="overflow-hidden rounded-lg border border-black/10 bg-card shadow-[0_10px_28px_rgba(4,26,54,0.07)]">
                    <header className="flex items-center gap-4 border-b border-black/10 bg-[linear-gradient(180deg,#f8fafc_0%,#fff_100%)] px-5 py-4">
                      <CrmMark
                        name={name}
                        kind={customer.entityKind === "company" ? "company" : "person"}
                        photoUrl={customer.avatarUrl}
                      />
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="text-lg font-semibold capitalize tracking-tight">{name}</h2>
                          <StatusPill
                            label={customer.entityKind === "company" ? "Company" : "Individual"}
                            tone="primary"
                          />
                          <StatusPill label={crmTypeLabel(customer.customerType)} tone="neutral" />
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">
                          #{customer.customerNumber}
                          {customer.entityKind === "company"
                            ? ` · ${customer.firstName} ${customer.lastName}`
                            : ` · ${customer.email}`}
                        </p>
                      </div>
                    </header>
                    <div className="grid sm:grid-cols-2">
                      <InfoRow icon={Building2} label="Source" value={crmSourceLabel(customer.source)} />
                      {customer.entityKind === "company" && customer.ein?.trim() ? (
                        <InfoRow icon={Shield} label="EIN" value={customer.ein} />
                      ) : null}
                      {customer.entityKind === "company" && customer.website?.trim() ? (
                        <InfoRow
                          icon={Globe}
                          label="Website"
                          value={
                            <a href={customer.website} className="text-primary hover:underline">
                              {customer.website.replace(/^https?:\/\//, "")}
                            </a>
                          }
                        />
                      ) : null}
                      {customer.email?.trim() ? (
                        <InfoRow
                          icon={Mail}
                          label="Email"
                          value={<span className="text-primary">{customer.email}</span>}
                        />
                      ) : null}
                      {customer.phone?.trim() ? (
                        <InfoRow icon={Phone} label="Phone" value={customer.phone} />
                      ) : null}
                      {customer.doNotCall ? (
                        <InfoRow icon={Ban} label="Do not call" value="Yes" warn />
                      ) : null}
                      {address?.street?.trim() ? (
                        <InfoRow
                          icon={MapPin}
                          label="Street"
                          value={`${address.street}, ${formatLocation(address.city, address.state, address.zip)}`}
                        />
                      ) : null}
                      <InfoRow icon={CalendarDays} label="Date created" value={formatDate(customer.createdAt)} />
                      {customer.notes?.trim() ? (
                        <InfoRow
                          icon={NotebookPen}
                          label="Notes"
                          value={customer.notes}
                          className="sm:col-span-2"
                        />
                      ) : null}
                    </div>
                  </section>

                  <div className="grid gap-4">
                    <section className="overflow-hidden rounded-lg border border-black/10 bg-card shadow-[0_10px_28px_rgba(4,26,54,0.07)]">
                      <header className="flex items-center gap-2 border-b border-black/10 bg-[#f7f8fa] px-5 py-3">
                        <Wallet className="size-4 text-primary" aria-hidden="true" />
                        <h3 className="text-sm font-semibold">Account</h3>
                      </header>
                      <div className="grid grid-cols-1 gap-px bg-black/5">
                        <MoneyCell
                          label="Amount owing"
                          value={formatMoney(amountOwing)}
                          emphasize={amountOwing > 0}
                        />
                      </div>
                      <div className="grid sm:grid-cols-2">
                        {customer.taxCode?.trim() ? (
                          <InfoRow icon={Receipt} label="Tax code" value={customer.taxCode} />
                        ) : null}
                        {customer.laborTaxCode?.trim() ? (
                          <InfoRow icon={Receipt} label="Labor tax" value={customer.laborTaxCode} />
                        ) : null}
                        {customer.onStop ? (
                          <InfoRow icon={Ban} label="On stop" value="Yes" warn />
                        ) : null}
                      </div>
                    </section>

                    {assigned ? (
                      <section className="overflow-hidden rounded-lg border border-black/10 bg-card shadow-[0_10px_28px_rgba(4,26,54,0.07)]">
                        <header className="flex items-center gap-2 border-b border-black/10 bg-[#f7f8fa] px-5 py-3">
                          <UserRound className="size-4 text-primary" aria-hidden="true" />
                          <h3 className="text-sm font-semibold">Preferred technician</h3>
                        </header>
                        <div className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <CrmMark name={`${assigned.firstName} ${assigned.lastName}`} kind="person" photoKey={assigned.firstName} size="md" />
                            <div>
                              <Link
                                href={`/pro/dashboard/team/${assigned.id}`}
                                className="font-medium text-primary hover:underline"
                              >
                                {assigned.firstName} {assigned.lastName}
                              </Link>
                              <p className="text-sm text-muted-foreground">
                                {assigned.trade} · {assigned.phone}
                              </p>
                            </div>
                          </div>
                        </div>
                      </section>
                    ) : null}
                  </div>
                </div>
                {address ? <CustomerLocationMapLazy provider={provider} address={address} name={name} /> : null}
                </div>
              );
            case "estimates":
              return (
                <CustomerEstimatesPanel
                  customerId={customer.id}
                  customerNumber={customer.customerNumber}
                  relatedEstimates={relatedEstimates}
                  filter={estimateFilter}
                  onFilterChange={setEstimateFilter}
                  onCreate={() => setCreateEstimateOpen(true)}
                />
              );
            case "jobs":
              return (
                <CustomerJobsPanel
                  customerId={customer.id}
                  customerNumber={customer.customerNumber}
                  relatedJobs={relatedJobs}
                  relatedInvoices={relatedInvoices}
                  relatedEstimates={relatedEstimates}
                  requests={requests}
                  events={events}
                  customers={customers}
                  provider={provider}
                  employeeLabel={employeeLabel}
                  filter={jobFilter}
                  onFilterChange={setJobFilter}
                  onCreate={() => setCreateJobOpen(true)}
                />
              );
            case "schedule":
              return (
                <CustomerSchedulePanel
                  customerId={customer.id}
                  fallbackEvents={relatedEvents}
                  employeeLabel={employeeLabel}
                />
              );
            case "invoices":
              return (
                <CustomerInvoicesPanel
                  customerId={customer.id}
                  customerNumber={customer.customerNumber}
                  relatedInvoices={relatedInvoices}
                  relatedJobs={relatedJobs}
                  relatedEstimates={relatedEstimates}
                  relatedRequests={relatedRequests}
                  customers={customers}
                  provider={provider}
                  filter={invoiceFilter}
                  onFilterChange={setInvoiceFilter}
                  paying={paying}
                  onPayingChange={setPaying}
                  onPaymentClosed={() => {
                    void dispatch(fetchCustomerDetail(customer.id));
                    void dispatch(
                      fetchCustomerInvoices({
                        customerId: customer.id,
                        status: invoiceFilter || undefined,
                        force: true,
                      }),
                    );
                  }}
                />
              );
            case "history":
              return (
                <CustomerHistoryPanel
                  customerId={customer.id}
                  customer={customer}
                  dossier={dossier}
                  localHistory={history}
                  localEstimateCount={relatedEstimates.length}
                  localJobCount={relatedJobs.length}
                  localInvoiceCount={relatedInvoices.length}
                  localPaid={relatedPayments.reduce((sum, item) => sum + item.amount, 0)}
                />
              );
            case "notes":
              return (
                <UniversalNotesPanel
                  subjectKind="customer"
                  entityId={customer.id}
                  empty="Add the first note on this customer."
                />
              );
            case "tasks":
              return <CustomerTasksPanel customerId={customer.id} />;
            case "reminders":
              return (
                <CustomerRemindersPanel
                  customerId={customer.id}
                  relatedReminders={[]}
                  onSetReminder={() => setReminderOpen(true)}
                />
              );
            default:
              return <Empty>Unknown tab.</Empty>;
          }
        }}
      </RecordWorkspace>
      <CreateReminderDialog
        open={reminderOpen}
        onOpenChange={setReminderOpen}
        subjectKind="customer"
        subjectId={customer.id}
        onCreated={(item) => {
          dispatch(upsertCustomerReminder({ customerId: customer.id, item }));
        }}
      />
      <CreateTaskDialog
        open={taskOpen}
        onOpenChange={setTaskOpen}
        subjectKind="customer"
        subjectId={customer.id}
        onCreated={(item) => {
          dispatch(upsertCustomerTask({ customerId: customer.id, item }));
          void dispatch(fetchCustomerTasks({ customerId: customer.id, force: true }));
          void dispatch(fetchCustomerTimeline({ customerId: customer.id, force: true }));
        }}
      />
      <CreateCustomerNoteDialog
        open={noteOpen}
        onOpenChange={(next) => {
          setNoteOpen(next);
          if (!next) {
            // Notes live in their own slice; timeline should refresh once after note create.
            void dispatch(fetchCustomerTimeline({ customerId: customer.id, force: true }));
          }
        }}
        customerId={customer.id}
      />
      <CreateEstimateDialog
        open={createEstimateOpen}
        onOpenChange={setCreateEstimateOpen}
        customerId={customer.id}
        onCreated={(item) => {
          dispatch(upsertCustomerEstimate({ customerId: customer.id, item }));
          void dispatch(
            fetchCustomerEstimates({
              customerId: customer.id,
              isArchived: false,
              force: true,
            }),
          );
          void dispatch(fetchCustomerTimeline({ customerId: customer.id, force: true }));
        }}
      />
      <CreateJobDialog
        open={createJobOpen}
        onOpenChange={setCreateJobOpen}
        customerId={customer.id}
        onCreated={(item) => {
          dispatch(upsertCustomerJob({ customerId: customer.id, item }));
          void dispatch(fetchCustomerJobs({ customerId: customer.id, force: true }));
          void dispatch(fetchCustomerSchedule({ customerId: customer.id, force: true }));
          void dispatch(fetchCustomerTimeline({ customerId: customer.id, force: true }));
        }}
      />
    </>
  );
}

function CustomerEstimatesPanel({
  customerId,
  customerNumber,
  relatedEstimates,
  filter,
  onFilterChange,
  onCreate,
}: {
  customerId: string;
  customerNumber: string;
  relatedEstimates: Estimate[];
  filter: string;
  onFilterChange: (value: string) => void;
  onCreate: () => void;
}) {
  const dispatch = useAppDispatch();
  const records = usePortalRecords();
  const tab = useAppSelector((state) => state.customers?.estimates);
  const archivedOnly = filter === "archived";
  // UI "archived" maps to isArchived — never send it as status.
  const statusFilter = archivedOnly ? undefined : filter || undefined;
  const filterKey = customerTabFilterKey({
    status: statusFilter,
    isArchived: archivedOnly,
  });
  const [editEstimate, setEditEstimate] = useState<Estimate | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<Estimate | null>(null);
  const [archiving, setArchiving] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);

  useEffect(() => {
    if (!customerId) return;
    // GET /api/provider/estimates?customerId=&status=&isArchived=
    void dispatch(
      fetchCustomerEstimates({
        customerId,
        status: statusFilter,
        isArchived: archivedOnly,
        force: true,
      }),
    );
  }, [customerId, dispatch, statusFilter, archivedOnly]);

  // Always load from API (including Archived via isArchived=true).
  const rows = selectCustomerTabRows(tab, customerId, filterKey, []).filter(
    (item) => item.customerId === customerId,
  );
  const listLoading = selectCustomerTabShowLoader(tab, customerId, filterKey);

  return (
    <div>
      <div className="mb-3 flex justify-end">
        <Button size="sm" onClick={onCreate}>
          Create estimate
        </Button>
      </div>
      <PortalDataTable
        filename={`${customerNumber}-estimates`}
        countLabel="Estimates"
        searchPlaceholder="Search estimates"
        loading={listLoading}
        pageSize={10}
        empty={
          archivedOnly
            ? "No archived estimates."
            : filter
              ? "No estimates match this status."
              : "No estimates yet."
        }
        toolbar={
          <div className="flex items-center gap-2">
            <Field className="w-40 gap-0 sm:w-44">
              <FieldLabel htmlFor="estimate-status-filter" className="sr-only">
                Status
              </FieldLabel>
              <Select
                value={filter || "__all__"}
                onValueChange={(value) =>
                  onFilterChange(value === "__all__" ? "" : value)
                }
              >
                <SelectTrigger
                  id="estimate-status-filter"
                  className="h-8.5 w-full text-xs"
                >
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent position="popper" align="end">
                  {withArchiveFilter(ESTIMATE_STATUS_FILTERS).map((option) => (
                    <SelectItem
                      key={option.label}
                      value={option.value || "__all__"}
                    >
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
        }
        rows={rows}
        rowKey={(row) => row.id}
        rowHref={(row) => `/pro/dashboard/estimates/${row.id}`}
        columns={[
          {
            id: "number",
            header: "Estimate #",
            sortValue: (row) => row.number,
            searchValue: (row) => row.number,
            exportValue: (row) => row.number,
            cell: (row) => (
              <Link href={`/pro/dashboard/estimates/${row.id}`} className="font-medium text-primary hover:underline">
                {row.number}
              </Link>
            ),
          },
          {
            id: "name",
            header: "Estimate name",
            sortValue: (row) => row.title?.trim() || "",
            searchValue: (row) => row.title?.trim() || "",
            exportValue: (row) => row.title?.trim() || "",
            cell: (row) => row.title?.trim() || "—",
          },
          {
            id: "street",
            header: "Job address",
            sortValue: (row) => row.propertyAddress.street,
            searchValue: (row) => `${row.propertyAddress.street} ${row.propertyAddress.city}`,
            exportValue: (row) => row.propertyAddress.street,
            cell: (row) => row.propertyAddress.street,
          },
          {
            id: "issued",
            header: "Issued",
            sortValue: (row) => row.issuedAt,
            searchValue: (row) => formatDate(row.issuedAt),
            exportValue: (row) => formatDate(row.issuedAt),
            cell: (row) => formatDate(row.issuedAt),
          },
          {
            id: "expires",
            header: "Expires",
            sortValue: (row) => row.expiresAt ?? "",
            searchValue: (row) => (row.expiresAt ? formatDate(row.expiresAt) : ""),
            exportValue: (row) => (row.expiresAt ? formatDate(row.expiresAt) : ""),
            cell: (row) => (row.expiresAt ? formatDate(row.expiresAt) : "—"),
          },
          {
            id: "subtotal",
            header: "Subtotal",
            sortValue: (row) => row.subtotal,
            searchValue: (row) => formatMoney(row.subtotal),
            exportValue: (row) => formatMoney(row.subtotal),
            className: "tabular-nums",
            cell: (row) => formatMoney(row.subtotal),
          },
          {
            id: "tax",
            header: "Tax",
            sortValue: (row) => row.tax,
            searchValue: (row) => formatMoney(row.tax),
            exportValue: (row) => formatMoney(row.tax),
            className: "tabular-nums",
            cell: (row) => formatMoney(row.tax),
          },
          {
            id: "total",
            header: "Total",
            sortValue: (row) => row.total,
            searchValue: (row) => formatMoney(row.total),
            exportValue: (row) => formatMoney(row.total),
            className: "tabular-nums",
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
        actions={(row) => {
          // Prefer API flag — local archive store can be stale and show Restore wrongly.
          const archived = Boolean(row.isArchived ?? row.isArchieved);
          return [
            { label: "Open", href: `/pro/dashboard/estimates/${row.id}` },
            {
              label: "Edit",
              onSelect: () => setEditEstimate(row),
            },
            { label: "Convert to job", href: `/pro/dashboard/estimates/${row.id}` },
            archived
              ? {
                  label: restoringId === row.id ? "Restoring…" : "Restore",
                  icon: (
                    <ArchiveRestore className="size-3.5 text-muted-foreground" />
                  ),
                  onSelect: () => {
                    if (restoringId) return;
                    void (async () => {
                      setRestoringId(row.id);
                      try {
                        const updated = await updateEstimateArchive(row.id, false);
                        if (!updated || (updated.isArchived ?? updated.isArchieved)) {
                          throw new Error("Restore did not save. Check the API and try again.");
                        }
                        dispatch(removeCustomerEstimate(row.id));
                        void dispatch(
                          fetchCustomerEstimates({
                            customerId,
                            status: statusFilter,
                            isArchived: archivedOnly,
                            force: true,
                          }),
                        );
                        void dispatch(
                          fetchCustomerTimeline({ customerId, force: true }),
                        );
                        toast.success(`${row.number} restored.`);
                      } catch (error) {
                        toast.error(
                          error instanceof Error
                            ? error.message
                            : "Could not restore this estimate.",
                        );
                      } finally {
                        setRestoringId(null);
                      }
                    })();
                  },
                }
              : archiveRowAction(
                  records,
                  "estimate",
                  row.id,
                  row.number,
                  () => setArchiveTarget(row),
                ),
          ];
        }}
      />
      <ConfirmArchiveDialog
        open={Boolean(archiveTarget)}
        onOpenChange={(open) => {
          if (!archiving && !open) setArchiveTarget(null);
        }}
        kind="estimate"
        number={archiveTarget?.number}
        loading={archiving}
        onConfirm={() => {
          if (!archiveTarget || archiving) return;
          void (async () => {
            setArchiving(true);
            try {
              const updated = await updateEstimateArchive(archiveTarget.id, true);
              if (!updated || !(updated.isArchived ?? updated.isArchieved)) {
                throw new Error("Archive did not save. Check the API and try again.");
              }
              dispatch(removeCustomerEstimate(archiveTarget.id));
              void dispatch(
                fetchCustomerEstimates({
                  customerId,
                  status: statusFilter,
                  isArchived: archivedOnly,
                  force: true,
                }),
              );
              void dispatch(fetchCustomerTimeline({ customerId, force: true }));
              toast.success(`${archiveTarget.number} archived.`);
              setArchiveTarget(null);
            } catch (error) {
              toast.error(
                error instanceof Error
                  ? error.message
                  : "Could not archive this estimate.",
              );
            } finally {
              setArchiving(false);
            }
          })();
        }}
      />
      <CreateEstimateDialog
        open={Boolean(editEstimate)}
        onOpenChange={(next) => {
          if (!next) setEditEstimate(null);
        }}
        customerId={customerId}
        estimate={editEstimate}
        onUpdated={(item) => {
          dispatch(upsertCustomerEstimate({ customerId, item }));
          void dispatch(
            fetchCustomerEstimates({
              customerId,
              status: statusFilter,
              isArchived: archivedOnly,
              force: true,
            }),
          );
          void dispatch(fetchCustomerTimeline({ customerId, force: true }));
          setEditEstimate(null);
        }}
      />
    </div>
  );
}

function CustomerJobsPanel({
  customerId,
  customerNumber,
  relatedJobs,
  relatedInvoices,
  relatedEstimates,
  requests,
  events,
  customers,
  provider,
  employeeLabel,
  filter,
  onFilterChange,
  onCreate,
}: {
  customerId: string;
  customerNumber: string;
  relatedJobs: Job[];
  relatedInvoices: Invoice[];
  relatedEstimates: Estimate[];
  requests: PortalRequest[];
  events: PortalCalendarEvent[];
  customers: PortalCustomerCrm[];
  provider: ReturnType<typeof usePortalWorkspace>["provider"];
  employeeLabel: (id?: string) => string;
  filter: string;
  onFilterChange: (value: string) => void;
  onCreate: () => void;
}) {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const records = usePortalRecords();
  const crm = useCrmApiData();
  const { session, invoices } = usePortalWorkspace();
  const { assign, employees } = usePortalCrew();
  const tab = useAppSelector((state) => state.customers?.jobs);
  const archivedOnly = filter === "archived";
  const statusFilter = archivedOnly ? undefined : filter || undefined;
  const filterKey = customerTabFilterKey({
    status: statusFilter,
    isArchived: archivedOnly,
  });
  const [deleteTarget, setDeleteTarget] = useState<Job | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [editJob, setEditJob] = useState<Job | null>(null);
  const [calendarJob, setCalendarJob] = useState<Job | null>(null);
  const [convertingId, setConvertingId] = useState<string | null>(null);
  const [statusJob, setStatusJob] = useState<Job | null>(null);
  const [nextStatus, setNextStatus] = useState<JobStatus>("unscheduled");
  const [savingStatus, setSavingStatus] = useState(false);
  const [archiveTarget, setArchiveTarget] = useState<Job | null>(null);
  const [archiving, setArchiving] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);

  useEffect(() => {
    if (!customerId) return;
    void dispatch(
      fetchCustomerJobs({
        customerId,
        status: statusFilter,
        isArchived: archivedOnly,
        force: true,
      }),
    );
  }, [customerId, dispatch, statusFilter, archivedOnly]);

  const rows = selectCustomerTabRows(tab, customerId, filterKey, []).filter(
    (item) => item.customerId === customerId,
  );
  const listLoading = selectCustomerTabShowLoader(tab, customerId, filterKey);
  const allInvoices = records.mergeInvoices(invoices);

  const calendarEvent = (() => {
    if (!calendarJob) return null;
    const existing = events.find((item) => item.kind === "job" && item.recordId === calendarJob.id);
    if (existing) return existing;
    const window = minutesForWindow("morning");
    const startDate = (calendarJob.scheduledAt || todayISO()).slice(0, 10);
    const endDate = (calendarJob.dueAt || calendarJob.scheduledAt || todayISO()).slice(0, 10);
    return {
      id: `cal_${calendarJob.id}`,
      kind: "job" as const,
      recordId: calendarJob.id,
      title: calendarJob.number,
      detail: calendarJob.title || calendarJob.notes || calendarJob.address.city,
      customerName: undefined,
      date: startDate,
      endDate,
      timeWindow: "morning" as const,
      startMinutes: window.startMinutes,
      endMinutes: window.endMinutes,
      employeeId: employees.find((item) => item.active)?.id,
      href: `/pro/dashboard/jobs/${calendarJob.id}`,
      status: calendarJob.status,
    };
  })();

  async function confirmDelete() {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    try {
      const result = await dispatch(
        deleteCustomerJob({ id: deleteTarget.id, customerId }),
      );
      if (deleteCustomerJob.rejected.match(result)) {
        toast.error(typeof result.payload === "string" ? result.payload : "Could not delete this job.");
        return;
      }
      toast.success(`${deleteTarget.number} deleted.`);
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  }

  async function convertToInvoice(job: Job) {
    if (convertingId) return;
    const existing =
      relatedInvoices.find((item) => item.jobId === job.id) ||
      allInvoices.find((item) => item.jobId === job.id);
    if (existing) {
      router.push(`/pro/dashboard/invoices/${existing.id}`);
      return;
    }
    setConvertingId(job.id);
    try {
      if (crm.enabled) {
        const created = await convertJobToInvoiceApi(job.id);
        if (!created?.id) throw new Error("The CRM did not return the new invoice.");
        toast.success(`${created.number || "Invoice"} drafted from ${job.number}.`);
        void dispatch(fetchCustomerJobs({ customerId, force: true }));
        void dispatch(fetchCustomerInvoices({ customerId, force: true }));
        void dispatch(fetchCustomerTimeline({ customerId, force: true }));
        router.push(`/pro/dashboard/invoices/${created.id}`);
        return;
      }
      const lines = readCostLines(session?.email, job);
      const created = buildInvoice({
        number: nextRecordNumber(
          "INV",
          allInvoices.map((item) => item.number),
        ),
        providerId: provider.id,
        customerId: job.customerId,
        jobId: job.id,
        lines: lines.length
          ? lines
          : job.items.map((item) => ({
              id: item.id,
              description: item.description,
              kind: "materials" as const,
              quantity: item.quantity,
              unit: item.unit,
              unitPrice: item.unitPrice,
            })),
      });
      records.addInvoice(created);
      records.linkRecords("job", job.id, created.id);
      records.setStatus("job", job.id, "invoiced");
      toast.success(`${created.number} drafted from ${job.number}.`);
      router.push(`/pro/dashboard/invoices/${created.id}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not convert this job.");
    } finally {
      setConvertingId(null);
    }
  }

  function openStatusModal(job: Job) {
    setStatusJob(job);
    setNextStatus(job.status);
  }

  async function confirmStatusChange() {
    if (!statusJob || savingStatus) return;
    if (nextStatus === statusJob.status) {
      setStatusJob(null);
      return;
    }
    setSavingStatus(true);
    try {
      const result = await dispatch(
        patchCustomerJobStatus({
          id: statusJob.id,
          status: nextStatus,
          customerId,
        }),
      );
      if (patchCustomerJobStatus.rejected.match(result)) {
        toast.error(
          typeof result.payload === "string" ? result.payload : "Could not update job status.",
        );
        return;
      }
      toast.success(`${statusJob.number} marked ${jobStatusLabel(nextStatus)}.`);
      setStatusJob(null);
      void dispatch(fetchCustomerJobs({ customerId, force: true }));
      void dispatch(fetchCustomerTimeline({ customerId, force: true }));
    } finally {
      setSavingStatus(false);
    }
  }

  return (
    <div>
      <div className="mb-3 flex justify-end">
        <Button size="sm" onClick={onCreate}>
          Create job
        </Button>
      </div>
      <PortalDataTable
        filename={`${customerNumber}-jobs`}
        countLabel="Jobs"
        searchPlaceholder="Search jobs"
        loading={listLoading}
        pageSize={10}
        empty={
          archivedOnly
            ? "No archived jobs."
            : filter
              ? "No jobs match this status."
              : "No jobs yet."
        }
        toolbar={
          <div className="flex items-center gap-2">
            <Field className="w-40 gap-0 sm:w-44">
              <FieldLabel htmlFor="job-status-filter" className="sr-only">
                Status
              </FieldLabel>
              <Select
                value={filter || "__all__"}
                onValueChange={(value) =>
                  onFilterChange(value === "__all__" ? "" : value)
                }
              >
                <SelectTrigger
                  id="job-status-filter"
                  className="h-8.5 w-full text-xs"
                >
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent position="popper" align="end">
                  {withArchiveFilter(JOB_STATUS_FILTERS).map((option) => (
                    <SelectItem
                      key={option.label}
                      value={option.value || "__all__"}
                    >
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
        }
        rows={rows}
        rowKey={(row) => row.id}
        rowHref={(row) => `/pro/dashboard/jobs/${row.id}`}
        columns={jobBoardColumns({
          estimates: relatedEstimates,
          requests,
          invoices: relatedInvoices,
          events,
          employeeLabel,
          customerName: (id) => {
            const match = customers.find((item) => item.id === id);
            return match ? crmCustomerName(match) : getPortalCustomerName(provider, id);
          },
          onChangeStatus: openStatusModal,
        })}
        actions={(row) => {
          const archived = Boolean(row.isArchived);
          return [
            { label: "Open", href: `/pro/dashboard/jobs/${row.id}` },
            {
              label: "Edit",
              onSelect: () => setEditJob(row),
            },
            {
              label: convertingId === row.id ? "Converting…" : "Convert to invoice",
              onSelect: () => {
                void convertToInvoice(row);
              },
            },
            {
              label: "Calendar",
              onSelect: () => setCalendarJob(row),
            },
            archived
              ? {
                  label: restoringId === row.id ? "Restoring…" : "Restore",
                  icon: (
                    <ArchiveRestore className="size-3.5 text-muted-foreground" />
                  ),
                  onSelect: () => {
                    if (restoringId) return;
                    void (async () => {
                      setRestoringId(row.id);
                      try {
                        const updated = await updateJobArchive(row.id, false);
                        if (!updated || updated.isArchived) {
                          throw new Error(
                            "Restore did not save. Check the API and try again.",
                          );
                        }
                        dispatch(removeCustomerJobLocal(row.id));
                        void dispatch(
                          fetchCustomerJobs({
                            customerId,
                            status: statusFilter,
                            isArchived: archivedOnly,
                            force: true,
                          }),
                        );
                        void dispatch(
                          fetchCustomerTimeline({ customerId, force: true }),
                        );
                        toast.success(`${row.number} restored.`);
                      } catch (error) {
                        toast.error(
                          error instanceof Error
                            ? error.message
                            : "Could not restore this job.",
                        );
                      } finally {
                        setRestoringId(null);
                      }
                    })();
                  },
                }
              : archiveRowAction(
                  records,
                  "job",
                  row.id,
                  row.number,
                  () => setArchiveTarget(row),
                ),
            {
              label: "Delete",
              variant: "destructive",
              onSelect: () => setDeleteTarget(row),
            },
          ];
        }}
      />
      <ConfirmArchiveDialog
        open={Boolean(archiveTarget)}
        onOpenChange={(open) => {
          if (!archiving && !open) setArchiveTarget(null);
        }}
        kind="job"
        number={archiveTarget?.number}
        loading={archiving}
        onConfirm={() => {
          if (!archiveTarget || archiving) return;
          void (async () => {
            setArchiving(true);
            try {
              const updated = await updateJobArchive(archiveTarget.id, true);
              if (!updated || !updated.isArchived) {
                throw new Error(
                  "Archive did not save. Check the API and try again.",
                );
              }
              dispatch(removeCustomerJobLocal(archiveTarget.id));
              void dispatch(
                fetchCustomerJobs({
                  customerId,
                  status: statusFilter,
                  isArchived: archivedOnly,
                  force: true,
                }),
              );
              void dispatch(fetchCustomerTimeline({ customerId, force: true }));
              toast.success(`${archiveTarget.number} archived.`);
              setArchiveTarget(null);
            } catch (error) {
              toast.error(
                error instanceof Error
                  ? error.message
                  : "Could not archive this job.",
              );
            } finally {
              setArchiving(false);
            }
          })();
        }}
      />
      <CreateJobDialog
        open={Boolean(editJob)}
        onOpenChange={(next) => {
          if (!next) setEditJob(null);
        }}
        customerId={customerId}
        job={editJob}
        onUpdated={(item) => {
          dispatch(upsertCustomerJob({ customerId, item }));
          void dispatch(
            fetchCustomerJobs({
              customerId,
              status: statusFilter,
              isArchived: archivedOnly,
              force: true,
            }),
          );
          void dispatch(fetchCustomerSchedule({ customerId, force: true }));
          void dispatch(fetchCustomerTimeline({ customerId, force: true }));
          setEditJob(null);
        }}
      />
      <AssignEventDialog
        open={Boolean(calendarJob)}
        onOpenChange={(next) => {
          if (!next) setCalendarJob(null);
        }}
        event={calendarEvent}
        events={calendarEvent ? [calendarEvent] : []}
        employees={employees}
        defaultDate={calendarEvent?.date}
        onSave={async (assignment) => {
          await assign(assignment);
          toast.success("Schedule updated.");
          void dispatch(
            fetchCustomerJobs({
              customerId,
              status: statusFilter,
              isArchived: archivedOnly,
              force: true,
            }),
          );
          void dispatch(fetchCustomerSchedule({ customerId, force: true }));
          void dispatch(fetchCustomerTimeline({ customerId, force: true }));
          setCalendarJob(null);
        }}
      />
      <Dialog
        open={Boolean(statusJob)}
        onOpenChange={(next) => {
          if (!next && !savingStatus) setStatusJob(null);
        }}
      >
        <DialogContent showCloseButton={!savingStatus} className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Change status</DialogTitle>
            <DialogDescription>
              {statusJob
                ? `Update the operational status for ${statusJob.number}.`
                : "Update the operational status for this job."}
            </DialogDescription>
          </DialogHeader>
          <Field>
            <FieldLabel htmlFor="job-status-change">Status</FieldLabel>
            <Select
              value={nextStatus}
              onValueChange={(value) => setNextStatus(value as JobStatus)}
              disabled={savingStatus}
            >
              <SelectTrigger id="job-status-change" className="w-full">
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent
                position="popper"
                side="bottom"
                align="start"
                className="z-[100] max-h-48 w-[var(--radix-select-trigger-width)] overflow-y-auto"
              >
                {JOB_STATUSES.map((item) => (
                  <SelectItem key={item} value={item}>
                    {jobStatusLabel(item)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={savingStatus}
              onClick={() => setStatusJob(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={savingStatus}
              onClick={() => {
                void confirmStatusChange();
              }}
            >
              {savingStatus ? "Saving…" : "Update status"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        open={Boolean(deleteTarget)}
        onOpenChange={(next) => {
          if (!next && !deleting) setDeleteTarget(null);
        }}
      >
        <DialogContent showCloseButton={!deleting} className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete job?</DialogTitle>
            <DialogDescription>
              {deleteTarget
                ? `This will permanently remove “${deleteTarget.number}” from this customer.`
                : "This will permanently remove this job."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={deleting} onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={deleting}
              onClick={() => {
                void confirmDelete();
              }}
            >
              {deleting ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CustomerSchedulePanel({
  customerId,
  fallbackEvents,
  employeeLabel,
}: {
  customerId: string;
  fallbackEvents: PortalCalendarEvent[];
  employeeLabel: (id?: string) => string;
}) {
  const dispatch = useAppDispatch();
  const tab = useAppSelector((state) => state.customers?.schedule);
  const filterKey = customerTabFilterKey({});

  useEffect(() => {
    if (!customerId) return;
    void dispatch(fetchCustomerSchedule({ customerId, force: true }));
  }, [customerId, dispatch]);

  const events = selectCustomerTabRows(tab, customerId, filterKey, fallbackEvents);
  const listLoading = selectCustomerTabShowLoader(tab, customerId, filterKey);

  if (listLoading) {
    return <CenteredSpinner label="Loading schedules" className="min-h-[12rem]" />;
  }

  return <CustomerEventCalendar events={events} employeeLabel={employeeLabel} />;
}

function CustomerInvoicesPanel({
  customerId,
  customerNumber,
  relatedInvoices,
  relatedJobs,
  relatedEstimates,
  relatedRequests,
  customers,
  provider,
  filter,
  onFilterChange,
  paying,
  onPayingChange,
  onPaymentClosed,
}: {
  customerId: string;
  customerNumber: string;
  relatedInvoices: Invoice[];
  relatedJobs: Job[];
  relatedEstimates: Estimate[];
  relatedRequests: PortalRequest[];
  customers: PortalCustomerCrm[];
  provider: ReturnType<typeof usePortalWorkspace>["provider"];
  filter: string;
  onFilterChange: (value: string) => void;
  paying: Invoice | null;
  onPayingChange: (invoice: Invoice | null) => void;
  onPaymentClosed: () => void;
}) {
  const dispatch = useAppDispatch();
  const records = usePortalRecords();
  const tab = useAppSelector((state) => state.customers?.invoices);
  const archivedOnly = filter === "archived";
  const useApi = !archivedOnly;
  const filterKey = customerTabFilterKey({ status: filter || undefined });

  useEffect(() => {
    if (!useApi || !customerId) return;
    void dispatch(
      fetchCustomerInvoices({
        customerId,
        status: filter || undefined,
        force: true,
      }),
    );
  }, [customerId, dispatch, filter, useApi]);

  const fallbackRows = relatedInvoices.filter((item) => {
    const archived = records.isArchived("invoice", item.id);
    if (filter === "archived") return archived;
    return !archived && invoiceMatchesBoardFilter(item, filter);
  });
  const rows = useApi
    ? selectCustomerTabRows(tab, customerId, filterKey, fallbackRows).filter(
        (item) => !records.isArchived("invoice", item.id),
      )
    : fallbackRows;
  const listLoading = useApi && selectCustomerTabShowLoader(tab, customerId, filterKey);

  return (
    <div>
      <LocalFilterTabs
        value={filter}
        onChange={onFilterChange}
        options={withArchiveFilter(INVOICE_BOARD_FILTERS)}
      />
      <PortalDataTable
        filename={`${customerNumber}-invoices`}
        countLabel="Invoices"
        searchPlaceholder="Search by invoice # or job #"
        loading={listLoading}
        pageSize={10}
        empty={
          filter && filter !== "archived"
            ? "No invoices match this status."
            : "No invoices yet."
        }
        rows={rows}
        rowKey={(row) => row.id}
        rowHref={(row) => `/pro/dashboard/invoices/${row.id}`}
        columns={invoiceBoardColumns({
          jobs: relatedJobs,
          estimates: relatedEstimates,
          requests: relatedRequests,
          hideCustomer: true,
          customerName: (id) => {
            const match = customers.find((item) => item.id === id);
            return match ? crmCustomerName(match) : getPortalCustomerName(provider, id);
          },
        })}
        actions={(row) => [
          { label: "Open", href: `/pro/dashboard/invoices/${row.id}` },
          { label: "Edit", href: `/pro/dashboard/invoices/${row.id}` },
          ...(row.balanceDue > 0
            ? [
                {
                  label: "Apply payment",
                  onSelect: () => onPayingChange(row),
                },
              ]
            : []),
          ...(relatedJobs.some((job) => job.id === row.jobId)
            ? [{ label: "Open job", href: `/pro/dashboard/jobs/${row.jobId}` }]
            : []),
          archiveRowAction(records, "invoice", row.id, row.number),
        ]}
      />
      <ApplyPaymentDialog
        open={Boolean(paying)}
        onOpenChange={(open) => {
          if (!open) {
            onPayingChange(null);
            onPaymentClosed();
          }
        }}
        invoice={paying}
      />
    </div>
  );
}

function CustomerHistoryPanel({
  customerId,
  customer,
  dossier,
  localHistory,
  localEstimateCount,
  localJobCount,
  localInvoiceCount,
  localPaid,
}: {
  customerId: string;
  customer: PortalCustomerCrm;
  dossier: CustomerDossier | null;
  localHistory: HistoryItem[];
  localEstimateCount: number;
  localJobCount: number;
  localInvoiceCount: number;
  localPaid: number;
}) {
  const dispatch = useAppDispatch();
  const tab = useAppSelector((state) => state.customers?.timeline);
  const [page, setPage] = useState(1);
  const filterKey = customerTabFilterKey({ page });

  useEffect(() => {
    if (!customerId) return;
    void dispatch(
      fetchCustomerTimeline({
        customerId,
        page,
        limit: 10,
        force: true,
      }),
    );
  }, [customerId, dispatch, page]);

  const useApiEvents = Boolean(
    tab?.customerId === customerId && (tab.loaded || tab.loading || tab.items.length > 0),
  );
  const events: Array<HistoryItem | CustomerTimelineEvent> = useApiEvents
    ? tab!.items
    : localHistory;
  const estimateCount = dossier?.estimatesCount ?? localEstimateCount;
  const jobCount = dossier?.jobsCount ?? localJobCount;
  const invoiceCount = dossier?.invoicesCount ?? localInvoiceCount;
  const paid = dossier?.totalPaid ?? localPaid;
  const listLoading = selectCustomerTabShowLoader(tab, customerId, filterKey);
  const total = useApiEvents ? (tab?.total ?? events.length) : events.length;
  const totalPages = useApiEvents
    ? Math.max(1, tab?.totalPages ?? 1)
    : Math.max(1, Math.ceil(events.length / 10));
  const currentPage = useApiEvents ? (tab?.page ?? page) : page;
  const from = total === 0 ? 0 : (currentPage - 1) * 10 + 1;
  const to = Math.min(currentPage * 10, total);

  function goToPage(next: number) {
    const bounded = Math.min(Math.max(1, next), totalPages);
    setPage(bounded);
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 text-sm sm:grid-cols-4">
        <Stat label="Estimates" value={String(estimateCount)} />
        <Stat label="Jobs" value={String(jobCount)} />
        <Stat label="Invoices" value={String(invoiceCount)} />
        <Stat label="Paid" value={formatMoney(paid)} />
      </div>
      <div className="border border-black/15 bg-card">
        <div className="border-b border-black/10 px-4 py-3">
          <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Activity</p>
          <p className="text-sm text-muted-foreground">
            {total} events since {formatDate(customer.createdAt)} · {crmSourceLabel(customer.source)}
          </p>
        </div>
        {listLoading ? (
          <CenteredSpinner label="Loading history" className="min-h-[12rem]" />
        ) : events.length === 0 ? (
          <Empty title="No history yet">Activity for this customer will show up here.</Empty>
        ) : (
          <ol className="divide-y divide-black/10">
            {events.map((item) => {
              if ("kind" in item) {
                return (
                  <li key={item.id} className="flex items-start gap-3 px-4 py-3">
                    <span className={`mt-0.5 rounded-md px-1.5 py-0.5 text-[10px] font-medium ${historyTone(item.kind)}`}>
                      {historyKindLabel(item.kind)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{item.title}</p>
                      <p className="text-xs text-muted-foreground">{item.detail}</p>
                      {item.href ? (
                        <Link href={item.href} className="mt-1 inline-block text-xs font-medium text-primary hover:underline">
                          Open
                        </Link>
                      ) : null}
                    </div>
                    <p className="shrink-0 text-xs text-muted-foreground">{formatDate(item.at)}</p>
                  </li>
                );
              }
              const event = item as CustomerTimelineEvent;
              return (
                <li key={event.id} className="flex items-start gap-3 px-4 py-3">
                  <span className={`mt-0.5 rounded-md px-1.5 py-0.5 text-[10px] font-medium ${timelineTone(event.type)}`}>
                    {timelineTypeLabel(event.type)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{event.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {event.description}
                      {event.actor ? ` · ${event.actor}` : ""}
                      {event.status ? ` · ${event.status}` : ""}
                    </p>
                  </div>
                  <p className="shrink-0 text-xs text-muted-foreground">{formatDate(event.timestamp)}</p>
                </li>
              );
            })}
          </ol>
        )}
        {useApiEvents && total > 0 ? (
          <div className="flex flex-col gap-3 border-t border-black/10 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-muted-foreground">
              Showing {from}–{to} of {total}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage <= 1 || Boolean(tab?.loading)}
                onClick={() => goToPage(currentPage - 1)}
              >
                Previous
              </Button>
              <span className="text-xs text-muted-foreground">
                Page {currentPage} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage >= totalPages || Boolean(tab?.loading)}
                onClick={() => goToPage(currentPage + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function CustomerTasksPanel({ customerId }: { customerId: string }) {
  const dispatch = useAppDispatch();
  const tab = useAppSelector((state) => state.customers?.tasks);
  const filterKey = customerTabFilterKey({});
  const [editing, setEditing] = useState<PortalTask | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PortalTask | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!customerId) return;
    void dispatch(fetchCustomerTasks({ customerId, force: true }));
  }, [customerId, dispatch]);

  // API-only list — never fall back to local/seed tasks on this tab.
  const rows = selectCustomerTabRows(tab, customerId, filterKey, []);
  const listLoading = selectCustomerTabShowLoader(tab, customerId, filterKey);
  const [busyTaskId, setBusyTaskId] = useState<string | null>(null);

  async function toggleTask(item: PortalTask) {
    setBusyTaskId(item.id);
    const nextStatus = item.status === "done" ? "open" : "done";
    try {
      const result = await dispatch(patchCustomerTaskStatus({ id: item.id, status: nextStatus, customerId }));
      if (patchCustomerTaskStatus.rejected.match(result)) {
        toast.error(typeof result.payload === "string" ? result.payload : "Could not update task.");
      }
    } finally {
      setBusyTaskId(null);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    try {
      const result = await dispatch(deleteCustomerTask({ id: deleteTarget.id, customerId }));
      if (deleteCustomerTask.rejected.match(result)) {
        toast.error(typeof result.payload === "string" ? result.payload : "Could not delete this task.");
        return;
      }
      toast.success(`${deleteTarget.number} removed.`);
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {listLoading || !rows.length ? "\u00a0" : `${rows.length} tasks on this customer`}
        </p>
        <SetTaskButton
          subjectKind="customer"
          subjectId={customerId}
          onCreated={(item) => {
            dispatch(upsertCustomerTask({ customerId, item }));
            void dispatch(fetchCustomerTasks({ customerId, force: true }));
            void dispatch(fetchCustomerTimeline({ customerId, force: true }));
          }}
        />
      </div>
      {listLoading ? (
        <CenteredSpinner label="Loading tasks" className="min-h-[12rem]" />
      ) : rows.length ? (
        rows.map((item) => (
          <div key={item.id} className="flex items-center justify-between gap-3 border border-black/10 px-3 py-2.5">
            <div className="flex min-w-0 items-start gap-3">
              {busyTaskId === item.id ? (
                <Loader2 className="mt-1 size-4 animate-spin text-primary" />
              ) : (
                <Checkbox
                  checked={item.status === "done"}
                  onCheckedChange={() => void toggleTask(item)}
                  aria-label={`Mark ${item.title} ${item.status === "done" ? "open" : "done"}`}
                  className="mt-1"
                />
              )}
              <div>
                <Link href={`/pro/dashboard/tasks/${item.id}`} className="text-sm font-medium text-primary hover:underline">
                  {item.number} · {item.title}
                </Link>
                <p className="text-xs text-muted-foreground">
                  Due {formatDate(item.dueAt)} · {item.note}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <StatusPill label={crmTaskStatusLabel(item.status)} />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant="outline">
                    Actions
                    <ChevronDown className="size-3.5" aria-hidden="true" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={() => setEditing(item)}>Edit</DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href={`/pro/dashboard/tasks/${item.id}`}>Open</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onSelect={() => setDeleteTarget(item)}
                  >
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        ))
      ) : (
        <Empty title="No tasks yet">
          Create a task against this customer — permit, follow-up, or paperwork.
        </Empty>
      )}
      <CreateTaskDialog
        open={Boolean(editing)}
        task={editing}
        onOpenChange={(next) => {
          if (!next) setEditing(null);
        }}
        subjectKind="customer"
        subjectId={customerId}
        onCreated={(item) => {
          dispatch(upsertCustomerTask({ customerId, item }));
          void dispatch(fetchCustomerTasks({ customerId, force: true }));
          void dispatch(fetchCustomerTimeline({ customerId, force: true }));
        }}
      />
      <DeleteConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(next) => {
          if (!next && !deleting) setDeleteTarget(null);
        }}
        title="Delete task?"
        description={
          deleteTarget
            ? `This will permanently remove “${deleteTarget.number} · ${deleteTarget.title}”.`
            : "This will permanently remove this task."
        }
        confirmLabel="Delete"
        loading={deleting}
        onConfirm={confirmDelete}
      />
    </div>
  );
}

function CustomerRemindersPanel({
  customerId,
  relatedReminders,
  onSetReminder,
}: {
  customerId: string;
  relatedReminders: PortalReminder[];
  onSetReminder: () => void;
}) {
  const dispatch = useAppDispatch();
  const tab = useAppSelector((state) => state.customers?.reminders);
  const filterKey = customerTabFilterKey({});
  const [editing, setEditing] = useState<PortalReminder | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PortalReminder | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [busyReminderId, setBusyReminderId] = useState<string | null>(null);

  useEffect(() => {
    if (!customerId) return;
    void dispatch(fetchCustomerReminders({ customerId, force: true }));
  }, [customerId, dispatch]);

  const rows = selectCustomerTabRows(tab, customerId, filterKey, relatedReminders);
  const listLoading = selectCustomerTabShowLoader(tab, customerId, filterKey);

  async function toggleReminder(item: PortalReminder) {
    setBusyReminderId(item.id);
    const nextStatus = item.status === "open" ? "done" : "open";
    try {
      const result = await dispatch(
        patchCustomerReminderStatus({ id: item.id, status: nextStatus, customerId }),
      );
      if (patchCustomerReminderStatus.rejected.match(result)) {
        toast.error(
          typeof result.payload === "string" ? result.payload : "Could not update reminder.",
        );
      }
    } finally {
      setBusyReminderId(null);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    try {
      const result = await dispatch(deleteCustomerReminder({ id: deleteTarget.id, customerId }));
      if (deleteCustomerReminder.rejected.match(result)) {
        toast.error(
          typeof result.payload === "string" ? result.payload : "Could not delete this reminder.",
        );
        return;
      }
      toast.success("Reminder removed.");
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {listLoading || !rows.length ? "\u00a0" : `${rows.length} reminders`}
        </p>
        <Button size="sm" onClick={onSetReminder}>
          Set reminder
        </Button>
      </div>
      {listLoading ? (
        <CenteredSpinner label="Loading reminders" className="min-h-[12rem]" />
      ) : rows.length ? (
        rows.map((item) => (
          <div key={item.id} className="flex items-center justify-between gap-3 border border-black/10 px-3 py-2.5">
            <div className="min-w-0">
              <Link
                href={`/pro/dashboard/reminders/${item.id}`}
                className="text-sm font-medium text-primary hover:underline"
              >
                {item.title}
              </Link>
              <p className="text-xs text-muted-foreground">
                Due {formatDate(item.dueAt)} · {item.note}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={busyReminderId === item.id}
                onClick={() => void toggleReminder(item)}
              >
                {busyReminderId === item.id ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  crmReminderStatusLabel(item.status)
                )}
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant="outline">
                    Actions
                    <ChevronDown className="size-3.5" aria-hidden="true" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={() => setEditing(item)}>Edit</DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href={`/pro/dashboard/reminders/${item.id}`}>Open</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onSelect={() => setDeleteTarget(item)}
                  >
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        ))
      ) : (
        <Empty title="No reminders yet">Set a reminder to follow up on this customer.</Empty>
      )}
      <CreateReminderDialog
        open={Boolean(editing)}
        reminder={editing}
        onOpenChange={(next) => {
          if (!next) setEditing(null);
        }}
        subjectKind="customer"
        subjectId={customerId}
        onCreated={(item) => {
          dispatch(upsertCustomerReminder({ customerId, item }));
          void dispatch(fetchCustomerReminders({ customerId, force: true }));
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

function timelineTypeLabel(type: string) {
  switch (type) {
    case "customer":
    case "account":
      return "Account";
    case "request":
      return "Lead";
    case "estimate":
      return "Estimate";
    case "job":
      return "Job";
    case "invoice":
      return "Invoice";
    case "payment":
      return "Payment";
    case "note":
      return "Note";
    case "reminder":
      return "Reminder";
    case "task":
      return "Task";
    case "schedule":
      return "Schedule";
    default:
      return type ? type.charAt(0).toUpperCase() + type.slice(1) : "Event";
  }
}

function timelineTone(type: string) {
  switch (type) {
    case "customer":
    case "account":
      return historyTone("account");
    case "request":
      return historyTone("request");
    case "estimate":
      return historyTone("estimate");
    case "job":
    case "schedule":
      return historyTone("job");
    case "invoice":
      return historyTone("invoice");
    case "payment":
      return historyTone("payment");
    case "note":
      return historyTone("note");
    case "reminder":
      return historyTone("reminder");
    case "task":
      return historyTone("task");
    default:
      return "bg-[#64748b] text-white";
  }
}

function InfoRow({
  icon: Icon,
  label,
  value,
  warn,
  className,
}: {
  icon: typeof Building2;
  label: string;
  value: ReactNode;
  warn?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex items-start gap-3 border-b border-black/5 px-5 py-3 last:border-b-0", className)}>
      <Icon className="mt-0.5 size-3.5 shrink-0 text-primary/70" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">{label}</p>
        <p
          className={
            warn
              ? "text-sm font-medium text-red-700 whitespace-pre-wrap break-words"
              : "text-sm whitespace-pre-wrap break-words"
          }
        >
          {value}
        </p>
      </div>
    </div>
  );
}

function MoneyCell({
  label,
  value,
  emphasize,
}: {
  label: string;
  value: string;
  emphasize?: boolean;
}) {
  return (
    <div className="bg-card px-5 py-4">
      <p className="text-[10px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">{label}</p>
      <p className={emphasize ? "mt-1 text-xl font-semibold tabular-nums text-primary" : "mt-1 text-xl font-semibold tabular-nums"}>
        {value}
      </p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-black/10 px-3 py-2">
      <p className="text-[11px] text-muted-foreground uppercase">{label}</p>
      <p className="text-lg font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function Empty({ title, children }: { title?: string; children: string }) {
  return (
    <div className="flex min-h-[12rem] flex-col items-center justify-center gap-1.5 px-6 py-8 text-center">
      {title ? <p className="text-sm font-medium text-foreground">{title}</p> : null}
      <p className="max-w-md text-sm text-muted-foreground">{children}</p>
    </div>
  );
}

type HistoryKind = "account" | "request" | "estimate" | "job" | "invoice" | "payment" | "note" | "reminder" | "task";

type HistoryItem = {
  id: string;
  kind: HistoryKind;
  title: string;
  detail: string;
  at: string;
  href?: string;
};

function historyKindLabel(kind: HistoryKind) {
  switch (kind) {
    case "account":
      return "Account";
    case "request":
      return "Lead";
    case "estimate":
      return "Estimate";
    case "job":
      return "Job";
    case "invoice":
      return "Invoice";
    case "payment":
      return "Payment";
    case "note":
      return "Note";
    case "reminder":
      return "Reminder";
    case "task":
      return "Task";
    default: {
      const _never: never = kind;
      return _never;
    }
  }
}

function historyTone(kind: HistoryKind) {
  switch (kind) {
    case "account":
      return "bg-[#003F7D] text-white";
    case "request":
      return "bg-[#64748b] text-white";
    case "estimate":
      return "bg-[#0f766e] text-white";
    case "job":
      return "bg-[#003F7D] text-white";
    case "invoice":
      return "bg-[#047857] text-white";
    case "payment":
      return "bg-[#15803d] text-white";
    case "note":
      return "bg-[#334155] text-white";
    case "reminder":
      return "bg-[#b45309] text-white";
    case "task":
      return "bg-[#6d28d9] text-white";
    default: {
      const _never: never = kind;
      return _never;
    }
  }
}

function buildCustomerHistory({
  customer,
  requests,
  estimates,
  jobs,
  invoices,
  payments,
  reminders,
  notes,
  tasks,
}: {
  customer: PortalCustomerCrm;
  requests: PortalRequest[];
  estimates: Estimate[];
  jobs: Job[];
  invoices: Invoice[];
  payments: Payment[];
  reminders: PortalReminder[];
  notes: PortalNote[];
  tasks: PortalTask[];
}): HistoryItem[] {
  const items: HistoryItem[] = [
    {
      id: `hist_account_${customer.id}`,
      kind: "account",
      title: "Customer created",
      detail: `${crmSourceLabel(customer.source)} · ${crmTypeLabel(customer.customerType)}`,
      at: customer.createdAt,
    },
    ...requests.map((item) => ({
      id: `hist_${item.id}`,
      kind: "request" as const,
      title: item.number,
      detail: `${item.serviceName} · ${requestStatusLabel(item.status)}`,
      at: item.createdAt,
      href: `/pro/dashboard/requests/${item.id}`,
    })),
    ...estimates.map((item) => ({
      id: `hist_${item.id}`,
      kind: "estimate" as const,
      title: item.number,
      detail: `${estimateStatusLabel(item.status)} · ${formatMoney(item.total)}`,
      at: item.issuedAt,
      href: `/pro/dashboard/estimates/${item.id}`,
    })),
    ...jobs.map((item) => ({
      id: `hist_${item.id}`,
      kind: "job" as const,
      title: item.number,
      detail: `${jobStatusLabel(item.status)} · ${item.address.street}`,
      at: item.scheduledAt ?? item.createdAt,
      href: `/pro/dashboard/jobs/${item.id}`,
    })),
    ...invoices.map((item) => ({
      id: `hist_${item.id}`,
      kind: "invoice" as const,
      title: item.number,
      detail: `${invoiceStatusLabel(item.status)} · ${formatMoney(item.total)}`,
      at: item.issuedAt,
      href: `/pro/dashboard/invoices/${item.id}`,
    })),
    ...payments.map((item) => ({
      id: `hist_${item.id}`,
      kind: "payment" as const,
      title: formatMoney(item.amount),
      detail: `${item.method.toUpperCase()} · ${item.status}`,
      at: item.paidAt ?? item.createdAt,
      href: `/pro/dashboard/invoices/${item.invoiceId}`,
    })),
    ...notes.map((item) => ({
      id: `hist_${item.id}`,
      kind: "note" as const,
      title: item.title || item.body,
      detail: item.authorName,
      at: item.createdAt,
    })),
    ...reminders.map((item) => ({
      id: `hist_${item.id}`,
      kind: "reminder" as const,
      title: item.title,
      detail: `${crmReminderStatusLabel(item.status)} · ${item.note}`,
      at: item.createdAt,
      href: `/pro/dashboard/reminders/${item.id}`,
    })),
    ...tasks.map((item) => ({
      id: `hist_${item.id}`,
      kind: "task" as const,
      title: item.number,
      detail: item.title,
      at: item.createdAt,
      href: `/pro/dashboard/tasks/${item.id}`,
    })),
  ];
  return items.sort((a, b) => (a.at < b.at ? 1 : -1));
}

