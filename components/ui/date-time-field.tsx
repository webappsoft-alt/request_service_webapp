"use client"

import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"

const pad = (n: number) => String(n).padStart(2, "0")

function slotLabel(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number)
  const suffix = h < 12 ? "AM" : "PM"
  const hour = h % 12 === 0 ? 12 : h % 12
  return `${hour}:${pad(m)} ${suffix}`
}

function buildSlots(stepMinutes: number) {
  const slots: string[] = []
  for (let minutes = 0; minutes < 24 * 60; minutes += stepMinutes) {
    slots.push(`${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`)
  }
  return slots
}

function todayLocal() {
  const now = new Date()
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

/**
 * Date + time picker that snaps time to fixed slots (default 15 minutes).
 * The native datetime-local popup ignores `step` for minutes, so time is our own Select.
 * Value / onChange use the same local "YYYY-MM-DDTHH:mm" string as datetime-local.
 */
export function DateTimeField({
  id,
  value,
  onChange,
  disabled,
  stepMinutes = 15,
  defaultTime = "09:00",
  className,
  fieldClassName,
}: {
  id?: string
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  stepMinutes?: number
  /** Time used when only a date is picked. */
  defaultTime?: string
  className?: string
  /** Applied to both the date input and the time trigger. */
  fieldClassName?: string
}) {
  const date = value ? value.slice(0, 10) : ""
  const time = value ? value.slice(11, 16) : ""
  const slots = buildSlots(stepMinutes)
  // Keep an off-grid saved time (e.g. 03:18) selectable so it still displays.
  const options = time && !slots.includes(time) ? [...slots, time].sort() : slots

  return (
    <div className={cn("flex gap-2", className)}>
      <Input
        id={id}
        type="date"
        value={date}
        disabled={disabled}
        onChange={(event) => {
          const nextDate = event.target.value
          onChange(nextDate ? `${nextDate}T${time || defaultTime}` : "")
        }}
        className={cn(fieldClassName, "min-w-0 flex-1")}
      />
      <Select
        value={time || undefined}
        disabled={disabled}
        onValueChange={(nextTime) => onChange(`${date || todayLocal()}T${nextTime}`)}
      >
        <SelectTrigger
          aria-label="Time"
          className={cn(fieldClassName, "w-32 shrink-0")}
        >
          <SelectValue placeholder="Time" />
        </SelectTrigger>
        <SelectContent>
          {options.map((slot) => (
            <SelectItem key={slot} value={slot}>
              {slotLabel(slot)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
