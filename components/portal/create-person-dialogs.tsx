"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AuthPhoneInput } from "@/components/auth/auth-phone-input";
import {
  AddressAutocomplete,
  type PlaceAddress,
} from "@/components/shared/address-autocomplete";
import { useCrmDirectory } from "@/components/portal/use-crm-directory";
import { useCrmApiData } from "@/components/portal/use-crm-api-data";
import { usePortalCrew } from "@/components/portal/use-portal-crew";
import { usePortalWorkspace } from "@/components/portal/use-portal-workspace";
import { CreateUniversalNoteDialog } from "@/components/portal/universal-notes-panel";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { PaginatedEntitySelect } from "@/components/portal/paginated-entity-select";
import { usePaginatedCrmOptions } from "@/components/portal/use-paginated-crm-options";
import { useReminderLookups } from "@/components/portal/reminder-banner";
import { employeeName } from "@/lib/data/portal";
import type {
  CrmCustomerType,
  CrmEntityKind,
  CrmPersonSource,
  CrmReminderStatus,
  CrmTaskPriority,
  CrmTaskStatus,
  PortalContractor,
  PortalCustomerCrm,
  PortalNote,
  PortalReminder,
  PortalTask,
  PortalVendor,
  ReminderSubjectKind,
} from "@/lib/data/crm-people";
import {
  CRM_TASK_SUBJECT_KINDS,
  crmReminderStatusLabel,
  crmSourceLabel,
  crmTaskPriorityLabel,
  crmTaskStatusLabel,
  crmTypeLabel,
  REMINDER_SUBJECT_KINDS,
  reminderSubjectKindLabel,
} from "@/lib/data/crm-people";
import { todayISO } from "@/components/portal/work-builders";
import { Loader2 } from "lucide-react";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { selectAuth, selectAuthUser } from "@/store/authSlice";
import { createContractorRecord, updateContractorRecord } from "@/store/contractorsSlice";
import { createVendorRecord, updateVendorRecord } from "@/store/vendorsSlice";
import {
  createReminderRecord,
  updateReminderRecord,
  patchReminderStatus,
  upsertReminderItem,
} from "@/store/remindersSlice";
import {
  createCustomerTask,
  updateCustomerTask,
  upsertCustomerTask,
  upsertCustomerReminder,
} from "@/store/customersSlice";
import {
  createTaskRecord,
  updateTaskRecord,
  upsertTaskItem,
} from "@/store/tasksSlice";
import { createTask as createTaskApi, updateTask as updateTaskApi } from "@/lib/api/crm-client";

const SOURCES: CrmPersonSource[] = ["external", "phone", "referral", "walk_in", "website"];
const TYPES: CrmCustomerType[] = ["residential", "commercial", "property_manager"];

