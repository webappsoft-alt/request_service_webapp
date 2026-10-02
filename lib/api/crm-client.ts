import { providerCrmApi, publicApi } from "@/components/api/ApiRoutesFile";
import type {
  CustomerDetailPayload,
  CustomerTimelineEvent,
  PortalContractor,
  PortalCustomerCrm,
  PortalReminder,
  PortalTask,
  PortalVendor,
} from "@/lib/data/crm-people";
import { employeeName, type PortalCalendarEvent, type PortalEmployee, type PortalEmployeeDetail, type PortalEventKind, type PortalRequest, type PortalTimeWindow, type PortalEmployeeWorkingHours } from "@/lib/data/portal";
import type { Estimate, EstimateActivity, EstimateSiteVisitRecord, EstimateStatus, Invoice, Job, Payment, ServiceAddress } from "@/lib/types";
import {
  crmIdOf,
  mapChatThread,
  mapCrmEntity,
  mapCrmList,
  mapCustomerDetail,
  mapCustomerTimelineEvent,
  mapEmployeeDetail,
  mapEstimate,
  mapEstimateActivity,
  mapInboxSummary,
  mapInvoice,
  mapInvoiceWithPayments,
  mapJob,
  mapPayment,
  resolveCrmObjectId,
  mapPortalContractor,
  mapPortalCustomerCrm,
  mapPortalEmployee,
  mapPortalReminder,
  mapPortalRequest,
  mapPortalTask,
  mapPortalVendor,
  mapPortalVendorInventoryItem,
  mapPortalVendorPurchaseOrder,
  mapScheduleEvent,
  type CrmInboxSummary,
  isLocalInvoicePortalKey,
} from "@/lib/api/crm-mappers";
export type { CrmInboxSummary };
import type { ChatThread } from "@/lib/booking/chat-store";
import { emitLeadStatusChange } from "@/components/socket";

/**
 * Lazy axios helpers — avoids store → slice → crm-client → apiFuntions → store
 * circular init while Redux reducers are still loading.
 */
function http() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- deferred to break circular import
  return require("@/components/api/apiFuntions") as typeof import("@/components/api/apiFuntions");
}

function getData(...args: Parameters<typeof import("@/components/api/apiFuntions").getData>) {
  return http().getData(...args);
}

function postData(...args: Parameters<typeof import("@/components/api/apiFuntions").postData>) {
  return http().postData(...args);
}

function putData(...args: Parameters<typeof import("@/components/api/apiFuntions").putData>) {
  return http().putData(...args);
}

function deleteData<T = unknown>(
  endpoint: string,
  options?: Parameters<typeof import("@/components/api/apiFuntions").deleteData>[1],
): Promise<T> {
  return http().deleteData<T>(endpoint, options);
}

function invalidateGetCache(...args: Parameters<typeof import("@/components/api/apiFuntions").invalidateGetCache>) {
  return http().invalidateGetCache(...args);
}

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
    images?: string[];
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
  /** Calendar link only — do not change estimate/job lifecycle status. */
  linkOnly?: boolean;
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

const DEFAULT_LIST_LIMIT = 20;

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
  if (!address) return undefined;
  const line = String(address.address || address.street || "").trim();
  const lat = Number(address.lat ?? address.latitude);
  const lng = Number(address.lng ?? address.longitude);
  return {
    label: address.label || "Primary",
    address: line,
    street: line,
    unit: address.unit || "",
    city: address.city,
    state: address.state,
    zip: address.zip,
    lat: Number.isFinite(lat) ? lat : 0,
    lng: Number.isFinite(lng) ? lng : 0,
    latitude: Number.isFinite(lat) ? lat : 0,
    longitude: Number.isFinite(lng) ? lng : 0,
  };
}

/** Job API location object — GET/POST/PUT use this shape. */
function mapJobLocationForApi(address?: ServiceAddress | null) {
  if (!address) {
    return {
      type: "Point" as const,
      coordinates: [0, 0] as [number, number],
      city: "",
      state: "",
      country: "US",
      zip: "",
      address: "",
    };
  }
  const lng = Number(address.longitude);
  const lat = Number(address.latitude);
  return {
    type: "Point" as const,
    coordinates: [
      Number.isFinite(lng) ? lng : 0,
      Number.isFinite(lat) ? lat : 0,
    ] as [number, number],
    city: address.city || "",
    state: address.state || "",
    country: address.country || "US",
    zip: address.zip || "",
    address: address.address || address.street || "",
  };
}

function estimateItemsToApi(items: Estimate["items"], minQuantity = 0.01) {
  return items
    .filter((item) => String(item.description || "").trim())
    .map((item) => {
      const quantity = Math.max(minQuantity, Number(item.quantity) || 1);
      const unitPrice = Math.max(0, Number(item.unitPrice) || 0);
      const taxRate = Math.max(0, Number(item.taxRate) || 0);
      const itemType = String(item.type).toLowerCase();
      const kind =
        itemType === "materials" || itemType === "material"
          ? "material"
          : itemType === "equipment"
            ? "equipment"
            : "labor";
      const images =
        kind === "material"
          ? (Array.isArray(item.images) ? item.images : [])
              .map((src) => String(src || "").trim())
              .filter(Boolean)
          : [];
      return {
        id: item.id,
        _id: item.id,
        description: String(item.description).trim(),
        kind,
        quantity,
        unitPrice,
        taxRate,
        total: Number(item.total) || quantity * unitPrice,
        ...(images.length ? { images } : {}),
      };
    });
}

function jobItemsToApi(items: Job["items"]) {
  return items.map((item) => {
    const text = String(item.description || "").toLowerCase();
    const isLabor =
      item.kind === "labor" ||
      (item.kind !== "materials" &&
        (text.includes("labor") ||
          text.includes("labour") ||
          String(item.unit || "").toLowerCase() === "hr"));
    const images =
      !isLabor && Array.isArray(item.images)
        ? item.images.filter((src) => Boolean(String(src || "").trim()))
        : [];
    return {
      id: item.id,
      description: item.description,
      kind:
        item.source === "change_order"
          ? "material"
          : isLabor
            ? "labor"
            : "material",
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      taxRate: 0,
      total: item.total,
      ...(images.length ? { images } : {}),
    };
  });
}

function invoiceItemsToApi(items: Invoice["items"]) {
  return items.map((item) => {
    const images = Array.isArray(item.images)
      ? item.images.filter((src) => Boolean(String(src || "").trim()))
      : [];
    const explicitKind =
      item.kind === "labor"
        ? "labor"
        : item.kind === "materials"
          ? "material"
          : null;
    const kind =
      item.source === "change_order"
        ? "fee"
        : item.source === "adjustment"
          ? "discount"
          : explicitKind
            ? explicitKind
            : /material/i.test(item.description)
              ? "material"
              : String(item.unit || "").trim().toLowerCase() === "hr"
                ? "labor"
                : "labor";
    return {
      id: item.id,
      description: item.description,
      kind,
      quantity: item.quantity,
      unit: item.unit || (kind === "labor" ? "hr" : "ea"),
      unitPrice: item.unitPrice,
      taxRate: 0,
      total: item.total,
      ...(images.length && kind === "material" ? { images } : {}),
    };
  });
}

function resolveAssignedEmployeeIds(job: Job, employees: PortalEmployee[]) {
  if (!job.assignedTo) return [];
  const raw = job.assignedTo.trim();
  if (!raw) return [];
  // Dialog stores technician dropdown value as employee id.
  if (employees.some((employee) => employee.id === raw)) return [raw];
  const normalized = raw.toLowerCase();
  const byName = employees
    .filter((employee) => employeeName(employee).trim().toLowerCase() === normalized)
    .map((employee) => employee.id);
  if (byName.length) return byName;
  // Still send the raw value (id) when crew list is empty / not loaded.
  return [raw];
}

function customerPayload(customer: PortalCustomerCrm) {
  const userId = String(customer.userId || "").trim();
  const primary = (customer.addresses || [])[0] || null;
  const serviceAddresses = (customer.addresses || [])
    .map((address) => mapAddressForApi(address))
    .filter(Boolean);
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
    linkedUserId: !userId || userId.startsWith("user_") ? null : userId,
    serviceAddresses,
    location: mapJobLocationForApi(primary),
  };
}

function contractorPayload(contractor: PortalContractor | Partial<PortalContractor>) {
  const payload: Record<string, unknown> = {};
  if (contractor.firstName !== undefined) payload.firstName = contractor.firstName || "";
  if (contractor.lastName !== undefined) payload.lastName = contractor.lastName || "";
  if (contractor.companyName !== undefined) payload.companyName = contractor.companyName || "";
  if (contractor.firstName !== undefined || contractor.lastName !== undefined) {
    payload.contactName = [contractor.firstName || "", contractor.lastName || ""]
      .filter(Boolean)
      .join(" ");
  }
  if (contractor.trade !== undefined) payload.trade = contractor.trade || "";
  if (contractor.email !== undefined) payload.email = contractor.email || "";
  if (contractor.phone !== undefined) payload.phone = contractor.phone || "";
  if (contractor.city !== undefined) payload.city = contractor.city || "";
  if (contractor.state !== undefined) payload.state = contractor.state || "";
  if (contractor.zip !== undefined) payload.zip = contractor.zip || "";
  if (contractor.license !== undefined) payload.license = contractor.license || "";
  if (contractor.status !== undefined) payload.status = contractor.status || "active";
  if (contractor.hourlyRate !== undefined) payload.hourlyRate = contractor.hourlyRate ?? 0;
  if (contractor.overtimeRate !== undefined) payload.overtimeRate = contractor.overtimeRate ?? 0;
  if (contractor.travelRate !== undefined) payload.travelRate = contractor.travelRate ?? 0;
  if (contractor.insuranceExpires !== undefined) {
    payload.insuranceExpires = contractor.insuranceExpires || new Date().toISOString();
  }
  if (contractor.workingHours !== undefined) payload.workingHours = contractor.workingHours;
  return payload;
}

function vendorPayload(vendor: PortalVendor | Partial<PortalVendor>) {
  const payload: Record<string, unknown> = {};
  if (vendor.name !== undefined) {
    payload.name = vendor.name || "";
    payload.vendorName = vendor.name || "";
  }
  if (vendor.category !== undefined) payload.category = vendor.category || "";
  if (vendor.subcategory !== undefined) payload.subcategory = vendor.subcategory || "";
  if (vendor.contact !== undefined) payload.contact = vendor.contact || "";
  if (vendor.notes !== undefined) payload.notes = vendor.notes || "";
  if (vendor.email !== undefined) payload.email = vendor.email || "";
  if (vendor.phone !== undefined) payload.phone = vendor.phone || "";
  const hasLocationFields =
    vendor.street !== undefined ||
    vendor.city !== undefined ||
    vendor.state !== undefined ||
    vendor.zip !== undefined ||
    vendor.latitude !== undefined ||
    vendor.longitude !== undefined;
  if (hasLocationFields) {
    const location = mapJobLocationForApi({
      id: "vendor_loc",
      street: vendor.street || "",
      city: vendor.city || "",
      state: vendor.state || "",
      zip: vendor.zip || "",
      country: "US",
      latitude: vendor.latitude ?? null,
      longitude: vendor.longitude ?? null,
    });
    payload.location = location;
    payload.city = location.city || "";
    payload.state = location.state || "";
  }
  if (vendor.status !== undefined) payload.status = vendor.status || "active";
  if (vendor.accountNumber !== undefined) {
    payload.accountNumber = vendor.accountNumber || "";
    payload.accountNo = vendor.accountNumber || "";
  }
  if (vendor.terms !== undefined) payload.terms = vendor.terms || "Net 30";
  if (vendor.balance !== undefined) payload.balance = vendor.balance ?? 0;
  return payload;
}

function normalizeTimeWindow(val?: string): "morning" | "afternoon" | "all_day" {
  const lower = (val || "").toLowerCase().trim();
  if (lower === "afternoon") return "afternoon";
  if (lower === "all_day" || lower === "all day" || lower === "allday" || lower === "flexible" || lower === "evening") return "all_day";
  return "morning";
}

function requestPayload(request: Partial<PortalRequest>) {
  const payload: Record<string, unknown> = {
    customerId: request.customerId,
    serviceName: request.serviceName || "Service Inquiry",
    channel: request.channel === "marketplace" ? "marketplace" : "direct",
    details: request.details || "",
    preferredTimeWindow: normalizeTimeWindow(request.preferredTimeWindow),
    photos: request.photos ?? request.photoUrls ?? [],
  };
  if (request.preferredDate && request.preferredDate.trim()) {
    payload.preferredDate = request.preferredDate;
  }
  // Provider-added CRM leads must not look like marketplace quote requests.
  if (request.source) {
    payload.source = request.source;
  }
  return payload;
}

