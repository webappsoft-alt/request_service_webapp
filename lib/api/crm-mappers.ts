import type {
  PortalContractor,
  PortalCustomerCrm,
  CustomerDetailPayload,
  CustomerDossier,
  CustomerDossierJobSummary,
  CustomerTimelineEvent,
  PortalReminder,
  PortalTask,
  PortalVendor,
} from "@/lib/data/crm-people";
import type {
  PortalCalendarEvent,
  PortalEmployee,
  PortalEmployeeActiveAssignments,
  PortalEmployeeAssignmentJob,
  PortalEmployeeAssignmentSchedule,
  PortalEmployeeAssignmentTask,
  PortalEmployeeDetail,
  PortalEmployeeWorkingHours,
  PortalEventKind,
  PortalRequest,
  PortalTimeWindow,
  QuoteAnswer,
} from "@/lib/data/portal";
import type { ChatAttachment, ChatMessage, ChatThread } from "@/lib/booking/chat-store";
import type {
  ChangeOrder,
  Customer,
  Estimate,
  EstimateActivity,
  EstimateAttachmentItem,
  EstimateItem,
  EstimateItemType,
  EstimateLog,
  EstimateSiteVisitRecord,
  Invoice,
  InvoiceItem,
  Job,
  JobItem,
  Payment,
  PaymentMethodType,
  PaymentStatus,
  ServiceAddress,
} from "@/lib/types";

type CrmListResponse<T> = {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

export type CrmInboxSummary = {
  newLeads: number;
  unreadChats: number;
  pendingOrders: number;
  total: number;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asArray<T = unknown>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function stringValue(value: unknown, fallback = ""): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return fallback;
}

function trimmed(value: unknown, fallback = ""): string {
  return stringValue(value, fallback).trim() || fallback;
}

function numberValue(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function booleanValue(value: unknown, fallback = false): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    if (value === "true") return true;
    if (value === "false") return false;
  }
  return fallback;
}

export function crmIdOf(value: unknown): string {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);

  const record = asRecord(value);
  if (!record) return "";

  if (typeof record.$oid === "string" && record.$oid.trim()) {
    return record.$oid.trim();
  }

  for (const key of ["id", "_id", "Id", "ID"] as const) {
    const raw = record[key];
    if (typeof raw === "string" && raw.trim()) return raw.trim();
    if (typeof raw === "number" && Number.isFinite(raw)) return String(raw);
    const nested = asRecord(raw);
    if (nested && typeof nested.$oid === "string" && nested.$oid.trim()) {
      return nested.$oid.trim();
    }
  }

  return "";
}

function personDisplayName(value: unknown): string {
  return displayNameFromRecord(value);
}

function toIsoString(value: unknown): string {
  if (!value) return "";
  if (typeof value === "string") {
    const trimmedValue = value.trim();
    if (!trimmedValue) return "";
    const parsed = new Date(trimmedValue);
    return Number.isNaN(parsed.getTime()) ? trimmedValue : parsed.toISOString();
  }
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "number" && Number.isFinite(value)) {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString();
  }
  const record = asRecord(value);
  if (record) {
    return toIsoString(record.$date ?? record.date ?? record.at ?? record.timestamp);
  }
  return "";
}

/** Calendar day key as YYYY-MM-DD (local-safe from ISO timestamps). */
function toDateOnly(value: unknown): string {
  if (!value) return "";
  if (typeof value === "string") {
    const trimmedValue = value.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmedValue)) return trimmedValue;
    const match = /^(\d{4}-\d{2}-\d{2})/.exec(trimmedValue);
    if (match) return match[1];
  }
  const iso = toIsoString(value);
  if (!iso) return "";
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(iso);
  return match?.[1] ?? "";
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => trimmed(item))
    .filter(Boolean);
}

function displayNameFromRecord(value: unknown): string {
  const record = asRecord(value);
  if (!record) return "";
  const companyName = trimmed(record.companyName);
  if (companyName) return companyName;
  const firstName = trimmed(record.firstName);
  const lastName = trimmed(record.lastName);
  const fullName = `${firstName} ${lastName}`.trim();
  return fullName || trimmed(record.displayName) || trimmed(record.name);
}

function firstValue<T>(...values: T[]): T | undefined {
  return values.find((value) => value !== undefined);
}

function mapServiceAddress(value: unknown, fallbackId = ""): ServiceAddress {
  const record = asRecord(value) ?? {};
  const coords = Array.isArray(record.coordinates) ? record.coordinates : null;
  const lng = numberValue(record.longitude ?? record.lng ?? coords?.[0], Number.NaN);
  const lat = numberValue(record.latitude ?? record.lat ?? coords?.[1], Number.NaN);
  return {
    id: crmIdOf(record) || fallbackId || `addr_${Math.random().toString(36).slice(2, 10)}`,
    label: trimmed(record.label) || undefined,
    street: trimmed(record.street) || trimmed(record.address),
    unit: trimmed(record.unit) || undefined,
    city: trimmed(record.city),
    state: trimmed(record.state),
    zip: trimmed(record.zip),
    country: "US",
    latitude: Number.isFinite(lat) ? lat : null,
    longitude: Number.isFinite(lng) ? lng : null,
  };
}

function mapCustomerAddresses(value: unknown): ServiceAddress[] {
  return asArray(value).map((entry, index) => mapServiceAddress(entry, `addr_${index + 1}`));
}

function mapRequestTimeWindow(value: unknown): PortalRequest["preferredTimeWindow"] {
  const raw = trimmed(value).toLowerCase();
  if (raw === "all_day") return "All day";
  if (raw === "afternoon") return "Afternoon";
  if (raw === "morning") return "Morning";
  return trimmed(value);
}

function mapEventTimeWindow(value: unknown): PortalTimeWindow {
  const raw = trimmed(value).toLowerCase();
  if (raw === "morning") return "morning";
  if (raw === "afternoon") return "afternoon";
  return "all_day";
}

function mapEstimateItemType(value: unknown): EstimateItemType {
  const raw = trimmed(value).toLowerCase();
  if (raw === "material" || raw === "materials") return "materials";
  if (raw === "services") return "services";
  if (raw === "miscellaneous" || raw === "misc") return "miscellaneous";
  return "labor";
}

