import {
  getPortalCustomers,
  getPortalEmployees,
  getPortalEstimates,
  getPortalInvoices,
  getPortalJobs,
  getPortalRequests,
  type PortalEmployee,
} from "@/lib/data/portal";
import type { Customer, Provider } from "@/lib/types";

export type CrmEntityKind = "company" | "individual";
export type CrmCustomerType = "residential" | "commercial" | "property_manager";
export type CrmPersonSource = "website" | "phone" | "referral" | "walk_in" | "external";
export type CrmMembership = "none" | "standard" | "priority";
export type CrmDirectoryStatus = "active" | "inactive" | "on_stop";
export type CrmReminderStatus = "open" | "done";
export type CrmTaskStatus = "open" | "in_progress" | "blocked" | "done";
export type CrmTaskPriority = "low" | "normal" | "high" | "urgent";

export type PortalCustomerCrm = Customer & {
  customerNumber: string;
  entityKind: CrmEntityKind;
  customerType: CrmCustomerType;
  source: CrmPersonSource;
  companyName?: string;
  ein?: string;
  website?: string;
  fax?: string;
  altPhone?: string;
  doNotCall: boolean;
  taxCode: string;
  laborTaxCode: string;
  creditLimit: number;
  onStop: boolean;
  membership: CrmMembership;
  preferredEmployeeId?: string;
  tags: string[];
  notes: string;
  amountOwing: number;
};

export type PortalContractor = {
  id: string;
  number: string;
  firstName: string;
  lastName: string;
  companyName: string;
  email: string;
  phone: string;
  trade: string;
  license: string;
  city: string;
  state: string;
  zip: string;
  status: CrmDirectoryStatus;
  hourlyRate: number;
  insuranceExpires: string;
  createdAt: string;
};

export type PortalVendor = {
  id: string;
  number: string;
  name: string;
  category: string;
  contact: string;
  email: string;
  phone: string;
  city: string;
  state: string;
  accountNumber: string;
  terms: string;
  balance: number;
  status: CrmDirectoryStatus;
  createdAt: string;
};

export type ReminderSubjectKind =
  | "customer"
  | "employee"
  | "contractor"
  | "vendor"
  | "estimate"
  | "request"
  | "job";

export const REMINDER_SUBJECT_KINDS: ReminderSubjectKind[] = [
  "customer",
  "employee",
  "contractor",
  "vendor",
  "estimate",
  "request",
  "job",
];

export type PortalReminder = {
  id: string;
  customerId?: string;
  subjectKind?: ReminderSubjectKind;
  subjectId?: string;
  title: string;
  note: string;
  dueAt: string;
  assignedEmployeeId?: string;
  status: CrmReminderStatus;
  createdAt: string;
};

export type PortalTask = {
  id: string;
  number: string;
  title: string;
  note: string;
  customerId?: string;
  subjectKind?: ReminderSubjectKind;
  subjectId?: string;
  assignedEmployeeId?: string;
  priority: CrmTaskPriority;
  status: CrmTaskStatus;
  dueAt: string;
  createdAt: string;
};

export type PortalNote = {
  id: string;
  customerId?: string;
  subjectKind?: ReminderSubjectKind;
  subjectId?: string;
  title: string;
  body: string;
  authorName: string;
  createdAt: string;
  pinned?: boolean;
};

