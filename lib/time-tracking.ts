/**
 * Time tracking shared by the technician portal and the provider portal
 * (job detail, employee detail, team table, monthly reports).
 */

export type TimeEntryRef = {
  id: string;
  number?: string;
  title?: string;
  status?: string;
};

/** One step of a session's audit trail (written by the server, never edited). */
export type TimeEvent = {
  type: "clock_in" | "pause" | "resume" | "clock_out";
  at: string;
  /** "system": automatic clock-out after leaving the job site. */
  by: "worker" | "office" | "system";
  /** Why, when the system did it. */
  reason?: string;
  lat: number | null;
  lng: number | null;
  accuracyMeters: number | null;
  /** Clock in / resume: within the 200 m site radius, or the site has no mapped address. */
  geofence: "verified" | "no_site_location" | null;
  distanceMeters: number | null;
};

export type TimeEntry = {
  id: string;
  /** Employee id, or the Contractor id for contractor sessions. */
  employeeId: string;
  participantType?: "technician" | "contractor";
  employee?: { id: string; name: string } | null;
  job: TimeEntryRef | null;
  estimate: TimeEntryRef | null;
  status: "active" | "completed";
  clockInAt: string;
  clockOutAt: string | null;
  /** Saved duration (completed) or seconds elapsed when fetched (active). */
  seconds: number;
  payRate: number;
  /** Saved pay (completed) or pay so far when fetched (active). */
  pay: number;
  notes: string;
  /** Set while the session is paused (it still counts as clocked in). */
  pausedAt?: string | null;
  /** Seconds of finished pauses (not worked, not paid). */
  pausedSeconds?: number;
  /** Clock in / pause / resume / clock out trail. */
  events?: TimeEvent[];
};

export type TimeDayRow = {
  date: string;
  seconds: number;
  hours: number;
  pay: number;
  sessions: number;
  jobs: number;
  estimates: number;
};

export type TimeEmployeeRow = {
  employeeId: string;
  name: string;
  role?: string;
  hourlyRate: number;
  seconds: number;
  hours: number;
  pay: number;
  sessions: number;
  active: boolean;
};

export type TimeSummary = {
  totalSeconds: number;
  totalHours: number;
  totalPay: number;
  sessions: number;
  jobs: number;
  estimates: number;
  activeSessions: number;
  byEmployee: TimeEmployeeRow[];
  byDay: TimeDayRow[];
  generatedAt?: string;
};

export type TimeTotals = {
  totalSeconds: number;
  totalHours: number;
  totalPay: number;
  sessions: number;
  clockedIn: boolean;
};