function siteVisitPayload(visit?: Estimate["siteVisit"]) {
  if (!visit) return undefined;
  return {
    id: visit.id || "",
    employeeId: visit.employeeId || "",
    technician: visit.technician || "",
    visitedAt: visit.visitedAt || "",
    accessNotes: visit.accessNotes || "",
    findings: visit.findings || "",
    recommendations: visit.recommendations || "",
    measurements: visit.measurements || "",
    label: visit.label || "",
    scheduledAt: visit.scheduledAt || "",
    createdAt: visit.createdAt || "",
    detailsPending: Boolean(visit.detailsPending),
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
    siteVisits: Array.isArray(estimate.siteVisits)
      ? estimate.siteVisits.map((visit) => siteVisitPayload(visit)).filter(Boolean)
      : undefined,
    attachments: estimateAttachmentsToApi(estimate.attachments as unknown[]),
  };
}

function jobPayload(job: Job, _employees: PortalEmployee[] = []) {
  const techId = String(job.assignedEmployeeId || job.assignedTo || "").trim();
  const assignedEmployees = (() => {
    // Explicit empty assignee (clear / unassign).
    if (
      job.assignedEmployeeId === "" ||
      (job.assignedTo === "" && job.assignedEmployeeId === undefined)
    ) {
      return [];
    }
    if (!techId) return resolveAssignedEmployeeIds(job, _employees);
    if (_employees.some((employee) => employee.id === techId)) return [techId];
    return resolveAssignedEmployeeIds({ ...job, assignedTo: techId }, _employees);
  })();
  return {
    customerId: job.customerId,
    estimateId: job.estimateId || null,
    title: job.title || "",
    status: job.status,
    assignedEmployees,
    assignedContractors: [],
    scheduledAt: job.scheduledAt || null,
    dueAt: job.dueAt || null,
    notes: job.notes || "",
    items: jobItemsToApi(job.items),
    attachments: Array.isArray(job.attachments)
      ? job.attachments
          .map((entry) => {
            if (typeof entry === "string") return entry.trim();
            if (entry && typeof entry === "object") {
              const record = entry as { url?: string; dataUrl?: string; attachment?: string };
              return String(record.url || record.dataUrl || record.attachment || "").trim();
            }
            return "";
          })
          .filter(Boolean)
      : [],
    location: mapJobLocationForApi(job.address),
  };
}

function reminderPayload(reminder: PortalReminder | Partial<PortalReminder>) {
  const payload: Record<string, unknown> = {};
  if (reminder.title !== undefined) payload.title = reminder.title;
  if (reminder.status !== undefined) payload.status = reminder.status || "open";
  if (reminder.note !== undefined) payload.note = reminder.note || "";
  if (reminder.isArchived !== undefined) payload.isArchived = Boolean(reminder.isArchived);
  if (reminder.dueAt) {
    payload.dueAt = reminder.dueAt.includes("T")
      ? reminder.dueAt
      : new Date(reminder.dueAt).toISOString();
  }
  const customerId = reminder.customerId || (reminder.subjectKind === "customer" ? reminder.subjectId : undefined);
  if (customerId) payload.customerId = customerId;
  // Match backend CrmReminder subjectKind enum (includes employee / request / invoice).
  const validSubjectKinds = [
    "job",
    "customer",
    "estimate",
    "contractor",
    "vendor",
    "employee",
    "request",
    "invoice",
  ];
  if (reminder.subjectKind && validSubjectKinds.includes(reminder.subjectKind)) {
    payload.subjectKind = reminder.subjectKind;
    if (reminder.subjectId) payload.subjectId = reminder.subjectId;
  }
  // Employee-profile reminders: default assignee to the linked employee when omitted.
  const assignedEmployeeId =
    reminder.assignedEmployeeId ||
    (reminder.subjectKind === "employee" ? reminder.subjectId : undefined);
  if (assignedEmployeeId) payload.assignedEmployeeId = assignedEmployeeId;
  const assignedContractorId =
    reminder.assignedContractorId ||
    (reminder.subjectKind === "contractor" ? reminder.subjectId : undefined);
  if (assignedContractorId) payload.assignedContractorId = assignedContractorId;
  const assignedVendorId =
    reminder.assignedVendorId ||
    (reminder.subjectKind === "vendor" ? reminder.subjectId : undefined);
  if (assignedVendorId) payload.assignedVendorId = assignedVendorId;
  return payload;
}

function taskPayload(task: PortalTask) {
  const validSubjectKinds = [
    "job",
    "customer",
    "estimate",
    "contractor",
    "vendor",
    "request",
  ] as const;

  const subjectKind = normalizeStatus(
    task.subjectKind,
    validSubjectKinds,
    "customer",
  );

  const payload: Record<string, unknown> = {
    title: task.title,
    priority: task.priority || "normal",
    status: task.status || "open",
    subjectKind,
    subjectId: task.subjectId || null,
    customerId: task.customerId || (subjectKind === "customer" ? task.subjectId : null) || null,
    jobId: task.jobId || (subjectKind === "job" ? task.subjectId : null) || null,
    assignedEmployeeId: task.assignedEmployeeId || null,
    assignedContractorId:
      task.assignedContractorId ||
      (subjectKind === "contractor" && task.subjectId ? task.subjectId : null),
    assignedVendorId:
      task.assignedVendorId ||
      (subjectKind === "vendor" && task.subjectId ? task.subjectId : null),
  };

  if (task.note) payload.note = task.note;
  if (task.dueAt) {
    payload.dueAt = task.dueAt.includes("T")
      ? task.dueAt
      : new Date(task.dueAt).toISOString();
  }

  return payload;
}

function invoicePayload(invoice: Invoice | Partial<Invoice>) {
  const payload: Record<string, unknown> = {};
  if (invoice.customerId !== undefined) payload.customerId = invoice.customerId;
  if (invoice.jobId !== undefined) payload.jobId = invoice.jobId || null;
  if (invoice.status !== undefined) payload.status = invoice.status;
  if (invoice.issuedAt !== undefined) payload.issuedAt = invoice.issuedAt;
  if (invoice.dueAt !== undefined) payload.dueAt = invoice.dueAt || undefined;
  if (invoice.items !== undefined) payload.items = invoiceItemsToApi(invoice.items);
  if (invoice.discount !== undefined) payload.discount = invoice.discount;
  if (invoice.isArchived !== undefined) payload.isArchived = Boolean(invoice.isArchived);
  if (invoice.attachments !== undefined) {
    payload.attachments = estimateAttachmentsToApi(invoice.attachments as unknown[]);
  }
  // Preserve portal keys like inv_xxx so GET /invoices/inv_xxx resolves.
  if (typeof invoice.id === "string" && /^inv_/i.test(invoice.id.trim())) {
    payload.clientId = invoice.id.trim();
  }
  payload.notes = "";
  payload.terms = "";
  return payload;
}

async function listMapped<T>(
  endpoint: string,
  mapper: (value: unknown) => T | null,
  options: CrmRequestOptions = {},
) {
  const response = await getData(endpoint, { page: 1, limit: DEFAULT_LIST_LIMIT }, {
    silent: options.silent ?? true,
    force: options.force ?? false,
  });
  return mapCrmList(response, mapper).items;
}

export type CrmListQuery = {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  /** Soft-archive filter — independent of lifecycle `status`. */
  isArchived?: boolean;
  jobId?: string;
  customerId?: string;
  employeeId?: string;
  contractorId?: string;
  vendorId?: string;
  subjectId?: string;
  trade?: string;
  role?: string;
  active?: boolean;
  category?: string;
  assignedEmployeeId?: string;
  assignedContractorId?: string;
  assignedVendorId?: string;
  subjectKind?: string;
  priority?: string;
  kind?: string;
  startDate?: string;
  endDate?: string;
  /** Calendar event linked record (lead / estimate / job / task id) */
  recordId?: string;
  type?: string;
  silent?: boolean;
  force?: boolean;
  requestId?: string;
};

function buildListParams(query: CrmListQuery, defaultLimit = DEFAULT_LIST_LIMIT) {
  const page = Math.max(1, query.page ?? 1);
  const limit = Math.max(1, query.limit ?? defaultLimit);
  const params: Record<string, string | number | boolean> = { page, limit };
  const search = query.search?.trim();
  const status = query.status?.trim();
  const jobId = query.jobId?.trim();
  const customerId = query.customerId?.trim();
  const employeeId = query.employeeId?.trim();
  const contractorId = query.contractorId?.trim();
  const vendorId = query.vendorId?.trim();
  const subjectId = query.subjectId?.trim();
  const requestId = query.requestId?.trim();
  const trade = query.trade?.trim();
  const role = query.role?.trim();
  const category = query.category?.trim();
  const assignedEmployeeId = query.assignedEmployeeId?.trim();
  const assignedContractorId = query.assignedContractorId?.trim();
  const assignedVendorId = query.assignedVendorId?.trim();
  const subjectKind = query.subjectKind?.trim();
  const priority = query.priority?.trim();
  const kind = query.kind?.trim();
  const startDate = query.startDate?.trim();
  const endDate = query.endDate?.trim();
  const type = query.type?.trim();
  if (search) params.search = search;
  if (status) params.status = status;
  if (typeof query.isArchived === "boolean") params.isArchived = query.isArchived;
  if (jobId) params.jobId = jobId;
  if (customerId) params.customerId = customerId;
  if (employeeId) params.employeeId = employeeId;
  if (contractorId) params.contractorId = contractorId;
  if (vendorId) params.vendorId = vendorId;
  if (subjectId) params.subjectId = subjectId;
  if (requestId) params.requestId = requestId;
  if (trade) params.trade = trade;
  if (role) params.role = role;
  if (category) params.category = category;
  if (assignedEmployeeId) params.assignedEmployeeId = assignedEmployeeId;
  if (assignedContractorId) params.assignedContractorId = assignedContractorId;
  if (assignedVendorId) params.assignedVendorId = assignedVendorId;
  if (subjectKind) params.subjectKind = subjectKind;
  if (priority) params.priority = priority;
  if (kind) params.kind = kind;
  if (startDate) params.startDate = startDate;
  if (endDate) params.endDate = endDate;
  if (type) params.type = type;
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
  const detail = await getCustomerDetail(id);
  return detail?.customer ?? null;
}

/** GET /api/provider/customers/:id — customer + dossier. */
export async function getCustomerDetail(id: string): Promise<CustomerDetailPayload | null> {
  try {
    const response = await getData(providerCrmApi.customer(id), undefined, { silent: true, force: true });
    return mapCustomerDetail(response);
  } catch {
    return null;
  }
}

