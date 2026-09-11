import type { WorkingHours } from "@/lib/types";

const dayLabels: Record<WorkingHours["day"], string> = {
  monday: "Monday",
  tuesday: "Tuesday",
  wednesday: "Wednesday",
  thursday: "Thursday",
  friday: "Friday",
  saturday: "Saturday",
  sunday: "Sunday",
};

export function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00`));
}

export function formatTime(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export function formatWorkingDay(day: WorkingHours["day"]) {
  return dayLabels[day];
}

export function formatWorkingHours(hours: WorkingHours) {
  if (hours.closed || !hours.open || !hours.close) {
    return `${dayLabels[hours.day]} · Closed`;
  }
  return `${dayLabels[hours.day]} · ${formatTime(hours.open)} – ${formatTime(hours.close)}`;
}

export function formatHoursValue(hours: WorkingHours) {
  if (hours.closed || !hours.open || !hours.close) return "Closed";
  return `${formatTime(hours.open)} – ${formatTime(hours.close)}`;
}

export function groupWorkingHours(hours: WorkingHours[]) {
  const groups: { days: WorkingHours["day"][]; sample: WorkingHours }[] = [];

  for (const entry of hours) {
    const last = groups.at(-1);
    const same =
      last &&
      last.sample.closed === entry.closed &&
      last.sample.open === entry.open &&
      last.sample.close === entry.close;

    if (same) last.days.push(entry.day);
    else groups.push({ days: [entry.day], sample: entry });
  }

  return groups.map((group) => {
    const first = dayLabels[group.days[0]];
    const last = dayLabels[group.days[group.days.length - 1]];
    return {
      days: group.days,
      label: group.days.length === 1 ? first : `${first} – ${last}`,
      value: formatHoursValue(group.sample),
      closed: group.sample.closed || !group.sample.open,
    };
  });
}

export function getTodayWeekday(): WorkingHours["day"] {
  const days: WorkingHours["day"][] = [
    "sunday",
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
  ];
  return days[new Date().getDay()];
}

export function formatLocation(city: string, state: string, zip?: string) {
  const place = [city, state]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(", ");
  if (!place) return zip?.trim() || "";
  return zip?.trim() ? `${place} ${zip.trim()}` : place;
}

export function formatAddress(street: string | undefined, city: string, state: string, zip?: string) {
  const cityLine = formatLocation(city, state, zip);
  return street?.trim() ? `${street.trim()}, ${cityLine}` : cityLine;
}

export function formatStartingPrice(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

/** Title-case words for display (categories, company names, titles). */
export function toTitleCase(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  return trimmed
    .toLowerCase()
    .split(/(\s+|[-_/]+)/)
    .map((part) => {
      if (/^\s+$/.test(part) || /^[-_/]+$/.test(part)) return part;
      if (!part) return part;
      return part.charAt(0).toUpperCase() + part.slice(1);
    })
    .join("");
}

export function formatMoney(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function isValidZip(value: string) {
  return /^\d{5}$/.test(value.trim());
}
