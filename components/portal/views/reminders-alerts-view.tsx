"use client";

import { useCallback, useEffect, useId, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  BellRing,
  CalendarClock,
  CheckCircle2,
  Clock3,
  FileWarning,
  Mail,
  Smartphone,
  UserCheck,
  UserX,
} from "lucide-react";
import { toast } from "sonner";
import { getData, patchData } from "@/components/api/apiFuntions";
import { providerApi } from "@/components/api/ApiRoutesFile";
import { extractErrorMessage } from "@/components/api/extractErrorMessage";
import { AiCallingSwitch } from "@/components/ai-calling/ai-calling-switch";
import { PortalPage } from "@/components/portal/portal-page";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { Skeleton } from "@/components/ui/skeleton";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";

type DailyAlertSettings = {
  briefing: boolean;
  briefingLeadMinutes: number;
  employeeBriefing: boolean;
  customerReminders: boolean;
  attendance: boolean;
  graceMinutes: number;
  employeeReminder: boolean;
};

type TodayItem = {
  scheduleId: string;
  kind: string;
  kindLabel: string;
  name: string;
  number: string;
  time: string;
  customer: string;
  address: string;
  href: string;
  sent: boolean;
  audiences: { owner: boolean; employees: string[]; customer: string };
  attendance: Array<{
    employeeId: string;
    name: string;
    hasLogin: boolean;
    checkedIn: boolean;
    alertSent: boolean;
    alertAfter: string;
  }>;
};

type DailyAlerts = {
  settings: DailyAlertSettings;
  today: {
    date: string;
    dateLabel: string;
    timeZone: string;
    now: string;
    officeOpens: string | null;
    briefingAt: string;
    briefingSent: boolean;
    items: TodayItem[];
    changeOrders: Array<{
      id: string;
      jobId: string;
      name: string;
      jobNumber: string;
      customer: string;
      amount: number;
      remindedToday: boolean;
      maxReminders: number;
    }>;
  };
};

const LEAD_OPTIONS = [15, 30, 45, 60, 90, 120];
const GRACE_OPTIONS = [5, 10, 15, 20, 30, 45, 60];

/** Daily alerts: morning briefing, customer reminders and missed check-in alerts (+ today's preview). */
export function RemindersAlertsView() {
  const [data, setData] = useState<DailyAlerts | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState<keyof DailyAlertSettings | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await getData<{ data: DailyAlerts }>(
        providerApi.dailyAlerts,
        undefined,
        { silent: true, force: true },
      );
      setData(res.data);
      setError("");
    } catch (err) {
      setError(
        extractErrorMessage(err) || "Could not load daily alerts.",
      );
    }
  }, []);

  useEffect(() => {
    // Initial load (external API); the effect only kicks it off.
    void load();
  }, [load]);

  async function save<K extends keyof DailyAlertSettings>(
    key: K,
    value: DailyAlertSettings[K],
  ) {
    if (!data) return;
    const previous = data;
    setData({ ...data, settings: { ...data.settings, [key]: value } });
    setSaving(key);
    try {
      const res = await patchData<{ data: DailyAlerts }>(
        providerApi.dailyAlerts,
        { [key]: value },
        { silent: true },
      );
      setData(res.data);
      toast.success("Saved");
    } catch (err) {
      setData(previous);
      toast.error(extractErrorMessage(err) || "Could not save.");
    } finally {
      setSaving(null);
    }
  }

  return (
    <PortalPage
      eyebrow="Office"
      title="Daily alerts"
      description="A morning briefing for every item on today's calendar, reminders for customers, and an alert when someone on your team hasn't checked in."
    >
      {error && !data ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}{" "}
          <button
            type="button"
            className="font-semibold underline"
            onClick={() => void load()}
          >
            Try again
          </button>
        </div>
      ) : !data ? (
        <RemindersSkeleton />
      ) : (
        <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
          <div className="space-y-5">
            <SettingsCard
              icon={<CalendarClock className="size-4" />}
              title="Morning briefing"
              description={`One notification and email per item on today's calendar — jobs, site visits, estimates, tasks, invoices and fixed-price orders — before your office opens${
                data.today.officeOpens
                  ? ` (${data.today.officeOpens} today)`
                  : ""
              }.`}
            >
              <ToggleRow
                label="Send me the briefing"
                checked={data.settings.briefing}
                busy={saving === "briefing"}
                onChange={(value) => void save("briefing", value)}
              />
              <ToggleRow
                label="Send each employee their own items"
                checked={data.settings.employeeBriefing}
                busy={saving === "employeeBriefing"}
                onChange={(value) => void save("employeeBriefing", value)}
              />
              <SelectRow
                label="Send it"
                value={data.settings.briefingLeadMinutes}
                options={LEAD_OPTIONS}
                format={(minutes) => `${minutes} min before opening`}
                busy={saving === "briefingLeadMinutes"}
                onChange={(value) => void save("briefingLeadMinutes", value)}
              />
            </SettingsCard>

            <SettingsCard
              icon={<Mail className="size-4" />}
              title="Customer reminders"
              description="Sent with the morning briefing: an appointment at their place today, an invoice due today with a balance, and change orders still waiting for their answer (up to 3 reminders)."
            >
              <ToggleRow
                label="Remind customers"
                checked={data.settings.customerReminders}
                busy={saving === "customerReminders"}
                onChange={(value) => void save("customerReminders", value)}
              />
            </SettingsCard>

            <SettingsCard
              icon={<UserX className="size-4" />}
              title="Missed check-in alerts"
              description="When someone assigned to a job, site visit or fixed-price order today hasn't clocked in after it starts, you get a detailed alert."
            >
              <ToggleRow
                label="Alert me"
                checked={data.settings.attendance}
                busy={saving === "attendance"}
                onChange={(value) => void save("attendance", value)}
              />
              <SelectRow
                label="Alert after"
                value={data.settings.graceMinutes}
                options={GRACE_OPTIONS}
                format={(minutes) => `${minutes} min late`}
                busy={saving === "graceMinutes"}
                disabled={!data.settings.attendance}
                onChange={(value) => void save("graceMinutes", value)}
              />
              <ToggleRow
                label="Also remind the employee to check in"
                checked={data.settings.employeeReminder}
                busy={saving === "employeeReminder"}
                disabled={!data.settings.attendance}
                onChange={(value) => void save("employeeReminder", value)}
              />
            </SettingsCard>

            <div className="rounded-xl border border-border bg-muted/30 px-4 py-3 text-xs leading-relaxed text-muted-foreground">
              <p className="flex items-center gap-1.5 font-semibold text-foreground">
                <BellRing className="size-3.5" aria-hidden /> Every reminder
                goes out on all channels
              </p>
              <p className="mt-1">
                Notification bell (with live badge counts), push notifications
                to the browser and to the mobile apps once they&apos;re
                installed{" "}
                <Smartphone
                  className="inline size-3 align-[-1px]"
                  aria-hidden
                />
                , and email with a direct link. Team members without a portal
                login get the email, and the notification waits for them until
                they have one.
              </p>
            </div>
          </div>

          <TodayPanel data={data} />
        </div>
      )}
    </PortalPage>
  );
}

