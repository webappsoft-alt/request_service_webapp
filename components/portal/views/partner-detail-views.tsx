"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import {
  Banknote,
  Boxes,
  Briefcase,
  CalendarDays,
  Clock,
  FileText,
  NotebookPen,
  Package,
  Paperclip,
  Settings,
  Shield,
  Trash2,
  Wallet,
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
import {
  defaultVendorInventory,
  inventoryNeedsReorder,
  useEmployeeFile,
  type PartnerOrder,
  type VendorInventoryItem,
} from "@/components/portal/use-employee-file";
import { usePortalCrew } from "@/components/portal/use-portal-crew";
import { usePortalRecords } from "@/components/portal/use-portal-records";
import { usePortalWorkspace } from "@/components/portal/use-portal-workspace";
import {
  EmployeeAttachmentsTab,
  EmployeeAvailabilityTab,
  EmployeePayTab,
} from "@/components/portal/views/employee-detail-view";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import {
  contractorAsEmployee,
  crmCustomerName,
  crmStatusLabel,
  vendorAsEmployee,
  type CrmDirectoryStatus,
  type PortalContractor,
  type PortalVendor,
} from "@/lib/data/crm-people";
import {
  calendarEventKindLabel,
  estimateStatusLabel,
  estimateStatusTone,
  formatClock,
  getPortalCustomerName,
  jobServiceLabel,
  timeWindowLabel,
  windowFromMinutes,
  type PortalCalendarEvent,
} from "@/lib/data/portal";
import { formatDate, formatMoney } from "@/lib/format";
import type { Estimate, Job, Provider } from "@/lib/types";
import { cn } from "@/lib/utils";

const DIRECTORY_STATUSES: CrmDirectoryStatus[] = ["active", "inactive", "on_stop"];
const ORDER_STATUSES: PartnerOrder["status"][] = ["open", "received", "billed"];

function orderStatusLabel(status: PartnerOrder["status"]) {
  switch (status) {
    case "open":
      return "Open";
    case "received":
      return "Received";
    case "billed":
      return "Billed";
    default: {
      const _never: never = status;
      return _never;
    }
  }
}

function matchesKeyword(value: string, keyword: string) {
  return value.toLowerCase().includes(keyword.toLowerCase());
}

function tradeTokens(value: string) {
  return value
    .toLowerCase()
    .split(/[/,·\s]+/)
    .filter((token) => token.length > 2);
}

