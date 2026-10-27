"use client";

import { useMemo } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

/** "13:30" → "1:30 PM". */
export function formatTime12h(value: string) {
  const match = /^(\d{1,2}):(\d{2})/.exec(value || "");
  if (!match) return value || "";
  const hours = Number(match[1]);
  const suffix = hours >= 12 ? "PM" : "AM";
  return `${hours % 12 || 12}:${match[2]} ${suffix}`;
}

/** Every 15 minutes of the day as "HH:MM" (24 h — the stored format). */
const QUARTER_HOURS = Array.from({ length: 96 }, (_, index) => {
  const hours = Math.floor(index / 4);
  const minutes = (index % 4) * 15;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
});

/**
 * Time picker in 15-minute steps, shown as 12-hour AM/PM ("8:00 AM", "8:15 AM"…).
 * Value stays "HH:MM" (24 h). A saved time off the 15-minute grid is kept and listed too.
 */
export function TimeSelect({
  value,
  onChange,
  disabled,
  className,
  "aria-label": ariaLabel,
  id,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
  "aria-label"?: string;
  id?: string;
}) {
  const normalized = /^\d{1,2}:\d{2}/.test(value || "") ? value.slice(0, 5).padStart(5, "0") : "";
  const options = useMemo(
    () =>
      normalized && !QUARTER_HOURS.includes(normalized)
        ? [...QUARTER_HOURS, normalized].sort()
        : QUARTER_HOURS,
    [normalized],
  );

  return (
    <Select value={normalized || undefined} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger id={id} aria-label={ariaLabel} className={cn("w-full tabular-nums", className)}>
        <SelectValue placeholder="Select time" />
      </SelectTrigger>
      <SelectContent position="popper" className="max-h-64">
        {options.map((time) => (
          <SelectItem key={time} value={time} className="tabular-nums">
            {formatTime12h(time)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
