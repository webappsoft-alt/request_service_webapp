"use client";

import { useEffect, useMemo, useRef, useState, type DragEvent, type ReactNode } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { PortalCalendarEvent, PortalEmployee, PortalEventKind, PortalTimeWindow } from "@/lib/data/portal";
import {
  calendarEventKindLabel,
  calendarEventStatusLabel,
  calendarEventTone,
  formatClock,
  minutesForWindow,
  timeWindowLabel,
} from "@/lib/data/portal";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const KINDS: PortalEventKind[] = ["job", "estimate", "request", "invoice", "task"];
const VIEWS = ["day", "week", "month"] as const;
const DAY_START = 6 * 60;   // 6:00 AM
const DAY_END = 24 * 60;    // midnight (00:00 next day)
const SLOT = 30;
const SLOT_PX = 44;
const SLOTS = Array.from({ length: (DAY_END - DAY_START) / SLOT }, (_, index) => DAY_START + index * SLOT);

export type CalendarView = (typeof VIEWS)[number];

export type CalendarMove = {
  date: string;
  endDate?: string;
  startMinutes?: number;
  endMinutes?: number;
};

export function toIso(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function parseIso(value: string) {
  const dayKey = value.slice(0, 10);
  const [year, month, day] = dayKey.split("-").map(Number);
  if (!year || !month || !day) return new Date(NaN);
  return new Date(year, month - 1, day);
}

function addIsoDays(value: string, days: number) {
  const date = parseIso(value);
  date.setDate(date.getDate() + days);
  return toIso(date);
}

function diffDays(start: string, end: string) {
  return Math.round((parseIso(end).getTime() - parseIso(start).getTime()) / 86400000);
}

export function eventEndDate(event: PortalCalendarEvent) {
  if (event.endDate && event.date && event.endDate > event.date) return event.endDate;
  return event.date;
}

export function eventCovers(event: PortalCalendarEvent, iso: string) {
  if (!event.date) return false;
  const end = eventEndDate(event) ?? event.date;
  return iso >= event.date && iso <= end;
}

function monthLabel(year: number, month: number) {
  return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(new Date(year, month, 1));
}

function dayHeading(iso: string) {
  const date = parseIso(iso);
  if (Number.isNaN(date.getTime())) return iso || "Schedule";
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function weekHeading(iso: string) {
  const start = weekStart(iso);
  return `${formatDate(start)} – ${formatDate(addIsoDays(start, 6))}`;
}

function weekStart(iso: string) {
  const date = parseIso(iso);
  date.setDate(date.getDate() - date.getDay());
  return toIso(date);
}

function windowShort(window: PortalTimeWindow) {
  switch (window) {
    case "morning":
      return "AM";
    case "afternoon":
      return "PM";
    case "all_day":
      return "Day";
    default: {
      const _never: never = window;
      return _never;
    }
  }
}

function eventService(event: PortalCalendarEvent) {
  return event.detail.split(" · ")[0] ?? event.detail;
}

export function eventTimes(event: PortalCalendarEvent) {
  if (event.startMinutes != null && event.endMinutes != null && event.endMinutes > event.startMinutes) {
    return { start: event.startMinutes, end: event.endMinutes };
  }
  const fallback = minutesForWindow(event.timeWindow);
  return { start: fallback.startMinutes, end: fallback.endMinutes };
}

function isAllDay(event: PortalCalendarEvent) {
  const times = eventTimes(event);
  return event.timeWindow === "all_day" || times.end - times.start >= 6 * 60;
}

function snapMinutes(value: number, min = DAY_START, max = DAY_END) {
  const snapped = Math.round(value / SLOT) * SLOT;
  return Math.min(max, Math.max(min, snapped));
}

type DragPayload = {
  id: string;
  mode: "move" | "resize";
  span: number;
  duration: number;
  dayOffset?: number;
};

export function EventCalendar({
  events: propEvents,
  employeeLabel,
  employees,
  memberOptions,
  onMove,
  onEventOpen,
  toolbar,
  initialEmployeeId = "",
  lockEmployeeId = "",
  serverFiltered = false,
  employeeFilter: controlledEmployeeFilter,
  onEmployeeFilterChange,
  kindFilter: controlledKindFilter,
  onKindFilterChange,
}: {
  events: PortalCalendarEvent[];
  employeeLabel: (id?: string) => string;
  employees?: PortalEmployee[];
  /** Prefer this for Everyone dropdown (employees + contractors from API). */
  memberOptions?: Array<{ id: string; label: string }>;
  onMove: (event: PortalCalendarEvent, move: CalendarMove) => void;
  onEventOpen?: (event: PortalCalendarEvent) => void;
  toolbar?: ReactNode;
  initialEmployeeId?: string;
  /** When set, calendar stays scoped to this employee (hides Everyone filter). */
  lockEmployeeId?: string;
  /** Parent already filtered via API — skip client member/kind filtering. */
  serverFiltered?: boolean;
  employeeFilter?: string;
  onEmployeeFilterChange?: (employeeId: string) => void;
  kindFilter?: PortalEventKind | "";
  onKindFilterChange?: (kind: PortalEventKind | "") => void;
}) {
  const [localEvents, setLocalEvents] = useState<PortalCalendarEvent[]>(propEvents);

  useEffect(() => {
    setLocalEvents(propEvents);
  }, [propEvents]);

  const today = toIso(new Date());
  const firstDated =
    localEvents.find((item) => item.date && item.kind === "job")?.date ??
    localEvents.find((item) => item.date && item.kind === "estimate")?.date ??
    localEvents.find((item) => item.date)?.date ??
    today;
  const start = parseIso(firstDated);
  const [view, setView] = useState<CalendarView>("day");
  const [cursor, setCursor] = useState({ year: start.getFullYear(), month: start.getMonth() });
  const [kindFilterInternal, setKindFilterInternal] = useState<PortalEventKind | "">("");
  const [employeeFilterInternal, setEmployeeFilterInternal] = useState(
    lockEmployeeId || initialEmployeeId,
  );
  const [selectedDay, setSelectedDay] = useState(firstDated);
  const [overDay, setOverDay] = useState<string | null>(null);

  const kindFilter = controlledKindFilter !== undefined ? controlledKindFilter : kindFilterInternal;
  const setKindFilter = (value: PortalEventKind | "") => {
    if (onKindFilterChange) onKindFilterChange(value);
    else setKindFilterInternal(value);
  };
  const employeeFilter =
    controlledEmployeeFilter !== undefined ? controlledEmployeeFilter : employeeFilterInternal;
  const setEmployeeFilter = (value: string) => {
    if (onEmployeeFilterChange) onEmployeeFilterChange(value);
    else setEmployeeFilterInternal(value);
  };

  useEffect(() => {
    const next = lockEmployeeId || initialEmployeeId;
    if (next) setEmployeeFilter(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only sync from URL/lock props
  }, [initialEmployeeId, lockEmployeeId]);

  const everyoneOptions = useMemo(() => {
    if (memberOptions?.length) return memberOptions;
    return (employees ?? [])
      .filter((item) => item.active !== false)
      .map((item) => ({
        id: item.id,
        label: `${item.firstName} ${item.lastName}`.trim() || item.id,
      }));
  }, [employees, memberOptions]);

  const visible = useMemo(() => {
    if (serverFiltered) return localEvents;
    const locked = lockEmployeeId.trim();
    const employeeId = locked || employeeFilter.trim();
    const kind = kindFilter;
    return localEvents.filter((item) => {
      if (kind && item.kind !== kind) return false;
      if (employeeId) {
        const eventEmployeeId = String(item.employeeId || "").trim();
        if (eventEmployeeId !== employeeId) return false;
      }
      return true;
    });
  }, [employeeFilter, localEvents, kindFilter, lockEmployeeId, serverFiltered]);

  const cells = useMemo(() => {
    const first = new Date(cursor.year, cursor.month, 1);
    const gridStart = new Date(first);
    gridStart.setDate(1 - first.getDay());
    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(gridStart);
      date.setDate(gridStart.getDate() + index);
      const iso = toIso(date);
      return {
        iso,
        day: date.getDate(),
        inMonth: date.getMonth() === cursor.month,
        events: visible.filter((item) => eventCovers(item, iso)),
      };
    });
  }, [cursor.month, cursor.year, visible]);

  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, index) => addIsoDays(weekStart(selectedDay), index)),
    [selectedDay],
  );

  const dayEvents = visible.filter((item) => eventCovers(item, selectedDay));
  const unscheduled = visible.filter((item) => !item.date);

  function readPayload(event: DragEvent) {
    try {
      return JSON.parse(event.dataTransfer.getData("text/plain")) as DragPayload;
    } catch {
      return null;
    }
  }

  function applyMove(item: PortalCalendarEvent, move: CalendarMove) {
    // Optimistic instantaneous UI update for zero lag
    setLocalEvents((prev) =>
      prev.map((entry) => {
        const isMatch =
          entry.id === item.id ||
          (entry.kind === item.kind && entry.recordId && entry.recordId === item.recordId);
        if (!isMatch) return entry;
        return {
          ...entry,
          date: move.date,
          endDate: move.endDate,
          startMinutes: move.startMinutes ?? entry.startMinutes,
          endMinutes: move.endMinutes ?? entry.endMinutes,
        };
      }),
    );
    onMove(item, move);
    if (move.date) setSelectedDay(move.date);
  }

  function dropOnDay(iso: string, drag: DragEvent) {
    drag.preventDefault();
    setOverDay(null);
    const payload = readPayload(drag);
    const item =
      visible.find((entry) => entry.id === payload?.id || (entry.recordId && payload?.id?.includes(entry.recordId))) ??
      localEvents.find((entry) => entry.id === payload?.id || (entry.recordId && payload?.id?.includes(entry.recordId)));
    if (!payload || !item) return;
    if (payload.mode === "resize") {
      const startDate = item.date ?? iso;
      const end = iso < startDate ? startDate : iso;
      const nextStart = iso < startDate ? iso : startDate;
      applyMove(item, {
        date: nextStart,
        endDate: end === nextStart ? undefined : end,
        startMinutes: eventTimes(item).start,
        endMinutes: eventTimes(item).end,
      });
      return;
    }
    const dayOffset = payload.dayOffset ?? 0;
    const targetStartDate = dayOffset > 0 ? addIsoDays(iso, -dayOffset) : iso;
    applyMove(item, {
      date: targetStartDate,
      endDate: payload.span > 1 ? addIsoDays(targetStartDate, payload.span - 1) : undefined,
      startMinutes: eventTimes(item).start,
      endMinutes: eventTimes(item).end,
    });
  }

  function dropOnSlot(iso: string, slotStart: number, drag: DragEvent) {
    drag.preventDefault();
    setOverDay(null);
    const payload = readPayload(drag);
    const item =
      visible.find((entry) => entry.id === payload?.id || (entry.recordId && payload?.id?.includes(entry.recordId))) ??
      localEvents.find((entry) => entry.id === payload?.id || (entry.recordId && payload?.id?.includes(entry.recordId)));
    if (!payload || !item) return;
    const times = eventTimes(item);
    const duration = Math.max(SLOT, payload.duration || times.end - times.start);
    if (payload.mode === "resize") {
      const nextEnd = snapMinutes(slotStart + SLOT, times.start + SLOT, DAY_END);
      applyMove(item, {
        date: item.date ?? iso,
        endDate: item.endDate,
        startMinutes: times.start,
        endMinutes: nextEnd,
      });
      return;
    }
    const nextStart = snapMinutes(slotStart, DAY_START, DAY_END - SLOT);
    const capped = Math.min(duration, DAY_END - nextStart);
    const dayOffset = payload.dayOffset ?? 0;
    const targetStartDate = dayOffset > 0 ? addIsoDays(iso, -dayOffset) : iso;
    applyMove(item, {
      date: targetStartDate,
      endDate: payload.span > 1 ? addIsoDays(targetStartDate, payload.span - 1) : undefined,
      startMinutes: nextStart,
      endMinutes: nextStart + Math.max(SLOT, capped),
    });
  }

  function resizeTo(item: PortalCalendarEvent, endMinutes: number) {
    const times = eventTimes(item);
    applyMove(item, {
      date: item.date ?? selectedDay,
      endDate: item.endDate,
      startMinutes: times.start,
      endMinutes: snapMinutes(endMinutes, times.start + SLOT, DAY_END),
    });
  }

  function shiftView(step: number) {
    switch (view) {
      case "day":
        setSelectedDay((current) => addIsoDays(current, step));
        return;
      case "week":
        setSelectedDay((current) => addIsoDays(current, step * 7));
        return;
      case "month":
        setCursor((current) => {
          const month = current.month + step;
          if (month < 0) return { year: current.year - 1, month: 11 };
          if (month > 11) return { year: current.year + 1, month: 0 };
          return { year: current.year, month };
        });
        return;
      default: {
        const _never: never = view;
        return _never;
      }
    }
  }

  function heading() {
    switch (view) {
      case "day":
        return dayHeading(selectedDay);
      case "week":
        return weekHeading(selectedDay);
      case "month":
        return monthLabel(cursor.year, cursor.month);
      default: {
        const _never: never = view;
        return _never;
      }
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" aria-label="Previous" onClick={() => shiftView(-1)}>
            <ChevronLeft />
          </Button>
          <p className="min-w-52 text-center text-sm font-semibold">{heading()}</p>
          <Button variant="outline" size="icon" aria-label="Next" onClick={() => shiftView(1)}>
            <ChevronRight />
          </Button>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            const date = new Date();
            setCursor({ year: date.getFullYear(), month: date.getMonth() });
            setSelectedDay(today);
          }}
        >
          Today
        </Button>
        <div className="inline-flex overflow-hidden rounded-md border border-input">
          {VIEWS.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setView(item)}
              className={cn(
                "px-3 py-1.5 text-xs font-medium capitalize",
                view === item ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:bg-secondary",
              )}
            >
              {item}
            </button>
          ))}
        </div>
        <Select
          value={kindFilter || "__all__"}
          onValueChange={(value) => {
            setKindFilter(
              value === "job" ||
                value === "estimate" ||
                value === "request" ||
                value === "invoice" ||
                value === "task"
                ? value
                : "",
            );
          }}
        >
          <SelectTrigger size="sm" className="w-40">
            <SelectValue placeholder="All work" />
          </SelectTrigger>
          <SelectContent position="popper" align="end">
            <SelectItem value="__all__">All work</SelectItem>
            {KINDS.map((kind) => (
              <SelectItem key={kind} value={kind}>
                {calendarEventKindLabel(kind)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {!lockEmployeeId ? (
          <Select
            value={employeeFilter || "__all__"}
            onValueChange={(value) => setEmployeeFilter(value === "__all__" ? "" : value)}
          >
            <SelectTrigger size="sm" className="w-52">
              <SelectValue placeholder="Everyone" />
            </SelectTrigger>
            <SelectContent position="popper" align="end">
              <SelectItem value="__all__">Everyone</SelectItem>
              {everyoneOptions.map((item) => (
                <SelectItem key={item.id} value={item.id}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}
        {toolbar}
      </div>

      <div className="flex flex-wrap gap-2 text-[11px]">
        {KINDS.map((kind) => {
          const active = kindFilter === kind;
          return (
            <button
              key={kind}
              type="button"
              onClick={() => setKindFilter(kindFilter === kind ? "" : kind)}
              className={cn(
                "rounded-md px-2 py-0.5 font-medium transition-opacity",
                calendarEventTone(kind),
                active ? "ring-2 ring-primary ring-offset-1" : kindFilter ? "opacity-45" : null,
              )}
              aria-pressed={active}
            >
              {calendarEventKindLabel(kind)}
            </button>
          );
        })}
        <span className="text-muted-foreground">
          {view === "month"
            ? "Drag to a day. Pull the right edge to extend dates."
            : "30-minute slots, 6 AM–midnight. Drag to any time or date. Pull the bottom edge to extend."}
        </span>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_280px]">
        {view === "month" ? (
          <MonthGrid
            cells={cells}
            today={today}
            selectedDay={selectedDay}
            overDay={overDay}
            onSelect={setSelectedDay}
            onOver={setOverDay}
            onDrop={dropOnDay}
            onOpen={onEventOpen}
          />
        ) : (
          <TimeGrid
            days={view === "day" ? [selectedDay] : weekDays}
            today={today}
            selectedDay={selectedDay}
            events={visible}
            onSelect={setSelectedDay}
            onDropSlot={dropOnSlot}
            onResize={resizeTo}
            onOpen={onEventOpen}
          />
        )}

        <aside className="border border-input bg-card">
          <div className="border-b border-input px-4 py-3">
            <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Day roster</p>
            <h2 className="mt-1 text-sm font-semibold">{formatDate(selectedDay)}</h2>
            <p className="text-xs text-muted-foreground">{dayEvents.length ? `${dayEvents.length} booked` : "Free"}</p>
          </div>
          <div
            className="min-h-32 divide-y divide-input"
            onDragOver={(drag) => drag.preventDefault()}
            onDrop={(drag) => dropOnDay(selectedDay, drag)}
          >
            {dayEvents.length ? (
              dayEvents.map((item) => {
                const times = eventTimes(item);
                return (
                  <div key={item.id} className="px-4 py-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{item.title}</p>
                        <p className="text-xs text-muted-foreground">{item.detail}</p>
                      </div>
                      <span className={cn("shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-medium", calendarEventTone(item.kind))}>
                        {calendarEventKindLabel(item.kind)}
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {isAllDay(item)
                        ? `${calendarEventStatusLabel(item.kind, item.status)} · ${timeWindowLabel(item.timeWindow)}`
                        : `${formatClock(times.start)}–${formatClock(times.end)} · ${calendarEventStatusLabel(item.kind, item.status)}`}
                    </p>
                    {item.customerName ? <p className="mt-1 text-xs text-foreground">{item.customerName}</p> : null}
                    <p className="mt-0.5 text-xs text-muted-foreground">{employeeLabel(item.employeeId)}</p>
                    <Link href={item.href} className="mt-2 inline-block text-xs font-medium text-primary hover:underline">
                      Open
                    </Link>
                  </div>
                );
              })
            ) : (
              <p className="px-4 py-8 text-sm text-muted-foreground">Drop a block here or pick another day.</p>
            )}
          </div>
          <div
            className="border-t border-input px-4 py-3"
            onDragOver={(drag) => drag.preventDefault()}
            onDrop={(drag) => {
              drag.preventDefault();
              const payload = readPayload(drag);
              const item = localEvents.find((entry) => entry.id === payload?.id);
              if (!item) return;
              onMove(item, { date: "" });
            }}
          >
            <p className="text-xs font-medium">Unscheduled</p>
            <p className="text-xs text-muted-foreground">
              {unscheduled.length ? `${unscheduled.length} waiting — drag onto a day` : "Board is clear"}
            </p>
            <div className="mt-2 flex flex-col gap-1">
              {unscheduled.map((item) => (
                <CalendarChip key={item.id} event={item} onOpen={onEventOpen} />
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function MonthGrid({
  cells,
  today,
  selectedDay,
  overDay,
  onSelect,
  onOver,
  onDrop,
  onOpen,
}: {
  cells: { iso: string; day: number; inMonth: boolean; events: PortalCalendarEvent[] }[];
  today: string;
  selectedDay: string;
  overDay: string | null;
  onSelect: (iso: string) => void;
  onOver: (iso: string | null) => void;
  onDrop: (iso: string, drag: DragEvent) => void;
  onOpen?: (event: PortalCalendarEvent) => void;
}) {
  return (
    <div className="overflow-hidden border border-input bg-card">
      <div className="grid grid-cols-7 border-b border-input bg-[#f7f8fa]">
        {WEEKDAYS.map((day) => (
          <p key={day} className="px-2 py-2 text-center text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
            {day}
          </p>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((cell) => (
          <div
            key={cell.iso}
            onClick={() => onSelect(cell.iso)}
            onDragOver={(drag) => {
              drag.preventDefault();
              onOver(cell.iso);
            }}
            onDragLeave={() => onOver(null)}
            onDrop={(drag) => onDrop(cell.iso, drag)}
            className={cn(
              "min-h-28 border-b border-r border-input p-1.5 last:border-r-0",
              !cell.inMonth && "bg-[#f7f8fa] text-muted-foreground",
              selectedDay === cell.iso && "bg-secondary/50",
              overDay === cell.iso && "bg-primary/10",
            )}
          >
            <p
              className={cn(
                "mb-1 flex size-6 items-center justify-center rounded-full text-xs font-medium",
                cell.iso === today && "bg-primary text-primary-foreground",
              )}
            >
              {cell.day}
            </p>
            <div className="flex flex-col gap-1">
              {cell.events.slice(0, 3).map((item) => (
                <CalendarChip key={item.id} event={item} onOpen={onOpen} />
              ))}
              {cell.events.length > 3 ? (
                <p className="px-1 text-[10px] text-muted-foreground">+{cell.events.length - 3} more</p>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TimeGrid({
  days,
  today,
  selectedDay,
  events,
  onSelect,
  onDropSlot,
  onResize,
  onOpen,
}: {
  days: string[];
  today: string;
  selectedDay: string;
  events: PortalCalendarEvent[];
  onSelect: (iso: string) => void;
  onDropSlot: (iso: string, slotStart: number, drag: DragEvent) => void;
  onResize: (event: PortalCalendarEvent, endMinutes: number) => void;
  onOpen?: (event: PortalCalendarEvent) => void;
}) {
  const columns = days.length === 1 ? "grid-cols-[72px_minmax(0,1fr)]" : "grid-cols-[72px_repeat(7,minmax(0,1fr))]";
  const height = SLOTS.length * SLOT_PX;
  const [hover, setHover] = useState<{ iso: string; slot: number } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to show the first event's time position (or 8 AM if no events)
  useEffect(() => {
    const earliest = events
      .filter((item) => item.startMinutes != null)
      .reduce<number | null>((min, item) => {
        const t = item.startMinutes ?? null;
        if (t == null) return min;
        return min == null ? t : Math.min(min, t);
      }, null);
    const targetMinutes = earliest ?? 8 * 60;
    const scrollTop = Math.max(0, ((targetMinutes - DAY_START) / SLOT) * SLOT_PX - 64);
    scrollRef.current?.scrollTo({ top: scrollTop, behavior: "instant" });
  }, [events]);

  const timedEvents = useMemo(() => {
    const seen = new Set<string>();
    const startBoundary = days[0];
    const endBoundary = days[days.length - 1];
    return events.filter((item) => {
      if (!item.date || isAllDay(item)) return false;
      const start = item.date;
      const end = eventEndDate(item) ?? start;
      const inRange = start <= endBoundary && end >= startBoundary;
      if (!inRange) return false;
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    });
  }, [events, days]);

  return (
    <div className="border border-input bg-card">
      <div className={cn("grid border-b border-input bg-[#f7f8fa]", columns)}>
        <div />
        {days.map((iso) => (
          <button
            key={iso}
            type="button"
            onClick={() => onSelect(iso)}
            className={cn(
              "px-2 py-2 text-center text-[11px] font-semibold tracking-wide uppercase",
              iso === selectedDay ? "text-primary" : "text-muted-foreground",
              iso === today && "text-primary",
            )}
          >
            {new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric" }).format(parseIso(iso))}
          </button>
        ))}
      </div>

      <div className={cn("grid border-b border-input", columns)}>
        <p className="flex items-center justify-end px-2 py-1 text-[10px] text-muted-foreground">All day</p>
        {days.map((iso) => {
          const allDay = events.filter((item) => eventCovers(item, iso) && isAllDay(item));
          return (
            <div
              key={iso}
              className="min-h-10 space-y-1 border-l border-input p-1"
              onDragOver={(drag) => drag.preventDefault()}
              onDrop={(drag) => onDropSlot(iso, DAY_START, drag)}
            >
              {allDay.map((item) => (
                <CalendarChip key={item.id} event={item} onOpen={onOpen} />
              ))}
            </div>
          );
        })}
      </div>

      <div className="max-h-[42rem] overflow-auto" ref={scrollRef}>
        <div className={cn("grid", columns)}>
          <div className="relative border-r border-input" style={{ height }}>
            {SLOTS.filter((slot) => slot % 60 === 0).map((slot) => (
              <p
                key={slot}
                className="absolute right-2 text-[10px] font-medium leading-none text-foreground"
                style={{ top: ((slot - DAY_START) / SLOT) * SLOT_PX - 5 }}
              >
                {formatClock(slot)}
              </p>
            ))}
            {/* Half-hour tick marks (no label) */}
            {SLOTS.filter((slot) => slot % 60 !== 0).map((slot) => (
              <div
                key={slot}
                className="absolute right-0 h-px w-2 bg-black/20"
                style={{ top: ((slot - DAY_START) / SLOT) * SLOT_PX }}
              />
            ))}
            <p
              className="absolute right-2 text-[10px] font-medium leading-none text-foreground"
              style={{ top: height - 10 }}
            >
              {formatClock(DAY_END)}
            </p>
          </div>

          {/* Days area: background slot grid + continuous full-card bar overlay */}
          <div
            className={cn(
              "relative",
              days.length === 1 ? "col-span-1" : "col-span-7",
            )}
            style={{ height }}
          >
            {/* Background slots grid */}
            <div
              className={cn(
                "absolute inset-0 grid",
                days.length === 1 ? "grid-cols-1" : "grid-cols-7",
              )}
            >
              {days.map((iso) => (
                <div
                  key={iso}
                  className="relative border-r border-input last:border-r-0"
                  style={{ height }}
                >
                  {SLOTS.map((slot) => (
                    <div
                      key={slot}
                      onClick={() => onSelect(iso)}
                      onDragOver={(drag) => {
                        drag.preventDefault();
                        setHover({ iso, slot });
                      }}
                      onDragLeave={() => setHover(null)}
                      onDrop={(drag) => {
                        setHover(null);
                        onDropSlot(iso, slot, drag);
                      }}
                      className={cn(
                        "absolute inset-x-0 border-t",
                        slot % 60 === 0
                          ? "border-input"
                          : "border-dashed border-input",
                        hover?.iso === iso && hover.slot === slot && "bg-primary/10",
                      )}
                      style={{
                        top: ((slot - DAY_START) / SLOT) * SLOT_PX,
                        height: SLOT_PX,
                      }}
                    />
                  ))}
                </div>
              ))}
            </div>

            {/* Continuous Timed Event Bars Overlay */}
            <div className="absolute inset-0 pointer-events-none">
              {timedEvents.map((item) => {
                const itemStartDate = item.date ?? days[0];
                const itemEndDate = eventEndDate(item) ?? itemStartDate;

                const rawStartIdx = days.indexOf(itemStartDate);
                const rawEndIdx = days.indexOf(itemEndDate);
                const effStart = rawStartIdx >= 0 ? rawStartIdx : 0;
                const effEnd = rawEndIdx >= 0 ? rawEndIdx : days.length - 1;

                if (effStart > effEnd) return null;

                const leftPct = (effStart / days.length) * 100;
                const widthPct = ((effEnd - effStart + 1) / days.length) * 100;

                const times = eventTimes(item);
                const top =
                  ((Math.max(times.start, DAY_START) - DAY_START) / SLOT) *
                  SLOT_PX;
                const heightPx = Math.max(
                  SLOT_PX,
                  ((Math.min(times.end, DAY_END) -
                    Math.max(times.start, DAY_START)) /
                    SLOT) *
                    SLOT_PX,
                );

                return (
                  <TimedBar
                    key={item.id}
                    event={item}
                    top={top}
                    height={heightPx}
                    leftPct={leftPct}
                    widthPct={widthPct}
                    onOpen={onOpen}
                    onResize={(endMinutes) => onResize(item, endMinutes)}
                  />
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function TimedBar({
  event,
  top,
  height,
  leftPct,
  widthPct,
  onOpen,
  onResize,
}: {
  event: PortalCalendarEvent;
  top: number;
  height: number;
  leftPct: number;
  widthPct: number;
  onOpen?: (event: PortalCalendarEvent) => void;
  onResize: (endMinutes: number) => void;
}) {
  const times = eventTimes(event);
  const duration = times.end - times.start;
  const endDate = eventEndDate(event) ?? event.date;
  const isMultiDay = Boolean(event.date && endDate && endDate > event.date);
  const span = isMultiDay && event.date && endDate ? diffDays(event.date, endDate) + 1 : 1;
  const [draftEnd, setDraftEnd] = useState<number | null>(null);
  const end = draftEnd ?? times.end;
  const displayHeight = Math.max(
    SLOT_PX,
    ((Math.min(end, DAY_END) - Math.max(times.start, DAY_START)) / SLOT) * SLOT_PX,
  );

  function startDrag(mode: "move" | "resize", drag: DragEvent) {
    drag.stopPropagation();
    drag.dataTransfer.setData(
      "text/plain",
      JSON.stringify({ id: event.id, mode, span, duration } satisfies DragPayload),
    );
    drag.dataTransfer.effectAllowed = "move";
  }

  const blockHeight = displayHeight || height;
  const showDetails = blockHeight >= SLOT_PX * 1.5;
  const timeLabel = `${formatClock(times.start)}–${formatClock(end)}`;
  const service = eventService(event);
  const secondary =
    showDetails && service && service !== event.title
      ? `${timeLabel} · ${service}`
      : timeLabel;

  return (
    <div
      draggable={draftEnd == null}
      onDragStart={(drag) => startDrag("move", drag)}
      onClick={(click) => {
        click.stopPropagation();
        onOpen?.(event);
      }}
      style={{
        top,
        height: displayHeight || height,
        left: `calc(${leftPct}% + 3px)`,
        width: `calc(${widthPct}% - 6px)`,
      }}
      className={cn(
        "pointer-events-auto absolute z-20 flex cursor-grab flex-col justify-center overflow-hidden rounded-md px-2.5 py-1 text-left active:cursor-grabbing transition-shadow hover:shadow-lg shadow-sm border border-white/25",
        calendarEventTone(event.kind),
      )}
      title={`${calendarEventKindLabel(event.kind)} · ${event.title} · ${isMultiDay ? `${formatDate(event.date!)} – ${formatDate(endDate)} · ` : ""}${formatClock(times.start)}–${formatClock(end)}`}
    >
      <div className="flex items-center justify-between gap-2 overflow-hidden">
        <span className="truncate text-xs font-semibold leading-tight">{event.title}</span>
        <span className="truncate text-[11px] font-medium opacity-90 shrink-0">
          {formatClock(times.start)}–{formatClock(end)}{event.detail ? ` · ${eventService(event)}` : ""}
        </span>
      </div>
      <span
        onPointerDown={(pointer) => {
          pointer.preventDefault();
          pointer.stopPropagation();
          const handle = pointer.currentTarget;
          handle.setPointerCapture(pointer.pointerId);
          const originY = pointer.clientY;
          const originEnd = times.end;
          let nextEnd = originEnd;

          function move(next: PointerEvent) {
            const delta = Math.round((next.clientY - originY) / SLOT_PX) * SLOT;
            nextEnd = snapMinutes(originEnd + delta, times.start + SLOT, DAY_END);
            setDraftEnd(nextEnd);
          }
          function up() {
            handle.removeEventListener("pointermove", move);
            handle.removeEventListener("pointerup", up);
            setDraftEnd(null);
            onResize(nextEnd);
          }
          handle.addEventListener("pointermove", move);
          handle.addEventListener("pointerup", up);
        }}
        className="absolute bottom-0 inset-x-0 h-1.5 cursor-s-resize rounded-b-md bg-white/40 hover:bg-white/70"
        aria-label="Extend time"
        title="Drag down to extend time"
      />
    </div>
  );
}

function CalendarChip({
  event,
  onOpen,
}: {
  event: PortalCalendarEvent;
  onOpen?: (event: PortalCalendarEvent) => void;
}) {
  const times = eventTimes(event);
  const span = event.date && eventEndDate(event) ? diffDays(event.date, eventEndDate(event) ?? event.date) + 1 : 1;
  const duration = times.end - times.start;

  function startDrag(mode: "move" | "resize", drag: DragEvent) {
    drag.stopPropagation();
    drag.dataTransfer.setData("text/plain", JSON.stringify({ id: event.id, mode, span, duration } satisfies DragPayload));
    drag.dataTransfer.effectAllowed = "move";
  }

  return (
    <div
      draggable
      onDragStart={(drag) => startDrag("move", drag)}
      onClick={(click) => {
        click.stopPropagation();
        onOpen?.(event);
      }}
      className={cn(
        "relative flex cursor-grab items-start gap-1 rounded-md px-1.5 py-1 text-left active:cursor-grabbing",
        calendarEventTone(event.kind),
      )}
      title={`${calendarEventKindLabel(event.kind)} · ${event.title} · ${event.detail}${event.customerName ? ` · ${event.customerName}` : ""}`}
    >
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline justify-between gap-1">
          <span className="truncate text-[11px] font-medium">{event.title}</span>
          <span className="shrink-0 text-[9px] font-medium uppercase opacity-80">
            {isAllDay(event) ? windowShort(event.timeWindow) : formatClock(times.start)}
          </span>
        </span>
        <span className="mt-0.5 block truncate text-[10px] font-normal leading-tight opacity-90">
          {eventService(event)}
        </span>
      </span>
      <span
        draggable
        onDragStart={(drag) => startDrag("resize", drag)}
        className="mt-0.5 h-3 w-1.5 shrink-0 cursor-ew-resize rounded-sm bg-white/50"
        aria-label="Extend dates"
        title="Drag to extend"
      />
    </div>
  );
}