function mapInvoiceItemSource(value: unknown, description: string): Invoice["items"][number]["source"] {
  const raw = trimmed(value).toLowerCase();
  if (raw === "discount") return "adjustment";
  if (raw === "fee" && /^change order:/i.test(description)) return "change_order";
  if (raw === "fee") return "adjustment";
  return "estimate";
}

function makeTaskNumber(id: string): string {
  const compact = id.replace(/[^a-z0-9]/gi, "").toUpperCase();
  return `TSK-${compact.slice(-4) || "0001"}`;
}

function makeHref(kind: PortalEventKind, recordId: string): string {
  switch (kind) {
    case "job":
      return `/pro/dashboard/jobs/${recordId}`;
    case "estimate":
      return `/pro/dashboard/estimates/${recordId}`;
    case "request":
      return `/pro/dashboard/requests/${recordId}`;
    case "invoice":
      return `/pro/dashboard/invoices/${recordId}`;
    case "task":
      return `/pro/dashboard/tasks/${recordId}`;
    default: {
      const _never: never = kind;
      return _never;
    }
  }
}

function getListPayload(response: unknown): unknown[] {
  if (Array.isArray(response)) return response;
  const root = asRecord(response) ?? {};
  if (Array.isArray(root.data)) return root.data;
  if (Array.isArray(root.items)) return root.items;
  const nested = asRecord(root.data);
  if (nested) {
    if (Array.isArray(nested.items)) return nested.items;
    if (Array.isArray(nested.estimates)) return nested.estimates;
    if (Array.isArray(nested.customers)) return nested.customers;
    if (Array.isArray(nested.jobs)) return nested.jobs;
    if (Array.isArray(nested.invoices)) return nested.invoices;
    if (Array.isArray(nested.payments)) return nested.payments;
    if (Array.isArray(nested.tasks)) return nested.tasks;
    if (Array.isArray(nested.reminders)) return nested.reminders;
    if (Array.isArray(nested.requests)) return nested.requests;
    if (Array.isArray(nested.activities)) return nested.activities;
    if (Array.isArray(nested.results)) return nested.results;
    if (Array.isArray(nested.rows)) return nested.rows;
    if (Array.isArray(nested.list)) return nested.list;
  }
  if (Array.isArray(root.estimates)) return root.estimates;
  if (Array.isArray(root.customers)) return root.customers;
  if (Array.isArray(root.jobs)) return root.jobs;
  if (Array.isArray(root.invoices)) return root.invoices;
  if (Array.isArray(root.payments)) return root.payments;
  if (Array.isArray(root.tasks)) return root.tasks;
  if (Array.isArray(root.reminders)) return root.reminders;
  if (Array.isArray(root.requests)) return root.requests;
  if (Array.isArray(root.activities)) return root.activities;
  if (Array.isArray(root.results)) return root.results;
  if (Array.isArray(root.rows)) return root.rows;
  if (Array.isArray(root.list)) return root.list;
  return [];
}

function getEntityPayload(response: unknown): unknown {
  const root = asRecord(response);
  if (!root) return response;
  const data = root.data;
  if (data !== undefined && data !== null) {
    const dataRec = asRecord(data);
    if (dataRec?.estimate !== undefined) return dataRec.estimate;
    if (dataRec?.activity !== undefined) return dataRec.activity;
    if (dataRec?.customer !== undefined) return dataRec.customer;
    if (dataRec?.employee !== undefined) return dataRec.employee;
    if (dataRec?.job !== undefined) return dataRec.job;
    if (dataRec?.invoice !== undefined) return dataRec.invoice;
    return data;
  }
  if (root.estimate !== undefined) return root.estimate;
  if (root.activity !== undefined) return root.activity;
  if (root.customer !== undefined) return root.customer;
  if (root.job !== undefined) return root.job;
  if (root.invoice !== undefined || root.payments !== undefined) {
    return {
      invoice: root.invoice,
      payments: root.payments,
    };
  }
  return root;
}

function getPagination(response: unknown, count: number) {
  const root = asRecord(response) ?? {};
  const nested = asRecord(root.data) ?? {};
  const pagination = asRecord(root.pagination) ?? asRecord(nested.pagination) ?? root;
  const page = Math.max(1, numberValue(pagination.page, 1));
  const limit = Math.max(1, numberValue(pagination.limit, count || 100));
  const total = Math.max(0, numberValue(pagination.total, numberValue(nested.total, count)));
  const totalPages = Math.max(
    1,
    numberValue(
      pagination.totalPages,
      numberValue(pagination.pages, Math.ceil((total || count || 1) / limit)),
    ),
  );
  return { page, limit, total, totalPages };
}

function populatedCustomer(record: Record<string, unknown>): Record<string, unknown> | null {
  const customer = asRecord(record.customerId);
  return customer ?? asRecord(record.customerSnapshot);
}

function customerNameParts(record: Record<string, unknown>) {
  const populated = populatedCustomer(record) ?? {};
  const firstName = trimmed(
    firstValue(populated.firstName, record.customerFirstName, record.firstName),
  );
  const lastName = trimmed(
    firstValue(populated.lastName, record.customerLastName, record.lastName),
  );
  const companyName = trimmed(
    firstValue(populated.companyName, record.customerCompanyName, record.companyName),
  );
  const directName = trimmed(
    firstValue(
      record.customerName,
      record.name,
      record.fullName,
      populated.name,
      populated.fullName,
    ),
  );
  const name =
    companyName ||
    `${firstName} ${lastName}`.trim() ||
    displayNameFromRecord(populated) ||
    directName ||
    "";
  return {
    firstName,
    lastName,
    companyName,
    name,
    email: trimmed(
      firstValue(
        populated.email,
        record.customerEmail,
        record.email,
        record.phoneOrEmail,
      ),
    ),
    phone: trimmed(
      firstValue(
        populated.phone,
        record.customerPhone,
        record.phone,
      ),
    ),
  };
}

