import { providerCrmApi, publicApi } from "@/components/api/ApiRoutesFile";
import { getData, postData, putData, patchData, deleteData, invalidateGetCache } from "@/components/api/apiFuntions";
import type {
  PortalContractor,
  PortalCustomerCrm,
  PortalReminder,
  PortalTask,
  PortalVendor,
} from "@/lib/data/crm-people";
import { employeeName, type PortalCalendarEvent, type PortalEmployee, type PortalEmployeeDetail, type PortalEventKind, type PortalRequest, type PortalTimeWindow, type PortalEmployeeWorkingHours } from "@/lib/data/portal";
import type { Estimate, EstimateActivity, EstimateStatus, Invoice, Job, Payment, ServiceAddress } from "@/lib/types";
import {
  crmIdOf,
  mapChatThread,
  mapCrmEntity,
  mapCrmList,
  mapEmployeeDetail,
  mapEstimate,
  mapEstimateActivity,
  mapInboxSummary,
  mapInvoice,
  mapInvoiceWithPayments,
  mapJob,
  mapPayment,
  mapPortalContractor,
  mapPortalCustomerCrm,
  mapPortalEmployee,
  mapPortalReminder,
  mapPortalRequest,
  mapPortalTask,
  mapPortalVendor,
  mapScheduleEvent,
  type CrmInboxSummary,
} from "@/lib/api/crm-mappers";
import type { ChatThread } from "@/lib/booking/chat-store";

type CrmRequestOptions = {
  silent?: boolean;
  force?: boolean;
};

export type ConvertToEstimateInput = {
  title?: string;
  notes?: string;
  terms?: string;
  discount?: number;
  unitPrice?: number;
  items?: Array<{
    description: string;
    kind?: "labor" | "material" | "service";
    quantity?: number;
    unitPrice?: number;
    taxRate?: number;
  }>;
};

export type TrackLeadInput = {
  providerId?: string;
  providerSlug?: string;
  fixedServiceId?: string;
  fixedServiceSlug?: string;
  source:
    | "profile_view"
    | "fixed_service_view"
    | "quote_request"
    | "direct_message"
    | string;
  customerName?: string;
  customerEmail?: string;
  phone?: string;
  zip?: string;
  city?: string;
  state?: string;
  details?: string;
};



export type CrmSnapshot = {
  customers: PortalCustomerCrm[];
  employees: PortalEmployee[];
  contractors: PortalContractor[];
  vendors: PortalVendor[];
  requests: PortalRequest[];
  estimates: Estimate[];
  jobs: Job[];
  tasks: PortalTask[];
  reminders: PortalReminder[];
  invoices: Invoice[];
  payments: Payment[];
  schedule: ReturnType<typeof mapScheduleEvent>[];
  chats: ChatThread[];
  inboxSummary: CrmInboxSummary;
};

export type CrmScheduleStatus =
  | "scheduled"
  | "confirmed"
  | "in_progress"
  | "completed"
  | "cancelled";

export type CrmScheduleAssignment = {
  recordId?: string | null;
  kind: PortalEventKind;
  title: string;
  date: string;
  endDate?: string | null;
  startMinutes: number;
  endMinutes: number;
  timeWindow: PortalTimeWindow | "custom";
  employeeId?: string | null;
  contractorId?: string | null;
  status?: CrmScheduleStatus;
};

export type CrmEstimateShareResult = {
  estimateId: string;
  shareToken: string;
  shareUrl: string;
  absoluteShareUrl?: string;
  status: string;
  emailSent?: boolean;
  emailTo?: string | null;
  emailSkippedReason?: string | null;
  emailError?: string | null;
};

const DEFAULT_LIST_LIMIT = 10;

function normalizePreferredTimeWindow(value?: string) {
  const raw = String(value || "").trim().toLowerCase();
  if (raw.startsWith("after")) return "afternoon";
  if (raw.startsWith("eve")) return "afternoon";
  if (raw.startsWith("all")) return "all_day";
  if (raw.startsWith("flex")) return "all_day";
  return "morning";
}

function normalizeStatus<T extends string>(
  value: string | undefined,
  allowed: readonly T[],
  fallback: T,
): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

function mapAddressForApi(address?: ServiceAddress | null) {
  return address
    ? {
        label: address.label || "Primary",
        street: address.street,
        unit: address.unit || "",
        city: address.city,
        state: address.state,
        zip: address.zip,
      }
    : undefined;
}

function estimateItemsToApi(items: Estimate["items"], minQuantity = 0.01) {
  return items
    .filter((item) => String(item.description || "").trim())
    .map((item) => {
      const quantity = Math.max(minQuantity, Number(item.quantity) || 1);
      const unitPrice = Math.max(0, Number(item.unitPrice) || 0);
      const taxRate = Math.max(0, Number(item.taxRate) || 0);
      return {
        id: item.id,
        description: String(item.description).trim(),
        kind: item.type === "materials" ? "material" : "labor",
        unit: item.unit || (item.type === "labor" ? "hr" : "ea"),
        quantity,
        unitPrice,
        taxRate,
        total: Number(item.total) || quantity * unitPrice,
      };
    });
}

function jobItemsToApi(items: Job["items"]) {
  return items.map((item) => ({
    id: item.id,
    description: item.description,
    kind: item.source === "change_order" ? "material" : /labor/i.test(item.description) ? "labor" : "material",
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    taxRate: 0,
    total: item.total,
  }));
}

function invoiceItemsToApi(items: Invoice["items"]) {
  return items.map((item) => ({
    id: item.id,
    description: item.description,
    kind:
      item.source === "change_order"
        ? "fee"
        : item.source === "adjustment"
          ? "discount"
          : /material/i.test(item.description)
            ? "material"
            : "labor",
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    taxRate: 0,
    total: item.total,
  }));
}

