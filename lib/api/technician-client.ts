import { technicianApi, providerCrmApi } from "@/components/api/ApiRoutesFile";
import { getData, postData, putData } from "@/components/api/sliceHttp";
import {
  browserTimeZone,
  mapTimeEntry,
  mapTimeSummary,
  type TimeEntry,
  type TimeSummary,
} from "@/lib/time-tracking";

/* ───────────────────────────── Types ───────────────────────────── */

export type TechCustomer = {
  id: string;
  firstName?: string;
  lastName?: string;
  companyName?: string;
  phone?: string;
  altPhone?: string;
  email?: string;
  addresses?: Array<Record<string, unknown>>;
};

export type TechLocation = {
  address?: string;
  street?: string;
  city?: string;
  state?: string;
  zip?: string;
  coordinates?: number[];
  lat?: number;
  lng?: number;
  latitude?: number;
  longitude?: number;
};

export type TechJobRow = {
  id: string;
  number: string;
  title: string;
  status: string;
  scheduledAt: string | null;
  dueAt: string | null;
  location: TechLocation | null;
  customer: TechCustomer | null;
  customerSnapshot?: Record<string, unknown>;
  estimateId: string | null;
  clockedIn?: boolean;
  createdAt?: string;
};

export type TechLineItem = {
  id?: string;
  description: string;
  kind: string;
  quantity: number;
  unitPrice: number;
  total: number;
  section?: string;
  images?: string[];
};

export type TechScheduleRow = {
  id: string;
  kind: string;
  recordId: string | null;
  title: string;
  date: string;
  endDate: string | null;
  startMinutes: number;
  endMinutes: number;
  timeWindow: string;
  status: string;
  customer: TechCustomer | null;
  record: { id: string; number?: string; title?: string; status?: string; location?: TechLocation | null } | null;
};

export type TechJobDetail = {
  job: Record<string, unknown> & {
    id: string;
    number: string;
    title: string;
    status: string;
    notes?: string;
    location?: TechLocation;
    scheduledAt?: string | null;
    dueAt?: string | null;
    items: TechLineItem[];
    customerId?: TechCustomer | null;
    estimateId?: Record<string, unknown> | null;
    assignedEmployees?: Array<Record<string, unknown>>;
    assignedContractors?: Array<Record<string, unknown>>;
    changeOrders?: Array<Record<string, unknown>>;
    activities?: Array<Record<string, unknown>>;
    attachments?: string[];
    customerSnapshot?: Record<string, unknown>;
  };
  schedule: TechScheduleRow[];
  timeEntries: TimeEntry[];
  timeSummary: TimeSummary;
  activeEntry: TimeEntry | null;
};

export type TechEstimateRow = {
  id: string;
  number: string;
  title: string;
  status: string;
  scheduledDate: string | null;
  propertyAddress: TechLocation | null;
  total: number;
  jobId: string | null;
  customer: TechCustomer | null;
  customerSnapshot?: Record<string, unknown>;
  siteVisit?: Record<string, unknown>;
};

export type TechEstimateDetail = {
  estimate: Record<string, unknown> & {
    id: string;
    number: string;
    title: string;
    status: string;
    items: TechLineItem[];
    subtotal?: number;
    tax?: number;
    discount?: number;
    total?: number;
    notes?: string;
    terms?: string;
    propertyAddress?: TechLocation;
    siteVisit?: Record<string, unknown>;
    siteVisits?: Array<Record<string, unknown>>;
    scheduledDate?: string | null;
    customer?: TechCustomer | null;
    customerSnapshot?: Record<string, unknown>;
  };
  job: { id: string; number?: string; title?: string; status?: string } | null;
  schedule: TechScheduleRow[];
  timeEntries: TimeEntry[];
  timeSummary: TimeSummary;
  activeEntry: TimeEntry | null;
};

export type TechPeriod = {
  totalSeconds: number;
  totalHours: number;
  totalPay: number;
  sessions: number;
  jobs: number;
  estimates: number;
};

export type TechDashboard = {
  counts: {
    openJobs: number;
    completedJobs: number;
    estimates: number;
    todayVisits: number;
    unreadNotifications: number;
  };
  payRate: number;
  activeEntry: TimeEntry | null;
  time: { today: TechPeriod; week: TechPeriod; month: TechPeriod };
  todaySchedule: TechScheduleRow[];
  todayJobs: TechJobRow[];
  upcomingJobs: TechJobRow[];
};