export function mapPortalCustomerCrm(raw: unknown): PortalCustomerCrm | null {
  const record = asRecord(raw);
  if (!record) return null;

  const id = crmIdOf(record);
  if (!id) return null;

  const serviceAddresses = mapCustomerAddresses(record.serviceAddresses);
  const createdAt = toIsoString(record.createdAt);
  const updatedAt = toIsoString(record.updatedAt) || createdAt;

  return {
    id,
    userId: crmIdOf(record.linkedUserId) || crmIdOf(record.userId) || `user_${id}`,
    firstName: trimmed(record.firstName) || trimmed(record.companyName) || "Customer",
    lastName: trimmed(record.lastName),
    email: trimmed(record.email),
    phone: trimmed(record.phone) || undefined,
    addresses: serviceAddresses,
    createdAt,
    updatedAt,
    customerNumber: trimmed(record.customerNumber) || `CUST-${id.slice(-4).toUpperCase()}`,
    entityKind:
      trimmed(record.entityKind) === "company" ? "company" : "individual",
    customerType:
      trimmed(record.customerType) === "commercial"
        ? "commercial"
        : trimmed(record.customerType) === "property_manager"
          ? "property_manager"
          : "residential",
    source:
      trimmed(record.source) === "website" ||
      trimmed(record.source) === "phone" ||
      trimmed(record.source) === "referral" ||
      trimmed(record.source) === "walk_in"
        ? (trimmed(record.source) as PortalCustomerCrm["source"])
        : "external",
    companyName: trimmed(record.companyName) || undefined,
    altPhone: trimmed(record.altPhone) || undefined,
    doNotCall: booleanValue(record.doNotCall),
    taxCode: trimmed(record.taxCode),
    laborTaxCode: trimmed(record.laborTaxCode || record.taxCode),
    creditLimit: numberValue(record.creditLimit),
    onStop: booleanValue(record.onStop),
    membership:
      trimmed(record.membership) === "standard"
        ? "standard"
        : trimmed(record.membership) === "priority"
          ? "priority"
          : "none",
    preferredEmployeeId: crmIdOf(record.preferredEmployeeId) || undefined,
    tags: toStringArray(record.tags),
    notes: trimmed(record.notes),
    amountOwing: numberValue(record.amountOwing ?? record.balanceDue),
  };
}

function mapDossierJobSummary(raw: unknown): CustomerDossierJobSummary | null {
  const record = asRecord(raw);
  if (!record) return null;
  const id = crmIdOf(record);
  if (!id) return null;
  return {
    id,
    number: trimmed(record.number),
    title: trimmed(record.title),
    status: trimmed(record.status),
  };
}

export function mapCustomerDossier(raw: unknown): CustomerDossier {
  const record = asRecord(raw) ?? {};
  const mapList = (value: unknown) =>
    asArray(value)
      .map(mapDossierJobSummary)
      .filter((item): item is CustomerDossierJobSummary => Boolean(item));
  return {
    balanceDue: numberValue(record.balanceDue),
    totalInvoiced: numberValue(record.totalInvoiced),
    totalPaid: numberValue(record.totalPaid),
    estimatesCount: numberValue(record.estimatesCount),
    jobsCount: numberValue(record.jobsCount),
    invoicesCount: numberValue(record.invoicesCount),
    activeJobs: mapList(record.activeJobs),
    recentEstimates: mapList(record.recentEstimates),
    recentJobs: mapList(record.recentJobs),
    recentInvoices: mapList(record.recentInvoices),
  };
}

/** GET /api/provider/customers/:id — nested customer + dossier. */
export function mapCustomerDetail(response: unknown): CustomerDetailPayload | null {
  const root = asRecord(response) ?? {};
  const data = asRecord(root.data) ?? root;
  const customer = mapPortalCustomerCrm(data.customer ?? data);
  if (!customer) return null;
  const dossier = mapCustomerDossier(data.dossier);
  return {
    customer: {
      ...customer,
      amountOwing: dossier.balanceDue || customer.amountOwing,
    },
    dossier,
  };
}

export function mapCustomerTimelineEvent(raw: unknown): CustomerTimelineEvent | null {
  const record = asRecord(raw);
  if (!record) return null;
  const id = trimmed(record.id) || crmIdOf(record);
  if (!id) return null;
  return {
    id,
    type: trimmed(record.type),
    title: trimmed(record.title),
    description: trimmed(record.description),
    status: trimmed(record.status),
    actor: trimmed(record.actor) || "System",
    timestamp: toIsoString(record.timestamp) || toIsoString(record.createdAt),
    data: asRecord(record.data) ?? undefined,
  };
}

export function mapPortalRequest(raw: unknown): PortalRequest | null {
  const record = asRecord(raw);
  if (!record) return null;

  const id = crmIdOf(record);
  if (!id) return null;

  const customer = customerNameParts(record);
  const category = asRecord(record.categoryId);
  const answers = asArray(record.answers)
    .map((answer, index) => {
      const item = asRecord(answer);
      if (!item) return null;
      const label = trimmed(item.label || item.questionTitle || item.question);
      const value = trimmed(item.value || item.selectedValue || item.answer || item.text);
      return {
        id: trimmed(item.id || item.fieldId) || `ans_${index + 1}`,
        label,
        value,
      } satisfies QuoteAnswer;
    })
    .filter((item): item is QuoteAnswer => Boolean(item?.label));

  const photos = toStringArray(record.photos ?? record.photoUrls);
  const chatThread = asRecord(record.chatThread);
  const chatThreadId =
    crmIdOf(record.chatThreadId) || crmIdOf(chatThread?.id) || undefined;
  const unreadMessagesCount = Math.max(
    0,
    numberValue(
      record.unreadMessagesCount ?? chatThread?.unreadForProvider,
      0,
    ),
  );
  const hasActiveChat = Boolean(
    record.hasActiveChat || chatThreadId || chatThread || unreadMessagesCount > 0,
  );

  return {
    id,
    number: trimmed(record.number) || `REQ-${id.slice(-4).toUpperCase()}`,
    customerId: crmIdOf(record.customerId) || undefined,
    providerId: crmIdOf(record.providerId) || undefined,
    categoryId: crmIdOf(record.categoryId) || trimmed(record.categoryId),
    channel: trimmed(record.channel) === "marketplace" ? "marketplace" : "direct",
    source: trimmed(record.source) || "quote_request",
    viewCount: Math.max(1, numberValue(record.viewCount, 1)),
    lastInteractionAt:
      toIsoString(record.lastInteractionAt) ||
      toIsoString(record.updatedAt) ||
      toIsoString(record.createdAt),
    chatThreadId,
    unreadMessagesCount,
    hasActiveChat,
    zip: trimmed(record.zip),
    city: trimmed(record.city),
    state: trimmed(record.state),
    details: trimmed(record.details),
    preferredDate: toIsoString(record.preferredDate) || undefined,
    preferredTimeWindow: mapRequestTimeWindow(record.preferredTimeWindow) || undefined,
    photoUrls: photos,
    photos,
    status:
      trimmed(record.status) === "viewed" ||
      trimmed(record.status) === "contacted" ||
      trimmed(record.status) === "estimate_sent" ||
      trimmed(record.status) === "accepted" ||
      trimmed(record.status) === "declined" ||
      trimmed(record.status) === "converted_to_job" ||
      trimmed(record.status) === "closed"
        ? (trimmed(record.status) as PortalRequest["status"])
        : "new",
    createdAt: toIsoString(record.createdAt),
    updatedAt: toIsoString(record.updatedAt) || toIsoString(record.createdAt),
    customerName: customer.name || "Customer",
    customerEmail: customer.email,
    customerPhone: customer.phone,
    serviceName: trimmed(record.serviceName) || "Service request",
    categoryName: trimmed(category?.name) || trimmed(record.categoryName),
    neighborhood: trimmed(record.neighborhood) || trimmed(record.city),
    answers: answers.length ? answers : undefined,
  };
}

