"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { extractErrorMessage } from "@/components/api/apiFuntions";
import { PaginatedEntitySelect } from "@/components/portal/paginated-entity-select";
import { useCrmDirectory } from "@/components/portal/use-crm-directory";
import { usePaginatedCrmOptions } from "@/components/portal/use-paginated-crm-options";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAppSelector } from "@/store/hooks";
import { selectAuth, selectAuthUser } from "@/store/authSlice";
import type { PortalAssignment, PortalCalendarEvent, PortalEmployee, PortalTimeWindow } from "@/lib/data/portal";
import { calendarEventKindLabel, employeeName } from "@/lib/data/portal";

type TimeSlotOption = {
  value: string;
  startMinutes: number;
  endMinutes: number;
  label: string;
  period: "AM" | "PM";
};

const TIME_INTERVAL_SLOTS: TimeSlotOption[] = (() => {
  const slots: TimeSlotOption[] = [];
  const formatClockLabel = (totalMinutes: number) => {
    const clamped = ((totalMinutes % 1440) + 1440) % 1440;
    const hours24 = Math.floor(clamped / 60);
    const mins = clamped % 60;
    const period = hours24 >= 12 ? "PM" : "AM";
    const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
    const hourStr = String(hours12).padStart(2, "0");
    const minStr = String(mins).padStart(2, "0");
    return `${hourStr}:${minStr} ${period}`;
  };

  for (let min = 0; min < 1440; min += 30) {
    const startStr = formatClockLabel(min);
    const endStr = formatClockLabel(min + 30);
    const period = min < 720 ? "AM" : "PM";
    slots.push({
      value: String(min),
      startMinutes: min,
      endMinutes: min + 30,
      label: `${startStr} – ${endStr}`,
      period,
    });
  }
  return slots;
})();

const AM_SLOTS = TIME_INTERVAL_SLOTS.filter((s) => s.period === "AM");
const PM_SLOTS = TIME_INTERVAL_SLOTS.filter((s) => s.period === "PM");

function formatClockMinutes(total: number) {
  const hours24 = Math.floor(total / 60) % 24;
  const minutes = total % 60;
  const period = hours24 >= 12 ? "PM" : "AM";
  const hours12 = hours24 % 12 || 12;
  return `${hours12}:${String(minutes).padStart(2, "0")} ${period}`;
}

/** Prefer API collision text over axios "Request failed with status code 409". */
function formatAssignError(error: unknown): string {
  const raw = extractErrorMessage(error);
  const match = raw.match(
    /already has appointment ['"]?([^'"]+)['"]? booked between minutes (\d+) and (\d+)/i,
  );
  if (match) {
    const [, label, startRaw, endRaw] = match;
    const start = formatClockMinutes(Number(startRaw));
    const end = formatClockMinutes(Number(endRaw));
    return `This person already has ${label} booked (${start}–${end}). Pick another time or assignee.`;
  }
  if (/schedule collision/i.test(raw)) {
    return raw.replace(
      /between minutes (\d+) and (\d+)/gi,
      (_full, startRaw: string, endRaw: string) =>
        `from ${formatClockMinutes(Number(startRaw))} to ${formatClockMinutes(Number(endRaw))}`,
    );
  }
  return raw || "Could not save this assignment.";
}