function resolveAssignedEmployeeIds(job: Job, employees: PortalEmployee[]) {
  if (!job.assignedTo) return [];
  const normalized = job.assignedTo.trim().toLowerCase();
  return employees
    .filter((employee) => employeeName(employee).trim().toLowerCase() === normalized)
    .map((employee) => employee.id);
}

function customerPayload(customer: PortalCustomerCrm) {
  return {
    entityKind: customer.entityKind,
    customerType: customer.customerType,
    firstName: customer.firstName,
    lastName: customer.lastName,
    companyName: customer.companyName || "",
    email: customer.email,
    phone: customer.phone || "",
    altPhone: customer.altPhone || "",
    source: customer.source,
    creditLimit: customer.creditLimit,
    onStop: customer.onStop,
    membership: customer.membership,
    taxCode: customer.taxCode,
    notes: customer.notes,
    linkedUserId: customer.userId.startsWith("user_") ? null : customer.userId,
    serviceAddresses: customer.addresses.map((address) => mapAddressForApi(address)).filter(Boolean),
  };
}

function employeePayload(employee: PortalEmployee) {
  const firstName = employee.firstName || "";
  const lastName = employee.lastName || "";
  const name = [firstName, lastName].filter(Boolean).join(" ");
  return {
    name,
    firstName,
    lastName,
    email: employee.email || "",
    phone: employee.phone || "",
    role: employee.role || "technician",
    active: employee.active ?? true,
    hourlyRate: employee.hourlyRate ?? 0,
  };
}

function contractorPayload(contractor: PortalContractor | Partial<PortalContractor>) {
  return {
    firstName: contractor.firstName || "",
    lastName: contractor.lastName || "",
    companyName: contractor.companyName || "",
    contactName: [contractor.firstName, contractor.lastName].filter(Boolean).join(" "),
    trade: contractor.trade || "",
    email: contractor.email || "",
    phone: contractor.phone || "",
    city: contractor.city || "",
    state: contractor.state || "",
    zip: contractor.zip || "",
    trade: contractor.trade || "",
    license: contractor.license || "",
    status: contractor.status || "active",
    hourlyRate: contractor.hourlyRate ?? 0,
    license: contractor.license || "",
    city: contractor.city || "",
    state: contractor.state || "",
    zip: contractor.zip || "",
    insuranceExpires: contractor.insuranceExpires || new Date().toISOString(),
  };
}

function vendorPayload(vendor: PortalVendor | Partial<PortalVendor>) {
  return {
    companyName: vendor.name || "",
    name: vendor.name || "",
    contact: vendor.contact || "",
    contactName: vendor.contact || "",
    name: vendor.name || "",
    category: vendor.category || "",
    contact: vendor.contact || "",
    email: vendor.email || "",
    terms: vendor.terms || "Net 30",
  };
}

function requestPayload(request: Partial<PortalRequest>) {
  const payload: Record<string, unknown> = {
    customerId: request.customerId,
    serviceName: request.serviceName || "Service Inquiry",
    channel: request.channel === "marketplace" ? "marketplace" : "direct",
    details: request.details || "",
    preferredTimeWindow: request.preferredTimeWindow || "morning",
    photos: request.photos ?? request.photoUrls ?? [],
  };
  if (request.preferredDate && request.preferredDate.trim()) {
    payload.preferredDate = request.preferredDate;
  }
  return payload;
}

function siteVisitPayload(visit?: Estimate["siteVisit"]) {
  if (!visit) return undefined;
  return {
    employeeId: visit.employeeId || "",
    technician: visit.technician || "",
    visitedAt: visit.visitedAt || "",
    accessNotes: visit.accessNotes || "",
    findings: visit.findings || "",
    recommendations: visit.recommendations || "",
    measurements: visit.measurements || "",
    photos: (visit.photos ?? []).map((photo) => ({
      id: photo.id,
      name: photo.name,
      type: photo.type,
      size: photo.size,
      url: photo.url,
      addedAt: photo.addedAt,
      actor: photo.actor || "",
    })),
  };
}

function estimateAttachmentsToApi(attachments?: unknown[]): { name: string; attachment: string }[] {
  if (!Array.isArray(attachments)) return [];
  return attachments
    .map((item, index) => {
      if (typeof item === "string" && item.trim()) {
        const url = item.trim();
        const name = url.split("/").pop() || `Attachment ${index + 1}`;
        return { name, attachment: url };
      }
      if (item && typeof item === "object") {
        const record = item as Record<string, unknown>;
        const url = String(record.attachment || record.dataUrl || record.url || "").trim();
        if (!url) return null;
        const name = String(record.name || "").trim() || url.split("/").pop() || `Attachment ${index + 1}`;
        return { name, attachment: url };
      }
      return null;
    })
    .filter((entry): entry is { name: string; attachment: string } => Boolean(entry));
}

function estimatePayload(estimate: Estimate) {
  return {
    customerId: estimate.customerId,
    requestId: estimate.requestId || null,
    title: estimate.title || "",
    status: normalizeStatus(estimate.status, [
      "site_visit",
      "inspected",
      "draft",
      "finalized",
      "sent",
      "accepted",
      "rejected",
      "expired",
      "changes_requested",
    ] as const, "draft"),
    issuedAt: estimate.issuedAt,
    expiresAt: estimate.expiresAt || undefined,
    items: estimateItemsToApi(estimate.items),
    discount: estimate.discount,
    notes: estimate.notes || "",
    terms: estimate.terms || "",
    propertyAddress: mapAddressForApi(estimate.propertyAddress),
    siteVisit: siteVisitPayload(estimate.siteVisit),
    attachments: estimateAttachmentsToApi(estimate.attachments as unknown[]),
  };
}

