"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { ListTodo } from "lucide-react";
import { OpenReminderBanner } from "@/components/portal/reminder-banner";
import { useCrmDirectory } from "@/components/portal/use-crm-directory";
import { Button } from "@/components/ui/button";
import {
  crmTaskPriorityLabel,
  crmTaskStatusLabel,
  openTasksFor,
  taskIsOverdue,
  type ReminderSubjectKind,
} from "@/lib/data/crm-people";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

export function OpenTaskBanner({ kind, id }: { kind: ReminderSubjectKind; id: string }) {
  const { tasks, setTaskStatus } = useCrmDirectory();
  const open = openTasksFor(tasks, kind, id);
  if (!open.length) return null;
  const overdue = open.some((item) => taskIsOverdue(item));
  const blocked = open.some((item) => item.status === "blocked");

  return (
    <div
      className={cn(
        "rounded-[4px] border px-4 py-3",
        overdue || blocked ? "border-red-300 bg-red-50 text-red-950" : "border-sky-300 bg-sky-50 text-sky-950",
      )}
    >
      <div className="flex items-start gap-3">
        <ListTodo className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">
            {open.length} open task{open.length === 1 ? "" : "s"}
            {overdue ? " · overdue" : blocked ? " · blocked" : ""}
          </p>
          <ul className="mt-2 space-y-1.5">
            {open.map((item) => (
              <li key={item.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                <Link href={`/pro/dashboard/tasks/${item.id}`} className="font-medium underline-offset-2 hover:underline">
                  {item.number} · {item.title}
                </Link>
                <span className={taskIsOverdue(item) ? "font-medium" : "opacity-80"}>
                  {crmTaskPriorityLabel(item.priority)} · {crmTaskStatusLabel(item.status)} · Due {formatDate(item.dueAt)}
                </span>
                <Button size="sm" variant="outline" className="h-7 bg-white" onClick={() => setTaskStatus(item.id, "done")}>
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

export function FileNotices({ kind, id, extra }: { kind: ReminderSubjectKind; id: string; extra?: ReactNode }) {
  return (
    <div className="space-y-2">
      <OpenReminderBanner kind={kind} id={id} />
      <OpenTaskBanner kind={kind} id={id} />
      {extra}
    </div>
  );
}
