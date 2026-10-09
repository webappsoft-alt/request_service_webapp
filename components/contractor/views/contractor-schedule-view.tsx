"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { siteLine } from "@/components/contractor/contractor-ui";
import { EventCalendar } from "@/components/portal/event-calendar";
import { PortalPage } from "@/components/portal/portal-page";
import { listContractorSchedule, type ContractorScheduleRow } from "@/lib/api/contractor-portal-client";
import type { PortalCalendarEvent } from "@/lib/data/portal";
import { contractorPaths } from "@/lib/contractor-paths";
import { useAppSelector } from "@/store/hooks";

/** yyyy-mm-dd from the stored schedule date (same rule the provider calendar uses). */
function dateOnly(value?: string | null) {
  if (!value) return undefined;
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(value);
  if (match) return match[1];
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString().slice(0, 10);
}

/** Minutes after midnight (local) for an exact time the office set. */
function minutesOf(value: string | null) {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.getHours() * 60 + date.getMinutes();
}

function toCalendarEvent(row: ContractorScheduleRow, contractorId: string): PortalCalendarEvent {
  // Exact contractor times win over the job's slot.
  const startMinutes = minutesOf(row.startAt) ?? row.startMinutes ?? undefined;
  const endMinutes = minutesOf(row.endAt) ?? row.endMinutes ?? undefined;
  return {
    id: row.id,
    kind: "job",
    recordId: row.jobId,
    title: row.title ? `${row.number} · ${row.title}` : row.number,
    detail: row.instructions || row.title || "",
    date: dateOnly(row.startAt) || dateOnly(row.date),
    endDate: dateOnly(row.endAt) || dateOnly(row.endDate),
    timeWindow: "custom",
    startMinutes,
    endMinutes,
    employeeId: contractorId,
    href: contractorPaths.job(row.jobId),
    status: row.status || "scheduled",
    serviceAddress: siteLine(row) || undefined,
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
 * Contractor schedule — the provider Schedule calendar (day / week / month,
 * same cards and styling) in read-only mode, limited to this contractor's jobs.
 */
export function ContractorScheduleView() {
  const version = useAppSelector((state) => state.contractorPortal.versions.schedule + state.contractorPortal.versions.jobs);
  const profile = useAppSelector((state) => state.contractorPortal.profile.data);
  const contractorId = profile?.id || "me";
  const contractorName = profile?.companyName || profile?.displayName || "Me";
  const [rows, setRows] = useState<ContractorScheduleRow[] | null>(null);
  const [error, setError] = useState("");

  // Latest data every time the tab opens, and whenever the office changes the schedule.
  useEffect(() => {
    let cancelled = false;
    listContractorSchedule(scheduleRange())
      .then((data) => {
        if (cancelled) return;
        setRows(data);
        setError("");
      })
      .catch((err) => {
        if (!cancelled) setError(err && typeof err === "object" && "message" in err ? String(err.message) : "Could not load your schedule.");
      });
    return () => {
      cancelled = true;
    };
  }, [version]);

  const events = useMemo(() => (rows ?? []).map((row) => toCalendarEvent(row, contractorId)), [rows, contractorId]);
  const employeeLabel = useCallback(() => contractorName, [contractorName]);

  return (
    <PortalPage
      eyebrow="Contractor / Schedule"
      title="Schedule"
      description="Day, week, and month views of the jobs assigned to you. Open a card for details and directions."
    >
      {error ? <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p> : null}
      <EventCalendar
        events={events}
        employeeLabel={employeeLabel}
        memberOptions={[{ id: contractorId, label: contractorName }]}
        lockEmployeeId={contractorId}
        initialEmployeeId={contractorId}
        loading={!rows && !error}
        readOnly
        onMove={() => undefined}
      />
    </PortalPage>
  );
}