const EMPLOYEE_WORKING_DAYS: PortalEmployeeWorkingHours["day"][] = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];

function mapEmployeeWorkingHours(raw: unknown): PortalEmployeeWorkingHours[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const items = raw
    .map((entry): PortalEmployeeWorkingHours | null => {
      const record = asRecord(entry);
      if (!record) return null;
      const day = trimmed(record.day).toLowerCase() as PortalEmployeeWorkingHours["day"];
      if (!EMPLOYEE_WORKING_DAYS.includes(day)) return null;
      return {
        day,
        startMinutes: numberValue(record.startMinutes, 480),
        endMinutes: numberValue(record.endMinutes, 1020),
        active: booleanValue(record.active, true),
      };
    })
    .filter((item): item is PortalEmployeeWorkingHours => Boolean(item));
  return items.length ? items : undefined;
}

export function mapPortalEmployee(raw: unknown): PortalEmployee | null {
  const record = asRecord(raw);
  if (!record) return null;

  const id = crmIdOf(record);
  if (!id) return null;

  const role =
    trimmed(record.role) === "owner" ||
    trimmed(record.role) === "estimator" ||
    trimmed(record.role) === "dispatcher"
      ? (trimmed(record.role) as PortalEmployee["role"])
      : "technician";

  return {
    id,
    firstName: trimmed(record.firstName) || "Employee",
    lastName: trimmed(record.lastName),
    role,
    email: trimmed(record.email),
    phone: trimmed(record.phone),
    trade: trimmed(record.trade),
    active: booleanValue(record.active, true),
    hourlyRate: numberValue(record.hourlyRate, 0) || undefined,
    overtimeRate: numberValue(record.overtimeRate, 0) || undefined,
    travelRate: numberValue(record.travelRate, 0) || undefined,
    hireDate: toIsoString(record.hireDate) || undefined,
    emergencyName: trimmed(record.emergencyName) || undefined,
    emergencyPhone: trimmed(record.emergencyPhone) || undefined,
    workingHours: mapEmployeeWorkingHours(record.workingHours),
  };
}

function mapEmployeeAssignmentJob(raw: unknown): PortalEmployeeAssignmentJob | null {
  const record = asRecord(raw);
  if (!record) return null;
  const id = crmIdOf(record);
  if (!id) return null;
  return {
    id,
    number: trimmed(record.number),
    title: trimmed(record.title),
    status: trimmed(record.status),
  };
}

function mapEmployeeAssignmentTask(raw: unknown): PortalEmployeeAssignmentTask | null {
  const record = asRecord(raw);
  if (!record) return null;
  const id = crmIdOf(record);
  if (!id) return null;
  return {
    id,
    number: trimmed(record.number) || undefined,
    title: trimmed(record.title) || undefined,
    status: trimmed(record.status) || undefined,
    dueAt: toIsoString(record.dueAt) || undefined,
  };
}

function mapEmployeeAssignmentSchedule(raw: unknown): PortalEmployeeAssignmentSchedule | null {
  const record = asRecord(raw);
  if (!record) return null;
  const id = crmIdOf(record);
  if (!id) return null;
  return {
    id,
    title: trimmed(record.title),
    date: toIsoString(record.date) || trimmed(record.date),
    startMinutes: numberValue(record.startMinutes, 0),
    endMinutes: numberValue(record.endMinutes, 0),
    status: trimmed(record.status),
  };
}

export function mapEmployeeActiveAssignments(raw: unknown): PortalEmployeeActiveAssignments {
  const record = asRecord(raw) ?? {};
  return {
    jobs: asArray(record.jobs).map(mapEmployeeAssignmentJob).filter((item): item is PortalEmployeeAssignmentJob => Boolean(item)),
    tasks: asArray(record.tasks).map(mapEmployeeAssignmentTask).filter((item): item is PortalEmployeeAssignmentTask => Boolean(item)),
    schedule: asArray(record.schedule)
      .map(mapEmployeeAssignmentSchedule)
      .filter((item): item is PortalEmployeeAssignmentSchedule => Boolean(item)),
  };
}

/** GET /api/provider/team/:id — nested employee + activeAssignments. */
export function mapEmployeeDetail(response: unknown): PortalEmployeeDetail | null {
  const root = asRecord(response) ?? {};
  const data = asRecord(root.data) ?? root;
  const employeeRaw = data.employee ?? data;
  const employee = mapPortalEmployee(employeeRaw);
  if (!employee) return null;
  return {
    employee,
    activeAssignments: mapEmployeeActiveAssignments(data.activeAssignments),
  };
}

export function mapPortalContractor(raw: unknown): PortalContractor | null {
  const record = asRecord(raw);
  if (!record) return null;

  const id = crmIdOf(record);
  if (!id) return null;

  return {
    id,
    number: trimmed(record.number) || `CON-${id.slice(-4).toUpperCase()}`,
    firstName: trimmed(record.firstName),
    lastName: trimmed(record.lastName),
    companyName: trimmed(record.companyName) || displayNameFromRecord(record),
    email: trimmed(record.email),
    phone: trimmed(record.phone),
    trade: trimmed(record.trade),
    license: trimmed(record.license),
    city: trimmed(record.city),
    state: trimmed(record.state),
    zip: trimmed(record.zip),
    status:
      trimmed(record.status) === "inactive" || trimmed(record.status) === "on_stop"
        ? (trimmed(record.status) as PortalContractor["status"])
        : "active",
    hourlyRate: numberValue(record.hourlyRate),
    insuranceExpires: toIsoString(record.insuranceExpires),
    createdAt: toIsoString(record.createdAt),
  };
}