function SettingsCard({
  icon,
  title,
  description,
  children,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-border bg-card">
      <header className="flex gap-3 border-b border-border px-4 py-3">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          {icon}
        </span>
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-foreground">{title}</h2>
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
            {description}
          </p>
        </div>
      </header>
      <div className="divide-y divide-border">{children}</div>
    </section>
  );
}

function ToggleRow({
  label,
  checked,
  busy,
  disabled,
  onChange,
}: {
  label: string;
  checked: boolean;
  busy?: boolean;
  disabled?: boolean;
  onChange: (value: boolean) => void;
}) {
  const id = useId();
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 px-4 py-2.5",
        disabled && "opacity-60",
      )}
    >
      <label htmlFor={id} className="text-sm text-foreground">
        {label}
      </label>
      <AiCallingSwitch
        id={id}
        checked={checked}
        disabled={busy || disabled}
        onCheckedChange={onChange}
      />
    </div>
  );
}

function SelectRow({
  label,
  value,
  options,
  format,
  busy,
  disabled,
  onChange,
}: {
  label: string;
  value: number;
  options: number[];
  format: (value: number) => string;
  busy?: boolean;
  disabled?: boolean;
  onChange: (value: number) => void;
}) {
  const id = useId();
  const list = options.includes(value)
    ? options
    : [...options, value].sort((a, b) => a - b);
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 px-4 py-2",
        disabled && "opacity-60",
      )}
    >
      <label htmlFor={id} className="text-sm text-foreground">
        {label}
      </label>
      <NativeSelect
        id={id}
        size="sm"
        value={String(value)}
        disabled={busy || disabled}
        onChange={(event) => onChange(Number(event.target.value))}
      >
        {list.map((option) => (
          <NativeSelectOption key={option} value={String(option)}>
            {format(option)}
          </NativeSelectOption>
        ))}
      </NativeSelect>
    </div>
  );
}

function Chip({
  tone = "muted",
  children,
}: {
  tone?: "muted" | "good" | "bad" | "primary";
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset",
        tone === "good" &&
          "bg-emerald-500/10 text-emerald-700 ring-emerald-500/25 dark:text-emerald-400",
        tone === "bad" &&
          "bg-destructive/10 text-destructive ring-destructive/25",
        tone === "primary" && "bg-primary/10 text-primary ring-primary/25",
        tone === "muted" && "bg-muted text-muted-foreground ring-border",
      )}
    >
      {children}
    </span>
  );
}

