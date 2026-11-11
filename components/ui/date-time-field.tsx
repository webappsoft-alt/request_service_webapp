"use client"

import { useState } from "react"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

const pad = (n: number) => String(n).padStart(2, "0")

function todayLocal() {
  const now = new Date()
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

/**
 * Date + time fields. The time is typed in (native time input, any minute) — client: no slot dropdown.
 * Value / onChange use the same local "YYYY-MM-DDTHH:mm" string as datetime-local, so payloads are unchanged.
 */
export function DateTimeField({
  id,
  value,
  onChange,
  disabled,
  defaultTime = "09:00",
  className,
  fieldClassName,
}: {
  id?: string
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  /** Time used when only a date is picked. */
  defaultTime?: string
  className?: string
  /** Applied to both the date and the time input. */
  fieldClassName?: string
}) {
  const date = value ? value.slice(0, 10) : ""
  const time = value ? value.slice(11, 16) : ""
  // What is in the time box while typing (may be "" mid-edit); follows the saved value when it changes.
  const [draft, setDraft] = useState(time)
  const [synced, setSynced] = useState(time)
  if (synced !== time) {
    setSynced(time)
    setDraft(time)
  }

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
      <Input
        type="time"
        aria-label="Time"
        value={draft}
        disabled={disabled}
        onChange={(event) => {
          const nextTime = event.target.value
          setDraft(nextTime)
          // "" while a segment is half-typed / cleared: keep the last full time (a visit always has one).
          if (!nextTime) return
          onChange(`${date || todayLocal()}T${nextTime}`)
        }}
        className={cn(fieldClassName, "w-36 shrink-0 tabular-nums")}
      />
    </div>
  )
}