export function CreateCustomerDialog({
  open,
  onOpenChange,
  customer = null,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customer?: PortalCustomerCrm | null;
  /** Fired after a successful create/update — not when the dialog is dismissed. */
  onSaved?: () => void;
}) {
  const { addCustomer, updateCustomer, provider, customers } = useCrmDirectory();
  const isEdit = Boolean(customer);
  const [saving, setSaving] = useState(false);
  const [entityKind, setEntityKind] = useState<CrmEntityKind>("individual");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [street, setStreet] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [zip, setZip] = useState("");
  const [customerType, setCustomerType] = useState<CrmCustomerType>("residential");
  const [source, setSource] = useState<CrmPersonSource>("external");
  const [ein, setEin] = useState("");
  const [website, setWebsite] = useState("");
  const [notes, setNotes] = useState("");

  function reset() {
    setEntityKind("individual");
    setFirstName("");
    setLastName("");
    setCompanyName("");
    setEmail("");
    setPhone("");
    setStreet("");
    setCity("");
    setState("");
    setZip("");
    setCustomerType("residential");
    setSource("external");
    setEin("");
    setWebsite("");
    setNotes("");
    setSaving(false);
  }

  useEffect(() => {
    if (!open) return;
    if (!customer) {
      reset();
      return;
    }
    const address = customer.addresses[0];
    setEntityKind(customer.entityKind);
    setFirstName(customer.firstName);
    setLastName(customer.lastName);
    setCompanyName(customer.companyName ?? "");
    setEmail(customer.email);
    setPhone(customer.phone ?? "");
    setStreet(address?.street ?? "");
    setCity(address?.city ?? provider.city);
    setState(address?.state ?? provider.state);
    setZip(address?.zip ?? provider.serviceArea[0] ?? "");
    setCustomerType(customer.customerType);
    setSource(customer.source);
    setEin(customer.ein ?? "");
    setWebsite(customer.website ?? "");
    setNotes(customer.notes ?? "");
    setSaving(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- hydrate when dialog opens for a customer
  }, [open, customer?.id]);

  function applyAddress(address: PlaceAddress) {
    setStreet(address.streetAddress || address.formattedAddress);
    setCity(address.city || "");
    setState(address.state || "");
    setZip(address.zipCode || "");
  }

  async function save() {
    if (saving) return;

    if (isEdit && customer) {
      setSaving(true);
      const existingAddress = customer.addresses[0];
      try {
        await Promise.resolve(
          updateCustomer(customer.id, {
            firstName: firstName.trim() || companyName.trim() || customer.firstName,
            lastName: lastName.trim() || customer.lastName,
            email: email.trim() || customer.email,
            phone: phone.trim() || undefined,
            entityKind,
            customerType,
            source,
            companyName: entityKind === "company" ? companyName.trim() : "",
            ein: ein.trim() || undefined,
            website: website.trim() || undefined,
            notes: notes.trim(),
            addresses: [
              {
                id: existingAddress?.id ?? `addr_${customer.id}`,
                street: street.trim() || existingAddress?.street || "Address pending",
                city: city.trim() || provider.city,
                state: state.trim() || provider.state,
                zip: zip.trim() || provider.serviceArea[0] || "00000",
                country: existingAddress?.country ?? "US",
                label: existingAddress?.label,
                unit: existingAddress?.unit,
              },
            ],
          }),
        );
        toast.success(
          `${companyName.trim() || `${firstName.trim()} ${lastName.trim()}`.trim() || "Customer"} updated.`,
        );
        reset();
        onSaved?.();
        onOpenChange(false);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Could not update this customer.");
      } finally {
        setSaving(false);
      }
      return;
    }

    const id = `cust_${provider.id}_new_${Date.now()}`;
    const createdAt = new Date().toISOString().slice(0, 10);
    const nextCustomer: PortalCustomerCrm = {
      id,
      userId: `user_${id}`,
      firstName: firstName.trim() || companyName.trim() || "New",
      lastName: lastName.trim() || "Customer",
      email: email.trim() || `${id}@office.local`,
      phone: phone.trim() || undefined,
      addresses:
        street.trim() && city.trim() && state.trim() && zip.trim()
          ? [
              {
                id: `addr_${id}`,
                street: street.trim(),
                city: city.trim(),
                state: state.trim(),
                zip: zip.trim(),
                country: "US",
              },
            ]
          : [],
      createdAt,
      updatedAt: createdAt,
      customerNumber: String(1000001 + customers.length).padStart(7, "0"),
      entityKind,
      customerType,
      source,
      companyName: entityKind === "company" ? companyName.trim() : undefined,
      ein: entityKind === "company" ? ein.trim() || undefined : undefined,
      website: entityKind === "company" ? website.trim() || undefined : undefined,
      doNotCall: false,
      taxCode: "CO-SALES",
      laborTaxCode: "CO-LABOR",
      creditLimit: 0,
      onStop: false,
      membership: "none",
      tags: [source === "website" ? "Website" : "Office"],
      notes: notes.trim(),
      amountOwing: 0,
    };
    addCustomer(nextCustomer);
    toast.success(
      `${nextCustomer.companyName ?? `${nextCustomer.firstName} ${nextCustomer.lastName}`} added to the directory.`,
    );
    reset();
    onSaved?.();
    onOpenChange(false);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl" data-lenis-prevent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit customer" : "Create customer"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update contact details, address, and account information for this customer."
              : "Add a household, company, or walk-in that did not come through the website request form."}
          </DialogDescription>
        </DialogHeader>
        <FieldGroup className="gap-4">
          <div className="flex gap-4 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="entity"
                checked={entityKind === "individual"}
                onChange={() => {
                  setEntityKind("individual");
                  setCompanyName("");
                  setEin("");
                  setWebsite("");
                }}
              />
              Individual
            </label>
            <label className="flex items-center gap-2">
              <input type="radio" name="entity" checked={entityKind === "company"} onChange={() => setEntityKind("company")} />
              Company
            </label>
          </div>
          {entityKind === "company" ? (
            <Field>
              <FieldLabel htmlFor="cust-company">Company name</FieldLabel>
              <Input
                id="cust-company"
                value={companyName}
                onChange={(change) => setCompanyName(change.target.value)}
                placeholder="Acme Plumbing"
              />
            </Field>
          ) : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="cust-first">First name</FieldLabel>
              <Input
                id="cust-first"
                value={firstName}
                onChange={(change) => setFirstName(change.target.value)}
                placeholder="Jane"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="cust-last">Last name</FieldLabel>
              <Input
                id="cust-last"
                value={lastName}
                onChange={(change) => setLastName(change.target.value)}
                placeholder="Ortiz"
              />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="cust-email">Email</FieldLabel>
              <Input
                id="cust-email"
                type="email"
                value={email}
                onChange={(change) => setEmail(change.target.value)}
                placeholder="jane@email.com"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="cust-phone">Phone</FieldLabel>
              <AuthPhoneInput
                id="cust-phone"
                value={phone}
                onChange={setPhone}
                placeholder="(555) 123-4567"
              />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="cust-type">Customer type</FieldLabel>
              <Select
                value={customerType}
                onValueChange={(value) => setCustomerType(value as CrmCustomerType)}
              >
                <SelectTrigger id="cust-type" className="w-full">
                  <SelectValue placeholder="Select customer type" />
                </SelectTrigger>
                <SelectContent
                  position="popper"
                  align="start"
                  className="z-[100] w-[var(--radix-select-trigger-width)]"
                >
                  {TYPES.map((item) => (
                    <SelectItem key={item} value={item}>
                      {crmTypeLabel(item)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel htmlFor="cust-source">Source</FieldLabel>
              <Select
                value={source}
                onValueChange={(value) => setSource(value as CrmPersonSource)}
              >
                <SelectTrigger id="cust-source" className="w-full">
                  <SelectValue placeholder="Select source" />
                </SelectTrigger>
                <SelectContent
                  position="popper"
                  align="start"
                  className="z-[100] w-[var(--radix-select-trigger-width)]"
                >
                  {SOURCES.map((item) => (
                    <SelectItem key={item} value={item}>
                      {crmSourceLabel(item)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
          {entityKind === "company" ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="cust-ein">EIN</FieldLabel>
                <Input
                  id="cust-ein"
                  value={ein}
                  onChange={(change) => setEin(change.target.value)}
                  placeholder="12-3456789"
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="cust-web">Website</FieldLabel>
                <Input
                  id="cust-web"
                  value={website}
                  onChange={(change) => setWebsite(change.target.value)}
                  placeholder="https://company.com"
                />
              </Field>
            </div>
          ) : null}
          <Field>
            <FieldLabel htmlFor="cust-street">Street address</FieldLabel>
            <AddressAutocomplete
              id="cust-street"
              value={street}
              onChange={setStreet}
              onSelect={applyAddress}
              placeholder="Start typing a street address…"
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field>
              <FieldLabel htmlFor="cust-city">City</FieldLabel>
              <Input
                id="cust-city"
                value={city}
                onChange={(change) => setCity(change.target.value)}
                placeholder="Austin"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="cust-state">State</FieldLabel>
              <Input
                id="cust-state"
                value={state}
                onChange={(change) => setState(change.target.value)}
                placeholder="TX"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="cust-zip">ZIP</FieldLabel>
              <Input
                id="cust-zip"
                value={zip}
                onChange={(change) => setZip(change.target.value)}
                placeholder="78701"
              />
            </Field>
          </div>
          <p className="text-xs text-muted-foreground">City, state, and ZIP fill in when you pick an address.</p>
          <Field>
            <FieldLabel htmlFor="cust-notes">Notes</FieldLabel>
            <Textarea
              id="cust-notes"
              value={notes}
              onChange={(change) => setNotes(change.target.value)}
              placeholder="Gate code, billing notes, access…"
            />
          </Field>
        </FieldGroup>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button
            disabled={saving || (!firstName.trim() && !companyName.trim())}
            onClick={() => void save()}
          >
            {saving ? "Saving…" : isEdit ? "Save changes" : "Save and finish"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function CreateContractorDialog({
  open,
  onOpenChange,
  contractor = null,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contractor?: PortalContractor | null;
}) {
  const dispatch = useAppDispatch();
  const auth = useAppSelector(selectAuth);
  const user = useAppSelector(selectAuthUser);
  const useApi =
    auth.hydrated &&
    Boolean(auth.token) &&
    (user?.role === "provider" || auth.role === "provider");
  const { addContractor, updateContractor, provider, contractors } = useCrmDirectory();
  const isEdit = Boolean(contractor);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [trade, setTrade] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [license, setLicense] = useState("");
  const [saving, setSaving] = useState(false);

  function reset() {
    setFirstName("");
    setLastName("");
    setCompanyName("");
    setTrade("");
    setEmail("");
    setPhone("");
    setLicense("");
    setSaving(false);
  }

  useEffect(() => {
    if (!open) return;
    if (!contractor) {
      reset();
      return;
    }
    setFirstName(contractor.firstName);
    setLastName(contractor.lastName);
    setCompanyName(contractor.companyName);
    setTrade(contractor.trade);
    setEmail(contractor.email);
    setPhone(contractor.phone);
    setLicense(contractor.license);
    setSaving(false);
  }, [open, contractor]);

  async function save() {
    if (saving) return;
    const patch = {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      companyName: companyName.trim() || `${lastName.trim()} Contracting`,
      email: email.trim() || `${firstName.toLowerCase()}@contractor.local`,
      phone: phone.trim() || "(000) 000-0000",
      trade: trade.trim() || "General",
      license: license.trim() || "Pending",
    };
    if (!patch.firstName || !patch.lastName) return;

    setSaving(true);
    try {
      if (isEdit && contractor) {
        if (useApi) {
          const updated = await dispatch(
            updateContractorRecord({ id: contractor.id, patch: { ...contractor, ...patch } }),
          ).unwrap();
          toast.success(`${updated.companyName} updated.`);
        } else {
          await Promise.resolve(updateContractor(contractor.id, patch));
          toast.success(`${patch.companyName} updated.`);
        }
      } else {
        const next: PortalContractor = {
          id: `con_${provider.id}_new_${Date.now()}`,
          number: `VNDC-${220 + contractors.length}`,
          ...patch,
          city: provider.city,
          state: provider.state,
          zip: provider.serviceArea[0] ?? "",
          status: "active",
          hourlyRate: 75,
          insuranceExpires: "2027-01-01",
          createdAt: new Date().toISOString().slice(0, 10),
        };
        if (useApi) {
          const created = await dispatch(createContractorRecord(next)).unwrap();
          toast.success(`${created.companyName} added.`);
        } else {
          addContractor(next);
          toast.success(`${next.companyName} added.`);
        }
      }
      reset();
      onOpenChange(false);
    } catch (err) {
      toast.error(typeof err === "string" ? err : "Could not save contractor.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (saving) return;
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-lg" data-lenis-prevent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit contractor" : "Create contractor"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update subcontractor contact and trade details."
              : "Subcontractors and specialty trades used on jobs."}
          </DialogDescription>
        </DialogHeader>
        <FieldGroup className="gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="con-first">First name</FieldLabel>
              <Input id="con-first" value={firstName} onChange={(change) => setFirstName(change.target.value)} placeholder="Alex" />
            </Field>
            <Field>
              <FieldLabel htmlFor="con-last">Last name</FieldLabel>
              <Input id="con-last" value={lastName} onChange={(change) => setLastName(change.target.value)} placeholder="Rivera" />
            </Field>
          </div>
          <Field>
            <FieldLabel htmlFor="con-co">Company</FieldLabel>
            <Input id="con-co" value={companyName} onChange={(change) => setCompanyName(change.target.value)} placeholder="Rivera Contracting" />
          </Field>
          <Field>
            <FieldLabel htmlFor="con-trade">Trade</FieldLabel>
            <Input id="con-trade" value={trade} onChange={(change) => setTrade(change.target.value)} placeholder="Plumbing, HVAC, Electrical…" />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="con-email">Email</FieldLabel>
              <Input id="con-email" value={email} onChange={(change) => setEmail(change.target.value)} placeholder="alex@contractor.local" />
            </Field>
            <Field>
              <FieldLabel htmlFor="con-phone">Phone</FieldLabel>
              <AuthPhoneInput
                id="con-phone"
                value={phone}
                onChange={setPhone}
                placeholder="(555) 123-4567"
              />
            </Field>
          </div>
          <Field>
            <FieldLabel htmlFor="con-lic">License</FieldLabel>
            <Input id="con-lic" value={license} onChange={(change) => setLicense(change.target.value)} placeholder="LIC-12345" />
          </Field>
        </FieldGroup>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button disabled={saving || !firstName.trim() || !lastName.trim()} onClick={() => void save()}>
            {saving ? "Saving…" : isEdit ? "Save changes" : "Save and finish"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function CreateVendorDialog({
  open,
  onOpenChange,
  vendor = null,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vendor?: PortalVendor | null;
}) {
  const dispatch = useAppDispatch();
  const auth = useAppSelector(selectAuth);
  const user = useAppSelector(selectAuthUser);
  const useApi =
    auth.hydrated &&
    Boolean(auth.token) &&
    (user?.role === "provider" || auth.role === "provider");
  const { addVendor, updateVendor, provider, vendors } = useCrmDirectory();
  const isEdit = Boolean(vendor);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [contact, setContact] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);

  function reset() {
    setName("");
    setCategory("");
    setContact("");
    setEmail("");
    setPhone("");
    setSaving(false);
  }

  useEffect(() => {
    if (!open) return;
    if (!vendor) {
      reset();
      return;
    }
    setName(vendor.name);
    setCategory(vendor.category);
    setContact(vendor.contact);
    setEmail(vendor.email);
    setPhone(vendor.phone);
    setSaving(false);
  }, [open, vendor]);

  async function save() {
    if (saving) return;
    const patch = {
      name: name.trim(),
      category: category.trim() || "Supply",
      contact: contact.trim() || "Accounts",
      email: email.trim() || "orders@vendor.local",
      phone: phone.trim() || "(000) 000-0000",
    };
    if (!patch.name) return;

    setSaving(true);
    try {
      if (isEdit && vendor) {
        if (useApi) {
          const updated = await dispatch(
            updateVendorRecord({ id: vendor.id, patch: { ...vendor, ...patch } }),
          ).unwrap();
          toast.success(`${updated.name} updated.`);
        } else {
          await Promise.resolve(updateVendor(vendor.id, patch));
          toast.success(`${patch.name} updated.`);
        }
      } else {
        const next: PortalVendor = {
          id: `ven_${provider.id}_new_${Date.now()}`,
          number: `VND-${310 + vendors.length}`,
          ...patch,
          city: provider.city,
          state: provider.state,
          accountNumber: `ACC-${vendors.length + 1}`,
          terms: "Net 30",
          balance: 0,
          status: "active",
          createdAt: new Date().toISOString().slice(0, 10),
        };
        if (useApi) {
          const created = await dispatch(createVendorRecord(next)).unwrap();
          toast.success(`${created.name} added.`);
        } else {
          addVendor(next);
          toast.success(`${next.name} added.`);
        }
      }
      reset();
      onOpenChange(false);
    } catch (err) {
      toast.error(typeof err === "string" ? err : "Could not save vendor.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (saving) return;
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-lg" data-lenis-prevent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit vendor" : "Create vendor"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update supplier contact and account details."
              : "Supply houses and accounts payable records."}
          </DialogDescription>
        </DialogHeader>
        <FieldGroup className="gap-4">
          <Field>
            <FieldLabel htmlFor="ven-name">Vendor name</FieldLabel>
            <Input id="ven-name" value={name} onChange={(change) => setName(change.target.value)} placeholder="Ferguson Supply" />
          </Field>
          <Field>
            <FieldLabel htmlFor="ven-cat">Category</FieldLabel>
            <Input id="ven-cat" value={category} onChange={(change) => setCategory(change.target.value)} placeholder="Plumbing supply" />
          </Field>
          <Field>
            <FieldLabel htmlFor="ven-contact">Contact</FieldLabel>
            <Input id="ven-contact" value={contact} onChange={(change) => setContact(change.target.value)} placeholder="Accounts receivable" />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="ven-email">Email</FieldLabel>
              <Input id="ven-email" value={email} onChange={(change) => setEmail(change.target.value)} placeholder="orders@vendor.com" />
            </Field>
            <Field>
              <FieldLabel htmlFor="ven-phone">Phone</FieldLabel>
              <AuthPhoneInput
                id="ven-phone"
                value={phone}
                onChange={setPhone}
                placeholder="(555) 123-4567"
              />
            </Field>
          </div>
        </FieldGroup>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button disabled={saving || !name.trim()} onClick={() => void save()}>
            {saving ? "Saving…" : isEdit ? "Save changes" : "Save and finish"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const REMINDER_STATUSES: CrmReminderStatus[] = ["open", "done"];
const TASK_PRIORITIES: CrmTaskPriority[] = ["low", "normal", "high", "urgent"];
const TASK_STATUSES: CrmTaskStatus[] = ["open", "in_progress", "blocked", "done"];

export function CreateReminderDialog({
  open,
  onOpenChange,
  subjectKind,
  subjectId,
  customerId,
  reminder,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subjectKind?: ReminderSubjectKind;
  subjectId?: string;
  customerId?: string;
  reminder?: PortalReminder | null;
  onCreated?: (reminder: PortalReminder) => void;
}) {
  const dispatch = useAppDispatch();
  const auth = useAppSelector(selectAuth);
  const user = useAppSelector(selectAuthUser);
  const useApi =
    auth.hydrated &&
    Boolean(auth.token) &&
    (user?.role === "provider" || auth.role === "provider");
  const { addReminder, provider } = useCrmDirectory();
  const { employees: crewEmployees } = usePortalCrew();
  const crm = useCrmApiData();
  const lookups = useReminderLookups();

  const resolveKind = (sk?: ReminderSubjectKind, r?: PortalReminder | null): ReminderSubjectKind => {
    if (r?.subjectKind && (CRM_TASK_SUBJECT_KINDS as readonly string[]).includes(r.subjectKind)) return r.subjectKind;
    if (r?.customerId) return "customer";
    if (sk && (CRM_TASK_SUBJECT_KINDS as readonly string[]).includes(sk)) return sk;
    return "customer";
  };

  const initialKind = resolveKind(subjectKind ?? (customerId ? "customer" : undefined), reminder);
  const initialId = reminder?.subjectId ?? reminder?.customerId ?? subjectId ?? customerId ?? "";

  const [kind, setKind] = useState<ReminderSubjectKind>(initialKind);
  const [selectedId, setSelectedId] = useState(initialId);
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [assignedEmployeeId, setAssignedEmployeeId] = useState("");
  const [status, setStatus] = useState<CrmReminderStatus>("open");
  const [saving, setSaving] = useState(false);
  const [lookupsLoading, setLookupsLoading] = useState(false);

  const recordPaging = usePaginatedCrmOptions(
    open && useApi ? kind : null,
    open && useApi,
  );
  const assigneePaging = usePaginatedCrmOptions(
    open && useApi ? "assignee" : null,
    open && useApi,
  );

  // Offline / demo: load snapshot once. API mode uses paginated dropdowns.
  useEffect(() => {
    if (!open || useApi || !crm.enabled) return;
    let cancelled = false;
    setLookupsLoading(true);
    void crm.ensureLoaded().finally(() => {
      if (!cancelled) setLookupsLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [open, useApi, crm.enabled, crm.ensureLoaded]);

  useEffect(() => {
    if (!open) return;
    if (reminder) {
      const nextKind = resolveKind(subjectKind, reminder);
      const nextId = reminder.subjectId ?? reminder.customerId ?? subjectId ?? "";
      setKind(nextKind);
      setSelectedId(nextId);
      setTitle(reminder.title ?? "");
      setNote(reminder.note ?? "");
      setDueAt(reminder.dueAt ? reminder.dueAt.slice(0, 10) : "");
      setAssignedEmployeeId(reminder.assignedEmployeeId ?? "");
      setStatus(reminder.status ?? "open");
      setSaving(false);
      return;
    }
    const nextKind = resolveKind(subjectKind ?? (customerId ? "customer" : undefined));
    const nextId = subjectId ?? customerId ?? "";
    setKind(nextKind);
    setSelectedId(nextId);
    setTitle("");
    setNote("");
    setDueAt("");
    setAssignedEmployeeId("");
    setStatus("open");
    setSaving(false);
  }, [open, reminder, subjectKind, subjectId, customerId]);

  const fallbackChoices = lookups.options(kind);
  const baseRecordOptions = useApi
    ? recordPaging.options
    : fallbackChoices.map((item) => ({ id: item.id, label: item.label }));

  const recordOptions = useMemo(() => {
    if (!selectedId) return baseRecordOptions;
    if (baseRecordOptions.some((opt) => opt.id === selectedId)) return baseRecordOptions;
    const fallbackLabel = lookups.label(kind, selectedId);
    return [
      { id: selectedId, label: fallbackLabel || `Selected ${reminderSubjectKindLabel(kind)}` },
      ...baseRecordOptions,
    ];
  }, [baseRecordOptions, selectedId, lookups, kind]);

  const assigneeOptions = useApi
    ? assigneePaging.options
    : crewEmployees.map((item) => ({ id: item.id, label: employeeName(item) }));

  function changeKind(next: ReminderSubjectKind) {
    setKind(next);
    setSelectedId("");
  }

  async function save() {
    if (saving) return;
    const linkedKind = kind;
    const linkedId = selectedId;
    if (!title.trim() || !linkedId) return;

    const payload: PortalReminder = {
      id: reminder?.id ?? `rem_${provider.id}_new_${Date.now()}`,
      subjectKind: linkedKind,
      subjectId: linkedId,
      customerId: linkedKind === "customer" ? linkedId : undefined,
      title: title.trim(),
      note: note.trim(),
      dueAt: dueAt || new Date().toISOString().slice(0, 10),
      assignedEmployeeId: assignedEmployeeId || undefined,
      status,
      createdAt: reminder?.createdAt ?? new Date().toISOString().slice(0, 10),
    };

    setSaving(true);
    try {
      let saved: PortalReminder;
      if (reminder?.id) {
        saved = await dispatch(updateReminderRecord({ id: reminder.id, reminder: payload })).unwrap();
      } else {
        saved = await dispatch(createReminderRecord(payload)).unwrap();
      }
      if (crm.enabled) void crm.refresh({ silent: true });
      onCreated?.(saved);
      toast.success(reminder?.id ? "Reminder updated." : `Reminder set on this ${reminderSubjectKindLabel(linkedKind).toLowerCase()}.`);
      onOpenChange(false);
    } catch (error) {
      toast.error(
        typeof error === "string"
          ? error
          : error instanceof Error
            ? error.message
            : "Could not save this reminder.",
      );
    } finally {
      setSaving(false);
    }
  }

  const linkedReady = Boolean(selectedId);
  const recordLoading = useApi
    ? recordPaging.loading && recordOptions.length === 0
    : lookupsLoading && recordOptions.length === 0;
  const assigneeLoading = useApi
    ? assigneePaging.loading && assigneeOptions.length === 0
    : lookupsLoading && assigneeOptions.length === 0;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (saving) return;
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-lg" data-lenis-prevent>
        <DialogHeader>
          <DialogTitle>{reminder ? "Edit reminder" : "Set reminder"}</DialogTitle>
          <DialogDescription>
            Link a follow-up to a customer, job, estimate, contractor, or vendor.
          </DialogDescription>
        </DialogHeader>
        <FieldGroup className="gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="rem-kind">Link to type</FieldLabel>
              <Select
                value={kind}
                onValueChange={(value) => changeKind(value as ReminderSubjectKind)}
              >
                <SelectTrigger id="rem-kind" className="w-full">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent
                  position="popper"
                  align="start"
                  className="z-[100] w-[var(--radix-select-trigger-width)]"
                >
                  {CRM_TASK_SUBJECT_KINDS.map((item) => (
                    <SelectItem key={item} value={item}>
                      {reminderSubjectKindLabel(item)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel htmlFor="rem-subject">Target {reminderSubjectKindLabel(kind)}</FieldLabel>
              <PaginatedEntitySelect
                id="rem-subject"
                value={selectedId}
                options={recordOptions}
                loading={recordLoading}
                loadingMore={useApi ? recordPaging.loadingMore : false}
                hasMore={useApi ? recordPaging.hasMore : false}
                onLoadMore={useApi ? recordPaging.loadMore : () => {}}
                onChange={(id) => setSelectedId(id)}
                placeholder={recordLoading ? `Loading ${reminderSubjectKindLabel(kind).toLowerCase()}s…` : `Select ${reminderSubjectKindLabel(kind).toLowerCase()}`}
                emptyLabel={`No ${reminderSubjectKindLabel(kind).toLowerCase()}s found`}
                disabled={recordLoading}
              />
            </Field>
          </div>

          <Field>
            <FieldLabel htmlFor="rem-title">Title</FieldLabel>
            <Input
              id="rem-title"
              value={title}
              onChange={(change) => setTitle(change.target.value)}
              placeholder="e.g. Follow up on estimate review"
            />
          </Field>
          <Field className="w-full">
            <FieldLabel htmlFor="rem-note">Note</FieldLabel>
            <Textarea
              id="rem-note"
              className="w-full min-h-24"
              value={note}
              onChange={(change) => setNote(change.target.value)}
              placeholder="Call back after the site visit or check status…"
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="rem-emp">Assigned</FieldLabel>
              <PaginatedEntitySelect
                id="rem-emp"
                value={assignedEmployeeId}
                options={assigneeOptions}
                loading={assigneeLoading}
                loadingMore={useApi ? assigneePaging.loadingMore : false}
                hasMore={useApi ? assigneePaging.hasMore : false}
                onLoadMore={useApi ? assigneePaging.loadMore : () => {}}
                onChange={(id) => setAssignedEmployeeId(id)}
                placeholder={assigneeLoading ? "Loading assignees…" : "Select assignee"}
                emptyLabel="No employees found"
                disabled={assigneeLoading}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="rem-status">Status</FieldLabel>
              <Select
                value={status}
                onValueChange={(value) => setStatus(value as CrmReminderStatus)}
              >
                <SelectTrigger id="rem-status" className="w-full">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent
                  position="popper"
                  align="start"
                  className="z-[100] w-[var(--radix-select-trigger-width)]"
                >
                  {REMINDER_STATUSES.map((item) => (
                    <SelectItem key={item} value={item}>
                      {crmReminderStatusLabel(item)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
          <Field>
            <FieldLabel htmlFor="rem-due">Due date</FieldLabel>
            <Input
              id="rem-due"
              type="date"
              min={todayISO()}
              value={dueAt}
              onChange={(change) => {
                const next = change.target.value;
                setDueAt(next && next < todayISO() ? todayISO() : next);
              }}
            />
          </Field>
        </FieldGroup>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button
            disabled={saving || !title.trim() || !linkedReady}
            onClick={() => void save()}
          >
            {saving ? (
              <>
                <Loader2 className="mr-1.5 size-4 animate-spin" />
                Saving…
              </>
            ) : reminder ? (
              "Save changes"
            ) : (
              "Save reminder"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function SetReminderButton({
  subjectKind,
  subjectId,
}: {
  subjectKind: ReminderSubjectKind;
  subjectId: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        Set reminder
      </Button>
      <CreateReminderDialog open={open} onOpenChange={setOpen} subjectKind={subjectKind} subjectId={subjectId} />
    </>
  );
}

export function CreateTaskDialog({
  open,
  onOpenChange,
  subjectKind,
  subjectId,
  task,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subjectKind?: ReminderSubjectKind;
  subjectId?: string;
  task?: PortalTask | null;
  onCreated?: (task: PortalTask) => void;
}) {
  const dispatch = useAppDispatch();
  const auth = useAppSelector(selectAuth);
  const user = useAppSelector(selectAuthUser);
  const useApi =
    auth.hydrated &&
    Boolean(auth.token) &&
    (user?.role === "provider" || auth.role === "provider");
  const { addTask, provider, tasks } = useCrmDirectory();
  const { employees: crewEmployees } = usePortalCrew();
  const crm = useCrmApiData();
  const lookups = useReminderLookups();

  const resolveKind = (sk?: ReminderSubjectKind, t?: PortalTask | null): ReminderSubjectKind => {
    if (t?.subjectKind && (CRM_TASK_SUBJECT_KINDS as readonly string[]).includes(t.subjectKind)) return t.subjectKind;
    if (t?.jobId) return "job";
    if (t?.customerId) return "customer";
    if (sk && (CRM_TASK_SUBJECT_KINDS as readonly string[]).includes(sk)) return sk;
    return "customer";
  };

  const [kind, setKind] = useState<ReminderSubjectKind>("customer");
  const [selectedId, setSelectedId] = useState("");
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [assignedEmployeeId, setAssignedEmployeeId] = useState("");
  const [priority, setPriority] = useState<CrmTaskPriority>("normal");
  const [status, setStatus] = useState<CrmTaskStatus>("open");
  const [dueAt, setDueAt] = useState("");
  const [saving, setSaving] = useState(false);
  const [lookupsLoading, setLookupsLoading] = useState(false);

  const recordPaging = usePaginatedCrmOptions(
    open && useApi ? kind : null,
    open && useApi,
  );
  const assigneePaging = usePaginatedCrmOptions(
    open && useApi ? "assignee" : null,
    open && useApi,
  );

  useEffect(() => {
    if (!open || useApi || !crm.enabled) return;
    let cancelled = false;
    setLookupsLoading(true);
    void crm.ensureLoaded().finally(() => {
      if (!cancelled) setLookupsLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [open, useApi, crm.enabled, crm.ensureLoaded]);

  useEffect(() => {
    if (!open) return;
    const nextKind = resolveKind(subjectKind, task);
    const nextId = task?.subjectId ?? task?.jobId ?? task?.customerId ?? subjectId ?? "";
    setKind(nextKind);
    setSelectedId(nextId);
    setTitle(task?.title ?? "");
    setNote(task?.note ?? "");
    setAssignedEmployeeId(
      task?.assignedEmployeeId ??
        (subjectKind === "employee" && subjectId ? subjectId : ""),
    );
    setPriority(task?.priority ?? "normal");
    setStatus(task?.status ?? "open");
    setDueAt(task?.dueAt ? task.dueAt.slice(0, 10) : "");
    setSaving(false);
  }, [open, task, subjectKind, subjectId]);

  const fallbackChoices = lookups.options(kind);
  const baseRecordOptions = useApi
    ? recordPaging.options
    : fallbackChoices.map((item) => ({ id: item.id, label: item.label }));

  const recordOptions = useMemo(() => {
    if (!selectedId) return baseRecordOptions;
    if (baseRecordOptions.some((opt) => opt.id === selectedId)) return baseRecordOptions;
    const fallbackLabel = lookups.label(kind, selectedId);
    return [
      { id: selectedId, label: fallbackLabel || `Selected ${reminderSubjectKindLabel(kind)}` },
      ...baseRecordOptions,
    ];
  }, [baseRecordOptions, selectedId, lookups, kind]);

  const assigneeOptions = useApi
    ? assigneePaging.options
    : crewEmployees.map((item) => ({ id: item.id, label: employeeName(item) }));

  function changeKind(next: ReminderSubjectKind) {
    setKind(next);
    setSelectedId("");
  }

  async function save() {
    if (saving) return;
    const linkedKind = kind;
    const linkedId = selectedId;
    if (!title.trim() || !linkedId) return;

    const payload: PortalTask = {
      id: task?.id ?? `task_${provider.id}_new_${Date.now()}`,
      number: task?.number ?? `TSK-${401 + tasks.length}`,
      title: title.trim(),
      note: note.trim(),
      jobId: linkedKind === "job" ? linkedId : undefined,
      subjectKind: linkedKind,
      subjectId: linkedId,
      customerId: linkedKind === "customer" ? linkedId : undefined,
      assignedEmployeeId: assignedEmployeeId || undefined,
      priority,
      status: status || task?.status || "open",
      dueAt: dueAt || new Date().toISOString().slice(0, 10),
      createdAt: task?.createdAt ?? new Date().toISOString().slice(0, 10),
    };

    setSaving(true);
    try {
      let saved: PortalTask;
      if (task?.id) {
        if (linkedKind === "customer" && linkedId) {
          saved = await dispatch(
            updateCustomerTask({ id: task.id, task: payload, customerId: linkedId }),
          ).unwrap();
          dispatch(upsertTaskItem(saved));
        } else {
          saved = await dispatch(updateTaskRecord({ id: task.id, task: payload })).unwrap();
          if (saved.customerId) {
            dispatch(upsertCustomerTask({ customerId: saved.customerId, item: saved }));
          }
        }
      } else {
        if (linkedKind === "customer" && linkedId) {
          saved = await dispatch(createCustomerTask(payload)).unwrap();
          dispatch(upsertTaskItem(saved));
        } else {
          saved = await dispatch(createTaskRecord(payload)).unwrap();
          if (saved.customerId) {
            dispatch(upsertCustomerTask({ customerId: saved.customerId, item: saved }));
          }
        }
      }
      if (crm.enabled) void crm.refresh({ silent: true });
      onCreated?.(saved);
      toast.success(
        task?.id
          ? `${saved.number || "Task"} updated.`
          : `${saved.number || "Task"} added on this ${reminderSubjectKindLabel(linkedKind).toLowerCase()}.`,
      );
      onOpenChange(false);
    } catch (error) {
      toast.error(
        typeof error === "string"
          ? error
          : error instanceof Error
            ? error.message
            : "Could not save this task.",
      );
    } finally {
      setSaving(false);
    }
  }

  const linkedReady = Boolean(selectedId);
  const recordLoading = useApi
    ? recordPaging.loading && recordOptions.length === 0
    : lookupsLoading && recordOptions.length === 0;
  const assigneeLoading = useApi
    ? assigneePaging.loading && assigneeOptions.length === 0
    : lookupsLoading && assigneeOptions.length === 0;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (saving) return;
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-lg" data-lenis-prevent>
        <DialogHeader>
          <DialogTitle>{task ? "Edit task" : "Create task"}</DialogTitle>
          <DialogDescription>
            Office or field work linked to a customer, job, estimate, contractor, or vendor.
          </DialogDescription>
        </DialogHeader>
        <FieldGroup className="gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="task-kind">Link to type</FieldLabel>
              <Select
                value={kind}
                onValueChange={(value) => changeKind(value as ReminderSubjectKind)}
              >
                <SelectTrigger id="task-kind" className="w-full">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent
                  position="popper"
                  align="start"
                  className="z-[100] w-[var(--radix-select-trigger-width)]"
                >
                  {CRM_TASK_SUBJECT_KINDS.map((item) => (
                    <SelectItem key={item} value={item}>
                      {reminderSubjectKindLabel(item)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel htmlFor="task-subject">Target {reminderSubjectKindLabel(kind)}</FieldLabel>
              <PaginatedEntitySelect
                id="task-subject"
                value={selectedId}
                options={recordOptions}
                loading={recordLoading}
                loadingMore={useApi ? recordPaging.loadingMore : false}
                hasMore={useApi ? recordPaging.hasMore : false}
                onLoadMore={useApi ? recordPaging.loadMore : () => {}}
                onChange={(id) => setSelectedId(id)}
                placeholder={recordLoading ? `Loading ${reminderSubjectKindLabel(kind).toLowerCase()}s…` : `Select ${reminderSubjectKindLabel(kind).toLowerCase()}`}
                emptyLabel={`No ${reminderSubjectKindLabel(kind).toLowerCase()}s found`}
                disabled={recordLoading}
              />
            </Field>
          </div>

          <Field>
            <FieldLabel htmlFor="task-title">Title</FieldLabel>
            <Input
              id="task-title"
              value={title}
              onChange={(change) => setTitle(change.target.value)}
              placeholder="e.g. Order parts, call customer, check unit…"
            />
          </Field>
          <Field className="w-full">
            <FieldLabel htmlFor="task-note">Notes</FieldLabel>
            <Textarea
              id="task-note"
              className="w-full min-h-24"
              value={note}
              onChange={(change) => setNote(change.target.value)}
              placeholder="What needs to be done and by when…"
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="task-emp">Assigned</FieldLabel>
              <PaginatedEntitySelect
                id="task-emp"
                value={assignedEmployeeId}
                options={assigneeOptions}
                loading={assigneeLoading}
                loadingMore={useApi ? assigneePaging.loadingMore : false}
                hasMore={useApi ? assigneePaging.hasMore : false}
                onLoadMore={useApi ? assigneePaging.loadMore : () => {}}
                onChange={(id) => setAssignedEmployeeId(id)}
                placeholder={assigneeLoading ? "Loading assignees…" : "Select assignee"}
                emptyLabel="No employees found"
                disabled={assigneeLoading}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="task-pri">Priority</FieldLabel>
              <Select
                value={priority}
                onValueChange={(value) => setPriority(value as CrmTaskPriority)}
              >
                <SelectTrigger id="task-pri" className="w-full">
                  <SelectValue placeholder="Select priority" />
                </SelectTrigger>
                <SelectContent
                  position="popper"
                  align="start"
                  className="z-[100] w-[var(--radix-select-trigger-width)]"
                >
                  {TASK_PRIORITIES.map((item) => (
                    <SelectItem key={item} value={item}>
                      {crmTaskPriorityLabel(item)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="task-status">Status</FieldLabel>
              <Select
                value={status}
                onValueChange={(value) => setStatus(value as CrmTaskStatus)}
              >
                <SelectTrigger id="task-status" className="w-full">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent
                  position="popper"
                  align="start"
                  className="z-[100] w-[var(--radix-select-trigger-width)]"
                >
                  {TASK_STATUSES.map((item) => (
                    <SelectItem key={item} value={item}>
                      {crmTaskStatusLabel(item)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel htmlFor="task-due">Due date</FieldLabel>
              <Input
                id="task-due"
                type="date"
                min={todayISO()}
                value={dueAt}
                onChange={(change) => {
                  const next = change.target.value;
                  setDueAt(next && next < todayISO() ? todayISO() : next);
                }}
              />
            </Field>
          </div>
        </FieldGroup>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button
            disabled={saving || !title.trim() || !linkedReady}
            onClick={() => void save()}
          >
            {saving ? (
              <>
                <Loader2 className="mr-1.5 size-4 animate-spin" />
                Saving…
              </>
            ) : task ? (
              "Save changes"
            ) : (
              "Save task"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function SetTaskButton({
  subjectKind,
  subjectId,
  onCreated,
}: {
  subjectKind: ReminderSubjectKind;
  subjectId: string;
  onCreated?: (task: PortalTask) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        Create task
      </Button>
      <CreateTaskDialog
        open={open}
        onOpenChange={setOpen}
        subjectKind={subjectKind}
        subjectId={subjectId}
        onCreated={onCreated}
      />
    </>
  );
}

export function CreateNoteDialog({
  open,
  onOpenChange,
  subjectKind,
  subjectId,
  customerId,
  note,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subjectKind?: ReminderSubjectKind;
  subjectId?: string;
  customerId?: string;
  note?: PortalNote | null;
}) {
  const kind = subjectKind ?? (customerId ? "customer" : "customer");
  const id = subjectId ?? customerId ?? "";
  const mappedNote = note
    ? {
        id: note.id,
        entityType: "",
        entityId: id,
        title: note.title,
        content: note.body,
        tags: [] as string[],
        isPinned: Boolean(note.pinned),
        color: null as string | null,
        attachments: [] as {
          url: string;
          filename: string;
          fileType: string;
          sizeBytes: number;
        }[],
        authorId: "",
        authorName: note.authorName,
        isDeleted: false,
        createdAt: note.createdAt,
        updatedAt: note.createdAt,
      }
    : null;

  return (
    <CreateUniversalNoteDialog
      open={open}
      onOpenChange={onOpenChange}
      subjectKind={kind}
      entityId={id}
      note={mappedNote}
    />
  );
}

export function AddNoteButton({
  subjectKind,
  subjectId,
}: {
  subjectKind: ReminderSubjectKind;
  subjectId: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        Add note
      </Button>
      <CreateNoteDialog
        open={open}
        onOpenChange={setOpen}
        subjectKind={subjectKind}
        subjectId={subjectId}
      />
    </>
  );
}