export const EMPTY_TIME_SUMMARY: TimeSummary = {
  totalSeconds: 0,
  totalHours: 0,
  totalPay: 0,
  sessions: 0,
  jobs: 0,
  estimates: 0,
  activeSessions: 0,
  byEmployee: [],
  byDay: [],
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function refFrom(value: unknown): TimeEntryRef | null {
  if (!value) return null;
  if (typeof value === "string") return { id: value };
  const row = asRecord(value);
  const id = String(row.id || row._id || "");
  if (!id) return null;
  return {
    id,
    number: row.number ? String(row.number) : undefined,
    title: row.title ? String(row.title) : undefined,
    status: row.status ? String(row.status) : undefined,
  };
}

export function mapTimeEntry(raw: unknown): TimeEntry | null {
  const row = asRecord(raw);
  const id = String(row.id || row._id || "");
  if (!id) return null;
  // Contractor sessions keep the contractor in employeeId (unpopulated) and populate contractorId.
  const isContractor = row.participantType === "contractor";
  const employeeRaw = isContractor && row.contractorId && typeof row.contractorId === "object" ? row.contractorId : row.employeeId;
  const employeeRow = asRecord(employeeRaw);
  const employeeId =
    typeof employeeRaw === "string"
      ? employeeRaw
      : String(employeeRow.id || employeeRow._id || (typeof row.contractorId === "string" ? row.contractorId : "") || "");
  const person = `${employeeRow.firstName || ""} ${employeeRow.lastName || ""}`.trim();
  const status = row.status === "active" ? "active" : "completed";
  return {
    id,
    employeeId,
    participantType: isContractor ? "contractor" : "technician",
    employee:
      typeof employeeRaw === "object" && employeeRaw
        ? {
            id: employeeId,
            name: isContractor ? String(employeeRow.companyName || "") || person : person,
          }
        : null,
    job: refFrom(row.jobId),
    estimate: refFrom(row.estimateId),
    status,
    clockInAt: String(row.clockInAt || ""),
    clockOutAt: row.clockOutAt ? String(row.clockOutAt) : null,
    seconds: Number(status === "active" ? row.liveSeconds : row.durationSeconds ?? row.liveSeconds) || 0,
    payRate: Number(row.payRate) || 0,
    pay: Number(status === "active" ? row.livePay : row.pay ?? row.livePay) || 0,
    notes: String(row.notes || ""),
    pausedAt: row.pausedAt ? String(row.pausedAt) : null,
    pausedSeconds: Number(row.pausedSeconds) || 0,
    events: Array.isArray(row.events) ? row.events.map(mapTimeEvent).filter((event): event is TimeEvent => Boolean(event)) : [],
  };
}

const EVENT_TYPES = ["clock_in", "pause", "resume", "clock_out"] as const;

function mapTimeEvent(raw: unknown): TimeEvent | null {
  const row = asRecord(raw);
  const type = EVENT_TYPES.find((item) => item === row.type);
  if (!type || !row.at) return null;
  const num = (value: unknown) => (value === null || value === undefined || value === "" ? null : Number(value));
  return {
    type,
    at: String(row.at),
    by: row.by === "office" || row.by === "system" ? row.by : "worker",
    reason: row.reason ? String(row.reason) : undefined,
    lat: num(row.lat),
    lng: num(row.lng),
    accuracyMeters: num(row.accuracyMeters),
    geofence: row.geofence === "verified" || row.geofence === "no_site_location" ? row.geofence : null,
    distanceMeters: num(row.distanceMeters),
  };
}

const EVENT_LABELS: Record<TimeEvent["type"], string> = {
  clock_in: "In",
  pause: "Pause",
  resume: "Resume",
  clock_out: "Out",
};

export function timeEventLabel(type: TimeEvent["type"]) {
  return EVENT_LABELS[type];
}

/** "In 8:02 AM · Pause 10:15 AM · Resume 10:40 AM · Out 1:00 PM" (for exports and tooltips). */
export function entryTrailText(entry: Pick<TimeEntry, "events">) {
  return (entry.events ?? [])
    .map(
      (event) =>
        `${EVENT_LABELS[event.type]} ${formatClockTime(event.at)}${
          event.by === "office" ? " (office)" : event.by === "system" ? ` (automatic: ${event.reason || "left the site"})` : ""
        }`,
    )
    .join(" · ");
}

/** The site check made at clock-in (or the last resume): verified distance or unverified. */
export function entrySiteCheck(entry: Pick<TimeEntry, "events">) {
  return [...(entry.events ?? [])].reverse().find((event) => event.geofence) ?? null;
}

/** Answer to a position report while on the clock (portal location watch). */
export type LocationReport = {
  /** The session after the report (completed when the worker was clocked out). */
  entry: TimeEntry | null;
  autoClockedOut: boolean;
  /** Clearly outside the site radius on this report. */
  outside: boolean;
  distanceMeters: number | null;
};

export function mapLocationReport(raw: unknown): LocationReport {
  const row = asRecord(raw);
  const distance = row.distanceMeters;
  return {
    entry: mapTimeEntry(row.entry),
    autoClockedOut: row.autoClockedOut === true,
    outside: row.outside === true,
    distanceMeters: distance === null || distance === undefined ? null : Number(distance),
  };
}

export function mapTimeSummary(raw: unknown): TimeSummary {
  const row = asRecord(raw);
  return {
    totalSeconds: Number(row.totalSeconds) || 0,
    totalHours: Number(row.totalHours) || 0,
    totalPay: Number(row.totalPay) || 0,
    sessions: Number(row.sessions) || 0,
    jobs: Number(row.jobs) || 0,
    estimates: Number(row.estimates) || 0,
    activeSessions: Number(row.activeSessions) || 0,
    byEmployee: Array.isArray(row.byEmployee)
      ? row.byEmployee.map((item) => {
          const r = asRecord(item);
          return {
            employeeId: String(r.employeeId || ""),
            name: String(r.name || ""),
            role: r.role ? String(r.role) : undefined,
            hourlyRate: Number(r.hourlyRate) || 0,
            seconds: Number(r.seconds) || 0,
            hours: Number(r.hours) || 0,
            pay: Number(r.pay) || 0,
            sessions: Number(r.sessions) || 0,
            active: Boolean(r.active),
          };
        })
      : [],
    byDay: Array.isArray(row.byDay)
      ? row.byDay.map((item) => {
          const r = asRecord(item);
          return {
            date: String(r.date || ""),
            seconds: Number(r.seconds) || 0,
            hours: Number(r.hours) || 0,
            pay: Number(r.pay) || 0,
            sessions: Number(r.sessions) || 0,
            jobs: Number(r.jobs) || 0,
            estimates: Number(r.estimates) || 0,
          };
        })
      : [],
    generatedAt: row.generatedAt ? String(row.generatedAt) : undefined,
  };
}

export function mapTimeTotals(raw: unknown): TimeTotals | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const row = asRecord(raw);
  return {
    totalSeconds: Number(row.totalSeconds) || 0,
    totalHours: Number(row.totalHours) || 0,
    totalPay: Number(row.totalPay) || 0,
    sessions: Number(row.sessions) || 0,
    clockedIn: Boolean(row.clockedIn),
  };
}