const EXTRA_DIRECTORY: Array<{
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  entityKind: CrmEntityKind;
  customerType: CrmCustomerType;
  source: CrmPersonSource;
  companyName?: string;
  ein?: string;
  website?: string;
}> = [
  {
    firstName: "John",
    lastName: "Hale",
    email: "john.hale@newcollc.com",
    phone: "(303) 555-0140",
    entityKind: "company",
    customerType: "commercial",
    source: "external",
    companyName: "NEWCO LLC",
    ein: "84-2219044",
    website: "https://newcollc.com",
  },
  {
    firstName: "Elena",
    lastName: "Voss",
    email: "elena.voss@example.com",
    phone: "(303) 555-0172",
    entityKind: "individual",
    customerType: "residential",
    source: "phone",
  },
  {
    firstName: "Aisha",
    lastName: "Cole",
    email: "aisha.cole@ridgeviewapts.com",
    phone: "(720) 555-0188",
    entityKind: "company",
    customerType: "property_manager",
    source: "referral",
    companyName: "Ridgeview Apartments",
    ein: "47-1182201",
  },
  {
    firstName: "Tom",
    lastName: "Brennan",
    email: "tom.brennan@example.com",
    phone: "(720) 555-0133",
    entityKind: "individual",
    customerType: "residential",
    source: "walk_in",
  },
  {
    firstName: "Grace",
    lastName: "Patel",
    email: "grace.patel@westlineoffice.com",
    phone: "(303) 555-0194",
    entityKind: "company",
    customerType: "commercial",
    source: "external",
    companyName: "Westline Office Park",
    website: "https://westlineoffice.com",
  },
];

const CONTRACTORS: Array<Omit<PortalContractor, "id" | "number" | "city" | "state" | "zip">> = [
  {
    firstName: "Derek",
    lastName: "Molina",
    companyName: "Molina Tile Co.",
    email: "derek@molinatile.example",
    phone: "(303) 555-0401",
    trade: "Tile / stone",
    license: "CO-TL-44821",
    status: "active",
    hourlyRate: 85,
    insuranceExpires: "2027-03-12",
    createdAt: "2025-11-04",
  },
  {
    firstName: "Renee",
    lastName: "Park",
    companyName: "Park Insulation",
    email: "renee@parkinsulation.example",
    phone: "(720) 555-0418",
    trade: "Insulation",
    license: "CO-IN-19022",
    status: "active",
    hourlyRate: 72,
    insuranceExpires: "2026-12-01",
    createdAt: "2026-02-18",
  },
  {
    firstName: "Chris",
    lastName: "Dalton",
    companyName: "Dalton Drain",
    email: "chris@daltondrain.example",
    phone: "(303) 555-0430",
    trade: "Drain / camera",
    license: "CO-PL-77110",
    status: "inactive",
    hourlyRate: 110,
    insuranceExpires: "2026-08-20",
    createdAt: "2024-09-09",
  },
];

const VENDORS: Array<Omit<PortalVendor, "id" | "number" | "city" | "state">> = [
  {
    name: "Ferguson Enterprises",
    category: "Plumbing supply",
    contact: "Nate Cole",
    email: "nate.cole@ferguson.example",
    phone: "(303) 555-0601",
    accountNumber: "FEG-44019",
    terms: "Net 30",
    balance: 1840,
    status: "active",
    createdAt: "2024-03-02",
  },
  {
    name: "Johnstone Supply",
    category: "HVAC parts",
    contact: "Marisol Vega",
    email: "marisol.vega@johnstone.example",
    phone: "(720) 555-0614",
    accountNumber: "JST-8821",
    terms: "Net 15",
    balance: 620,
    status: "active",
    createdAt: "2025-01-16",
  },
  {
    name: "HD Supply",
    category: "Janitorial",
    contact: "Account desk",
    email: "accounts@hdsupply.example",
    phone: "(303) 555-0620",
    accountNumber: "HDS-11904",
    terms: "COD",
    balance: 0,
    status: "active",
    createdAt: "2025-08-28",
  },
];

function pad(value: number, size = 7) {
  return String(value).padStart(size, "0");
}

function displayName(customer: Pick<PortalCustomerCrm, "entityKind" | "companyName" | "firstName" | "lastName">) {
  if (customer.entityKind === "company" && customer.companyName) return customer.companyName;
  return `${customer.firstName} ${customer.lastName}`.trim();
}

export function crmCustomerName(customer: PortalCustomerCrm) {
  return displayName(customer);
}

export function crmSourceLabel(source: CrmPersonSource) {
  switch (source) {
    case "website":
      return "Website request";
    case "phone":
      return "Phone";
    case "referral":
      return "Referral";
    case "walk_in":
      return "Walk-in";
    case "external":
      return "External / office";
    default: {
      const _never: never = source;
      return _never;
    }
  }
}