function jobPayload(job: Job, employees: PortalEmployee[]) {
  return {
    customerId: job.customerId,
    estimateId: job.estimateId || null,
    title: job.title || "",
    status: job.status,
    assignedEmployees: resolveAssignedEmployeeIds(job, employees),
    assignedContractors: [],
    scheduledAt: job.scheduledAt || null,
    dueAt: job.dueAt || null,
    notes: job.notes || "",
    items: jobItemsToApi(job.items),
    attachments: [],
  };
}

function reminderPayload(reminder: PortalReminder) {
  return {
    customerId: reminder.customerId || null,
    subjectKind: reminder.subjectKind || "customer",
    subjectId: reminder.subjectId || null,
    assignedEmployeeId: reminder.assignedEmployeeId || null,
    title: reminder.title,
    note: reminder.note || "",
    dueAt: reminder.dueAt,
    status: reminder.status,
  };
}

function taskPayload(task: PortalTask) {
  const subjectKind = normalizeStatus(task.subjectKind, [
    "job",
    "customer",
    "estimate",
    "contractor",
    "vendor",
  ] as const, "customer");
  return {
    customerId: task.customerId || null,
    subjectKind,
    subjectId: task.subjectId || null,
    assignedEmployeeId: task.assignedEmployeeId || null,
    title: task.title,
    note: task.note || "",
    priority: task.priority,
    status: task.status,
    dueAt: task.dueAt || null,
  };
}

function invoicePayload(invoice: Invoice) {
  return {
    customerId: invoice.customerId,
    jobId: invoice.jobId || null,
    status: invoice.status,
    issuedAt: invoice.issuedAt,
    dueAt: invoice.dueAt || undefined,
    items: invoiceItemsToApi(invoice.items),
    discount: invoice.discount,
    notes: "",
    terms: "",
  };
}

async function listMapped<T>(
  endpoint: string,
  mapper: (value: unknown) => T | null,
  options: CrmRequestOptions = {},
) {
  const response = await getData(endpoint, { page: 1, limit: DEFAULT_LIST_LIMIT }, {
    silent: options.silent ?? true,
  });
  return mapCrmList(response, mapper).items;
}

export type CrmListQuery = {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  customerId?: string;
  trade?: string;
  role?: string;
  active?: boolean;
  category?: string;
  assignedEmployeeId?: string;
  subjectKind?: string;
  silent?: boolean;
  force?: boolean;
};

function buildListParams(query: CrmListQuery, defaultLimit = DEFAULT_LIST_LIMIT) {
  const page = Math.max(1, query.page ?? 1);
  const limit = Math.max(1, query.limit ?? defaultLimit);
  const params: Record<string, string | number | boolean> = { page, limit };
  const search = query.search?.trim();
  const status = query.status?.trim();
  const customerId = query.customerId?.trim();
  const trade = query.trade?.trim();
  const role = query.role?.trim();
  const category = query.category?.trim();
  const assignedEmployeeId = query.assignedEmployeeId?.trim();
  const subjectKind = query.subjectKind?.trim();
  if (search) params.search = search;
  if (status) params.status = status;
  if (customerId) params.customerId = customerId;
  if (trade) params.trade = trade;
  if (role) params.role = role;
  if (category) params.category = category;
  if (assignedEmployeeId) params.assignedEmployeeId = assignedEmployeeId;
  if (subjectKind) params.subjectKind = subjectKind;
  if (typeof query.active === "boolean") params.active = query.active;
  return params;
}

export async function listCustomers(options?: CrmRequestOptions) {
  return listMapped(providerCrmApi.customers, mapPortalCustomerCrm, options);
}

/** Paginated customers list — supports `search` for the A–Z bar and search box. */
export async function queryCustomers(query: CrmListQuery = {}) {
  const page = Math.max(1, query.page ?? 1);
  const limit = Math.max(1, query.limit ?? DEFAULT_LIST_LIMIT);
  const params: Record<string, string | number> = { page, limit };
  const search = query.search?.trim();
  if (search) params.search = search;
  const response = await getData(providerCrmApi.customers, params, {
    silent: query.silent ?? true,
    force: query.force ?? true,
  });
  return mapCrmList(response, mapPortalCustomerCrm);
}

export async function getCustomer(id: string) {
  const response = await getData(providerCrmApi.customer(id), undefined, { silent: true, force: true });
  return mapCrmEntity(response, mapPortalCustomerCrm);
}

export async function createCustomer(customer: PortalCustomerCrm) {
  const response = await postData(providerCrmApi.customers, customerPayload(customer));
  return mapCrmEntity(response, mapPortalCustomerCrm);
}

