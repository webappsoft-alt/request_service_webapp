"use client";

import { createContext, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { serviceHours, type PortalFixedService } from "@/lib/data/portal";
import { formatDate, formatHoursValue, formatTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { WorkingHours } from "@/lib/types";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
const WEEKDAY_KEYS: WorkingHours["day"][] = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

type BookServiceContextValue = {
  openCalendar: (serviceId?: string) => void;
  calendar: ReactNode;
};

const BookServiceContext = createContext<BookServiceContextValue | null>(null);

function toIso(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseIso(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function monthLabel(year: number, month: number) {
  return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(
    new Date(year, month, 1)
  );
}

function hoursFor(date: Date, hours: WorkingHours[]) {
  return hours.find((item) => item.day === WEEKDAY_KEYS[date.getDay()]);
}

function isOpenDay(date: Date, hours: WorkingHours[]) {
  const entry = hoursFor(date, hours);
  return Boolean(entry && !entry.closed && entry.open && entry.close);
}

function isPast(date: Date) {
  const today = new Date();
  return (
    new Date(date.getFullYear(), date.getMonth(), date.getDate()) <
    new Date(today.getFullYear(), today.getMonth(), today.getDate())
  );
}

function slotTimes(open: string, close: string) {
  const [openHour, openMinute] = open.split(":").map(Number);
  const [closeHour, closeMinute] = close.split(":").map(Number);
  const start = openHour * 60 + openMinute;
  const end = closeHour * 60 + closeMinute;
  const slots: string[] = [];
  for (let minutes = start; minutes + 60 <= end; minutes += 60) {
    const hour = Math.floor(minutes / 60);
    const minute = minutes % 60;
    slots.push(`${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`);
  }
  if (!slots.length && start < end) slots.push(open);
  return slots;
}

export function BookServiceProvider({
  slug,
  workingHours,
  services = [],
  children,
}: {
  slug: string;
  workingHours: WorkingHours[];
  services?: PortalFixedService[];
  children: ReactNode;
}) {
  const router = useRouter();
  const calendarRef = useRef<HTMLDivElement>(null);
  const today = new Date();
  const [open, setOpen] = useState(false);
  const [serviceId, setServiceId] = useState<string | null>(null);
  const [cursor, setCursor] = useState({ year: today.getFullYear(), month: today.getMonth() });
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const selectedService = services.find((item) => item.id === serviceId);
  const hours = selectedService ? serviceHours(selectedService, workingHours) : workingHours;

  const cells = useMemo(() => {
    const first = new Date(cursor.year, cursor.month, 1);
    const start = new Date(first);
    start.setDate(1 - first.getDay());
    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      return {
        iso: toIso(date),
        day: date.getDate(),
        inMonth: date.getMonth() === cursor.month,
        available: date.getMonth() === cursor.month && !isPast(date) && isOpenDay(date, hours),
      };
    });
  }, [cursor.month, cursor.year, hours]);

  const selectedHours = selectedDate ? hoursFor(parseIso(selectedDate), hours) : undefined;
  const slots =
    selectedHours && !selectedHours.closed && selectedHours.open && selectedHours.close
      ? slotTimes(selectedHours.open, selectedHours.close)
      : [];

  function openCalendar(nextServiceId?: string) {
    setServiceId(nextServiceId ?? null);
    setSelectedDate(null);
    setSelectedTime(null);
    setOpen(true);
    requestAnimationFrame(() => {
      calendarRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  }

  function chooseDate(iso: string) {
    setSelectedDate(iso);
    setSelectedTime(null);
  }

  function goNext() {
    if (!selectedDate) return;
    const params = new URLSearchParams({
      provider: slug,
      intent: "book",
      date: selectedDate,
    });
    if (selectedTime) params.set("time", selectedTime);
    if (serviceId) params.set("serviceId", serviceId);
    router.push(`/request-service?${params.toString()}`);
  }

  const calendar = open ? (
    <Card ref={calendarRef} className="scroll-mt-24">
      <CardHeader className="border-b">
        <CardTitle>{selectedService ? `Book ${selectedService.name}` : "Service available"}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 pt-4">
        <p className="text-sm text-muted-foreground">
          {selectedService
            ? "This priced service becomes a job as soon as you book. Pick a time they are available."
            : "Dates follow this pro's working hours. Closed days cannot be booked."}
        </p>

        <div className="flex items-center justify-between gap-2">
          <Button
            variant="outline"
            size="icon"
            type="button"
            aria-label="Previous month"
            onClick={() =>
              setCursor((current) =>
                current.month === 0
                  ? { year: current.year - 1, month: 11 }
                  : { year: current.year, month: current.month - 1 }
              )
            }
          >
            <ChevronLeft />
          </Button>
          <p className="text-sm font-semibold">{monthLabel(cursor.year, cursor.month)}</p>
          <Button
            variant="outline"
            size="icon"
            type="button"
            aria-label="Next month"
            onClick={() =>
              setCursor((current) =>
                current.month === 11
                  ? { year: current.year + 1, month: 0 }
                  : { year: current.year, month: current.month + 1 }
              )
            }
          >
            <ChevronRight />
          </Button>
        </div>

        <div>
          <div className="grid grid-cols-7">
            {WEEKDAYS.map((day) => (
              <p
                key={day}
                className="py-1.5 text-center text-[11px] font-medium tracking-[0.12em] text-muted-foreground uppercase"
              >
                {day}
              </p>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {cells.map((cell) => (
              <button
                key={cell.iso}
                type="button"
                disabled={!cell.available}
                onClick={() => chooseDate(cell.iso)}
                className={cn(
                  "flex aspect-square items-center justify-center rounded-lg text-sm font-medium transition-colors",
                  !cell.inMonth && "text-transparent",
                  cell.inMonth && !cell.available && "cursor-not-allowed text-muted-foreground/40",
                  cell.available && "text-foreground hover:bg-muted",
                  selectedDate === cell.iso && "bg-primary text-primary-foreground hover:bg-primary"
                )}
              >
                {cell.inMonth ? cell.day : ""}
              </button>
            ))}
          </div>
        </div>

        {selectedDate && selectedHours ? (
          <div className="flex flex-col gap-3 border-t pt-4">
            <div>
              <p className="text-sm font-medium">{formatDate(selectedDate)}</p>
              <p className="mt-0.5 text-sm text-muted-foreground">{formatHoursValue(selectedHours)}</p>
            </div>
            {slots.length ? (
              <div className="grid grid-cols-3 gap-2">
                {slots.map((slot) => (
                  <button
                    key={slot}
                    type="button"
                    onClick={() => setSelectedTime(slot)}
                    className={cn(
                      "rounded-lg border px-2 py-2 text-sm font-medium transition-colors",
                      selectedTime === slot
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-card hover:bg-muted"
                    )}
                  >
                    {formatTime(slot)}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}

        <Button size="xl" type="button" disabled={!selectedDate} onClick={goNext}>
          Next
        </Button>
      </CardContent>
    </Card>
  ) : null;

  return (
    <BookServiceContext.Provider value={{ openCalendar, calendar }}>
      {children}
    </BookServiceContext.Provider>
  );
}

function useBookService() {
  const context = useContext(BookServiceContext);
  if (!context) {
    throw new Error("Book service controls must be used inside BookServiceProvider.");
  }
  return context;
}

export function BookServiceButton({
  serviceId,
  label = "Book service",
}: {
  serviceId?: string;
  label?: string;
}) {
  const { openCalendar } = useBookService();
  return (
    <Button variant="outline" size="xl" type="button" onClick={() => openCalendar(serviceId)}>
      {label}
    </Button>
  );
}

export function BookServiceCalendar() {
  return useBookService().calendar;
}
