"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { extractErrorMessage } from "@/components/api/extractErrorMessage";
import { AssignEventDialog } from "@/components/portal/assign-event-dialog";
import { EventCalendar, type CalendarMove } from "@/components/portal/event-calendar";
import { PortalPage } from "@/components/portal/portal-page";
import { useCrmApiData } from "@/components/portal/use-crm-api-data";
import { useCrmDirectory } from "@/components/portal/use-crm-directory";
import { usePortalCrew } from "@/components/portal/use-portal-crew";
import { Button } from "@/components/ui/button";
import { CenteredSpinner } from "@/components/ui/spinner";
import { querySchedule } from "@/lib/api/crm-client";
import type { PortalCalendarEvent, PortalEventKind } from "@/lib/data/portal";
import {
  calendarEventKindLabel,
  employeeName,
  formatClock,
  windowFromMinutes,
} from "@/lib/data/portal";
import { formatDate } from "@/lib/format";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { fetchTeam } from "@/store/teamSlice";

export type ScheduleMemberOption = {
  id: string;
  label: string;
  kind: "employee" | "contractor";
};

function formatScheduleError(error: unknown): string {
  const raw = extractErrorMessage(error);
  const match = raw.match(
    /already has appointment ['"]?([^'"]+)['"]? booked between minutes (\d+) and (\d+)/i,
  );
  if (match) {
    const [, label, startRaw, endRaw] = match;
    const fmt = (total: number) => {
      const hours24 = Math.floor(total / 60) % 24;
      const minutes = total % 60;
      const period = hours24 >= 12 ? "PM" : "AM";
      const hours12 = hours24 % 12 || 12;
      return `${hours12}:${String(minutes).padStart(2, "0")} ${period}`;
    };
    return `This person already has ${label} booked (${fmt(Number(startRaw))}–${fmt(Number(endRaw))}). Pick another time or assignee.`;
  }
  return raw || "Could not update the schedule.";
}

