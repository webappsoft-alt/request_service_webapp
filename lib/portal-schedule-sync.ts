import {
  assignSchedule,
  deleteSchedule,
  querySchedule,
  updateSchedule,
  type CrmScheduleStatus,
} from "@/lib/api/crm-client";
import type { PortalTimeWindow } from "@/lib/data/portal";

const DEFAULT_START = 540; // 09:00
const DEFAULT_END = 570; // 09:30

function dateOnly(value?: string | null) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  return raw.slice(0, 10);
}

function normalizeScheduleStatus(value?: string): CrmScheduleStatus {
  switch (value) {
    case "scheduled":
    case "confirmed":
    case "in_progress":
    case "completed":
    case "cancelled":
      return value;
    default:
      return "scheduled";
  }
}

/**
 * Upsert a calendar row for a job or estimate so Schedule shows the date.
 * Silent on failure so create/update flows still succeed.
 */
export async function syncCalendarAssignment(input: {
  kind: "job" | "estimate";
  recordId: string;
  title: string;
  date?: string | null;
  endDate?: string | null;
  employeeId?: string | null;
  startMinutes?: number;
  endMinutes?: number;
  timeWindow?: PortalTimeWindow;
  status?: string;
  /** Estimate site-visit link: calendar only, no estimate status change. */
  linkOnly?: boolean;
}) {
  const date = dateOnly(input.date);
  if (!input.recordId || !date) return null;

  const startMinutes = input.startMinutes ?? DEFAULT_START;
  const endMinutes = input.endMinutes ?? DEFAULT_END;
  const timeWindow = input.timeWindow ?? "morning";
  const endDate = dateOnly(input.endDate) || date;
  const employeeId = String(input.employeeId || "").trim() || null;
  // Site-visit → calendar must never flip estimate status to "scheduled".
  const linkOnly =
    input.linkOnly === true || input.kind === "estimate";

  try {
    const existing = await querySchedule({
      kind: input.kind,
      force: true,
      silent: true,
    });
    const match = (existing || []).find(
      (item) =>
        item.kind === input.kind &&
        item.recordId === input.recordId &&
        item.id &&
        !String(item.id).startsWith("cal_"),
    );

    const payload = {
      title: input.title || (input.kind === "job" ? "Job" : "Site visit"),
      date,
      endDate,
      startMinutes,
      endMinutes,
      timeWindow,
      employeeId,
      contractorId: null as string | null,
      status: normalizeScheduleStatus(input.status),
      linkOnly,
    };

    if (match?.id) {
      // updateSchedule no longer changes estimate status (backend).
      return await updateSchedule(match.id, payload);
    }

    return await assignSchedule({
      recordId: input.recordId,
      kind: input.kind,
      ...payload,
    });
  } catch {
    return null;
  }
}

/** Remove calendar row(s) for a job/estimate and clear linkage. */
export async function clearCalendarAssignment(input: {
  kind: "job" | "estimate";
  recordId: string;
}) {
  if (!input.recordId) return;
  try {
    const existing = await querySchedule({
      kind: input.kind,
      force: true,
      silent: true,
    });
    const matches = (existing || []).filter(
      (item) =>
        item.kind === input.kind &&
        item.recordId === input.recordId &&
        item.id &&
        !String(item.id).startsWith("cal_"),
    );
    await Promise.all(
      matches.map((item) => deleteSchedule(item.id).catch(() => null)),
    );
  } catch {
    // ignore
  }
}

/**
 * Start Job is allowed when there is no future schedule start,
 * or the scheduled date/time has been reached.
 */
export function canStartJobNow(input: {
  scheduledAt?: string | null;
  startMinutes?: number | null;
  now?: Date;
}) {
  const scheduledDate = dateOnly(input.scheduledAt);
  if (!scheduledDate) return true;

  const now = input.now ?? new Date();
  const minutes =
    typeof input.startMinutes === "number" && Number.isFinite(input.startMinutes)
      ? input.startMinutes
      : DEFAULT_START;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  const startAt = new Date(
    `${scheduledDate}T${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}:00`,
  );
  if (Number.isNaN(startAt.getTime())) return true;
  return now.getTime() >= startAt.getTime();
}
