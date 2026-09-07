"use client";

import { useCallback } from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { useCrmDirectory } from "@/components/portal/use-crm-directory";
import { usePortalCrew } from "@/components/portal/use-portal-crew";
import { usePortalRecords } from "@/components/portal/use-portal-records";
import { usePortalWorkspace } from "@/components/portal/use-portal-workspace";
import { Button } from "@/components/ui/button";
import {
  crmCustomerName,
  openRemindersFor,
  reminderIsOverdue,
  reminderSubjectHref,
  reminderSubjectKindLabel,
  type ReminderSubjectKind,
} from "@/lib/data/crm-people";
import { employeeName, getPortalCustomerName } from "@/lib/data/portal";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

export function useReminderLookups() {
  const { customers, contractors, vendors } = useCrmDirectory();
  const { employees } = usePortalCrew();
  const { estimates, jobs, requests, provider } = usePortalWorkspace();
  const records = usePortalRecords();
  const allEstimates = records.mergeEstimates(estimates);
  const allJobs = records.mergeJobs(jobs);

  const label = useCallback(
    (kind: ReminderSubjectKind, id: string) => {
      switch (kind) {
        case "customer": {
          const customer = customers.find((item) => item.id === id);
          return customer ? crmCustomerName(customer) : getPortalCustomerName(provider, id);
        }
        case "employee": {
          const employee = employees.find((item) => item.id === id);
          return employee ? employeeName(employee) : "Employee";
        }
        case "contractor": {
          return contractors.find((item) => item.id === id)?.companyName ?? "Contractor";
        }
        case "vendor": {
          return vendors.find((item) => item.id === id)?.name ?? "Vendor";
        }
        case "estimate": {
          return allEstimates.find((item) => item.id === id)?.number ?? "Estimate";
        }
        case "request": {
          const request = requests.find((item) => item.id === id);
          return request ? `${request.number} · ${request.serviceName}` : "Lead";
        }
        case "job": {
          return allJobs.find((item) => item.id === id)?.number ?? "Job";
        }
        default: {
          const _never: never = kind;
          return _never;
        }
      }
    },
    [allEstimates, allJobs, contractors, customers, employees, provider, requests, vendors],
  );

  const options = useCallback(
    (kind: ReminderSubjectKind) => {
      switch (kind) {
        case "customer":
          return customers.map((item) => ({ id: item.id, label: crmCustomerName(item) }));
        case "employee":
          return employees.map((item) => ({ id: item.id, label: employeeName(item) }));
        case "contractor":
          return contractors.map((item) => ({ id: item.id, label: item.companyName }));
        case "vendor":
          return vendors.map((item) => ({ id: item.id, label: item.name }));
        case "estimate":
          return allEstimates.map((item) => ({ id: item.id, label: item.number }));
        case "request":
          return requests.map((item) => ({ id: item.id, label: `${item.number} · ${item.serviceName}` }));
        case "job":
          return allJobs.map((item) => ({ id: item.id, label: item.number }));
        default: {
          const _never: never = kind;
          return _never;
        }
      }
    },
    [allEstimates, allJobs, contractors, customers, employees, requests, vendors],
  );

  return { label, options };
}

export function OpenReminderBanner({ kind, id }: { kind: ReminderSubjectKind; id: string }) {
  const { reminders, setReminderStatus } = useCrmDirectory();
  const open = openRemindersFor(reminders, kind, id);
  if (!open.length) return null;
  const overdue = open.some((item) => reminderIsOverdue(item));

  return (
    <div
      className={cn(
        "rounded-[4px] border px-4 py-3",
        overdue ? "border-red-300 bg-red-50 text-red-950" : "border-amber-300 bg-amber-50 text-amber-950",
      )}
    >
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">
            {open.length} open reminder{open.length === 1 ? "" : "s"}
            {overdue ? " · overdue" : ""}
          </p>
          <ul className="mt-2 space-y-1.5">
            {open.map((item) => (
              <li key={item.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                <Link href={`/pro/dashboard/reminders/${item.id}`} className="font-medium underline-offset-2 hover:underline">
                  {item.title}
                </Link>
                <span className={reminderIsOverdue(item) ? "font-medium" : "opacity-80"}>Due {formatDate(item.dueAt)}</span>
                <Button size="sm" variant="outline" className="h-7 bg-white" onClick={() => setReminderStatus(item.id, "done")}>
                  Mark done
                </Button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

export function reminderLinkLabel(kind: ReminderSubjectKind, name: string) {
  return `${reminderSubjectKindLabel(kind)} · ${name}`;
}

export function ReminderSubjectLink({
  kind,
  id,
  name,
}: {
  kind: ReminderSubjectKind;
  id: string;
  name: string;
}) {
  if (!id) return <span>—</span>;
  return (
    <Link href={reminderSubjectHref(kind, id)} className="text-primary hover:underline">
      {reminderLinkLabel(kind, name)}
    </Link>
  );
}
