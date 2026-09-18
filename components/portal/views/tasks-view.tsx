"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { ArchiveBadge, ArchiveButton, archiveRowAction } from "@/components/portal/archive-control";
import { CreateTaskDialog } from "@/components/portal/create-person-dialogs";
import { FilterTabs } from "@/components/portal/filter-tabs";
import { PortalDataTable } from "@/components/portal/portal-data-table";
import { PortalPage } from "@/components/portal/portal-page";
import { RecordWorkspace } from "@/components/portal/record-workspace";
import { ReminderSubjectLink, useReminderLookups } from "@/components/portal/reminder-banner";
import { StatusPill } from "@/components/portal/status-pill";
import { useCrmApiData } from "@/components/portal/use-crm-api-data";
import { useCrmDirectory } from "@/components/portal/use-crm-directory";
import { usePortalCrew } from "@/components/portal/use-portal-crew";
import { usePortalRecords } from "@/components/portal/use-portal-records";
import { Button } from "@/components/ui/button";
import { CenteredSpinner } from "@/components/ui/spinner";
import { getTask } from "@/lib/api/crm-client";
import {
  crmTaskPriorityLabel,
  crmTaskStatusLabel,
  reminderSubjectKindLabel,
  taskIsOverdue,
  taskSubject,
  type CrmTaskStatus,
  type PortalTask,
} from "@/lib/data/crm-people";
import { withArchiveFilter } from "@/lib/data/portal";
import { formatDate } from "@/lib/format";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { selectAuth, selectAuthUser } from "@/store/authSlice";
import {
  clearTasksError,
  deleteTaskRecord,
  fetchTasks,
  patchTaskStatus,
  setTasksPage,
  setTasksSearch,
  TASKS_DEFAULT_LIMIT,
} from "@/store/tasksSlice";
import { fetchTeam } from "@/store/teamSlice";

const SEARCH_DEBOUNCE_MS = 350;

function priorityTone(priority: string) {
  switch (priority) {
    case "urgent":
      return "danger" as const;
    case "high":
      return "warning" as const;
    case "low":
      return "neutral" as const;
    default:
      return "primary" as const;
  }
}

function statusTone(status: CrmTaskStatus) {
  switch (status) {
    case "done":
      return "success" as const;
    case "blocked":
      return "danger" as const;
    case "in_progress":
      return "warning" as const;
    case "open":
      return "primary" as const;
    default: {
      const _never: never = status;
      return _never;
    }
  }
}