export function mapPortalVendor(raw: unknown): PortalVendor | null {
  const record = asRecord(raw);
  if (!record) return null;

  const id = crmIdOf(record);
  if (!id) return null;

  return {
    id,
    number: trimmed(record.number) || `VEN-${id.slice(-4).toUpperCase()}`,
    name: trimmed(record.name) || "Vendor",
    category: trimmed(record.category),
    contact: trimmed(record.contact),
    email: trimmed(record.email),
    phone: trimmed(record.phone),
    city: trimmed(record.city),
    state: trimmed(record.state),
    accountNumber: trimmed(record.accountNumber),
    terms: trimmed(record.terms) || "Net 30",
    balance: numberValue(record.balance),
    status:
      trimmed(record.status) === "inactive" || trimmed(record.status) === "on_stop"
        ? (trimmed(record.status) as PortalVendor["status"])
        : "active",
    createdAt: toIsoString(record.createdAt),
  };
}

function mapEstimateItems(estimateId: string, value: unknown): EstimateItem[] {
  return asArray(value)
    .map((entry, index) => {
      const record = asRecord(entry);
      if (!record) return null;
      const type = mapEstimateItemType(record.kind ?? record.type);
      return {
        id: crmIdOf(record) || `${estimateId}_item_${index + 1}`,
        estimateId,
        type,
        description: trimmed(record.description),
        quantity: Math.max(0, numberValue(record.quantity, 1)),
        unit: trimmed(record.unit) || (type === "labor" ? "hr" : "ea"),
        unitPrice: numberValue(record.unitPrice),
        taxRate: numberValue(record.taxRate, 0),
        discount: numberValue(record.discount, 0),
        total: numberValue(record.total),
      } satisfies EstimateItem;
    })
    .filter((item): item is EstimateItem => Boolean(item));
}

export function mapEstimateSiteVisit(value: unknown): EstimateSiteVisitRecord | undefined {
  const record = asRecord(value);
  if (!record) return undefined;
  const photos = asArray(record.photos)
    .map((entry, index) => {
      const photo = asRecord(entry);
      if (!photo) return null;
      const url = trimmed(photo.url) || trimmed(photo.dataUrl);
      if (!url) return null;
      return {
        id: trimmed(photo.id) || `photo_${index + 1}`,
        name: trimmed(photo.name) || `Photo ${index + 1}`,
        type: trimmed(photo.type) || "image/jpeg",
        size: numberValue(photo.size),
        url,
        addedAt: trimmed(photo.addedAt) || toIsoString(photo.addedAt),
        actor: trimmed(photo.actor) || undefined,
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));
  const hasText = [
    record.employeeId,
    record.technician,
    record.visitedAt,
    record.accessNotes,
    record.findings,
    record.recommendations,
    record.measurements,
  ].some((item) => trimmed(item));
  if (!hasText && !photos.length) return undefined;
  return {
    employeeId: trimmed(record.employeeId) || undefined,
    technician: trimmed(record.technician) || undefined,
    visitedAt: trimmed(record.visitedAt) || undefined,
    accessNotes: trimmed(record.accessNotes) || undefined,
    findings: trimmed(record.findings) || undefined,
    recommendations: trimmed(record.recommendations) || undefined,
    measurements: trimmed(record.measurements) || undefined,
    photos,
  };
}

function mapApprovalSignature(value: unknown): Estimate["signature"] | undefined {
  const record = asRecord(value);
  if (!record) return undefined;
  const signedAt = toIsoString(record.signedAt);
  const signedBy = trimmed(record.signedBy);
  if (!signedAt && !signedBy) return undefined;
  const imageBase64 =
    trimmed(record.signatureImageBase64) ||
    trimmed(record.imageBase64) ||
    trimmed(record.dataUrl) ||
    undefined;
  return {
    signedBy,
    signedAt,
    ipAddress: trimmed(record.ipAddress) || undefined,
    imageBase64,
  };
}

function mapEstimateAttachments(value: unknown): EstimateAttachmentItem[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item, index) => {
      if (typeof item === "string" && item.trim()) {
        const url = item.trim();
        const name = url.split("/").pop() || `Attachment ${index + 1}`;
        return { name, attachment: url };
      }
      const record = asRecord(item);
      if (!record) return null;
      const url = trimmed(record.attachment || record.url || record.dataUrl);
      if (!url) return null;
      const name = trimmed(record.name) || url.split("/").pop() || `Attachment ${index + 1}`;
      return { name, attachment: url };
    })
    .filter((entry): entry is EstimateAttachmentItem => Boolean(entry));
}

export function mapEstimate(raw: unknown): Estimate | null {
  const record = asRecord(raw);
  if (!record) return null;

  const id = crmIdOf(record);
  if (!id) return null;

  const customerId = crmIdOf(record.customerId);
  const addressSource =
    asRecord(asRecord(record.customerSnapshot)?.address) ??
    asRecord(record.propertyAddress) ??
    asRecord(record.address) ??
    {};
  const address = mapServiceAddress(addressSource, `addr_${id}`);

  return {
    id,
    number: trimmed(record.number) || `EST-${id.slice(-4).toUpperCase()}`,
    title: trimmed(record.title) || undefined,
    providerId: crmIdOf(record.providerId),
    customerId,
    customerName:
      customerNameParts(record).name ||
      personDisplayName(record.customerSnapshot) ||
      personDisplayName(record.customerId) ||
      trimmed(record.customerName) ||
      undefined,
    customerPhone: customerNameParts(record).phone || undefined,
    customerEmail: customerNameParts(record).email || undefined,
    requestId: crmIdOf(record.requestId) || undefined,
    jobId: crmIdOf(record.jobId) || undefined,
    serviceId: crmIdOf(record.serviceId) || undefined,
    propertyAddress: address,
    status:
      trimmed(record.status) === "site_visit" ||
      trimmed(record.status) === "inspected" ||
      trimmed(record.status) === "finalized" ||
      trimmed(record.status) === "sent" ||
      trimmed(record.status) === "accepted" ||
      trimmed(record.status) === "rejected" ||
      trimmed(record.status) === "expired" ||
      trimmed(record.status) === "changes_requested" ||
      trimmed(record.status) === "converted_to_job"
        ? (trimmed(record.status) as Estimate["status"])
        : "draft",
    issuedAt: toIsoString(record.issuedAt) || toIsoString(record.createdAt),
    expiresAt: toIsoString(record.expiresAt) || undefined,
    notes: trimmed(record.notes) || undefined,
    terms: trimmed(record.terms) || undefined,
    subtotal: numberValue(record.subtotal),
    discount: numberValue(record.discount),
    tax: numberValue(record.tax),
    total: numberValue(record.total),
    items: mapEstimateItems(id, record.items),
    attachments: mapEstimateAttachments(record.attachments),
    siteVisit: mapEstimateSiteVisit(record.siteVisit),
    signature: mapApprovalSignature(record.approval ?? record.signature),
    isArchived: record.isArchived !== undefined || record.isArchieved !== undefined
      ? Boolean(record.isArchived ?? record.isArchieved)
      : undefined,
    isArchieved: record.isArchived !== undefined || record.isArchieved !== undefined
      ? Boolean(record.isArchived ?? record.isArchieved)
      : undefined,
    logs: asArray(record.logs)
      .map((entry, idx) => mapEstimateLog(entry, idx))
      .filter((item): item is EstimateLog => Boolean(item)),
    activities: asArray(record.activities)
      .map(mapEstimateActivity)
      .filter((item): item is EstimateActivity => Boolean(item)),
    createdAt: toIsoString(record.createdAt),
    updatedAt: toIsoString(record.updatedAt) || toIsoString(record.createdAt),
  };
}

