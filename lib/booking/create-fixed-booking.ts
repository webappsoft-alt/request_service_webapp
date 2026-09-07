import { nextRecordNumber } from "@/components/portal/work-builders";
import { getCrmCustomers, type PortalCustomerCrm } from "@/lib/data/crm-people";
import { getPortalJobs, type PortalFixedService } from "@/lib/data/portal";
import type { Job, JobItem, Provider, ServiceAddress } from "@/lib/types";

const RECORDS_EVENT = "rs-portal-records";
const CRM_EVENT = "rs-crm-directory";
const COST_EVENT = "rs-job-costing";

type RecordsStore = {
  deleted: string[];
  archived: string[];
  status: Record<string, string>;
  estimates: unknown[];
  jobs: Job[];
  invoices: unknown[];
  payments: unknown[];
  invoicePatches: Record<string, unknown>;
  requests: unknown[];
  requestPatches: Record<string, unknown>;
  services: unknown[];
  servicePatches: Record<string, unknown>;
  links: Record<string, string>;
};

type DirectoryStore = {
  customers: PortalCustomerCrm[];
  contractors: unknown[];
  vendors: unknown[];
  reminders: unknown[];
  tasks: unknown[];
  notes: unknown[];
  deleted: string[];
  contractorPatches: Record<string, unknown>;
  vendorPatches: Record<string, unknown>;
};

const EMPTY_RECORDS: RecordsStore = {
  deleted: [],
  archived: [],
  status: {},
  estimates: [],
  jobs: [],
  invoices: [],
  payments: [],
  invoicePatches: {},
  requests: [],
  requestPatches: {},
  services: [],
  servicePatches: {},
  links: {},
};

const EMPTY_DIRECTORY: DirectoryStore = {
  customers: [],
  contractors: [],
  vendors: [],
  reminders: [],
  tasks: [],
  notes: [],
  deleted: [],
  contractorPatches: {},
  vendorPatches: {},
};

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return { ...fallback, ...(JSON.parse(raw) as T) };
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown, event: string) {
  window.localStorage.setItem(key, JSON.stringify(value));
  window.dispatchEvent(new Event(event));
}

function splitName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] ?? "Customer",
    lastName: parts.slice(1).join(" ") || "Guest",
  };
}

function buildAddress(input: { street: string; city: string; state: string; zip: string }): ServiceAddress {
  return {
    id: `addr_${Date.now().toString(36)}`,
    street: input.street.trim(),
    city: input.city,
    state: input.state,
    zip: input.zip,
    country: "US",
  };
}

function buildCustomer(input: {
  name: string;
  email: string;
  phone?: string;
  address: ServiceAddress;
  existingNumbers: string[];
}): PortalCustomerCrm {
  const { firstName, lastName } = splitName(input.name);
  const now = new Date().toISOString();
  const id = `cust_web_${Date.now().toString(36)}`;
  return {
    id,
    userId: `user_${id}`,
    firstName,
    lastName,
    email: input.email.trim(),
    phone: input.phone?.trim() || undefined,
    addresses: [input.address],
    createdAt: now,
    updatedAt: now,
    customerNumber: String(1000100 + input.existingNumbers.length),
    entityKind: "individual",
    customerType: "residential",
    source: "website",
    doNotCall: false,
    taxCode: "TX-SALES",
    laborTaxCode: "TX-LABOR",
    creditLimit: 2500,
    onStop: false,
    membership: "none",
    tags: ["Residential", "Website booking"],
    notes: "Created from a public fixed-service booking.",
    amountOwing: 0,
  };
}

export function createFixedServiceBooking(input: {
  provider: Provider;
  service: PortalFixedService;
  name: string;
  email: string;
  phone?: string;
  street: string;
  zip: string;
  details: string;
  preferredDate?: string;
  preferredTime?: string;
}) {
  const recordsKey = `rs-portal-records:${input.provider.email}`;
  const crmKey = `rs-crm-directory:${input.provider.email}`;
  const costKey = `rs-job-costing:${input.provider.email}`;

  const records = readJson<RecordsStore>(recordsKey, EMPTY_RECORDS);
  const directory = readJson<DirectoryStore>(crmKey, EMPTY_DIRECTORY);
  const seededJobs = getPortalJobs(input.provider);
  const seededCustomers = getCrmCustomers(input.provider);
  const allCustomers = [...seededCustomers, ...directory.customers];
  const allJobs = [...seededJobs, ...records.jobs];

  const address = buildAddress({
    street: input.street,
    city: input.provider.city,
    state: input.provider.state,
    zip: input.zip,
  });

  const existingCustomer = allCustomers.find(
    (item) => item.email.toLowerCase() === input.email.trim().toLowerCase(),
  );
  const customer =
    existingCustomer ??
    buildCustomer({
      name: input.name,
      email: input.email,
      phone: input.phone,
      address,
      existingNumbers: allCustomers.map((item) => item.customerNumber),
    });

  const now = new Date().toISOString();
  const jobId = `job_web_${Date.now().toString(36)}`;
  const item: JobItem = {
    id: `${jobId}_svc`,
    jobId,
    source: "estimate",
    description: input.service.name,
    quantity: 1,
    unit: input.service.unit,
    unitPrice: input.service.price,
    total: input.service.price,
  };
  const scheduled = Boolean(input.preferredDate);
  const job: Job = {
    id: jobId,
    number: nextRecordNumber(
      "JOB",
      allJobs.map((item) => item.number),
    ),
    providerId: input.provider.id,
    customerId: customer.id,
    estimateId: "",
    serviceId: input.service.id,
    address,
    scheduledAt: input.preferredDate || undefined,
    status: scheduled ? "scheduled" : "unscheduled",
    notes: [
      "Booked online as a fixed service. No estimate — work can start.",
      input.preferredTime ? `Preferred time: ${input.preferredTime}.` : "",
      input.details.trim(),
      input.service.coverage.length ? `Covered: ${input.service.coverage.join("; ")}.` : "",
    ]
      .filter(Boolean)
      .join(" "),
    items: [item],
    changeOrders: [],
    createdAt: now,
    updatedAt: now,
  };

  if (!existingCustomer) {
    writeJson(crmKey, { ...directory, customers: [...directory.customers, customer] }, CRM_EVENT);
  }

  writeJson(
    recordsKey,
    {
      ...records,
      jobs: [...records.jobs, job],
      status: { ...records.status, [`job:${job.id}`]: job.status },
    },
    RECORDS_EVENT,
  );

  const costStore = readJson<Record<string, { id: string; description: string; kind: "labor" | "materials"; quantity: number; unit: string; unitPrice: number }[]>>(
    costKey,
    {},
  );
  writeJson(
    costKey,
    {
      ...costStore,
      [job.id]: [
        {
          id: item.id,
          description: item.description,
          kind: "labor",
          quantity: item.quantity,
          unit: item.unit,
          unitPrice: item.unitPrice,
        },
      ],
    },
    COST_EVENT,
  );

  return { job, customer };
}