export function crmTypeLabel(type: CrmCustomerType) {
  switch (type) {
    case "residential":
      return "Residential";
    case "commercial":
      return "Commercial";
    case "property_manager":
      return "Property manager";
    default: {
      const _never: never = type;
      return _never;
    }
  }
}

export function crmMembershipLabel(membership: CrmMembership) {
  switch (membership) {
    case "none":
      return "None";
    case "standard":
      return "Standard";
    case "priority":
      return "Priority";
    default: {
      const _never: never = membership;
      return _never;
    }
  }
}

export function contractorAsEmployee(contractor: PortalContractor): PortalEmployee {
  return {
    id: contractor.id,
    firstName: contractor.firstName,
    lastName: contractor.lastName || contractor.companyName,
    role: "technician",
    email: contractor.email,
    phone: contractor.phone,
    trade: contractor.trade,
    active: contractor.status === "active",
    hourlyRate: contractor.hourlyRate,
  };
}

export function vendorAsEmployee(vendor: PortalVendor): PortalEmployee {
  const [first = vendor.name, ...rest] = vendor.contact.split(" ");
  return {
    id: vendor.id,
    firstName: first,
    lastName: rest.join(" ") || vendor.name,
    role: "dispatcher",
    email: vendor.email,
    phone: vendor.phone,
    trade: vendor.category,
    active: vendor.status === "active",
  };
}

export function crmStatusLabel(status: CrmDirectoryStatus) {
  switch (status) {
    case "active":
      return "Active";
    case "inactive":
      return "Inactive";
    case "on_stop":
      return "On stop";
    default: {
      const _never: never = status;
      return _never;
    }
  }
}

export function reminderSubject(reminder: PortalReminder): { kind: ReminderSubjectKind; id: string } {
  if (reminder.subjectKind && reminder.subjectId) {
    return { kind: reminder.subjectKind, id: reminder.subjectId };
  }
  return { kind: "customer", id: reminder.customerId ?? "" };
}

export function reminderMatches(reminder: PortalReminder, kind: ReminderSubjectKind, id: string) {
  const subject = reminderSubject(reminder);
  return subject.kind === kind && subject.id === id;
}

export function openRemindersFor(reminders: PortalReminder[], kind: ReminderSubjectKind, id: string) {
  return reminders.filter((item) => item.status === "open" && reminderMatches(item, kind, id));
}

export function reminderIsOverdue(reminder: PortalReminder, today = new Date().toISOString().slice(0, 10)) {
  return reminder.status === "open" && reminder.dueAt < today;
}

export function taskSubject(task: PortalTask): { kind: ReminderSubjectKind; id: string } {
  if (task.subjectKind && task.subjectId) {
    return { kind: task.subjectKind, id: task.subjectId };
  }
  return { kind: "customer", id: task.customerId ?? "" };
}

export function taskMatches(task: PortalTask, kind: ReminderSubjectKind, id: string) {
  const subject = taskSubject(task);
  return subject.kind === kind && subject.id === id;
}

export function taskIsOpen(task: PortalTask) {
  return task.status === "open" || task.status === "in_progress" || task.status === "blocked";
}

export function openTasksFor(tasks: PortalTask[], kind: ReminderSubjectKind, id: string) {
  return tasks.filter((item) => taskIsOpen(item) && taskMatches(item, kind, id));
}

export function taskIsOverdue(task: PortalTask, today = new Date().toISOString().slice(0, 10)) {
  return taskIsOpen(task) && task.dueAt < today;
}

export function noteSubject(note: PortalNote): { kind: ReminderSubjectKind; id: string } {
  if (note.subjectKind && note.subjectId) {
    return { kind: note.subjectKind, id: note.subjectId };
  }
  return { kind: "customer", id: note.customerId ?? "" };
}

export function noteMatches(note: PortalNote, kind: ReminderSubjectKind, id: string) {
  const subject = noteSubject(note);
  return subject.kind === kind && subject.id === id;
}