export function mapEstimateLog(raw: unknown, index: number): EstimateLog | null {
  const record = asRecord(raw);
  if (!record) return null;
  const id = crmIdOf(record) || `log_${index + 1}`;
  return {
    id,
    actor:
      displayNameFromRecord(record.actor ?? record.user ?? record.createdBy) ||
      trimmed(record.actor) ||
      "System",
    action: trimmed(record.action || record.title || "Estimate updated"),
    details: trimmed(record.details || record.detail || record.notes) || undefined,
    timestamp: toIsoString(record.timestamp || record.at || record.createdAt || record.date) || new Date().toISOString(),
  };
}

export function mapEstimateActivity(raw: unknown): EstimateActivity | null {
  const record = asRecord(raw);
  if (!record) return null;

  const id = crmIdOf(record);
  if (!id) return null;

  return {
    id,
    estimateId: crmIdOf(record.estimateId) || undefined,
    title: trimmed(record.title) || "Activity",
    description: stringValue(record.description ?? record.html ?? record.note ?? record.detail ?? ""),
    actor:
      displayNameFromRecord(record.actor ?? record.user ?? record.createdBy ?? record.author) ||
      trimmed(record.actor) ||
      trimmed(record.actorName) ||
      "Desk",
    createdAt: toIsoString(record.timestamp ?? record.createdAt ?? record.at ?? record.date) || new Date().toISOString(),
    updatedAt: toIsoString(record.updatedAt) || undefined,
  };
}

function mapJobItemSource(value: unknown): JobItem["source"] {
  return trimmed(value).toLowerCase() === "change_order" ? "change_order" : "estimate";
}

function mapJobItems(jobId: string, value: unknown): JobItem[] {
  return asArray(value)
    .map((entry, index) => {
      const record = asRecord(entry);
      if (!record) return null;
      return {
        id: crmIdOf(record) || `${jobId}_item_${index + 1}`,
        jobId,
        source: mapJobItemSource(record.source),
        description: trimmed(record.description),
        quantity: Math.max(0, numberValue(record.quantity, 1)),
        unit: trimmed(record.unit) || (mapEstimateItemType(record.kind) === "labor" ? "hr" : "ea"),
        unitPrice: numberValue(record.unitPrice),
        total: numberValue(record.total),
      } satisfies JobItem;
    })
    .filter((item): item is JobItem => Boolean(item));
}

function mapChangeOrders(jobId: string, value: unknown): ChangeOrder[] {
  return asArray(value)
    .map<ChangeOrder | null>((entry, index) => {
      const record = asRecord(entry);
      if (!record) return null;
      const id = crmIdOf(record) || `${jobId}_co_${index + 1}`;
      const amount = numberValue(record.amount ?? record.total);
      const title = trimmed(record.title) || "Change order";
      const description = trimmed(record.description);
      return {
        id,
        jobId,
        number: `CO-${String(index + 1).padStart(2, "0")}`,
        description: [title, description].filter(Boolean).join(" - "),
        status:
          trimmed(record.status) === "approved"
            ? "approved"
            : trimmed(record.status) === "rejected"
              ? "rejected"
              : "pending_approval",
        items: [
          {
            id: `${id}_item`,
            jobId,
            source: "change_order",
            description: title,
            quantity: 1,
            unit: "ea",
            unitPrice: amount,
            total: amount,
          },
        ],
        total: amount,
        createdAt: toIsoString(record.requestedAt ?? record.createdAt),
        updatedAt: toIsoString(record.approvedAt ?? record.updatedAt ?? record.requestedAt),
      } satisfies ChangeOrder;
    })
    .filter((item): item is ChangeOrder => item !== null);
}

function mapAssignedName(value: unknown): string {
  if (Array.isArray(value)) {
    const first = value[0];
    const firstName = displayNameFromRecord(first);
    if (firstName) return firstName;
    return trimmed(first);
  }
  return displayNameFromRecord(value) || trimmed(value);
}