export function ContractorDetailView({ id }: { id: string }) {
  const { estimates, jobs, invoices, requests, provider } = usePortalWorkspace();
  const { contractors, customers, remove, updateContractor } = useCrmDirectory();
  const { employees, events, assign, employeeLabel } = usePortalCrew();
  const records = usePortalRecords();
  const contractor = contractors.find((item) => item.id === id);
  const [editing, setEditing] = useState<PortalCalendarEvent | null>(null);
  const [assignOpen, setAssignOpen] = useState(false);

  if (!contractor) {
    return (
      <div className="border border-black/15 bg-card p-6">
        <h1 className="text-lg font-semibold">Contractor not found</h1>
        <Button asChild className="mt-4" size="sm">
          <Link href="/pro/dashboard/contractors">Back to contractors</Link>
        </Button>
      </div>
    );
  }

  const asEmployee = contractorAsEmployee(contractor);
  const assigned = events
    .filter((item) => item.employeeId === contractor.id)
    .sort((a, b) => (a.date ?? "9999").localeCompare(b.date ?? "9999"));
  const allJobs = records.mergeJobs(jobs);
  const allEstimates = records.mergeEstimates(estimates);
  const jobIds = new Set(assigned.filter((item) => item.kind === "job").map((item) => item.recordId));
  const estimateIds = new Set(assigned.filter((item) => item.kind === "estimate").map((item) => item.recordId));
  const tokens = tradeTokens(contractor.trade);
  const relatedJobs = allJobs.filter((item) => {
    if (jobIds.has(item.id) || item.assignedTo === contractor.companyName) return true;
    const label = jobServiceLabel(item, allEstimates, requests);
    return tokens.some((token) => matchesKeyword(label, token) || item.items.some((line) => matchesKeyword(line.description, token)));
  });
  const relatedEstimates = allEstimates.filter((item) => {
    if (estimateIds.has(item.id)) return true;
    const label = item.items[0]?.description ?? "";
    return tokens.some((token) => matchesKeyword(label, token));
  });
  const expired = contractor.insuranceExpires && contractor.insuranceExpires < new Date().toISOString().slice(0, 10);
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
            <StatusPill label={crmStatusLabel(contractor.status)} tone={contractor.status === "active" ? "success" : "neutral"} />
            {expired ? <StatusPill label="Insurance expired" className="bg-red-50 text-red-800" /> : null}
          </>
        }
        notice={<FileNotices kind="contractor" id={contractor.id} />}
        actions={
          <>
            <SetTaskButton subjectKind="contractor" subjectId={contractor.id} />
            <SetReminderButton subjectKind="contractor" subjectId={contractor.id} />
            <AddNoteButton subjectKind="contractor" subjectId={contractor.id} />
            <Button size="sm" onClick={() => setAssignOpen(true)}>
              Assign job
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                remove("contractor", contractor.id);
                toast.success(`${contractor.companyName} removed.`);
              }}
            >
              Remove
            </Button>
          </>
        }
      >
        {(tab) => {
          switch (tab) {
            case "settings":
              return <ContractorSettingsTab contractor={contractor} onSave={updateContractor} />;
            case "compliance":
              return <ContractorComplianceTab contractor={contractor} onSave={updateContractor} />;
            case "pay":
              return (
                <EmployeePayTab
                  employee={asEmployee}
                  onSave={(_, pay) => updateContractor(contractor.id, { hourlyRate: pay.hourlyRate })}
                />
              );
            case "availability":
              return <EmployeeAvailabilityTab employee={asEmployee} />;
            case "schedule":
              return (
                <ContractorScheduleTab
                  contractor={contractor}
                  assigned={assigned}
                  onOpen={setEditing}
                  onMove={moveEvent}
                  employeeLabel={employeeLabel}
                />
              );
            case "jobs":
              return (
                <PortalDataTable
                  filename={`${contractor.companyName}-jobs`}
                  countLabel="Jobs"
                  searchPlaceholder="Search jobs"
                  empty="No jobs for this contractor yet. Assign one from their schedule."
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
                  filename={`${contractor.companyName}-estimates`}
                  countLabel="Estimates"
                  searchPlaceholder="Search estimates"
                  empty="No estimate visits for this trade yet."
                  rows={relatedEstimates}
                  rowKey={(row) => row.id}
                  rowHref={(row) => `/pro/dashboard/estimates/${row.id}`}
                  columns={estimateColumns(provider)}
                />
              );
            case "notes":
              return <NotesPanel kind="contractor" id={contractor.id} />;
            case "attachments":
              return <EmployeeAttachmentsTab employee={asEmployee} />;
            default:
              return <ContractorSettingsTab contractor={contractor} onSave={updateContractor} />;
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
        onSave={(assignment) => {
          assign({ ...assignment, employeeId: assignment.employeeId || contractor.id });
          toast.success("Work assigned.");
        }}
      />
    </>
  );
}

export function VendorDetailView({ id }: { id: string }) {
  const { estimates, jobs, invoices, requests, provider } = usePortalWorkspace();
  const { vendors, customers, remove, updateVendor } = useCrmDirectory();
  const { events, employeeLabel } = usePortalCrew();
  const records = usePortalRecords();
  const vendor = vendors.find((item) => item.id === id);

  if (!vendor) {
    return (
      <div className="border border-black/15 bg-card p-6">
        <h1 className="text-lg font-semibold">Vendor not found</h1>
        <Button asChild className="mt-4" size="sm">
          <Link href="/pro/dashboard/vendors">Back to vendors</Link>
        </Button>
      </div>
    );
  }

  const asEmployee = vendorAsEmployee(vendor);
  const allJobs = records.mergeJobs(jobs);
  const allEstimates = records.mergeEstimates(estimates);
  const tokens = tradeTokens(vendor.category);
  const relatedJobs = allJobs.filter((item) => {
    const label = jobServiceLabel(item, allEstimates, requests);
    return tokens.some(
      (token) => matchesKeyword(label, token) || item.items.some((line) => matchesKeyword(line.description, token)),
    );
  });

  return (
    <RecordWorkspace
      href={`/pro/dashboard/vendors/${vendor.id}`}
      label={`${vendor.name} · ${vendor.number}`}
      kind="vendor"
      tabs={[
        { id: "settings", label: "Settings", icon: Settings },
        { id: "account", label: "Account", icon: Wallet },
        { id: "inventory", label: "Inventory", icon: Boxes },
        { id: "orders", label: "Orders", icon: Package },
        { id: "jobs", label: "Jobs", icon: Briefcase },
        { id: "notes", label: "Notes", icon: NotebookPen },
        { id: "attachments", label: "Attachments", icon: Paperclip },
      ]}
      badge={
        <>
          <StatusPill label={vendor.category} />
          <StatusPill label={crmStatusLabel(vendor.status)} tone={vendor.status === "active" ? "success" : "neutral"} />
          {vendor.balance > 0 ? <StatusPill label={`${formatMoney(vendor.balance)} due`} className="bg-amber-50 text-amber-900" /> : null}
        </>
      }
      notice={<FileNotices kind="vendor" id={vendor.id} extra={<VendorStockBanner vendor={vendor} />} />}
      actions={
        <>
          <SetTaskButton subjectKind="vendor" subjectId={vendor.id} />
          <SetReminderButton subjectKind="vendor" subjectId={vendor.id} />
          <AddNoteButton subjectKind="vendor" subjectId={vendor.id} />
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              remove("vendor", vendor.id);
              toast.success(`${vendor.name} removed.`);
            }}
          >
            Remove
          </Button>
        </>
      }
    >
      {(tab) => {
        switch (tab) {
          case "settings":
            return <VendorSettingsTab vendor={vendor} onSave={updateVendor} />;
          case "account":
            return <VendorAccountTab vendor={vendor} onSave={updateVendor} />;
          case "inventory":
            return <VendorInventoryTab vendor={vendor} />;
          case "orders":
            return <VendorOrdersTab vendor={vendor} jobs={relatedJobs} />;
          case "jobs":
            return (
              <PortalDataTable
                filename={`${vendor.name}-jobs`}
                countLabel="Jobs"
                searchPlaceholder="Search jobs"
                empty="No jobs matching this vendor’s category yet."
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
          case "notes":
            return <NotesPanel kind="vendor" id={vendor.id} />;
          case "attachments":
            return <EmployeeAttachmentsTab employee={asEmployee} />;
          default:
            return <VendorSettingsTab vendor={vendor} onSave={updateVendor} />;
        }
      }}
    </RecordWorkspace>
  );
}