export function notesFor(notes: PortalNote[], kind: ReminderSubjectKind, id: string) {
  return notes
    .filter((item) => noteMatches(item, kind, id))
    .slice()
    .sort((a, b) => {
      if (Boolean(a.pinned) !== Boolean(b.pinned)) return a.pinned ? -1 : 1;
      return a.createdAt < b.createdAt ? 1 : -1;
    });
}

export function noteTitle(note: PortalNote) {
  if (note.title?.trim()) return note.title.trim();
  const line = note.body.trim().split(/\n/)[0] ?? "";
  return line.slice(0, 48) || "Note";
}

export function reminderSubjectKindLabel(kind: ReminderSubjectKind) {
  switch (kind) {
    case "customer":
      return "Customer";
    case "employee":
      return "Employee";
    case "contractor":
      return "Contractor";
    case "vendor":
      return "Vendor";
    case "estimate":
      return "Estimate";
    case "request":
      return "Lead";
    case "job":
      return "Job";
    default: {
      const _never: never = kind;
      return _never;
    }
  }
}

export function reminderSubjectHref(kind: ReminderSubjectKind, id: string) {
  switch (kind) {
    case "customer":
      return `/pro/dashboard/customers/${id}`;
    case "employee":
      return `/pro/dashboard/team/${id}`;
    case "contractor":
      return `/pro/dashboard/contractors/${id}`;
    case "vendor":
      return `/pro/dashboard/vendors/${id}`;
    case "estimate":
      return `/pro/dashboard/estimates/${id}`;
    case "request":
      return `/pro/dashboard/requests/${id}`;
    case "job":
      return `/pro/dashboard/jobs/${id}`;
    default: {
      const _never: never = kind;
      return _never;
    }
  }
}

export function crmReminderStatusLabel(status: CrmReminderStatus) {
  switch (status) {
    case "open":
      return "Open";
    case "done":
      return "Done";
    default: {
      const _never: never = status;
      return _never;
    }
  }
}

export function crmTaskStatusLabel(status: CrmTaskStatus) {
  switch (status) {
    case "open":
      return "Open";
    case "in_progress":
      return "In progress";
    case "blocked":
      return "Blocked";
    case "done":
      return "Done";
    default: {
      const _never: never = status;
      return _never;
    }
  }
}

export function crmTaskPriorityLabel(priority: CrmTaskPriority) {
  switch (priority) {
    case "low":
      return "Low";
    case "normal":
      return "Normal";
    case "high":
      return "High";
    case "urgent":
      return "Urgent";
    default: {
      const _never: never = priority;
      return _never;
    }
  }
}

function enrichCustomer(
  customer: Customer,
  index: number,
  owing: number,
  preferredEmployeeId?: string,
  override?: Partial<PortalCustomerCrm>,
): PortalCustomerCrm {
  const company = index % 5 === 0;
  return {
    ...customer,
    customerNumber: pad(1000001 + index),
    entityKind: company ? "company" : "individual",
    customerType: company ? "commercial" : "residential",
    source: index % 4 === 0 ? "website" : index % 3 === 0 ? "phone" : "external",
    companyName: company ? `${customer.lastName} Holdings` : undefined,
    ein: company ? `84-${2000000 + index}` : undefined,
    website: company ? `https://${customer.lastName.toLowerCase()}holdings.example` : undefined,
    fax: company ? customer.phone : undefined,
    altPhone: index % 2 === 0 ? "(720) 555-2000" : undefined,
    doNotCall: index % 7 === 0,
    taxCode: "CO-SALES",
    laborTaxCode: "CO-LABOR",
    creditLimit: company ? 15000 : 2500,
    onStop: owing > 4000,
    membership: index % 6 === 0 ? "priority" : index % 3 === 0 ? "standard" : "none",
    preferredEmployeeId,
    tags: company ? ["Commercial", "Net 30"] : ["Residential"],
    notes: company
      ? "Office-created account. Billing contact prefers email statements."
      : "Household account. Confirm gate code before arrival.",
    amountOwing: owing,
    ...override,
  };
}

