import { nextRecordNumber } from "@/components/portal/work-builders";
import { CRM_EVENT, RECORDS_EVENT, readJson, splitName, writeJson } from "@/lib/booking/demo-stores";
import { getCrmCustomers, type PortalCustomerCrm } from "@/lib/data/crm-people";
import { getPortalRequests, type PortalRequest, type QuoteAnswer } from "@/lib/data/portal";
import { getAreaName } from "@/lib/data/service-areas";
import { getServiceCategoryById, getServiceCategoryBySlug } from "@/lib/data/services";
import type { Provider, RequestChannel, ServiceAddress } from "@/lib/types";

type RecordsStore = {
  deleted: string[];
  archived: string[];
  status: Record<string, string>;
  estimates: unknown[];
  jobs: unknown[];
  invoices: unknown[];
  payments: unknown[];
  invoicePatches: Record<string, unknown>;
  requests: PortalRequest[];
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
    tags: ["Residential", "Website request"],
    notes: "Created from a public service request.",
    amountOwing: 0,
  };
}

export function createWebsiteLead(input: {
  provider: Provider;
  name: string;
  email: string;
  phone?: string;
  zip: string;
  details: string;
  serviceSlug?: string;
  serviceName?: string;
  preferredDate?: string;
  preferredTime?: string;
  channel?: RequestChannel;
  answers?: QuoteAnswer[];
}) {
  const recordsKey = `rs-portal-records:${input.provider.email}`;
  const crmKey = `rs-crm-directory:${input.provider.email}`;
  const records = readJson<RecordsStore>(recordsKey, EMPTY_RECORDS);
  const directory = readJson<DirectoryStore>(crmKey, EMPTY_DIRECTORY);
  const seededRequests = getPortalRequests(input.provider);
  const seededCustomers = getCrmCustomers(input.provider);
  const allCustomers = [...seededCustomers, ...directory.customers];
  const allRequests = [...seededRequests, ...(records.requests ?? [])];
  const category =
    (input.serviceSlug ? getServiceCategoryBySlug(input.serviceSlug) : undefined) ??
    getServiceCategoryById(input.provider.categoryIds[0] ?? "") ??
    undefined;
  const categoryId = category?.id ?? input.provider.categoryIds[0] ?? "cat_plumbing";
  const categoryName = category?.name ?? "Home service";
  const serviceName = input.serviceName?.trim() || categoryName;
  const address: ServiceAddress = {
    id: `addr_${Date.now().toString(36)}`,
    street: "",
    city: input.provider.city,
    state: input.provider.state,
    zip: input.zip,
    country: "US",
  };

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

  const email = input.email.trim().toLowerCase();
  const existingRequest = allRequests.find(
    (item) =>
      item.customerEmail.toLowerCase() === email &&
      item.serviceName === serviceName &&
      (item.status === "new" || item.status === "viewed"),
  );
  if (existingRequest) {
    const updated: PortalRequest = {
      ...existingRequest,
      details: input.details.trim() || existingRequest.details,
      preferredDate: input.preferredDate || existingRequest.preferredDate,
      preferredTimeWindow: input.preferredTime || existingRequest.preferredTimeWindow,
      answers: input.answers?.length ? input.answers : existingRequest.answers,
      updatedAt: new Date().toISOString(),
    };
    const stored = records.requests ?? [];
    writeJson(
      recordsKey,
      {
        ...records,
        requests: stored.some((item) => item.id === existingRequest.id)
          ? stored.map((item) => (item.id === existingRequest.id ? updated : item))
          : [...stored, updated],
      },
      RECORDS_EVENT,
    );
    return { request: updated, customer: existingCustomer ?? customer };
  }

  const now = new Date().toISOString();
  const request: PortalRequest = {
    id: `req_web_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    number: nextRecordNumber(
      "RS",
      allRequests.map((item) => item.number),
    ),
    customerId: customer.id,
    providerId: input.provider.id,
    categoryId,
    channel: input.channel ?? "direct",
    zip: input.zip,
    city: input.provider.city,
    state: input.provider.state,
    details: input.details.trim(),
    preferredDate: input.preferredDate || undefined,
    preferredTimeWindow: input.preferredTime || undefined,
    photoUrls: [],
    status: "new",
    createdAt: now,
    updatedAt: now,
    customerName: `${customer.firstName} ${customer.lastName}`.trim(),
    customerEmail: customer.email,
    customerPhone: input.phone?.trim() || customer.phone || "",
    serviceName,
    categoryName,
    neighborhood: getAreaName(input.zip),
    answers: input.answers?.length ? input.answers : undefined,
  };

  if (!existingCustomer) {
    writeJson(crmKey, { ...directory, customers: [...directory.customers, customer] }, CRM_EVENT);
  }

  writeJson(
    recordsKey,
    {
      ...records,
      requests: [...(records.requests ?? []), request],
      status: { ...records.status, [`request:${request.id}`]: "new" },
    },
    RECORDS_EVENT,
  );

  return { request, customer };
}
