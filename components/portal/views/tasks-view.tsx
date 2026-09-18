"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Ban,
  CheckCircle2,
  ChevronDown,
  Loader2,
  Pencil,
  Play,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { ArchiveBadge, ArchiveButton, archiveRowAction } from "@/components/portal/archive-control";
import { CreateTaskDialog } from "@/components/portal/create-person-dialogs";
import { DeleteConfirmDialog } from "@/components/portal/delete-confirm-dialog";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CenteredSpinner } from "@/components/ui/spinner";
import { deleteTask, getTask, updateTaskStatus } from "@/lib/api/crm-client";
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
  setTasksPriority,
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
  const searchParams = useSearchParams();
  const status = searchParams.get("status") ?? "";
  const priorityParam = searchParams.get("priority") ?? "";
  const archivedOnly = status === "archived";
  const overdueOnly = status === "overdue";

  const [open, setOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<PortalTask | null>(null);
  const [deletingTask, setDeletingTask] = useState<PortalTask | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [busyStatusRowIds, setBusyStatusRowIds] = useState<string[]>([]);
  const [priorityFilter, setPriorityFilter] = useState(priorityParam);

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
    setPriorityFilter(priorityParam);
  }, [priorityParam]);

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
          status: archivedOnly || overdueOnly ? undefined : (status || undefined),
          priority: priorityFilter || undefined,
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
  }, [dispatch, useApi, page, search, status, priorityFilter, archivedOnly, overdueOnly]);

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

  function onPriorityChange(val: string) {
    const next = val === "all" ? "" : val;
    setPriorityFilter(next);
    if (useApi) {
      setActionLoading(true);
      dispatch(setTasksPriority(next));
      dispatch(
        fetchTasks({
          page: 1,
          limit,
          status: archivedOnly || overdueOnly ? undefined : (status || undefined),
          priority: next || undefined,
          search,
        }),
      ).finally(() => setActionLoading(false));
    }
  }

  let rows = useApi
    ? items
    : records
        .listed("task", directoryTasks, archivedOnly)
        .filter((item) => archivedOnly || !status || item.status === status);

  if (overdueOnly) {
    rows = rows.filter((item) => taskIsOverdue(item) && item.status !== "done");
  }

  if (!useApi && priorityFilter) {
    rows = rows.filter((item) => item.priority === priorityFilter);
  }

  const tableLoading = actionLoading || (useApi ? loading && items.length === 0 : false);

  const handleUpdateStatus = async (row: PortalTask, nextStatus: CrmTaskStatus) => {
    setBusyStatusRowIds((prev) => [...prev, row.id]);
    try {
      await dispatch(patchTaskStatus({ id: row.id, status: nextStatus })).unwrap();
      toast.success(`Task status changed to ${crmTaskStatusLabel(nextStatus)}.`);
    } catch (err: unknown) {
      toast.error(typeof err === "string" ? err : "Failed to update task status.");
    } finally {
      setBusyStatusRowIds((prev) => prev.filter((id) => id !== row.id));
    }
  };

  const confirmDeleteTask = async () => {
    if (!deletingTask) return;
    setDeleteLoading(true);
    try {
      await dispatch(deleteTaskRecord(deletingTask.id)).unwrap();
      toast.success(`${deletingTask.number || "Task"} removed.`);
      setDeletingTask(null);
    } catch (err) {
      toast.error(typeof err === "string" ? err : "Failed to delete task.");
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <PortalPage
      eyebrow="Work / Tasks"
      title={`Tasks (${useApi ? (overdueOnly || priorityFilter ? rows.length : total) : rows.length})`}
      description="Office and field work linked to a customer, lead, job, estimate, employee, contractor, or vendor."
      actions={
        <Button size="sm" onClick={() => { setEditingTask(null); setOpen(true); }}>
          + Create task
        </Button>
      }
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <FilterTabs
          baseHref="/pro/dashboard/tasks"
          value={status}
          options={withArchiveFilter([
            { value: "", label: "All" },
            { value: "open", label: "Open" },
            { value: "in_progress", label: "In progress" },
            { value: "blocked", label: "Blocked" },
            { value: "done", label: "Done" },
            { value: "overdue", label: "Overdue" },
          ])}
        />
        <div className="flex items-center gap-2">
          <Select value={priorityFilter || "all"} onValueChange={onPriorityChange}>
            <SelectTrigger className="h-8 w-36 text-xs bg-card">
              <SelectValue placeholder="All priorities" />
            </SelectTrigger>
            <SelectContent align="end">
              <SelectItem value="all">All priorities</SelectItem>
              <SelectItem value="urgent">Urgent</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="normal">Normal</SelectItem>
              <SelectItem value="low">Low</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <PortalDataTable
        filename="tasks"
        countLabel="Tasks"
        searchPlaceholder="Search tasks by title, note, ID..."
        loading={tableLoading}
        busyRowIds={busyStatusRowIds}
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
          useApi && !overdueOnly
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
            cell: (row) => (
              <Link href={`/pro/dashboard/tasks/${row.id}`} className="font-semibold text-primary hover:underline">
                {row.number}
              </Link>
            ),
          },
          {
            id: "title",
            header: "Task",
            sortValue: (row) => row.title,
            searchValue: (row) => `${row.title} ${row.note}`,
            exportValue: (row) => row.title,
            cell: (row) => (
              <div>
                <Link href={`/pro/dashboard/tasks/${row.id}`} className="font-medium text-primary hover:underline">
                  {row.title}
                </Link>
                {row.note ? (
                  <p className="text-xs text-muted-foreground line-clamp-1">{row.note}</p>
                ) : null}
              </div>
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
              if (row.assignedEmployeeName) return row.assignedEmployeeName;
              const employee = employees.find((item) => item.id === row.assignedEmployeeId);
              return employee ? `${employee.lastName} ${employee.firstName}` : row.assignedContractorName || row.assignedVendorName || "";
            },
            searchValue: (row) => {
              if (row.assignedEmployeeName) return row.assignedEmployeeName;
              const employee = employees.find((item) => item.id === row.assignedEmployeeId);
              return employee ? `${employee.firstName} ${employee.lastName}` : row.assignedContractorName || row.assignedVendorName || "";
            },
            exportValue: (row) => {
              if (row.assignedEmployeeName) return row.assignedEmployeeName;
              const employee = employees.find((item) => item.id === row.assignedEmployeeId);
              return employee ? `${employee.firstName} ${employee.lastName}` : row.assignedContractorName || row.assignedVendorName || "";
            },
            cell: (row) => {
              if (row.assignedEmployeeName) return row.assignedEmployeeName;
              if (row.assignedEmployeeId) {
                const employee = employees.find((item) => item.id === row.assignedEmployeeId);
                if (employee) return `${employee.firstName} ${employee.lastName}`.trim();
              }
              if (row.assignedContractorName) return row.assignedContractorName;
              if (row.assignedVendorName) return row.assignedVendorName;
              return "Unassigned";
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
          {
            label: "Edit task",
            icon: <Pencil className="size-3.5" />,
            onSelect: () => {
              setEditingTask(row);
              setOpen(true);
            },
          },
          ...(row.status === "done"
            ? [
                {
                  label: "Reopen",
                  icon: <RotateCcw className="size-3.5" />,
                  onSelect: () => handleUpdateStatus(row, "open"),
                },
              ]
            : row.status === "in_progress"
              ? [
                  {
                    label: "Mark done",
                    icon: <CheckCircle2 className="size-3.5" />,
                    onSelect: () => handleUpdateStatus(row, "done"),
                  },
                  {
                    label: "Block",
                    icon: <Ban className="size-3.5" />,
                    onSelect: () => handleUpdateStatus(row, "blocked"),
                  },
                  {
                    label: "Reset to open",
                    icon: <RotateCcw className="size-3.5" />,
                    onSelect: () => handleUpdateStatus(row, "open"),
                  },
                ]
              : row.status === "blocked"
                ? [
                    {
                      label: "Unblock & Start",
                      icon: <Play className="size-3.5" />,
                      onSelect: () => handleUpdateStatus(row, "in_progress"),
                    },
                    {
                      label: "Mark open",
                      icon: <RotateCcw className="size-3.5" />,
                      onSelect: () => handleUpdateStatus(row, "open"),
                    },
                    {
                      label: "Mark done",
                      icon: <CheckCircle2 className="size-3.5" />,
                      onSelect: () => handleUpdateStatus(row, "done"),
                    },
                  ]
                : [
                    {
                      label: "Start",
                      icon: <Play className="size-3.5" />,
                      onSelect: () => handleUpdateStatus(row, "in_progress"),
                    },
                    {
                      label: "Block",
                      icon: <Ban className="size-3.5" />,
                      onSelect: () => handleUpdateStatus(row, "blocked"),
                    },
                    {
                      label: "Mark done",
                      icon: <CheckCircle2 className="size-3.5" />,
                      onSelect: () => handleUpdateStatus(row, "done"),
                    },
                  ]),
          archiveRowAction(records, "task", row.id, row.number),
          {
            label: "Delete",
            variant: "destructive",
            icon: <Trash2 className="size-3.5" />,
            onSelect: () => setDeletingTask(row),
          },
        ]}
      />
      <CreateTaskDialog
        open={open}
        task={editingTask}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setEditingTask(null);
        }}
        onCreated={() => {
          if (useApi) {
            void dispatch(
              fetchTasks({
                page,
                limit,
                status: archivedOnly || overdueOnly ? undefined : (status || undefined),
                priority: priorityFilter || undefined,
                search,
              }),
            );
          }
        }}
      />
      <DeleteConfirmDialog
        open={Boolean(deletingTask)}
        onOpenChange={(next) => {
          if (!next) setDeletingTask(null);
        }}
        title="Delete Task"
        description={`Are you sure you want to delete "${deletingTask?.number ? `${deletingTask.number} · ${deletingTask.title}` : deletingTask?.title}"? This action cannot be undone.`}
        loading={deleteLoading}
        onConfirm={confirmDeleteTask}
      />
    </PortalPage>
  );
}