export function getCrmCustomers(provider: Provider): PortalCustomerCrm[] {
  const base = getPortalCustomers(provider);
  const invoices = getPortalInvoices(provider);
  const employees = getPortalEmployees(provider);
  const field = employees.find((item) => item.role === "technician") ?? employees[0];

  const fromBoard = base.map((customer, index) => {
    const owing = invoices
      .filter((invoice) => invoice.customerId === customer.id)
      .reduce((sum, invoice) => sum + invoice.balanceDue, 0);
    return enrichCustomer(customer, index, owing, field?.id);
  });

  const extras = EXTRA_DIRECTORY.map((person, index) => {
    const zip = provider.serviceArea[index % provider.serviceArea.length];
    const id = `cust_${provider.id}_ext${index + 1}`;
    const createdAt = `2026-0${(index % 6) + 1}-1${index % 8}`;
    return enrichCustomer(
      {
        id,
        userId: `user_${provider.id}_ext${index + 1}`,
        firstName: person.firstName,
        lastName: person.lastName,
        email: person.email,
        phone: person.phone,
        addresses: [
          {
            id: `addr_${id}`,
            street: `${400 + index * 12} Market St`,
            city: provider.city,
            state: provider.state,
            zip,
            country: "US",
          },
        ],
        createdAt,
        updatedAt: createdAt,
      },
      fromBoard.length + index,
      index === 0 ? 8743.25 : index === 2 ? 1260 : 0,
      field?.id,
      {
        entityKind: person.entityKind,
        customerType: person.customerType,
        source: person.source,
        companyName: person.companyName,
        ein: person.ein,
        website: person.website,
        tags:
          person.customerType === "property_manager"
            ? ["Multifamily", "Preferred"]
            : person.entityKind === "company"
              ? ["Commercial", "External"]
              : ["Residential", "Office"],
      },
    );
  });

  return [...fromBoard, ...extras];
}

export function getPortalContractors(provider: Provider): PortalContractor[] {
  return CONTRACTORS.map((item, index) => ({
    ...item,
    id: `con_${provider.id}_${index + 1}`,
    number: `VNDC-${220 + index}`,
    city: provider.city,
    state: provider.state,
    zip: provider.serviceArea[index % provider.serviceArea.length],
  }));
}

export function getPortalVendors(provider: Provider): PortalVendor[] {
  return VENDORS.map((item, index) => ({
    ...item,
    id: `ven_${provider.id}_${index + 1}`,
    number: `VND-${310 + index}`,
    city: provider.city,
    state: provider.state,
  }));
}