function ContractorSettingsTab({
  contractor,
  onSave,
}: {
  contractor: PortalContractor;
  onSave: (id: string, patch: Partial<PortalContractor>) => void;
}) {
  const [draft, setDraft] = useState(contractor);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold">Contractor settings</h2>
          <p className="mt-1 text-sm text-muted-foreground">Outside crew you send to a job. Contact and company live here.</p>
        </div>
        <Button
          size="sm"
          onClick={() => {
            onSave(contractor.id, draft);
            toast.success("Contractor settings saved.");
          }}
        >
          Save settings
        </Button>
      </div>
      <div className="grid gap-3 rounded-[4px] border border-black/10 bg-card p-4 sm:grid-cols-2">
        <Field label="Company">
          <Input value={draft.companyName} onChange={(event) => setDraft({ ...draft, companyName: event.target.value })} />
        </Field>
        <Field label="Trade">
          <Input value={draft.trade} onChange={(event) => setDraft({ ...draft, trade: event.target.value })} />
        </Field>
        <Field label="First name">
          <Input value={draft.firstName} onChange={(event) => setDraft({ ...draft, firstName: event.target.value })} />
        </Field>
        <Field label="Last name">
          <Input value={draft.lastName} onChange={(event) => setDraft({ ...draft, lastName: event.target.value })} />
        </Field>
        <Field label="Email">
          <Input value={draft.email} onChange={(event) => setDraft({ ...draft, email: event.target.value })} />
        </Field>
        <Field label="Phone">
          <Input value={draft.phone} onChange={(event) => setDraft({ ...draft, phone: event.target.value })} />
        </Field>
        <Field label="City">
          <Input value={draft.city} onChange={(event) => setDraft({ ...draft, city: event.target.value })} />
        </Field>
        <Field label="State">
          <Input value={draft.state} onChange={(event) => setDraft({ ...draft, state: event.target.value })} />
        </Field>
        <Field label="ZIP">
          <Input value={draft.zip} onChange={(event) => setDraft({ ...draft, zip: event.target.value })} />
        </Field>
        <Field label="Status">
          <NativeSelect
            className="w-full"
            value={draft.status}
            onChange={(event) => setDraft({ ...draft, status: event.target.value as CrmDirectoryStatus })}
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
  onSave: (id: string, patch: Partial<PortalContractor>) => void;
}) {
  const [draft, setDraft] = useState({
    license: contractor.license,
    insuranceExpires: contractor.insuranceExpires,
    hourlyRate: contractor.hourlyRate,
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold">Compliance</h2>
          <p className="mt-1 text-sm text-muted-foreground">License and insurance required before they go on a customer site.</p>
        </div>
        <Button
          size="sm"
          onClick={() => {
            onSave(contractor.id, draft);
            toast.success("Compliance saved.");
          }}
        >
          Save compliance
        </Button>
      </div>
      <div className="grid gap-3 rounded-[4px] border border-black/10 bg-card p-4 sm:grid-cols-2">
        <Field label="License">
          <Input value={draft.license} onChange={(event) => setDraft({ ...draft, license: event.target.value })} />
        </Field>
        <Field label="Insurance expires">
          <Input
            type="date"
            value={draft.insuranceExpires}
            onChange={(event) => setDraft({ ...draft, insuranceExpires: event.target.value })}
          />
        </Field>
        <Field label="Quoted hourly rate">
          <Input
            type="number"
            min="0"
            value={draft.hourlyRate || ""}
            placeholder="0"
            onChange={(event) => setDraft({ ...draft, hourlyRate: Number(event.target.value) || 0 })}
          />
        </Field>
      </div>
    </div>
  );
}

function ContractorScheduleTab({
  contractor,
  assigned,
  onOpen,
  onMove,
  employeeLabel,
}: {
  contractor: PortalContractor;
  assigned: PortalCalendarEvent[];
  onOpen: (event: PortalCalendarEvent) => void;
  onMove: (event: PortalCalendarEvent, move: CalendarMove) => void;
  employeeLabel: (id?: string) => string;
}) {
  return (
    <div className="space-y-4">
      <EventCalendar
        events={assigned}
        employees={[contractorAsEmployee(contractor)]}
        employeeLabel={employeeLabel}
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

function VendorSettingsTab({
  vendor,
  onSave,
}: {
  vendor: PortalVendor;
  onSave: (id: string, patch: Partial<PortalVendor>) => void;
}) {
  const [draft, setDraft] = useState(vendor);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold">Vendor settings</h2>
          <p className="mt-1 text-sm text-muted-foreground">Supply house contact and category used when buying materials.</p>
        </div>
        <Button
          size="sm"
          onClick={() => {
            onSave(vendor.id, draft);
            toast.success("Vendor settings saved.");
          }}
        >
          Save settings
        </Button>
      </div>
      <div className="grid gap-3 rounded-[4px] border border-black/10 bg-card p-4 sm:grid-cols-2">
        <Field label="Vendor name">
          <Input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} />
        </Field>
        <Field label="Category">
          <Input value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value })} />
        </Field>
        <Field label="Contact">
          <Input value={draft.contact} onChange={(event) => setDraft({ ...draft, contact: event.target.value })} />
        </Field>
        <Field label="Status">
          <NativeSelect
            className="w-full"
            value={draft.status}
            onChange={(event) => setDraft({ ...draft, status: event.target.value as CrmDirectoryStatus })}
          >
            {DIRECTORY_STATUSES.map((status) => (
              <NativeSelectOption key={status} value={status}>
                {crmStatusLabel(status)}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Email">
          <Input value={draft.email} onChange={(event) => setDraft({ ...draft, email: event.target.value })} />
        </Field>
        <Field label="Phone">
          <Input value={draft.phone} onChange={(event) => setDraft({ ...draft, phone: event.target.value })} />
        </Field>
        <Field label="City">
          <Input value={draft.city} onChange={(event) => setDraft({ ...draft, city: event.target.value })} />
        </Field>
        <Field label="State">
          <Input value={draft.state} onChange={(event) => setDraft({ ...draft, state: event.target.value })} />
        </Field>
      </div>
    </div>
  );
}

function VendorAccountTab({
  vendor,
  onSave,
}: {
  vendor: PortalVendor;
  onSave: (id: string, patch: Partial<PortalVendor>) => void;
}) {
  const [draft, setDraft] = useState({
    accountNumber: vendor.accountNumber,
    terms: vendor.terms,
    balance: vendor.balance,
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold">Account</h2>
          <p className="mt-1 text-sm text-muted-foreground">House account, payment terms, and current balance.</p>
        </div>
        <Button
          size="sm"
          onClick={() => {
            onSave(vendor.id, draft);
            toast.success("Account saved.");
          }}
        >
          Save account
        </Button>
      </div>
      <div className="grid gap-3 rounded-[4px] border border-black/10 bg-card p-4 sm:grid-cols-3">
        <Field label="Account #">
          <Input value={draft.accountNumber} onChange={(event) => setDraft({ ...draft, accountNumber: event.target.value })} />
        </Field>
        <Field label="Terms">
          <Input value={draft.terms} onChange={(event) => setDraft({ ...draft, terms: event.target.value })} />
        </Field>
        <Field label="Balance">
          <Input
            type="number"
            min="0"
            value={draft.balance || ""}
            placeholder="0"
            onChange={(event) => setDraft({ ...draft, balance: Number(event.target.value) || 0 })}
          />
        </Field>
      </div>
    </div>
  );
}

function VendorStockBanner({ vendor }: { vendor: PortalVendor }) {
  const file = useEmployeeFile(vendorAsEmployee(vendor));
  const items = file.inventory.length ? file.inventory : defaultVendorInventory(vendor.category);
  const low = items.filter(inventoryNeedsReorder);
  if (!low.length) return null;
  return (
    <div className="rounded-[4px] border border-amber-300 bg-amber-50 px-4 py-3 text-amber-950">
      <p className="text-sm font-semibold">
        {low.length} inventor{low.length === 1 ? "y item" : "y items"} at or below reorder
      </p>
      <p className="mt-1 text-sm">
        {low.map((item) => `${item.name} (${item.onHand} ${item.unit})`).join(" · ")}
      </p>
    </div>
  );
}

function VendorInventoryTab({ vendor }: { vendor: PortalVendor }) {
  const file = useEmployeeFile(vendorAsEmployee(vendor));
  const [sku, setSku] = useState("");
  const [name, setName] = useState("");
  const [unit, setUnit] = useState("ea");
  const [onHand, setOnHand] = useState("");
  const [reorderAt, setReorderAt] = useState("");
  const [unitCost, setUnitCost] = useState("");
  const [location, setLocation] = useState("");
  const items = file.inventory.length ? file.inventory : defaultVendorInventory(vendor.category);

  function persist(next: VendorInventoryItem[]) {
    file.replaceInventory(next);
  }
  const stockValue = items.reduce((sum, item) => sum + item.onHand * item.unitCost, 0);
  const reorderCount = items.filter(inventoryNeedsReorder).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Inventory from {vendor.name}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            SKUs this vendor stocks for the shop. Reorder warnings show on the file until you receive stock.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <StatusPill label={`${items.length} SKUs`} />
          <StatusPill label={`${formatMoney(stockValue)} on hand`} />
          {reorderCount ? <StatusPill label={`${reorderCount} to reorder`} className="bg-amber-50 text-amber-900" /> : null}
        </div>
      </div>
      <div className="grid gap-3 rounded-[4px] border border-black/10 bg-card p-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="SKU">
          <Input value={sku} placeholder="WH-50G" onChange={(event) => setSku(event.target.value)} />
        </Field>
        <Field label="Item">
          <Input value={name} placeholder="50-gal water heater" onChange={(event) => setName(event.target.value)} />
        </Field>
        <Field label="Unit">
          <Input value={unit} placeholder="ea" onChange={(event) => setUnit(event.target.value)} />
        </Field>
        <Field label="On hand">
          <Input type="number" min="0" value={onHand} placeholder="0" onChange={(event) => setOnHand(event.target.value)} />
        </Field>
        <Field label="Reorder at">
          <Input type="number" min="0" value={reorderAt} placeholder="2" onChange={(event) => setReorderAt(event.target.value)} />
        </Field>
        <Field label="Unit cost">
          <Input type="number" min="0" value={unitCost} placeholder="0" onChange={(event) => setUnitCost(event.target.value)} />
        </Field>
        <Field label="Location" className="sm:col-span-2 lg:col-span-2">
          <Input value={location} placeholder="Aisle 3" onChange={(event) => setLocation(event.target.value)} />
        </Field>
        <Button
          size="sm"
          className="justify-self-start self-end"
          disabled={!sku.trim() && !name.trim()}
          onClick={() => {
            const item: VendorInventoryItem = {
              id: `inv_${Date.now()}`,
              sku: sku.trim() || `SKU-${items.length + 1}`,
              name: name.trim() || "Stock item",
              unit: unit.trim() || "ea",
              onHand: Number(onHand) || 0,
              reorderAt: Number(reorderAt) || 0,
              unitCost: Number(unitCost) || 0,
              location: location.trim(),
            };
            persist([item, ...items.filter((row) => row.id !== item.id)]);
            setSku("");
            setName("");
            setOnHand("");
            setReorderAt("");
            setUnitCost("");
            setLocation("");
            toast.success(`${item.name} added to inventory.`);
          }}
        >
          Add SKU
        </Button>
      </div>
      {items.length ? (
        <div className="overflow-x-auto rounded-[4px] border border-black/10">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-[#eef1f5] text-[11px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">
              <tr>
                <th className="px-3 py-2">SKU</th>
                <th className="px-3 py-2">Item</th>
                <th className="px-3 py-2">On hand</th>
                <th className="px-3 py-2">Reorder</th>
                <th className="px-3 py-2">Cost</th>
                <th className="px-3 py-2">Value</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-black/10">
              {items.map((item) => {
                const low = inventoryNeedsReorder(item);
                return (
                  <tr key={item.id} className={low ? "bg-amber-50/70" : undefined}>
                    <td className="px-3 py-2 font-medium">{item.sku}</td>
                    <td className="px-3 py-2">
                      <p className="font-medium">{item.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.unit}
                        {item.location ? ` · ${item.location}` : ""}
                      </p>
                    </td>
                    <td className="px-3 py-2 tabular-nums">{item.onHand}</td>
                    <td className="px-3 py-2 tabular-nums">{item.reorderAt}</td>
                    <td className="px-3 py-2 tabular-nums">{formatMoney(item.unitCost)}</td>
                    <td className="px-3 py-2 tabular-nums">{formatMoney(item.onHand * item.unitCost)}</td>
                    <td className="px-3 py-2">
                      <StatusPill
                        label={low ? "Reorder" : "In stock"}
                        tone={low ? "warning" : "success"}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            persist(items.map((row) => (row.id === item.id ? { ...row, onHand: row.onHand + 1 } : row)));
                            toast.success(`Received 1 ${item.unit} of ${item.name}.`);
                          }}
                        >
                          + Receive
                        </Button>
                        <button
                          type="button"
                          className="text-destructive"
                          aria-label={`Delete ${item.name}`}
                          onClick={() => persist(items.filter((row) => row.id !== item.id))}
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No inventory SKUs yet for this vendor.</p>
      )}
    </div>
  );
}

function VendorOrdersTab({ vendor, jobs }: { vendor: PortalVendor; jobs: Job[] }) {
  const file = useEmployeeFile(vendorAsEmployee(vendor));
  const [number, setNumber] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [jobId, setJobId] = useState("");

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold">Purchase orders</h2>
        <p className="mt-1 text-sm text-muted-foreground">Materials ordered from this vendor, optionally against a job.</p>
      </div>
      <div className="grid gap-3 rounded-[4px] border border-black/10 bg-card p-4 sm:grid-cols-2">
        <Field label="PO number">
          <Input value={number} placeholder="PO-1042" onChange={(event) => setNumber(event.target.value)} />
        </Field>
        <Field label="Amount">
          <Input type="number" min="0" value={amount} placeholder="0" onChange={(event) => setAmount(event.target.value)} />
        </Field>
        <Field label="What was ordered" className="sm:col-span-2">
          <Input value={description} placeholder="50-gal heater, fittings…" onChange={(event) => setDescription(event.target.value)} />
        </Field>
        <Field label="Job (optional)" className="sm:col-span-2">
          <NativeSelect className="w-full" value={jobId} onChange={(event) => setJobId(event.target.value)}>
            <NativeSelectOption value="">Not tied to a job</NativeSelectOption>
            {jobs.map((job) => (
              <NativeSelectOption key={job.id} value={job.id}>
                {job.number}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>
        <Button
          size="sm"
          className="justify-self-start"
          disabled={!number.trim() && !description.trim()}
          onClick={() => {
            file.addOrder({
              number: number.trim() || `PO-${file.orders.length + 1001}`,
              description: description.trim() || "Materials",
              amount: Number(amount) || 0,
              status: "open",
              jobId: jobId || undefined,
            });
            setNumber("");
            setDescription("");
            setAmount("");
            setJobId("");
            toast.success("Purchase order added.");
          }}
        >
          Add order
        </Button>
      </div>
      {file.orders.length ? (
        <ul className="divide-y divide-black/10 rounded-[4px] border border-black/10">
          {file.orders.map((order) => {
            const job = jobs.find((item) => item.id === order.jobId);
            return (
              <li key={order.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{order.number}</p>
                  <p className="text-sm text-muted-foreground">{order.description}</p>
                  {job ? (
                    <Link href={`/pro/dashboard/jobs/${job.id}`} className="text-xs font-semibold text-primary hover:underline">
                      {job.number}
                    </Link>
                  ) : null}
                </div>
                <p className="text-sm font-medium tabular-nums">{formatMoney(order.amount)}</p>
                <NativeSelect
                  className="w-32"
                  value={order.status}
                  onChange={(event) => file.setOrderStatus(order.id, event.target.value as PartnerOrder["status"])}
                >
                  {ORDER_STATUSES.map((status) => (
                    <NativeSelectOption key={status} value={status}>
                      {orderStatusLabel(status)}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
                <button type="button" className="text-destructive" aria-label={`Delete ${order.number}`} onClick={() => file.removeOrder(order.id)}>
                  <Trash2 className="size-4" />
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">No purchase orders yet.</p>
      )}
    </div>
  );
}

function estimateColumns(provider: Provider) {
  return [
    {
      id: "number",
      header: "Quote #",
      sortValue: (row: Estimate) => row.number,
      searchValue: (row: Estimate) => row.number,
      exportValue: (row: Estimate) => row.number,
      cell: (row: Estimate) => (
        <Link href={`/pro/dashboard/estimates/${row.id}`} className="font-semibold text-primary hover:underline">
          {row.number}
        </Link>
      ),
    },
    {
      id: "customer",
      header: "Customer",
      sortValue: (row: Estimate) => getPortalCustomerName(provider, row.customerId),
      searchValue: (row: Estimate) => getPortalCustomerName(provider, row.customerId),
      exportValue: (row: Estimate) => getPortalCustomerName(provider, row.customerId),
      cell: (row: Estimate) => getPortalCustomerName(provider, row.customerId),
    },
    {
      id: "status",
      header: "Status",
      sortValue: (row: Estimate) => row.status,
      searchValue: (row: Estimate) => estimateStatusLabel(row.status),
      exportValue: (row: Estimate) => estimateStatusLabel(row.status),
      cell: (row: Estimate) => (
        <StatusPill label={estimateStatusLabel(row.status)} className={estimateStatusTone(row.status)} />
      ),
    },
  ];
}

function Field({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <label className={cn("grid gap-1.5 text-sm", className)}>
      <span className="font-medium">{label}</span>
      {children}
    </label>
  );
}
