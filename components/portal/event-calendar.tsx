"use client";

import { useEffect, useMemo, useRef, useState, type DragEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
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
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function getEventDetailUrl(event: PortalCalendarEvent): string {
  const id = event.recordId || event.id;
  switch (event.kind) {
    case "job":
      return `/pro/dashboard/jobs/${id}`;
    case "fixed_service":
      return `/pro/dashboard/orders/${id}`;
    case "estimate":
      return `/pro/dashboard/new-estimate/${id}`;
    case "request":
      return `/pro/dashboard/requests/${id}`;
    case "invoice":
      return `/pro/dashboard/invoices/${id}`;
    case "payment":
      return `/pro/dashboard/payments/${id}`;
    case "task":
      return `/pro/dashboard/tasks/${id}`;
    case "visit":
      return `/pro/dashboard/new-estimate/${id}`;
    default: {
      const _never: never = event.kind;
      return _never;
    }
  }
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const KINDS: PortalEventKind[] = [
  "job",
  "fixed_service",
  "estimate",
  "visit",
  "request",
  "invoice",
  "payment",
  "task",
];
const VIEWS = ["month", "week", "day"] as const;
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
    case "custom":
      return "Custom";
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
  onEventRemove,
  toolbar,
  initialEmployeeId = "",
  lockEmployeeId = "",
  serverFiltered = false,
  employeeFilter: controlledEmployeeFilter,
  onEmployeeFilterChange,
  kindFilter: controlledKindFilter,
  onKindFilterChange,
  loading = false,
  readOnly = false,
}: {
  events: PortalCalendarEvent[];
  employeeLabel: (id?: string) => string;
  employees?: PortalEmployee[];
  /** Prefer this for Everyone dropdown (employees + contractors from API). */
  memberOptions?: Array<{ id: string; label: string }>;
  onMove: (event: PortalCalendarEvent, move: CalendarMove) => void | Promise<void>;
  onEventOpen?: (event: PortalCalendarEvent) => void;
  onEventRemove?: (event: PortalCalendarEvent) => void;
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
  loading?: boolean;
  /**
   * View-only calendar (technician portal): no drag/resize, no context menus,
   * and cards open `event.href` instead of provider detail pages.
   */
  readOnly?: boolean;
}) {
  const router = useRouter();
  const [localEvents, setLocalEvents] = useState<PortalCalendarEvent[]>(propEvents);
  // pendingMovesRef holds optimistic patches that have not yet been confirmed by the server.
  // We use this to prevent the propEvents sync from reverting an in-flight drag-drop move.
  const pendingMovesRef = useRef<Map<string, CalendarMove>>(new Map());
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    event: PortalCalendarEvent;
  } | null>(null);
  const [dayContextMenu, setDayContextMenu] = useState<{ x: number; y: number; iso: string } | null>(null);
  const [clipboard, setClipboard] = useState<{ action: "copy" | "cut"; event: PortalCalendarEvent } | null>(null);

  useEffect(() => {
    // Merge incoming propEvents with any in-flight optimistic moves so a
    // background API refresh cannot flicker the card back to its old position.
    const pending = pendingMovesRef.current;
    if (pending.size === 0) {
      setLocalEvents(propEvents);
      return;
    }
    setLocalEvents(
      propEvents.map((entry) => {
        const patch =
          pending.get(entry.id) ||
          (entry.recordId ? pending.get(entry.recordId) : undefined);
        if (!patch) return entry;
        return {
          ...entry,
          date: patch.date,
          endDate: patch.endDate,
          startMinutes: patch.startMinutes ?? entry.startMinutes,
          endMinutes: patch.endMinutes ?? entry.endMinutes,
        };
      }),
    );
  }, [propEvents]);

  useEffect(() => {
    function handleClickOutside() {
      setContextMenu(null);
      setDayContextMenu(null);
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setContextMenu(null);
        setDayContextMenu(null);
      }
    }
    if (contextMenu || dayContextMenu) {
      window.addEventListener("click", handleClickOutside);
      window.addEventListener("contextmenu", handleClickOutside);
      window.addEventListener("keydown", handleKeyDown);
      return () => {
        window.removeEventListener("click", handleClickOutside);
        window.removeEventListener("contextmenu", handleClickOutside);
        window.removeEventListener("keydown", handleKeyDown);
      };
    }
  }, [contextMenu, dayContextMenu]);

  const today = toIso(new Date());
  const now = new Date();
  const [view, setView] = useState<CalendarView>("month");
  const [cursor, setCursor] = useState({ year: now.getFullYear(), month: now.getMonth() });
  const [kindFilterInternal, setKindFilterInternal] = useState<PortalEventKind | "">("");
  const [employeeFilterInternal, setEmployeeFilterInternal] = useState(
    lockEmployeeId || initialEmployeeId,
  );
  const [selectedDay, setSelectedDay] = useState(today);
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
    const locked = lockEmployeeId.trim();
    const employeeId = locked || employeeFilter.trim();
    const kind = kindFilter;
    return localEvents.filter((item) => {
      if (kind && item.kind !== kind) return false;
      // Parent already applied member filter via API — skip again unless locked locally.
      if (serverFiltered && !locked) return true;
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
    const all = Array.from({ length: 42 }, (_, index) => {
      const date = new Date(gridStart);
      date.setDate(gridStart.getDate() + index);
      const iso = toIso(date);
      return {
        iso,
        day: date.getDate(),
        inMonth: date.getMonth() === cursor.month,
      };
    });

    // Drop trailing weeks that are entirely outside the current month
    let weekCount = 6;
    while (weekCount > 4) {
      const start = (weekCount - 1) * 7;
      const week = all.slice(start, start + 7);
      if (week.some((cell) => cell.inMonth)) break;
      weekCount -= 1;
    }
    return all.slice(0, weekCount * 7);
  }, [cursor.month, cursor.year]);

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
    // Register optimistic patch so propEvents re-syncs don't flicker
    pendingMovesRef.current.set(item.id, move);
    if (item.recordId) {
      pendingMovesRef.current.set(item.recordId, move);
    }
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
    // Clear the pending patch once the move resolves (success or failure)
    const cleanup = () => {
      pendingMovesRef.current.delete(item.id);
      if (item.recordId) {
        pendingMovesRef.current.delete(item.recordId);
      }
    };
    const result = onMove(item, move);
    if (result && typeof (result as Promise<unknown>).then === "function") {
      void (result as Promise<unknown>).then(cleanup, cleanup);
    } else {
      // onMove is synchronous — clear after a generous timeout that covers the
      // background loadSchedule + re-render cycle
      setTimeout(cleanup, 8000);
    }
    if (move.date) setSelectedDay(move.date);
  }

  function dropOnDay(iso: string, drag: DragEvent) {
    if (readOnly) return;
    drag.preventDefault();
    setOverDay(null);
    const payload = readPayload(drag);
    const item =
      visible.find((entry) => entry.id === payload?.id || (entry.recordId && payload?.id?.includes(entry.recordId))) ??
      localEvents.find((entry) => entry.id === payload?.id || (entry.recordId && payload?.id?.includes(entry.recordId)));
    if (!payload || !item) return;
    const spanDays = Math.max(1, payload.span || diffDays(item.date || iso, eventEndDate(item) || iso) + 1);
    applyMove(item, {
      date: iso,
      endDate: spanDays > 1 ? addIsoDays(iso, spanDays - 1) : undefined,
      startMinutes: eventTimes(item).start,
      endMinutes: eventTimes(item).end,
    });
  }

  function dropOnSlot(iso: string, slotStart: number, drag: DragEvent) {
    if (readOnly) return;
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
      const startDate = item.date ?? iso;
      if (iso !== startDate) {
        const end = iso < startDate ? startDate : iso;
        const nextStart = iso < startDate ? iso : startDate;
        applyMove(item, {
          date: nextStart,
          endDate: end === nextStart ? undefined : end,
          startMinutes: times.start,
          endMinutes: times.end,
        });
        return;
      }
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
    if (readOnly) return;
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

  const handleCardClick = (e: React.MouseEvent, event: PortalCalendarEvent) => {
    e.stopPropagation();
    router.push(readOnly ? event.href : getEventDetailUrl(event));
  };

  const handleContextMenu = (e: React.MouseEvent, event: PortalCalendarEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDayContextMenu(null);
    const menuWidth = 208;
    const menuHeight = clipboard ? 110 : 180;
    const x = Math.max(8, Math.min(e.clientX, (typeof window !== "undefined" ? window.innerWidth : 1000) - menuWidth - 8));
    const y = Math.max(8, Math.min(e.clientY, (typeof window !== "undefined" ? window.innerHeight : 800) - menuHeight - 8));
    setContextMenu({ x, y, event });
  };

  const handleContextMenuDay = (e: React.MouseEvent, iso: string) => {
    if (!clipboard) return;
    e.preventDefault();
    e.stopPropagation();
    setContextMenu(null);
    const menuWidth = 208;
    const menuHeight = 90;
    const x = Math.max(8, Math.min(e.clientX, (typeof window !== "undefined" ? window.innerWidth : 1000) - menuWidth - 8));
    const y = Math.max(8, Math.min(e.clientY, (typeof window !== "undefined" ? window.innerHeight : 800) - menuHeight - 8));
    setDayContextMenu({ x, y, iso });
  };

  function pasteToDate(iso: string) {
    if (!clipboard) return;
    const ev = clipboard.event;
    const times = eventTimes(ev);
    applyMove(ev, { date: iso, endDate: undefined, startMinutes: times.start, endMinutes: times.end });
    setClipboard(null);
  }

  return (
    <div className="space-y-0 relative">
      <div className="-mx-4 flex flex-wrap items-center gap-2 border-y border-border-soft bg-secondary px-4 py-2">
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" className="size-8 border-border-soft bg-card" aria-label="Previous" onClick={() => shiftView(-1)}>
            <ChevronLeft />
          </Button>
          <p className="min-w-52 text-center text-sm font-semibold">{heading()}</p>
          <Button variant="outline" size="icon" className="size-8 border-border-soft bg-card" aria-label="Next" onClick={() => shiftView(1)}>
            <ChevronRight />
          </Button>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-8"
          onClick={() => {
            const date = new Date();
            setCursor({ year: date.getFullYear(), month: date.getMonth() });
            setSelectedDay(today);
          }}
        >
          Today
        </Button>
        <div className="inline-flex h-8 overflow-hidden rounded-md border border-border-soft bg-card">
          {VIEWS.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setView(item)}
              className={cn(
                "px-3 text-xs font-medium capitalize leading-none",
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
            const next =
              value === "job" ||
              value === "fixed_service" ||
              value === "estimate" ||
              value === "visit" ||
              value === "request" ||
              value === "invoice" ||
              value === "payment" ||
              value === "task"
                ? value
                : "";
            setKindFilter(next);
          }}
        >
          <SelectTrigger size="sm" className="h-8 w-40 border-border-soft bg-card">
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
            <SelectTrigger size="sm" className="h-8 w-52 border-border-soft bg-card">
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

      <div className="flex flex-wrap gap-2 py-2 text-[11px]">
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
            ? "Click an item to open details. Right-click for options. Drag and drop to move dates."
            : "30-minute slots, 6 AM–midnight. Click to open details. Right-click for options."}
        </span>
      </div>

      <div
        className="w-full"
        // Cancel every drag gesture in view-only mode (cards and resize handles).
        onDragStartCapture={readOnly ? (drag) => drag.preventDefault() : undefined}
      >
        {loading ? (
          <CalendarGridSkeleton />
        ) : view === "month" ? (
          <MonthGrid
            cells={cells}
            events={visible}
            today={today}
            selectedDay={selectedDay}
            overDay={overDay}
            employeeLabel={employeeLabel}
            cutEventId={clipboard?.action === "cut" ? clipboard.event.id : undefined}
            onSelect={setSelectedDay}
            onOver={setOverDay}
            onDrop={dropOnDay}
            onClickCard={handleCardClick}
            onContextMenuCard={readOnly ? undefined : handleContextMenu}
            onContextMenuDay={readOnly ? undefined : handleContextMenuDay}
          />
        ) : (
          <TimeGrid
            days={view === "day" ? [selectedDay] : weekDays}
            today={today}
            selectedDay={selectedDay}
            events={visible}
            employeeLabel={employeeLabel}
            cutEventId={clipboard?.action === "cut" ? clipboard.event.id : undefined}
            onSelect={setSelectedDay}
            onDropSlot={dropOnSlot}
            onResize={resizeTo}
            onClickCard={handleCardClick}
            onContextMenuCard={readOnly ? undefined : handleContextMenu}
          />
        )}
      </div>

      {/* Event Right-Click Context Menu */}
      {contextMenu && typeof document !== "undefined"
        ? createPortal(
            <>
              <div
                className="fixed inset-0 z-[9998]"
                onClick={() => setContextMenu(null)}
                onContextMenu={(e) => { e.preventDefault(); setContextMenu(null); }}
              />
              <div
                className="fixed z-[9999] min-w-36 rounded-md bg-popover text-popover-foreground shadow-lg text-xs overflow-hidden"
                style={{ left: contextMenu.x, top: contextMenu.y }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="py-1">
                  {clipboard ? (
                    /* ── Clipboard active: show Paste + Cancel ── */
                    <>
                      <button
                        type="button"
                        className="w-full px-2.5 py-1.5 text-left text-xs hover:bg-accent hover:text-accent-foreground cursor-pointer transition-colors block"
                        onClick={() => {
                          const iso = contextMenu.event.date;
                          setContextMenu(null);
                          if (iso) pasteToDate(iso);
                        }}
                      >
                        Paste here
                      </button>
                      <button
                        type="button"
                        className="w-full px-2.5 py-1.5 text-left text-xs text-muted-foreground hover:bg-accent hover:text-accent-foreground cursor-pointer transition-colors block"
                        onClick={() => { setClipboard(null); setContextMenu(null); }}
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    /* ── Normal menu ── */
                    <>
                      <button
                        type="button"
                        className="w-full px-2.5 py-1.5 text-left text-xs hover:bg-accent hover:text-accent-foreground cursor-pointer transition-colors block"
                        onClick={() => {
                          const url = getEventDetailUrl(contextMenu.event);
                          setContextMenu(null);
                          router.push(url);
                        }}
                      >
                        Open Details
                      </button>

                      <button
                        type="button"
                        className="w-full px-2.5 py-1.5 text-left text-xs hover:bg-accent hover:text-accent-foreground cursor-pointer transition-colors block"
                        onClick={() => {
                          const ev = contextMenu.event;
                          setContextMenu(null);
                          onEventOpen?.(ev);
                        }}
                      >
                        Edit / Reassign
                      </button>

                      <div className="my-1 border-t border-border/40" />

                      <button
                        type="button"
                        className="w-full px-2.5 py-1.5 text-left text-xs hover:bg-accent hover:text-accent-foreground cursor-pointer transition-colors block"
                        onClick={() => {
                          const ev = contextMenu.event;
                          setClipboard({ action: "cut", event: ev });
                          setContextMenu(null);
                        }}
                      >
                        Cut
                      </button>

                      {onEventRemove ? (
                        <>
                          <div className="my-1 border-t border-border/40" />
                          <button
                            type="button"
                          className="w-full px-2.5 py-1.5 text-left text-xs text-red-600 dark:text-red-400 hover:bg-red-500/10 cursor-pointer transition-colors block"
                            onClick={() => {
                              const ev = contextMenu.event;
                              setContextMenu(null);
                              onEventRemove(ev);
                            }}
                          >
                            Remove from Schedule
                          </button>
                        </>
                      ) : null}
                    </>
                  )}
                </div>
              </div>
            </>,
            document.body,
          )
        : null}

      {/* Day-cell Right-Click Context Menu (paste) */}
      {dayContextMenu && clipboard && typeof document !== "undefined"
        ? createPortal(
            <>
              <div
                className="fixed inset-0 z-[9998]"
                onClick={() => setDayContextMenu(null)}
                onContextMenu={(e) => { e.preventDefault(); setDayContextMenu(null); }}
              />
              <div
                className="fixed z-[9999] min-w-36 rounded-md bg-popover text-popover-foreground shadow-lg text-xs overflow-hidden"
                style={{ left: dayContextMenu.x, top: dayContextMenu.y }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="py-1">
                  <button
                    type="button"
                    className="w-full px-2.5 py-1.5 text-left text-xs hover:bg-accent hover:text-accent-foreground cursor-pointer transition-colors block"
                    onClick={() => {
                      const iso = dayContextMenu.iso;
                      setDayContextMenu(null);
                      pasteToDate(iso);
                    }}
                  >
                    Paste ({clipboard.event.title})
                  </button>
                  <button
                    type="button"
                    className="w-full px-2.5 py-1.5 text-left text-xs text-muted-foreground hover:bg-accent hover:text-accent-foreground cursor-pointer transition-colors block"
                    onClick={() => { setClipboard(null); setDayContextMenu(null); }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </>,
            document.body,
          )
        : null}
    </div>
  );
}

type MonthCell = { iso: string; day: number; inMonth: boolean };

type WeekLaneItem = {
  event: PortalCalendarEvent;
  startCol: number;
  span: number;
  continuesLeft: boolean;
  continuesRight: boolean;
};

function layoutWeekEvents(weekIsos: string[], events: PortalCalendarEvent[]): WeekLaneItem[][] {
  const items: WeekLaneItem[] = [];
  const weekStartIso = weekIsos[0];
  const weekEndIso = weekIsos[6];
  if (!weekStartIso || !weekEndIso) return [];
  for (const event of events) {
    if (!event.date) continue;
    const start = event.date;
    const end = eventEndDate(event) ?? start;
    if (end < weekStartIso || start > weekEndIso) continue;
    const visStart = start < weekStartIso ? weekStartIso : start;
    const visEnd = end > weekEndIso ? weekEndIso : end;
    const startCol = weekIsos.indexOf(visStart);
    const endCol = weekIsos.indexOf(visEnd);
    if (startCol < 0 || endCol < 0) continue;
    items.push({
      event,
      startCol,
      span: endCol - startCol + 1,
      continuesLeft: start < weekStartIso,
      continuesRight: end > weekEndIso,
    });
  }
  items.sort((a, b) => a.startCol - b.startCol || b.span - a.span);
  const lanes: WeekLaneItem[][] = [];
  for (const item of items) {
    const itemEnd = item.startCol + item.span - 1;
    let placed = false;
    for (const lane of lanes) {
      const conflict = lane.some((other) => {
        const otherEnd = other.startCol + other.span - 1;
        return item.startCol <= otherEnd && itemEnd >= other.startCol;
      });
      if (!conflict) {
        lane.push(item);
        placed = true;
        break;
      }
    }
    if (!placed) lanes.push([item]);
  }
  return lanes;
}

function MonthGrid({
  cells,
  events,
  today,
  selectedDay,
  overDay,
  employeeLabel,
  cutEventId,
  onSelect,
  onOver,
  onDrop,
  onClickCard,
  onContextMenuCard,
  onContextMenuDay,
}: {
  cells: MonthCell[];
  events: PortalCalendarEvent[];
  today: string;
  selectedDay: string;
  overDay: string | null;
  employeeLabel?: (id?: string) => string;
  cutEventId?: string;
  onSelect: (iso: string) => void;
  onOver: (iso: string | null) => void;
  onDrop: (iso: string, drag: DragEvent) => void;
  onClickCard?: (e: React.MouseEvent, event: PortalCalendarEvent) => void;
  onContextMenuCard?: (e: React.MouseEvent, event: PortalCalendarEvent) => void;
  onContextMenuDay?: (e: React.MouseEvent, iso: string) => void;
}) {
  const inMonthLine = "#94a3b8";
  const outMonthLine = "#e2e8f0";
  const outerLine = "#94a3b8";
  const weeks: MonthCell[][] = [];
  for (let index = 0; index < cells.length; index += 7) {
    weeks.push(cells.slice(index, index + 7));
  }

  return (
    <div
      className="overflow-hidden rounded-sm bg-card"
      style={{ border: `1px solid ${outerLine}` }}
    >
      <div
        className="grid grid-cols-7 bg-[#f7f8fa]"
        style={{ borderBottom: `1px solid ${inMonthLine}` }}
      >
        {WEEKDAYS.map((day, index) => {
          const weekend = index === 0 || index === 6;
          return (
            <p
              key={day}
              className={cn(
                "px-2 py-2.5 text-center text-[11px] font-semibold tracking-wide uppercase",
                weekend ? "bg-[#fef2f2] text-[#b91c1c]/80" : "text-muted-foreground",
              )}
              style={index < 6 ? { borderRight: `1px solid ${inMonthLine}` } : undefined}
            >
              {day}
            </p>
          );
        })}
      </div>
      {weeks.map((week, weekIndex) => {
        const weekIsos = week.map((cell) => cell.iso);
        const lanes = layoutWeekEvents(weekIsos, events);
        const isLastRow = weekIndex === weeks.length - 1;
        return (
          <div
            key={weekIsos[0]}
            className="relative"
            style={{
              borderBottom: isLastRow ? undefined : `1px solid ${inMonthLine}`,
            }}
          >
            <div className="grid grid-cols-7">
              {week.map((cell, weekday) => {
                const weekend = weekday === 0 || weekday === 6;
                const isLastCol = weekday === 6;
                const line = cell.inMonth ? inMonthLine : outMonthLine;
                return (
                  <div
                    key={cell.iso}
                    className={cn(
                      "px-1.5 pt-1.5",
                      cell.inMonth
                        ? weekend
                          ? "bg-[#fef2f2]"
                          : "bg-card"
                        : "bg-[#f8fafc]",
                      cell.inMonth && selectedDay === cell.iso && "bg-secondary/55",
                      cell.inMonth && overDay === cell.iso && "bg-primary/15",
                      !cell.inMonth && overDay === cell.iso && "bg-primary/10",
                    )}
                    style={{
                      borderRight: isLastCol ? undefined : `1px solid ${line}`,
                    }}
                  >
                    <p
                      className={cn(
                        "flex size-6 items-center justify-center rounded-full text-xs font-medium",
                        cell.inMonth
                          ? weekend && cell.iso !== today
                            ? "text-[#dc2626]/70"
                            : "text-foreground"
                          : "text-slate-400",
                        cell.iso === today && "bg-primary text-primary-foreground",
                      )}
                    >
                      {cell.day}
                    </p>
                  </div>
                );
              })}
            </div>
            <div className="relative min-h-24">
              <div className="absolute inset-0 grid grid-cols-7">
                {week.map((cell, weekday) => {
                  const weekend = weekday === 0 || weekday === 6;
                  const isLastCol = weekday === 6;
                  const line = cell.inMonth ? inMonthLine : outMonthLine;
                  return (
                    <div
                      key={`${cell.iso}-drop`}
                      onClick={() => onSelect(cell.iso)}
                      onContextMenu={(event) => onContextMenuDay?.(event, cell.iso)}
                      onDragOver={(drag) => {
                        drag.preventDefault();
                        onOver(cell.iso);
                      }}
                      onDragLeave={() => onOver(null)}
                      onDrop={(drag) => onDrop(cell.iso, drag)}
                      className={cn(
                        cell.inMonth
                          ? weekend
                            ? "bg-[#fef2f2]"
                            : "bg-card"
                          : "bg-[#f8fafc]",
                        cell.inMonth && selectedDay === cell.iso && "bg-secondary/55",
                        cell.inMonth && overDay === cell.iso && "bg-primary/15",
                        !cell.inMonth && overDay === cell.iso && "bg-primary/10",
                      )}
                      style={{
                        borderRight: isLastCol ? undefined : `1px solid ${line}`,
                      }}
                    />
                  );
                })}
              </div>
              <div className="relative z-10 flex flex-col gap-1 px-1 pb-2 pt-1">
                {lanes.map((lane, laneIndex) => (
                  <div key={laneIndex} className="grid grid-cols-7 gap-1">
                    {lane.map((item) => (
                      <div
                        key={item.event.id}
                        className={cn(
                          "min-w-0",
                          item.continuesLeft && "-ml-1",
                          item.continuesRight && "-mr-1",
                        )}
                        style={{
                          gridColumn: `${item.startCol + 1} / span ${item.span}`,
                        }}
                      >
                        <CalendarChip
                          event={item.event}
                          employeeLabel={employeeLabel}
                          isCut={cutEventId === item.event.id}
                          onClick={onClickCard}
                          onContextMenu={onContextMenuCard}
                        />
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TimeGrid({
  days,
  today,
  selectedDay,
  events,
  employeeLabel,
  cutEventId,
  onSelect,
  onDropSlot,
  onResize,
  onClickCard,
  onContextMenuCard,
}: {
  days: string[];
  today: string;
  selectedDay: string;
  events: PortalCalendarEvent[];
  employeeLabel?: (id?: string) => string;
  cutEventId?: string;
  onSelect: (iso: string) => void;
  onDropSlot: (iso: string, slotStart: number, drag: DragEvent) => void;
  onResize: (event: PortalCalendarEvent, endMinutes: number) => void;
  onClickCard?: (e: React.MouseEvent, event: PortalCalendarEvent) => void;
  onContextMenuCard?: (e: React.MouseEvent, event: PortalCalendarEvent) => void;
}) {
  const columns = days.length === 1 ? "grid-cols-[72px_minmax(0,1fr)]" : "grid-cols-[72px_repeat(7,minmax(0,1fr))]";
  const height = SLOTS.length * SLOT_PX;
  const [hover, setHover] = useState<{ iso: string; slot: number } | null>(null);

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
    <div className="border border-border-soft bg-card">
      <div className={cn("grid border-b border-border-soft bg-[#f7f8fa]", columns)}>
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

      <div className={cn("grid border-b border-border-soft", columns)}>
        <p className="flex items-center justify-end px-2 py-1 text-[10px] text-muted-foreground">All day</p>
        {days.map((iso) => {
          const allDay = events.filter((item) => eventCovers(item, iso) && isAllDay(item));
          return (
            <div
              key={iso}
              className="min-h-10 space-y-1 border-l border-border-soft p-1"
              onDragOver={(drag) => drag.preventDefault()}
              onDrop={(drag) => onDropSlot(iso, DAY_START, drag)}
            >
              {allDay.map((item) => (
                <CalendarChip
                  key={item.id}
                  event={item}
                  onClick={onClickCard}
                  onContextMenu={onContextMenuCard}
                />
              ))}
            </div>
          );
        })}
      </div>

      <div className="w-full">
        <div className={cn("grid", columns)}>
          <div className="relative border-r border-border-soft" style={{ height }}>
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
                  className="relative border-r border-border-soft last:border-r-0"
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
                          ? "border-border-soft"
                          : "border-dashed border-border-soft",
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
                    employeeLabel={employeeLabel}
                    isCut={cutEventId === item.id}
                    onClick={onClickCard}
                    onContextMenu={onContextMenuCard}
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
  employeeLabel,
  isCut,
  onClick,
  onContextMenu,
  onResize,
}: {
  event: PortalCalendarEvent;
  top: number;
  height: number;
  leftPct: number;
  widthPct: number;
  employeeLabel?: (id?: string) => string;
  isCut?: boolean;
  onClick?: (e: React.MouseEvent, event: PortalCalendarEvent) => void;
  onContextMenu?: (e: React.MouseEvent, event: PortalCalendarEvent) => void;
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

  const isDueEvent = event.kind === "invoice" || event.kind === "payment";
  const dueDateDisplay = event.dueDate || event.date;
  const resolvedLabel = event.employeeId && employeeLabel ? employeeLabel(event.employeeId) : "";
  const techName =
    event.technicianName ||
    (resolvedLabel && resolvedLabel !== "Unassigned" ? resolvedLabel : "") ||
    (event.employeeId ? "Assigned" : "Unassigned");
  return (
    <div
      draggable={draftEnd == null}
      onDragStart={(drag) => startDrag("move", drag)}
      onClick={(click) => {
        click.stopPropagation();
        onClick?.(click, event);
      }}
      onContextMenu={(menu) => {
        menu.preventDefault();
        menu.stopPropagation();
        onContextMenu?.(menu, event);
      }}
      style={{
        top,
        height: displayHeight || height,
        left: `calc(${leftPct}% + 3px)`,
        width: `calc(${widthPct}% - 6px)`,
      }}
      className={cn(
        "pointer-events-auto absolute z-20 flex cursor-pointer select-none flex-col justify-start rounded-md p-1.5 text-left active:cursor-grabbing transition shadow-sm hover:shadow-lg hover:brightness-105 border border-white/25",
        calendarEventTone(event.kind),
        isCut && "opacity-40 saturate-50 grayscale-[30%]",
      )}
      title={`${calendarEventKindLabel(event.kind)} · Technician: ${techName} · ${event.title} (Click to open details, right-click for options)`}
    >
      {/* Technician header — only shown when technician is assigned */}
      {event.technicianName || (resolvedLabel && resolvedLabel !== "Unassigned") ? (
        <div className="-mx-1.5 -mt-1.5 mb-1 flex items-center bg-neutral-900 text-white dark:bg-black dark:text-neutral-100 px-2 py-0.5 rounded-t-sm text-[10px] leading-tight font-semibold">
          <span className="truncate">{techName}</span>
        </div>
      ) : null}

      {/* Main card details */}
      <div className="min-w-0 flex-1 flex flex-col justify-between gap-0.5">
        <div className="space-y-0.5">
          {/* Job No */}
          <span className="truncate text-xs font-bold leading-tight block">{event.title}</span>

          {/* Estimate / Job / Request / Task Name */}
          {event.detail && event.detail !== event.title ? (
            <span className="truncate text-[10.5px] font-semibold leading-tight text-white/95 block">
              {event.detail}
            </span>
          ) : null}

          {/* Customer Name */}
          {event.customerName ? (
            <span className="flex items-center gap-1 min-w-0 text-[10px] leading-tight text-white/90 font-medium">
              <svg className="size-2.5 shrink-0 opacity-80" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
              </svg>
              <span className="truncate">{event.customerName}</span>
            </span>
          ) : null}

          {/* Site Address */}
          {event.serviceAddress ? (
            <span className="flex items-center gap-1 min-w-0 text-[10px] leading-tight text-white/80">
              <svg className="size-2.5 shrink-0 opacity-80" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
              </svg>
              <span className="truncate">{event.serviceAddress}</span>
            </span>
          ) : null}

          {/* Category */}
          {event.category && event.category !== event.detail && event.category !== event.title ? (
            <span className="block truncate text-[10px] leading-tight text-white/80">
              {event.category}
            </span>
          ) : null}

          {/* Price */}
          {event.price ? (
            <span className="block truncate text-[10.5px] leading-tight text-white/95 font-bold">
              {event.price}
            </span>
          ) : null}
        </div>

        {/* Bottom: date + time */}
        <div className="pt-0.5 border-t border-white/20 flex items-center justify-between gap-1 text-[9.5px] font-semibold tracking-tight uppercase opacity-90">
          {event.date ? (
            <span className="truncate">{formatDate(event.date)}</span>
          ) : <span />}
          <span className="shrink-0">
            {isDueEvent && dueDateDisplay
              ? `Due: ${formatDate(dueDateDisplay)}`
              : `${formatClock(times.start)} – ${formatClock(end)}`}
          </span>
        </div>
      </div>

      {/* Side handle for dragging across days to extend date range in time grid */}
      <span
        draggable
        onDragStart={(drag) => startDrag("resize", drag)}
        className="absolute top-0 bottom-1.5 right-0 w-2 cursor-ew-resize rounded-r-md bg-white/40 hover:bg-white/70"
        aria-label="Extend dates"
        title="Drag right to extend dates across days"
      />
      {/* Bottom handle for extending end time within the day */}
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
  employeeLabel,
  isCut,
  onClick,
  onContextMenu,
}: {
  event: PortalCalendarEvent;
  employeeLabel?: (id?: string) => string;
  isCut?: boolean;
  onClick?: (e: React.MouseEvent, event: PortalCalendarEvent) => void;
  onContextMenu?: (e: React.MouseEvent, event: PortalCalendarEvent) => void;
}) {
  const times = eventTimes(event);
  const endDate = eventEndDate(event) ?? event.date;
  const isMultiDay = Boolean(event.date && endDate && endDate > event.date);
  const span = isMultiDay && event.date && endDate ? diffDays(event.date, endDate) + 1 : 1;

  function startDrag(drag: DragEvent) {
    drag.stopPropagation();
    drag.dataTransfer.setData(
      "text/plain",
      JSON.stringify({
        id: event.id,
        mode: "move",
        span,
        duration: times.end - times.start,
        dayOffset: 0,
      } satisfies DragPayload),
    );
    drag.dataTransfer.effectAllowed = "move";
  }

  const isDueEvent = event.kind === "invoice" || event.kind === "payment";
  const dueDateDisplay = event.dueDate || event.date;
  const resolvedLabel = event.employeeId && employeeLabel ? employeeLabel(event.employeeId) : "";
  const techName =
    event.technicianName ||
    (resolvedLabel && resolvedLabel !== "Unassigned" ? resolvedLabel : "") ||
    (event.employeeId ? "Assigned" : "Unassigned");
  return (
    <div
      draggable
      onDragStart={(drag) => startDrag(drag)}
      onClick={(click) => {
        click.stopPropagation();
        onClick?.(click, event);
      }}
      onContextMenu={(menu) => {
        menu.preventDefault();
        menu.stopPropagation();
        onContextMenu?.(menu, event);
      }}
      className={cn(
        "relative flex cursor-pointer select-none flex-col gap-0.5 rounded-md p-1.5 text-left active:cursor-grabbing shadow-xs transition hover:shadow-md hover:brightness-105 border border-white/20 h-auto w-full",
        calendarEventTone(event.kind),
        isCut && "opacity-40 saturate-50 grayscale-[30%]",
      )}
      title={`${calendarEventKindLabel(event.kind)} · Technician: ${techName} · ${event.title} (Click to open details, right-click for options)`}
    >
      {/* Technician header — only shown when assigned */}
      {event.technicianName || (resolvedLabel && resolvedLabel !== "Unassigned") ? (
        <div className="-mx-1.5 -mt-1.5 mb-1 flex items-center bg-neutral-900 text-white dark:bg-black dark:text-neutral-100 px-1.5 py-0.5 rounded-t-sm text-[10px] leading-tight font-semibold">
          <span className="truncate">{techName}</span>
        </div>
      ) : null}

      {/* Main card details */}
      <div className="min-w-0 space-y-0.5">
        {/* Job No */}
        <span className="block truncate text-[11px] font-bold leading-snug">{event.title}</span>

        {/* Estimate / Job / Request / Task Name */}
        {event.detail && event.detail !== event.title ? (
          <span className="block truncate text-[10px] font-semibold leading-tight text-white/95">
            {event.detail}
          </span>
        ) : null}

        {/* Customer Name */}
        {event.customerName ? (
          <span className="flex items-center gap-1 min-w-0 text-[10px] leading-tight text-white/90 font-medium">
            <svg className="size-2.5 shrink-0 opacity-80" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
            </svg>
            <span className="truncate">{event.customerName}</span>
          </span>
        ) : null}

        {/* Site Address */}
        {event.serviceAddress ? (
          <span className="flex items-center gap-1 min-w-0 text-[10px] leading-tight text-white/80">
            <svg className="size-2.5 shrink-0 opacity-80" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
            </svg>
            <span className="truncate">{event.serviceAddress}</span>
          </span>
        ) : null}

        {/* Category */}
        {event.category && event.category !== event.detail && event.category !== event.title ? (
          <span className="block truncate text-[10px] leading-tight text-white/80">
            {event.category}
          </span>
        ) : null}

        {/* Price */}
        {event.price ? (
          <span className="block truncate text-[10px] leading-tight text-white/95 font-bold">
            {event.price}
          </span>
        ) : null}

        {/* Bottom: date + time */}
        <div className="mt-1 pt-0.5 border-t border-white/20 flex items-center justify-between gap-1 text-[9px] font-semibold tracking-tight uppercase opacity-90">
          {event.date ? (
            <span className="truncate">
              {isMultiDay && endDate
                ? `${formatDate(event.date)} – ${formatDate(endDate)}`
                : formatDate(event.date)}
            </span>
          ) : <span />}
          <span className="shrink-0">
            {isDueEvent && dueDateDisplay ? (
              <span className="text-amber-200">Due: {formatDate(dueDateDisplay)}</span>
            ) : (
              <span>{isAllDay(event) ? windowShort(event.timeWindow) : `${formatClock(times.start)} – ${formatClock(times.end)}`}</span>
            )}
          </span>
        </div>
      </div>
    </div>
  );
}

export function CalendarGridSkeleton() {
  return (
    <div className="w-full overflow-hidden border border-input bg-card" aria-busy="true">
      {/* Weekday headers */}
      <div className="grid grid-cols-7 border-b border-input bg-[#f7f8fa]">
        {WEEKDAYS.map((day) => (
          <div key={day} className="px-2 py-2 text-center text-[11px] font-semibold text-muted-foreground uppercase">
            {day}
          </div>
        ))}
      </div>
      {/* 35 Calendar Cells */}
      <div className="grid grid-cols-7">
        {Array.from({ length: 35 }).map((_, index) => {
          const hasEvent1 = index % 3 === 1 || index % 5 === 2;
          const hasEvent2 = index % 4 === 0 && index > 3;
          return (
            <div
              key={index}
              className="min-h-36 border-b border-r border-input p-1.5 [&:nth-child(7n)]:border-r-0 [&:nth-last-child(-n+7)]:border-b-0"
            >
              <Skeleton className="mb-1 size-6 rounded-full bg-muted" />
              <div className="flex flex-col gap-1">
                {hasEvent1 ? <Skeleton className="h-10 w-full rounded-md bg-muted" /> : null}
                {hasEvent2 ? <Skeleton className="h-10 w-full rounded-md bg-muted" /> : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function EventCalendarSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("space-y-0", className)} aria-busy="true">
      {/* Top Toolbar — always stays visible with buttons intact */}
      <div className="-mx-4 flex flex-wrap items-center gap-2 border-y border-border-soft bg-secondary px-4 py-2">
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" className="size-8 border-border-soft bg-card" disabled>
            <ChevronLeft />
          </Button>
          <p className="min-w-52 text-center text-sm font-semibold">Schedule</p>
          <Button variant="outline" size="icon" className="size-8 border-border-soft bg-card" disabled>
            <ChevronRight />
          </Button>
        </div>
        <Button variant="ghost" size="sm" className="h-8" disabled>
          Today
        </Button>
        <div className="inline-flex h-8 overflow-hidden rounded-md border border-border-soft bg-card">
          <button type="button" className="bg-primary text-primary-foreground px-3 text-xs font-medium capitalize leading-none" disabled>
            Month
          </button>
          <button type="button" className="bg-card text-muted-foreground px-3 text-xs font-medium capitalize leading-none" disabled>
            Week
          </button>
          <button type="button" className="bg-card text-muted-foreground px-3 text-xs font-medium capitalize leading-none" disabled>
            Day
          </button>
        </div>
        <div className="h-8 w-40 rounded-md border border-border-soft bg-card px-3 py-1 text-xs text-muted-foreground flex items-center">
          All work
        </div>
        <div className="h-8 w-52 rounded-md border border-border-soft bg-card px-3 py-1 text-xs text-muted-foreground flex items-center">
          Everyone
        </div>
      </div>

      {/* Filter Badges Row */}
      <div className="flex flex-wrap gap-2 py-2 text-[11px]">
        {KINDS.map((kind) => (
          <span
            key={kind}
            className={cn(
              "rounded-md px-2 py-0.5 font-medium",
              calendarEventTone(kind),
            )}
          >
            {calendarEventKindLabel(kind)}
          </span>
        ))}
        <span className="text-muted-foreground">
          Drag to a day. Pull the right edge to extend dates.
        </span>
      </div>

      {/* Calendar Grid Skeleton */}
      <CalendarGridSkeleton />
    </div>
  );
}
