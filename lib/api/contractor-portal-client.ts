import { contractorPortalApi, providerCrmApi, technicianApi } from "@/components/api/ApiRoutesFile";
import { deleteData, getData, postData, putData } from "@/components/api/sliceHttp";
import { mapTimeEntry, mapTimeSummary, type TimeEntry, type TimeSummary } from "@/lib/time-tracking";
import type { LedgerRow, TechnicianLedger, TechnicianPaymentMethod } from "@/lib/api/technician-client";

/* ───────────────────────────── Types ───────────────────────────── */

export type ContractorRequestType = "completion" | "change_order";
export type ContractorRequestStatus = "pending_pro_approval" | "approved" | "rejected";

export type ContractorRequest = {
  id: string;
  type: ContractorRequestType;
  status: ContractorRequestStatus;
  photos: string[];
  notes: string;
  description: string;
  reason: string;
  estimatedCost: number;
  reviewNote: string;
  reviewedBy: string;
  reviewedAt: string | null;
  changeOrderId: string | null;
  changeOrderNumber: string;
  createdAt: string;
  jobId: string;
  /** Who sent it: an outside contractor or an internal technician. */
  participantType: "contractor" | "technician";
  /** Display name of the sender (contractor company / technician). */
  requesterName: string;
  contractorId: string;
  employeeId: string;
  employee: { id: string; name: string; role: string; phone: string } | null;
  job: { id: string; number: string; title: string; status: string } | null;
  contractor: {
    id: string;
    name: string;
    companyName: string;
    contactName: string;
    trade: string;
    number: string;
    email: string;
    phone: string;
  } | null;
};

export type ContractorRequirement = {
  id: string;
  description: string;
  kind: "labor" | "material" | "equipment";
  quantity: number;
  section: string;
  images: string[];
};

export type ContractorJob = {
  id: string;
  number: string;
  title: string;
  status: string;
  scheduledAt: string | null;
  dueAt: string | null;
  notes?: string;
  site: { address: string; city: string; state: string; zip: string };
  customer: { name: string; phone: string };
  requirements: Record<"labor" | "material" | "equipment", ContractorRequirement[]>;
  completion: {
    id: string;
    status: ContractorRequestStatus;
    reviewNote: string;
    submittedAt: string;
    reviewedAt: string | null;
  } | null;
  pendingChangeRequests: number;
  /** This contractor's scope + pay terms on the job. */
  assignment: ContractorAssignmentTerms;
  /** Live change orders (extra scope, no prices). */
  changeOrders: ContractorJobChangeOrder[];
  /** Site coordinates [lng, lat] when the office geocoded the address. */
  coordinates: [number, number] | null;
};

export type ContractorJobChangeOrder = {
  id: string;
  number: string;
  title: string;
  description: string;
  status: string;
  /** This person asked for it, so they confirm the written-up scope. */
  requestedByMe: boolean;
  /** "" = no acceptance needed, "pending" = waiting for them, "accepted". */
  acceptance: "" | "pending" | "accepted";
  acceptedAt: string | null;
  items: Array<{ id: string; description: string; kind: "labor" | "material" | "equipment"; quantity: number }>;
};

export type ContractorAssignmentTerms = {
  title: string;
  startAt: string | null;
  endAt: string | null;
  instructions: string;
  payType: "hourly" | "fixed";
  payRate: number;
  estimatedHours: number;
};

/** Earned / paid / balance for one job (see backend contractor/ledger.js). */
export type ContractorPayRow = {
  jobId: string;
  number: string;
  title: string;
  status: string;
  scheduledAt: string | null;
  payType: "hourly" | "fixed";
  payRate: number;
  hours: number;
  labor: number;
  extras: number;
  earned: number;
  paid: number;
  balance: number;
  completion: string | null;
  approved: boolean;
  payable: boolean;
  payments: number;
  lastPaidAt: string | null;
};

export type ContractorPayTotals = { earned: number; paid: number; balance: number; payable: number };

export type ContractorPaymentRecord = {
  id: string;
  number: string;
  amount: number;
  method: string;
  paidAt: string;
  reference: string;
  notes: string;
  jobId: string;
  job: { id: string; number: string; title: string } | null;
};