/** GET /api/provider/customers/:id/timeline */
export async function queryCustomerTimeline(
  id: string,
  query: Pick<CrmListQuery, "page" | "limit" | "type" | "silent" | "force"> = {},
) {
  const page = Math.max(1, query.page ?? 1);
  const limit = Math.max(1, query.limit ?? 10);
  const params: Record<string, string | number> = { page, limit };
  const type = query.type?.trim();
  if (type) params.type = type;
  const response = await getData(providerCrmApi.customerTimeline(id), params, {
    silent: query.silent ?? true,
    force: query.force ?? true,
  });
  return mapCrmList(response, mapCustomerTimelineEvent);
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
    const serviceAddresses = full.addresses
      .map((address) => mapAddressForApi(address))
      .filter(Boolean);
    payload.serviceAddresses = serviceAddresses;
    payload.location = mapJobLocationForApi(full.addresses[0] || null);
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
  if (employee.firstName !== undefined || employee.lastName !== undefined) {
    payload.name = [employee.firstName || "", employee.lastName || ""].filter(Boolean).join(" ");
  }
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

export type DeleteEmployeeResult = {
  message?: string;
  id?: string;
  requiresReassignment?: boolean;
  pendingTasksCount?: number;
};

export async function deleteEmployee(id: string) {
  const response = await deleteData<unknown>(providerCrmApi.teamMember(id), { silent: false });
  const payload =
    response && typeof response === "object" && "data" in response
      ? (response as { data?: DeleteEmployeeResult }).data
      : (response as DeleteEmployeeResult | null);
  return {
    id,
    message: payload?.message,
    requiresReassignment: Boolean(payload?.requiresReassignment),
    pendingTasksCount: Number(payload?.pendingTasksCount ?? 0),
  } satisfies DeleteEmployeeResult & { id: string };
}

/** POST /api/provider/team/:id/attachments */
export async function addEmployeeAttachment(
  employeeId: string,
  attachment: {
    name: string;
    url: string;
    fileType?: string;
    sizeBytes?: number;
    category?: string;
  },
) {
  const response = await postData(providerCrmApi.teamMemberAttachments(employeeId), {
    name: attachment.name,
    url: attachment.url,
    fileType: attachment.fileType || "",
    sizeBytes: attachment.sizeBytes ?? 0,
    category: attachment.category || "other",
  });
  const mapped = mapCrmEntity(response, mapPortalEmployee);
  if (mapped) return mapped;
  const detail = await getEmployeeDetail(employeeId);
  return detail?.employee ?? null;
}

/** DELETE /api/provider/team/:id/attachments/:attachmentId */
export async function deleteEmployeeAttachment(employeeId: string, attachmentId: string) {
  await deleteData(providerCrmApi.teamMemberAttachment(employeeId, attachmentId), {
    silent: false,
  });
  const detail = await getEmployeeDetail(employeeId);
  return detail?.employee ?? null;
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
  const response = await postData(
    providerCrmApi.contractors,
    contractorPayload({
      firstName: contractor.firstName,
      lastName: contractor.lastName,
      companyName: contractor.companyName,
      trade: contractor.trade,
      email: contractor.email,
      phone: contractor.phone,
      city: contractor.city,
      state: contractor.state,
      zip: contractor.zip,
      license: contractor.license,
      status: contractor.status,
      hourlyRate: contractor.hourlyRate,
      insuranceExpires: contractor.insuranceExpires,
    }),
  );
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
  const mapped = mapCrmEntity(response, mapPortalContractor);
  if (mapped) return mapped;
  return getContractor(id);
}

export async function deleteContractor(id: string) {
  return deleteData(providerCrmApi.contractor(id), { silent: false });
}

/** POST /api/provider/contractors/:id/attachments */
export async function addContractorAttachment(
  contractorId: string,
  attachment: {
    name: string;
    url: string;
    fileType?: string;
    sizeBytes?: number;
    category?: string;
  },
) {
  const response = await postData(providerCrmApi.contractorAttachments(contractorId), {
    name: attachment.name,
    url: attachment.url,
    fileType: attachment.fileType || "",
    sizeBytes: attachment.sizeBytes ?? 0,
    category: attachment.category || "other",
  });
  const mapped = mapCrmEntity(response, mapPortalContractor);
  if (mapped) return mapped;
  return getContractor(contractorId);
}

/** DELETE /api/provider/contractors/:id/attachments/:attachmentId */
export async function deleteContractorAttachment(contractorId: string, attachmentId: string) {
  await deleteData(providerCrmApi.contractorAttachment(contractorId, attachmentId), {
    silent: false,
  });
  return getContractor(contractorId);
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
  const mapped = mapCrmEntity(response, mapPortalVendor);
  if (!mapped) return null;
  const root = (response as { data?: { stats?: Record<string, unknown> } })?.data;
  const stats = root?.stats;
  if (!stats) return mapped;
  return {
    ...mapped,
    totalSkus:
      typeof stats.totalSkus === "number" ? stats.totalSkus : mapped.totalSkus,
    inventoryOnHandValue:
      typeof stats.totalOnHandValue === "number"
        ? stats.totalOnHandValue
        : mapped.inventoryOnHandValue,
  };
}

export async function updateVendor(id: string, patch: Partial<PortalVendor>) {
  const response = await putData(providerCrmApi.vendor(id), vendorPayload(patch));
  return mapCrmEntity(response, mapPortalVendor);
}

export async function deleteVendor(id: string) {
  return deleteData(providerCrmApi.vendor(id), { silent: false });
}

export async function listVendorInventory(
  vendorId: string,
  query: CrmListQuery = {},
) {
  const params = buildListParams(query);
  const response = await getData(providerCrmApi.vendorInventory(vendorId), params, {
    silent: query.silent ?? true,
    force: query.force ?? true,
  });
  const list = mapCrmList(response, mapPortalVendorInventoryItem);
  const data = (response as { stats?: { totalSkus?: number; totalOnHandValue?: number } })?.stats
    ?? (response as { data?: { stats?: { totalSkus?: number; totalOnHandValue?: number } } })?.data?.stats;
  return {
    ...list,
    stats: {
      totalSkus: data?.totalSkus ?? list.items.length,
      totalOnHandValue:
        data?.totalOnHandValue ??
        list.items.reduce((sum, item) => sum + (item.totalValue ?? item.onHandCount * item.unitCost), 0),
    },
  };
}

export async function addVendorInventoryItem(
  vendorId: string,
  item: {
    sku: string;
    name: string;
    unit?: string;
    onHandCount?: number;
    reorderPoint?: number;
    unitCost?: number;
    location?: string;
  },
) {
  const response = await postData(providerCrmApi.vendorInventory(vendorId), {
    sku: item.sku,
    item: item.name,
    name: item.name,
    unit: item.unit || "ea",
    onHand: item.onHandCount ?? 0,
    reorderAt: item.reorderPoint ?? 0,
    cost: item.unitCost ?? 0,
    location: item.location || "",
  });
  invalidateGetCache(providerCrmApi.vendor(vendorId));
  invalidateGetCache(providerCrmApi.vendorInventory(vendorId));
  // Prefer refreshed vendor; fall back to mapping single item response.
  const vendor = await getVendor(vendorId);
  if (vendor) return vendor;
  const mapped = mapCrmEntity(response, mapPortalVendor);
  return mapped;
}

export async function receiveVendorInventory(
  vendorId: string,
  skuId: string,
  quantity: number,
) {
  await postData(providerCrmApi.vendorInventoryReceive(vendorId, skuId), {
    quantity,
    receivedCount: quantity,
  });
  invalidateGetCache(providerCrmApi.vendor(vendorId));
  invalidateGetCache(providerCrmApi.vendorInventory(vendorId));
  return getVendor(vendorId);
}

export async function deleteVendorInventoryItem(vendorId: string, skuId: string) {
  await deleteData(providerCrmApi.vendorInventoryItem(vendorId, skuId), { silent: false });
  invalidateGetCache(providerCrmApi.vendor(vendorId));
  invalidateGetCache(providerCrmApi.vendorInventory(vendorId));
  return getVendor(vendorId);
}

export async function listVendorOrders(vendorId: string, query: CrmListQuery = {}) {
  const params = buildListParams(query);
  const response = await getData(providerCrmApi.vendorOrders(vendorId), params, {
    silent: query.silent ?? true,
    force: query.force ?? true,
  });
  return mapCrmList(response, mapPortalVendorPurchaseOrder);
}

export async function createVendorOrder(
  vendorId: string,
  order: {
    poNumber?: string;
    amount: number;
    description: string;
    jobId?: string;
    status?: string;
  },
) {
  await postData(providerCrmApi.vendorOrders(vendorId), {
    poNumber: order.poNumber,
    amount: order.amount,
    description: order.description,
    whatWasOrdered: order.description,
    jobId: order.jobId || null,
    status: order.status || "issued",
  });
  invalidateGetCache(providerCrmApi.vendor(vendorId));
  invalidateGetCache(providerCrmApi.vendorOrders(vendorId));
  return getVendor(vendorId);
}

export async function updateVendorOrder(
  vendorId: string,
  orderId: string,
  patch: { status?: string; amount?: number; description?: string; jobId?: string | null },
) {
  await putData(providerCrmApi.vendorOrder(vendorId, orderId), patch);
  invalidateGetCache(providerCrmApi.vendor(vendorId));
  invalidateGetCache(providerCrmApi.vendorOrders(vendorId));
  return getVendor(vendorId);
}

export async function deleteVendorOrder(vendorId: string, orderId: string) {
  await deleteData(providerCrmApi.vendorOrder(vendorId, orderId), { silent: false });
  invalidateGetCache(providerCrmApi.vendor(vendorId));
  invalidateGetCache(providerCrmApi.vendorOrders(vendorId));
  return getVendor(vendorId);
}

export async function listVendorJobs(vendorId: string, query: CrmListQuery = {}) {
  const params = buildListParams(query);
  const response = await getData(providerCrmApi.vendorJobs(vendorId), params, {
    silent: query.silent ?? true,
    force: query.force ?? true,
  });
  return mapCrmList(response, mapJob);
}

export async function addVendorAttachment(
  vendorId: string,
  attachment: {
    name: string;
    url: string;
    fileType?: string;
    sizeBytes?: number;
    category?: string;
  },
) {
  await postData(providerCrmApi.vendorAttachments(vendorId), {
    name: attachment.name,
    url: attachment.url,
    fileType: attachment.fileType || "",
    sizeBytes: attachment.sizeBytes ?? 0,
    category: attachment.category || "other",
  });
  invalidateGetCache(providerCrmApi.vendor(vendorId));
  return getVendor(vendorId);
}

export async function deleteVendorAttachment(vendorId: string, attachmentId: string) {
  await deleteData(providerCrmApi.vendorAttachment(vendorId, attachmentId), {
    silent: false,
  });
  invalidateGetCache(providerCrmApi.vendor(vendorId));
  return getVendor(vendorId);
}

export async function listRequests(options?: CrmRequestOptions) {
  return listMapped(providerCrmApi.requests, mapPortalRequest, options);
}

export async function queryRequests(query: CrmListQuery = {}) {
  const page = Math.max(1, query.page ?? 1);
  const limit = Math.max(1, query.limit ?? DEFAULT_LIST_LIMIT);
  const params: Record<string, string | number> = { page, limit };
  const search = query.search?.trim();
  const status = query.status?.trim();
  const customerId = query.customerId?.trim();
  if (search) params.search = search;
  if (status) params.status = status;
  if (customerId) params.customerId = customerId;
  const response = await getData(providerCrmApi.requests, params, {
    silent: query.silent ?? true,
    force: query.force ?? true,
  });
  return mapCrmList(response, mapPortalRequest);
}

export async function getRequest(id: string, options?: CrmRequestOptions) {
  try {
    const response = await getData(providerCrmApi.request(id), undefined, {
      silent: options?.silent ?? true,
      force: true,
    });
    return mapCrmEntity(response, mapPortalRequest);
  } catch {
    return null;
  }
}

export async function createRequest(request: Partial<PortalRequest>) {
  const response = await postData(providerCrmApi.requests, requestPayload(request));
  return mapCrmEntity(response, mapPortalRequest);
}

export async function updateRequestStatus(id: string, status: PortalRequest["status"]) {
  const response = await putData(providerCrmApi.requestStatus(id), { status });
  const mapped = mapCrmEntity(response, mapPortalRequest);
  try {
    emitLeadStatusChange(id, status);
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("rs-lead-status", {
          detail: { id, status },
        }),
      );
    }
  } catch {
    /* non-blocking */
  }
  return mapped;
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

/** Paginated estimates list — supports `status`, `isArchived`, `customerId`, `contractorId`, `employeeId`, and `search`. */
export async function queryEstimates(query: CrmListQuery = {}) {
  const page = Math.max(1, query.page ?? 1);
  const limit = Math.max(1, query.limit ?? DEFAULT_LIST_LIMIT);
  const params: Record<string, string | number | boolean> = { page, limit };
  const search = query.search?.trim();
  const status = query.status?.trim();
  const customerId = query.customerId?.trim();
  const contractorId = query.contractorId?.trim();
  const employeeId = query.employeeId?.trim();
  const requestId = query.requestId?.trim();
  if (search) params.search = search;
  if (status) params.status = status;
  // Always send archive flag so active boards never mix archived rows.
  params.isArchived = query.isArchived === true;
  if (customerId) params.customerId = customerId;
  if (contractorId) params.contractorId = contractorId;
  if (employeeId) params.employeeId = employeeId;
  if (requestId) params.requestId = requestId;
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
  try {
    const response = await getData(providerCrmApi.estimate(id), undefined, { silent: true, force: true });
    return mapCrmEntity(response, mapEstimate);
  } catch {
    return null;
  }
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
    address?: string;
    street?: string;
    city?: string;
    state?: string;
    zip?: string;
    unit?: string;
    lat?: number | null;
    lng?: number | null;
    latitude?: number | null;
    longitude?: number | null;
  };
  notes?: string;
  terms?: string;
};

export async function updateEstimateSettings(id: string, settings: EstimateSettingsPayload) {
  const payload: Record<string, unknown> = {};
  if (settings.title !== undefined) payload.title = settings.title.trim();
  // Status / customerId / notes / terms are not updated via this settings form.
  if (settings.issuedAt !== undefined) payload.issuedAt = settings.issuedAt;
  if (settings.expiresAt !== undefined && settings.expiresAt !== null && settings.expiresAt !== "") {
    payload.expiresAt = settings.expiresAt;
  }
  if (settings.propertyAddress !== undefined) {
    const line = String(
      settings.propertyAddress.address ||
        settings.propertyAddress.street ||
        "",
    ).trim();
    const lat = Number(
      settings.propertyAddress.lat ?? settings.propertyAddress.latitude,
    );
    const lng = Number(
      settings.propertyAddress.lng ?? settings.propertyAddress.longitude,
    );
    payload.propertyAddress = {
      address: line,
      street: line,
      city: settings.propertyAddress.city || "",
      state: settings.propertyAddress.state || "",
      zip: settings.propertyAddress.zip || "",
      unit: settings.propertyAddress.unit || "",
      lat: Number.isFinite(lat) ? lat : 0,
      lng: Number.isFinite(lng) ? lng : 0,
      latitude: Number.isFinite(lat) ? lat : 0,
      longitude: Number.isFinite(lng) ? lng : 0,
    };
  }

  const response = await putData(providerCrmApi.estimate(id), payload, { silent: false });
  return mapCrmEntity(response, mapEstimate);
}

