"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { extractErrorMessage } from "@/components/api/apiFuntions";
import { AuthPhoneInput } from "@/components/auth/auth-phone-input";
import {
  AddressAutocomplete,
  type PlaceAddress,
} from "@/components/shared/address-autocomplete";
import { useCrmDirectory } from "@/components/portal/use-crm-directory";
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
import { useReminderLookups } from "@/components/portal/reminder-banner";
import type {
  CrmCustomerType,
  CrmEntityKind,
  CrmPersonSource,
  CrmTaskPriority,
  PortalContractor,
  PortalCustomerCrm,
  PortalNote,
  PortalReminder,
  PortalTask,
  PortalVendor,
  ReminderSubjectKind,
} from "@/lib/data/crm-people";
import {
  crmSourceLabel,
  crmTaskPriorityLabel,
  crmTypeLabel,
  REMINDER_SUBJECT_KINDS,
  reminderSubjectKindLabel,
} from "@/lib/data/crm-people";
import { todayISO } from "@/components/portal/work-builders";

const SOURCES: CrmPersonSource[] = ["external", "phone", "referral", "walk_in", "website"];
const TYPES: CrmCustomerType[] = ["residential", "commercial", "property_manager"];

export function CreateCustomerDialog({
  open,
  onOpenChange,
  customer = null,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customer?: PortalCustomerCrm | null;
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
        onOpenChange(false);
      } catch (error) {
        toast.error(extractErrorMessage(error) || "Could not update this customer.");
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
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { addContractor, provider, contractors } = useCrmDirectory();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [trade, setTrade] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [license, setLicense] = useState("");

  function save() {
    const contractor: PortalContractor = {
      id: `con_${provider.id}_new_${Date.now()}`,
      number: `VNDC-${220 + contractors.length}`,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      companyName: companyName.trim() || `${lastName.trim()} Contracting`,
      email: email.trim() || `${firstName.toLowerCase()}@contractor.local`,
      phone: phone.trim() || "(000) 000-0000",
      trade: trade.trim() || "General",
      license: license.trim() || "Pending",
      city: provider.city,
      state: provider.state,
      zip: provider.serviceArea[0] ?? "",
      status: "active",
      hourlyRate: 75,
      insuranceExpires: "2027-01-01",
      createdAt: new Date().toISOString().slice(0, 10),
    };
    addContractor(contractor);
    toast.success(`${contractor.companyName} added.`);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg" data-lenis-prevent>
        <DialogHeader>
          <DialogTitle>Create contractor</DialogTitle>
          <DialogDescription>Subcontractors and specialty trades used on jobs.</DialogDescription>
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
              <Input id="con-phone" value={phone} onChange={(change) => setPhone(change.target.value)} placeholder="(555) 123-4567" />
            </Field>
          </div>
          <Field>
            <FieldLabel htmlFor="con-lic">License</FieldLabel>
            <Input id="con-lic" value={license} onChange={(change) => setLicense(change.target.value)} placeholder="LIC-12345" />
          </Field>
        </FieldGroup>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={!firstName.trim() || !lastName.trim()} onClick={save}>
            Save and finish
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function CreateVendorDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { addVendor, provider, vendors } = useCrmDirectory();
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [contact, setContact] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  function save() {
    const vendor: PortalVendor = {
      id: `ven_${provider.id}_new_${Date.now()}`,
      number: `VND-${310 + vendors.length}`,
      name: name.trim(),
      category: category.trim() || "Supply",
      contact: contact.trim() || "Accounts",
      email: email.trim() || "orders@vendor.local",
      phone: phone.trim() || "(000) 000-0000",
      city: provider.city,
      state: provider.state,
      accountNumber: `ACC-${vendors.length + 1}`,
      terms: "Net 30",
      balance: 0,
      status: "active",
      createdAt: new Date().toISOString().slice(0, 10),
    };
    addVendor(vendor);
    toast.success(`${vendor.name} added.`);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg" data-lenis-prevent>
        <DialogHeader>
          <DialogTitle>Create vendor</DialogTitle>
          <DialogDescription>Supply houses and accounts payable records.</DialogDescription>
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
              <Input id="ven-phone" value={phone} onChange={(change) => setPhone(change.target.value)} placeholder="(555) 123-4567" />
            </Field>
          </div>
        </FieldGroup>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={!name.trim()} onClick={save}>
            Save and finish
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function CreateReminderDialog({
  open,
  onOpenChange,
  subjectKind,
  subjectId,
  customerId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subjectKind?: ReminderSubjectKind;
  subjectId?: string;
  customerId?: string;
}) {
  const { addReminder, employees, provider } = useCrmDirectory();
  const lookups = useReminderLookups();
  const lockedKind = subjectKind ?? (customerId ? "customer" : undefined);
  const lockedId = subjectId ?? customerId;
  const [kind, setKind] = useState<ReminderSubjectKind>(lockedKind ?? "customer");
  const records = lookups.options(kind);
  const [selectedId, setSelectedId] = useState(lockedId ?? records[0]?.id ?? "");
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [assignedEmployeeId, setAssignedEmployeeId] = useState(employees[0]?.id ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    const nextKind = lockedKind ?? "customer";
    const nextRecords = lookups.options(nextKind);
    setKind(nextKind);
    setSelectedId(lockedId ?? nextRecords[0]?.id ?? "");
    setTitle("");
    setNote("");
    setDueAt("");
    setAssignedEmployeeId(employees[0]?.id ?? "");
    setSaving(false);
    // Reset the form only when the dialog opens, not when lookup arrays refresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function changeKind(next: ReminderSubjectKind) {
    setKind(next);
    setSelectedId(lookups.options(next)[0]?.id ?? "");
  }

  async function save() {
    if (saving) return;
    const linkedKind = lockedKind ?? kind;
    const linkedId = lockedId ?? selectedId;
    if (!title.trim() || !linkedId) return;

    const reminder: PortalReminder = {
      id: `rem_${provider.id}_new_${Date.now()}`,
      subjectKind: linkedKind,
      subjectId: linkedId,
      customerId: linkedKind === "customer" ? linkedId : undefined,
      title: title.trim(),
      note: note.trim(),
      dueAt: dueAt || new Date().toISOString().slice(0, 10),
      assignedEmployeeId: assignedEmployeeId || undefined,
      status: "open",
      createdAt: new Date().toISOString().slice(0, 10),
    };

    setSaving(true);
    try {
      await Promise.resolve(addReminder(reminder));
      toast.success(`Reminder set on this ${reminderSubjectKindLabel(linkedKind).toLowerCase()}.`);
      onOpenChange(false);
    } catch (error) {
      toast.error(extractErrorMessage(error) || "Could not save this reminder.");
    } finally {
      setSaving(false);
    }
  }

  const choices = lookups.options(kind);
  const linkedReady = Boolean(lockedId ?? selectedId);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (saving) return;
        onOpenChange(next);
      }}
    >      <DialogContent className="sm:max-w-lg" data-lenis-prevent>
        <DialogHeader>
          <DialogTitle>Set reminder</DialogTitle>
          <DialogDescription>
            Link a follow-up to a customer, employee, contractor, vendor, estimate, lead, or job.
          </DialogDescription>
        </DialogHeader>
        <FieldGroup className="gap-4">
          {lockedKind && lockedId ? (
            <Field>
              <FieldLabel>Linked to</FieldLabel>
              <p className="text-sm font-medium">
                {reminderSubjectKindLabel(lockedKind)} · {lookups.label(lockedKind, lockedId)}
              </p>
            </Field>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="rem-kind">Type</FieldLabel>
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
                    {REMINDER_SUBJECT_KINDS.map((item) => (
                      <SelectItem key={item} value={item}>
                        {reminderSubjectKindLabel(item)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel htmlFor="rem-subject">Record</FieldLabel>
                <Select value={selectedId} onValueChange={setSelectedId}>
                  <SelectTrigger id="rem-subject" className="w-full">
                    <SelectValue placeholder="Select record" />
                  </SelectTrigger>
                  <SelectContent
                    position="popper"
                    align="start"
                    className="z-[100] w-[var(--radix-select-trigger-width)]"
                  >
                    {choices.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
          )}
          <Field>
            <FieldLabel htmlFor="rem-title">Title</FieldLabel>
            <Input id="rem-title" value={title} onChange={(change) => setTitle(change.target.value)} placeholder="Follow up on estimate" />
          </Field>
          <Field className="w-full">
            <FieldLabel htmlFor="rem-note">Note</FieldLabel>
            <Textarea
              id="rem-note"
              className="w-full min-h-24"
              value={note}
              onChange={(change) => setNote(change.target.value)}
              placeholder="Call back after the site visit…"
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="rem-due">Due</FieldLabel>
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
            <Field>
              <FieldLabel htmlFor="rem-emp">Assigned</FieldLabel>
              <Select value={assignedEmployeeId} onValueChange={setAssignedEmployeeId}>
                <SelectTrigger id="rem-emp" className="w-full">
                  <SelectValue placeholder="Select assignee" />
                </SelectTrigger>
                <SelectContent
                  position="popper"
                  align="start"
                  className="z-[100] w-[var(--radix-select-trigger-width)]"
                >
                  {employees.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.firstName} {item.lastName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
            {saving ? "Saving…" : "Save reminder"}
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

const TASK_PRIORITIES: CrmTaskPriority[] = ["low", "normal", "high", "urgent"];

export function CreateTaskDialog({
  open,
  onOpenChange,
  subjectKind,
  subjectId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subjectKind?: ReminderSubjectKind;
  subjectId?: string;
}) {
  const { addTask, employees, provider, tasks } = useCrmDirectory();
  const lookups = useReminderLookups();
  const [kind, setKind] = useState<ReminderSubjectKind>(subjectKind ?? "customer");
  const [selectedId, setSelectedId] = useState(subjectId ?? "");
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [assignedEmployeeId, setAssignedEmployeeId] = useState(employees[0]?.id ?? "");
  const [priority, setPriority] = useState<CrmTaskPriority>("normal");
  const [dueAt, setDueAt] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    const nextKind = subjectKind ?? "customer";
    setKind(nextKind);
    setSelectedId(subjectId ?? lookups.options(nextKind)[0]?.id ?? "");
    setTitle("");
    setNote("");
    setAssignedEmployeeId(employees[0]?.id ?? "");
    setPriority("normal");
    setDueAt("");
    setSaving(false);
    // Reset only when the dialog opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function changeKind(next: ReminderSubjectKind) {
    setKind(next);
    setSelectedId(lookups.options(next)[0]?.id ?? "");
  }

  async function save() {
    if (saving) return;
    const linkedKind = subjectKind ?? kind;
    const linkedId = subjectId ?? selectedId;
    if (!title.trim() || !linkedId) return;

    const task: PortalTask = {
      id: `task_${provider.id}_new_${Date.now()}`,
      number: `TSK-${401 + tasks.length}`,
      title: title.trim(),
      note: note.trim(),
      subjectKind: linkedKind,
      subjectId: linkedId,
      customerId: linkedKind === "customer" ? linkedId : undefined,
      assignedEmployeeId: assignedEmployeeId || undefined,
      priority,
      status: "open",
      dueAt: dueAt || new Date().toISOString().slice(0, 10),
      createdAt: new Date().toISOString().slice(0, 10),
    };

    setSaving(true);
    try {
      const created = await Promise.resolve(addTask(task));
      const saved = created ?? task;
      toast.success(
        `${saved.number} added on this ${reminderSubjectKindLabel(linkedKind).toLowerCase()}.`,
      );
      onOpenChange(false);
    } catch (error) {
      toast.error(extractErrorMessage(error) || "Could not save this task.");
    } finally {
      setSaving(false);
    }
  }

  const choices = lookups.options(kind);
  const locked = Boolean(subjectKind && subjectId);
  const linkedReady = Boolean(subjectId ?? selectedId);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (saving) return;
        onOpenChange(next);
      }}
    >      <DialogContent className="sm:max-w-lg" data-lenis-prevent>
        <DialogHeader>
          <DialogTitle>Create task</DialogTitle>
          <DialogDescription>
            Office or field work linked to a customer, lead, job, estimate, employee, contractor, or vendor.
          </DialogDescription>
        </DialogHeader>
        <FieldGroup className="gap-4">
          {locked ? (
            <Field>
              <FieldLabel>Linked to</FieldLabel>
              <p className="text-sm font-medium">
                {reminderSubjectKindLabel(subjectKind!)} · {lookups.label(subjectKind!, subjectId!)}
              </p>
            </Field>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="task-kind">Type</FieldLabel>
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
                    {REMINDER_SUBJECT_KINDS.map((item) => (
                      <SelectItem key={item} value={item}>
                        {reminderSubjectKindLabel(item)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel htmlFor="task-subject">Record</FieldLabel>
                <Select value={selectedId} onValueChange={setSelectedId}>
                  <SelectTrigger id="task-subject" className="w-full">
                    <SelectValue placeholder="Select record" />
                  </SelectTrigger>
                  <SelectContent
                    position="popper"
                    align="start"
                    className="z-[100] w-[var(--radix-select-trigger-width)]"
                  >
                    {choices.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
          )}
          <Field>
            <FieldLabel htmlFor="task-title">Title</FieldLabel>
            <Input id="task-title" value={title} onChange={(change) => setTitle(change.target.value)} placeholder="Order parts, call customer…" />
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
              <Select value={assignedEmployeeId} onValueChange={setAssignedEmployeeId}>
                <SelectTrigger id="task-emp" className="w-full">
                  <SelectValue placeholder="Select assignee" />
                </SelectTrigger>
                <SelectContent
                  position="popper"
                  align="start"
                  className="z-[100] w-[var(--radix-select-trigger-width)]"
                >
                  {employees.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.firstName} {item.lastName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
          <Field>
            <FieldLabel htmlFor="task-due">Due</FieldLabel>
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
        </FieldGroup>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button
            disabled={saving || !title.trim() || !linkedReady}
            onClick={() => void save()}
          >
            {saving ? "Saving…" : "Save task"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function SetTaskButton({
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
        Create task
      </Button>
      <CreateTaskDialog open={open} onOpenChange={setOpen} subjectKind={subjectKind} subjectId={subjectId} />
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
