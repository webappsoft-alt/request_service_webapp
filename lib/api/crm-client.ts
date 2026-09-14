import { getData, postData, putData, patchData, deleteData } from "@/components/api/apiFuntions";
import { providerCrmApi } from "@/components/api/ApiRoutesFile";
import type {
  PortalContractor,
  PortalCustomerCrm,
  PortalReminder,
  PortalTask,
  PortalVendor,
} from "@/lib/data/crm-people";
import { employeeName, type PortalEmployee, type PortalEventKind, type PortalRequest, type PortalTimeWindow } from "@/lib/data/portal";
import type { Estimate, Invoice, Job, Payment, ServiceAddress } from "@/lib/types";
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
import type { ChatThread } from "@/lib/booking/chat-store";

type CrmRequestOptions = {
  silent?: boolean;
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
  status: string;
};

const DEFAULT_LIST_LIMIT = 100;

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

function estimateItemsToApi(items: Estimate["items"]) {
  return items.map((item) => ({
    id: item.id,
    description: item.description,
    kind: item.type === "materials" ? "material" : "labor",
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    taxRate: item.taxRate,
    total: item.total,
  }));
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

function contractorPayload(contractor: PortalContractor | Partial<PortalContractor>) {
  return {
    firstName: contractor.firstName || "",
    lastName: contractor.lastName || "",
    companyName: contractor.companyName || "",
    email: contractor.email || "",
    phone: contractor.phone || "",
    city: contractor.city || "",
    state: contractor.state || "",
    zip: contractor.zip || "",
    trade: contractor.trade || "",
    license: contractor.license || "",
    status: contractor.status || "active",
    hourlyRate: contractor.hourlyRate ?? 0,
    insuranceExpires: contractor.insuranceExpires || new Date().toISOString(),
  };
}

function vendorPayload(vendor: PortalVendor | Partial<PortalVendor>) {
  return {
    name: vendor.name || "",
    category: vendor.category || "",
    contact: vendor.contact || "",
    email: vendor.email || "",
    phone: vendor.phone || "",
    city: vendor.city || "",
    state: vendor.state || "",
    accountNumber: vendor.accountNumber || "",
    terms: vendor.terms || "Net 30",
    balance: vendor.balance ?? 0,
    status: vendor.status || "active",
  };
}

function requestPayload(request: PortalRequest) {
  return {
    customerId: request.customerId,
    categoryId: request.categoryId || null,
    serviceName: request.serviceName,
    channel: request.channel,
    zip: request.zip,
    city: request.city || "",
    state: request.state || "",
    details: request.details,
    preferredDate: request.preferredDate || null,
    preferredTimeWindow: normalizePreferredTimeWindow(request.preferredTimeWindow),
    status: request.status,
    photos: request.photoUrls,
    answers: request.answers ?? [],
  };
}

function estimatePayload(estimate: Estimate) {
  return {
    customerId: estimate.customerId,
    requestId: estimate.requestId || null,
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
  };
}

function jobPayload(job: Job, employees: PortalEmployee[]) {
  return {
    customerId: job.customerId,
    estimateId: job.estimateId || null,
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

export async function listCustomers(options?: CrmRequestOptions) {
  return listMapped(providerCrmApi.customers, mapPortalCustomerCrm, options);
}

export async function createCustomer(customer: PortalCustomerCrm) {
  const response = await postData(providerCrmApi.customers, customerPayload(customer));
  return mapCrmEntity(response, mapPortalCustomerCrm);
}

export async function archiveCustomer(id: string) {
  return deleteData(providerCrmApi.customer(id), { silent: false });
}

export async function listEmployees(options?: CrmRequestOptions) {
  return listMapped(providerCrmApi.team, mapPortalEmployee, options);
}

export async function listContractors(options?: CrmRequestOptions) {
  return listMapped(providerCrmApi.contractors, mapPortalContractor, options);
}

export async function createContractor(contractor: PortalContractor) {
  const response = await postData(providerCrmApi.contractors, contractorPayload(contractor));
  return mapCrmEntity(response, mapPortalContractor);
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

export async function createVendor(vendor: PortalVendor) {
  const response = await postData(providerCrmApi.vendors, vendorPayload(vendor));
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

export async function createRequest(request: PortalRequest) {
  const response = await postData(providerCrmApi.requests, requestPayload(request));
  return mapCrmEntity(response, mapPortalRequest);
}

export async function updateRequestStatus(id: string, status: PortalRequest["status"]) {
  const response = await patchData(providerCrmApi.requestStatus(id), { status });
  return mapCrmEntity(response, mapPortalRequest);
}

export async function listEstimates(options?: CrmRequestOptions) {
  return listMapped(providerCrmApi.estimates, mapEstimate, options);
}

export async function createEstimate(estimate: Estimate) {
  const response = await postData(providerCrmApi.estimates, estimatePayload(estimate));
  return mapCrmEntity(response, mapEstimate);
}

export async function updateEstimate(id: string, estimate: Estimate) {
  const response = await putData(providerCrmApi.estimate(id), estimatePayload(estimate));
  return mapCrmEntity(response, mapEstimate);
}

export async function shareEstimate(id: string) {
  const response = await postData(providerCrmApi.estimateShare(id), undefined, { silent: false });
  const payload = ((response as { data?: unknown })?.data ?? response) as Partial<CrmEstimateShareResult>;
  return {
    estimateId: String(payload.estimateId ?? id),
    shareToken: String(payload.shareToken ?? ""),
    shareUrl: String(payload.shareUrl ?? ""),
    status: String(payload.status ?? ""),
  } satisfies CrmEstimateShareResult;
}

export async function convertEstimateToJob(id: string) {
  const response = await postData(providerCrmApi.estimateConvertToJob(id), undefined, { silent: false });
  return mapCrmEntity(response, mapJob);
}

export async function listJobs(options?: CrmRequestOptions) {
  return listMapped(providerCrmApi.jobs, mapJob, options);
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
  return mapCrmEntity(response, mapPortalTask);
}

export async function deleteTask(id: string) {
  return deleteData(providerCrmApi.task(id), { silent: false });
}

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

export async function listChats(options?: CrmRequestOptions) {
  return listMapped(providerCrmApi.chats, mapChatThread, options);
}

export async function getInboxSummary(options?: CrmRequestOptions) {
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
