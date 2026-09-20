"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  crmReminderStatusLabel,
  type CrmReminderStatus,
} from "@/lib/data/crm-people";

/** Inline Open/Done status control — stops row-click navigation. */
export function ReminderStatusSelect({
  value,
  disabled,
  onChange,
}: {
  value: CrmReminderStatus;
  disabled?: boolean;
  onChange: (next: CrmReminderStatus) => void;
}) {
  return (
    <Select
      value={value}
      disabled={disabled}
      onValueChange={(next) => onChange(next as CrmReminderStatus)}
    >
      <SelectTrigger
        className="h-8 w-[7.5rem]"
        onClick={(event) => event.stopPropagation()}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <SelectValue>{crmReminderStatusLabel(value)}</SelectValue>
      </SelectTrigger>
      <SelectContent
        position="popper"
        className="z-[100]"
        onClick={(event) => event.stopPropagation()}
      >
        <SelectItem value="open">{crmReminderStatusLabel("open")}</SelectItem>
        <SelectItem value="done">{crmReminderStatusLabel("done")}</SelectItem>
      </SelectContent>
    </Select>
  );
}
