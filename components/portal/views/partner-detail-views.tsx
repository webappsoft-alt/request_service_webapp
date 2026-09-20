"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  Boxes,
  Briefcase,
  NotebookPen,
  Package,
  Paperclip,
  Settings,
  Trash2,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { AddNoteButton, SetReminderButton, SetTaskButton } from "@/components/portal/create-person-dialogs";
import { NotesPanel } from "@/components/portal/notes-panel";
import { FileNotices } from "@/components/portal/task-banner";
import { jobBoardColumns } from "@/components/portal/job-columns";
import { PortalDataTable } from "@/components/portal/portal-data-table";
import { RecordWorkspace } from "@/components/portal/record-workspace";
import { StatusPill } from "@/components/portal/status-pill";
import { useCrmApiData } from "@/components/portal/use-crm-api-data";
import { useCrmDirectory } from "@/components/portal/use-crm-directory";
import { useCrmRecordPending } from "@/components/portal/use-crm-record-pending";
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
import { EmployeeAttachmentsTab } from "@/components/portal/views/employee-detail-view";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { getVendor } from "@/lib/api/crm-client";
import {
  crmCustomerName,
  crmStatusLabel,
  vendorAsEmployee,
  type CrmDirectoryStatus,
  type PortalVendor,
} from "@/lib/data/crm-people";
import { getPortalCustomerName, jobServiceLabel } from "@/lib/data/portal";
import { formatMoney } from "@/lib/format";
import type { Job } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useAppSelector } from "@/store/hooks";

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

export function VendorDetailView({ id }: { id: string }) {
  const { estimates, jobs, invoices, requests, provider } = usePortalWorkspace();
  const { vendors, customers, remove, updateVendor } = useCrmDirectory();
  const { events, employeeLabel } = usePortalCrew();
  const records = usePortalRecords();
  const crm = useCrmApiData();
  const sliceItems = useAppSelector((state) => state.vendors?.items ?? []);
  const [fetched, setFetched] = useState<PortalVendor | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailTried, setDetailTried] = useState(false);
  const vendor =
    (fetched?.id === id ? fetched : null) ??
    sliceItems.find((item) => item.id === id) ??
    vendors.find((item) => item.id === id);
  const pending = useCrmRecordPending();

  useEffect(() => {
    if (!crm.enabled) return;
    void crm.ensureLoaded();
  }, [crm.enabled, crm.ensureLoaded]);

  useEffect(() => {
    setFetched(null);
    setDetailTried(false);
  }, [id]);

  useEffect(() => {
    if (vendor) {
      setDetailLoading(false);
      setDetailTried(true);
      return;
    }
    let cancelled = false;
    setDetailLoading(true);
    void getVendor(id)
      .then((item) => {
        if (!cancelled && item) setFetched(item);
      })
      .finally(() => {
        if (!cancelled) {
          setDetailLoading(false);
          setDetailTried(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [id, vendor]);

  if (!vendor) {
    const loading = detailLoading || (pending && !detailTried);
    return (
      <div className="border border-black/15 bg-card p-6">
        <h1 className="text-lg font-semibold">{loading ? "Loading vendor…" : "Vendor not found"}</h1>
        {!loading ? (
          <Button asChild className="mt-4" size="sm">
            <Link href="/pro/dashboard/vendors">Back to vendors</Link>
          </Button>
        ) : null}
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
            return <EmployeeAttachmentsTab employee={asEmployee} useApi={false} />;
          default:
            return <VendorSettingsTab vendor={vendor} onSave={updateVendor} />;
        }
      }}
    </RecordWorkspace>
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

function Field({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <label className={cn("grid gap-1.5 text-sm", className)}>
      <span className="font-medium">{label}</span>
      {children}
    </label>
  );
}