export function mapJob(raw: unknown): Job | null {
  const record = asRecord(raw);
  if (!record) return null;

  const id = crmIdOf(record);
  if (!id) return null;

  const locationRecord = asRecord(record.location);
  const locationHasAddress = Boolean(
    locationRecord &&
      (trimmed(locationRecord.address) ||
        trimmed(locationRecord.street) ||
        trimmed(locationRecord.city) ||
        trimmed(locationRecord.zip)),
  );
  const addressSource =
    (locationHasAddress ? locationRecord : null) ??
    asRecord(asRecord(record.customerSnapshot)?.address) ??
    asRecord(record.address) ??
    {};

  return {
    id,
    number: trimmed(record.number) || `JOB-${id.slice(-4).toUpperCase()}`,
    title: trimmed(record.title) || undefined,
    providerId: crmIdOf(record.providerId),
    customerId: crmIdOf(record.customerId),
    estimateId: crmIdOf(record.estimateId),
    serviceId: crmIdOf(record.serviceId) || undefined,
    address: mapServiceAddress(addressSource, `addr_${id}`),
    assignedTo:
      mapAssignedName(record.assignedEmployees) ||
      mapAssignedName(record.assignedContractors) ||
      trimmed(record.assignedTo) ||
      undefined,
    scheduledAt: toIsoString(record.scheduledAt) || undefined,
    dueAt: toIsoString(record.dueAt) || undefined,
    status:
      trimmed(record.status) === "scheduled" ||
      trimmed(record.status) === "dispatched" ||
      trimmed(record.status) === "en_route" ||
      trimmed(record.status) === "on_site" ||
      trimmed(record.status) === "in_progress" ||
      trimmed(record.status) === "on_hold" ||
      trimmed(record.status) === "waiting_parts" ||
      trimmed(record.status) === "needs_return" ||
      trimmed(record.status) === "completed" ||
      trimmed(record.status) === "invoiced" ||
      trimmed(record.status) === "paid" ||
      trimmed(record.status) === "cancelled"
        ? (trimmed(record.status) as Job["status"])
        : "unscheduled",
    notes: trimmed(record.notes) || undefined,
    items: mapJobItems(id, record.items),
    changeOrders: mapChangeOrders(id, record.changeOrders),
    attachments: toStringArray(record.attachments),
    invoiceId: crmIdOf(record.invoiceId) || undefined,
    createdAt: toIsoString(record.createdAt),
    updatedAt: toIsoString(record.updatedAt) || toIsoString(record.createdAt),
  };
}

function mapInvoiceItems(invoiceId: string, value: unknown): InvoiceItem[] {
  return asArray(value)
    .map((entry, index) => {
      const record = asRecord(entry);
      if (!record) return null;
      const description = trimmed(record.description);
      return {
        id: crmIdOf(record) || `${invoiceId}_item_${index + 1}`,
        invoiceId,
        source: mapInvoiceItemSource(record.kind ?? record.source, description),
        description,
        quantity: Math.max(0, numberValue(record.quantity, 1)),
        unitPrice: numberValue(record.unitPrice),
        total: numberValue(record.total),
      } satisfies InvoiceItem;
    })
    .filter((item): item is InvoiceItem => Boolean(item));
}

export function mapInvoice(raw: unknown): Invoice | null {
  const record = asRecord(raw);
  if (!record) return null;

  const id = crmIdOf(record);
  if (!id) return null;

  return {
    id,
    number: trimmed(record.number) || `INV-${id.slice(-4).toUpperCase()}`,
    providerId: crmIdOf(record.providerId),
    customerId: crmIdOf(record.customerId),
    jobId: crmIdOf(record.jobId),
    status:
      trimmed(record.status) === "sent" ||
      trimmed(record.status) === "partially_paid" ||
      trimmed(record.status) === "paid" ||
      trimmed(record.status) === "overdue" ||
      trimmed(record.status) === "cancelled"
        ? (trimmed(record.status) as Invoice["status"])
        : "draft",
    issuedAt: toIsoString(record.issuedAt) || toIsoString(record.createdAt),
    dueAt: toIsoString(record.dueAt) || undefined,
    subtotal: numberValue(record.subtotal),
    discount: numberValue(record.discount),
    tax: numberValue(record.tax),
    total: numberValue(record.total),
    amountPaid: numberValue(record.amountPaid),
    balanceDue: numberValue(record.balanceDue, Math.max(0, numberValue(record.total) - numberValue(record.amountPaid))),
    items: mapInvoiceItems(id, record.items),
    createdAt: toIsoString(record.createdAt),
    updatedAt: toIsoString(record.updatedAt) || toIsoString(record.createdAt),
  };
}

export function mapPayment(raw: unknown): Payment | null {
  const record = asRecord(raw);
  if (!record) return null;

  const id = crmIdOf(record);
  if (!id) return null;

  const methodRaw = trimmed(record.method);
  const method: PaymentMethodType =
    methodRaw === "card" || methodRaw === "ach" || methodRaw === "cash" ? methodRaw : "check";
  const statusRaw = trimmed(record.status);
  const status: PaymentStatus =
    statusRaw === "pending" ||
    statusRaw === "processing" ||
    statusRaw === "failed" ||
    statusRaw === "refunded"
      ? statusRaw
      : "succeeded";

  return {
    id,
    invoiceId: crmIdOf(record.invoiceId),
    scheduleId: crmIdOf(record.scheduleId) || undefined,
    amount: numberValue(record.amount),
    method,
    status,
    paidAt: toIsoString(record.paidAt) || undefined,
    createdAt: toIsoString(record.createdAt) || toIsoString(record.paidAt),
  };
}

export function mapPortalTask(raw: unknown): PortalTask | null {
  const record = asRecord(raw);
  if (!record) return null;

  const id = crmIdOf(record);
  if (!id) return null;

  return {
    id,
    number: trimmed(record.number) || makeTaskNumber(id),
    title: trimmed(record.title) || "Task",
    note: trimmed(record.note),
    customerId: crmIdOf(record.customerId) || undefined,
    subjectKind: trimmed(record.subjectKind) as PortalTask["subjectKind"],
    subjectId: crmIdOf(record.subjectId) || undefined,
    assignedEmployeeId: crmIdOf(record.assignedEmployeeId) || undefined,
    priority:
      trimmed(record.priority) === "low" ||
      trimmed(record.priority) === "high" ||
      trimmed(record.priority) === "urgent"
        ? (trimmed(record.priority) as PortalTask["priority"])
        : "normal",
    status:
      trimmed(record.status) === "in_progress" ||
      trimmed(record.status) === "blocked" ||
      trimmed(record.status) === "done"
        ? (trimmed(record.status) as PortalTask["status"])
        : "open",
    dueAt: toIsoString(record.dueAt) || toIsoString(record.createdAt),
    createdAt: toIsoString(record.createdAt),
  };
}