export type ContractorJobDetail = {
  job: ContractorJob;
  completions: ContractorRequest[];
  changeRequests: ContractorRequest[];
  pay: ContractorPayRow | null;
  payments: ContractorPaymentRecord[];
  timeEntries: TimeEntry[];
  timeSummary: TimeSummary;
  activeEntry: TimeEntry | null;
};

export type ContractorDashboard = {
  counts: {
    totalAssigned: number;
    inProgress: number;
    activeJobs: number;
    completedJobs: number;
    awaitingApproval: number;
    reworkRequested: number;
    openChangeRequests: number;
  };
  earnings: ContractorPayTotals;
  upcoming: ContractorJob[];
  recentFeedback: ContractorRequest[];
};

export type ContractorScheduleRow = {
  id: string;
  jobId: string;
  number: string;
  title: string;
  status: string;
  date: string;
  endDate: string | null;
  startMinutes: number | null;
  endMinutes: number | null;
  /** Exact times the office set for this contractor, when it did. */
  startAt: string | null;
  endAt: string | null;
  site: { address: string; city: string; state: string; zip: string };
  instructions: string;
};

export type ContractorPayouts = {
  jobs: ContractorPayRow[];
  totals: ContractorPayTotals;
  payments: ContractorPaymentRecord[];
};

export type ContractorProfile = {
  id: string;
  number: string;
  firstName: string;
  lastName: string;
  companyName: string;
  displayName: string;
  email: string;
  phone: string;
  trade: string;
  license: string;
  status: string;
  provider: { id: string; name: string; phone: string; email: string } | null;
};

export type ContractorBadges = { jobs: number; changeRequests: number; payouts: number };
export type ContractorSection = keyof ContractorBadges;

