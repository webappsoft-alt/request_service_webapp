"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useCrmApiData } from "@/components/portal/use-crm-api-data";
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
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { fetchTeam } from "@/store/teamSlice";
import type { PortalAssignment, PortalCalendarEvent, PortalEmployee, PortalTimeWindow } from "@/lib/data/portal";
import { calendarEventKindLabel } from "@/lib/data/portal";

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
  const dispatch = useAppDispatch();
  const reduxEmployees = useAppSelector((state) => state.team?.items ?? []);
  const teamLoading = useAppSelector((state) => state.team?.loading ?? false);
  const { contractors } = useCrmDirectory();
  const crm = useCrmApiData();
  const [recordKey, setRecordKey] = useState("");
  const [date, setDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [timeSlot, setTimeSlot] = useState<string>("540");
  const [employeeId, setEmployeeId] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    void dispatch(fetchTeam({ role: "technician", limit: 100, force: true }));
  }, [dispatch, open]);

  const technicians = useMemo(() => {
    const contractorIds = new Set([
      ...(contractors || []).map((c) => c.id),
      ...(crm.contractors || []).map((c) => c.id),
    ]);
    const list = [
      ...(employees || []),
      ...(reduxEmployees || []),
      ...(crm.employees || []),
    ];
    const seen = new Set<string>();
    const result: PortalEmployee[] = [];
    for (const item of list) {
      if (item && item.id && !seen.has(item.id)) {
        seen.add(item.id);
        // Exclude any contractors
        if (
          contractorIds.has(item.id) ||
          item.id.startsWith("con_") ||
          "companyName" in item
        ) {
          continue;
        }
        const role = String(item.role || "").toLowerCase().trim();
        // Strictly employees who are technicians
        const isTechnician =
          role === "technician" ||
          role === "tech" ||
          (!role && !item.id.startsWith("con_"));
        if (item.active !== false && isTechnician) {
          result.push(item);
        }
      }
    }
    return result;
  }, [employees, reduxEmployees, crm.employees, crm.contractors, contractors]);

  const loading = teamLoading && technicians.length === 0;

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
      setEmployeeId(
        event?.employeeId ??
          next?.employeeId ??
          technicians[0]?.id ??
          "",
      );
    });
    return () => window.cancelAnimationFrame(frame);
  }, [technicians, defaultDate, event, events, open]);

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
        date,
        endDate: endDate && endDate > date ? endDate : undefined,
        timeWindow,
        startMinutes: slot.startMinutes,
        endMinutes: slot.endMinutes,
        employeeId,
      });
      onOpenChange(false);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not save this assignment.",
      );
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
            Put a job, estimate visit, or request on the calendar and give it to
            a technician.
          </DialogDescription>
        </DialogHeader>
        <FieldGroup className="gap-4">
          {!event ? (
            <Field>
              <FieldLabel htmlFor="crew-event">Work item</FieldLabel>
              <Select
                value={recordKey}
                onValueChange={(value) => setRecordKey(value)}
              >
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
            <FieldLabel htmlFor="crew-tech">Technician</FieldLabel>
            <Select
              disabled={loading}
              value={loading ? undefined : (employeeId || undefined)}
              onValueChange={setEmployeeId}
            >
              <SelectTrigger
                id="crew-tech"
                className="w-full"
                loading={loading}
              >
                <SelectValue
                  placeholder={
                    loading
                      ? "Loading technicians…"
                      : "Select technician"
                  }
                />
              </SelectTrigger>
              <SelectContent
                position="popper"
                align="start"
                className="z-[100] max-h-64 w-[var(--radix-select-trigger-width)]"
              >
                {loading ? (
                  <div className="flex items-center gap-2 p-2 text-xs text-muted-foreground">
                    <Loader2 className="size-3.5 animate-spin" />
                    <span>Loading technicians…</span>
                  </div>
                ) : technicians.length ? (
                  technicians.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.firstName} {item.lastName}
                      {item.trade ? ` · ${item.trade}` : ""}
                    </SelectItem>
                  ))
                ) : (
                  <div className="px-2 py-3 text-sm text-muted-foreground">
                    No technicians available.
                  </div>
                )}
              </SelectContent>
            </Select>
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
