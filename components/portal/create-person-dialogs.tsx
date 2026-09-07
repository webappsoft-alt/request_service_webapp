"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useCrmDirectory } from "@/components/portal/use-crm-directory";
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
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
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

const SOURCES: CrmPersonSource[] = ["external", "phone", "referral", "walk_in", "website"];
const TYPES: CrmCustomerType[] = ["residential", "commercial", "property_manager"];

export function CreateCustomerDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { addCustomer, provider, customers } = useCrmDirectory();
  const [entityKind, setEntityKind] = useState<CrmEntityKind>("individual");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [street, setStreet] = useState("");
  const [city, setCity] = useState(provider.city);
  const [state, setState] = useState(provider.state);
  const [zip, setZip] = useState(provider.serviceArea[0] ?? "");
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
    setCity(provider.city);
    setState(provider.state);
    setZip(provider.serviceArea[0] ?? "");
    setCustomerType("residential");
    setSource("external");
    setEin("");
    setWebsite("");
    setNotes("");
  }

  function save() {
    const id = `cust_${provider.id}_new_${Date.now()}`;
    const createdAt = new Date().toISOString().slice(0, 10);
    const customer: PortalCustomerCrm = {
      id,
      userId: `user_${id}`,
      firstName: firstName.trim() || companyName.trim() || "New",
      lastName: lastName.trim() || "Customer",
      email: email.trim() || `${id}@office.local`,
      phone: phone.trim() || undefined,
      addresses: [
        {
          id: `addr_${id}`,
          street: street.trim() || "Address pending",
          city: city.trim() || provider.city,
          state: state.trim() || provider.state,
          zip: zip.trim() || provider.serviceArea[0] || "00000",
          country: "US",
        },
      ],
      createdAt,
      updatedAt: createdAt,
      customerNumber: String(1000001 + customers.length).padStart(7, "0"),
      entityKind,
      customerType,
      source,
      companyName: entityKind === "company" ? companyName.trim() : undefined,
      ein: ein.trim() || undefined,
      website: website.trim() || undefined,
      doNotCall: false,
      taxCode: "CO-SALES",
      laborTaxCode: "CO-LABOR",
      creditLimit: entityKind === "company" ? 10000 : 1500,
      onStop: false,
      membership: "none",
      tags: [source === "website" ? "Website" : "Office"],
      notes: notes.trim(),
      amountOwing: 0,
    };
    addCustomer(customer);
    toast.success(`${customer.companyName ?? `${customer.firstName} ${customer.lastName}`} added to the directory.`);
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
          <DialogTitle>Create customer</DialogTitle>
          <DialogDescription>
            Add a household, company, or walk-in that did not come through the website request form.
          </DialogDescription>
        </DialogHeader>
        <FieldGroup className="gap-4">
          <div className="flex gap-4 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="entity"
                checked={entityKind === "individual"}
                onChange={() => setEntityKind("individual")}
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
              <Input id="cust-company" value={companyName} onChange={(change) => setCompanyName(change.target.value)} />
            </Field>
          ) : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="cust-first">First name</FieldLabel>
              <Input id="cust-first" value={firstName} onChange={(change) => setFirstName(change.target.value)} />
            </Field>
            <Field>
              <FieldLabel htmlFor="cust-last">Last name</FieldLabel>
              <Input id="cust-last" value={lastName} onChange={(change) => setLastName(change.target.value)} />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="cust-email">Email</FieldLabel>
              <Input id="cust-email" type="email" value={email} onChange={(change) => setEmail(change.target.value)} />
            </Field>
            <Field>
              <FieldLabel htmlFor="cust-phone">Phone</FieldLabel>
              <Input id="cust-phone" type="tel" value={phone} onChange={(change) => setPhone(change.target.value)} />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="cust-type">Customer type</FieldLabel>
              <NativeSelect
                id="cust-type"
                className="w-full"
                value={customerType}
                onChange={(change) => setCustomerType(change.target.value as CrmCustomerType)}
              >
                {TYPES.map((item) => (
                  <NativeSelectOption key={item} value={item}>
                    {crmTypeLabel(item)}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </Field>
            <Field>
              <FieldLabel htmlFor="cust-source">Source</FieldLabel>
              <NativeSelect
                id="cust-source"
                className="w-full"
                value={source}
                onChange={(change) => setSource(change.target.value as CrmPersonSource)}
              >
                {SOURCES.map((item) => (
                  <NativeSelectOption key={item} value={item}>
                    {crmSourceLabel(item)}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="cust-ein">EIN</FieldLabel>
              <Input id="cust-ein" value={ein} onChange={(change) => setEin(change.target.value)} />
            </Field>
            <Field>
              <FieldLabel htmlFor="cust-web">Website</FieldLabel>
              <Input id="cust-web" value={website} onChange={(change) => setWebsite(change.target.value)} />
            </Field>
          </div>
          <Field>
            <FieldLabel htmlFor="cust-street">Street address</FieldLabel>
            <Input id="cust-street" value={street} onChange={(change) => setStreet(change.target.value)} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field>
              <FieldLabel htmlFor="cust-city">City</FieldLabel>
              <Input id="cust-city" value={city} onChange={(change) => setCity(change.target.value)} />
            </Field>
            <Field>
              <FieldLabel htmlFor="cust-state">State</FieldLabel>
              <Input id="cust-state" value={state} onChange={(change) => setState(change.target.value)} />
            </Field>
            <Field>
              <FieldLabel htmlFor="cust-zip">ZIP</FieldLabel>
              <Input id="cust-zip" value={zip} onChange={(change) => setZip(change.target.value)} />
            </Field>
          </div>
          <Field>
            <FieldLabel htmlFor="cust-notes">Notes</FieldLabel>
            <Textarea id="cust-notes" value={notes} onChange={(change) => setNotes(change.target.value)} />
          </Field>
        </FieldGroup>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={!firstName.trim() && !companyName.trim()} onClick={save}>
            Save and finish
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
              <Input id="con-first" value={firstName} onChange={(change) => setFirstName(change.target.value)} />
            </Field>
            <Field>
              <FieldLabel htmlFor="con-last">Last name</FieldLabel>
              <Input id="con-last" value={lastName} onChange={(change) => setLastName(change.target.value)} />
            </Field>
          </div>
          <Field>
            <FieldLabel htmlFor="con-co">Company</FieldLabel>
            <Input id="con-co" value={companyName} onChange={(change) => setCompanyName(change.target.value)} />
          </Field>
          <Field>
            <FieldLabel htmlFor="con-trade">Trade</FieldLabel>
            <Input id="con-trade" value={trade} onChange={(change) => setTrade(change.target.value)} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="con-email">Email</FieldLabel>
              <Input id="con-email" value={email} onChange={(change) => setEmail(change.target.value)} />
            </Field>
            <Field>
              <FieldLabel htmlFor="con-phone">Phone</FieldLabel>
              <Input id="con-phone" value={phone} onChange={(change) => setPhone(change.target.value)} />
            </Field>
          </div>
          <Field>
            <FieldLabel htmlFor="con-lic">License</FieldLabel>
            <Input id="con-lic" value={license} onChange={(change) => setLicense(change.target.value)} />
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
            <Input id="ven-name" value={name} onChange={(change) => setName(change.target.value)} />
          </Field>
          <Field>
            <FieldLabel htmlFor="ven-cat">Category</FieldLabel>
            <Input id="ven-cat" value={category} onChange={(change) => setCategory(change.target.value)} />
          </Field>
          <Field>
            <FieldLabel htmlFor="ven-contact">Contact</FieldLabel>
            <Input id="ven-contact" value={contact} onChange={(change) => setContact(change.target.value)} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="ven-email">Email</FieldLabel>
              <Input id="ven-email" value={email} onChange={(change) => setEmail(change.target.value)} />
            </Field>
            <Field>
              <FieldLabel htmlFor="ven-phone">Phone</FieldLabel>
              <Input id="ven-phone" value={phone} onChange={(change) => setPhone(change.target.value)} />
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
    // Reset the form only when the dialog opens, not when lookup arrays refresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function changeKind(next: ReminderSubjectKind) {
    setKind(next);
    setSelectedId(lookups.options(next)[0]?.id ?? "");
  }

  function save() {
    const linkedKind = lockedKind ?? kind;
    const linkedId = lockedId ?? selectedId;
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
    addReminder(reminder);
    toast.success(`Reminder set on this ${reminderSubjectKindLabel(linkedKind).toLowerCase()}.`);
    onOpenChange(false);
  }

  const choices = lookups.options(kind);
  const linkedReady = Boolean(lockedId ?? selectedId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg" data-lenis-prevent>
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
                <NativeSelect
                  id="rem-kind"
                  className="w-full"
                  value={kind}
                  onChange={(change) => changeKind(change.target.value as ReminderSubjectKind)}
                >
                  {REMINDER_SUBJECT_KINDS.map((item) => (
                    <NativeSelectOption key={item} value={item}>
                      {reminderSubjectKindLabel(item)}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </Field>
              <Field>
                <FieldLabel htmlFor="rem-subject">Record</FieldLabel>
                <NativeSelect
                  id="rem-subject"
                  className="w-full"
                  value={selectedId}
                  onChange={(change) => setSelectedId(change.target.value)}
                >
                  {choices.map((item) => (
                    <NativeSelectOption key={item.id} value={item.id}>
                      {item.label}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </Field>
            </div>
          )}
          <Field>
            <FieldLabel htmlFor="rem-title">Title</FieldLabel>
            <Input id="rem-title" value={title} onChange={(change) => setTitle(change.target.value)} />
          </Field>
          <Field>
            <FieldLabel htmlFor="rem-note">Note</FieldLabel>
            <Textarea id="rem-note" value={note} onChange={(change) => setNote(change.target.value)} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="rem-due">Due</FieldLabel>
              <Input id="rem-due" type="date" value={dueAt} onChange={(change) => setDueAt(change.target.value)} />
            </Field>
            <Field>
              <FieldLabel htmlFor="rem-emp">Assigned</FieldLabel>
              <NativeSelect
                id="rem-emp"
                className="w-full"
                value={assignedEmployeeId}
                onChange={(change) => setAssignedEmployeeId(change.target.value)}
              >
                {employees.map((item) => (
                  <NativeSelectOption key={item.id} value={item.id}>
                    {item.firstName} {item.lastName}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </Field>
          </div>
        </FieldGroup>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={!title.trim() || !linkedReady} onClick={save}>
            Save reminder
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
    // Reset only when the dialog opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function changeKind(next: ReminderSubjectKind) {
    setKind(next);
    setSelectedId(lookups.options(next)[0]?.id ?? "");
  }

  function save() {
    const linkedKind = subjectKind ?? kind;
    const linkedId = subjectId ?? selectedId;
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
    addTask(task);
    toast.success(`${task.number} added on this ${reminderSubjectKindLabel(linkedKind).toLowerCase()}.`);
    onOpenChange(false);
  }

  const choices = lookups.options(kind);
  const locked = Boolean(subjectKind && subjectId);
  const linkedReady = Boolean(subjectId ?? selectedId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg" data-lenis-prevent>
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
                <NativeSelect
                  id="task-kind"
                  className="w-full"
                  value={kind}
                  onChange={(change) => changeKind(change.target.value as ReminderSubjectKind)}
                >
                  {REMINDER_SUBJECT_KINDS.map((item) => (
                    <NativeSelectOption key={item} value={item}>
                      {reminderSubjectKindLabel(item)}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </Field>
              <Field>
                <FieldLabel htmlFor="task-subject">Record</FieldLabel>
                <NativeSelect
                  id="task-subject"
                  className="w-full"
                  value={selectedId}
                  onChange={(change) => setSelectedId(change.target.value)}
                >
                  {choices.map((item) => (
                    <NativeSelectOption key={item.id} value={item.id}>
                      {item.label}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </Field>
            </div>
          )}
          <Field>
            <FieldLabel htmlFor="task-title">Title</FieldLabel>
            <Input id="task-title" value={title} onChange={(change) => setTitle(change.target.value)} />
          </Field>
          <Field>
            <FieldLabel htmlFor="task-note">Notes</FieldLabel>
            <Textarea id="task-note" value={note} onChange={(change) => setNote(change.target.value)} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="task-emp">Assigned</FieldLabel>
              <NativeSelect
                id="task-emp"
                className="w-full"
                value={assignedEmployeeId}
                onChange={(change) => setAssignedEmployeeId(change.target.value)}
              >
                {employees.map((item) => (
                  <NativeSelectOption key={item.id} value={item.id}>
                    {item.firstName} {item.lastName}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </Field>
            <Field>
              <FieldLabel htmlFor="task-pri">Priority</FieldLabel>
              <NativeSelect
                id="task-pri"
                className="w-full"
                value={priority}
                onChange={(change) => setPriority(change.target.value as CrmTaskPriority)}
              >
                {TASK_PRIORITIES.map((item) => (
                  <NativeSelectOption key={item} value={item}>
                    {crmTaskPriorityLabel(item)}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </Field>
          </div>
          <Field>
            <FieldLabel htmlFor="task-due">Due</FieldLabel>
            <Input id="task-due" type="date" value={dueAt} onChange={(change) => setDueAt(change.target.value)} />
          </Field>
        </FieldGroup>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={!title.trim() || !linkedReady} onClick={save}>
            Save task
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
  const { addNote, updateNote } = useCrmDirectory();
  const { session } = usePortalWorkspace();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const kind = subjectKind ?? (customerId ? "customer" : "customer");
  const id = subjectId ?? customerId ?? "";
  const author = [session?.firstName, session?.lastName].filter(Boolean).join(" ") || "Office";
  const label = reminderSubjectKindLabel(kind).toLowerCase();

  useEffect(() => {
    if (!open) return;
    setTitle(note?.title ?? "");
    setBody(note?.body ?? "");
  }, [note, open]);

  function save() {
    if (note) {
      updateNote(note.id, { title: title.trim() || "Note", body: body.trim() });
      toast.success("Note updated.");
      onOpenChange(false);
      return;
    }
    const next: PortalNote = {
      id: `note_new_${Date.now()}`,
      subjectKind: kind,
      subjectId: id,
      customerId: kind === "customer" ? id : undefined,
      title: title.trim() || "Note",
      body: body.trim(),
      authorName: author,
      createdAt: new Date().toISOString().slice(0, 10),
    };
    addNote(next);
    toast.success(`Note added to this ${label}.`);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg" data-lenis-prevent>
        <DialogHeader>
          <DialogTitle>{note ? "Edit note" : "Add note"}</DialogTitle>
          <DialogDescription>
            {note
              ? `Update the office note on this ${label}.`
              : `A short office note on this ${label}. It stays on the file.`}
          </DialogDescription>
        </DialogHeader>
        <FieldGroup className="gap-4">
          <Field>
            <FieldLabel htmlFor="file-note-title">Title</FieldLabel>
            <Input
              id="file-note-title"
              value={title}
              onChange={(change) => setTitle(change.target.value)}
              placeholder="Access, billing, follow-up…"
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="file-note-body">Note</FieldLabel>
            <Textarea
              id="file-note-body"
              value={body}
              onChange={(change) => setBody(change.target.value)}
              rows={5}
              placeholder="Gate code, billing preference, access…"
            />
          </Field>
        </FieldGroup>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={!title.trim() && !body.trim()} onClick={save}>
            {note ? "Save changes" : "Save note"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
      <CreateNoteDialog open={open} onOpenChange={setOpen} subjectKind={subjectKind} subjectId={subjectId} />
    </>
  );
}