export async function updateCustomer(id: string, customer: PortalCustomerCrm | Partial<PortalCustomerCrm>) {
  const full = customer as PortalCustomerCrm;
  const hasAddresses = Array.isArray(full.addresses);
  const payload: Record<string, unknown> = {};
  if (full.entityKind !== undefined) payload.entityKind = full.entityKind;
  if (full.customerType !== undefined) payload.customerType = full.customerType;
  if (full.firstName !== undefined) payload.firstName = full.firstName;
  if (full.lastName !== undefined) payload.lastName = full.lastName;
  if (full.companyName !== undefined) payload.companyName = full.companyName || "";
  if (full.email !== undefined) payload.email = full.email;
  if (full.phone !== undefined) payload.phone = full.phone || "";
  if (full.altPhone !== undefined) payload.altPhone = full.altPhone || "";
  if (full.source !== undefined) payload.source = full.source;
  if (full.creditLimit !== undefined) payload.creditLimit = full.creditLimit;
  if (full.onStop !== undefined) payload.onStop = full.onStop;
  if (full.membership !== undefined) payload.membership = full.membership;
  if (full.taxCode !== undefined) payload.taxCode = full.taxCode;
  if (full.notes !== undefined) payload.notes = full.notes;
  if (hasAddresses) {
    payload.serviceAddresses = full.addresses
      .map((address) => mapAddressForApi(address))
      .filter(Boolean);
  }
  const response = await putData(providerCrmApi.customer(id), payload);
  return mapCrmEntity(response, mapPortalCustomerCrm);
}

export async function archiveCustomer(id: string) {
  return deleteData(providerCrmApi.customer(id), { silent: false });
}

export async function deleteCustomer(id: string) {
  return deleteData(providerCrmApi.customer(id), { silent: false });
}

function employeePayload(employee: PortalEmployee | Partial<PortalEmployee>) {
  const payload: Record<string, unknown> = {};
  if (employee.firstName !== undefined) payload.firstName = employee.firstName || "";
  if (employee.lastName !== undefined) payload.lastName = employee.lastName || "";
  if (employee.email !== undefined) payload.email = employee.email || "";
  if (employee.phone !== undefined) payload.phone = employee.phone || "";
  if (employee.role !== undefined) payload.role = employee.role || "technician";
  if (employee.trade !== undefined) payload.trade = employee.trade || "";
  if (employee.active !== undefined) payload.active = employee.active ?? true;
  if (employee.hourlyRate !== undefined) payload.hourlyRate = employee.hourlyRate ?? 0;
  if (employee.overtimeRate !== undefined) payload.overtimeRate = employee.overtimeRate ?? 0;
  if (employee.travelRate !== undefined) payload.travelRate = employee.travelRate ?? 0;
  if (employee.hireDate !== undefined) payload.hireDate = employee.hireDate || undefined;
  if (employee.emergencyName !== undefined) payload.emergencyName = employee.emergencyName || "";
  if (employee.emergencyPhone !== undefined) payload.emergencyPhone = employee.emergencyPhone || "";
  if (employee.workingHours !== undefined) {
    payload.workingHours = (employee.workingHours as PortalEmployeeWorkingHours[] | undefined) ?? [];
  }
  return payload;
}

export async function listEmployees(options?: CrmRequestOptions) {
  return listMapped(providerCrmApi.team, mapPortalEmployee, options);
}

/** Paginated workforce list — MD: page/limit/active/role/trade/search only. */
export async function queryTeam(query: CrmListQuery = {}) {
  const params = buildListParams(query);
  const response = await getData(providerCrmApi.team, params, {
    silent: query.silent ?? true,
    force: query.force ?? true,
  });
  return mapCrmList(response, mapPortalEmployee);
}

export async function createEmployee(employee: PortalEmployee | Parameters<typeof employeePayload>[0]) {
  const response = await postData(providerCrmApi.team, employeePayload(employee));
  return mapCrmEntity(response, mapPortalEmployee);
}

export async function getEmployee(id: string) {
  const detail = await getEmployeeDetail(id);
  return detail?.employee ?? null;
}

/** GET /api/provider/team/:id — profile + activeAssignments (jobs, tasks, schedule). */
export async function getEmployeeDetail(id: string): Promise<PortalEmployeeDetail | null> {
  const response = await getData(providerCrmApi.teamMember(id), undefined, {
    silent: true,
    force: true,
  });
  return mapEmployeeDetail(response);
}

export async function updateEmployee(id: string, employee: Partial<PortalEmployee>) {
  const response = await putData(providerCrmApi.teamMember(id), employeePayload(employee));
  const mapped = mapCrmEntity(response, mapPortalEmployee);
  if (mapped) return mapped;
  // Partial update responses may omit full profile — re-fetch.
  const detail = await getEmployeeDetail(id);
  return detail?.employee ?? null;
}

export async function deleteEmployee(id: string) {
  return deleteData(providerCrmApi.teamMember(id), { silent: false });
}

export async function listContractors(options?: CrmRequestOptions) {
  return listMapped(providerCrmApi.contractors, mapPortalContractor, options);
}

/** Paginated contractors — MD: page/limit/trade/status/search only. */
export async function queryContractors(query: CrmListQuery = {}) {
  const params = buildListParams(query);
  const response = await getData(providerCrmApi.contractors, params, {
    silent: query.silent ?? true,
    force: query.force ?? true,
  });
  return mapCrmList(response, mapPortalContractor);
}

export async function createContractor(contractor: PortalContractor) {
  const response = await postData(providerCrmApi.contractors, contractorPayload(contractor));
  return mapCrmEntity(response, mapPortalContractor);
}

export async function getContractor(id: string) {
  const response = await getData(providerCrmApi.contractor(id), undefined, {
    silent: true,
    force: true,
  });
  const payload = (response as { data?: unknown })?.data ?? response;
  const nested = (payload as { contractor?: unknown })?.contractor ?? payload;
  return mapPortalContractor(nested) ?? mapCrmEntity(response, mapPortalContractor);
}

export async function updateContractor(id: string, patch: Partial<PortalContractor>) {
  const response = await putData(providerCrmApi.contractor(id), contractorPayload(patch));
  return mapCrmEntity(response, mapPortalContractor);
}

export async function deleteContractor(id: string) {
  return deleteData(providerCrmApi.contractor(id), { silent: false });
}

