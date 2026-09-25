"use client";

import { useEffect, useState, type DragEvent, type ReactNode } from "react";
import Link from "next/link";
import {
  Boxes,
  Briefcase,
  ChevronDown,
  Eye,
  FileText,
  Film,
  ImageIcon,
  Loader2,
  Music,
  NotebookPen,
  Package,
  Paperclip,
  Settings,
  Trash2,
  Upload,
  Wallet,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ATTACHMENT_ACCEPT_ATTRIBUTE,
  extractUploadedUrl,
  uploadAnyFile,
  validateAttachmentFile,
} from "@/components/api/uploadFile";
import {
  CreateReminderDialog,
  CreateTaskDialog,
} from "@/components/portal/create-person-dialogs";
import { AuthPhoneInput } from "@/components/auth/auth-phone-input";
import {
  GoogleAddressAutocomplete,
  type PlaceAddress,
} from "@/components/shared/google-address-autocomplete";
import { UsStateSelect } from "@/components/shared/us-state-select";
import { normalizeUsStateCode } from "@/lib/data/us-states";
import { CreateNoteDialogForSubject, NotesPanel } from "@/components/portal/notes-panel";
import { jobBoardColumns } from "@/components/portal/job-columns";
import { PortalDataTable } from "@/components/portal/portal-data-table";
import { RecordWorkspace } from "@/components/portal/record-workspace";
import { StatusPill } from "@/components/portal/status-pill";
import { useCrmApiData } from "@/components/portal/use-crm-api-data";
import { useCrmDirectory } from "@/components/portal/use-crm-directory";
import { usePortalCrew } from "@/components/portal/use-portal-crew";
import { usePortalRecords } from "@/components/portal/use-portal-records";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  crmCustomerName,
  crmStatusLabel,
  type CrmDirectoryStatus,
  type PortalVendor,
  type PortalVendorPurchaseOrder,
} from "@/lib/data/crm-people";
import { getPortalCustomerName } from "@/lib/data/portal";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  addVendorMemberAttachment,
  addVendorPurchaseOrder,
  addVendorSku,
  bindVendorDetail,
  clearVendorDetail,
  deleteVendorRecord,
  fetchVendorDetail,
  fetchVendorInventory,
  fetchVendorJobs,
  fetchVendorOrders,
  patchVendorPurchaseOrder,
  receiveVendorSku,
  removeVendorMemberAttachment,
  removeVendorPurchaseOrder,
  removeVendorSku,
  selectVendorsTabRows,
  selectVendorsTabShowLoader,
  updateVendorRecord,
  vendorsTabFilterKey,
} from "@/store/vendorsSlice";

const DIRECTORY_STATUSES: CrmDirectoryStatus[] = ["active", "inactive", "on_stop"];
const ORDER_STATUSES: PortalVendorPurchaseOrder["status"][] = [
  "draft",
  "issued",
  "partially_received",
  "received",
  "cancelled",
];

function orderStatusLabel(status: PortalVendorPurchaseOrder["status"]) {
  switch (status) {
    case "draft":
      return "Draft";
    case "issued":
      return "Issued";
    case "partially_received":
      return "Partially received";
    case "received":
      return "Received";
    case "cancelled":
      return "Cancelled";
    default: {
      const _never: never = status;
      return _never;
    }
  }
}

function inventoryStatusLabel(status?: string) {
  switch (status) {
    case "out_of_stock":
      return "Out of stock";
    case "low_stock":
      return "Low stock";
    default:
      return "In stock";
  }
}