export async function updateEstimateSiteVisit(
  id: string,
  siteVisit: EstimateSiteVisitRecord,
  status?: EstimateStatus,
  siteVisits?: EstimateSiteVisitRecord[],
) {
  const payload: Record<string, unknown> = {
    siteVisit: siteVisitPayload(siteVisit),
  };
  if (status !== undefined) payload.status = status;
  if (siteVisits !== undefined) {
    payload.siteVisits = siteVisits
      .map((visit) => siteVisitPayload(visit))
      .filter(Boolean);
  }
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

export async function updateEstimateArchive(id: string, isArchived: boolean) {
  const response = await putData(
    providerCrmApi.estimate(id),
    { isArchived },
    { silent: false },
  );
  return mapCrmEntity(response, mapEstimate);
}

export async function deleteEstimate(id: string) {
  return deleteData(providerCrmApi.estimate(id), { silent: false });
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

export type ShareEstimateInput = {
  companySignedBy?: string;
  companySignedAt?: string;
  companySignatureDataUrl?: string;
};

export async function shareEstimate(id: string, input?: ShareEstimateInput) {
  const image = String(input?.companySignatureDataUrl || "").trim();
  const signedBy = String(input?.companySignedBy || "").trim();
  const signedAt = input?.companySignedAt || new Date().toISOString();
  const body =
    image || signedBy
      ? {
          companySignature: {
            signedBy,
            ...(image ? { signatureImageBase64: image } : {}),
            signedAt,
          },
          companySignedBy: signedBy || undefined,
          ...(image ? { companySignatureDataUrl: image } : {}),
          companySignedAt: signedAt,
        }
      : undefined;
  const response = await postData(
    providerCrmApi.estimateShare(id),
    body,
    { silent: false },
  );
  const raw = ((response as { data?: unknown })?.data ?? response) as Record<string, unknown> | null;
  const payload = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const nestedEst = (payload.estimate && typeof payload.estimate === "object" ? payload.estimate : {}) as Record<string, unknown>;

  const shareToken = String(
    payload.shareToken ??
    payload.token ??
    payload.share_token ??
    nestedEst.shareToken ??
    nestedEst.token ??
    nestedEst.share_token ??
    ""
  ).trim();

  const shareUrl = String(
    payload.shareUrl ??
    payload.customerUrl ??
    payload.publicUrl ??
    nestedEst.shareUrl ??
    nestedEst.customerUrl ??
    ""
  ).trim();

  return {
    estimateId: String(payload.estimateId ?? payload.id ?? payload._id ?? nestedEst.id ?? nestedEst._id ?? id),
    shareToken,
    shareUrl: shareUrl || (shareToken ? `/e/${shareToken}` : ""),
    absoluteShareUrl: payload.absoluteShareUrl
      ? String(payload.absoluteShareUrl)
      : undefined,
    status: String(payload.status ?? nestedEst.status ?? ""),
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
  const record = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return {
    id: id || `act_${Date.now()}`,
    estimateId,
    title: payload.title.trim(),
    description: payload.description,
    actor: typeof record.actor === "string" ? record.actor : "Desk",
    createdAt:
      (typeof record.timestamp === "string" && record.timestamp) ||
      (typeof record.createdAt === "string" && record.createdAt) ||
      new Date().toISOString(),
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
  const response = await putData(
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

type JobActivityPayload = {
  title: string;
  description: string;
};

export async function listJobActivities(
  jobId: string,
): Promise<EstimateActivity[]> {
  const response = await getData(
    providerCrmApi.jobActivities(jobId),
    undefined,
    { silent: true, force: true },
  );
  return mapCrmList(response, mapEstimateActivity).items;
}

export async function createJobActivity(
  jobId: string,
  payload: JobActivityPayload,
): Promise<EstimateActivity | null> {
  const response = await postData(
    providerCrmApi.jobActivities(jobId),
    {
      title: payload.title.trim(),
      description: payload.description,
    },
    { silent: false },
  );
  const mapped = mapCrmEntity(response, mapEstimateActivity);
  if (mapped) return { ...mapped, jobId };
  const raw = (response as { data?: unknown })?.data ?? response;
  const id = crmIdOf(raw);
  const record = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return {
    id: id || `act_${Date.now()}`,
    jobId,
    title: payload.title.trim(),
    description: payload.description,
    actor: typeof record.actor === "string" ? record.actor : "Desk",
    createdAt:
      (typeof record.timestamp === "string" && record.timestamp) ||
      (typeof record.createdAt === "string" && record.createdAt) ||
      new Date().toISOString(),
  };
}

export async function updateJobActivity(
  jobId: string,
  activityId: string,
  payload: JobActivityPayload,
): Promise<EstimateActivity | null> {
  const response = await putData(
    providerCrmApi.jobActivity(jobId, activityId),
    {
      title: payload.title.trim(),
      description: payload.description,
    },
    { silent: false },
  );
  const mapped = mapCrmEntity(response, mapEstimateActivity);
  if (mapped) return { ...mapped, jobId };
  return {
    id: activityId,
    jobId,
    title: payload.title.trim(),
    description: payload.description,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export async function deleteJobActivity(
  jobId: string,
  activityId: string,
): Promise<boolean> {
  await deleteData(providerCrmApi.jobActivity(jobId, activityId), {
    silent: false,
  });
  return true;
}

export async function getJob(id: string) {
  try {
    const response = await getData(providerCrmApi.job(id), undefined, { silent: true, force: true });
    return mapCrmEntity(response, mapJob);
  } catch {
    return null;
  }
}

export async function deleteJob(id: string) {
  return deleteData(providerCrmApi.job(id), { silent: false });
}

export async function listJobs(options?: CrmRequestOptions) {
  return listMapped(providerCrmApi.jobs, mapJob, options);
}

/** Paginated jobs — page/limit/search/status/isArchived. */
export async function queryJobs(query: CrmListQuery = {}) {
  const params = buildListParams(query);
  // Always send archive flag so active boards never mix archived rows.
  params.isArchived = query.isArchived === true;
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
  // Settings / general updates must not wipe attachments — use updateJobAttachments.
  const payload = jobPayload(job, employees) as Record<string, unknown>;
  delete payload.attachments;
  const response = await putData(providerCrmApi.job(id), payload);
  return mapCrmEntity(response, mapJob);
}

export async function updateJobAttachments(id: string, attachments: string[]) {
  const response = await putData(
    providerCrmApi.job(id),
    { attachments },
    { silent: false },
  );
  return mapCrmEntity(response, mapJob);
}

export async function updateJobStatus(id: string, status: Job["status"], notes = "") {
  const response = await putData(providerCrmApi.jobStatus(id), { status, notes });
  return mapCrmEntity(response, mapJob);
}

export async function updateJobArchive(id: string, isArchived: boolean) {
  const response = await putData(
    providerCrmApi.job(id),
    { isArchived },
    { silent: false },
  );
  return mapCrmEntity(response, mapJob);
}

export async function convertJobToInvoice(
  id: string,
  options?: { clientId?: string },
) {
  // Do not invent random inv_* keys for URLs — portal routes use the Mongo id
  // returned on the invoice. Optional clientId is only for explicit callers.
  const body =
    options?.clientId && String(options.clientId).trim()
      ? { clientId: String(options.clientId).trim().slice(0, 80) }
      : undefined;
  const response = await postData(
    providerCrmApi.jobConvertToInvoice(id),
    body,
    { silent: false },
  );
  return mapCrmEntity(response, mapInvoice);
}

export async function listTasks(options?: CrmRequestOptions) {
  return listMapped(providerCrmApi.tasks, mapPortalTask, options);
}

/** GET /api/provider/tasks/:id */
export async function getTask(id: string) {
  try {
    const response = await getData(providerCrmApi.task(id), undefined, {
      silent: true,
      force: true,
    });
    return mapCrmEntity(response, mapPortalTask);
  } catch {
    return null;
  }
}

/** Paginated tasks — page/limit/customerId/status/priority/search. */
export async function queryTasks(query: CrmListQuery = {}) {
  const params = buildListParams(query);
  const response = await getData(providerCrmApi.tasks, params, {
    silent: query.silent ?? true,
    force: query.force ?? true,
  });
  return mapCrmList(response, mapPortalTask);
}

export async function createTask(task: PortalTask) {
  const response = await postData(providerCrmApi.tasks, taskPayload(task));
  invalidateGetCache(providerCrmApi.tasks);
  return mapCrmEntity(response, mapPortalTask);
}

export async function updateTask(id: string, task: PortalTask) {
  const response = await putData(providerCrmApi.task(id), taskPayload(task));
  invalidateGetCache(providerCrmApi.tasks);
  return mapCrmEntity(response, mapPortalTask);
}

export async function updateTaskStatus(id: string, status: PortalTask["status"]) {
  const response = await putData(providerCrmApi.taskStatus(id), { status });
  invalidateGetCache(providerCrmApi.tasks);
  return mapCrmEntity(response, mapPortalTask);
}

export async function deleteTask(id: string) {
  const result = await deleteData(providerCrmApi.task(id), { silent: false });
  invalidateGetCache(providerCrmApi.tasks);
  return result;
}

export async function listReminders(options?: CrmRequestOptions) {
  return listMapped(providerCrmApi.reminders, mapPortalReminder, options);
}

/** Paginated reminders — page/limit/status/customerId/employeeId/contractorId/vendorId/subjectId/assignedEmployeeId/assignedContractorId/assignedVendorId/subjectKind/search. */
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
  invalidateGetCache(providerCrmApi.reminders);
  return mapCrmEntity(response, mapPortalReminder);
}

export async function updateReminder(id: string, reminder: PortalReminder | Partial<PortalReminder>) {
  const payload = reminderPayload(reminder);
  const response = await putData(providerCrmApi.reminder(id), payload);
  invalidateGetCache(providerCrmApi.reminders);
  return mapCrmEntity(response, mapPortalReminder);
}

export async function updateReminderArchive(id: string, isArchived: boolean) {
  const response = await putData(providerCrmApi.reminder(id), { isArchived });
  invalidateGetCache(providerCrmApi.reminders);
  return mapCrmEntity(response, mapPortalReminder);
}

export async function updateReminderStatus(id: string, status: PortalReminder["status"]) {
  const response = await putData(providerCrmApi.reminderStatus(id), { status });
  invalidateGetCache(providerCrmApi.reminders);
  return mapCrmEntity(response, mapPortalReminder);
}

export async function deleteReminder(id: string) {
  const result = await deleteData(providerCrmApi.reminder(id), { silent: false });
  invalidateGetCache(providerCrmApi.reminders);
  return result;
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

function requireInvoiceId(id: string) {
  const raw = String(id || "").trim();
  if (!raw) {
    throw new Error("Invoice id is required.");
  }
  // Prefer Mongo ObjectId when present; otherwise pass portal clientId through.
  return resolveCrmObjectId(raw) || raw;
}

export async function updateInvoice(id: string, invoice: Invoice | Partial<Invoice>) {
  const invoiceRef = requireInvoiceId(id);
  const response = await putData(providerCrmApi.invoice(invoiceRef), invoicePayload(invoice));
  invalidateGetCache(providerCrmApi.invoices);
  invalidateGetCache(providerCrmApi.invoice(invoiceRef));
  return mapCrmEntity(response, mapInvoice);
}

export async function updateInvoiceArchive(id: string, isArchived: boolean) {
  const invoiceRef = requireInvoiceId(id);
  const response = await putData(
    providerCrmApi.invoice(invoiceRef),
    { isArchived },
    { silent: false },
  );
  invalidateGetCache(providerCrmApi.invoices);
  invalidateGetCache(providerCrmApi.invoice(invoiceRef));
  return mapCrmEntity(response, mapInvoice);
}

export async function updateInvoiceAttachments(
  id: string,
  attachments: Array<{ name: string; attachment: string }>,
) {
  const invoiceRef = requireInvoiceId(id);
  const response = await putData(
    providerCrmApi.invoice(invoiceRef),
    { attachments },
    { silent: false },
  );
  invalidateGetCache(providerCrmApi.invoices);
  invalidateGetCache(providerCrmApi.invoice(invoiceRef));
  return mapCrmEntity(response, mapInvoice);
}

export async function sendInvoice(id: string) {
  const invoiceRef = requireInvoiceId(id);
  const response = await postData(providerCrmApi.invoiceSend(invoiceRef), undefined, { silent: false });
  invalidateGetCache(providerCrmApi.invoices);
  invalidateGetCache(providerCrmApi.invoice(invoiceRef));
  const data =
    response && typeof response === "object" && "data" in response
      ? (response as { data?: { invoice?: unknown } }).data
      : undefined;
  if (data?.invoice) {
    return mapInvoice(data.invoice);
  }
  const detail = await getInvoiceWithPayments(invoiceRef);
  return detail?.invoice ?? null;
}

export async function getInvoiceWithPayments(id: string) {
  try {
    const invoiceRef = requireInvoiceId(id);
    const response = await getData(providerCrmApi.invoice(invoiceRef), undefined, {
      silent: true,
      force: true,
    });
    return mapInvoiceWithPayments(response);
  } catch {
    return null;
  }
}

export async function getInvoice(id: string): Promise<Invoice | null> {
  const detail = await getInvoiceWithPayments(id);
  return detail?.invoice ?? null;
}

export async function recordInvoicePayment(invoiceId: string, payment: Payment) {
  const invoiceRef = requireInvoiceId(invoiceId);
  const response = await postData(providerCrmApi.invoicePayments(invoiceRef), {
    amount: payment.amount,
    method: payment.method,
    scheduleId: payment.scheduleId || null,
    notes: payment.notes || "",
    transactionReference: payment.transactionReference || "",
    ...(payment.paidAt ? { paidAt: payment.paidAt } : {}),
  });
  invalidateGetCache(providerCrmApi.invoices);
  invalidateGetCache(providerCrmApi.invoice(invoiceRef));
  invalidateGetCache(providerCrmApi.payments);
  const data =
    response && typeof response === "object" && "data" in response
      ? ((response as { data?: unknown }).data as Record<string, unknown> | undefined)
      : (response as Record<string, unknown> | undefined);
  const paymentRaw = data && typeof data === "object" ? data.payment ?? data : response;
  const invoiceRaw = data && typeof data === "object" ? data.invoice ?? data : response;
  const mappedPayment = mapPayment(paymentRaw);
  const mappedInvoice = mapInvoice(invoiceRaw);
  if (mappedPayment && mappedInvoice) {
    mappedPayment.invoiceNumber =
      mappedPayment.invoiceNumber || mappedInvoice.number;
    mappedPayment.customerId =
      mappedPayment.customerId || mappedInvoice.customerId;
    mappedPayment.jobId = mappedPayment.jobId || mappedInvoice.jobId;
  }
  return {
    payment: mappedPayment,
    invoice: mappedInvoice,
  };
}

export async function deleteInvoice(id: string) {
  const invoiceRef = requireInvoiceId(id);
  const result = await deleteData(providerCrmApi.invoice(invoiceRef), { silent: false });
  invalidateGetCache(providerCrmApi.invoices);
  invalidateGetCache(providerCrmApi.invoice(invoiceRef));
  return result;
}

export type PaymentsQuery = {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  method?: string;
  invoiceId?: string;
  customerId?: string;
  isArchived?: boolean;
  force?: boolean;
  silent?: boolean;
};

export async function queryPayments(query: PaymentsQuery = {}) {
  const params: Record<string, string | number | boolean> = {
    page: query.page ?? 1,
    limit: query.limit ?? 20,
  };
  if (query.search?.trim()) params.search = query.search.trim();
  if (query.status?.trim()) params.status = query.status.trim();
  if (query.method?.trim()) params.method = query.method.trim();
  if (query.invoiceId?.trim()) params.invoiceId = query.invoiceId.trim();
  if (query.customerId?.trim()) params.customerId = query.customerId.trim();
  if (query.isArchived !== undefined) params.isArchived = query.isArchived;

  const response = await getData(providerCrmApi.payments, params, {
    silent: query.silent ?? true,
    force: query.force ?? true,
  });
  const mapped = mapCrmList(response, mapPayment);
  return {
    items: mapped.items.filter((item): item is Payment => Boolean(item)),
    page: mapped.page,
    total: mapped.total,
    totalPages: mapped.totalPages,
  };
}

export async function listPayments(options?: CrmRequestOptions) {
  return queryPayments({
    page: 1,
    limit: 50,
    silent: options?.silent ?? true,
    force: options?.force ?? false,
  }).then((result) => result.items);
}

export async function getPayment(id: string) {
  const response = await getData(providerCrmApi.payment(id), undefined, {
    silent: true,
    force: true,
  });
  return mapCrmEntity(response, mapPayment);
}

export async function updatePaymentArchive(id: string, isArchived: boolean) {
  const response = await putData(
    providerCrmApi.payment(id),
    { isArchived },
    { silent: false },
  );
  invalidateGetCache(providerCrmApi.payments);
  invalidateGetCache(providerCrmApi.payment(id));
  return mapCrmEntity(response, mapPayment);
}

export async function listSchedule(options?: CrmRequestOptions) {
  const response = await getData(providerCrmApi.schedule, undefined, {
    silent: options?.silent ?? true,
  });
  return mapCrmList(response, mapScheduleEvent).items.filter(
    (item): item is NonNullable<typeof item> => Boolean(item),
  );
}

/** GET /api/provider/schedule?customerId=&recordId=&employeeId=&contractorId=&startDate=&endDate=&kind= */
export async function querySchedule(query: CrmListQuery = {}) {
  const params: Record<string, string | number> = {};
  const customerId = query.customerId?.trim();
  const recordId = query.recordId?.trim();
  const employeeId = query.employeeId?.trim();
  const contractorId = query.contractorId?.trim();
  const startDate = query.startDate?.trim();
  const endDate = query.endDate?.trim();
  const kind = query.kind?.trim();
  if (customerId) params.customerId = customerId;
  if (recordId) params.recordId = recordId;
  if (employeeId) params.employeeId = employeeId;
  if (contractorId) params.contractorId = contractorId;
  if (startDate) params.startDate = startDate;
  if (endDate) params.endDate = endDate;
  // Do not send kind=fixed_service to the API — older backends reject it.
  // Fetch unfiltered schedule rows, then filter / merge Fix Service client-side.
  if (kind && kind !== "fixed_service") {
    params.kind = kind;
  }
  const response = await getData(providerCrmApi.schedule, params, {
    silent: query.silent ?? true,
    force: query.force ?? true,
  });
  const rawItems = mapCrmList(response, mapScheduleEvent).items.filter(
    (item): item is NonNullable<typeof item> => Boolean(item),
  );
  let items = rawItems.filter(
    (item) =>
      !(item.kind === "fixed_service" && String(item.status || "").toLowerCase() === "cancelled"),
  );
  if (kind === "fixed_service") {
    items = items.filter((item) => item.kind === "fixed_service");
  }

  if (!kind || kind === "invoice") {
    try {
      const invList = await listInvoices({ silent: true });
      const existingIds = new Set(items.map((it) => it.recordId || it.id));
      invList.forEach((inv) => {
        if (!inv.id || existingIds.has(inv.id)) return;
        const dueOrIssued = inv.dueAt || inv.issuedAt || inv.createdAt;
        if (!dueOrIssued) return;
        const dateIso = dueOrIssued.slice(0, 10);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(dateIso)) return;

        const rawInvTotal =
          inv.total ??
          inv.balanceDue ??
          (Array.isArray(inv.items)
            ? inv.items.reduce(
                (s: number, it) =>
                  s + (Number(it.total) || (Number(it.quantity) || 1) * (Number(it.unitPrice) || 0) || 0),
                0,
              )
            : 0);
        const invNum = Number(rawInvTotal);
        const price = !Number.isNaN(invNum) && invNum > 0 ? `$${invNum.toFixed(2)}` : undefined;

        items.push({
          id: `inv_${inv.id}`,
          kind: "invoice",
          recordId: inv.id,
          title: inv.number || `INV-${inv.id.slice(-4).toUpperCase()}`,
          detail: inv.items?.[0]?.description || (inv.status ? `Invoice · ${inv.status}` : "Invoice"),
          customerName: inv.customerName || undefined,
          date: dateIso,
          dueDate: inv.dueAt ? inv.dueAt.slice(0, 10) : dateIso,
          timeWindow: "all_day",
          startMinutes: 540,
          endMinutes: 570,
          href: `/pro/dashboard/invoices/${inv.id}`,
          status: inv.status || "sent",
          price,
          category: inv.status ? `Invoice · ${inv.status}` : "Invoice",
        });
      });
    } catch {
      /* non-blocking */
    }
  }

  if (!kind || kind === "task") {
    try {
      const taskList = await listTasks({ silent: true });
      const existingIds = new Set(items.map((it) => it.recordId || it.id));
      taskList.forEach((task) => {
        if (!task.id || existingIds.has(task.id)) return;
        if (!task.dueAt) return;
        const dueIso = task.dueAt.slice(0, 10);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(dueIso)) return;

        if (employeeId && task.assignedEmployeeId !== employeeId) return;
        if (contractorId && task.assignedContractorId !== contractorId) return;

        const taskName = task.title && task.title !== task.number ? task.title : undefined;
        items.push({
          id: `task_${task.id}`,
          kind: "task",
          recordId: task.id,
          title: task.number || `TSK-${task.id.slice(-4).toUpperCase()}`,
          detail: taskName || task.title || "Task",
          customerName: task.customerName || undefined,
          notes: task.note || (task as unknown as Record<string, unknown>).notes ? String(task.note || (task as unknown as Record<string, unknown>).notes) : undefined,
          date: dueIso,
          dueDate: dueIso,
          timeWindow: "morning",
          startMinutes: 540,
          endMinutes: 570,
          employeeId: task.assignedEmployeeId || task.assignedContractorId || undefined,
          technicianName: task.assignedEmployeeName || task.assignedContractorName || undefined,
          href: `/pro/dashboard/tasks`,
          status: task.status || "scheduled",
          category: task.priority ? `Task · ${task.priority}` : "Task",
        });
      });
    } catch {
      /* non-blocking */
    }
  }

  // Fixed Service Orders: merge booking dates onto Schedule (existing + checkout sync).
  if (!kind || kind === "fixed_service") {
    try {
      const { providerOrdersApi } = await import("@/components/api/ApiRoutesFile");
      const ordersResponse = await getData(
        providerOrdersApi.list,
        { page: 1, limit: 200 },
        { silent: true, force: true },
      );
      const root =
        ordersResponse && typeof ordersResponse === "object"
          ? (ordersResponse as Record<string, unknown>)
          : {};
      const data =
        root.data && typeof root.data === "object"
          ? (root.data as Record<string, unknown>)
          : root;
      const rawOrders = Array.isArray(data.orders)
        ? data.orders
        : Array.isArray(root.orders)
          ? root.orders
          : Array.isArray(data)
            ? data
            : [];
      const existingIds = new Set(
        items.map((it) => String(it.recordId || it.id || "")).filter(Boolean),
      );
      const hiddenStatuses = new Set(["CANCELLED", "DISPUTED"]);

      for (const raw of rawOrders) {
        if (!raw || typeof raw !== "object") continue;
        const order = raw as Record<string, unknown>;
        const orderId = String(order.id || order._id || "").trim();
        if (!orderId || existingIds.has(orderId)) continue;

        const status = String(order.status || "").toUpperCase();
        if (hiddenStatuses.has(status)) continue;

        const booking =
          order.booking && typeof order.booking === "object"
            ? (order.booking as Record<string, unknown>)
            : order.bookingId && typeof order.bookingId === "object"
              ? (order.bookingId as Record<string, unknown>)
              : null;
        const startIso = String(booking?.startTime || "").trim();
        if (!startIso) continue;
        const dateIso = startIso.slice(0, 10);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(dateIso)) continue;

        const startAt = new Date(startIso);
        const endIso = String(booking?.endTime || "").trim();
        const endAt = endIso ? new Date(endIso) : null;
        if (Number.isNaN(startAt.getTime())) continue;

        const startMinutes = startAt.getHours() * 60 + startAt.getMinutes();
        let endMinutes =
          endAt && !Number.isNaN(endAt.getTime())
            ? endAt.getHours() * 60 + endAt.getMinutes()
            : startMinutes + (Number(booking?.durationMinutes) || 60);
        if (endMinutes <= startMinutes) endMinutes = startMinutes + 60;

        const service =
          order.service && typeof order.service === "object"
            ? (order.service as Record<string, unknown>)
            : order.serviceSnapshot && typeof order.serviceSnapshot === "object"
              ? (order.serviceSnapshot as Record<string, unknown>)
              : {};
        const serviceName = String(
          service.servicesName || service.title || service.name || "Fixed service",
        );
        const customer =
          order.customer && typeof order.customer === "object"
            ? (order.customer as Record<string, unknown>)
            : order.customerId && typeof order.customerId === "object"
              ? (order.customerId as Record<string, unknown>)
              : {};
        const customerName =
          String(customer.name || "").trim() ||
          `${customer.firstName || ""} ${customer.lastName || ""}`.trim() ||
          undefined;
        const orderNumber = String(order.orderNumber || "").trim();
        const pricing =
          order.pricing && typeof order.pricing === "object"
            ? (order.pricing as Record<string, unknown>)
            : {};
        const totalNum = Number(pricing.totalAmount ?? pricing.basePrice);
        const price =
          !Number.isNaN(totalNum) && totalNum > 0
            ? `$${totalNum.toFixed(2)}`
            : undefined;

        const address =
          order.address && typeof order.address === "object"
            ? (order.address as Record<string, unknown>)
            : null;
        let serviceAddress: string | undefined;
        if (address) {
          const street = String(address.street || address.address || "").trim();
          const city = String(address.city || "").trim();
          const state = String(address.state || "").trim();
          const zip = String(address.zip || "").trim();
          const parts = [
            street,
            city && state ? `${city}, ${state}` : city || state,
            zip,
          ].filter(Boolean);
          serviceAddress = parts.length ? parts.join(" ") : undefined;
        }

        items.push({
          id: `fso_${orderId}`,
          kind: "fixed_service",
          recordId: orderId,
          title: orderNumber || `FSO-${orderId.slice(-4).toUpperCase()}`,
          detail: serviceName,
          customerName,
          serviceAddress,
          date: dateIso,
          endDate: dateIso,
          timeWindow: "custom",
          startMinutes,
          endMinutes,
          href: `/pro/dashboard/orders/${orderId}`,
          status:
            status === "CONFIRMED" || status === "IN_PROGRESS"
              ? "confirmed"
              : status === "WORK_COMPLETED" || status === "SETTLED"
                ? "completed"
                : "scheduled",
          price,
          category: status ? `Fix Service · ${status}` : "Fix Service",
        });
        existingIds.add(orderId);
      }
    } catch {
      /* non-blocking */
    }
  }

  const missingJobIds = Array.from(
    new Set(
      items
        .filter(
          (item) =>
            item.kind === "job" &&
            item.recordId &&
            (!item.serviceAddress || !item.price || !item.category || !item.notes),
        )
        .map((item) => item.recordId),
    ),
  );

  const missingEstimateIds = Array.from(
    new Set(
      items
        .filter(
          (item) =>
            item.kind === "estimate" &&
            item.recordId &&
            (!item.serviceAddress || !item.price || !item.category || !item.notes),
        )
        .map((item) => item.recordId),
    ),
  );

  const missingRequestIds = Array.from(
    new Set(
      items
        .filter(
          (item) =>
            item.kind === "request" &&
            item.recordId &&
            (!item.serviceAddress || !item.customerName || !item.category || !item.notes),
        )
        .map((item) => item.recordId),
    ),
  );

  const missingTaskIds = Array.from(
    new Set(
      items
        .filter(
          (item) =>
            item.kind === "task" &&
            item.recordId &&
            (!item.customerName || !item.category || !item.notes || !item.detail),
        )
        .map((item) => item.recordId),
    ),
  );

  const missingInvoiceIds = Array.from(
    new Set(
      items
        .filter(
          (item) =>
            item.kind === "invoice" &&
            item.recordId &&
            (!item.serviceAddress || !item.price || !item.customerName || !item.category || !item.notes),
        )
        .map((item) => item.recordId),
    ),
  );

  const formatAddr = (addr?: ServiceAddress | { address?: string; street?: string; city?: string; state?: string; zip?: string } | null) => {
    if (!addr) return undefined;
    const street = (addr.address || addr.street || "").trim();
    const city = (addr.city || "").trim();
    const state = (addr.state || "").trim();
    const zip = (addr.zip || "").trim();
    const loc = city && state ? `${city}, ${state}` : city || state;
    const parts = [street, loc, zip].filter(Boolean);
    return parts.length ? parts.join(" ") : undefined;
  };

  if (
    missingJobIds.length > 0 ||
    missingEstimateIds.length > 0 ||
    missingRequestIds.length > 0 ||
    missingTaskIds.length > 0 ||
    missingInvoiceIds.length > 0
  ) {
    try {
      const [jobResults, estimateResults, requestResults, taskResults, invoiceResults] = await Promise.all([
        missingJobIds.length > 0
          ? Promise.allSettled(missingJobIds.map((jobId) => getJob(jobId)))
          : Promise.resolve([]),
        missingEstimateIds.length > 0
          ? Promise.allSettled(missingEstimateIds.map((estId) => getEstimate(estId)))
          : Promise.resolve([]),
        missingRequestIds.length > 0
          ? Promise.allSettled(missingRequestIds.map((reqId) => getRequest(reqId)))
          : Promise.resolve([]),
        missingTaskIds.length > 0
          ? Promise.allSettled(missingTaskIds.map((taskId) => getTask(taskId)))
          : Promise.resolve([]),
        missingInvoiceIds.length > 0
          ? Promise.allSettled(missingInvoiceIds.map((invId) => getInvoiceWithPayments(invId)))
          : Promise.resolve([]),
      ]);

      const jobMap = new Map<string, Job>();
      jobResults.forEach((res) => {
        if (res.status === "fulfilled" && res.value) {
          jobMap.set(res.value.id, res.value);
        }
      });

      const estimateMap = new Map<string, Estimate>();
      estimateResults.forEach((res) => {
        if (res.status === "fulfilled" && res.value) {
          estimateMap.set(res.value.id, res.value);
        }
      });

      const requestMap = new Map<string, PortalRequest>();
      requestResults.forEach((res) => {
        if (res.status === "fulfilled" && res.value) {
          requestMap.set(res.value.id, res.value);
        }
      });

      const taskMap = new Map<string, PortalTask>();
      taskResults.forEach((res) => {
        if (res.status === "fulfilled" && res.value) {
          taskMap.set(res.value.id, res.value);
        }
      });

      const invoiceMap = new Map<string, Invoice>();
      invoiceResults.forEach((res) => {
        if (res.status === "fulfilled" && res.value?.invoice) {
          invoiceMap.set(res.value.invoice.id, res.value.invoice);
        }
      });

      return items.map((item) => {
        if ((item.kind === "job" || item.kind === "fixed_service") && item.recordId) {
          const job = jobMap.get(item.recordId);
          if (job) {
            const addr = item.serviceAddress || formatAddr(job.address);
            const rawJobTotal =
              (job as unknown as Record<string, unknown>).totalAmount ??
              (job as unknown as Record<string, unknown>).total ??
              (job as unknown as Record<string, unknown>).price ??
              (Array.isArray(job.items)
                ? job.items.reduce(
                    (s: number, it) =>
                      s + (Number(it.total) || (Number(it.quantity) || 1) * (Number(it.unitPrice) || 0) || 0),
                    0,
                  )
                : 0);
            const jobNum = Number(rawJobTotal);
            const price =
              item.price ||
              (!Number.isNaN(jobNum) && jobNum > 0 ? `$${jobNum.toFixed(2)}` : undefined);
            const jobName =
              job.title && job.title !== job.number
                ? job.title
                : (job as unknown as Record<string, unknown>).serviceName
                  ? String((job as unknown as Record<string, unknown>).serviceName)
                  : job.items?.[0]?.description || undefined;
            const category = item.category || jobName || undefined;
            return {
              ...item,
              serviceAddress: addr || item.serviceAddress || undefined,
              price: price || item.price || undefined,
              category: category || item.category || undefined,
              notes: job.notes || (job as unknown as Record<string, unknown>).description ? String(job.notes || (job as unknown as Record<string, unknown>).description) : item.notes || undefined,
              detail: jobName || item.detail,
              customerName: item.customerName || ((job as unknown as Record<string, unknown>).customerName ? String((job as unknown as Record<string, unknown>).customerName) : undefined),
            };
          }
        } else if (item.kind === "estimate" && item.recordId) {
          const est = estimateMap.get(item.recordId);
          if (est) {
            const addr = item.serviceAddress || formatAddr(est.propertyAddress);
            const rawEstTotal =
              est.total ??
              est.subtotal ??
              (Array.isArray(est.items)
                ? est.items.reduce(
                    (s: number, it) =>
                      s + (Number(it.total) || (Number(it.quantity) || 1) * (Number(it.unitPrice) || 0) || 0),
                    0,
                  )
                : 0);
            const estNum = Number(rawEstTotal);
            const price =
              item.price ||
              (!Number.isNaN(estNum) && estNum > 0 ? `$${estNum.toFixed(2)}` : undefined);
            const estName =
              est.title && est.title !== est.number
                ? est.title
                : est.items?.[0]?.description || undefined;
            const category = item.category || estName || undefined;
            return {
              ...item,
              serviceAddress: addr || item.serviceAddress || undefined,
              price: price || item.price || undefined,
              category: category || item.category || undefined,
              notes: est.notes || item.notes || undefined,
              detail: estName || item.detail,
              customerName: item.customerName || est.customerName || undefined,
            };
          }
        } else if (item.kind === "request" && item.recordId) {
          const req = requestMap.get(item.recordId);
          if (req) {
            const addr =
              item.serviceAddress ||
              (req.address ? (typeof req.address === "string" ? req.address : formatAddr(req.address)) : undefined) ||
              (req.city && req.state ? `${req.city}, ${req.state} ${req.zip || ""}`.trim() : req.city || undefined);
            const reqBudget =
              (req as unknown as Record<string, unknown>).budget ??
              (req as unknown as Record<string, unknown>).startingPrice ??
              (req as unknown as Record<string, unknown>).price;
            const reqNum = Number(reqBudget);
            const price =
              item.price ||
              (!Number.isNaN(reqNum) && reqNum > 0 ? `$${reqNum.toFixed(2)}` : undefined);
            const reqName = req.serviceName || undefined;
            const category = item.category || req.categoryName || reqName || undefined;
            const reqCustomer = req.customerName && req.customerName !== "Customer" ? req.customerName : undefined;
            return {
              ...item,
              serviceAddress: addr || item.serviceAddress || undefined,
              price: price || item.price || undefined,
              category: category || item.category || undefined,
              notes: req.details || item.notes || undefined,
              detail: reqName || item.detail,
              customerName: item.customerName || reqCustomer || undefined,
            };
          }
        } else if (item.kind === "task" && item.recordId) {
          const task = taskMap.get(item.recordId);
          if (task) {
            const taskName = task.title && task.title !== task.number ? task.title : undefined;
            const category = item.category || (task.priority ? `Task · ${task.priority}` : taskName || "Task");
            let customerName = item.customerName || task.customerName || undefined;
            let serviceAddress = item.serviceAddress;
            let foundCustomerId = task.customerId;

            const linkedJobId = task.jobId || (task.subjectKind === "job" ? task.subjectId : undefined);
            if (linkedJobId) {
              const linkedJob = jobMap.get(linkedJobId);
              if (linkedJob) {
                if (!serviceAddress && linkedJob.address) serviceAddress = formatAddr(linkedJob.address);
                if (!customerName) {
                  customerName = linkedJob.customerName || ((linkedJob as unknown as Record<string, unknown>).customerName ? String((linkedJob as unknown as Record<string, unknown>).customerName) : undefined);
                }
                if (!foundCustomerId) foundCustomerId = linkedJob.customerId;
              }
            }

            const linkedEstId = task.subjectKind === "estimate" ? task.subjectId : undefined;
            if (linkedEstId) {
              const linkedEst = estimateMap.get(linkedEstId);
              if (linkedEst) {
                if (!serviceAddress && linkedEst.propertyAddress) serviceAddress = formatAddr(linkedEst.propertyAddress);
                if (!customerName) customerName = linkedEst.customerName;
                if (!foundCustomerId) foundCustomerId = linkedEst.customerId;
              }
            }

            const linkedReqId = task.subjectKind === "request" ? task.subjectId : undefined;
            if (linkedReqId) {
              const linkedReq = requestMap.get(linkedReqId);
              if (linkedReq) {
                if (!serviceAddress) {
                  serviceAddress =
                    typeof linkedReq.address === "string"
                      ? linkedReq.address
                      : formatAddr(linkedReq.address) ||
                        (linkedReq.city && linkedReq.state ? `${linkedReq.city}, ${linkedReq.state} ${linkedReq.zip || ""}`.trim() : linkedReq.city || undefined);
                }
                if (!customerName) customerName = linkedReq.customerName && linkedReq.customerName !== "Customer" ? linkedReq.customerName : undefined;
                if (!foundCustomerId) foundCustomerId = linkedReq.customerId;
              }
            }

            return {
              ...item,
              title: item.title && !item.title.startsWith("cal_") ? item.title : task.number || `TSK-${task.id.slice(-4).toUpperCase()}`,
              category: category || item.category || undefined,
              notes: task.note || (task as unknown as Record<string, unknown>).notes || (task as unknown as Record<string, unknown>).description ? String(task.note || (task as unknown as Record<string, unknown>).notes || (task as unknown as Record<string, unknown>).description) : item.notes || undefined,
              detail: taskName || task.title || item.detail,
              customerName: customerName || undefined,
              serviceAddress: serviceAddress || item.serviceAddress || undefined,
              dueDate: task.dueAt || item.dueDate || undefined,
            };
          }
        } else if (item.kind === "invoice" && item.recordId) {
          const inv = invoiceMap.get(item.recordId);
          if (inv) {
            const rawInvTotal =
              inv.total ??
              inv.balance ??
              (Array.isArray(inv.items)
                ? inv.items.reduce(
                    (s: number, it) =>
                      s + (Number(it.total) || (Number(it.quantity) || 1) * (Number(it.unitPrice) || 0) || 0),
                    0,
                  )
                : 0);
            const invNum = Number(rawInvTotal);
            const price =
              item.price ||
              (!Number.isNaN(invNum) && invNum > 0 ? `$${invNum.toFixed(2)}` : undefined);
            const invName = inv.subject || inv.title || inv.items?.[0]?.description || undefined;
            const category = item.category || invName || (inv.status ? `Invoice · ${inv.status}` : "Invoice");
            const addr = item.serviceAddress || formatAddr(inv.address);
            return {
              ...item,
              title: item.title && !item.title.startsWith("cal_") ? item.title : inv.number || `INV-${inv.id.slice(-4).toUpperCase()}`,
              serviceAddress: addr || item.serviceAddress || undefined,
              price: price || item.price || undefined,
              category: category || item.category || undefined,
              notes: inv.notes || item.notes || undefined,
              detail: invName || item.detail,
              customerName: item.customerName || inv.customerName || undefined,
              dueDate: inv.dueAt || item.dueDate || undefined,
            };
          }
        }
        return item;
      });
    } catch {
      /* non-blocking */
    }
  }

  return items;
}

export async function assignSchedule(schedule: CrmScheduleAssignment) {
  // Backend accepts job | estimate | request | invoice | task | fixed_service
  const backendKind = schedule.kind;
  const response = await postData(
    providerCrmApi.scheduleAssign,
    {
      recordId: schedule.recordId || null,
      kind: backendKind,
      title: schedule.title,
      date: schedule.date,
      endDate: schedule.endDate ?? null,
      startMinutes: schedule.startMinutes,
      endMinutes: schedule.endMinutes,
      timeWindow: schedule.timeWindow,
      employeeId: schedule.employeeId || null,
      contractorId: schedule.contractorId || null,
      status: schedule.status ?? "scheduled",
      linkOnly: schedule.linkOnly === true,
    },
    // Caller (AssignEventDialog) shows extractErrorMessage — avoid duplicate/generic toasts.
    { silent: true },
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
  return listMapped(providerCrmApi.chats, mapChatThread, {
    ...options,
    force: options?.force ?? true,
  });
}

export async function getInboxSummary(options?: CrmRequestOptions): Promise<CrmInboxSummary> {
  const silent = options?.silent ?? true;
  const force = options?.force ?? false;

  const [requestsResult, chatsResult] = await Promise.allSettled([
    getData(providerCrmApi.requestsSummary, undefined, { silent, force }),
    getData(providerCrmApi.inboxSummary, undefined, { silent, force }),
  ]);

  const fromRequests =
    requestsResult.status === "fulfilled"
      ? mapInboxSummary(requestsResult.value)
      : null;
  const fromChats =
    chatsResult.status === "fulfilled"
      ? mapInboxSummary(chatsResult.value)
      : null;

  if (!fromRequests && !fromChats) {
    return {
      newLeads: 0,
      unreadChats: 0,
      pendingOrders: 0,
      pendingEstimates: 0,
      total: 0,
    };
  }

  const newLeads = Math.max(fromRequests?.newLeads || 0, fromChats?.newLeads || 0);
  const unreadChats = Math.max(
    fromRequests?.unreadChats || 0,
    fromChats?.unreadChats || 0,
  );
  // pendingOrders lives on chats summary historically; requests summary now includes it too.
  const pendingOrders = Math.max(
    fromRequests?.pendingOrders || 0,
    fromChats?.pendingOrders || 0,
  );
  const pendingEstimates = Math.max(
    fromRequests?.pendingEstimates || 0,
    fromChats?.pendingEstimates || 0,
  );

  return {
    newLeads,
    unreadChats,
    pendingOrders,
    pendingEstimates,
    activeLeads: fromRequests?.activeLeads ?? fromChats?.activeLeads,
    convertedLeads: fromRequests?.convertedLeads ?? fromChats?.convertedLeads,
    total: newLeads + unreadChats + pendingOrders + pendingEstimates,
  };
}

/** Persist sidebar badge ACK when opening Leads / Orders / Estimates. */
export async function ackInboxBadges(
  kinds: Array<"leads" | "orders" | "estimates">,
  options?: CrmRequestOptions,
): Promise<CrmInboxSummary> {
  const response = await postData(
    providerCrmApi.inboxSummaryAck,
    { kinds },
    { silent: options?.silent ?? true },
  );
  return mapInboxSummary(response) || {
    newLeads: 0,
    unreadChats: 0,
    pendingOrders: 0,
    total: 0,
  };
}

export type ProviderReportsQuery = CrmRequestOptions & {
  months?: number;
};

function asReportsRecord(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== "object") return {};
  const root = raw as Record<string, unknown>;
  const data = root.data;
  if (data && typeof data === "object") return data as Record<string, unknown>;
  return root;
}

function numberOr(value: unknown, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function stringOr(value: unknown, fallback = "") {
  return typeof value === "string" ? value : value == null ? fallback : String(value);
}

/** GET /api/provider/reports — aggregated KPIs, volume, pipeline, and ledger. */
export async function getProviderReports(query: ProviderReportsQuery = {}) {
  const months = Math.max(1, Math.min(24, Number(query.months) || 6));
  const response = await getData(
    providerCrmApi.reports,
    { months },
    {
      silent: query.silent ?? true,
      force: query.force ?? true,
    },
  );
  const data = asReportsRecord(response);
  const periodRaw =
    data.period && typeof data.period === "object"
      ? (data.period as Record<string, unknown>)
      : {};
  const kpisRaw =
    data.kpis && typeof data.kpis === "object"
      ? (data.kpis as Record<string, unknown>)
      : {};
  const moneyRaw =
    data.moneyOnBooks && typeof data.moneyOnBooks === "object"
      ? (data.moneyOnBooks as Record<string, unknown>)
      : {};

  const monthlyVolume = Array.isArray(data.monthlyVolume)
    ? data.monthlyVolume.map((item) => {
        const row = (item && typeof item === "object" ? item : {}) as Record<string, unknown>;
        return {
          key: stringOr(row.key),
          label: stringOr(row.label),
          value: numberOr(row.value),
          year: numberOr(row.year),
        };
      })
    : [];

  const pipeline = Array.isArray(data.pipeline)
    ? data.pipeline.map((item) => {
        const row = (item && typeof item === "object" ? item : {}) as Record<string, unknown>;
        return {
          id: stringOr(row.id),
          label: stringOr(row.label),
          value: numberOr(row.value),
          href: stringOr(row.href, "/pro/dashboard"),
        };
      })
    : [];

  const requestMix = Array.isArray(data.requestMix)
    ? data.requestMix.map((item) => {
        const row = (item && typeof item === "object" ? item : {}) as Record<string, unknown>;
        return {
          status: stringOr(row.status),
          label: stringOr(row.label, stringOr(row.status)),
          value: numberOr(row.value),
        };
      })
    : [];

  const ledger = Array.isArray(data.ledger)
    ? data.ledger.map((item) => {
        const row = (item && typeof item === "object" ? item : {}) as Record<string, unknown>;
        return {
          id: stringOr(row.id),
          number: stringOr(row.number),
          status: stringOr(row.status, "draft"),
          issuedAt: stringOr(row.issuedAt),
          dueAt: row.dueAt ? stringOr(row.dueAt) : null,
          total: numberOr(row.total),
          amountPaid: numberOr(row.amountPaid),
          balanceDue: numberOr(row.balanceDue),
          customerId: stringOr(row.customerId),
          customerName: stringOr(row.customerName),
          jobId: row.jobId ? stringOr(row.jobId) : null,
          jobNumber: stringOr(row.jobNumber),
          jobTitle: stringOr(row.jobTitle),
          site: stringOr(row.site),
          invoiceType: stringOr(row.invoiceType, "standard"),
          updatedAt: row.updatedAt ? stringOr(row.updatedAt) : undefined,
          createdAt: row.createdAt ? stringOr(row.createdAt) : undefined,
        };
      })
    : [];

  return {
    companyName: stringOr(data.companyName),
    period: {
      start: stringOr(periodRaw.start),
      end: stringOr(periodRaw.end),
      label: stringOr(periodRaw.label),
      months: numberOr(periodRaw.months, months),
    },
    kpis: {
      collected: numberOr(kpisRaw.collected),
      outstanding: numberOr(kpisRaw.outstanding),
      paymentsCount: numberOr(kpisRaw.paymentsCount),
      overdueInvoices: numberOr(kpisRaw.overdueInvoices),
      estimateConversion: numberOr(kpisRaw.estimateConversion),
      estimatesAccepted: numberOr(kpisRaw.estimatesAccepted),
      estimatesSent: numberOr(kpisRaw.estimatesSent),
      activeJobs: numberOr(kpisRaw.activeJobs),
      completedJobs: numberOr(kpisRaw.completedJobs),
      totalJobs: numberOr(kpisRaw.totalJobs),
    },
    monthlyVolume,
    pipeline,
    requestMix,
    moneyOnBooks: {
      collected: numberOr(moneyRaw.collected),
      outstanding: numberOr(moneyRaw.outstanding),
      overdue: numberOr(moneyRaw.overdue),
      households: numberOr(moneyRaw.households),
      invoicesOnFile: numberOr(moneyRaw.invoicesOnFile),
    },
    ledger,
  };
}

export type ProviderDashboardQuery = CrmRequestOptions;

/** GET /api/provider/dashboard — Main / Sales / Service card aggregates. */
export async function getProviderDashboard(query: ProviderDashboardQuery = {}) {
  const response = await getData(
    providerCrmApi.dashboard,
    {},
    {
      silent: query.silent ?? true,
      force: query.force ?? true,
    },
  );
  const data = asReportsRecord(response);

  const attentionRaw =
    data.attention && typeof data.attention === "object"
      ? (data.attention as Record<string, unknown>)
      : {};
  const overdueInv =
    attentionRaw.overdueInvoices && typeof attentionRaw.overdueInvoices === "object"
      ? (attentionRaw.overdueInvoices as Record<string, unknown>)
      : {};
  const awaitingSig =
    attentionRaw.estimatesAwaitingSignature &&
    typeof attentionRaw.estimatesAwaitingSignature === "object"
      ? (attentionRaw.estimatesAwaitingSignature as Record<string, unknown>)
      : {};

  const leadsRaw =
    data.leads && typeof data.leads === "object"
      ? (data.leads as Record<string, unknown>)
      : {};
  const messagesRaw =
    data.messages && typeof data.messages === "object"
      ? (data.messages as Record<string, unknown>)
      : {};
  const estimatesRaw =
    data.estimates && typeof data.estimates === "object"
      ? (data.estimates as Record<string, unknown>)
      : {};
  const jobsRaw =
    data.jobs && typeof data.jobs === "object" ? (data.jobs as Record<string, unknown>) : {};
  const scheduleRaw =
    data.schedule && typeof data.schedule === "object"
      ? (data.schedule as Record<string, unknown>)
      : {};
  const invoicesRaw =
    data.invoices && typeof data.invoices === "object"
      ? (data.invoices as Record<string, unknown>)
      : {};
  const unpaidRaw =
    invoicesRaw.unpaid && typeof invoicesRaw.unpaid === "object"
      ? (invoicesRaw.unpaid as Record<string, unknown>)
      : {};
  const paymentsRaw =
    data.payments && typeof data.payments === "object"
      ? (data.payments as Record<string, unknown>)
      : {};
  const periodRaw =
    paymentsRaw.period && typeof paymentsRaw.period === "object"
      ? (paymentsRaw.period as Record<string, unknown>)
      : {};
  const peopleRaw =
    data.people && typeof data.people === "object"
      ? (data.people as Record<string, unknown>)
      : {};
  const tasksRaw =
    data.tasks && typeof data.tasks === "object" ? (data.tasks as Record<string, unknown>) : {};
  const remindersRaw =
    data.reminders && typeof data.reminders === "object"
      ? (data.reminders as Record<string, unknown>)
      : {};

  const mapCountRow = (item: unknown) => {
    const row = (item && typeof item === "object" ? item : {}) as Record<string, unknown>;
    return { label: stringOr(row.label), value: numberOr(row.value) };
  };

  const mapRequestRow = (item: unknown) => {
    const row = (item && typeof item === "object" ? item : {}) as Record<string, unknown>;
    return {
      id: stringOr(row.id),
      serviceName: stringOr(row.serviceName),
      customerName: stringOr(row.customerName),
      neighborhood: stringOr(row.neighborhood),
      status: stringOr(row.status, "new"),
      statusLabel: stringOr(row.statusLabel, stringOr(row.status, "New")),
      preferredDate: row.preferredDate ? stringOr(row.preferredDate) : "",
      details: stringOr(row.details),
    };
  };

  const mapJobRow = (item: unknown) => {
    const row = (item && typeof item === "object" ? item : {}) as Record<string, unknown>;
    return {
      id: stringOr(row.id),
      number: stringOr(row.number),
      customerName: stringOr(row.customerName),
      status: stringOr(row.status, "unscheduled"),
      statusLabel: stringOr(row.statusLabel, stringOr(row.status)),
      scheduledAt: row.scheduledAt ? stringOr(row.scheduledAt) : null,
      city: stringOr(row.city),
      detail: stringOr(row.detail),
      assignee: row.assignee ? stringOr(row.assignee) : null,
    };
  };

  const mapChartScale = (
    raw: unknown,
    keys: { a: string; b: string },
  ): Array<{ key: string; label: string; [k: string]: string | number }> => {
    if (!raw || typeof raw !== "object") return [];
    const root = raw as Record<string, unknown>;
    const month = Array.isArray(root.month) ? root.month : [];
    const year = Array.isArray(root.year) ? root.year : [];
    return { month, year } as unknown as Array<{
      key: string;
      label: string;
      [k: string]: string | number;
    }>;
  };

  const mapSalesPoints = (items: unknown) =>
    Array.isArray(items)
      ? items.map((item) => {
          const row = (item && typeof item === "object" ? item : {}) as Record<string, unknown>;
          return {
            key: stringOr(row.key),
            label: stringOr(row.label),
            billed: numberOr(row.billed),
            collected: numberOr(row.collected),
          };
        })
      : [];

  const mapJobsPoints = (items: unknown) =>
    Array.isArray(items)
      ? items.map((item) => {
          const row = (item && typeof item === "object" ? item : {}) as Record<string, unknown>;
          return {
            key: stringOr(row.key),
            label: stringOr(row.label),
            opened: numberOr(row.opened),
            finished: numberOr(row.finished),
          };
        })
      : [];

  const salesChartRaw =
    data.salesChart && typeof data.salesChart === "object"
      ? (data.salesChart as Record<string, unknown>)
      : {};
  const jobsChartRaw =
    data.jobsChart && typeof data.jobsChart === "object"
      ? (data.jobsChart as Record<string, unknown>)
      : {};

  const mapPeriod = (key: string) => {
    const raw =
      periodRaw[key] && typeof periodRaw[key] === "object"
        ? (periodRaw[key] as Record<string, unknown>)
        : {};
    return { revenue: numberOr(raw.revenue), count: numberOr(raw.count) };
  };

  const mapScheduleEvent = (item: unknown) => {
    const row = (item && typeof item === "object" ? item : {}) as Record<string, unknown>;
    return {
      id: stringOr(row.id),
      title: stringOr(row.title),
      detail: stringOr(row.detail),
      date: stringOr(row.date),
      startMinutes:
        row.startMinutes == null || row.startMinutes === ""
          ? null
          : numberOr(row.startMinutes),
      employeeName: row.employeeName ? stringOr(row.employeeName) : null,
      href: stringOr(row.href, "/pro/dashboard/schedule"),
    };
  };

  void mapChartScale;

  return {
    companyName: stringOr(data.companyName),
    city: stringOr(data.city),
    state: stringOr(data.state),
    generatedAt: stringOr(data.generatedAt),
    attention: {
      overdueInvoices: {
        count: numberOr(overdueInv.count),
        amountPastDue: numberOr(overdueInv.amountPastDue),
      },
      uninvoicedCompletedJobs: numberOr(attentionRaw.uninvoicedCompletedJobs),
      unassignedActiveJobs: numberOr(attentionRaw.unassignedActiveJobs),
      overdueTasks: numberOr(attentionRaw.overdueTasks),
      estimatesAwaitingSignature: {
        count: numberOr(awaitingSig.count),
        totalOut: numberOr(awaitingSig.totalOut),
      },
    },
    leads: {
      openCount: numberOr(leadsRaw.openCount),
      newFromWebsite: numberOr(leadsRaw.newFromWebsite),
      total: numberOr(leadsRaw.total),
      byStatus: Array.isArray(leadsRaw.byStatus) ? leadsRaw.byStatus.map(mapCountRow) : [],
      latest: Array.isArray(leadsRaw.latest) ? leadsRaw.latest.map(mapRequestRow) : [],
      incoming: Array.isArray(leadsRaw.incoming) ? leadsRaw.incoming.map(mapRequestRow) : [],
      field: Array.isArray(leadsRaw.field) ? leadsRaw.field.map(mapRequestRow) : [],
    },
    messages: {
      unreadChats: numberOr(messagesRaw.unreadChats),
      inboxPreview: Array.isArray(messagesRaw.inboxPreview)
        ? messagesRaw.inboxPreview.map((item) => {
            const row = (item && typeof item === "object" ? item : {}) as Record<
              string,
              unknown
            >;
            return {
              id: stringOr(row.id),
              href: stringOr(row.href, "/pro/dashboard/messages"),
              title: stringOr(row.title),
              detail: stringOr(row.detail),
              kind: stringOr(row.kind, "lead") === "chat" ? ("chat" as const) : ("lead" as const),
              unread: numberOr(row.unread),
            };
          })
        : [],
    },
    estimates: {
      openCount: numberOr(estimatesRaw.openCount),
      pendingValue: numberOr(estimatesRaw.pendingValue),
      awaitingSignature: numberOr(estimatesRaw.awaitingSignature),
      latest: Array.isArray(estimatesRaw.latest)
        ? estimatesRaw.latest.map((item) => {
            const row = (item && typeof item === "object" ? item : {}) as Record<
              string,
              unknown
            >;
            return {
              id: stringOr(row.id),
              number: stringOr(row.number),
              customerName: stringOr(row.customerName),
              total: numberOr(row.total),
              status: stringOr(row.status, "draft"),
              statusLabel: stringOr(row.statusLabel, stringOr(row.status)),
            };
          })
        : [],
    },
    jobs: {
      total: numberOr(jobsRaw.total),
      active: numberOr(jobsRaw.active),
      scheduledThisWeek: numberOr(jobsRaw.scheduledThisWeek),
      unscheduled: numberOr(jobsRaw.unscheduled),
      inField: numberOr(jobsRaw.inField),
      heldUp: numberOr(jobsRaw.heldUp),
      byStatus: Array.isArray(jobsRaw.byStatus) ? jobsRaw.byStatus.map(mapCountRow) : [],
      byServiceGroup: Array.isArray(jobsRaw.byServiceGroup)
        ? jobsRaw.byServiceGroup.map(mapCountRow)
        : [],
      byServiceMix: Array.isArray(jobsRaw.byServiceMix)
        ? jobsRaw.byServiceMix.map(mapCountRow)
        : [],
      serviceMixTotal: numberOr(jobsRaw.serviceMixTotal),
      latestActive: Array.isArray(jobsRaw.latestActive)
        ? jobsRaw.latestActive.map(mapJobRow)
        : [],
      upcoming: Array.isArray(jobsRaw.upcoming) ? jobsRaw.upcoming.map(mapJobRow) : [],
    },
    schedule: {
      upcomingWeekCount: numberOr(scheduleRaw.upcomingWeekCount),
      todayCount: numberOr(scheduleRaw.todayCount),
      weekDays: Array.isArray(scheduleRaw.weekDays)
        ? scheduleRaw.weekDays.map((item) => {
            const row = (item && typeof item === "object" ? item : {}) as Record<
              string,
              unknown
            >;
            return {
              date: stringOr(row.date),
              label: stringOr(row.label),
              day: numberOr(row.day),
              count: numberOr(row.count),
            };
          })
        : [],
      upcoming: Array.isArray(scheduleRaw.upcoming)
        ? scheduleRaw.upcoming.map(mapScheduleEvent)
        : [],
      weekEvents: Array.isArray(scheduleRaw.weekEvents)
        ? scheduleRaw.weekEvents.map(mapScheduleEvent)
        : [],
    },
    invoices: {
      total: numberOr(invoicesRaw.total),
      unpaid: {
        count: numberOr(unpaidRaw.count),
        balanceDue: numberOr(unpaidRaw.balanceDue),
      },
      byAging: Array.isArray(invoicesRaw.byAging)
        ? invoicesRaw.byAging.map(mapCountRow)
        : [],
      latest: Array.isArray(invoicesRaw.latest)
        ? invoicesRaw.latest.map((item) => {
            const row = (item && typeof item === "object" ? item : {}) as Record<
              string,
              unknown
            >;
            return {
              id: stringOr(row.id),
              number: stringOr(row.number),
              customerName: stringOr(row.customerName),
              balanceDue: numberOr(row.balanceDue),
              status: stringOr(row.status, "draft"),
              statusLabel: stringOr(row.statusLabel, stringOr(row.status)),
              daysOverdue: numberOr(row.daysOverdue),
            };
          })
        : [],
    },
    payments: {
      allTimeRevenue: numberOr(paymentsRaw.allTimeRevenue),
      period: {
        today: mapPeriod("today"),
        week: mapPeriod("week"),
        month: mapPeriod("month"),
      },
      revenueChart: Array.isArray(paymentsRaw.revenueChart)
        ? paymentsRaw.revenueChart.map((item) => {
            const row = (item && typeof item === "object" ? item : {}) as Record<
              string,
              unknown
            >;
            return {
              key: stringOr(row.key),
              label: stringOr(row.label),
              value: numberOr(row.value),
            };
          })
        : [],
      latest: Array.isArray(paymentsRaw.latest)
        ? paymentsRaw.latest.map((item) => {
            const row = (item && typeof item === "object" ? item : {}) as Record<
              string,
              unknown
            >;
            return {
              id: stringOr(row.id),
              number: stringOr(row.number),
              amount: numberOr(row.amount),
              paidAt: stringOr(row.paidAt),
              invoiceNumber: stringOr(row.invoiceNumber),
              invoiceId: row.invoiceId ? stringOr(row.invoiceId) : null,
            };
          })
        : [],
    },
    salesChart: {
      month: mapSalesPoints(salesChartRaw.month),
      year: mapSalesPoints(salesChartRaw.year),
    },
    jobsChart: {
      month: mapJobsPoints(jobsChartRaw.month),
      year: mapJobsPoints(jobsChartRaw.year),
    },
    people: {
      customers: numberOr(peopleRaw.customers),
      employees: numberOr(peopleRaw.employees),
      contractors: numberOr(peopleRaw.contractors),
      vendors: numberOr(peopleRaw.vendors),
    },
    tasks: {
      overdueCount: numberOr(tasksRaw.overdueCount),
      myDay: Array.isArray(tasksRaw.myDay)
        ? tasksRaw.myDay.map((item) => {
            const row = (item && typeof item === "object" ? item : {}) as Record<
              string,
              unknown
            >;
            return {
              id: stringOr(row.id),
              title: stringOr(row.title),
              dueAt: stringOr(row.dueAt),
              priority: stringOr(row.priority, "normal"),
              isOverdue: Boolean(row.isOverdue),
              subjectKind: row.subjectKind ? stringOr(row.subjectKind) : null,
            };
          })
        : [],
    },
    reminders: {
      dueNext14Days: Array.isArray(remindersRaw.dueNext14Days)
        ? remindersRaw.dueNext14Days.map((item) => {
            const row = (item && typeof item === "object" ? item : {}) as Record<
              string,
              unknown
            >;
            return {
              id: stringOr(row.id),
              title: stringOr(row.title),
              dueAt: stringOr(row.dueAt),
              subjectKind: row.subjectKind ? stringOr(row.subjectKind) : null,
            };
          })
        : [],
    },
    activity: Array.isArray(data.activity)
      ? data.activity.map((item) => {
          const row = (item && typeof item === "object" ? item : {}) as Record<
            string,
            unknown
          >;
          return {
            id: stringOr(row.id),
            title: stringOr(row.title),
            detail: stringOr(row.detail),
            at: stringOr(row.at),
            href: stringOr(row.href, "/pro/dashboard"),
          };
        })
      : [],
  };
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
    // Sidebar badges stay socket-driven — do not REST-fetch summary / inbox-summary here.
    inboxSummary: {
      newLeads: 0,
      unreadChats: 0,
      pendingOrders: 0,
      pendingEstimates: 0,
      total: 0,
    },
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

export { resolveCrmObjectId, isLocalInvoicePortalKey };