export function TasksView() {
  const dispatch = useAppDispatch();
  const auth = useAppSelector(selectAuth);
  const user = useAppSelector(selectAuthUser);
  const useApi =
    auth.hydrated &&
    Boolean(auth.token) &&
    (user?.role === "provider" || auth.role === "provider");

  const crm = useCrmApiData();
  const { tasks: directoryTasks, employees: directoryEmployees, remove, setTaskStatus } = useCrmDirectory();
  const { employees: crewEmployees } = usePortalCrew();
  const teamItems = useAppSelector((state) => state.team?.items ?? []);
  const employees = useApi && teamItems.length > 0 ? teamItems : crewEmployees.length > 0 ? crewEmployees : directoryEmployees;
  const lookups = useReminderLookups();
  const records = usePortalRecords();
  const status = useSearchParams().get("status") ?? "";
  const archivedOnly = status === "archived";
  const [open, setOpen] = useState(false);

  const slice = useAppSelector((state) => state.tasks);
  const {
    items,
    page,
    limit,
    total,
    totalPages,
    search,
    loading,
    error,
  } = slice ?? {
    items: [],
    page: 1,
    limit: TASKS_DEFAULT_LIMIT,
    total: 0,
    totalPages: 1,
    search: "",
    loading: true,
    error: null,
  };

  const [searchInput, setSearchInput] = useState(search);
  const [actionLoading, setActionLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setSearchInput(search);
  }, [search]);

  useEffect(() => {
    if (crm.enabled && !crm.ready) {
      void crm.ensureLoaded();
    }
  }, [crm.enabled, crm.ready, crm.ensureLoaded]);

  useEffect(() => {
    if (!useApi) return;
    let cancelled = false;
    setActionLoading(true);
    void Promise.all([
      dispatch(
        fetchTasks({
          page,
          limit,
          status: archivedOnly ? undefined : status,
          search,
        }),
      ),
      dispatch(fetchTeam()),
    ]).finally(() => {
      if (!cancelled) setActionLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [dispatch, useApi, page, search, status, archivedOnly]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  useEffect(() => {
    if (!useApi || !error || loading) return;
    toast.error(error);
    dispatch(clearTasksError());
  }, [dispatch, error, loading, useApi]);

  function onSearchChange(value: string) {
    setSearchInput(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setActionLoading(true);
      dispatch(setTasksSearch(value.trim()));
    }, SEARCH_DEBOUNCE_MS);
  }

  function onPageChange(nextPage: number) {
    if (nextPage === page) return;
    setActionLoading(true);
    dispatch(setTasksPage(nextPage));
  }

  const rows = useApi
    ? items
    : records
        .listed("task", directoryTasks, archivedOnly)
        .filter((item) => archivedOnly || !status || item.status === status);

  const tableLoading = actionLoading || (useApi ? loading && items.length === 0 : false);

  return (
    <PortalPage
      eyebrow="Work / Tasks"
      title={`Tasks (${useApi ? total : rows.length})`}
      description="Office and field work linked to a customer, lead, job, estimate, employee, contractor, or vendor."
      actions={
        <Button size="sm" onClick={() => setOpen(true)}>
          + Create task
        </Button>
      }
    >
      <FilterTabs
        baseHref="/pro/dashboard/tasks"
        value={status}
        options={withArchiveFilter([
          { value: "", label: "All" },
          { value: "open", label: "Open" },
          { value: "in_progress", label: "In progress" },
          { value: "done", label: "Done" },
          { value: "blocked", label: "Blocked" },
        ])}
      />
      <PortalDataTable
        filename="tasks"
        countLabel="Tasks"
        searchPlaceholder="Search tasks"
        loading={tableLoading}
        rows={rows}
        rowKey={(row) => row.id}
        rowHref={(row) => `/pro/dashboard/tasks/${row.id}`}
        pageSize={limit}
        empty={
          search
            ? "No tasks match this search."
            : "No tasks yet. Create your first task."
        }
        serverPagination={
          useApi
            ? {
                page,
                pageSize: limit,
                total,
                totalPages,
                onPageChange,
                search: searchInput,
                onSearchChange,
              }
            : undefined
        }
        columns={[
          {
            id: "number",
            header: "ID",
            sortValue: (row) => row.number,
            searchValue: (row) => row.number,
            exportValue: (row) => row.number,
            cell: (row) => row.number,
          },
          {
            id: "title",
            header: "Task",
            sortValue: (row) => row.title,
            searchValue: (row) => `${row.title} ${row.note}`,
            exportValue: (row) => row.title,
            cell: (row) => (
              <Link href={`/pro/dashboard/tasks/${row.id}`} className="font-medium text-primary hover:underline">
                {row.title}
              </Link>
            ),
          },
          {
            id: "linked",
            header: "Linked to",
            sortValue: (row) => {
              const subject = taskSubject(row);
              return `${reminderSubjectKindLabel(subject.kind)} ${lookups.label(subject.kind, subject.id)}`;
            },
            searchValue: (row) => {
              const subject = taskSubject(row);
              return `${reminderSubjectKindLabel(subject.kind)} ${lookups.label(subject.kind, subject.id)}`;
            },
            exportValue: (row) => {
              const subject = taskSubject(row);
              return `${reminderSubjectKindLabel(subject.kind)} · ${lookups.label(subject.kind, subject.id)}`;
            },
            cell: (row) => {
              const subject = taskSubject(row);
              if (!subject.id) return "—";
              return (
                <ReminderSubjectLink
                  kind={subject.kind}
                  id={subject.id}
                  name={lookups.label(subject.kind, subject.id)}
                />
              );
            },
          },
          {
            id: "assigned",
            header: "Assigned",
            sortValue: (row) => {
              const employee = employees.find((item) => item.id === row.assignedEmployeeId);
              return employee ? `${employee.lastName} ${employee.firstName}` : "";
            },
            searchValue: (row) => {
              const employee = employees.find((item) => item.id === row.assignedEmployeeId);
              return employee ? `${employee.firstName} ${employee.lastName}` : "";
            },
            exportValue: (row) => {
              const employee = employees.find((item) => item.id === row.assignedEmployeeId);
              return employee ? `${employee.firstName} ${employee.lastName}` : "";
            },
            cell: (row) => {
              const employee = employees.find((item) => item.id === row.assignedEmployeeId);
              return employee ? `${employee.firstName} ${employee.lastName}` : "—";
            },
          },
          {
            id: "priority",
            header: "Priority",
            sortValue: (row) => row.priority,
            searchValue: (row) => crmTaskPriorityLabel(row.priority),
            exportValue: (row) => crmTaskPriorityLabel(row.priority),
            cell: (row) => <StatusPill label={crmTaskPriorityLabel(row.priority)} tone={priorityTone(row.priority)} />,
          },
          {
            id: "due",
            header: "Due",
            sortValue: (row) => row.dueAt,
            searchValue: (row) => formatDate(row.dueAt),
            exportValue: (row) => formatDate(row.dueAt),
            cell: (row) => formatDate(row.dueAt),
          },
          {
            id: "status",
            header: "Status",
            sortValue: (row) => row.status,
            searchValue: (row) => crmTaskStatusLabel(row.status),
            exportValue: (row) => crmTaskStatusLabel(row.status),
            cell: (row) => (
              <StatusPill
                label={taskIsOverdue(row) ? "Overdue" : crmTaskStatusLabel(row.status)}
                tone={taskIsOverdue(row) ? "danger" : statusTone(row.status)}
              />
            ),
          },
        ]}
        actions={(row) => [
          { label: "Open file", href: `/pro/dashboard/tasks/${row.id}` },
          ...(row.status === "done"
            ? [
                {
                  label: "Reopen",
                  onSelect: () => {
                    if (useApi) {
                      void dispatch(patchTaskStatus({ id: row.id, status: "open" }))
                        .unwrap()
                        .then(() => toast.success("Task reopened."))
                        .catch((err: string) => toast.error(err));
                      return;
                    }
                    void setTaskStatus(row.id, "open");
                  },
                },
              ]
            : [
                {
                  label: "Start",
                  onSelect: () => {
                    if (useApi) {
                      void dispatch(patchTaskStatus({ id: row.id, status: "in_progress" }))
                        .unwrap()
                        .then(() => toast.success("Task marked in progress."))
                        .catch((err: string) => toast.error(err));
                      return;
                    }
                    void setTaskStatus(row.id, "in_progress");
                  },
                },
                {
                  label: "Mark done",
                  onSelect: () => {
                    if (useApi) {
                      void dispatch(patchTaskStatus({ id: row.id, status: "done" }))
                        .unwrap()
                        .then(() => toast.success("Task marked done."))
                        .catch((err: string) => toast.error(err));
                      return;
                    }
                    void setTaskStatus(row.id, "done");
                  },
                },
              ]),
          archiveRowAction(records, "task", row.id, row.number),
          {
            label: "Delete",
            variant: "destructive",
            onSelect: () => {
              if (useApi) {
                void dispatch(deleteTaskRecord(row.id))
                  .unwrap()
                  .then(() => toast.success(`${row.number} removed.`))
                  .catch((err: string) => toast.error(err));
                return;
              }
              remove("task", row.id);
              toast.success(`${row.number} removed.`);
            },
          },
        ]}
      />
      <CreateTaskDialog open={open} onOpenChange={setOpen} />
    </PortalPage>
  );
}

export function TaskDetailView({ id }: { id: string }) {
  const { tasks, employees, setTaskStatus } = useCrmDirectory();
  const lookups = useReminderLookups();
  const [fetched, setFetched] = useState<PortalTask | null>(null);
  const [fetching, setFetching] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const listed = tasks.find((item) => item.id === id);
  const task = fetched ?? listed;

  useEffect(() => {
    setFetched(null);
    setFetchError(null);
    setFetching(true);
  }, [id]);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setFetching(true);
    setFetchError(null);
    // MD / CRM: GET /api/provider/tasks/:id
    void getTask(id)
      .then((item) => {
        if (cancelled) return;
        if (!item) {
          setFetched(null);
          setFetchError("Task not found");
          return;
        }
        setFetched(item);
      })
      .catch((error) => {
        if (cancelled) return;
        setFetched(null);
        setFetchError(
          error instanceof Error && error.message
            ? error.message
            : "Could not load this task.",
        );
      })
      .finally(() => {
        if (!cancelled) setFetching(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (!task) {
    if (fetching) {
      return (
        <div className="border border-black/15 bg-card" aria-busy="true">
          <CenteredSpinner className="min-h-[22rem]" />
        </div>
      );
    }
    return (
      <div className="border border-black/15 bg-card p-6">
        <h1 className="text-lg font-semibold">{fetchError || "Task not found"}</h1>
        <Button asChild className="mt-4" size="sm">
          <Link href="/pro/dashboard/tasks">Back to tasks</Link>
        </Button>
      </div>
    );
  }

  const employee = employees.find((item) => item.id === task.assignedEmployeeId);
  const subject = taskSubject(task);
  const linkedName = subject.id ? lookups.label(subject.kind, subject.id) : "";
  const overdue = taskIsOverdue(task);

  const handleSetStatus = async (nextStatus: PortalTask["status"]) => {
    setFetched((prev) => (prev ? { ...prev, status: nextStatus } : prev));
    try {
      await setTaskStatus(task.id, nextStatus);
      toast.success(`Task status updated to ${crmTaskStatusLabel(nextStatus)}.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update task status.");
    }
  };

  return (
    <RecordWorkspace
      href={`/pro/dashboard/tasks/${task.id}`}
      label={`${task.number} · ${task.title}`}
      kind="task"
      tabs={[
        { id: "profile", label: "Details" },
        { id: "linked", label: "Linked record" },
      ]}
      badge={
        <>
          <StatusPill label={crmTaskPriorityLabel(task.priority)} tone={priorityTone(task.priority)} />
          <StatusPill
            label={overdue ? "Overdue" : crmTaskStatusLabel(task.status)}
            tone={overdue ? "danger" : statusTone(task.status)}
          />
          <ArchiveBadge kind="task" id={task.id} />
        </>
      }
      actions={
        <>
          {task.status === "done" ? (
            <Button size="sm" variant="outline" onClick={() => void handleSetStatus("open")}>
              Reopen
            </Button>
          ) : (
            <>
              {task.status === "open" ? (
                <Button size="sm" variant="outline" onClick={() => void handleSetStatus("in_progress")}>
                  Start
                </Button>
              ) : null}
              {task.status === "blocked" ? null : (
                <Button size="sm" variant="outline" onClick={() => void handleSetStatus("blocked")}>
                  Block
                </Button>
              )}
              <Button size="sm" onClick={() => void handleSetStatus("done")}>
                Mark done
              </Button>
            </>
          )}
          <ArchiveButton kind="task" id={task.id} label={task.number} />
        </>
      }
    >
      {(tab) => {
        if (tab === "linked") {
          if (!subject.id) {
            return <p className="text-sm text-muted-foreground">This task is not linked to another record.</p>;
          }
          return (
            <div className="text-sm">
              <p className="text-[11px] font-medium tracking-[0.12em] text-muted-foreground uppercase">
                {reminderSubjectKindLabel(subject.kind)}
              </p>
              <ReminderSubjectLink kind={subject.kind} id={subject.id} name={linkedName} />
              <p className="mt-2 text-muted-foreground">
                Open tasks also appear on that file so the desk sees the work still sitting there.
              </p>
            </div>
          );
        }
        return (
          <div className="grid gap-3 text-sm sm:grid-cols-2">
            <Fact label="Priority" value={crmTaskPriorityLabel(task.priority)} />
            <Fact label="Status" value={overdue ? "Overdue" : crmTaskStatusLabel(task.status)} />
            <Fact label="Due" value={formatDate(task.dueAt)} />
            <Fact label="Assigned" value={employee ? `${employee.firstName} ${employee.lastName}` : "—"} />
            <Fact
              label="Linked to"
              value={subject.id ? `${reminderSubjectKindLabel(subject.kind)} · ${linkedName}` : "—"}
            />
            <Fact label="Created" value={formatDate(task.createdAt)} />
            <div className="sm:col-span-2">
              <Fact label="Notes" value={task.note || "—"} />
            </div>
          </div>
        );
      }}
    </RecordWorkspace>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">{label}</p>
      <p className="mt-0.5">{value}</p>
    </div>
  );
}