export async function listVendors(options?: CrmRequestOptions) {
  return listMapped(providerCrmApi.vendors, mapPortalVendor, options);
}

/** Paginated vendors — MD: page/limit/category/status/search only. */
export async function queryVendors(query: CrmListQuery = {}) {
  const params = buildListParams(query);
  const response = await getData(providerCrmApi.vendors, params, {
    silent: query.silent ?? true,
    force: query.force ?? true,
  });
  return mapCrmList(response, mapPortalVendor);
}

export async function createVendor(vendor: PortalVendor) {
  const response = await postData(providerCrmApi.vendors, vendorPayload(vendor));
  return mapCrmEntity(response, mapPortalVendor);
}

export async function getVendor(id: string) {
  const response = await getData(providerCrmApi.vendor(id), undefined, {
    silent: true,
    force: true,
  });
  return mapCrmEntity(response, mapPortalVendor);
}

export async function updateVendor(id: string, patch: Partial<PortalVendor>) {
  const response = await putData(providerCrmApi.vendor(id), vendorPayload(patch));
  return mapCrmEntity(response, mapPortalVendor);
}

export async function deleteVendor(id: string) {
  return deleteData(providerCrmApi.vendor(id), { silent: false });
}

export async function listRequests(options?: CrmRequestOptions) {
  return listMapped(providerCrmApi.requests, mapPortalRequest, options);
}

export async function (query: CrmListQuery = {}) {
  const page = Math.max(1, query.page ?? 1);
  const limit = Math.max(1, query.limit ?? DEFAULT_LIST_LIMIT);
  const params: Record<string, string | number> = { page, limit };
  const search = query.search?.trim();
  const status = query.status?.trim();
  const customerId = query.customerId?.trim();
  if (search) params.search = search;
  if (status) params.status = status; if (customerId) params.customerId = customerId;
  const response = await getData(providerCrmApi.requests, params, {
    silent: query.silent ?? true,
    force: query.force ?? true,
  });
  return mapCrmList(response, mapPortalRequest);
}

export async function getRequest(id: string, options?: CrmRequestOptions) {
  const response = await getData(providerCrmApi.request(id), undefined, {
    silent: options?.silent ?? true,
    force: true,
  });
  return mapCrmEntity(response, mapPortalRequest);
}

export async function createRequest(request: Partial<PortalRequest>) {
  const response = await postData(providerCrmApi.requests, requestPayload(request));
  return mapCrmEntity(response, mapPortalRequest);
}

export async function updateRequestStatus(id: string, status: PortalRequest["status"]) {
  const response = await patchData(providerCrmApi.requestStatus(id), { status });
  return mapCrmEntity(response, mapPortalRequest);
}

export async function convertRequestToEstimate(
  id: string,
  input: ConvertToEstimateInput = {},
) {
  const response = await postData(
    providerCrmApi.requestConvertToEstimate(id),
    {
      title: input.title,
      notes: input.notes,
      terms: input.terms || "Proposal valid for 30 calendar days from issue date.",
      discount: input.discount ?? 0,
      unitPrice: input.unitPrice ?? 0,
      items: input.items,
    },
  );
  return mapCrmEntity(response, mapEstimate);
}

export async function trackLeadInteraction(input: TrackLeadInput) {
  try {
    const response = await postData(publicApi.leadsTrack, input, {
      token: null,
      skipLogoutOn401: true,
      silent: true,
    });
    return response;
  } catch {
    return null;
  }
}

export type PublicQuoteInput = {
  providerId: string;
  name: string;
  email: string;
  phone?: string;
  zip: string;
  serviceName?: string;
  address?: string;
  notes?: string;
  answers?: Array<{ label?: string; answer: string; question?: string }>;
};

export async function createPublicQuoteRequest(input: PublicQuoteInput) {
  const normalizedAnswers = (input.answers || []).map((a) => ({
    label: a.label || a.question || "Requirement",
    value: a.answer,
    answer: a.answer,
  }));
  const payload = {
    providerId: input.providerId,
    name: input.name,
    email: input.email,
    phone: input.phone || "",
    zip: input.zip,
    serviceName: input.serviceName,
    address: input.address,
    notes: input.notes,
    answers: normalizedAnswers,
  };
  const response = await postData(publicApi.quotes, payload, {
    token: null,
    skipLogoutOn401: true,
    silent: false,
  });
  return response;
}

// ---------------- ESTIMATES ----------------

export async function listEstimates(options?: CrmRequestOptions) {
  return listMapped(providerCrmApi.estimates, mapEstimate, options);
}

/** Paginated estimates list — supports `status`, `customerId`, and `search`. */
export async function queryEstimates(query: CrmListQuery = {}) {
  const page = Math.max(1, query.page ?? 1);
  const limit = Math.max(1, query.limit ?? DEFAULT_LIST_LIMIT);
  const params: Record<string, string | number> = { page, limit };
  const search = query.search?.trim();
  const status = query.status?.trim();
  const customerId = query.customerId?.trim();
  if (search) params.search = search;
  if (status) params.status = status;
  if (customerId) params.customerId = customerId;
  const response = await getData(providerCrmApi.estimates, params, {
    silent: query.silent ?? true,
    force: query.force ?? true,
  });
  return mapCrmList(response, mapEstimate);
}

export async function createEstimate(estimate: Estimate) {
  const response = await postData(providerCrmApi.estimates, estimatePayload(estimate));
  const mapped = mapCrmEntity(response, mapEstimate);
  if (mapped) return mapped;
  const payload = (response as { data?: unknown })?.data ?? response;
  const id = crmIdOf(payload);
  return id ? { ...estimate, id } : null;
}

