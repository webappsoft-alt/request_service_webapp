"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import {
  Ban,
  Bell,
  Briefcase,
  Building2,
  CalendarDays,
  FileText,
  Globe,
  History,
  ListTodo,
  Mail,
  MapPin,
  NotebookPen,
  Phone,
  Receipt,
  Shield,
  UserRound,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { archiveRowAction, matchesArchiveFilter } from "@/components/portal/archive-control";
import { AddNoteButton, CreateReminderDialog, SetTaskButton } from "@/components/portal/create-person-dialogs";
import { NotesPanel } from "@/components/portal/notes-panel";
import { FileNotices } from "@/components/portal/task-banner";
import { CreateEstimateDialog, CreateJobDialog } from "@/components/portal/create-work-dialogs";
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
import { usePortalCrew } from "@/components/portal/use-portal-crew";
import { usePortalRecords } from "@/components/portal/use-portal-records";
import { usePortalWorkspace } from "@/components/portal/use-portal-workspace";
import { Button } from "@/components/ui/button";
import {
  crmCustomerName,
  crmReminderStatusLabel,
  crmTaskStatusLabel,
  crmSourceLabel,
  crmTypeLabel,
  noteMatches,
  reminderMatches,
  taskMatches,
  type PortalCustomerCrm,
  type PortalNote,
  type PortalReminder,
  type PortalTask,
} from "@/lib/data/crm-people";
import type { Estimate, Invoice, Job, Payment } from "@/lib/types";
import {
  ESTIMATE_STATUS_FILTERS,
  estimateStatusLabel,
  estimateStatusTone,
  getPortalCustomerName,
  INVOICE_BOARD_FILTERS,
  invoiceMatchesBoardFilter,
  invoiceStatusLabel,
  JOB_STATUS_FILTERS,
  withArchiveFilter,
  jobStatusLabel,
  requestStatusLabel,
  type PortalRequest,
} from "@/lib/data/portal";
import { formatDate, formatLocation, formatMoney } from "@/lib/format";

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
  const { estimates, jobs, invoices, payments, requests, provider } = usePortalWorkspace();
  const { customers, reminders, employees, tasks, notes, setReminderStatus } = useCrmDirectory();
  const { events, employeeLabel } = usePortalCrew();
  const records = usePortalRecords();
  const [reminderOpen, setReminderOpen] = useState(false);
  const [createEstimateOpen, setCreateEstimateOpen] = useState(false);
  const [createJobOpen, setCreateJobOpen] = useState(false);
  const [paying, setPaying] = useState<Invoice | null>(null);
  const [estimateFilter, setEstimateFilter] = useState("");
  const [jobFilter, setJobFilter] = useState("");
  const [invoiceFilter, setInvoiceFilter] = useState("");
  const customer = customers.find((item) => item.id === id);

  if (!customer) {
    return (
      <div className="border border-black/15 bg-card p-6">
        <h1 className="text-lg font-semibold">Customer not found</h1>
        <Button asChild className="mt-4" size="sm">
          <Link href="/pro/dashboard/customers">Back to customers</Link>
        </Button>
      </div>
    );
  }

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

  return (
    <>
      <RecordWorkspace
        href={`/pro/dashboard/customers/${customer.id}`}
        label={`${customer.entityKind === "company" ? "Customer" : "Customer"} #${customer.customerNumber}`}
        kind="customer"
        tabs={TABS}
        badge={
          customer.amountOwing > 0 ? (
            <span className="rounded-sm bg-[#f4e4c4] px-2 py-1 text-[11px] font-semibold tracking-wide text-[#7a4a00] uppercase">
              Balance owing {formatMoney(customer.amountOwing)}
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
            <Button size="sm" onClick={() => toast.success("Customer file saved on this board.")}>
              Save
            </Button>
            <SetTaskButton subjectKind="customer" subjectId={customer.id} />
            <AddNoteButton subjectKind="customer" subjectId={customer.id} />
            <Button size="sm" onClick={() => setReminderOpen(true)}>
              Set reminder
            </Button>
          </>
        }
        notice={<FileNotices kind="customer" id={customer.id} />}
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
                        photoKey={customer.firstName}
                      />
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="text-lg font-semibold tracking-tight">{name}</h2>
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
                      <InfoRow icon={Shield} label="EIN" value={customer.ein ?? "—"} />
                      <InfoRow
                        icon={Globe}
                        label="Website"
                        value={
                          customer.website ? (
                            <a href={customer.website} className="text-primary hover:underline">
                              {customer.website.replace(/^https?:\/\//, "")}
                            </a>
                          ) : (
                            "—"
                          )
                        }
                      />
                      <InfoRow
                        icon={Mail}
                        label="Email"
                        value={<span className="text-primary">{customer.email}</span>}
                      />
                      <InfoRow icon={Phone} label="Phone" value={customer.phone ?? "—"} />
                      <InfoRow icon={Phone} label="Alt. phone" value={customer.altPhone ?? "—"} />
                      <InfoRow
                        icon={Ban}
                        label="Do not call"
                        value={customer.doNotCall ? "Yes" : "No"}
                        warn={customer.doNotCall}
                      />
                      <InfoRow icon={Phone} label="Fax" value={customer.fax ?? "—"} />
                      <InfoRow
                        icon={MapPin}
                        label="Street"
                        value={
                          address
                            ? `${address.street}, ${formatLocation(address.city, address.state, address.zip)}`
                            : "—"
                        }
                      />
                      <InfoRow icon={CalendarDays} label="Date created" value={formatDate(customer.createdAt)} />
                    </div>
                  </section>

                  <div className="grid gap-4">
                    <section className="overflow-hidden rounded-lg border border-black/10 bg-card shadow-[0_10px_28px_rgba(4,26,54,0.07)]">
                      <header className="flex items-center gap-2 border-b border-black/10 bg-[#f7f8fa] px-5 py-3">
                        <Wallet className="size-4 text-primary" aria-hidden="true" />
                        <h3 className="text-sm font-semibold">Account</h3>
                      </header>
                      <div className="grid grid-cols-2 gap-px bg-black/5">
                        <MoneyCell
                          label="Amount owing"
                          value={formatMoney(customer.amountOwing)}
                          emphasize={customer.amountOwing > 0}
                        />
                        <MoneyCell label="Credit limit" value={formatMoney(customer.creditLimit)} />
                      </div>
                      <div className="grid sm:grid-cols-2">
                        <InfoRow icon={Receipt} label="Tax code" value={customer.taxCode} />
                        <InfoRow icon={Receipt} label="Labor tax" value={customer.laborTaxCode} />
                        <InfoRow icon={Ban} label="On stop" value={customer.onStop ? "Yes" : "No"} warn={customer.onStop} />
                      </div>
                    </section>

                    <section className="overflow-hidden rounded-lg border border-black/10 bg-card shadow-[0_10px_28px_rgba(4,26,54,0.07)]">
                      <header className="flex items-center gap-2 border-b border-black/10 bg-[#f7f8fa] px-5 py-3">
                        <UserRound className="size-4 text-primary" aria-hidden="true" />
                        <h3 className="text-sm font-semibold">Preferred technician</h3>
                      </header>
                      <div className="px-5 py-4">
                        {assigned ? (
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
                        ) : (
                          <p className="text-sm text-muted-foreground">No preferred technician on file.</p>
                        )}
                      </div>
                    </section>
                  </div>
                </div>
                {address ? <CustomerLocationMapLazy provider={provider} address={address} name={name} /> : null}
                </div>
              );
            case "estimates":
              return (
                <div>
                  <div className="mb-3 flex justify-end">
                    <Button size="sm" onClick={() => setCreateEstimateOpen(true)}>
                      Create estimate
                    </Button>
                  </div>
                  <LocalFilterTabs
                    value={estimateFilter}
                    onChange={setEstimateFilter}
                    options={withArchiveFilter(ESTIMATE_STATUS_FILTERS)}
                  />
                  <PortalDataTable
                    filename={`${customer.customerNumber}-estimates`}
                    countLabel="Estimates"
                    searchPlaceholder="Search estimates"
                    empty="No estimates match this filter."
                    rows={relatedEstimates.filter((item) => matchesArchiveFilter(records, "estimate", item, estimateFilter))}
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
                        cell: (row) => <StatusPill label={estimateStatusLabel(row.status)} className={estimateStatusTone(row.status)} />,
                      },
                    ]}
                    actions={(row) => [
                      { label: "Open", href: `/pro/dashboard/estimates/${row.id}` },
                      { label: "Convert to job", href: `/pro/dashboard/estimates/${row.id}` },
                      archiveRowAction(records, "estimate", row.id, row.number),
                    ]}
                  />
                </div>
              );
            case "jobs":
              return (
                <div>
                  <div className="mb-3 flex justify-end">
                    <Button size="sm" onClick={() => setCreateJobOpen(true)}>
                      Create job
                    </Button>
                  </div>
                  <LocalFilterTabs
                    value={jobFilter}
                    onChange={setJobFilter}
                    options={withArchiveFilter(JOB_STATUS_FILTERS)}
                  />
                  <PortalDataTable
                    filename={`${customer.customerNumber}-jobs`}
                    countLabel="Jobs"
                    searchPlaceholder="Search jobs"
                    empty="No jobs match this filter."
                    rows={relatedJobs.filter((item) => matchesArchiveFilter(records, "job", item, jobFilter))}
                    rowKey={(row) => row.id}
                    rowHref={(row) => `/pro/dashboard/jobs/${row.id}`}
                    columns={jobBoardColumns({
                      estimates: records.mergeEstimates(estimates),
                      requests,
                      invoices: relatedInvoices,
                      events,
                      employeeLabel,
                      customerName: (customerId) => {
                        const match = customers.find((item) => item.id === customerId);
                        return match ? crmCustomerName(match) : getPortalCustomerName(provider, customerId);
                      },
                    })}
                    actions={(row) => [
                      { label: "Open", href: `/pro/dashboard/jobs/${row.id}` },
                      { label: "Convert to invoice", href: `/pro/dashboard/jobs/${row.id}` },
                      { label: "Calendar", href: "/pro/dashboard/schedule" },
                      archiveRowAction(records, "job", row.id, row.number),
                    ]}
                  />
                </div>
              );
            case "schedule":
              return <CustomerEventCalendar events={relatedEvents} employeeLabel={employeeLabel} />;
            case "invoices":
              return (
                <div>
                  <LocalFilterTabs
                    value={invoiceFilter}
                    onChange={setInvoiceFilter}
                    options={withArchiveFilter(INVOICE_BOARD_FILTERS)}
                  />
                  <PortalDataTable
                    filename={`${customer.customerNumber}-invoices`}
                    countLabel="Invoices"
                    searchPlaceholder="Search by invoice # or job #"
                    empty="No invoices match this filter."
                    rows={relatedInvoices.filter((item) => {
                      const archived = records.isArchived("invoice", item.id);
                      if (invoiceFilter === "archived") return archived;
                      return !archived && invoiceMatchesBoardFilter(item, invoiceFilter);
                    })}
                    rowKey={(row) => row.id}
                    rowHref={(row) => `/pro/dashboard/invoices/${row.id}`}
                    columns={invoiceBoardColumns({
                      jobs: relatedJobs,
                      estimates: relatedEstimates,
                      requests: relatedRequests,
                      hideCustomer: true,
                      customerName: (customerId) => {
                        const match = customers.find((item) => item.id === customerId);
                        return match ? crmCustomerName(match) : getPortalCustomerName(provider, customerId);
                      },
                    })}
                    actions={(row) => [
                      { label: "Open", href: `/pro/dashboard/invoices/${row.id}` },
                      ...(row.balanceDue > 0
                        ? [
                            {
                              label: "Apply payment",
                              onSelect: () => setPaying(row),
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
                      if (!open) setPaying(null);
                    }}
                    invoice={paying}
                  />
                </div>
              );
            case "history":
              return (
                <div className="space-y-4">
                  <div className="grid gap-3 text-sm sm:grid-cols-4">
                    <Stat label="Estimates" value={String(relatedEstimates.length)} />
                    <Stat label="Jobs" value={String(relatedJobs.length)} />
                    <Stat label="Invoices" value={String(relatedInvoices.length)} />
                    <Stat label="Paid" value={formatMoney(relatedPayments.reduce((sum, item) => sum + item.amount, 0))} />
                  </div>
                  <div className="border border-black/15 bg-card">
                    <div className="border-b border-black/10 px-4 py-3">
                      <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Activity</p>
                      <p className="text-sm text-muted-foreground">
                        {history.length} events since {formatDate(customer.createdAt)} · {crmSourceLabel(customer.source)}
                      </p>
                    </div>
                    <ol className="divide-y divide-black/10">
                      {history.map((item) => (
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
                      ))}
                    </ol>
                  </div>
                </div>
              );
            case "notes":
              return <NotesPanel kind="customer" id={customer.id} empty="Add the first note on this customer." />;
            case "tasks":
              return (
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm text-muted-foreground">
                      {relatedTasks.length ? `${relatedTasks.length} tasks on this customer` : "No tasks yet"}
                    </p>
                    <SetTaskButton subjectKind="customer" subjectId={customer.id} />
                  </div>
                  {relatedTasks.length ? (
                    relatedTasks.map((item) => (
                      <div key={item.id} className="flex items-center justify-between gap-3 border border-black/10 px-3 py-2.5">
                        <div>
                          <Link href={`/pro/dashboard/tasks/${item.id}`} className="text-sm font-medium text-primary hover:underline">
                            {item.number} · {item.title}
                          </Link>
                          <p className="text-xs text-muted-foreground">
                            Due {formatDate(item.dueAt)} · {item.note}
                          </p>
                        </div>
                        <StatusPill label={crmTaskStatusLabel(item.status)} />
                      </div>
                    ))
                  ) : (
                    <Empty>Create a task against this customer — permit, follow-up, or paperwork.</Empty>
                  )}
                </div>
              );
            case "reminders":
              return (
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm text-muted-foreground">
                      {relatedReminders.length ? `${relatedReminders.length} reminders` : "No reminders yet"}
                    </p>
                    <Button size="sm" onClick={() => setReminderOpen(true)}>
                      Set reminder
                    </Button>
                  </div>
                  {relatedReminders.length ? (
                    relatedReminders.map((item) => (
                      <div key={item.id} className="flex items-center justify-between gap-3 border border-black/10 px-3 py-2.5">
                        <div>
                          <p className="text-sm font-medium">{item.title}</p>
                          <p className="text-xs text-muted-foreground">
                            Due {formatDate(item.dueAt)} · {item.note}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setReminderStatus(item.id, item.status === "open" ? "done" : "open")}
                        >
                          {crmReminderStatusLabel(item.status)}
                        </Button>
                      </div>
                    ))
                  ) : (
                    <Empty>Set a reminder to follow up on this customer.</Empty>
                  )}
                </div>
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
      />
      <CreateEstimateDialog open={createEstimateOpen} onOpenChange={setCreateEstimateOpen} customerId={customer.id} />
      <CreateJobDialog open={createJobOpen} onOpenChange={setCreateJobOpen} customerId={customer.id} />
    </>
  );
}

function InfoRow({
  icon: Icon,
  label,
  value,
  warn,
}: {
  icon: typeof Building2;
  label: string;
  value: ReactNode;
  warn?: boolean;
}) {
  return (
    <div className="flex items-start gap-3 border-b border-black/5 px-5 py-3 last:border-b-0">
      <Icon className="mt-0.5 size-3.5 shrink-0 text-primary/70" aria-hidden="true" />
      <div className="min-w-0">
        <p className="text-[10px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">{label}</p>
        <p className={warn ? "text-sm font-medium text-red-700" : "text-sm"}>{value}</p>
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

function Empty({ children }: { children: string }) {
  return <p className="text-sm text-muted-foreground">{children}</p>;
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

