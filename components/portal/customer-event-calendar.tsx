"use client";

import { toast } from "sonner";
import { EventCalendar, type CalendarMove } from "@/components/portal/event-calendar";
import { usePortalCrew } from "@/components/portal/use-portal-crew";
import type { PortalCalendarEvent } from "@/lib/data/portal";
import { calendarEventKindLabel, formatClock, windowFromMinutes } from "@/lib/data/portal";
import { formatDate } from "@/lib/format";

export function CustomerEventCalendar({
  events,
  employeeLabel,
}: {
  events: PortalCalendarEvent[];
  employeeLabel: (id?: string) => string;
}) {
  const { employees, assign } = usePortalCrew();

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

  return <EventCalendar events={events} employeeLabel={employeeLabel} onMove={moveEvent} />;
}
