"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { useCrmApiData } from "@/components/portal/use-crm-api-data";
import { useCrmDirectory } from "@/components/portal/use-crm-directory";
import { usePortalCrew } from "@/components/portal/use-portal-crew";
import { usePortalRecords } from "@/components/portal/use-portal-records";
import { usePortalWorkspace } from "@/components/portal/use-portal-workspace";
import { Button } from "@/components/ui/button";
import { queryReminders } from "@/lib/api/crm-client";
import {
  crmCustomerName,
  openRemindersFor,
  reminderIsOverdue,
  reminderSubjectHref,
  reminderSubjectKindLabel,
  type PortalReminder,
  type ReminderSubjectKind,
} from "@/lib/data/crm-people";
import { employeeName, getPortalCustomerName } from "@/lib/data/portal";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useAppDispatch } from "@/store/hooks";
import { patchCustomerReminderStatus } from "@/store/customersSlice";
import { patchReminderStatus } from "@/store/remindersSlice";

/** Build GET /reminders query scoped to one record (subjectKind + subjectId). */
function subjectReminderQuery(kind: ReminderSubjectKind, id: string) {
  const base = {
    status: "open" as const,
    limit: 100,
    force: true,
    silent: true as const,
  };
  // Customer filter also covers legacy rows that only set customerId.
  if (kind === "customer") {
    return { ...base, customerId: id, subjectKind: kind, subjectId: id };
  }
  return { ...base, subjectKind: kind, subjectId: id };
}

function sortNewestFirst(items: PortalReminder[]) {
  return [...items].sort((a, b) => {
    const aAt = a.createdAt || "";
    const bAt = b.createdAt || "";
    if (aAt === bAt) return 0;
    return aAt < bAt ? 1 : -1;
  });
}

export function useReminderLookups() {
  const { customers, contractors, vendors } = useCrmDirectory();
  const { employees } = usePortalCrew();
  const { estimates, jobs, invoices, requests, provider } = usePortalWorkspace();
  const records = usePortalRecords();
  const allEstimates = records.mergeEstimates(estimates);
  const allJobs = records.mergeJobs(jobs);
  const allInvoices = records.mergeInvoices(invoices);

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
        case "invoice": {
          return allInvoices.find((item) => item.id === id)?.number ?? "Invoice";
        }
        default: {
          const _never: never = kind;
          return _never;
        }
      }
    },
    [allEstimates, allInvoices, allJobs, contractors, customers, employees, provider, requests, vendors],
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
        case "invoice":
          return allInvoices.map((item) => ({ id: item.id, label: item.number }));
        default: {
          const _never: never = kind;
          return _never;
        }
      }
    },
    [allEstimates, allInvoices, allJobs, contractors, customers, employees, requests, vendors],
  );

  return { label, options };
}

export function OpenReminderBanner({ kind, id }: { kind: ReminderSubjectKind; id: string }) {
  const dispatch = useAppDispatch();
  const crm = useCrmApiData();
  const { reminders: directoryReminders } = useCrmDirectory();
  const [scoped, setScoped] = useState<PortalReminder[] | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  // Always load open reminders for THIS record from the API (subjectKind + subjectId).
  // Re-fetch when directory reminders change so newly created ones appear immediately.
  const directoryKey = directoryReminders
    .filter((item) => item.status === "open" && !item.isArchived)
    .map((item) => item.id)
    .sort()
    .join("|");

  useEffect(() => {
    const recordId = String(id || "").trim();
    if (!recordId) {
      setScoped([]);
      return;
    }
    let cancelled = false;
    setScoped(null);
    void queryReminders(subjectReminderQuery(kind, recordId))
      .then((result) => {
        if (cancelled) return;
        // Client-side guard: only this subject, newest first.
        setScoped(openRemindersFor(result.items, kind, recordId));
      })
      .catch(() => {
        if (cancelled) return;
        // Fallback to directory cache filtered by the same subject.
        setScoped(openRemindersFor(directoryReminders, kind, recordId));
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- directoryReminders used via directoryKey
  }, [kind, id, directoryKey]);

  const open = sortNewestFirst(scoped ?? openRemindersFor(directoryReminders, kind, id));
  if (!open.length) return null;
  const overdue = open.some((item) => reminderIsOverdue(item));

  async function markDone(reminderId: string) {
    if (pendingId) return;
    setPendingId(reminderId);
    try {
      const updated =
        kind === "customer" && id
          ? await dispatch(
              patchCustomerReminderStatus({ id: reminderId, status: "done", customerId: id }),
            ).unwrap()
          : await dispatch(patchReminderStatus({ id: reminderId, status: "done" })).unwrap();
      if (updated) {
        crm.patchReminder(reminderId, updated);
      } else {
        crm.patchReminder(reminderId, { status: "done" });
      }
      setScoped((current) =>
        (current ?? open).filter((item) => item.id !== reminderId),
      );
      toast.success("Reminder marked done.");
    } catch (error) {
      toast.error(
        typeof error === "string"
          ? error
          : error instanceof Error
            ? error.message
            : "Could not update this reminder.",
      );
    } finally {
      setPendingId(null);
    }
  }

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
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 bg-white"
                  disabled={pendingId === item.id}
                  onClick={() => void markDone(item.id)}
                >
                  {pendingId === item.id ? "Saving…" : "Mark done"}
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
