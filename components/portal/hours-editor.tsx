"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { cloneWorkingHours } from "@/lib/data/portal";
import { formatWorkingDay, groupWorkingHours } from "@/lib/format";
import type { WorkingHours } from "@/lib/types";

export function HoursEditor({
  hours,
  onChange,
}: {
  hours: WorkingHours[];
  onChange: (next: WorkingHours[]) => void;
}) {
  return (
    <ul className="divide-y divide-black/8 rounded-lg border border-input">
      {cloneWorkingHours(hours).map((entry) => (
        <li key={entry.day} className="grid grid-cols-[7rem_auto_1fr] items-center gap-3 px-3 py-2.5">
          <span className="text-sm font-medium">{formatWorkingDay(entry.day)}</span>
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <Checkbox
              checked={!entry.closed}
              onCheckedChange={(checked) =>
                onChange(
                  cloneWorkingHours(hours).map((item) =>
                    item.day === entry.day
                      ? checked === true
                        ? { ...item, closed: false, open: item.open ?? "08:00", close: item.close ?? "17:00" }
                        : { ...item, closed: true, open: null, close: null }
                      : item,
                  ),
                )
              }
            />
            Open
          </label>
          {entry.closed ? (
            <span className="text-sm text-muted-foreground">Closed</span>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <Input
                type="time"
                value={entry.open ?? "08:00"}
                aria-label={`${formatWorkingDay(entry.day)} opens`}
                onChange={(event) =>
                  onChange(
                    cloneWorkingHours(hours).map((item) =>
                      item.day === entry.day ? { ...item, open: event.target.value, closed: false } : item,
                    ),
                  )
                }
              />
              <Input
                type="time"
                value={entry.close ?? "17:00"}
                aria-label={`${formatWorkingDay(entry.day)} closes`}
                onChange={(event) =>
                  onChange(
                    cloneWorkingHours(hours).map((item) =>
                      item.day === entry.day ? { ...item, close: event.target.value, closed: false } : item,
                    ),
                  )
                }
              />
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

export function ServiceHoursSummary({ hours }: { hours: WorkingHours[] }) {
  return (
    <ul className="flex flex-col gap-1.5 text-sm">
      {groupWorkingHours(hours).map((group) => (
        <li key={group.label} className="flex justify-between gap-3">
          <span className="text-muted-foreground">{group.label}</span>
          <span className="tabular-nums">{group.value}</span>
        </li>
      ))}
    </ul>
  );
}