export function getPortalReminders(provider: Provider): PortalReminder[] {
  const customers = getCrmCustomers(provider);
  const employees = getPortalEmployees(provider);
  const contractors = getPortalContractors(provider);
  const vendors = getPortalVendors(provider);
  const estimates = getPortalEstimates(provider);
  const jobs = getPortalJobs(provider);
  const requests = getPortalRequests(provider);
  const tech = employees.find((item) => item.role === "technician") ?? employees[0];
  const picks = [customers[0], customers.find((item) => item.amountOwing > 0), customers[customers.length - 1]].filter(
    (item): item is PortalCustomerCrm => Boolean(item),
  );
  const customerId = (index: number) => picks[index]?.id ?? customers[0]?.id ?? "";

  const reminders: PortalReminder[] = [
    {
      id: `rem_${provider.id}_1`,
      customerId: customerId(0),
      subjectKind: "customer",
      subjectId: customerId(0),
      title: "Call before next visit",
      note: "Confirm access and whether pets will be crated.",
      dueAt: "2026-09-03",
      assignedEmployeeId: tech?.id,
      status: "open",
      createdAt: "2026-08-28",
    },
    {
      id: `rem_${provider.id}_2`,
      customerId: customerId(1),
      subjectKind: "customer",
      subjectId: customerId(1),
      title: "Collect past-due balance",
      note: "Send statement and offer card-on-file.",
      dueAt: "2026-09-02",
      assignedEmployeeId: employees[0]?.id,
      status: "open",
      createdAt: "2026-08-26",
    },
    {
      id: `rem_${provider.id}_3`,
      customerId: customerId(2),
      subjectKind: "customer",
      subjectId: customerId(2),
      title: "Seasonal maintenance offer",
      note: "Follow up after the last completed job.",
      dueAt: "2026-09-12",
      assignedEmployeeId: tech?.id,
      status: "done",
      createdAt: "2026-08-10",
    },
  ];

  if (employees[0]) {
    reminders.push({
      id: `rem_${provider.id}_emp`,
      subjectKind: "employee",
      subjectId: employees[0].id,
      title: "Confirm Saturday overtime",
      note: "Need a yes/no before we publish the weekend board.",
      dueAt: "2026-09-01",
      assignedEmployeeId: employees[0].id,
      status: "open",
      createdAt: "2026-08-27",
    });
  }
  if (contractors[0]) {
    reminders.push({
      id: `rem_${provider.id}_con`,
      subjectKind: "contractor",
      subjectId: contractors[0].id,
      title: "Verify insurance certificate",
      note: "Do not send them to a customer site until the cert is on file.",
      dueAt: "2026-09-05",
      assignedEmployeeId: employees[0]?.id,
      status: "open",
      createdAt: "2026-08-25",
    });
  }
  if (vendors[0]) {
    reminders.push({
      id: `rem_${provider.id}_ven`,
      subjectKind: "vendor",
      subjectId: vendors[0].id,
      title: "Confirm heater stock before Friday",
      note: "50-gal units are at reorder. Call the counter before we promise a swap.",
      dueAt: "2026-09-03",
      assignedEmployeeId: tech?.id,
      status: "open",
      createdAt: "2026-08-29",
    });
  }
  if (estimates[0]) {
    reminders.push({
      id: `rem_${provider.id}_est`,
      subjectKind: "estimate",
      subjectId: estimates[0].id,
      title: "Follow up on unsigned quote",
      note: "Customer asked for a day to review. Call if it is still sitting.",
      dueAt: "2026-09-04",
      assignedEmployeeId: employees[0]?.id,
      status: "open",
      createdAt: "2026-08-30",
    });
  }
  if (requests[0]) {
    reminders.push({
      id: `rem_${provider.id}_lead`,
      subjectKind: "request",
      subjectId: requests[0].id,
      title: "Call the lead back",
      note: "They asked for a morning window. Confirm we can be there.",
      dueAt: "2026-09-02",
      assignedEmployeeId: tech?.id,
      status: "open",
      createdAt: "2026-08-31",
    });
  }
  if (jobs[0]) {
    reminders.push({
      id: `rem_${provider.id}_job`,
      subjectKind: "job",
      subjectId: jobs[0].id,
      title: "Bring extra fittings",
      note: "Last visit ran short on 3/4 copper. Pull from Ferguson if shop is light.",
      dueAt: "2026-09-01",
      assignedEmployeeId: tech?.id,
      status: "open",
      createdAt: "2026-08-28",
    });
  }

  return reminders;
}