/** Worked seconds for an entry right now (live for running timers; pauses don't count). */
export function liveSeconds(
  entry: Pick<TimeEntry, "status" | "clockInAt" | "seconds" | "pausedAt" | "pausedSeconds">,
  now = Date.now(),
) {
  if (entry.status !== "active") return entry.seconds;
  const start = new Date(entry.clockInAt).getTime();
  if (!Number.isFinite(start)) return entry.seconds;
  const pausedAt = entry.pausedAt ? new Date(entry.pausedAt).getTime() : NaN;
  const until = Number.isFinite(pausedAt) ? pausedAt : now;
  return Math.max(0, Math.floor((until - start) / 1000) - (entry.pausedSeconds || 0));
}

/** 01:02:03 style timer text. */
export function formatTimer(seconds: number) {
  const total = Math.max(0, Math.floor(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return [h, m, s].map((v) => String(v).padStart(2, "0")).join(":");
}

/** "3h 25m" style duration. */
export function formatDuration(seconds: number) {
  const total = Math.max(0, Math.round(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h}h`;
  if (m) return `${m}m`;
  return total > 0 ? "<1m" : "0m";
}

/** Exact "38h 30m 12s" — used where pay must visibly match tracked time. */
export function formatExactDuration(seconds: number) {
  const total = Math.max(0, Math.floor(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${h}h ${String(m).padStart(2, "0")}m ${String(s).padStart(2, "0")}s`;
}

/** Compact "38.5 hrs" for KPI tiles. */
export function formatHoursShort(seconds: number) {
  const hours = Math.max(0, seconds) / 3600;
  const text = hours >= 100 ? hours.toFixed(0) : hours.toFixed(hours % 1 === 0 ? 0 : 1);
  return `${text} hrs`;
}

export function formatHours(seconds: number) {
  return `${(Math.max(0, seconds) / 3600).toFixed(2)} hrs`;
}

export function formatClockTime(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

export function formatEntryDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
}

export function browserTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

export type TimeRangePreset = "today" | "week" | "lastWeek" | "month" | "last6Months" | "all" | "custom";

export type TimeRange = {
  preset: TimeRangePreset;
  /** yyyy-mm-dd (local) — used for custom ranges and month pickers */
  fromDate?: string;
  toDate?: string;
};

/** Local yyyy-mm-dd key for bucketing sessions into calendar days. */
export function dateKey(value: Date | string) {
  return localDateInput(typeof value === "string" ? new Date(value) : value);
}

/** Monday 00:00 (local) of the week containing `value`. */
export function startOfWeek(value: Date | string) {
  const date = typeof value === "string" ? new Date(value) : new Date(value);
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - ((date.getDay() + 6) % 7));
  return date;
}

function localDateInput(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function parseLocalDate(value: string) {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

/** Resolve a preset to local-day ISO bounds the API filters `clockInAt` by. */
export function resolveTimeRange(range: TimeRange): { from?: string; to?: string; label: string } {
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);

  switch (range.preset) {
    case "today":
      return { from: start.toISOString(), to: end.toISOString(), label: "Today" };
    case "week": {
      const weekStart = new Date(start);
      weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));
      return { from: weekStart.toISOString(), to: end.toISOString(), label: "This week" };
    }
    case "lastWeek": {
      const weekStart = startOfWeek(now);
      weekStart.setDate(weekStart.getDate() - 7);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      weekEnd.setHours(23, 59, 59, 999);
      return { from: weekStart.toISOString(), to: weekEnd.toISOString(), label: "Last week" };
    }
    case "month": {
      const base = range.fromDate ? parseLocalDate(range.fromDate) : now;
      const monthStart = new Date(base.getFullYear(), base.getMonth(), 1);
      const monthEnd = new Date(base.getFullYear(), base.getMonth() + 1, 0, 23, 59, 59, 999);
      return {
        from: monthStart.toISOString(),
        to: monthEnd.toISOString(),
        label: monthStart.toLocaleDateString("en-US", { month: "long", year: "numeric" }),
      };
    }
    case "last6Months": {
      // This month and the five before it.
      const from = new Date(now.getFullYear(), now.getMonth() - 5, 1);
      return {
        from: from.toISOString(),
        to: end.toISOString(),
        label: `${from.toLocaleDateString("en-US", { month: "short", year: "numeric" })} – ${end.toLocaleDateString("en-US", { month: "short", year: "numeric" })}`,
      };
    }
    case "custom": {
      const from = range.fromDate ? parseLocalDate(range.fromDate) : start;
      const to = range.toDate ? parseLocalDate(range.toDate) : new Date(from);
      to.setHours(23, 59, 59, 999);
      return {
        from: from.toISOString(),
        to: to.toISOString(),
        label: `${from.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${to.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`,
      };
    }
    default:
      return { label: "All time" };
  }
}

export function todayInputValue() {
  return localDateInput(new Date());
}
