"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
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
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  onSave: (assignment: PortalAssignment) => void | Promise<void>;
}) {
  const { contractors } = useCrmDirectory();
  const [recordKey, setRecordKey] = useState("");
  const [date, setDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [timeWindow, setTimeWindow] = useState<PortalTimeWindow>("morning");
  const [employeeId, setEmployeeId] = useState("");
  const [saving, setSaving] = useState(false);

  const activeEmployees = useMemo(
    () => employees.filter((item) => item.active),
    [employees],
  );
  const activeContractors = useMemo(
    () => contractors.filter((item) => item.status === "active"),
    [contractors],
  );

  useEffect(() => {
    if (!open) return;
    const next = event ?? events[0];
    const frame = window.requestAnimationFrame(() => {
      setRecordKey(next ? `${next.kind}:${next.recordId}` : "");
      setDate(event?.date ?? defaultDate ?? next?.date ?? "");
      setEndDate(event?.endDate ?? event?.date ?? defaultDate ?? next?.endDate ?? "");
      setTimeWindow(event?.timeWindow ?? "morning");
      setEmployeeId(event?.employeeId ?? activeEmployees[0]?.id ?? "");
    });
    return () => window.cancelAnimationFrame(frame);
  }, [activeEmployees, defaultDate, event, events, open]);

  const selected = event ?? events.find((item) => `${item.kind}:${item.recordId}` === recordKey);

  async function handleSave() {
    if (!selected || !date || !employeeId) return;
    setSaving(true);
    try {
      await onSave({
        kind: selected.kind,
        recordId: selected.recordId,
        date,
        endDate: endDate && endDate > date ? endDate : undefined,
        timeWindow,
        employeeId,
      });
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save this assignment.");
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
            <Select
              value={timeWindow}
              onValueChange={(value) => setTimeWindow(value as PortalTimeWindow)}
            >
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
            <Select value={employeeId || undefined} onValueChange={setEmployeeId}>
              <SelectTrigger id="crew-tech" className="w-full">
                <SelectValue placeholder="Select technician" />
              </SelectTrigger>
              <SelectContent
                position="popper"
                align="start"
                className="z-[100] max-h-64 w-[var(--radix-select-trigger-width)]"
              >
                {activeEmployees.length ? (
                  <SelectGroup>
                    <SelectLabel>Employees</SelectLabel>
                    {activeEmployees.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.firstName} {item.lastName} · {item.trade}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ) : null}
                {activeContractors.length ? (
                  <SelectGroup>
                    <SelectLabel>Contractors</SelectLabel>
                    {activeContractors.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.companyName} · {item.trade}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ) : null}
                {!activeEmployees.length && !activeContractors.length ? (
                  <div className="px-2 py-3 text-sm text-muted-foreground">
                    No technicians available.
                  </div>
                ) : null}
              </SelectContent>
            </Select>
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