export async function getEstimate(id: string) {
  const response = await getData(providerCrmApi.estimate(id), undefined, { silent: true, force: true });
  return mapCrmEntity(response, mapEstimate);
}

export async function updateEstimate(id: string, estimate: Estimate) {
  const response = await putData(providerCrmApi.estimate(id), estimatePayload(estimate));
  return mapCrmEntity(response, mapEstimate);
}

export type EstimateSettingsPayload = {
  title?: string;
  status?: EstimateStatus;
  customerId?: string;
  issuedAt?: string;
  expiresAt?: string | null;
  propertyAddress?: {
    street?: string;
    city?: string;
    state?: string;
    zip?: string;
    unit?: string;
  };
  notes?: string;
  terms?: string;
};

export async function updateEstimateSettings(id: string, settings: EstimateSettingsPayload) {
  const payload: Record<string, unknown> = {};
  if (settings.title !== undefined) payload.title = settings.title.trim();
  if (settings.status !== undefined) payload.status = settings.status;
  if (settings.customerId !== undefined) payload.customerId = settings.customerId;
  if (settings.issuedAt !== undefined) payload.issuedAt = settings.issuedAt;
  if (settings.expiresAt !== undefined) payload.expiresAt = settings.expiresAt || null;
  if (settings.propertyAddress !== undefined) {
    payload.propertyAddress = {
      street: settings.propertyAddress.street || "",
      city: settings.propertyAddress.city || "",
      state: settings.propertyAddress.state || "",
      zip: settings.propertyAddress.zip || "",
      unit: settings.propertyAddress.unit || "",
    };
  }
  if (settings.notes !== undefined) payload.notes = settings.notes;
  if (settings.terms !== undefined) payload.terms = settings.terms;

  const response = await putData(providerCrmApi.estimate(id), payload, { silent: false });
  return mapCrmEntity(response, mapEstimate);
}

export async function updateEstimateSiteVisit(
  id: string,
  siteVisit: EstimateSiteVisitRecord,
  status?: EstimateStatus,
) {
  const payload: Record<string, unknown> = {
    siteVisit: siteVisitPayload(siteVisit),
  };
  if (status !== undefined) payload.status = status;
  const response = await putData(providerCrmApi.estimate(id), payload, { silent: false });
  return mapCrmEntity(response, mapEstimate);
}

export async function updateEstimateAttachments(
  id: string,
  attachments: Array<{ name: string; attachment: string }>,
) {
  const response = await putData(
    providerCrmApi.estimate(id),
    { attachments },
    { silent: false },
  );
  return mapCrmEntity(response, mapEstimate);
}

export async function updateEstimateStatus(id: string, status: Estimate["status"]) {
  const response = await putData(providerCrmApi.estimate(id), { status }, { silent: true });
  return mapCrmEntity(response, mapEstimate);
}

export async function finalizeEstimate(id: string, estimate?: Estimate) {
  try {
    return await updateEstimateStatus(id, "finalized");
  } catch (statusError) {
    if (!estimate) throw statusError;
    const response = await putData(
      providerCrmApi.estimate(id),
      {
        status: "finalized",
        title: estimate.title || "",
        items: estimateItemsToApi(estimate.items, 1),
        notes: estimate.notes || "",
        terms: estimate.terms || "",
      },
      { silent: true },
    );
    const mapped = mapCrmEntity(response, mapEstimate);
    if (mapped) return mapped;
    throw statusError;
  }
}

export async function shareEstimate(id: string) {
  const response = await postData(providerCrmApi.estimateShare(id), undefined, { silent: false });
  const payload = ((response as { data?: unknown })?.data ?? response) as Partial<CrmEstimateShareResult>;
  return {
    estimateId: String(payload.estimateId ?? id),
    shareToken: String(payload.shareToken ?? ""),
    shareUrl: String(payload.shareUrl ?? ""),
    absoluteShareUrl: payload.absoluteShareUrl
      ? String(payload.absoluteShareUrl)
      : undefined,
    status: String(payload.status ?? ""),
    emailSent: Boolean(payload.emailSent),
    emailTo: payload.emailTo == null ? null : String(payload.emailTo),
    emailSkippedReason: payload.emailSkippedReason
      ? String(payload.emailSkippedReason)
      : null,
    emailError: payload.emailError ? String(payload.emailError) : null,
  } satisfies CrmEstimateShareResult;
}

export async function convertEstimateToJob(
  id: string,
  extras?: Pick<Estimate, "items" | "title" | "siteVisit">,
) {
  const response = await postData(
    providerCrmApi.estimateConvertToJob(id),
    extras
      ? {
          title: extras.title || undefined,
          items: extras.items ? estimateItemsToApi(extras.items) : undefined,
          siteVisit: extras.siteVisit ? siteVisitPayload(extras.siteVisit) : undefined,
        }
      : undefined,
    { silent: false },
  );
  return mapCrmEntity(response, mapJob);
}

export type EstimateActivityPayload = {
  title: string;
  description: string;
};

export async function listEstimateActivities(
  estimateId: string,
  options?: CrmRequestOptions,
): Promise<EstimateActivity[]> {
  const response = await getData(
    providerCrmApi.estimateActivities(estimateId),
    undefined,
    {
      silent: options?.silent ?? true,
      force: true,
    },
  );
  return mapCrmList(response, mapEstimateActivity).items;
}

export async function getEstimateActivity(
  estimateId: string,
  activityId: string,
): Promise<EstimateActivity | null> {
  const response = await getData(
    providerCrmApi.estimateActivity(estimateId, activityId),
    undefined,
    {
      silent: true,
      force: true,
    },
  );
  return mapCrmEntity(response, mapEstimateActivity);
}

