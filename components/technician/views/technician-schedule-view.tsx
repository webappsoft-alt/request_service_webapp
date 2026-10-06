"use client";

import { useCallback, useEffect, useMemo } from "react";
import { EventCalendar } from "@/components/portal/event-calendar";
import { PortalPage } from "@/components/portal/portal-page";
import { addressLine, customerName } from "@/components/technician/tech-ui";
import { useTechSectionSeen } from "@/components/technician/use-tech-section-seen";
import type { TechScheduleRow } from "@/lib/api/technician-client";
import type { PortalCalendarEvent, PortalEventKind, PortalTimeWindow } from "@/lib/data/portal";
import { technicianPaths } from "@/lib/technician-paths";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { fetchTechSchedule } from "@/store/technicianSlice";

const KINDS = new Set<PortalEventKind>(["job", "fixed_service", "estimate", "request", "invoice", "payment", "task", "visit"]);
const WINDOWS = new Set<PortalTimeWindow>(["morning", "afternoon", "all_day", "custom"]);

/** yyyy-mm-dd from the stored schedule date (same rule the provider calendar uses). */
function dateOnly(value?: string | null) {
  if (!value) return undefined;
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(value);
  if (match) return match[1];
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString().slice(0, 10);
}

function toCalendarEvent(row: TechScheduleRow, employeeId: string): PortalCalendarEvent {
  const kind = KINDS.has(row.kind as PortalEventKind) ? (row.kind as PortalEventKind) : "job";
  const recordId = row.recordId || row.record?.id || "";
  const href =
    kind === "job" && recordId
      ? technicianPaths.job(recordId)
      : (kind === "estimate" || kind === "visit") && recordId
        ? technicianPaths.estimate(recordId)
        : technicianPaths.schedule;
  const number = row.record?.number;
  return {
    id: row.id,
    kind,
    recordId,
    title: number ? `${number} · ${row.title || row.record?.title || ""}`.replace(/ · $/, "") : row.title || row.record?.title || "Scheduled work",
    detail: row.record?.title || row.title || "",
    customerName: customerName(row.customer),
    date: dateOnly(row.date),
    endDate: dateOnly(row.endDate),
    timeWindow: WINDOWS.has(row.timeWindow as PortalTimeWindow) ? (row.timeWindow as PortalTimeWindow) : "custom",
    startMinutes: row.startMinutes,
    endMinutes: row.endMinutes,
    employeeId,
    href,
    status: row.status || "scheduled",
    serviceAddress: addressLine(row.record?.location) || undefined,
  };
}

/** Wide window so day / week / month navigation never needs another request. */
function scheduleRange() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - 90);
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  end.setDate(end.getDate() + 180);
  return { startDate: start.toISOString(), endDate: end.toISOString() };
}

/**
 * Technician schedule — the provider Schedule calendar (day / week / month,
 * same cards and styling) in read-only mode, limited to this technician's rows.
 */
export function TechnicianScheduleView() {
  const dispatch = useAppDispatch();
  const { items, loading, loaded, error } = useAppSelector((state) => state.technician.schedule);
  const version = useAppSelector((state) => state.technician.versions.schedule);
  // Every row is already this technician's (server-scoped); the id only keys the locked calendar.
  const employeeId = useAppSelector((state) => state.technician.profile.data?.employee?.id || "me");
  const technicianName = useAppSelector((state) => {
    const employee = state.technician.profile.data?.employee;
    return employee ? `${employee.firstName || ""} ${employee.lastName || ""}`.trim() : "";
  });

  useTechSectionSeen("schedule");

  // Latest data every time the tab opens, and whenever the office changes the schedule.
  useEffect(() => {
    void dispatch(fetchTechSchedule({ ...scheduleRange(), force: true }));
  }, [dispatch, version]);

  const events = useMemo(() => items.map((row) => toCalendarEvent(row, employeeId)), [items, employeeId]);
  const employeeLabel = useCallback(() => technicianName || "Me", [technicianName]);

  return (
    <PortalPage
      eyebrow="Technician / Schedule"
      title="My schedule"
      description="Day, week, and month views of the jobs and estimate visits assigned to you. Open a card for details and directions."
    >
      {error ? <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p> : null}
      <EventCalendar
        events={events}
        employeeLabel={employeeLabel}
        memberOptions={[{ id: employeeId, label: technicianName || "Me" }]}
        lockEmployeeId={employeeId}
        initialEmployeeId={employeeId}
        loading={loading && !loaded}
        readOnly
        onMove={() => undefined}
      />
    </PortalPage>
  );
}