export function VendorDetailView({ id }: { id: string }) {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const { estimates, invoices, requests, provider } = usePortalWorkspace();
  const { customers } = useCrmDirectory();
  const { events, employeeLabel } = usePortalCrew();
  const records = usePortalRecords();
  const crm = useCrmApiData();
  const sliceItems = useAppSelector((state) => state.vendors?.items ?? []);
  const detail = useAppSelector((state) => state.vendors?.detail ?? null);
  const detailLoading = useAppSelector((state) => Boolean(state.vendors?.detailLoading));
  const detailError = useAppSelector((state) => state.vendors?.detailError ?? null);
  const vendor =
    (detail?.id === id ? detail : null) ?? sliceItems.find((item) => item.id === id);

  const [reminderOpen, setReminderOpen] = useState(false);
  const [taskOpen, setTaskOpen] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [removeOpen, setRemoveOpen] = useState(false);
  const [removing, setRemoving] = useState(false);

  useEffect(() => {
    if (!crm.enabled) return;
    void crm.ensureLoaded();
  }, [crm.enabled, crm.ensureLoaded]);

  useEffect(() => {
    dispatch(bindVendorDetail(id));
    void dispatch(fetchVendorDetail(id));
    return () => {
      dispatch(clearVendorDetail());
    };
  }, [dispatch, id]);

  async function saveVendor(patch: Partial<PortalVendor>) {
    const result = await dispatch(updateVendorRecord({ id, patch }));
    if (updateVendorRecord.rejected.match(result)) {
      throw new Error(result.payload || "Could not save vendor.");
    }
    return result.payload;
  }

  async function confirmRemove() {
    if (!vendor || removing) return;
    setRemoving(true);
    try {
      await dispatch(deleteVendorRecord(vendor.id)).unwrap();
      toast.success(`${vendor.name || "Vendor"} archived.`);
      setRemoveOpen(false);
      router.push("/pro/dashboard/vendors");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : typeof error === "string"
            ? error
            : "Could not remove this vendor.",
      );
    } finally {
      setRemoving(false);
    }
  }

  if (!vendor) {
    if (detailLoading) {
      return (
        <div className="border border-input bg-card" aria-busy="true">
          <CenteredSpinner label="Loading vendor" className="min-h-[22rem]" />
        </div>
      );
    }
    return (
      <div className="border border-input bg-card p-6">
        <h1 className="text-lg font-semibold">{detailError || "Vendor not found"}</h1>
        <Button asChild className="mt-4" size="sm">
          <Link href="/pro/dashboard/vendors">Back to vendors</Link>
        </Button>
      </div>
    );
  }

  const allEstimates = records.mergeEstimates(estimates);

  return (
    <>
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
            <StatusPill label={vendor.category || "Vendor"} />
            <StatusPill
              label={crmStatusLabel(vendor.status)}
              tone={vendor.status === "active" ? "success" : "neutral"}
            />
            {vendor.balance > 0 ? (
              <StatusPill
                label={`${formatMoney(vendor.balance)} due`}
                className="bg-amber-50 text-amber-900"
              />
            ) : null}
          </>
        }
        actions={
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
        }
      >
        {(tab) => {
          switch (tab) {
            case "settings":
              return <VendorSettingsTab vendor={vendor} onSave={saveVendor} />;
            case "account":
              return <VendorAccountTab vendor={vendor} onSave={saveVendor} />;
            case "inventory":
              return <VendorInventoryTab vendor={vendor} />;
            case "orders":
              return <VendorOrdersTab vendorId={vendor.id} />;
            case "jobs":
              return (
                <VendorJobsTab
                  vendorId={vendor.id}
                  estimates={allEstimates}
                  requests={requests}
                  invoices={invoices}
                  events={events}
                  employeeLabel={employeeLabel}
                  customerName={(customerId) => {
                    const customer = customers.find((item) => item.id === customerId);
                    return customer
                      ? crmCustomerName(customer)
                      : getPortalCustomerName(provider, customerId);
                  }}
                />
              );
            case "notes":
              return <NotesPanel kind="vendor" id={vendor.id} />;
            case "attachments":
              return <VendorAttachmentsTab vendor={vendor} />;
            default:
              return <VendorSettingsTab vendor={vendor} onSave={saveVendor} />;
          }
        }}
      </RecordWorkspace>
      <CreateReminderDialog
        open={reminderOpen}
        onOpenChange={setReminderOpen}
        subjectKind="vendor"
        subjectId={vendor.id}
        onCreated={(item) => {
          if (crm.enabled) crm.addReminder(item);
        }}
      />
      <CreateTaskDialog
        open={taskOpen}
        onOpenChange={setTaskOpen}
        subjectKind="vendor"
        subjectId={vendor.id}
        onCreated={(item) => {
          if (crm.enabled) crm.addTask(item);
        }}
      />
      <CreateNoteDialogForSubject
        open={noteOpen}
        onOpenChange={setNoteOpen}
        subjectKind="vendor"
        subjectId={vendor.id}
      />
      <Dialog open={removeOpen} onOpenChange={setRemoveOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Archive vendor</DialogTitle>
            <DialogDescription>
              Are you sure you want to archive {vendor.name || "this vendor"}? Their status will be
              set to inactive.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setRemoveOpen(false)}
              disabled={removing}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => void confirmRemove()}
              disabled={removing}
            >
              {removing ? "Removing…" : "Remove"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function VendorSettingsTab({
  vendor,
  onSave,
}: {
  vendor: PortalVendor;
  onSave: (patch: Partial<PortalVendor>) => void | Promise<unknown>;
}) {
  const [draft, setDraft] = useState(vendor);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDraft(vendor);
  }, [vendor]);

  function applyLocation(address: PlaceAddress) {
    setDraft((current) => ({
      ...current,
      street: address.streetAddress.trim(),
      city: address.city || "",
      state: normalizeUsStateCode(address.state) || "",
      zip: address.zipCode || current.zip || "",
      latitude: address.latitude,
      longitude: address.longitude,
    }));
  }

  async function save() {
    if (saving) return;
    setSaving(true);
    try {
      await Promise.resolve(
        onSave({
          name: draft.name,
          category: draft.category,
          contact: draft.contact,
          status: draft.status,
          email: draft.email,
          phone: draft.phone,
          street: draft.street || "",
          city: draft.city,
          state: draft.state,
          zip: draft.zip || "",
          latitude: draft.latitude ?? null,
          longitude: draft.longitude ?? null,
        }),
      );
      toast.success("Vendor settings saved.");
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
          <h2 className="text-base font-semibold">Vendor settings</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Supply house contact and category used when buying materials.
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
        <Field label="Vendor name">
          <Input
            value={draft.name}
            placeholder="Supply house name"
            onChange={(event) => setDraft({ ...draft, name: event.target.value })}
          />
        </Field>
        <Field label="Category">
          <Input
            value={draft.category}
            placeholder="Plumbing supplies"
            onChange={(event) => setDraft({ ...draft, category: event.target.value })}
          />
        </Field>
        <Field label="Contact">
          <Input
            value={draft.contact}
            placeholder="Primary contact name"
            onChange={(event) => setDraft({ ...draft, contact: event.target.value })}
          />
        </Field>
        <Field label="Status">
          <Select
            value={draft.status}
            onValueChange={(value) =>
              setDraft({ ...draft, status: value as CrmDirectoryStatus })
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select status" />
            </SelectTrigger>
            <SelectContent position="popper">
              {DIRECTORY_STATUSES.map((status) => (
                <SelectItem key={status} value={status}>
                  {crmStatusLabel(status)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <div className="grid gap-3 sm:col-span-2">
          <Field label="Email">
            <Input
              type="email"
              value={draft.email}
              placeholder="orders@vendor.com"
              onChange={(event) => setDraft({ ...draft, email: event.target.value })}
            />
          </Field>
          <Field label="Phone">
            <AuthPhoneInput
              id="vendor-settings-phone"
              value={draft.phone}
              onChange={(phone) => setDraft({ ...draft, phone })}
              placeholder="(555) 123-4567"
            />
          </Field>
        </div>
        <Field label="Location" className="sm:col-span-2">
          <GoogleAddressAutocomplete
            id="vendor-settings-location"
            value={draft.street || ""}
            onChange={(street) => setDraft({ ...draft, street })}
            onSelect={applyLocation}
            placeholder="Start typing a street address…"
          />
        </Field>
        <div className="grid grid-cols-1 gap-3 sm:col-span-2 sm:grid-cols-[minmax(0,1.6fr)_minmax(6.5rem,0.7fr)_minmax(5rem,0.55fr)]">
        <Field label="City">
          <Input
            value={draft.city}
            placeholder="City"
            onChange={(event) => setDraft({ ...draft, city: event.target.value })}
          />
        </Field>
        <Field label="State">
          <UsStateSelect
            value={normalizeUsStateCode(draft.state)}
            onChange={(code) => setDraft({ ...draft, state: code })}
            placeholder="State"
          />
        </Field>
        <Field label="ZIP">
          <Input
            value={draft.zip || ""}
            placeholder="ZIP"
            onChange={(event) => setDraft({ ...draft, zip: event.target.value })}
            inputMode="numeric"
          />
        </Field>
        </div>
      </div>
    </div>
  );
}

function VendorAccountTab({
  vendor,
  onSave,
}: {
  vendor: PortalVendor;
  onSave: (patch: Partial<PortalVendor>) => void | Promise<unknown>;
}) {
  const [draft, setDraft] = useState({
    accountNumber: vendor.accountNumber,
    terms: vendor.terms,
    balance: vendor.balance,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDraft({
      accountNumber: vendor.accountNumber,
      terms: vendor.terms,
      balance: vendor.balance,
    });
  }, [vendor.id, vendor.accountNumber, vendor.terms, vendor.balance]);

  async function save() {
    if (saving) return;
    setSaving(true);
    try {
      await Promise.resolve(onSave(draft));
      toast.success("Account saved.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save account.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold">Account</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            House account, payment terms, and current balance.
          </p>
        </div>
        <Button size="sm" disabled={saving} onClick={() => void save()}>
          {saving ? (
            <>
              <Loader2 className="mr-1.5 size-4 animate-spin" />
              Saving…
            </>
          ) : (
            "Save account"
          )}
        </Button>
      </div>
      <div className="grid gap-3 rounded-[4px] border border-input bg-card p-4 sm:grid-cols-3">
        <Field label="Account #">
          <Input
            value={draft.accountNumber}
            placeholder="ACC-1"
            onChange={(event) => setDraft({ ...draft, accountNumber: event.target.value })}
          />
        </Field>
        <Field label="Terms">
          <Input
            value={draft.terms}
            placeholder="Net 30"
            onChange={(event) => setDraft({ ...draft, terms: event.target.value })}
          />
        </Field>
        <Field label="Balance">
          <Input
            type="number"
            min="0"
            value={draft.balance || ""}
            placeholder="0"
            onChange={(event) =>
              setDraft({ ...draft, balance: Number(event.target.value) || 0 })
            }
          />
        </Field>
      </div>
    </div>
  );
}

function VendorInventoryTab({ vendor }: { vendor: PortalVendor }) {
  const dispatch = useAppDispatch();
  const filterKey = vendorsTabFilterKey({});
  const tab = useAppSelector((state) => state.vendors?.inventory);
  const [sku, setSku] = useState("");
  const [name, setName] = useState("");
  const [unit, setUnit] = useState("ea");
  const [onHand, setOnHand] = useState("");
  const [reorderAt, setReorderAt] = useState("");
  const [unitCost, setUnitCost] = useState("");
  const [location, setLocation] = useState("");
  const [adding, setAdding] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    void dispatch(fetchVendorInventory({ vendorId: vendor.id, force: true }));
  }, [dispatch, vendor.id]);

  const items = selectVendorsTabRows(tab, vendor.id, filterKey, vendor.inventory ?? []);
  const listLoading = selectVendorsTabShowLoader(tab, vendor.id, filterKey);
  const stockValue =
    tab?.stats?.totalOnHandValue ??
    vendor.inventoryOnHandValue ??
    items.reduce((sum, item) => sum + item.onHandCount * item.unitCost, 0);
  const skuCount = tab?.stats?.totalSkus ?? vendor.totalSkus ?? items.length;
  const reorderCount = items.filter(
    (item) => item.onHandCount <= item.reorderPoint,
  ).length;

  async function addSku() {
    if (adding || (!sku.trim() && !name.trim())) return;
    setAdding(true);
    try {
      await dispatch(
        addVendorSku({
          vendorId: vendor.id,
          item: {
            sku: sku.trim() || `SKU-${items.length + 1}`,
            name: name.trim() || "Stock item",
            unit: unit.trim() || "ea",
            onHandCount: Number(onHand) || 0,
            reorderPoint: Number(reorderAt) || 0,
            unitCost: Number(unitCost) || 0,
            location: location.trim(),
          },
        }),
      ).unwrap();
      setSku("");
      setName("");
      setOnHand("");
      setReorderAt("");
      setUnitCost("");
      setLocation("");
      toast.success("SKU added.");
      void dispatch(fetchVendorInventory({ vendorId: vendor.id, force: true }));
    } catch (error) {
      toast.error(typeof error === "string" ? error : "Could not add SKU.");
    } finally {
      setAdding(false);
    }
  }

  async function receiveOne(skuId: string, label: string) {
    if (busyId) return;
    setBusyId(skuId);
    try {
      await dispatch(receiveVendorSku({ vendorId: vendor.id, skuId, quantity: 1 })).unwrap();
      toast.success(`Received 1 of ${label}.`);
      void dispatch(fetchVendorInventory({ vendorId: vendor.id, force: true }));
    } catch (error) {
      toast.error(typeof error === "string" ? error : "Could not receive stock.");
    } finally {
      setBusyId(null);
    }
  }

  async function removeSku(skuId: string) {
    if (busyId) return;
    setBusyId(skuId);
    try {
      await dispatch(removeVendorSku({ vendorId: vendor.id, skuId })).unwrap();
      toast.success("SKU removed.");
      void dispatch(fetchVendorInventory({ vendorId: vendor.id, force: true }));
    } catch (error) {
      toast.error(typeof error === "string" ? error : "Could not remove SKU.");
    } finally {
      setBusyId(null);
    }
  }

  if (listLoading) {
    return (
      <div className="border border-input" aria-busy="true">
        <CenteredSpinner label="Loading inventory" className="min-h-[16rem]" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Inventory from {vendor.name}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            SKUs this vendor stocks for the shop. Reorder warnings show until you receive stock.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <StatusPill label={`${skuCount} SKUs`} />
          <StatusPill label={`${formatMoney(stockValue)} on hand`} />
          {reorderCount ? (
            <StatusPill label={`${reorderCount} to reorder`} className="bg-amber-50 text-amber-900" />
          ) : null}
        </div>
      </div>
      <div className="grid gap-3 rounded-[4px] border border-input bg-card p-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="SKU">
          <Input value={sku} placeholder="WH-50G" onChange={(event) => setSku(event.target.value)} />
        </Field>
        <Field label="Item">
          <Input
            value={name}
            placeholder="50-gal water heater"
            onChange={(event) => setName(event.target.value)}
          />
        </Field>
        <Field label="Unit">
          <Input value={unit} placeholder="ea" onChange={(event) => setUnit(event.target.value)} />
        </Field>
        <Field label="On hand">
          <Input
            type="number"
            min="0"
            value={onHand}
            placeholder="0"
            onChange={(event) => setOnHand(event.target.value)}
          />
        </Field>
        <Field label="Reorder at">
          <Input
            type="number"
            min="0"
            value={reorderAt}
            placeholder="2"
            onChange={(event) => setReorderAt(event.target.value)}
          />
        </Field>
        <Field label="Unit cost">
          <Input
            type="number"
            min="0"
            value={unitCost}
            placeholder="0"
            onChange={(event) => setUnitCost(event.target.value)}
          />
        </Field>
        <Field label="Location" className="sm:col-span-2 lg:col-span-2">
          <Input
            value={location}
            placeholder="Aisle 3"
            onChange={(event) => setLocation(event.target.value)}
          />
        </Field>
        <Button
          size="sm"
          className="justify-self-start self-end"
          disabled={adding || (!sku.trim() && !name.trim())}
          onClick={() => void addSku()}
        >
          {adding ? (
            <>
              <Loader2 className="mr-1.5 size-4 animate-spin" />
              Adding…
            </>
          ) : (
            "Add SKU"
          )}
        </Button>
      </div>
      {items.length ? (
        <div className="overflow-x-auto rounded-[4px] border border-input">
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
            <tbody className="divide-y divide-input">
              {items.map((item) => {
                const low = item.onHandCount <= item.reorderPoint;
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
                    <td className="px-3 py-2 tabular-nums">{item.onHandCount}</td>
                    <td className="px-3 py-2 tabular-nums">{item.reorderPoint}</td>
                    <td className="px-3 py-2 tabular-nums">{formatMoney(item.unitCost)}</td>
                    <td className="px-3 py-2 tabular-nums">
                      {formatMoney(item.totalValue ?? item.onHandCount * item.unitCost)}
                    </td>
                    <td className="px-3 py-2">
                      <StatusPill
                        label={inventoryStatusLabel(item.status)}
                        tone={
                          item.status === "out_of_stock"
                            ? "danger"
                            : item.status === "low_stock" || low
                              ? "warning"
                              : "success"
                        }
                      />
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busyId === item.id}
                          onClick={() => void receiveOne(item.id, item.name)}
                        >
                          {busyId === item.id ? "…" : "+ Receive"}
                        </Button>
                        <button
                          type="button"
                          className="text-destructive disabled:opacity-50"
                          aria-label={`Delete ${item.name}`}
                          disabled={busyId === item.id}
                          onClick={() => void removeSku(item.id)}
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

function VendorOrdersTab({ vendorId }: { vendorId: string }) {
  const dispatch = useAppDispatch();
  const filterKey = vendorsTabFilterKey({});
  const tab = useAppSelector((state) => state.vendors?.orders);
  const jobsTab = useAppSelector((state) => state.vendors?.jobs);
  const [number, setNumber] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [jobId, setJobId] = useState("");
  const [adding, setAdding] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    void dispatch(fetchVendorOrders({ vendorId, force: true }));
    void dispatch(fetchVendorJobs({ vendorId, force: true }));
  }, [dispatch, vendorId]);

  const orders = selectVendorsTabRows(tab, vendorId, filterKey, []);
  const jobs = selectVendorsTabRows(jobsTab, vendorId, vendorsTabFilterKey({}), []);
  const listLoading = selectVendorsTabShowLoader(tab, vendorId, filterKey);

  async function addOrder() {
    if (adding || (!number.trim() && !description.trim())) return;
    setAdding(true);
    try {
      await dispatch(
        addVendorPurchaseOrder({
          vendorId,
          order: {
            poNumber: number.trim() || undefined,
            description: description.trim() || "Materials",
            amount: Number(amount) || 0,
            jobId: jobId || undefined,
            status: "issued",
          },
        }),
      ).unwrap();
      setNumber("");
      setDescription("");
      setAmount("");
      setJobId("");
      toast.success("Purchase order added.");
      void dispatch(fetchVendorOrders({ vendorId, force: true }));
      void dispatch(fetchVendorJobs({ vendorId, force: true }));
    } catch (error) {
      toast.error(typeof error === "string" ? error : "Could not add order.");
    } finally {
      setAdding(false);
    }
  }

  async function setStatus(orderId: string, status: PortalVendorPurchaseOrder["status"]) {
    if (busyId) return;
    setBusyId(orderId);
    try {
      await dispatch(patchVendorPurchaseOrder({ vendorId, orderId, patch: { status } })).unwrap();
      void dispatch(fetchVendorOrders({ vendorId, force: true }));
    } catch (error) {
      toast.error(typeof error === "string" ? error : "Could not update order.");
    } finally {
      setBusyId(null);
    }
  }

  async function removeOrder(orderId: string) {
    if (busyId) return;
    setBusyId(orderId);
    try {
      await dispatch(removeVendorPurchaseOrder({ vendorId, orderId })).unwrap();
      toast.success("Order removed.");
      void dispatch(fetchVendorOrders({ vendorId, force: true }));
    } catch (error) {
      toast.error(typeof error === "string" ? error : "Could not remove order.");
    } finally {
      setBusyId(null);
    }
  }

  if (listLoading) {
    return (
      <div className="border border-input" aria-busy="true">
        <CenteredSpinner label="Loading orders" className="min-h-[16rem]" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold">Purchase orders</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Materials ordered from this vendor, optionally against a job.
        </p>
      </div>
      <div className="grid gap-3 rounded-[4px] border border-input bg-card p-4 sm:grid-cols-2">
        <Field label="PO number">
          <Input
            value={number}
            placeholder="PO-1042"
            onChange={(event) => setNumber(event.target.value)}
          />
        </Field>
        <Field label="Amount">
          <Input
            type="number"
            min="0"
            value={amount}
            placeholder="0"
            onChange={(event) => setAmount(event.target.value)}
          />
        </Field>
        <Field label="What was ordered" className="sm:col-span-2">
          <Input
            value={description}
            placeholder="50-gal heater, fittings…"
            onChange={(event) => setDescription(event.target.value)}
          />
        </Field>
        <Field label="Job (optional)" className="sm:col-span-2">
          <Select value={jobId || "__none__"} onValueChange={(value) => setJobId(value === "__none__" ? "" : value)}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Not tied to a job" />
            </SelectTrigger>
            <SelectContent position="popper">
              <SelectItem value="__none__">Not tied to a job</SelectItem>
              {jobs.map((job) => (
                <SelectItem key={job.id} value={job.id}>
                  {job.number || job.id}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Button
          size="sm"
          className="justify-self-start"
          disabled={adding || (!number.trim() && !description.trim())}
          onClick={() => void addOrder()}
        >
          {adding ? (
            <>
              <Loader2 className="mr-1.5 size-4 animate-spin" />
              Adding…
            </>
          ) : (
            "Add order"
          )}
        </Button>
      </div>
      {orders.length ? (
        <ul className="divide-y divide-input rounded-[4px] border border-input">
          {orders.map((order) => {
            const job = jobs.find((item) => item.id === order.jobId);
            return (
              <li key={order.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{order.poNumber}</p>
                  <p className="text-sm text-muted-foreground">{order.description}</p>
                  {job ? (
                    <Link
                      href={`/pro/dashboard/jobs/${job.id}`}
                      className="text-xs font-semibold text-primary hover:underline"
                    >
                      {job.number}
                    </Link>
                  ) : null}
                </div>
                <p className="text-sm font-medium tabular-nums">{formatMoney(order.amount)}</p>
                <Select
                  value={order.status}
                  disabled={busyId === order.id}
                  onValueChange={(value) =>
                    void setStatus(order.id, value as PortalVendorPurchaseOrder["status"])
                  }
                >
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent position="popper">
                    {ORDER_STATUSES.map((status) => (
                      <SelectItem key={status} value={status}>
                        {orderStatusLabel(status)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <button
                  type="button"
                  className="text-destructive disabled:opacity-50"
                  aria-label={`Delete ${order.poNumber}`}
                  disabled={busyId === order.id}
                  onClick={() => void removeOrder(order.id)}
                >
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

function VendorJobsTab({
  vendorId,
  estimates,
  requests,
  invoices,
  events,
  employeeLabel,
  customerName,
}: {
  vendorId: string;
  estimates: Parameters<typeof jobBoardColumns>[0]["estimates"];
  requests: Parameters<typeof jobBoardColumns>[0]["requests"];
  invoices: Parameters<typeof jobBoardColumns>[0]["invoices"];
  events: Parameters<typeof jobBoardColumns>[0]["events"];
  employeeLabel: (id?: string) => string;
  customerName: (customerId: string) => string;
}) {
  const dispatch = useAppDispatch();
  const filterKey = vendorsTabFilterKey({});
  const tab = useAppSelector((state) => state.vendors?.jobs);

  useEffect(() => {
    void dispatch(fetchVendorJobs({ vendorId, force: true }));
  }, [dispatch, vendorId]);

  const rows = selectVendorsTabRows(tab, vendorId, filterKey, []);
  const listLoading = selectVendorsTabShowLoader(tab, vendorId, filterKey);

  return (
    <PortalDataTable
      filename="vendor-jobs"
      countLabel="Jobs"
      searchPlaceholder="Search jobs"
      loading={listLoading}
      empty="No jobs linked to this vendor’s purchase orders yet."
      rows={rows}
      rowKey={(row) => row.id}
      rowHref={(row) => `/pro/dashboard/jobs/${row.id}`}
      columns={jobBoardColumns({
        estimates,
        requests,
        invoices,
        events,
        employeeLabel,
        customerName,
      })}
    />
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

function VendorAttachmentsTab({ vendor }: { vendor: PortalVendor }) {
  const dispatch = useAppDispatch();
  const detail = useAppSelector((state) => state.vendors?.detail ?? null);
  const [over, setOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const liveVendor = detail?.id === vendor.id ? detail : vendor;
  const attachments = (liveVendor.attachments ?? []).map((item) => ({
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
          addVendorMemberAttachment({
            id: vendor.id,
            attachment: {
              name: fileItem.name,
              url,
              fileType: fileItem.type || "application/octet-stream",
              sizeBytes: fileItem.size,
              category: "other",
            },
          }),
        );
        if (addVendorMemberAttachment.rejected.match(result)) {
          throw new Error(
            typeof result.payload === "string"
              ? result.payload
              : `Could not attach ${fileItem.name}.`,
          );
        }
        toast.success(`${fileItem.name} attached.`);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not upload that file.");
    } finally {
      setUploading(false);
    }
  }

  async function removeAttachment(id: string, name: string) {
    if (deletingId) return;
    setDeletingId(id);
    try {
      const result = await dispatch(
        removeVendorMemberAttachment({ id: vendor.id, attachmentId: id }),
      );
      if (removeVendorMemberAttachment.rejected.match(result)) {
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

  return (
    <div>
      <h2 className="text-base font-semibold">Attachments</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Catalogs, W-9, agreements, and supplier invoices for this vendor.
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
        onDrop={(event: DragEvent<HTMLLabelElement>) => {
          event.preventDefault();
          setOver(false);
          if (event.dataTransfer.files.length) void readFiles(event.dataTransfer.files);
        }}
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
                <a href={item.dataUrl} target="_blank" rel="noopener noreferrer">
                  <Eye className="size-3.5" />
                  Preview
                </a>
              </Button>
              <Button
                size="icon-sm"
                variant="ghost"
                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                disabled={deletingId === item.id || uploading}
                onClick={() => void removeAttachment(item.id, item.name)}
              >
                {deletingId === item.id ? <Loader2 className="size-4 animate-spin" /> : <Trash2 />}
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-sm text-muted-foreground">No documents yet for this vendor.</p>
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