export type Paginated<T> = {
  items: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export type PendingReviewCounts = { completions: number; changeOrders: number; total: number };

/* ───────────────────────────── Mappers ───────────────────────────── */

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function str(value: unknown): string {
  return value === null || value === undefined ? "" : String(value);
}

function dataOf(response: unknown) {
  const root = asRecord(response);
  return root.data !== undefined ? root.data : response;
}

function mapRequest(value: unknown): ContractorRequest {
  const row = asRecord(value);
  const job = row.job ? asRecord(row.job) : null;
  const contractor = row.contractor ? asRecord(row.contractor) : null;
  const employee = row.employee ? asRecord(row.employee) : null;
  const participantType = row.participantType === "technician" ? "technician" : "contractor";
  return {
    id: str(row.id),
    participantType,
    requesterName:
      str(row.requesterName) ||
      (participantType === "technician" ? str(employee?.name) || "Technician" : str(contractor?.name) || "Contractor"),
    employeeId: str(row.employeeId || employee?.id),
    employee: employee
      ? { id: str(employee.id), name: str(employee.name), role: str(employee.role), phone: str(employee.phone) }
      : null,
    type: row.type === "change_order" ? "change_order" : "completion",
    status: (["approved", "rejected"].includes(str(row.status)) ? row.status : "pending_pro_approval") as ContractorRequestStatus,
    photos: Array.isArray(row.photos) ? row.photos.map(str).filter(Boolean) : [],
    notes: str(row.notes),
    description: str(row.description),
    reason: str(row.reason),
    estimatedCost: Number(row.estimatedCost) || 0,
    reviewNote: str(row.reviewNote),
    reviewedBy: str(row.reviewedBy),
    reviewedAt: row.reviewedAt ? str(row.reviewedAt) : null,
    changeOrderId: row.changeOrderId ? str(row.changeOrderId) : null,
    changeOrderNumber: str(row.changeOrderNumber),
    createdAt: str(row.createdAt),
    jobId: str(row.jobId || job?.id),
    contractorId: str(row.contractorId || contractor?.id),
    job: job ? { id: str(job.id), number: str(job.number), title: str(job.title), status: str(job.status) } : null,
    contractor: contractor
      ? {
          id: str(contractor.id),
          name: str(contractor.name) || "Contractor",
          companyName: str(contractor.companyName),
          contactName: str(contractor.contactName),
          trade: str(contractor.trade),
          number: str(contractor.number),
          email: str(contractor.email),
          phone: str(contractor.phone),
        }
      : null,
  };
}

function mapRequirements(value: unknown): ContractorJob["requirements"] {
  const row = asRecord(value);
  const group = (kind: ContractorRequirement["kind"]) =>
    (Array.isArray(row[kind]) ? (row[kind] as unknown[]) : []).map((item) => {
      const r = asRecord(item);
      return {
        id: str(r.id),
        description: str(r.description),
        kind,
        quantity: Number(r.quantity) || 0,
        section: str(r.section),
        images: Array.isArray(r.images) ? r.images.map(str).filter(Boolean) : [],
      };
    });
  return { labor: group("labor"), material: group("material"), equipment: group("equipment") };
}

function mapPayRow(value: unknown): ContractorPayRow {
  const row = asRecord(value);
  return {
    jobId: str(row.jobId),
    number: str(row.number),
    title: str(row.title),
    status: str(row.status),
    scheduledAt: row.scheduledAt ? str(row.scheduledAt) : null,
    payType: row.payType === "fixed" ? "fixed" : "hourly",
    payRate: Number(row.payRate) || 0,
    hours: Number(row.hours) || 0,
    labor: Number(row.labor) || 0,
    extras: Number(row.extras) || 0,
    earned: Number(row.earned) || 0,
    paid: Number(row.paid) || 0,
    balance: Number(row.balance) || 0,
    completion: row.completion ? str(row.completion) : null,
    approved: Boolean(row.approved),
    payable: Boolean(row.payable),
    payments: Number(row.payments) || 0,
    lastPaidAt: row.lastPaidAt ? str(row.lastPaidAt) : null,
  };
}

function mapPayTotals(value: unknown): ContractorPayTotals {
  const row = asRecord(value);
  return {
    earned: Number(row.earned) || 0,
    paid: Number(row.paid) || 0,
    balance: Number(row.balance) || 0,
    payable: Number(row.payable) || 0,
  };
}

function mapPaymentRecord(value: unknown): ContractorPaymentRecord {
  const row = asRecord(value);
  const job = row.job ? asRecord(row.job) : null;
  return {
    id: str(row.id),
    number: str(row.number),
    amount: Number(row.amount) || 0,
    method: str(row.method),
    paidAt: str(row.paidAt),
    reference: str(row.reference),
    notes: str(row.notes),
    jobId: str(row.jobId),
    job: job ? { id: str(job.id), number: str(job.number), title: str(job.title) } : null,
  };
}

function mapAssignment(value: unknown): ContractorAssignmentTerms {
  const row = asRecord(value);
  return {
    title: str(row.title),
    startAt: row.startAt ? str(row.startAt) : null,
    endAt: row.endAt ? str(row.endAt) : null,
    instructions: str(row.instructions),
    payType: row.payType === "fixed" ? "fixed" : "hourly",
    payRate: Number(row.payRate) || 0,
    estimatedHours: Number(row.estimatedHours) || 0,
  };
}

export function mapJobChangeOrders(value: unknown): ContractorJobChangeOrder[] {
  return (Array.isArray(value) ? value : []).map((entry) => {
    const co = asRecord(entry);
    const acceptance = str(co.acceptance);
    return {
      id: str(co.id || co._id),
      number: str(co.number),
      title: str(co.title),
      description: str(co.description),
      status: str(co.status),
      requestedByMe: Boolean(co.requestedByMe),
      acceptance: acceptance === "pending" || acceptance === "accepted" ? acceptance : "",
      acceptedAt: co.acceptedAt ? str(co.acceptedAt) : null,
      items: (Array.isArray(co.items) ? co.items : []).map((value) => {
        const item = asRecord(value);
        const kind = str(item.kind);
        return {
          id: str(item.id || item._id),
          description: str(item.description),
          kind: kind === "labor" || kind === "equipment" ? kind : "material",
          quantity: Number(item.quantity) || 0,
        };
      }),
    };
  });
}

function mapJob(value: unknown): ContractorJob {
  const row = asRecord(value);
  const site = asRecord(row.site);
  const coords = Array.isArray(site.coordinates) ? site.coordinates.map(Number) : [];
  const hasCoords = coords.length === 2 && coords.every(Number.isFinite) && !(coords[0] === 0 && coords[1] === 0);
  const customer = asRecord(row.customer);
  const completion = row.completion ? asRecord(row.completion) : null;
  return {
    id: str(row.id),
    number: str(row.number),
    title: str(row.title),
    status: str(row.status),
    scheduledAt: row.scheduledAt ? str(row.scheduledAt) : null,
    dueAt: row.dueAt ? str(row.dueAt) : null,
    notes: row.notes !== undefined ? str(row.notes) : undefined,
    site: { address: str(site.address), city: str(site.city), state: str(site.state), zip: str(site.zip) },
    customer: { name: str(customer.name), phone: str(customer.phone) },
    requirements: mapRequirements(row.requirements),
    completion: completion
      ? {
          id: str(completion.id),
          status: (str(completion.status) || "pending_pro_approval") as ContractorRequestStatus,
          reviewNote: str(completion.reviewNote),
          submittedAt: str(completion.submittedAt),
          reviewedAt: completion.reviewedAt ? str(completion.reviewedAt) : null,
        }
      : null,
    pendingChangeRequests: Number(row.pendingChangeRequests) || 0,
    assignment: mapAssignment(row.assignment),
    changeOrders: mapJobChangeOrders(row.changeOrders),
    coordinates: hasCoords ? [coords[0], coords[1]] : null,
  };
}

function paginated<T>(response: unknown, mapper: (row: unknown) => T, fallback: { page: number; limit: number }): Paginated<T> {
  const root = asRecord(response);
  const pagination = asRecord(root.pagination);
  const list = Array.isArray(root.data) ? root.data : [];
  const total = Number(pagination.total) || list.length;
  const limit = Number(pagination.limit) || fallback.limit;
  return {
    items: list.map(mapper),
    page: Number(pagination.page) || fallback.page,
    limit,
    total,
    totalPages: Math.max(1, Number(pagination.pages) || Math.ceil(total / limit) || 1),
  };
}

function mapBadges(value: unknown): ContractorBadges {
  const row = asRecord(value);
  return {
    jobs: Number(row.jobs) || 0,
    changeRequests: Number(row.changeRequests) || 0,
    payouts: Number(row.payouts) || 0,
  };
}

export function mapPendingReviewCounts(value: unknown): PendingReviewCounts {
  const row = asRecord(value);
  const completions = Number(row.completions) || 0;
  const changeOrders = Number(row.changeOrders) || 0;
  return { completions, changeOrders, total: Number(row.total) || completions + changeOrders };
}

const quiet = { silent: true, force: true } as const;

/* ───────────────────────────── Contractor portal API ───────────────────────────── */

export async function getContractorProfile(): Promise<ContractorProfile> {
  const row = asRecord(dataOf(await getData(contractorPortalApi.profile, undefined, quiet)));
  const provider = row.provider ? asRecord(row.provider) : null;
  return {
    id: str(row.id),
    number: str(row.number),
    firstName: str(row.firstName),
    lastName: str(row.lastName),
    companyName: str(row.companyName),
    displayName: str(row.displayName) || "Contractor",
    email: str(row.email),
    phone: str(row.phone),
    trade: str(row.trade),
    license: str(row.license),
    status: str(row.status),
    provider: provider
      ? { id: str(provider.id), name: str(provider.name), phone: str(provider.phone), email: str(provider.email) }
      : null,
  };
}

export async function getContractorDashboard(): Promise<ContractorDashboard> {
  const data = asRecord(dataOf(await getData(contractorPortalApi.dashboard, undefined, quiet)));
  const counts = asRecord(data.counts);
  return {
    counts: {
      totalAssigned: Number(counts.totalAssigned) || 0,
      inProgress: Number(counts.inProgress) || 0,
      activeJobs: Number(counts.activeJobs) || 0,
      completedJobs: Number(counts.completedJobs) || 0,
      awaitingApproval: Number(counts.awaitingApproval) || 0,
      reworkRequested: Number(counts.reworkRequested) || 0,
      openChangeRequests: Number(counts.openChangeRequests) || 0,
    },
    earnings: mapPayTotals(data.earnings),
    upcoming: (Array.isArray(data.upcoming) ? data.upcoming : []).map(mapJob),
    recentFeedback: (Array.isArray(data.recentFeedback) ? data.recentFeedback : []).map(mapRequest),
  };
}

/** `status` is one job status; omitted (or "all") lists every status. */
export type ContractorJobsQuery = { page?: number; limit?: number; search?: string; status?: string };

export async function listContractorJobs(query: ContractorJobsQuery): Promise<Paginated<ContractorJob>> {
  const page = query.page || 1;
  const limit = query.limit || 10;
  const response = await getData(
    contractorPortalApi.jobs,
    {
      page,
      limit,
      ...(query.status && query.status !== "all" ? { status: query.status } : {}),
      ...(query.search?.trim() ? { search: query.search.trim() } : {}),
    },
    quiet,
  );
  return paginated(response, mapJob, { page, limit });
}

export async function getContractorJob(id: string): Promise<ContractorJobDetail> {
  const data = asRecord(dataOf(await getData(contractorPortalApi.job(id), undefined, quiet)));
  return {
    job: mapJob(data.job),
    completions: (Array.isArray(data.completions) ? data.completions : []).map(mapRequest),
    changeRequests: (Array.isArray(data.changeRequests) ? data.changeRequests : []).map(mapRequest),
    pay: data.pay ? mapPayRow(data.pay) : null,
    payments: (Array.isArray(data.payments) ? data.payments : []).map(mapPaymentRecord),
    timeEntries: (Array.isArray(data.timeEntries) ? data.timeEntries : [])
      .map(mapTimeEntry)
      .filter((entry): entry is TimeEntry => Boolean(entry)),
    timeSummary: mapTimeSummary(data.timeSummary),
    activeEntry: mapTimeEntry(data.activeEntry),
  };
}

export async function submitContractorCompletion(jobId: string, input: { photos: string[]; notes?: string }) {
  return mapRequest(dataOf(await postData(contractorPortalApi.jobCompletion(jobId), input, { silent: true })));
}

export async function submitContractorChangeRequest(
  jobId: string,
  input: { description: string; reason?: string; estimatedCost: number },
) {
  return mapRequest(dataOf(await postData(contractorPortalApi.jobChangeRequests(jobId), input, { silent: true })));
}

export type ContractorRequestListQuery = {
  page?: number;
  limit?: number;
  search?: string;
  status?: ContractorRequestStatus | "all";
};

export async function listContractorChangeRequests(query: ContractorRequestListQuery): Promise<Paginated<ContractorRequest>> {
  const page = query.page || 1;
  const limit = query.limit || 10;
  const response = await getData(
    contractorPortalApi.changeRequests,
    {
      page,
      limit,
      ...(query.status && query.status !== "all" ? { status: query.status } : {}),
      ...(query.search?.trim() ? { search: query.search.trim() } : {}),
    },
    quiet,
  );
  return paginated(response, mapRequest, { page, limit });
}

export async function listContractorPayouts(query: { page?: number; limit?: number } = {}): Promise<ContractorPayouts> {
  const data = asRecord(
    dataOf(await getData(contractorPortalApi.payouts, { page: query.page || 1, limit: query.limit || 50 }, quiet)),
  );
  return {
    jobs: (Array.isArray(data.jobs) ? data.jobs : []).map(mapPayRow),
    totals: mapPayTotals(data.totals),
    payments: (Array.isArray(data.payments) ? data.payments : []).map(mapPaymentRecord),
  };
}

export async function contractorClockIn(jobId: string, notes = ""): Promise<TimeEntry | null> {
  return mapTimeEntry(dataOf(await postData(contractorPortalApi.jobClockIn(jobId), { notes }, { silent: true })));
}

export async function contractorClockOut(jobId: string, notes = ""): Promise<TimeEntry | null> {
  return mapTimeEntry(dataOf(await postData(contractorPortalApi.jobClockOut(jobId), { notes }, { silent: true })));
}

export async function listContractorSchedule(range: { startDate: string; endDate: string }): Promise<ContractorScheduleRow[]> {
  const data = dataOf(await getData(contractorPortalApi.schedule, range, quiet));
  return (Array.isArray(data) ? data : []).map((value) => {
    const row = asRecord(value);
    const site = asRecord(row.site);
    return {
      id: str(row.id),
      jobId: str(row.jobId),
      number: str(row.number),
      title: str(row.title),
      status: str(row.status),
      date: str(row.date),
      endDate: row.endDate ? str(row.endDate) : null,
      startMinutes: row.startMinutes === null || row.startMinutes === undefined ? null : Number(row.startMinutes),
      endMinutes: row.endMinutes === null || row.endMinutes === undefined ? null : Number(row.endMinutes),
      startAt: row.startAt ? str(row.startAt) : null,
      endAt: row.endAt ? str(row.endAt) : null,
      site: { address: str(site.address), city: str(site.city), state: str(site.state), zip: str(site.zip) },
      instructions: str(row.instructions),
    };
  });
}

export async function changeContractorPassword(input: { currentPassword: string; newPassword: string }) {
  await putData(contractorPortalApi.password, input, { silent: true });
}

/** Sidebar badge counts (new since each section was last opened). */
export async function getContractorBadges(): Promise<ContractorBadges> {
  return mapBadges(dataOf(await getData(contractorPortalApi.badges, undefined, quiet)));
}

/** Reset one section's sidebar badge on the server; bell notifications are untouched. */
export async function markContractorSectionRead(section: ContractorSection): Promise<ContractorBadges> {
  const data = asRecord(dataOf(await putData(contractorPortalApi.sectionRead, { section }, { silent: true })));
  return mapBadges(data.badges);
}

/* ───────────────────────────── Pro-side review API ───────────────────────────── */

export type PendingReviewQuery = {
  page?: number;
  limit?: number;
  status?: ContractorRequestStatus | "all";
  type?: ContractorRequestType;
  jobId?: string;
};

export async function listContractorReviewRequests(query: PendingReviewQuery): Promise<Paginated<ContractorRequest>> {
  const page = query.page || 1;
  const limit = query.limit || 20;
  const response = await getData(
    providerCrmApi.contractorRequests,
    {
      page,
      limit,
      status: query.status || "pending_pro_approval",
      ...(query.type ? { type: query.type } : {}),
      ...(query.jobId ? { jobId: query.jobId } : {}),
    },
    quiet,
  );
  return paginated(response, mapRequest, { page, limit });
}

export type ApproveRequestLine = {
  description: string;
  kind: "labor" | "material" | "equipment";
  quantity: number;
  unitPrice: number;
  unit?: string;
};

export async function approveContractorRequest(
  id: string,
  input: { note?: string; title?: string; amount?: number; items?: ApproveRequestLine[] } = {},
) {
  return mapRequest(dataOf(await postData(providerCrmApi.contractorRequestApprove(id), input, { silent: true })));
}

export async function rejectContractorRequest(id: string, reason: string) {
  return mapRequest(dataOf(await postData(providerCrmApi.contractorRequestReject(id), { reason }, { silent: true })));
}

/** Pro: enable / reset (password) or revoke (enabled=false) a contractor's portal sign-in. */
export async function setContractorPortalAccess(id: string, input: { enabled: boolean; password?: string }) {
  return dataOf(await putData(providerCrmApi.contractorPortalAccess(id), input, { silent: true }));
}

export async function getContractorReviewRequest(id: string): Promise<ContractorRequest> {
  return mapRequest(dataOf(await getData(providerCrmApi.contractorRequest(id), undefined, quiet)));
}

/* ───────────────────────────── Pro: job crew + contractor payouts ───────────────────────────── */

export type AssignJobContractorInput = {
  contractorId: string;
  title: string;
  instructions: string;
  startAt: string;
  endAt: string;
  payType?: "hourly" | "fixed";
  payRate?: number;
};

/** Assign (or update) one contractor on a job. Technicians are untouched. Returns the raw job. */
export async function assignJobContractor(jobId: string, input: AssignJobContractorInput): Promise<unknown> {
  return dataOf(await postData(providerCrmApi.jobContractors(jobId), input, { silent: true }));
}

export async function removeJobContractor(jobId: string, contractorId: string): Promise<unknown> {
  return dataOf(await deleteData(providerCrmApi.jobContractor(jobId, contractorId), { silent: true }));
}

export async function getContractorLedger(contractorId: string) {
  const data = asRecord(dataOf(await getData(providerCrmApi.contractorPaymentLedger, { contractorId }, quiet)));
  return {
    rows: (Array.isArray(data.rows) ? data.rows : []).map(mapPayRow),
    totals: mapPayTotals(data.totals),
  };
}

export async function getJobContractorPay(jobId: string): Promise<Array<ContractorPayRow & { contractorId: string }>> {
  const data = dataOf(await getData(providerCrmApi.contractorPaymentsForJob(jobId), undefined, quiet));
  return (Array.isArray(data) ? data : []).map((value) => ({
    ...mapPayRow(value),
    contractorId: str(asRecord(value).contractorId),
  }));
}

export async function listContractorPaymentHistory(contractorId: string): Promise<ContractorPaymentRecord[]> {
  const data = dataOf(await getData(providerCrmApi.contractorPayments, { contractorId, limit: 100 }, quiet));
  return (Array.isArray(data) ? data : []).map(mapPaymentRecord);
}

export type ContractorPayoutInput = {
  contractorId: string;
  jobId: string;
  amount: number;
  method: "card" | "ach" | "check" | "cash";
  paidAt?: string;
  reference?: string;
  notes?: string;
};

export async function recordContractorPayout(input: ContractorPayoutInput): Promise<ContractorPaymentRecord> {
  return mapPaymentRecord(dataOf(await postData(providerCrmApi.contractorPayments, input, { silent: true })));
}

/* ───────────────────────────── Pro: contractor timesheet ledger ───────────────────────────── */

/**
 * The contractor's earned / paid / remaining per job plus payout history, in
 * the shape the shared timesheet panel uses for technicians. `payable` is false
 * until the office approves the contractor's completed work.
 */
export async function getContractorTimesheetLedger(
  contractorId: string,
  contractorName: string,
  history: { paymentsPage?: number; paymentsLimit?: number } = {},
): Promise<TechnicianLedger> {
  const [ledger, payments] = await Promise.all([
    getContractorLedger(contractorId),
    listContractorPaymentHistory(contractorId),
  ]);
  const byJob: LedgerRow[] = ledger.rows.map((row) => ({
    employeeId: contractorId,
    employeeName: contractorName,
    payRate: row.payRate,
    jobId: row.jobId,
    estimateId: null,
    job: { id: row.jobId, number: row.number, title: row.title, status: row.status },
    estimate: null,
    seconds: Math.round(row.hours * 3600),
    sessions: 0,
    earned: row.earned,
    paid: row.paid,
    remaining: row.balance,
    payable: row.payable,
  }));
  const limit = history.paymentsLimit || 10;
  const total = payments.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const page = Math.min(Math.max(1, history.paymentsPage || 1), totalPages);
  const methods = new Set<TechnicianPaymentMethod>(["cash", "check", "card", "ach"]);
  return {
    summary: {
      totalSeconds: byJob.reduce((sum, row) => sum + row.seconds, 0),
      sessions: 0,
      earned: ledger.totals.earned,
      paid: ledger.totals.paid,
      remaining: ledger.totals.balance,
    },
    byJob,
    payments: payments.slice((page - 1) * limit, page * limit).map((payment) => ({
      id: payment.id,
      number: payment.number,
      employeeId: contractorId,
      employeeName: contractorName,
      job: payment.job ? { id: payment.job.id || payment.jobId, number: payment.job.number, title: payment.job.title } : null,
      estimate: null,
      amount: payment.amount,
      method: methods.has(payment.method as TechnicianPaymentMethod) ? (payment.method as TechnicianPaymentMethod) : "cash",
      paidAt: payment.paidAt,
      reference: payment.reference,
      notes: payment.notes,
    })),
    paymentsPagination: { page, limit, total, totalPages },
  };
}

/** Technician portal: ask the office for extra material / work on an assigned job. */
export async function submitTechnicianChangeRequest(
  jobId: string,
  input: { description: string; reason: string; estimatedCost: number },
): Promise<ContractorRequest> {
  return mapRequest(dataOf(await postData(technicianApi.jobChangeRequests(jobId), input, { silent: true })));
}

/** Map a raw request (e.g. embedded in the technician job response). */
export function mapChangeRequest(value: unknown): ContractorRequest {
  return mapRequest(value);
}

/** Contractor accepts the scope of a change order the office created from their request. */
export async function acceptContractorChangeOrder(jobId: string, orderId: string): Promise<void> {
  await postData(contractorPortalApi.jobChangeOrderAccept(jobId, orderId), {}, { silent: true });
}

/** Technician accepts the scope of a change order the office created from their request. */
export async function acceptTechnicianChangeOrder(jobId: string, orderId: string): Promise<void> {
  await postData(technicianApi.jobChangeOrderAccept(jobId, orderId), {}, { silent: true });
}