function TodayPanel({ data }: { data: DailyAlerts }) {
  const { today, settings } = data;
  return (
    <section className="rounded-xl border border-border bg-card">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold text-foreground">
            Today · {today.dateLabel}
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {today.now} business time ({today.timeZone.replace("_", " ")})
          </p>
        </div>
        {today.briefingSent ? (
          <Chip tone="good">
            <CheckCircle2 className="size-3" aria-hidden /> Briefing sent
          </Chip>
        ) : (
          <Chip tone="primary">
            <Clock3 className="size-3" aria-hidden /> Briefing at{" "}
            {today.briefingAt}
          </Chip>
        )}
      </header>

      {today.items.length ? (
        <ul className="divide-y divide-border">
          {today.items.map((item) => (
            <li key={item.scheduleId} className="px-4 py-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-muted-foreground">
                    {item.time}
                  </p>
                  <Link
                    href={item.href}
                    className="text-sm font-semibold text-foreground hover:text-primary hover:underline"
                  >
                    {item.name}
                  </Link>
                  {item.customer || item.address ? (
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {[item.customer, item.address]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  ) : null}
                </div>
                <Chip tone={item.sent ? "good" : "muted"}>
                  {item.sent ? "Sent" : `At ${today.briefingAt}`}
                </Chip>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {item.audiences.owner ? <Chip>You</Chip> : null}
                {item.audiences.employees.map((name) => (
                  <Chip key={name}>{name}</Chip>
                ))}
                {item.audiences.customer ? (
                  <Chip>Customer: {item.audiences.customer}</Chip>
                ) : null}
                {!item.audiences.owner &&
                !item.audiences.employees.length &&
                !item.audiences.customer ? (
                  <Chip>Nobody (turned off)</Chip>
                ) : null}
              </div>
              {settings.attendance && item.attendance.length ? (
                <ul className="mt-2 space-y-1">
                  {item.attendance.map((person) => (
                    <li
                      key={person.employeeId}
                      className="flex flex-wrap items-center gap-1.5 text-xs"
                    >
                      {person.checkedIn ? (
                        <UserCheck
                          className="size-3.5 text-emerald-600"
                          aria-hidden
                        />
                      ) : (
                        <UserX
                          className={cn(
                            "size-3.5",
                            person.alertSent
                              ? "text-destructive"
                              : "text-muted-foreground",
                          )}
                          aria-hidden
                        />
                      )}
                      <span className="font-medium text-foreground">
                        {person.name}
                      </span>
                      <span className="text-muted-foreground">
                        {person.checkedIn
                          ? "checked in"
                          : person.alertSent
                            ? "hasn't checked in · you were alerted"
                            : `not checked in yet · alert after ${person.alertAfter}`}
                        {person.hasLogin ? "" : " · no portal login"}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="px-4 py-6 text-center text-sm text-muted-foreground">
          Nothing on today&apos;s calendar.
        </p>
      )}

      {today.changeOrders.length ? (
        <div className="border-t border-border px-4 py-3">
          <p className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            <FileWarning className="size-3.5" aria-hidden /> Change orders
            waiting for the customer
          </p>
          <ul className="mt-2 space-y-1.5">
            {today.changeOrders.map((co) => (
              <li
                key={co.id}
                className="flex flex-wrap items-center justify-between gap-2 text-sm"
              >
                <Link
                  href={`/pro/dashboard/jobs/${co.jobId}`}
                  className="min-w-0 truncate hover:text-primary hover:underline"
                >
                  <span className="font-medium">{co.name}</span>
                  <span className="text-muted-foreground">
                    {" "}
                    · {co.jobNumber} · {co.customer || "Customer"} ·{" "}
                    {formatMoney(co.amount)}
                  </span>
                </Link>
                <Chip tone={co.remindedToday ? "good" : "muted"}>
                  {co.remindedToday
                    ? "Reminded today"
                    : settings.customerReminders
                      ? `At ${today.briefingAt}`
                      : "Off"}
                </Chip>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

function RemindersSkeleton() {
  return (
    <div
      className="grid items-start gap-5 xl:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]"
      aria-busy="true"
      aria-label="Loading"
    >
      <div className="space-y-5">
        {[3, 1, 3].map((rows, index) => (
          <div key={index} className="rounded-xl border border-border bg-card">
            <div className="flex gap-3 border-b border-border px-4 py-3">
              <Skeleton className="size-8 rounded-lg" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-3 w-full" />
              </div>
            </div>
            {Array.from({ length: rows }).map((_, row) => (
              <div
                key={row}
                className="flex items-center justify-between px-4 py-3"
              >
                <Skeleton className="h-3.5 w-2/5" />
                <Skeleton className="h-6 w-11 rounded-full" />
              </div>
            ))}
          </div>
        ))}
      </div>
      <div className="rounded-xl border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-5 w-28 rounded-full" />
        </div>
        {Array.from({ length: 4 }).map((_, row) => (
          <div
            key={row}
            className="space-y-2 border-b border-border px-4 py-3 last:border-0"
          >
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-4 w-3/5" />
            <Skeleton className="h-3 w-2/5" />
          </div>
        ))}
      </div>
    </div>
  );
}