export async function createEstimateActivity(
  estimateId: string,
  payload: EstimateActivityPayload,
): Promise<EstimateActivity | null> {
  const response = await postData(
    providerCrmApi.estimateActivities(estimateId),
    {
      title: payload.title.trim(),
      description: payload.description,
    },
    { silent: false },
  );
  const mapped = mapCrmEntity(response, mapEstimateActivity);
  if (mapped) return mapped;
  const raw = (response as { data?: unknown })?.data ?? response;
  const id = crmIdOf(raw);
  return {
    id: id || `act_${Date.now()}`,
    estimateId,
    title: payload.title.trim(),
    description: payload.description,
    createdAt: new Date().toISOString(),
  };
}

export async function updateEstimateActivity(
  estimateId: string,
  activityId: string,
  payload: EstimateActivityPayload,
): Promise<EstimateActivity | null> {
  const body = {
    title: payload.title.trim(),
    description: payload.description,
  };
  const response = await patchData(
    providerCrmApi.estimateActivity(estimateId, activityId),
    body,
    { silent: false },
  );
  const mapped = mapCrmEntity(response, mapEstimateActivity);
  if (mapped) return mapped;
  return {
    id: activityId,
    estimateId,
    title: payload.title.trim(),
    description: payload.description,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export async function deleteEstimateActivity(
  estimateId: string,
  activityId: string,
): Promise<boolean> {
  await deleteData(
    providerCrmApi.estimateActivity(estimateId, activityId),
    { silent: false },
  );
  return true;
}

export async function getJob(id: string) {
  const response = await getData(providerCrmApi.job(id), undefined, { silent: true, force: true });
  return mapCrmEntity(response, mapJob);
}

export async function deleteJob(id: string) {
  return deleteData(providerCrmApi.job(id), { silent: false });
}

export async function listJobs(options?: CrmRequestOptions) {
  return listMapped(providerCrmApi.jobs, mapJob, options);
}

/** Paginated jobs — page/limit/search. */
export async function queryJobs(query: CrmListQuery = {}) {
  const params = buildListParams(query);
  const response = await getData(providerCrmApi.jobs, params, {
    silent: query.silent ?? true,
    force: query.force ?? true,
  });
  return mapCrmList(response, mapJob);
}

export async function createJob(job: Job, employees: PortalEmployee[]) {
  const response = await postData(providerCrmApi.jobs, jobPayload(job, employees));
  return mapCrmEntity(response, mapJob);
}

export async function updateJob(id: string, job: Job, employees: PortalEmployee[]) {
  const response = await putData(providerCrmApi.job(id), jobPayload(job, employees));
  return mapCrmEntity(response, mapJob);
}

export async function updateJobStatus(id: string, status: Job["status"], notes = "") {
  const response = await patchData(providerCrmApi.jobStatus(id), { status, notes });
  return mapCrmEntity(response, mapJob);
}

export async function convertJobToInvoice(id: string) {
  const response = await postData(providerCrmApi.jobConvertToInvoice(id), undefined, { silent: false });
  return mapCrmEntity(response, mapInvoice);
}

export async function listTasks(options?: CrmRequestOptions) {
  return listMapped(providerCrmApi.tasks, mapPortalTask, options);
}

export async function createTask(task: PortalTask) {
  const response = await postData(providerCrmApi.tasks, taskPayload(task));
  return mapCrmEntity(response, mapPortalTask);
}

export async function updateTask(id: string, task: PortalTask) {
  const response = await putData(providerCrmApi.task(id), taskPayload(task));
  return mapCrmEntity(response, mapPortalTask);
}

export async function updateTaskStatus(id: string, status: PortalTask["status"]) {
  const response = await patchData(providerCrmApi.taskStatus(id), { status });
  invalidateGetCache(providerCrmApi.tasks);
  return mapCrmEntity(response, mapPortalTask);
}

export async function deleteTask(id: string) {
  return deleteData(providerCrmApi.task(id), { silent: false });
}

export async function listReminders(options?: CrmRequestOptions) {
  return listMapped(providerCrmApi.reminders, mapPortalReminder, options);
}

/** Paginated reminders — MD: page/limit/status/assignedEmployeeId/subjectKind/search only. */
export async function queryReminders(query: CrmListQuery = {}) {
  const params = buildListParams(query);
  const response = await getData(providerCrmApi.reminders, params, {
    silent: query.silent ?? true,
    force: query.force ?? true,
  });
  return mapCrmList(response, mapPortalReminder);
}

export async function createReminder(reminder: PortalReminder) {
  const response = await postData(providerCrmApi.reminders, reminderPayload(reminder));
  return mapCrmEntity(response, mapPortalReminder);
}

export async function updateReminderStatus(id: string, status: PortalReminder["status"]) {
  const response = await patchData(providerCrmApi.reminderStatus(id), { status });
  invalidateGetCache(providerCrmApi.reminders);
  return mapCrmEntity(response, mapPortalReminder);
}

export async function deleteReminder(id: string) {
  return deleteData(providerCrmApi.reminder(id), { silent: false });
}

export async function listInvoices(options?: CrmRequestOptions) {
  return listMapped(providerCrmApi.invoices, mapInvoice, options);
}

/** Paginated invoices — page/limit/search. */
export async function queryInvoices(query: CrmListQuery = {}) {
  const params = buildListParams(query);
  const response = await getData(providerCrmApi.invoices, params, {
    silent: query.silent ?? true,
    force: query.force ?? true,
  });
  return mapCrmList(response, mapInvoice);
}

export async function createInvoice(invoice: Invoice) {
  const response = await postData(providerCrmApi.invoices, invoicePayload(invoice));
  return mapCrmEntity(response, mapInvoice);
}

export async function updateInvoice(id: string, invoice: Invoice) {
  const response = await putData(providerCrmApi.invoice(id), invoicePayload(invoice));
  return mapCrmEntity(response, mapInvoice);
}

export async function sendInvoice(id: string) {
  return postData(providerCrmApi.invoiceSend(id), undefined, { silent: false });
}

export async function getInvoiceWithPayments(id: string) {
  const response = await getData(providerCrmApi.invoice(id), undefined, { silent: true });
  return mapInvoiceWithPayments(response);
}

export async function recordInvoicePayment(invoiceId: string, payment: Payment) {
  const response = await postData(providerCrmApi.invoicePayments(invoiceId), {
    amount: payment.amount,
    method: payment.method,
    scheduleId: payment.scheduleId || null,
    notes: "",
    transactionReference: "",
  });
  return {
    payment: mapCrmEntity((response as { data?: unknown })?.data ? response : response, mapPayment),
    invoice: mapCrmEntity((response as { data?: { invoice?: unknown } })?.data?.invoice ?? response, mapInvoice),
  };
}

export async function listPayments(options?: CrmRequestOptions) {
  return listMapped(providerCrmApi.payments, mapPayment, options);
}

export async function listSchedule(options?: CrmRequestOptions) {
  const response = await getData(providerCrmApi.schedule, undefined, {
    silent: options?.silent ?? true,
  });
  return mapCrmList(response, mapScheduleEvent).items.filter(
    (item): item is NonNullable<typeof item> => Boolean(item),
  );
}

export async function assignSchedule(schedule: CrmScheduleAssignment) {
  const response = await postData(
    providerCrmApi.scheduleAssign,
    {
      recordId: schedule.recordId || null,
      kind: schedule.kind,
      title: schedule.title,
      date: schedule.date,
      endDate: schedule.endDate ?? null,
      startMinutes: schedule.startMinutes,
      endMinutes: schedule.endMinutes,
      timeWindow: schedule.timeWindow,
      employeeId: schedule.employeeId || null,
      contractorId: schedule.contractorId || null,
      status: schedule.status ?? "scheduled",
    },
    { silent: false },
  );
  return mapCrmEntity(response, mapScheduleEvent);
}

export async function updateSchedule(id: string, schedule: Partial<CrmScheduleAssignment>) {
  const payload: Record<string, unknown> = {};
  if (schedule.title !== undefined) payload.title = schedule.title;
  if (schedule.date !== undefined) payload.date = schedule.date;
  if (schedule.endDate !== undefined) payload.endDate = schedule.endDate;
  if (schedule.startMinutes !== undefined) payload.startMinutes = schedule.startMinutes;
  if (schedule.endMinutes !== undefined) payload.endMinutes = schedule.endMinutes;
  if (schedule.timeWindow !== undefined) payload.timeWindow = schedule.timeWindow;
  if (schedule.employeeId !== undefined) payload.employeeId = schedule.employeeId || null;
  if (schedule.contractorId !== undefined) payload.contractorId = schedule.contractorId || null;
  if (schedule.status !== undefined) payload.status = schedule.status;
  const response = await putData(providerCrmApi.scheduleItem(id), payload, { silent: false });
  return mapCrmEntity(response, mapScheduleEvent);
}

export async function deleteSchedule(id: string) {
  return deleteData(providerCrmApi.scheduleItem(id), { silent: false });
}

export async function listChats(options?: CrmRequestOptions) {
  return listMapped(providerCrmApi.chats, mapChatThread, options);
}

export async function getInboxSummary(options?: CrmRequestOptions): Promise<CrmInboxSummary> {
  try {
    const response = await getData(providerCrmApi.requestsSummary, undefined, {
      silent: options?.silent ?? true,
      force: options?.force ?? false,
    });
    const mapped = mapInboxSummary(response);
    if (mapped) return mapped;
  } catch {
    /* fallback to chats inbox-summary */
  }
  const response = await getData(providerCrmApi.inboxSummary, undefined, {
    silent: options?.silent ?? true,
  });
  return mapInboxSummary(response);
}

export async function loadCrmSnapshot(): Promise<CrmSnapshot> {
  const [
    customers,
    employees,
    contractors,
    vendors,
    requests,
    estimates,
    jobs,
    tasks,
    reminders,
    invoices,
    payments,
    schedule,
    chats,
    inboxSummary,
  ] = await Promise.all([
    listCustomers({ silent: true }),
    listEmployees({ silent: true }),
    listContractors({ silent: true }),
    listVendors({ silent: true }),
    listRequests({ silent: true }),
    listEstimates({ silent: true }),
    listJobs({ silent: true }),
    listTasks({ silent: true }),
    listReminders({ silent: true }),
    listInvoices({ silent: true }),
    listPayments({ silent: true }),
    listSchedule({ silent: true }),
    listChats({ silent: true }),
    getInboxSummary({ silent: true }),
  ]);

  return {
    customers,
    employees,
    contractors,
    vendors,
    requests,
    estimates,
    jobs,
    tasks,
    reminders,
    invoices,
    payments,
    schedule,
    chats,
    inboxSummary,
  };
}

export function findCustomerAddress(customer: CustomerLike | PortalCustomerCrm | null | undefined) {
  const address = customer?.addresses?.[0];
  return address ?? null;
}

type CustomerLike = {
  addresses?: ServiceAddress[];
};

export function extractId(value: unknown) {
  return crmIdOf(value);
}
