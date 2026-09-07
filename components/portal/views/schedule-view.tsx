"use client";

import { useState } from "react";
import { toast } from "sonner";
import { AssignEventDialog } from "@/components/portal/assign-event-dialog";
import { EventCalendar, type CalendarMove } from "@/components/portal/event-calendar";
import { PortalPage } from "@/components/portal/portal-page";
import { usePortalCrew } from "@/components/portal/use-portal-crew";
import { Button } from "@/components/ui/button";
import type { PortalCalendarEvent } from "@/lib/data/portal";
import { calendarEventKindLabel, formatClock, windowFromMinutes } from "@/lib/data/portal";
import { formatDate } from "@/lib/format";

export function ScheduleView() {
  const { events, employees, assign, employeeLabel } = usePortalCrew();
  const [editing, setEditing] = useState<PortalCalendarEvent | null>(null);
  const [scheduling, setScheduling] = useState(false);

  function moveEvent(event: PortalCalendarEvent, move: CalendarMove) {
    assign({
      kind: event.kind,
      recordId: event.recordId,
      date: move.date,
      endDate: move.endDate,
      startMinutes: move.startMinutes,
      endMinutes: move.endMinutes,
      timeWindow: windowFromMinutes(move.startMinutes, move.endMinutes) || event.timeWindow,
      employeeId: event.employeeId ?? employees.find((item) => item.active)?.id ?? "",
    });
    if (move.date) {
      const time =
        move.startMinutes != null && move.endMinutes != null
          ? ` ${formatClock(move.startMinutes)}–${formatClock(move.endMinutes)}`
          : "";
      toast.success(
        `${calendarEventKindLabel(event.kind)} ${event.title} moved to ${formatDate(move.date)}${move.endDate && move.endDate !== move.date ? `–${formatDate(move.endDate)}` : ""}${time}.`,
      );
    }
  }

  return (
    <PortalPage
      eyebrow="Work / Schedules"
      title="Schedule"
      description="Day, week, and month views. Drag a job to any time, or pull the edge to extend it."
      actions={
        <Button
          size="sm"
          onClick={() => {
            setEditing(null);
            setScheduling(true);
          }}
        >
          Assign work
        </Button>
      }
    >
      <EventCalendar
        events={events}
        employees={employees}
        employeeLabel={employeeLabel}
        onMove={moveEvent}
        onEventOpen={setEditing}
      />

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
        employees={employees}
        onSave={(assignment) => {
          assign(assignment);
          const employee = employees.find((item) => item.id === assignment.employeeId);
          toast.success(
            `${calendarEventKindLabel(assignment.kind)} assigned to ${employee ? `${employee.firstName} ${employee.lastName}` : "the crew"} on ${formatDate(assignment.date)}.`,
          );
        }}
      />
    </PortalPage>
  );
}