export function getPortalTasks(provider: Provider): PortalTask[] {
  const customers = getCrmCustomers(provider);
  const employees = getPortalEmployees(provider);
  const contractors = getPortalContractors(provider);
  const vendors = getPortalVendors(provider);
  const estimates = getPortalEstimates(provider);
  const jobs = getPortalJobs(provider);
  const requests = getPortalRequests(provider);
  const tech = employees.find((item) => item.role === "technician") ?? employees[0];
  const owner = employees[0];
  const companyId = customers.find((item) => item.entityKind === "company")?.id ?? customers[0]?.id ?? "";

  const tasks: PortalTask[] = [
    {
      id: `task_${provider.id}_1`,
      number: "TSK-401",
      title: "Pull permit for commercial panel",
      note: "City desk closes at 3. Bring the signed estimate.",
      customerId: companyId,
      subjectKind: "customer",
      subjectId: companyId,
      assignedEmployeeId: owner?.id,
      priority: "high",
      status: "open",
      dueAt: "2026-09-04",
      createdAt: "2026-08-29",
    },
    {
      id: `task_${provider.id}_2`,
      number: "TSK-402",
      title: "Order parts for Friday jobs",
      note: "Check Ferguson and Johnstone before noon.",
      assignedEmployeeId: tech?.id,
      subjectKind: vendors[0] ? "vendor" : "customer",
      subjectId: vendors[0]?.id ?? companyId,
      priority: "normal",
      status: "in_progress",
      dueAt: "2026-09-03",
      createdAt: "2026-08-30",
    },
    {
      id: `task_${provider.id}_3`,
      number: "TSK-403",
      title: "Photo walkthrough after punch list",
      note: "Upload to the job file before invoicing.",
      customerId: customers[0]?.id,
      subjectKind: jobs[0] ? "job" : "customer",
      subjectId: jobs[0]?.id ?? customers[0]?.id,
      assignedEmployeeId: tech?.id,
      priority: "urgent",
      status: "blocked",
      dueAt: "2026-09-02",
      createdAt: "2026-08-27",
    },
    {
      id: `task_${provider.id}_4`,
      number: "TSK-404",
      title: "Send thank-you after completed clean",
      note: "Ask for a review if they were happy.",
      customerId: customers[1]?.id ?? customers[0]?.id,
      subjectKind: "customer",
      subjectId: customers[1]?.id ?? customers[0]?.id,
      assignedEmployeeId: owner?.id,
      priority: "low",
      status: "done",
      dueAt: "2026-08-25",
      createdAt: "2026-08-22",
    },
  ];

  if (requests[0]) {
    tasks.push({
      id: `task_${provider.id}_lead`,
      number: "TSK-405",
      title: "Qualify the inbound lead",
      note: "Confirm the leak location and whether they can be home in the morning.",
      subjectKind: "request",
      subjectId: requests[0].id,
      assignedEmployeeId: owner?.id,
      priority: "high",
      status: "open",
      dueAt: "2026-09-02",
      createdAt: "2026-08-31",
    });
  }
  if (estimates[0]) {
    tasks.push({
      id: `task_${provider.id}_est`,
      number: "TSK-406",
      title: "Price the remaining line items",
      note: "Office still needs fittings and permit on this quote before we send it.",
      subjectKind: "estimate",
      subjectId: estimates[0].id,
      assignedEmployeeId: owner?.id,
      priority: "normal",
      status: "in_progress",
      dueAt: "2026-09-03",
      createdAt: "2026-08-30",
    });
  }
  if (contractors[0]) {
    tasks.push({
      id: `task_${provider.id}_con`,
      number: "TSK-407",
      title: "Send the scope to the contractor",
      note: "They need photos and access notes before they confirm a start.",
      subjectKind: "contractor",
      subjectId: contractors[0].id,
      assignedEmployeeId: owner?.id,
      priority: "high",
      status: "open",
      dueAt: "2026-09-04",
      createdAt: "2026-08-28",
    });
  }
  if (employees[0]) {
    tasks.push({
      id: `task_${provider.id}_emp`,
      number: "TSK-408",
      title: "Collect last week's timesheet",
      note: "Needed before payroll closes Friday.",
      subjectKind: "employee",
      subjectId: employees[0].id,
      assignedEmployeeId: employees[0].id,
      priority: "normal",
      status: "open",
      dueAt: "2026-09-04",
      createdAt: "2026-08-29",
    });
  }

  return tasks;
}