export function mapPortalReminder(raw: unknown): PortalReminder | null {
  const record = asRecord(raw);
  if (!record) return null;

  const id = crmIdOf(record);
  if (!id) return null;

  return {
    id,
    customerId: crmIdOf(record.customerId) || undefined,
    subjectKind: trimmed(record.subjectKind) as PortalReminder["subjectKind"],
    subjectId: crmIdOf(record.subjectId) || undefined,
    title: trimmed(record.title) || "Reminder",
    note: trimmed(record.note),
    dueAt: toIsoString(record.dueAt) || toIsoString(record.createdAt),
    assignedEmployeeId: crmIdOf(record.assignedEmployeeId) || undefined,
    status: trimmed(record.status) === "done" ? "done" : "open",
    createdAt: toIsoString(record.createdAt),
  };
}

export function mapChatAttachment(raw: unknown, index: number): ChatAttachment | null {
  const record = asRecord(raw);
  if (!record) return null;
  const url = trimmed(record.url);
  if (!url) return null;
  return {
    id: trimmed(record.id) || `att_${index + 1}`,
    name: trimmed(record.name) || `Attachment ${index + 1}`,
    url,
    type: trimmed(record.type) || "application/octet-stream",
  };
}

export function mapChatMessage(raw: unknown): ChatMessage | null {
  const record = asRecord(raw);
  if (!record) return null;
  const id = crmIdOf(record);
  return {
    id: id || `msg_${Math.random().toString(36).slice(2, 10)}`,
    from: trimmed(record.from) === "customer" ? "customer" : "provider",
    text: trimmed(record.text),
    at: toIsoString(record.at) || toIsoString(record.createdAt),
    attachments: asArray(record.attachments)
      .map((entry, index) => mapChatAttachment(entry, index))
      .filter((item): item is ChatAttachment => Boolean(item)),
  };
}

export function mapChatThread(raw: unknown): ChatThread | null {
  const record = asRecord(raw);
  if (!record) return null;

  const id = crmIdOf(record);
  if (!id) return null;

  const cust = asRecord(record.customerId);
  const customerAvatar =
    trimmed(record.customerAvatar) ||
    trimmed(cust?.avatarUrl) ||
    trimmed(cust?.avatar) ||
    undefined;

  const prov = asRecord(record.providerId);
  const providerName =
    trimmed(record.providerName) ||
    trimmed(prov?.companyName) ||
    trimmed(prov?.name) ||
    trimmed(prov?.businessName) ||
    undefined;
  const providerAvatar =
    trimmed(record.providerAvatar) ||
    trimmed(prov?.avatarUrl) ||
    trimmed(prov?.avatar) ||
    trimmed(prov?.logo) ||
    undefined;
  const providerPhone =
    trimmed(record.providerPhone) ||
    trimmed(prov?.phone) ||
    undefined;

  return {
    id,
    providerId: crmIdOf(record.providerId),
    providerName,
    providerAvatar,
    providerPhone,
    customerId: crmIdOf(record.customerId) || undefined,
    customerName: trimmed(record.customerName) || trimmed(cust?.name) || "Customer",
    customerEmail: trimmed(record.customerEmail) || trimmed(cust?.email),
    customerPhone: trimmed(record.customerPhone) || trimmed(cust?.phone) || undefined,
    customerAvatar,
    requestId: crmIdOf(record.requestId) || undefined,
    unreadForProvider: Math.max(0, numberValue(record.unreadForProvider)),
    unreadForCustomer: Math.max(0, numberValue(record.unreadForCustomer)),
    messages: asArray(record.messages)
      .map(mapChatMessage)
      .filter((item): item is ChatMessage => Boolean(item)),
    updatedAt: toIsoString(record.updatedAt) || toIsoString(record.createdAt),
  };
}

export function mapScheduleEvent(raw: unknown): PortalCalendarEvent | null {
  const record = asRecord(raw);
  if (!record) return null;

  const id = crmIdOf(record);
  const kindRaw = trimmed(record.kind);
  const kind: PortalEventKind =
    kindRaw === "estimate" ||
    kindRaw === "request" ||
    kindRaw === "invoice" ||
    kindRaw === "task"
      ? (kindRaw as PortalEventKind)
      : "job";
  const recordId = crmIdOf(record.recordId);

  return {
    id: id || `cal_${recordId || Math.random().toString(36).slice(2, 8)}`,
    kind,
    recordId,
    title: trimmed(record.title) || "Scheduled item",
    detail: trimmed(record.detail) || trimmed(record.title),
    customerName: trimmed(record.customerName) || undefined,
    date: toDateOnly(record.date) || undefined,
    endDate: toDateOnly(record.endDate) || undefined,
    timeWindow: mapEventTimeWindow(record.timeWindow),
    startMinutes: numberValue(record.startMinutes, 0) || undefined,
    endMinutes: numberValue(record.endMinutes, 0) || undefined,
    employeeId: crmIdOf(record.employeeId) || crmIdOf(record.contractorId) || undefined,
    href: makeHref(kind, recordId),
    status: trimmed(record.status) || "scheduled",
  };
}

export function mapInboxSummary(raw: unknown): CrmInboxSummary {
  const root = asRecord(raw) ?? {};
  const data = asRecord(root.data) ?? root;
  const newLeads = Math.max(
    0,
    numberValue(data.newLeadsCount ?? data.unseenLeadsCount ?? data.newLeads, 0),
  );
  const unreadChats = Math.max(
    0,
    numberValue(data.unreadMessagesCount ?? data.unreadChats, 0),
  );
  const pendingOrders = Math.max(0, numberValue(data.pendingOrders, 0));
  return {
    newLeads,
    unreadChats,
    pendingOrders,
    total: Math.max(
      0,
      numberValue(
        data.totalActiveLeads ?? data.total,
        newLeads + unreadChats + pendingOrders,
      ),
    ),
  };
}

export function mapCrmList<T>(
  response: unknown,
  mapper: (value: unknown) => T | null,
): CrmListResponse<T> {
  const items = getListPayload(response)
    .map(mapper)
    .filter((item): item is T => Boolean(item));
  const pagination = getPagination(response, items.length);
  return {
    items,
    ...pagination,
  };
}

export function mapCrmEntity<T>(
  response: unknown,
  mapper: (value: unknown) => T | null,
): T | null {
  return mapper(getEntityPayload(response));
}

export function mapInvoiceWithPayments(response: unknown): {
  invoice: Invoice | null;
  payments: Payment[];
} {
  const payload = asRecord(getEntityPayload(response)) ?? {};
  return {
    invoice: mapInvoice(payload.invoice ?? payload),
    payments: asArray(payload.payments)
      .map(mapPayment)
      .filter((item): item is Payment => Boolean(item)),
  };
}