export function ScheduleView() {
  const searchParams = useSearchParams();
  const initialEmployeeId =
    searchParams.get("employeeId")?.trim() || searchParams.get("employee")?.trim() || "";
  const dispatch = useAppDispatch();
  const crm = useCrmApiData();
  const team = useAppSelector((state) => state.team.items);
  const teamLoading = useAppSelector((state) => state.team.loading);
  const { contractors } = useCrmDirectory();
  const { assign, employeeLabel, removeSchedule } = usePortalCrew();

  const [events, setEvents] = useState<PortalCalendarEvent[]>([]);
  const [scheduleLoading, setScheduleLoading] = useState(true);
  const [memberFilter, setMemberFilter] = useState(initialEmployeeId);
  const [kindFilter, setKindFilter] = useState<PortalEventKind | "">("");
  const [editing, setEditing] = useState<PortalCalendarEvent | null>(null);
  const [scheduling, setScheduling] = useState(false);

  const memberOptions = useMemo<ScheduleMemberOption[]>(() => {
    const employeeRows = (team.length ? team : []).filter((item) => item.active !== false).map(
      (item) => ({
        id: item.id,
        label: employeeName(item),
        kind: "employee" as const,
      }),
    );
    const contractorRows = contractors
      .filter((item) => item.status === "active")
      .map((item) => ({
        id: item.id,
        label: `${item.companyName} · Contractor`,
        kind: "contractor" as const,
      }));
    return [...employeeRows, ...contractorRows];
  }, [contractors, team]);

  const employeesForCalendar = useMemo(
    () =>
      memberOptions.map((item) => ({
        id: item.id,
        firstName: item.label,
        lastName: "",
        role: "technician" as const,
        trade: item.kind === "contractor" ? "Contractor" : "",
        email: "",
        phone: "",
        active: true,
      })),
    [memberOptions],
  );

  const resolveMemberLabel = useCallback(
    (id?: string) => {
      if (!id) return "Unassigned";
      const hit = memberOptions.find((item) => item.id === id);
      if (hit) return hit.label;
      return employeeLabel(id);
    },
    [employeeLabel, memberOptions],
  );

  useEffect(() => {
    void dispatch(fetchTeam({ force: true, limit: 100 }));
    if (crm.enabled) void crm.ensureLoaded();
  }, [crm, dispatch]);

  const loadSchedule = useCallback(async () => {
    setScheduleLoading(true);
    try {
      const selected = memberOptions.find((item) => item.id === memberFilter);
      const items = await querySchedule({
        employeeId:
          selected?.kind === "employee"
            ? memberFilter
            : memberFilter && !selected
              ? memberFilter
              : undefined,
        contractorId: selected?.kind === "contractor" ? memberFilter : undefined,
        kind: kindFilter || undefined,
        force: true,
        silent: true,
      });
      setEvents(items);
    } catch (error) {
      toast.error(formatScheduleError(error));
      setEvents([]);
    } finally {
      setScheduleLoading(false);
    }
  }, [kindFilter, memberFilter, memberOptions]);

  useEffect(() => {
    void loadSchedule();
  }, [loadSchedule]);

  useEffect(() => {
    if (initialEmployeeId) setMemberFilter(initialEmployeeId);
  }, [initialEmployeeId]);

  function moveEvent(event: PortalCalendarEvent, move: CalendarMove) {
    void Promise.resolve(
      assign({
        kind: event.kind,
        recordId: event.recordId,
        title: event.title,
        status: event.status,
        date: move.date,
        endDate: move.endDate,
        startMinutes: move.startMinutes,
        endMinutes: move.endMinutes,
        timeWindow: windowFromMinutes(move.startMinutes, move.endMinutes) || event.timeWindow,
        employeeId: event.employeeId ?? memberOptions[0]?.id ?? "",
      }),
    )
      .then(() => {
        void loadSchedule();
        if (move.date) {
          const time =
            move.startMinutes != null && move.endMinutes != null
              ? ` ${formatClock(move.startMinutes)}–${formatClock(move.endMinutes)}`
              : "";
          toast.success(
            `${calendarEventKindLabel(event.kind)} ${event.title} moved to ${formatDate(move.date)}${move.endDate && move.endDate !== move.date ? `–${formatDate(move.endDate)}` : ""}${time}.`,
          );
        }
      })
      .catch((error) => {
        void loadSchedule();
        toast.error(formatScheduleError(error));
      });
  }

  return (
    <PortalPage
      eyebrow="Work / Schedules"
      title="Schedule"
      description="Day, week, and month views. Drag a job to any time, or pull the edge to extend it."
      actions={
        <div className="flex flex-wrap gap-2">
          {editing ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                void Promise.resolve(removeSchedule(editing.id))
                  .then(() => {
                    toast.success(`${editing.title} removed from the schedule.`);
                    setEditing(null);
                    void loadSchedule();
                  })
                  .catch((error) => {
                    toast.error(formatScheduleError(error));
                  });
              }}
            >
              Remove from calendar
            </Button>
          ) : null}
          <Button
            size="sm"
            onClick={() => {
              setEditing(null);
              setScheduling(true);
            }}
          >
            Assign work
          </Button>
        </div>
      }
    >
      {scheduleLoading && events.length === 0 ? (
        <div className="border border-input bg-card" aria-busy="true">
          <CenteredSpinner
            className="min-h-[22rem]"
            label={teamLoading ? "Loading team…" : "Loading schedule…"}
          />
        </div>
      ) : (
        <EventCalendar
          events={events}
          employees={employeesForCalendar}
          memberOptions={memberOptions}
          employeeLabel={resolveMemberLabel}
          initialEmployeeId={initialEmployeeId}
          serverFiltered
          employeeFilter={memberFilter}
          onEmployeeFilterChange={setMemberFilter}
          kindFilter={kindFilter}
          onKindFilterChange={setKindFilter}
          onMove={moveEvent}
          onEventOpen={setEditing}
        />
      )}

      <AssignEventDialog
        open={Boolean(editing) || scheduling}
        onOpenChange={(open) => {
          if (!open) {
            setEditing(null);
            setScheduling(false);
          }
        }}
        event={editing}
        events={events}
        employees={team}
        defaultEmployeeId={memberFilter || undefined}
        onSave={async (assignment) => {
          await assign(assignment);
          await loadSchedule();
          const label = resolveMemberLabel(assignment.employeeId);
          toast.success(
            `${calendarEventKindLabel(assignment.kind)} assigned to ${label} on ${formatDate(assignment.date)}.`,
          );
        }}
      />
    </PortalPage>
  );
}
