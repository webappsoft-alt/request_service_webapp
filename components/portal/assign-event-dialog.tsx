"use client";

import { useEffect, useState } from "react";
import { useCrmDirectory } from "@/components/portal/use-crm-directory";
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
import { NativeSelect, NativeSelectOptGroup, NativeSelectOption } from "@/components/ui/native-select";
import type { PortalAssignment, PortalCalendarEvent, PortalEmployee, PortalTimeWindow } from "@/lib/data/portal";
import { calendarEventKindLabel, timeWindowLabel } from "@/lib/data/portal";

const TIME_WINDOWS: PortalTimeWindow[] = ["morning", "afternoon", "all_day"];

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
  onSave: (assignment: PortalAssignment) => void;
}) {
  const { contractors } = useCrmDirectory();
  const [recordKey, setRecordKey] = useState("");
  const [date, setDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [timeWindow, setTimeWindow] = useState<PortalTimeWindow>("morning");
  const [employeeId, setEmployeeId] = useState("");

  useEffect(() => {
    if (!open) return;
    const next = event ?? events[0];
    setRecordKey(next ? `${next.kind}:${next.recordId}` : "");
    setDate(event?.date ?? defaultDate ?? next?.date ?? "");
    setEndDate(event?.endDate ?? event?.date ?? defaultDate ?? next?.endDate ?? "");
    setTimeWindow(event?.timeWindow ?? "morning");
    setEmployeeId(event?.employeeId ?? employees.find((item) => item.active)?.id ?? "");
  }, [defaultDate, employees, event, events, open]);

  const selected = event ?? events.find((item) => `${item.kind}:${item.recordId}` === recordKey);

  function handleSave() {
    if (!selected || !date || !employeeId) return;
    onSave({
      kind: selected.kind,
      recordId: selected.recordId,
      date,
      endDate: endDate && endDate > date ? endDate : undefined,
      timeWindow,
      employeeId,
    });
    onOpenChange(false);
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
              <NativeSelect
                id="crew-event"
                className="w-full"
                value={recordKey}
                onChange={(change) => setRecordKey(change.target.value)}
              >
                {events.map((item) => (
                  <NativeSelectOption key={item.id} value={`${item.kind}:${item.recordId}`}>
                    {calendarEventKindLabel(item.kind)} · {item.title} — {item.detail}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
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
            <NativeSelect
              id="crew-window"
              className="w-full"
              value={timeWindow}
              onChange={(change) => setTimeWindow(change.target.value as PortalTimeWindow)}
            >
              {TIME_WINDOWS.map((item) => (
                <NativeSelectOption key={item} value={item}>
                  {timeWindowLabel(item)}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>
          <Field>
            <FieldLabel htmlFor="crew-tech">Technician</FieldLabel>
            <NativeSelect
              id="crew-tech"
              className="w-full"
              value={employeeId}
              onChange={(change) => setEmployeeId(change.target.value)}
            >
              <NativeSelectOptGroup label="Employees">
                {employees
                  .filter((item) => item.active)
                  .map((item) => (
                    <NativeSelectOption key={item.id} value={item.id}>
                      {item.firstName} {item.lastName} · {item.trade}
                    </NativeSelectOption>
                  ))}
              </NativeSelectOptGroup>
              {contractors.filter((item) => item.status === "active").length ? (
                <NativeSelectOptGroup label="Contractors">
                  {contractors
                    .filter((item) => item.status === "active")
                    .map((item) => (
                      <NativeSelectOption key={item.id} value={item.id}>
                        {item.companyName} · {item.trade}
                      </NativeSelectOption>
                    ))}
                </NativeSelectOptGroup>
              ) : null}
            </NativeSelect>
          </Field>
        </FieldGroup>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!selected || !date || !employeeId}>
            Save assignment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
