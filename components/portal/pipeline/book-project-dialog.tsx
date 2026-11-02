"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarClock, Loader2 } from "lucide-react";
import { PaginatedEntitySelect } from "@/components/portal/paginated-entity-select";
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
import { Input } from "@/components/ui/input";
import { TimeSelect, formatTime12h } from "@/components/ui/time-select";
import type { PipelineCard, PipelineSchedule } from "@/lib/api/pipeline-client";

function todayIsoDate() {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
}

/** "09:30" → 570 */
function toMinutes(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

/**
 * Asked when a card is dropped on Scheduled jobs › Booked: the day, the time window and
 * (optionally) the lead technician. The calendar checks the technician is free.
 */
export function BookProjectDialog({
  card,
  onCancel,
  onConfirm,
}: {
  /** The card being booked; null closes the dialog. */
  card: PipelineCard | null;
  onCancel: () => void;
  onConfirm: (schedule: PipelineSchedule) => Promise<boolean>;
}) {
  const open = Boolean(card);
  const [date, setDate] = useState("");
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("11:00");
  const [employeeId, setEmployeeId] = useState("");
  const [employeeLabel, setEmployeeLabel] = useState("");
  const [saving, setSaving] = useState(false);

  const technicianFilter = useMemo(() => ({ role: "technician" }), []);
  const technicians = usePaginatedCrmOptions(open ? "assignee" : null, open, undefined, technicianFilter);
  const technicianOptions = useMemo(
    () => [{ id: "", label: "Assign later (optional)" }, ...technicians.options],
    [technicians.options],
  );

  useEffect(() => {
    if (!card) return;
    setDate(todayIsoDate());
    setStart("09:00");
    setEnd("11:00");
    setEmployeeId("");
    setEmployeeLabel("");
    setSaving(false);
  }, [card]);

  const startMinutes = toMinutes(start);
  const endMinutes = toMinutes(end);
  const invalid = !date || endMinutes <= startMinutes;

  async function handleConfirm() {
    if (invalid || saving) return;
    setSaving(true);
    const ok = await onConfirm({ date, startMinutes, endMinutes, employeeId: employeeId || null });
    // On success the parent closes the dialog; on failure it stays open to adjust.
    if (!ok) setSaving(false);
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && !saving && onCancel()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarClock className="size-4 text-emerald-600" aria-hidden />
            Book this project
          </DialogTitle>
          <DialogDescription>
            {card ? (
              <>
                <span className="font-medium text-foreground">{card.title}</span>
                {card.customerName ? ` · ${card.customerName}` : ""}. The customer and the crew are notified.
              </>
            ) : null}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 py-1">
          <label className="grid gap-1.5 text-sm">
            <span className="font-medium">Start date</span>
            <Input type="date" value={date} min={todayIsoDate()} onChange={(event) => setDate(event.target.value)} />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5 text-sm">
              <span className="font-medium">From</span>
              <TimeSelect value={start} onChange={setStart} aria-label="Start time" />
            </div>
            <div className="grid gap-1.5 text-sm">
              <span className="font-medium">To</span>
              <TimeSelect value={end} onChange={setEnd} aria-label="End time" />
            </div>
          </div>
          {endMinutes <= startMinutes ? (
            <p className="text-xs text-destructive">End time must be after {formatTime12h(start)}.</p>
          ) : null}
          <div className="grid gap-1.5 text-sm">
            <span className="font-medium">Lead technician</span>
            <PaginatedEntitySelect
              id="pipeline-book-tech"
              value={employeeId}
              options={technicianOptions}
              placeholder="Assign later (optional)"
              selectedLabel={employeeLabel || undefined}
              emptyLabel="No team members found."
              loading={technicians.loading}
              loadingMore={technicians.loadingMore}
              hasMore={technicians.hasMore}
              onLoadMore={technicians.loadMore}
              searchable
              searchValue={technicians.search}
              onSearchChange={technicians.setSearch}
              searchPlaceholder="Search team members…"
              onChange={(id, option) => {
                setEmployeeId(id);
                setEmployeeLabel(id ? option?.label || "" : "");
              }}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={invalid || saving}>
            {saving ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
            Book project
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