export function TaskDetailView({ id }: { id: string }) {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const auth = useAppSelector(selectAuth);
  const user = useAppSelector(selectAuthUser);
  const useApi =
    auth.hydrated &&
    Boolean(auth.token) &&
    (user?.role === "provider" || auth.role === "provider");

  const { tasks, employees, setTaskStatus, remove } = useCrmDirectory();
  const lookups = useReminderLookups();
  const [fetched, setFetched] = useState<PortalTask | null>(null);
  const [fetching, setFetching] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [statusUpdating, setStatusUpdating] = useState(false);

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
    // GET /api/provider/tasks/:id
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
    if (statusUpdating) return;
    setStatusUpdating(true);
    setFetched((prev) => (prev ? { ...prev, status: nextStatus } : prev));
    try {
      const updated = await dispatch(patchTaskStatus({ id: task.id, status: nextStatus })).unwrap();
      setFetched(updated);
      toast.success(`Task status updated to ${crmTaskStatusLabel(nextStatus)}.`);
    } catch (err) {
      toast.error(typeof err === "string" ? err : err instanceof Error ? err.message : "Failed to update task status.");
    } finally {
      setStatusUpdating(false);
    }
  };

  const handleDelete = async () => {
    if (deleting) return;
    setDeleting(true);
    try {
      await dispatch(deleteTaskRecord(task.id)).unwrap();
      toast.success(`${task.number} deleted.`);
      router.push("/pro/dashboard/tasks");
    } catch (err) {
      toast.error(typeof err === "string" ? err : err instanceof Error ? err.message : "Failed to delete task.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
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
            <Button asChild variant="outline" size="sm">
              <Link href="/pro/dashboard/tasks">Back</Link>
            </Button>
            <Button size="sm" variant="outline" onClick={() => setEditOpen(true)} className="gap-1.5">
              <Pencil className="size-3.5" />
              Edit
            </Button>
            {task.status === "done" ? (
              <Button size="sm" variant="outline" onClick={() => void handleSetStatus("open")} disabled={statusUpdating} className="gap-1.5">
                {statusUpdating ? <Loader2 className="size-3.5 animate-spin mr-1" /> : <RotateCcw className="size-3.5" />}
                Reopen
              </Button>
            ) : task.status === "in_progress" ? (
              <>
                <Button size="sm" variant="outline" onClick={() => void handleSetStatus("blocked")} disabled={statusUpdating} className="gap-1.5 text-red-600 hover:text-red-700">
                  <Ban className="size-3.5" />
                  Block
                </Button>
                <Button size="sm" onClick={() => void handleSetStatus("done")} disabled={statusUpdating} className="gap-1.5">
                  {statusUpdating ? <Loader2 className="size-3.5 animate-spin mr-1" /> : <CheckCircle2 className="size-3.5" />}
                  Mark done
                </Button>
              </>
            ) : task.status === "blocked" ? (
              <>
                <Button size="sm" variant="outline" onClick={() => void handleSetStatus("in_progress")} disabled={statusUpdating} className="gap-1.5">
                  {statusUpdating ? <Loader2 className="size-3.5 animate-spin mr-1" /> : <Play className="size-3.5" />}
                  Unblock & Start
                </Button>
                <Button size="sm" onClick={() => void handleSetStatus("done")} disabled={statusUpdating} className="gap-1.5">
                  <CheckCircle2 className="size-3.5" />
                  Mark done
                </Button>
              </>
            ) : (
              <>
                <Button size="sm" variant="outline" onClick={() => void handleSetStatus("in_progress")} disabled={statusUpdating} className="gap-1.5">
                  {statusUpdating ? <Loader2 className="size-3.5 animate-spin mr-1" /> : <Play className="size-3.5" />}
                  Start
                </Button>
                <Button size="sm" variant="outline" onClick={() => void handleSetStatus("blocked")} disabled={statusUpdating} className="gap-1.5 text-red-600 hover:text-red-700">
                  <Ban className="size-3.5" />
                  Block
                </Button>
                <Button size="sm" onClick={() => void handleSetStatus("done")} disabled={statusUpdating} className="gap-1.5">
                  <CheckCircle2 className="size-3.5" />
                  Mark done
                </Button>
              </>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1">
                  More
                  <ChevronDown className="size-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40">
                <ArchiveButton kind="task" id={task.id} label={task.number} />
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="cursor-pointer text-xs text-red-600 focus:text-red-600"
                  onSelect={() => setDeleteOpen(true)}
                >
                  <Trash2 className="size-3.5 mr-2" />
                  Delete task
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
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
                <div className="mt-1">
                  <ReminderSubjectLink kind={subject.kind} id={subject.id} name={linkedName} />
                </div>
                <p className="mt-3 text-muted-foreground text-xs">
                  Tasks linked to this {reminderSubjectKindLabel(subject.kind).toLowerCase()} also show on its detail workspace.
                </p>
              </div>
            );
          }
          return (
            <div className="grid gap-4 text-sm sm:grid-cols-2">
              <Fact label="Priority" value={crmTaskPriorityLabel(task.priority)} />
              <Fact label="Status" value={overdue ? "Overdue" : crmTaskStatusLabel(task.status)} />
              <Fact
                label="Assigned"
                value={
                  task.assignedEmployeeName ||
                  (employee ? `${employee.firstName} ${employee.lastName}`.trim() : "") ||
                  task.assignedContractorName ||
                  task.assignedVendorName ||
                  "—"
                }
              />
              <Fact
                label="Due Date"
                value={task.dueAt ? formatDate(task.dueAt) : "No due date"}
              />
              <Fact
                label="Linked to"
                value={subject.id ? `${reminderSubjectKindLabel(subject.kind)} · ${linkedName}` : "—"}
              />
              <Fact label="Created" value={formatDate(task.createdAt)} />
              <div className="sm:col-span-2">
                <Fact label="Notes" value={task.note || "No notes"} />
              </div>
            </div>
          );
        }}
      </RecordWorkspace>

      <CreateTaskDialog
        open={editOpen}
        task={task}
        onOpenChange={setEditOpen}
        onCreated={(updated) => {
          setFetched(updated);
        }}
      />

      <DeleteConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete Task"
        description={`Are you sure you want to delete "${task.number} · ${task.title}"? This action cannot be undone.`}
        loading={deleting}
        onConfirm={handleDelete}
      />
    </>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border/60 bg-muted/20 p-3">
      <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">{label}</p>
      <p className="mt-1 font-medium">{value}</p>
    </div>
  );
}