export type TechProfile = {
  user: Record<string, unknown> & {
    id?: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    username?: string;
    phone?: string;
    avatarUrl?: string;
  };
  employee: Record<string, unknown> & {
    id: string;
    firstName: string;
    lastName: string;
    role: string;
    trade?: string;
    phone?: string;
    email?: string;
    hourlyRate?: number;
    hireDate?: string;
    emergencyName?: string;
    emergencyPhone?: string;
    username?: string;
  };
  provider: { id: string; name: string; phone?: string; email?: string } | null;
};

export type Paginated<T> = {
  items: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

/* ───────────────────────────── Mappers ───────────────────────────── */

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function idOf(value: unknown): string {
  if (!value) return "";
  if (typeof value === "string") return value;
  const row = asRecord(value);
  return String(row.id || row._id || "");
}

function mapCustomer(value: unknown): TechCustomer | null {
  const row = asRecord(value);
  const id = idOf(value);
  if (!id) return null;
  return { ...(row as TechCustomer), id };
}

function mapItems(value: unknown): TechLineItem[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    const row = asRecord(item);
    return {
      id: idOf(row),
      description: String(row.description || ""),
      kind: String(row.kind || "labor"),
      quantity: Number(row.quantity) || 0,
      unitPrice: Number(row.unitPrice) || 0,
      total: Number(row.total) || 0,
      section: row.section ? String(row.section) : undefined,
      images: Array.isArray(row.images) ? row.images.map(String) : [],
    };
  });
}

function mapSchedule(value: unknown): TechScheduleRow {
  const row = asRecord(value);
  const record = asRecord(row.record);
  return {
    id: idOf(row),
    kind: String(row.kind || "job"),
    recordId: row.recordId ? idOf(row.recordId) : null,
    title: String(row.title || ""),
    date: String(row.date || ""),
    endDate: row.endDate ? String(row.endDate) : null,
    startMinutes: Number(row.startMinutes) || 0,
    endMinutes: Number(row.endMinutes) || 0,
    timeWindow: String(row.timeWindow || "custom"),
    status: String(row.status || "scheduled"),
    customer: mapCustomer(row.customerId),
    record: record.id
      ? {
          id: String(record.id),
          number: record.number ? String(record.number) : undefined,
          title: record.title ? String(record.title) : undefined,
          status: record.status ? String(record.status) : undefined,
          location: (record.location as TechLocation) || null,
        }
      : null,
  };
}

function mapJobRow(value: unknown): TechJobRow {
  const row = asRecord(value);
  return {
    id: idOf(row),
    number: String(row.number || ""),
    title: String(row.title || ""),
    status: String(row.status || ""),
    scheduledAt: row.scheduledAt ? String(row.scheduledAt) : null,
    dueAt: row.dueAt ? String(row.dueAt) : null,
    location: (row.location as TechLocation) || null,
    customer: mapCustomer(row.customer),
    customerSnapshot: asRecord(row.customerSnapshot),
    estimateId: row.estimateId ? String(row.estimateId) : null,
    clockedIn: Boolean(row.clockedIn),
    createdAt: row.createdAt ? String(row.createdAt) : undefined,
  };
}

function mapEstimateRow(value: unknown): TechEstimateRow {
  const row = asRecord(value);
  return {
    id: idOf(row),
    number: String(row.number || ""),
    title: String(row.title || ""),
    status: String(row.status || ""),
    scheduledDate: row.scheduledDate ? String(row.scheduledDate) : null,
    propertyAddress: (row.propertyAddress as TechLocation) || null,
    total: Number(row.total) || 0,
    jobId: row.jobId ? String(row.jobId) : null,
    customer: mapCustomer(row.customer),
    customerSnapshot: asRecord(row.customerSnapshot),
    siteVisit: asRecord(row.siteVisit),
  };
}

function mapPeriod(value: unknown): TechPeriod {
  const row = asRecord(value);
  return {
    totalSeconds: Number(row.totalSeconds) || 0,
    totalHours: Number(row.totalHours) || 0,
    totalPay: Number(row.totalPay) || 0,
    sessions: Number(row.sessions) || 0,
    jobs: Number(row.jobs) || 0,
    estimates: Number(row.estimates) || 0,
  };
}