export function AssignEventDialog({
  open,
  onOpenChange,
  event,
  events,
  employees,
  defaultDate,
  defaultEmployeeId,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event?: PortalCalendarEvent | null;
  events: PortalCalendarEvent[];
  employees: PortalEmployee[];
  defaultDate?: string;
  /** Prefill assignee (e.g. contractor profile Assign job). */
  defaultEmployeeId?: string;
  onSave: (assignment: PortalAssignment) => void | Promise<void>;
}) {
  const auth = useAppSelector(selectAuth);
  const user = useAppSelector(selectAuthUser);
  const role = String(user?.role || auth.role || "").toLowerCase();
  const useApi =
    auth.hydrated &&
    Boolean(auth.token) &&
    (!role || role === "provider" || role === "pro" || role === "admin");
  const { contractors } = useCrmDirectory();
  const assigneePaging = usePaginatedCrmOptions(open && useApi ? "assignee" : null, open && useApi);

  const [recordKey, setRecordKey] = useState("");
  const [date, setDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [timeSlot, setTimeSlot] = useState<string>("540");
  const [employeeId, setEmployeeId] = useState("");
  const [employeeLabel, setEmployeeLabel] = useState("");
  const [saving, setSaving] = useState(false);

  const technicianOptions = useMemo(() => {
    const employeeRows =
      useApi && assigneePaging.options.length > 0
        ? assigneePaging.options
        : employees
            .filter((item) => item.active !== false)
            .map((item) => ({ id: item.id, label: employeeName(item) }));
    const contractorRows = contractors
      .filter((item) => item.status === "active")
      .map((item) => ({
        id: item.id,
        label: `${item.companyName || `${item.firstName} ${item.lastName}`.trim()} · ${item.trade}`,
      }));
    const seen = new Set(employeeRows.map((item) => item.id));
    return [...employeeRows, ...contractorRows.filter((item) => !seen.has(item.id))];
  }, [assigneePaging.options, contractors, employees, useApi]);

  useEffect(() => {
    if (!open) return;
    const next = event ?? events[0];
    const frame = window.requestAnimationFrame(() => {
      setRecordKey(next ? `${next.kind}:${next.recordId}` : "");
      setDate(event?.date ?? defaultDate ?? next?.date ?? "");
      setEndDate(
        event?.endDate ?? event?.date ?? defaultDate ?? next?.endDate ?? "",
      );

      let initialMinutes = event?.startMinutes ?? next?.startMinutes;
      if (initialMinutes === undefined) {
        const win = event?.timeWindow ?? next?.timeWindow ?? "morning";
        if (win === "afternoon") initialMinutes = 780;
        else if (win === "all_day") initialMinutes = 480;
        else initialMinutes = 540;
      }
      const roundedMinutes = Math.floor(initialMinutes / 30) * 30;
      const matched = TIME_INTERVAL_SLOTS.find(
        (s) => s.startMinutes === roundedMinutes,
      );
      setTimeSlot(matched ? matched.value : "540");

      const presetId = event?.employeeId || defaultEmployeeId || "";
      setEmployeeId(presetId);
      const match = technicianOptions.find((item) => item.id === presetId);
      setEmployeeLabel(match?.label ?? "");
    });
    return () => window.cancelAnimationFrame(frame);
  }, [defaultDate, defaultEmployeeId, event, events, open]);

  useEffect(() => {
    if (!open || !employeeId || employeeLabel) return;
    const match = technicianOptions.find((item) => item.id === employeeId);
    if (match) setEmployeeLabel(match.label);
  }, [employeeId, employeeLabel, open, technicianOptions]);

  const selected =
    event ??
    events.find((item) => `${item.kind}:${item.recordId}` === recordKey);

  async function handleSave() {
    if (!selected || !date || !employeeId) return;
    setSaving(true);
    const slot =
      TIME_INTERVAL_SLOTS.find((s) => s.value === timeSlot) ??
      TIME_INTERVAL_SLOTS[18];
    const timeWindow: PortalTimeWindow =
      slot.startMinutes < 720 ? "morning" : "afternoon";

    try {
      await onSave({
        kind: selected.kind,
        recordId: selected.recordId,
        title: selected.title,
        status: selected.status,
        date,
        endDate: endDate && endDate > date ? endDate : undefined,
        timeWindow,
        startMinutes: slot.startMinutes,
        endMinutes: slot.endMinutes,
        employeeId,
      });
      onOpenChange(false);
    } catch (error) {
      toast.error(formatAssignError(error));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" data-lenis-prevent>
        <DialogHeader>
          <DialogTitle>
            {event ? "Assign on calendar" : "Schedule a visit"}
          </DialogTitle>
          <DialogDescription>
            Put a job, estimate visit, or request on the calendar and assign it
            to a team member or contractor.
          </DialogDescription>
        </DialogHeader>
        <FieldGroup className="gap-4">
          {!event ? (
            <Field>
              <FieldLabel htmlFor="crew-event">Work item</FieldLabel>
              <Select value={recordKey} onValueChange={(value) => setRecordKey(value)}>
                <SelectTrigger id="crew-event" className="w-full">
                  <SelectValue placeholder="Select work item" />
                </SelectTrigger>
                <SelectContent
                  position="popper"
                  align="start"
                  className="z-[100] w-[var(--radix-select-trigger-width)]"
                >
                  {events.map((item) => (
                    <SelectItem
                      key={item.id}
                      value={`${item.kind}:${item.recordId}`}
                    >
                      {calendarEventKindLabel(item.kind)} · {item.title} —{" "}
                      {item.detail}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          ) : (
            <p className="text-sm">
              <span className="font-medium">
                {calendarEventKindLabel(event.kind)} {event.title}
              </span>
              <span className="mt-1 block text-muted-foreground">
                {event.detail}
              </span>
            </p>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="crew-date">Start</FieldLabel>
              <Input
                id="crew-date"
                type="date"
                value={date}
                onChange={(change) => setDate(change.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="crew-end">End</FieldLabel>
              <Input
                id="crew-end"
                type="date"
                value={endDate}
                onChange={(change) => setEndDate(change.target.value)}
              />
            </Field>
          </div>
          <Field>
            <FieldLabel htmlFor="crew-window">Time interval</FieldLabel>
            <Select value={timeSlot} onValueChange={setTimeSlot}>
              <SelectTrigger id="crew-window" className="w-full">
                <SelectValue placeholder="Select time interval" />
              </SelectTrigger>
              <SelectContent
                position="popper"
                align="start"
                className="z-[100] max-h-64 w-[var(--radix-select-trigger-width)]"
              >
                <SelectGroup>
                  <SelectLabel>AM</SelectLabel>
                  {AM_SLOTS.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
                <SelectGroup>
                  <SelectLabel>PM</SelectLabel>
                  {PM_SLOTS.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>
          <Field>
            <FieldLabel>Assign to</FieldLabel>
            <PaginatedEntitySelect
              id="crew-assign"
              value={employeeId}
              selectedLabel={employeeLabel}
              options={technicianOptions}
              placeholder="Select person"
              emptyLabel="No people found."
              loading={useApi ? assigneePaging.loading : false}
              loadingMore={useApi ? assigneePaging.loadingMore : false}
              hasMore={useApi ? assigneePaging.hasMore : false}
              onLoadMore={useApi ? assigneePaging.loadMore : () => {}}
              onChange={(id, option) => {
                setEmployeeId(id);
                setEmployeeLabel(option?.label && id ? option.label : "");
              }}
            />
          </Field>
        </FieldGroup>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => void handleSave()}
            disabled={!selected || !date || !employeeId || saving}
          >
            {saving ? "Saving..." : "Save assignment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
