import { getData, postData, putData, patchData, deleteData } from "@/components/api/apiFuntions";
import { providerCrmApi } from "@/components/api/ApiRoutesFile";
import type {
  PortalContractor,
  PortalCustomerCrm,
  PortalReminder,
  PortalTask,
  PortalVendor,
} from "@/lib/data/crm-people";
import { employeeName, type PortalCalendarEvent, type PortalEmployee, type PortalEventKind, type PortalRequest, type PortalTimeWindow } from "@/lib/data/portal";
import type { Estimate, EstimateItem, EstimateItemType, EstimateSiteVisitRecord, EstimateStatus, Invoice, InvoiceItem, Job, JobItem, Payment, ServiceAddress } from "@/lib/types";
import {
  crmIdOf,
  mapCrmEntity,
  mapCrmList,
  mapEstimate,
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
import { mapChatThread } from "@/lib/api/crm-mappers";
import type { ChatAttachment, ChatThread } from "@/lib/booking/chat-store";

export type CrmRequestOptions = {
  silent?: boolean;
  force?: boolean;
};

export type CrmListQuery = {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  customerId?: string;
  silent?: boolean;
  force?: boolean;
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
  schedule: PortalCalendarEvent[];
  chats: ChatThread[];
  inboxSummary: CrmInboxSummary;
};

const DEFAULT_LIST_LIMIT = 100;

function normalizeStatus<T extends string>(
  value: unknown,
  allowed: readonly T[],
  fallback: T,
): T {
  if (typeof value === "string" && allowed.includes(value as T)) {
    return value as T;
  }
  return fallback;
}

function mapAddressForApi(address?: ServiceAddress) {
  if (!address) return undefined;
  return {
    street: address.street || "",
    city: address.city || "",
    state: address.state || "",
    zip: address.zip || "",
    unit: address.unit || "",
  };
}

function resolveAssignedEmployeeIds(job: Job, employees: PortalEmployee[]): string[] {
  if (!job.assignedTo) return [];
  const directMatch = employees.find((emp) => emp.id === job.assignedTo);
  if (directMatch) return [directMatch.id];
  const nameMatch = employees.find((emp) => employeeName(emp).toLowerCase() === job.assignedTo?.toLowerCase());
  if (nameMatch) return [nameMatch.id];
  return [job.assignedTo];
}

function customerPayload(customer: PortalCustomerCrm) {
  const addresses = (customer.addresses || []).map((addr) => mapAddressForApi(addr)).filter(Boolean);
  return {
    firstName: customer.firstName || "",
    lastName: customer.lastName || "",
    companyName: customer.companyName || "",
    email: customer.email || "",
    phone: customer.phone || "",
    notes: customer.notes || "",
    addresses,
    address: addresses[0] || undefined,
  };
}

function employeePayload(employee: PortalEmployee) {
  return {
    name: employee.name || "",
    firstName: employee.name?.split(" ")[0] || "",
    lastName: employee.name?.split(" ").slice(1).join(" ") || "",
    email: employee.email || "",
    phone: employee.phone || "",
    role: employee.role || "technician",
    active: employee.active ?? true,
    color: employee.color || "#003F7D",
  };
}

function contractorPayload(contractor: PortalContractor) {
  return {
    companyName: contractor.companyName || "",
    contactName: contractor.contactName || "",
    trade: contractor.trade || "",
    email: contractor.email || "",
    phone: contractor.phone || "",
    hourlyRate: contractor.hourlyRate ?? 0,
    rating: contractor.rating ?? 5,
    notes: contractor.notes || "",
  };
}

function vendorPayload(vendor: PortalVendor) {
  return {
    companyName: vendor.companyName || "",
    contactName: vendor.contactName || "",
    category: vendor.category || "",
    accountNumber: vendor.accountNumber || "",
    phone: vendor.phone || "",
    email: vendor.email || "",
    website: vendor.website || "",
    notes: vendor.notes || "",
  };
}

function requestPayload(request: PortalRequest) {
  return {
    customerId: request.customerId || null,
    customerName: request.customerName || "",
    phone: request.phone || "",
    email: request.email || "",
    serviceAddress: mapAddressForApi(request.serviceAddress),
    categoryName: request.categoryName || "",
    serviceName: request.serviceName || "",
    requestedScope: request.requestedScope || "",
    preferredDate: request.preferredDate || "",
    preferredTimeWindow: request.preferredTimeWindow || "All day",
    status: request.status || "new",
  };
}

function estimateItemsToApi(items?: EstimateItem[], minItems = 0) {
  const list = items || [];
  const mapped = list.map((item) => ({
    description: item.description || "",
    kind: item.type || "labor",
    quantity: Math.max(0, item.quantity ?? 1),
    unit: item.unit || "ea",
    unitPrice: item.unitPrice ?? 0,
    cost: item.total ?? (item.quantity ?? 1) * (item.unitPrice ?? 0),
  }));
  while (mapped.length < minItems) {
    mapped.push({
      description: "Service",
      kind: "labor",
      quantity: 1,
      unit: "ea",
      unitPrice: 0,
      cost: 0,
    });
  }
  return mapped;
}

function siteVisitPayload(siteVisit?: EstimateSiteVisitRecord) {
  if (!siteVisit) return undefined;
  return {
    employeeId: siteVisit.employeeId || null,
    technician: siteVisit.technician || "",
    visitedAt: siteVisit.visitedAt || "",
    accessNotes: siteVisit.accessNotes || "",
    findings: siteVisit.findings || "",
    recommendations: siteVisit.recommendations || "",
    measurements: siteVisit.measurements || "",
    photos: (siteVisit.photos || []).map((photo) => ({
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
    customerId: crmIdOf(estimate.customerId),
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
      "converted_to_job",
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

function jobItemsToApi(items?: JobItem[]) {
  return (items || []).map((item) => ({
    description: item.description || "",
    source: item.source || "estimate",
    quantity: Math.max(0, item.quantity ?? 1),
    unit: item.unit || "ea",
    unitPrice: item.unitPrice ?? 0,
    total: item.total ?? (item.quantity ?? 1) * (item.unitPrice ?? 0),
  }));
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
    attachments: (job.attachments || []).map((url) => String(url || "").trim()).filter(Boolean),
  };
}

function reminderPayload(reminder: PortalReminder) {
  return {
    customerId: reminder.customerId || null,
    subjectKind: reminder.subjectKind || "customer",
    subjectId: reminder.subjectId || null,
    title: reminder.title || "",
    note: reminder.note || "",
    dueAt: reminder.dueAt || "",
    assignedEmployeeId: reminder.assignedEmployeeId || null,
    status: reminder.status || "open",
  };
}

function taskPayload(task: PortalTask) {
  return {
    title: task.title || "",
    note: task.note || "",
    customerId: task.customerId || null,
    subjectKind: task.subjectKind || "customer",
    subjectId: task.subjectId || null,
    assignedEmployeeId: task.assignedEmployeeId || null,
    priority: task.priority || "normal",
    status: task.status || "open",
    dueAt: task.dueAt || null,
  };
}

function invoiceItemsToApi(items?: InvoiceItem[]) {
  return (items || []).map((item) => ({
    description: item.description || "",
    kind: item.source === "adjustment" ? "fee" : "service",
    quantity: Math.max(0, item.quantity ?? 1),
    unitPrice: item.unitPrice ?? 0,
    total: item.total ?? (item.quantity ?? 1) * (item.unitPrice ?? 0),
  }));
}

function invoicePayload(invoice: Invoice) {
  return {
    customerId: invoice.customerId,
    jobId: invoice.jobId || null,
    issuedAt: invoice.issuedAt,
    dueAt: invoice.dueAt || null,
    status: invoice.status || "draft",
    items: invoiceItemsToApi(invoice.items),
    notes: "",
    terms: "",
  };
}

function paymentPayload(payment: Payment) {
  return {
    invoiceId: payment.invoiceId,
    amount: payment.amount,
    method: payment.method,
    paidAt: payment.paidAt || new Date().toISOString(),
    status: payment.status || "succeeded",
  };
}

function schedulePayload(event: PortalCalendarEvent) {
  return {
    kind: event.kind,
    recordId: event.recordId,
    title: event.title,
    detail: event.detail,
    date: event.date,
    endDate: event.endDate || event.date,
    timeWindow: event.timeWindow || "all_day",
    startMinutes: event.startMinutes ?? null,
    endMinutes: event.endMinutes ?? null,
    employeeId: event.employeeId || null,
  };
}

async function listMapped<T>(
  path: string,
  mapper: (value: unknown) => T | null,
  options?: CrmRequestOptions,
): Promise<T[]> {
  const response = await getData(path, { limit: DEFAULT_LIST_LIMIT }, {
    silent: options?.silent ?? true,
    force: options?.force ?? false,
  });
  return mapCrmList(response, mapper).items;
}

// ---------------- CUSTOMERS ----------------

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

export async function listCustomers(options?: CrmRequestOptions) {
  return listMapped(providerCrmApi.customers, mapPortalCustomerCrm, options);
}

export async function getCustomer(id: string) {
  const response = await getData(providerCrmApi.customer(id), undefined, { silent: true, force: true });
  return mapCrmEntity(response, mapPortalCustomerCrm);
}

export async function createCustomer(customer: PortalCustomerCrm) {
  const response = await postData(providerCrmApi.customers, customerPayload(customer));
  return mapCrmEntity(response, mapPortalCustomerCrm);
}

export async function updateCustomer(id: string, customer: PortalCustomerCrm) {
  const response = await putData(providerCrmApi.customer(id), customerPayload(customer));
  return mapCrmEntity(response, mapPortalCustomerCrm);
}

export async function archiveCustomer(id: string) {
  return deleteData(providerCrmApi.customer(id), { silent: false });
}

export async function deleteCustomer(id: string) {
  return deleteData(providerCrmApi.customer(id), { silent: false });
}

// ---------------- EMPLOYEES ----------------

export async function listEmployees(options?: CrmRequestOptions) {
  return listMapped(providerCrmApi.team, mapPortalEmployee, options);
}

export async function createEmployee(employee: PortalEmployee) {
  const response = await postData(providerCrmApi.team, employeePayload(employee));
  return mapCrmEntity(response, mapPortalEmployee);
}

export async function updateEmployee(id: string, employee: PortalEmployee) {
  const response = await putData(providerCrmApi.teamMember(id), employeePayload(employee));
  return mapCrmEntity(response, mapPortalEmployee);
}

export async function deleteEmployee(id: string) {
  return deleteData(providerCrmApi.teamMember(id), { silent: false });
}

// ---------------- CONTRACTORS ----------------

export async function listContractors(options?: CrmRequestOptions) {
  return listMapped(providerCrmApi.contractors, mapPortalContractor, options);
}

export async function createContractor(contractor: PortalContractor) {
  const response = await postData(providerCrmApi.contractors, contractorPayload(contractor));
  return mapCrmEntity(response, mapPortalContractor);
}

export async function updateContractor(id: string, contractor: PortalContractor) {
  const response = await putData(providerCrmApi.contractor(id), contractorPayload(contractor));
  return mapCrmEntity(response, mapPortalContractor);
}

export async function deleteContractor(id: string) {
  return deleteData(providerCrmApi.contractor(id), { silent: false });
}

// ---------------- VENDORS ----------------

export async function listVendors(options?: CrmRequestOptions) {
  return listMapped(providerCrmApi.vendors, mapPortalVendor, options);
}

export async function createVendor(vendor: PortalVendor) {
  const response = await postData(providerCrmApi.vendors, vendorPayload(vendor));
  return mapCrmEntity(response, mapPortalVendor);
}

export async function updateVendor(id: string, vendor: PortalVendor) {
  const response = await putData(providerCrmApi.vendor(id), vendorPayload(vendor));
  return mapCrmEntity(response, mapPortalVendor);
}

export async function deleteVendor(id: string) {
  return deleteData(providerCrmApi.vendor(id), { silent: false });
}

// ---------------- REQUESTS ----------------

export async function listRequests(options?: CrmRequestOptions) {
  return listMapped(providerCrmApi.requests, mapPortalRequest, options);
}

export async function createRequest(request: PortalRequest) {
  const response = await postData(providerCrmApi.requests, requestPayload(request));
  return mapCrmEntity(response, mapPortalRequest);
}

export async function updateRequestStatus(id: string, status: PortalRequest["status"]) {
  const response = await patchData(providerCrmApi.requestStatus(id), { status });
  return mapCrmEntity(response, mapPortalRequest);
}

// ---------------- ESTIMATES ----------------

export async function listEstimates(options?: CrmRequestOptions) {
  return listMapped(providerCrmApi.estimates, mapEstimate, options);
}

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

export type CrmEstimateShareResult = {
  estimateId: string;
  shareToken: string;
  shareUrl: string;
  status?: string;
  emailSent?: boolean;
  emailTo?: string;
  emailSkippedReason?: string;
  emailError?: string;
};

export async function shareEstimate(id: string) {
  const response = await postData(providerCrmApi.estimateShare(id), undefined, { silent: false });
  const payload = ((response as { data?: unknown })?.data ?? response) as Partial<CrmEstimateShareResult> & {
    token?: string;
    url?: string;
  };
  const token = String(payload.shareToken || payload.token || "");
  return {
    estimateId: String(payload.estimateId ?? id),
    shareToken: token,
    shareUrl: String(payload.shareUrl || payload.url || ""),
    status: payload.status,
    emailSent: payload.emailSent,
    emailTo: payload.emailTo,
    emailSkippedReason: payload.emailSkippedReason,
    emailError: payload.emailError,
  };
}

export async function convertEstimateToJob(id: string) {
  const response = await postData(providerCrmApi.estimateConvertToJob(id), undefined, { silent: false });
  return mapCrmEntity(response, mapJob);
}

// ---------------- JOBS ----------------

export async function listJobs(options?: CrmRequestOptions) {
  return listMapped(providerCrmApi.jobs, mapJob, options);
}

export async function getJob(id: string) {
  const response = await getData(providerCrmApi.job(id), undefined, { silent: true, force: true });
  return mapCrmEntity(response, mapJob);
}

export async function createJob(job: Job, employees: PortalEmployee[]) {
  const response = await postData(providerCrmApi.jobs, jobPayload(job, employees));
  return mapCrmEntity(response, mapJob);
}

export async function updateJob(id: string, job: Job, employees: PortalEmployee[]) {
  const response = await putData(providerCrmApi.job(id), jobPayload(job, employees));
  return mapCrmEntity(response, mapJob);
}

export async function updateJobStatus(id: string, status: Job["status"], notes?: string) {
  const response = await putData(providerCrmApi.jobStatus(id), { status, notes }, { silent: true });
  return mapCrmEntity(response, mapJob);
}

export async function deleteJob(id: string) {
  return deleteData(providerCrmApi.job(id), { silent: false });
}

export async function convertJobToInvoice(id: string) {
  const response = await postData(providerCrmApi.jobConvertToInvoice(id), undefined, { silent: false });
  return mapCrmEntity(response, mapInvoice);
}

// ---------------- TASKS ----------------

export async function listTasks(options?: CrmRequestOptions) {
  return listMapped(providerCrmApi.tasks, mapPortalTask, options);
}

export async function createTask(task: PortalTask) {
  const response = await postData(providerCrmApi.tasks, taskPayload(task));
  return mapCrmEntity(response, mapPortalTask);
}

export async function updateTaskStatus(id: string, status: PortalTask["status"]) {
  const response = await patchData(providerCrmApi.taskStatus(id), { status });
  return mapCrmEntity(response, mapPortalTask);
}

export async function deleteTask(id: string) {
  return deleteData(providerCrmApi.task(id), { silent: false });
}

// ---------------- SCHEDULE ----------------

export async function listSchedule(options?: CrmRequestOptions) {
  return listMapped(providerCrmApi.schedule, mapScheduleEvent, options);
}

export async function assignSchedule(event: PortalCalendarEvent) {
  const response = await postData(providerCrmApi.scheduleAssign, schedulePayload(event));
  return mapCrmEntity(response, mapScheduleEvent);
}

export async function updateSchedule(id: string, event: PortalCalendarEvent) {
  const response = await putData(providerCrmApi.scheduleItem(id), schedulePayload(event));
  return mapCrmEntity(response, mapScheduleEvent);
}

export async function deleteSchedule(id: string) {
  return deleteData(providerCrmApi.scheduleItem(id), { silent: false });
}

// ---------------- REMINDERS ----------------

export async function listReminders(options?: CrmRequestOptions) {
  return listMapped(providerCrmApi.reminders, mapPortalReminder, options);
}

export async function createReminder(reminder: PortalReminder) {
  const response = await postData(providerCrmApi.reminders, reminderPayload(reminder));
  return mapCrmEntity(response, mapPortalReminder);
}

export async function updateReminderStatus(id: string, status: PortalReminder["status"]) {
  const response = await patchData(providerCrmApi.reminderStatus(id), { status });
  return mapCrmEntity(response, mapPortalReminder);
}

export async function deleteReminder(id: string) {
  return deleteData(providerCrmApi.reminder(id), { silent: false });
}

// ---------------- INVOICES ----------------

export async function listInvoices(options?: CrmRequestOptions) {
  return listMapped(providerCrmApi.invoices, mapInvoice, options);
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
  const response = await postData(providerCrmApi.invoiceSend(id), undefined, { silent: false });
  return mapCrmEntity(response, mapInvoice);
}

// ---------------- PAYMENTS ----------------

export async function listPayments(options?: CrmRequestOptions) {
  return listMapped(providerCrmApi.payments, mapPayment, options);
}

export async function recordInvoicePayment(payment: Payment) {
  const response = await postData(providerCrmApi.invoicePayments(payment.invoiceId), paymentPayload(payment));
  return mapInvoiceWithPayments(response);
}

// ---------------- CHAT ----------------

export async function listProviderChatThreads(options?: CrmRequestOptions) {
  return listMapped(providerCrmApi.chats, mapChatThread, options);
}

export async function getInboxSummary(options?: CrmRequestOptions): Promise<CrmInboxSummary> {
  const response = await getData(providerCrmApi.inboxSummary, undefined, {
    silent: options?.silent ?? true,
    force: options?.force ?? false,
  });
  return mapInboxSummary(response);
}

export const getProviderInboxSummary = getInboxSummary;

export async function sendProviderChatMessage(threadId: string, text: string, attachments?: ChatAttachment[]) {
  const response = await postData(providerCrmApi.chatMessages(threadId), {
    text: text.trim(),
    attachments: (attachments || []).map((att) => ({
      name: att.name,
      url: att.url,
      type: att.type,
    })),
  });
  return mapCrmEntity(response, mapChatThread);
}

export async function markProviderChatRead(threadId: string) {
  return patchData(providerCrmApi.chatRead(threadId), undefined, { silent: true });
}

// ---------------- SNAPSHOT ----------------

export async function loadCrmSnapshot(options?: CrmRequestOptions): Promise<CrmSnapshot> {
  const [
    customersRes,
    employeesRes,
    contractorsRes,
    vendorsRes,
    requestsRes,
    estimatesRes,
    jobsRes,
    tasksRes,
    remindersRes,
    invoicesRes,
    paymentsRes,
    scheduleRes,
    chatsRes,
    inboxSummaryRes,
  ] = await Promise.allSettled([
    listCustomers(options),
    listEmployees(options),
    listContractors(options),
    listVendors(options),
    listRequests(options),
    listEstimates(options),
    listJobs(options),
    listTasks(options),
    listReminders(options),
    listInvoices(options),
    listPayments(options),
    listSchedule(options),
    listProviderChatThreads(options),
    getProviderInboxSummary(options),
  ]);

  return {
    customers: customersRes.status === "fulfilled" ? customersRes.value : [],
    employees: employeesRes.status === "fulfilled" ? employeesRes.value : [],
    contractors: contractorsRes.status === "fulfilled" ? contractorsRes.value : [],
    vendors: vendorsRes.status === "fulfilled" ? vendorsRes.value : [],
    requests: requestsRes.status === "fulfilled" ? requestsRes.value : [],
    estimates: estimatesRes.status === "fulfilled" ? estimatesRes.value : [],
    jobs: jobsRes.status === "fulfilled" ? jobsRes.value : [],
    tasks: tasksRes.status === "fulfilled" ? tasksRes.value : [],
    reminders: remindersRes.status === "fulfilled" ? remindersRes.value : [],
    invoices: invoicesRes.status === "fulfilled" ? invoicesRes.value : [],
    payments: paymentsRes.status === "fulfilled" ? paymentsRes.value : [],
    schedule: scheduleRes.status === "fulfilled" ? scheduleRes.value : [],
    chats: chatsRes.status === "fulfilled" ? chatsRes.value : [],
    inboxSummary:
      inboxSummaryRes.status === "fulfilled"
        ? inboxSummaryRes.value
        : { newLeads: 0, unreadChats: 0, pendingOrders: 0, total: 0 },
  };
}
