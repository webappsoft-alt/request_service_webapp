"use client";

import { useMemo, useState, type DragEvent, type ReactNode } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
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
const DAY_START = 7 * 60;
const DAY_END = 19 * 60;
const SLOT = 30;
const SLOT_PX = 32;
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
  const [year, month, day] = value.split("-").map(Number);
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
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(parseIso(iso));
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
};

export function EventCalendar({
  events,
  employeeLabel,
  employees,
  onMove,
  onEventOpen,
  toolbar,
}: {
  events: PortalCalendarEvent[];
  employeeLabel: (id?: string) => string;
  employees?: PortalEmployee[];
  onMove: (event: PortalCalendarEvent, move: CalendarMove) => void;
  onEventOpen?: (event: PortalCalendarEvent) => void;
  toolbar?: ReactNode;
}) {
  const today = toIso(new Date());
  const firstDated =
    events.find((item) => item.date && item.kind === "job")?.date ??
    events.find((item) => item.date && item.kind === "estimate")?.date ??
    events.find((item) => item.date)?.date ??
    today;
  const start = parseIso(firstDated);
  const [view, setView] = useState<CalendarView>("day");
  const [cursor, setCursor] = useState({ year: start.getFullYear(), month: start.getMonth() });
  const [kindFilter, setKindFilter] = useState<PortalEventKind | "">("");
  const [employeeFilter, setEmployeeFilter] = useState("");
  const [selectedDay, setSelectedDay] = useState(firstDated);
  const [overDay, setOverDay] = useState<string | null>(null);

  const visible = useMemo(
    () =>
      events.filter((item) => {
        if (kindFilter && item.kind !== kindFilter) return false;
        if (employeeFilter && item.employeeId !== employeeFilter) return false;
        return true;
      }),
    [employeeFilter, events, kindFilter],
  );

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
    onMove(item, move);
    if (move.date) setSelectedDay(move.date);
  }

  function dropOnDay(iso: string, drag: DragEvent) {
    drag.preventDefault();
    setOverDay(null);
    const payload = readPayload(drag);
    const item = visible.find((entry) => entry.id === payload?.id) ?? events.find((entry) => entry.id === payload?.id);
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
    applyMove(item, {
      date: iso,
      endDate: payload.span > 1 ? addIsoDays(iso, payload.span - 1) : undefined,
      startMinutes: eventTimes(item).start,
      endMinutes: eventTimes(item).end,
    });
  }

  function dropOnSlot(iso: string, slotStart: number, drag: DragEvent) {
    drag.preventDefault();
    setOverDay(null);
    const payload = readPayload(drag);
    const item = visible.find((entry) => entry.id === payload?.id) ?? events.find((entry) => entry.id === payload?.id);
    if (!payload || !item) return;
    const times = eventTimes(item);
    const duration = Math.max(SLOT, payload.duration || times.end - times.start);
    if (payload.mode === "resize") {
      const nextEnd = snapMinutes(slotStart + SLOT, times.start + SLOT, DAY_END);
      applyMove(item, {
        date: item.date ?? iso,
        endDate: undefined,
        startMinutes: times.start,
        endMinutes: nextEnd,
      });
      return;
    }
    const nextStart = snapMinutes(slotStart, DAY_START, DAY_END - SLOT);
    const capped = Math.min(duration, DAY_END - nextStart);
    applyMove(item, {
      date: iso,
      endDate: undefined,
      startMinutes: nextStart,
      endMinutes: nextStart + Math.max(SLOT, capped),
    });
  }

  function resizeTo(item: PortalCalendarEvent, iso: string, endMinutes: number) {
    const times = eventTimes(item);
    applyMove(item, {
      date: item.date ?? iso,
      endDate: undefined,
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
        <div className="inline-flex overflow-hidden rounded-md border border-black/15">
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
        <NativeSelect className="w-40" value={kindFilter} onChange={(change) => setKindFilter(change.target.value as PortalEventKind | "")}>
          <NativeSelectOption value="">All work</NativeSelectOption>
          {KINDS.map((kind) => (
            <NativeSelectOption key={kind} value={kind}>
              {calendarEventKindLabel(kind)}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        {employees ? (
          <NativeSelect className="w-48" value={employeeFilter} onChange={(change) => setEmployeeFilter(change.target.value)}>
            <NativeSelectOption value="">Everyone</NativeSelectOption>
            {employees
              .filter((item) => item.active)
              .map((item) => (
                <NativeSelectOption key={item.id} value={item.id}>
                  {item.firstName} {item.lastName}
                </NativeSelectOption>
              ))}
          </NativeSelect>
        ) : null}
        {toolbar}
      </div>

      <div className="flex flex-wrap gap-2 text-[11px]">
        {KINDS.map((kind) => (
          <span key={kind} className={cn("rounded-md px-2 py-0.5 font-medium", calendarEventTone(kind))}>
            {calendarEventKindLabel(kind)}
          </span>
        ))}
        <span className="text-muted-foreground">
          {view === "month"
            ? "Drag to a day. Pull the right edge to extend dates."
            : "30-minute slots, 7 AM–7 PM. Drag to any time or date. Pull the bottom edge to extend (7 to 10 = 3 hours)."}
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

        <aside className="border border-black/15 bg-card">
          <div className="border-b border-black/10 px-4 py-3">
            <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Day roster</p>
            <h2 className="mt-1 text-sm font-semibold">{formatDate(selectedDay)}</h2>
            <p className="text-xs text-muted-foreground">{dayEvents.length ? `${dayEvents.length} booked` : "Free"}</p>
          </div>
          <div
            className="min-h-32 divide-y divide-black/10"
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
            className="border-t border-black/10 px-4 py-3"
            onDragOver={(drag) => drag.preventDefault()}
            onDrop={(drag) => {
              drag.preventDefault();
              const payload = readPayload(drag);
              const item = events.find((entry) => entry.id === payload?.id);
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
    <div className="overflow-hidden border border-black/15 bg-card">
      <div className="grid grid-cols-7 border-b border-black/10 bg-[#f7f8fa]">
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
              "min-h-28 border-b border-r border-black/10 p-1.5 last:border-r-0",
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
  onResize: (event: PortalCalendarEvent, iso: string, endMinutes: number) => void;
  onOpen?: (event: PortalCalendarEvent) => void;
}) {
  const columns = days.length === 1 ? "grid-cols-[72px_minmax(0,1fr)]" : "grid-cols-[72px_repeat(7,minmax(0,1fr))]";
  const height = SLOTS.length * SLOT_PX;
  const [hover, setHover] = useState<{ iso: string; slot: number } | null>(null);

  return (
    <div className="border border-black/15 bg-card">
      <div className={cn("grid border-b border-black/10 bg-[#f7f8fa]", columns)}>
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

      <div className={cn("grid border-b border-black/10", columns)}>
        <p className="flex items-center justify-end px-2 py-1 text-[10px] text-muted-foreground">All day</p>
        {days.map((iso) => {
          const allDay = events.filter((item) => eventCovers(item, iso) && isAllDay(item));
          return (
            <div
              key={iso}
              className="min-h-10 space-y-1 border-l border-black/10 p-1"
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

      <div className="max-h-[36rem] overflow-auto">
        <div className={cn("grid", columns)}>
          <div className="relative border-r border-black/10" style={{ height }}>
            {SLOTS.map((slot) => (
              <p
                key={slot}
                className={cn(
                  "absolute right-2 text-[10px] leading-none",
                  slot % 60 === 0 ? "font-medium text-foreground" : "text-muted-foreground",
                )}
                style={{ top: ((slot - DAY_START) / SLOT) * SLOT_PX + 2 }}
              >
                {formatClock(slot)}
              </p>
            ))}
            <p
              className="absolute right-2 text-[10px] font-medium leading-none text-foreground"
              style={{ top: height - 10 }}
            >
              {formatClock(DAY_END)}
            </p>
          </div>
          {days.map((iso) => {
            const timed = events.filter((item) => eventCovers(item, iso) && !isAllDay(item));
            return (
              <div key={iso} className="relative border-r border-black/10 last:border-r-0" style={{ height }}>
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
                      slot % 60 === 0 ? "border-black/15" : "border-dashed border-black/10",
                      hover?.iso === iso && hover.slot === slot && "bg-primary/10",
                    )}
                    style={{ top: ((slot - DAY_START) / SLOT) * SLOT_PX, height: SLOT_PX }}
                  />
                ))}
                {timed.map((item) => {
                  const times = eventTimes(item);
                  const top = ((Math.max(times.start, DAY_START) - DAY_START) / SLOT) * SLOT_PX;
                  const heightPx = Math.max(
                    SLOT_PX,
                    ((Math.min(times.end, DAY_END) - Math.max(times.start, DAY_START)) / SLOT) * SLOT_PX,
                  );
                  return (
                    <TimedBlock
                      key={item.id}
                      event={item}
                      top={top}
                      height={heightPx}
                      onOpen={onOpen}
                      onResize={(endMinutes) => onResize(item, iso, endMinutes)}
                    />
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function TimedBlock({
  event,
  top,
  height,
  onOpen,
  onResize,
}: {
  event: PortalCalendarEvent;
  top: number;
  height: number;
  onOpen?: (event: PortalCalendarEvent) => void;
  onResize: (endMinutes: number) => void;
}) {
  const times = eventTimes(event);
  const duration = times.end - times.start;
  const span = event.date && eventEndDate(event) ? diffDays(event.date, eventEndDate(event) ?? event.date) + 1 : 1;
  const [draftEnd, setDraftEnd] = useState<number | null>(null);
  const end = draftEnd ?? times.end;
  const displayHeight = Math.max(
    SLOT_PX,
    ((Math.min(end, DAY_END) - Math.max(times.start, DAY_START)) / SLOT) * SLOT_PX,
  );

  function startDrag(mode: "move" | "resize", drag: DragEvent) {
    drag.stopPropagation();
    drag.dataTransfer.setData("text/plain", JSON.stringify({ id: event.id, mode, span, duration } satisfies DragPayload));
    drag.dataTransfer.effectAllowed = "move";
  }

  return (
    <div
      draggable={draftEnd == null}
      onDragStart={(drag) => startDrag("move", drag)}
      onClick={(click) => {
        click.stopPropagation();
        onOpen?.(event);
      }}
      style={{ top, height: displayHeight || height }}
      className={cn(
        "absolute inset-x-1 z-20 flex cursor-grab flex-col overflow-hidden rounded-md px-2 py-1 text-left active:cursor-grabbing",
        calendarEventTone(event.kind),
      )}
      title={`${calendarEventKindLabel(event.kind)} · ${event.title} · ${formatClock(times.start)}–${formatClock(end)}`}
    >
      <span className="truncate text-[11px] font-medium">{event.title}</span>
      <span className="truncate text-[10px] font-normal opacity-90">
        {formatClock(times.start)}–{formatClock(end)} · {eventService(event)}
      </span>
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
        className="mt-auto h-2 w-full cursor-s-resize rounded-sm bg-white/45"
        aria-label="Extend time"
        title="Drag down to add 30-minute slots"
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