function mapEntries(value: unknown): TimeEntry[] {
  return (Array.isArray(value) ? value : [])
    .map(mapTimeEntry)
    .filter((entry): entry is TimeEntry => Boolean(entry));
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

function dataOf(response: unknown) {
  const root = asRecord(response);
  return root.data !== undefined ? root.data : response;
}

/* ───────────────────────────── Technician API ───────────────────────────── */

const quiet = { silent: true, force: true } as const;

export async function getTechnicianDashboard(): Promise<TechDashboard> {
  const data = asRecord(dataOf(await getData(technicianApi.dashboard, { tz: browserTimeZone() }, quiet)));
  const counts = asRecord(data.counts);
  const time = asRecord(data.time);
  return {
    counts: {
      openJobs: Number(counts.openJobs) || 0,
      completedJobs: Number(counts.completedJobs) || 0,
      estimates: Number(counts.estimates) || 0,
      todayVisits: Number(counts.todayVisits) || 0,
      unreadNotifications: Number(counts.unreadNotifications) || 0,
    },
    payRate: Number(data.payRate) || 0,
    activeEntry: mapTimeEntry(data.activeEntry),
    time: { today: mapPeriod(time.today), week: mapPeriod(time.week), month: mapPeriod(time.month) },
    todaySchedule: (Array.isArray(data.todaySchedule) ? data.todaySchedule : []).map(mapSchedule),
    todayJobs: (Array.isArray(data.todayJobs) ? data.todayJobs : []).map(mapJobRow),
    upcomingJobs: (Array.isArray(data.upcomingJobs) ? data.upcomingJobs : []).map(mapJobRow),
  };
}

export type TechListQuery = {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  scope?: "all" | "open" | "done";
};

export async function listTechnicianJobs(query: TechListQuery): Promise<Paginated<TechJobRow>> {
  const page = query.page ?? 1;
  const limit = query.limit ?? 20;
  const response = await getData(
    technicianApi.jobs,
    {
      page,
      limit,
      search: query.search?.trim() || undefined,
      status: query.status || undefined,
      scope: query.scope || "all",
    },
    quiet,
  );
  return paginated(response, mapJobRow, { page, limit });
}

export async function getTechnicianJob(id: string): Promise<TechJobDetail> {
  const data = asRecord(dataOf(await getData(technicianApi.job(id), { tz: browserTimeZone() }, quiet)));
  const job = asRecord(data.job);
  return {
    job: {
      ...job,
      id: idOf(job),
      number: String(job.number || ""),
      title: String(job.title || ""),
      status: String(job.status || ""),
      items: mapItems(job.items),
      customerId: mapCustomer(job.customerId),
    } as TechJobDetail["job"],
    schedule: (Array.isArray(data.schedule) ? data.schedule : []).map(mapSchedule),
    timeEntries: mapEntries(data.timeEntries),
    timeSummary: mapTimeSummary(data.timeSummary),
    activeEntry: mapTimeEntry(data.activeEntry),
  };
}

export async function listTechnicianEstimates(query: TechListQuery): Promise<Paginated<TechEstimateRow>> {
  const page = query.page ?? 1;
  const limit = query.limit ?? 20;
  const response = await getData(
    technicianApi.estimates,
    { page, limit, search: query.search?.trim() || undefined, status: query.status || undefined },
    quiet,
  );
  return paginated(response, mapEstimateRow, { page, limit });
}

export async function getTechnicianEstimate(id: string): Promise<TechEstimateDetail> {
  const data = asRecord(dataOf(await getData(technicianApi.estimate(id), { tz: browserTimeZone() }, quiet)));
  const estimate = asRecord(data.estimate);
  const job = asRecord(data.job);
  return {
    estimate: {
      ...estimate,
      id: idOf(estimate),
      number: String(estimate.number || ""),
      title: String(estimate.title || ""),
      status: String(estimate.status || ""),
      items: mapItems(estimate.items),
      customer: mapCustomer(estimate.customer),
    } as TechEstimateDetail["estimate"],
    job: job.id ? { id: String(job.id), number: String(job.number || ""), title: String(job.title || ""), status: String(job.status || "") } : null,
    schedule: (Array.isArray(data.schedule) ? data.schedule : []).map(mapSchedule),
    timeEntries: mapEntries(data.timeEntries),
    timeSummary: mapTimeSummary(data.timeSummary),
    activeEntry: mapTimeEntry(data.activeEntry),
  };
}

export async function listTechnicianSchedule(range: { startDate?: string; endDate?: string }): Promise<TechScheduleRow[]> {
  const response = await getData(technicianApi.schedule, range, quiet);
  const data = dataOf(response);
  return (Array.isArray(data) ? data : []).map(mapSchedule);
}

export type TimeEntriesPage = {
  items: TimeEntry[];
  summary: TimeSummary;
  overall?: TimeSummary;
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

function mapEntriesPage(response: unknown, page: number, limit: number): TimeEntriesPage {
  const root = asRecord(response);
  const base = paginated(response, (row) => mapTimeEntry(row), { page, limit });
  return {
    ...base,
    items: base.items.filter((entry): entry is TimeEntry => Boolean(entry)),
    summary: mapTimeSummary(root.summary),
    overall: root.overall ? mapTimeSummary(root.overall) : undefined,
  };
}

export type TimeEntriesQuery = {
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
};

export async function listTechnicianTimeEntries(query: TimeEntriesQuery): Promise<TimeEntriesPage> {
  const page = query.page ?? 1;
  const limit = query.limit ?? 20;
  const response = await getData(
    technicianApi.timeEntries,
    { page, limit, from: query.from, to: query.to, tz: browserTimeZone() },
    quiet,
  );
  return mapEntriesPage(response, page, limit);
}

export async function getTechnicianActiveEntry(): Promise<TimeEntry | null> {
  return mapTimeEntry(dataOf(await getData(technicianApi.activeEntry, undefined, quiet)));
}

export type ClockTarget = { kind: "job" | "estimate"; id: string };

export async function clockIn(target: ClockTarget, notes?: string): Promise<TimeEntry | null> {
  const endpoint =
    target.kind === "job" ? technicianApi.jobClockIn(target.id) : technicianApi.estimateClockIn(target.id);
  return mapTimeEntry(dataOf(await postData(endpoint, notes ? { notes } : {}, { silent: true })));
}

export async function clockOut(target: ClockTarget | null, notes?: string): Promise<TimeEntry | null> {
  const endpoint = !target
    ? technicianApi.clockOutActive
    : target.kind === "job"
      ? technicianApi.jobClockOut(target.id)
      : technicianApi.estimateClockOut(target.id);
  return mapTimeEntry(dataOf(await postData(endpoint, notes ? { notes } : {}, { silent: true })));
}

export async function getTechnicianProfile(): Promise<TechProfile> {
  return dataOf(await getData(technicianApi.profile, undefined, quiet)) as TechProfile;
}

export async function updateTechnicianProfile(patch: Partial<{
  firstName: string;
  lastName: string;
  phone: string;
  emergencyName: string;
  emergencyPhone: string;
  avatarUrl: string;
}>): Promise<TechProfile> {
  return dataOf(await putData(technicianApi.profile, patch, { silent: true })) as TechProfile;
}

export async function changeTechnicianPassword(body: { currentPassword: string; newPassword: string }) {
  return putData(technicianApi.password, body, { silent: true });
}

/* ───────────────────────────── Provider time API ───────────────────────────── */

export type ProviderTimeQuery = TimeEntriesQuery & {
  employeeId?: string;
  jobId?: string;
  estimateId?: string;
  includeOverall?: boolean;
};

export async function listProviderTimeEntries(query: ProviderTimeQuery): Promise<TimeEntriesPage> {
  const page = query.page ?? 1;
  const limit = query.limit ?? 20;
  const response = await getData(
    providerCrmApi.timeEntries,
    {
      employeeId: query.employeeId,
      jobId: query.jobId,
      estimateId: query.estimateId,
      from: query.from,
      to: query.to,
      page,
      limit,
      tz: browserTimeZone(),
      includeOverall: query.includeOverall || undefined,
    },
    quiet,
  );
  return mapEntriesPage(response, page, limit);
}

export async function providerStopTimeEntry(id: string): Promise<TimeEntry | null> {
  return mapTimeEntry(dataOf(await postData(providerCrmApi.timeEntryClockOut(id), {}, { silent: true })));
}