export function getPortalNotes(provider: Provider): PortalNote[] {
  const customers = getCrmCustomers(provider);
  const employees = getPortalEmployees(provider);
  const contractors = getPortalContractors(provider);
  const vendors = getPortalVendors(provider);
  const estimates = getPortalEstimates(provider);
  const jobs = getPortalJobs(provider);
  const requests = getPortalRequests(provider);
  const owner = employees[0];
  const tech = employees.find((item) => item.role === "technician") ?? owner;
  const author = (employee?: { firstName: string; lastName: string }) =>
    employee ? `${employee.firstName} ${employee.lastName}` : "Office";

  const customerNotes = customers.flatMap((customer, index) => {
    if (index > 4 && customer.notes) {
      return [
        {
          id: `note_${provider.id}_${customer.id}_account`,
          customerId: customer.id,
          subjectKind: "customer" as const,
          subjectId: customer.id,
          title: "Account note",
          body: customer.notes,
          authorName: author(owner),
          createdAt: customer.createdAt,
        },
      ];
    }
    if (index > 4) return [];
    return [
      {
        id: `note_${provider.id}_${customer.id}_1`,
        customerId: customer.id,
        subjectKind: "customer" as const,
        subjectId: customer.id,
        title: "Household access",
        body: customer.notes || "Household account. Confirm access before the visit.",
        authorName: author(owner),
        createdAt: customer.createdAt,
        pinned: index === 0,
      },
      {
        id: `note_${provider.id}_${customer.id}_2`,
        customerId: customer.id,
        subjectKind: "customer" as const,
        subjectId: customer.id,
        title: index % 2 === 0 ? "Arrival preference" : "Billing contact",
        body:
          index % 2 === 0
            ? "Prefers morning windows. Park on the street and text on arrival."
            : "Billing contact asked for emailed statements and a copy of the signed estimate.",
        authorName: author(tech),
        createdAt: "2026-08-21",
      },
      ...(index === 0
        ? [
            {
              id: `note_${provider.id}_${customer.id}_3`,
              customerId: customer.id,
              subjectKind: "customer" as const,
              subjectId: customer.id,
              title: "Gate and dog",
              body: "Gate code is 4412. Dog will be crated if we call 10 minutes out.",
              authorName: author(tech),
              createdAt: "2026-08-18",
            },
          ]
        : []),
    ];
  });

  const extras: PortalNote[] = [];
  if (employees[0]) {
    extras.push({
      id: `note_${provider.id}_employee_${employees[0].id}`,
      subjectKind: "employee",
      subjectId: employees[0].id,
      title: "License packet",
      body: "Keep a current copy of the license and insurance card in the attachments tab.",
      authorName: author(owner),
      createdAt: "2026-08-20",
      pinned: true,
    });
  }
  if (contractors[0]) {
    extras.push({
      id: `note_${provider.id}_contractor_${contractors[0].id}`,
      subjectKind: "contractor",
      subjectId: contractors[0].id,
      title: "Insurance follow-up",
      body: "Ask for the renewal certificate before the next shared job.",
      authorName: author(owner),
      createdAt: "2026-08-19",
    });
  }
  if (vendors[0]) {
    extras.push({
      id: `note_${provider.id}_vendor_${vendors[0].id}`,
      subjectKind: "vendor",
      subjectId: vendors[0].id,
      title: "Reorder terms",
      body: "Net 30 holds if we stay above the monthly minimum. Call before placing a rush order.",
      authorName: author(tech),
      createdAt: "2026-08-17",
    });
  }
  if (requests[0]) {
    extras.push({
      id: `note_${provider.id}_lead_${requests[0].id}`,
      subjectKind: "request",
      subjectId: requests[0].id,
      title: "Qualify before estimate",
      body: "Confirm access and photos before we write the first number.",
      authorName: author(owner),
      createdAt: requests[0].createdAt,
    });
  }
  if (estimates[0]) {
    extras.push({
      id: `note_${provider.id}_estimate_${estimates[0].id}`,
      subjectKind: "estimate",
      subjectId: estimates[0].id,
      title: "Scope change",
      body: "Homeowner asked to price the upgraded equipment as an alternate.",
      authorName: author(tech),
      createdAt: estimates[0].issuedAt,
    });
  }
  if (jobs[0]) {
    extras.push({
      id: `note_${provider.id}_job_${jobs[0].id}`,
      subjectKind: "job",
      subjectId: jobs[0].id,
      title: "Site condition",
      body: "Panel is in the garage. Leave the driveway clear after 3.",
      authorName: author(tech),
      createdAt: jobs[0].createdAt,
      pinned: true,
    });
  }

  return [...customerNotes, ...extras];
}
