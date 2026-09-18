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
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAppSelector } from "@/store/hooks";
import { selectAuth, selectAuthUser } from "@/store/authSlice";
import type { PortalAssignment, PortalCalendarEvent, PortalEmployee, PortalTimeWindow } from "@/lib/data/portal";
import { calendarEventKindLabel, employeeName, minutesForWindow, timeWindowLabel } from "@/lib/data/portal";

const TIME_WINDOWS: PortalTimeWindow[] = ["morning", "afternoon", "all_day"];

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
    return `This technician already has ${label} booked (${start}–${end}). Pick another time or technician.`;
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
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event?: PortalCalendarEvent | null;
  events: PortalCalendarEvent[];
  employees: PortalEmployee[];
  defaultDate?: string;
  onSave: (assignment: PortalAssignment) => void | Promise<void>;
}) {
  const auth = useAppSelector(selectAuth);
  const user = useAppSelector(selectAuthUser);
  const useApi =
    auth.hydrated &&
    Boolean(auth.token) &&
    (user?.role === "provider" || auth.role === "provider");
  const { contractors } = useCrmDirectory();
  const assigneePaging = usePaginatedCrmOptions(open && useApi ? "assignee" : null, open && useApi);

  const [recordKey, setRecordKey] = useState("");
  const [date, setDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [timeWindow, setTimeWindow] = useState<PortalTimeWindow>("morning");
  const [employeeId, setEmployeeId] = useState("");
  const [employeeLabel, setEmployeeLabel] = useState("");
  const [saving, setSaving] = useState(false);

  const technicianOptions = useMemo(() => {
    const employeeRows = useApi
      ? assigneePaging.options
      : employees
          .filter((item) => item.active)
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
      setEndDate(event?.endDate ?? event?.date ?? defaultDate ?? next?.endDate ?? "");
      setTimeWindow(event?.timeWindow ?? "morning");
      const presetId = event?.employeeId ?? "";
      setEmployeeId(presetId);
      const match = technicianOptions.find((item) => item.id === presetId);
      setEmployeeLabel(match?.label ?? "");
    });
    return () => window.cancelAnimationFrame(frame);
  }, [defaultDate, event, events, open]);

  useEffect(() => {
    if (!open || !employeeId || employeeLabel) return;
    const match = technicianOptions.find((item) => item.id === employeeId);
    if (match) setEmployeeLabel(match.label);
  }, [employeeId, employeeLabel, open, technicianOptions]);

  const selected = event ?? events.find((item) => `${item.kind}:${item.recordId}` === recordKey);

  async function handleSave() {
    if (!selected || !date || !employeeId) return;
    const window = minutesForWindow(timeWindow);
    setSaving(true);
    try {
      await onSave({
        kind: selected.kind,
        recordId: selected.recordId,
        title: selected.title,
        status: selected.status,
        date,
        endDate: endDate && endDate > date ? endDate : undefined,
        timeWindow,
        startMinutes: window.startMinutes,
        endMinutes: window.endMinutes,
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
          <DialogTitle>{event ? "Assign on calendar" : "Schedule a visit"}</DialogTitle>
          <DialogDescription>
            Put a job, estimate visit, or request on the calendar and give it to a technician or contractor.
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
                    <SelectItem key={item.id} value={`${item.kind}:${item.recordId}`}>
                      {calendarEventKindLabel(item.kind)} · {item.title} — {item.detail}
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
              <span className="mt-1 block text-muted-foreground">{event.detail}</span>
            </p>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="crew-date">Start</FieldLabel>
              <Input id="crew-date" type="date" value={date} onChange={(change) => setDate(change.target.value)} />
            </Field>
            <Field>
              <FieldLabel htmlFor="crew-end">End</FieldLabel>
              <Input id="crew-end" type="date" value={endDate} onChange={(change) => setEndDate(change.target.value)} />
            </Field>
          </div>
          <Field>
            <FieldLabel htmlFor="crew-window">Window</FieldLabel>
            <Select value={timeWindow} onValueChange={(value) => setTimeWindow(value as PortalTimeWindow)}>
              <SelectTrigger id="crew-window" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent position="popper" align="start" className="z-[100] w-[var(--radix-select-trigger-width)]">
                {TIME_WINDOWS.map((item) => (
                  <SelectItem key={item} value={item}>
                    {timeWindowLabel(item)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field>
            <FieldLabel htmlFor="crew-tech">Technician</FieldLabel>
            <PaginatedEntitySelect
              id="crew-tech"
              value={employeeId}
              selectedLabel={employeeLabel}
              options={technicianOptions}
              placeholder="Select technician"
              emptyLabel="No technicians found."
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
          <Button onClick={() => void handleSave()} disabled={!selected || !date || !employeeId || saving}>
            {saving ? "Saving..." : "Save assignment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
