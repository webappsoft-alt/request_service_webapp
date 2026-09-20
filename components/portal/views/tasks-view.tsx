"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Ban,
  Building2,
  Calendar,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ExternalLink,
  FileText,
  Globe,
  Link2,
  Loader2,
  Mail,
  MapPin,
  NotebookPen,
  Pencil,
  Phone,
  Play,
  RotateCcw,
  Shield,
  Tag,
  Trash2,
  UserRound,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { ArchiveBadge, ArchiveButton, archiveRowAction } from "@/components/portal/archive-control";
import { CreateTaskDialog } from "@/components/portal/create-person-dialogs";
import { DeleteConfirmDialog } from "@/components/portal/delete-confirm-dialog";
import { CrmMark } from "@/components/portal/crm-mark";
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
  DropdownMenuLabel,
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
import {
  deleteTask,
  getCustomerDetail,
  getEstimate,
  getJob,
  getRequest,
  getTask,
  updateTaskStatus,
} from "@/lib/api/crm-client";
import {
  crmCustomerName,
  crmSourceLabel,
  crmTaskPriorityLabel,
  crmTaskStatusLabel,
  crmTypeLabel,
  reminderSubjectKindLabel,
  taskIsOverdue,
  taskSubject,
  type CrmTaskStatus,
  type CustomerDossier,
  type PortalCustomerCrm,
  type PortalTask,
} from "@/lib/data/crm-people";
import { jobStatusLabel, withArchiveFilter, type PortalRequest } from "@/lib/data/portal";
import { formatDate, formatLocation, formatMoney } from "@/lib/format";
import type { Estimate, Job } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { selectAuth, selectAuthUser } from "@/store/authSlice";
import {
  clearTasksError,
  deleteTaskRecord,
  fetchTaskDetail,
  fetchTasks,
  patchTaskStatus,
  setTasksPage,
  setTasksPriority,
  setTasksSearch,
  tasksCacheKey,
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

  const router = useRouter();
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
    if (useApi && teamItems.length === 0) {
      void dispatch(fetchTeam());
    }
  }, [dispatch, useApi, teamItems.length]);

  const lastFetchedKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!useApi) return;
    let cancelled = false;

    const apiStatus = archivedOnly || overdueOnly ? "" : status;
    const apiPriority = priorityFilter || "";
    const currentKey = tasksCacheKey(
      search,
      apiStatus,
      apiPriority,
      "",
      "",
      page,
      limit,
    );

    // Guard: strictly fetch once per unique search, filter, and page combination
    if (lastFetchedKeyRef.current === currentKey) {
      setActionLoading(false);
      return;
    }
    lastFetchedKeyRef.current = currentKey;

    void dispatch(
      fetchTasks({
        page,
        limit,
        status: apiStatus,
        priority: apiPriority,
        search,
      }),
    ).finally(() => {
      if (!cancelled) setActionLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [dispatch, useApi, page, search, status, priorityFilter, archivedOnly, overdueOnly, limit]);

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
      const trimmed = value.trim();
      const apiStatus = archivedOnly || overdueOnly ? "" : status;
      const key = tasksCacheKey(trimmed, apiStatus, priorityFilter || "", "", "", 1, limit);
      const isCached = key in (slice?.pagesCache ?? {}) && (slice?.pagesCache?.[key]?.length ?? 0) > 0;
      if (!isCached) {
        setActionLoading(true);
      }
      dispatch(setTasksSearch(trimmed));
    }, SEARCH_DEBOUNCE_MS);
  }

  function onPageChange(nextPage: number) {
    if (nextPage === page) return;
    setActionLoading(true);
    dispatch(setTasksPage(nextPage));
  }

  const buildStatusHref = (statusVal: string) => {
    const params = new URLSearchParams();
    if (statusVal) params.set("status", statusVal);
    if (priorityFilter) params.set("priority", priorityFilter);
    const q = params.toString();
    return q ? `/pro/dashboard/tasks?${q}` : "/pro/dashboard/tasks";
  };

  function onPriorityChange(val: string) {
    const next = val === "all" ? "" : val;
    setPriorityFilter(next);
    const params = new URLSearchParams(searchParams.toString());
    if (next) {
      params.set("priority", next);
    } else {
      params.delete("priority");
    }
    const query = params.toString();
    router.replace(query ? `/pro/dashboard/tasks?${query}` : "/pro/dashboard/tasks");

    if (useApi) {
      dispatch(setTasksPriority(next));
    }
  }

  const apiStatus = archivedOnly || overdueOnly ? "" : status;
  const currentKey = tasksCacheKey(
    search,
    apiStatus,
    priorityFilter || "",
    "",
    "",
    page,
    limit,
  );
  const cachedRows = slice?.pagesCache?.[currentKey];
  const sameView =
    slice?.status === apiStatus &&
    slice?.priority === (priorityFilter || "") &&
    slice?.search === search;

  const activeItems = sameView
    ? items
    : cachedRows && cachedRows.length > 0
      ? cachedRows
      : [];

  let rows = useApi
    ? records.listed("task", activeItems, archivedOnly)
    : records
        .listed("task", directoryTasks, archivedOnly)
        .filter((item) => archivedOnly || !status || item.status === status);

  if (overdueOnly) {
    rows = rows.filter((item) => taskIsOverdue(item) && item.status !== "done");
  }

  if (priorityFilter && rows.some((item) => item.priority !== priorityFilter)) {
    rows = rows.filter((item) => item.priority === priorityFilter);
  }

  // Notes/Customer pattern:
  // If data exists, show it immediately without loading (revalidate in background).
  // If data is blank/null/0 items, show loading spinner while API is in-flight.
  const tableLoading =
    actionLoading ||
    (useApi
      ? sameView
        ? loading && activeItems.length === 0
        : !(cachedRows && cachedRows.length > 0)
      : false);

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

  const displayTotal = useApi
    ? overdueOnly || priorityFilter
      ? rows.length
      : sameView
        ? total
        : (cachedRows?.length ?? 0)
    : rows.length;

  return (
    <PortalPage
      eyebrow="Work / Tasks"
      title={`Tasks (${displayTotal})`}
      description="Office and field work linked to a customer, lead, job, estimate, employee, contractor, or vendor."
      actions={
        <Button size="sm" onClick={() => { setEditingTask(null); setOpen(true); }}>
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
          { value: "blocked", label: "Blocked" },
          { value: "done", label: "Done" },
          { value: "overdue", label: "Overdue" },
        ]).map((opt) => ({
          ...opt,
          href: buildStatusHref(opt.value),
        }))}
      />

      <PortalDataTable
        filename="tasks"
        countLabel="Tasks"
        searchPlaceholder="Search tasks by title, note, ID..."
        toolbar={
          <div className="h-8.5 w-36 sm:w-40 flex items-center">
            <Select
              disabled={tableLoading}
              value={priorityFilter || "all"}
              onValueChange={onPriorityChange}
            >
              <SelectTrigger
                size="sm"
                className="!h-8.5 h-8.5 data-[size=sm]:!h-8.5 data-[size=default]:!h-8.5 w-full text-xs bg-card"
              >
                <SelectValue placeholder="All priorities" />
              </SelectTrigger>
              <SelectContent position="popper" align="end" className="z-[100] min-w-[140px]">
                <SelectItem value="all">All priorities</SelectItem>
                <SelectItem value="urgent">Urgent</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="normal">Normal</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>
          </div>
        }
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
            className: "w-24 whitespace-nowrap font-medium",
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
            className: "min-w-[180px] max-w-[320px]",
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
            className: "whitespace-nowrap",
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
            className: "whitespace-nowrap",
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
            className: "whitespace-nowrap",
            sortValue: (row) => row.priority,
            searchValue: (row) => crmTaskPriorityLabel(row.priority),
            exportValue: (row) => crmTaskPriorityLabel(row.priority),
            cell: (row) => <StatusPill label={crmTaskPriorityLabel(row.priority)} tone={priorityTone(row.priority)} />,
          },
          {
            id: "due",
            header: "Due",
            className: "whitespace-nowrap",
            sortValue: (row) => row.dueAt,
            searchValue: (row) => formatDate(row.dueAt),
            exportValue: (row) => formatDate(row.dueAt),
            cell: (row) => formatDate(row.dueAt),
          },
          {
            id: "status",
            header: "Status",
            className: "whitespace-nowrap",
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
            const apiStatus = archivedOnly || overdueOnly ? "" : status;
            const apiPriority = priorityFilter || "";
            void dispatch(
              fetchTasks({
                page,
                limit,
                status: apiStatus,
                priority: apiPriority,
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

  const { tasks, employees } = useCrmDirectory();
  const lookups = useReminderLookups();
  const records = usePortalRecords();

  const cachedTask = useAppSelector(
    (state) => state.tasks?.detailsCache?.[id] || state.tasks?.items?.find((item) => item.id === id),
  );
  const listed = tasks.find((item) => item.id === id);

  const [fetched, setFetched] = useState<PortalTask | null>(cachedTask ?? listed ?? null);
  const [fetching, setFetching] = useState(!cachedTask && !listed);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [statusUpdating, setStatusUpdating] = useState(false);

  // Linked record states
  const customerItems = useAppSelector((state) => state.customers?.items);
  const [linkedCustomer, setLinkedCustomer] = useState<PortalCustomerCrm | null>(null);
  const [customerDossier, setCustomerDossier] = useState<CustomerDossier | null>(null);
  const [linkedJob, setLinkedJob] = useState<Job | null>(null);
  const [linkedRequest, setLinkedRequest] = useState<PortalRequest | null>(null);
  const [linkedEstimate, setLinkedEstimate] = useState<Estimate | null>(null);
  const [linkedLoading, setLinkedLoading] = useState(false);

  const task = fetched ?? cachedTask ?? listed;

  // Single-fetch guard ref for task detail (prevents infinite loop)
  const lastFetchedIdRef = useRef<string | null>(null);

  // Revalidate task detail in the background (stale-while-revalidate)
  useEffect(() => {
    if (!id) return;
    if (lastFetchedIdRef.current === id) return;
    lastFetchedIdRef.current = id;

    let cancelled = false;
    if (!cachedTask && !listed) setFetching(true);
    setFetchError(null);

    void dispatch(fetchTaskDetail(id))
      .unwrap()
      .then((item) => {
        if (cancelled) return;
        setFetched(item);
      })
      .catch((error) => {
        if (cancelled) return;
        if (!cachedTask && !listed) {
          setFetchError(typeof error === "string" ? error : "Could not load this task.");
        }
      })
      .finally(() => {
        if (!cancelled) setFetching(false);
      });

    return () => {
      cancelled = true;
    };
  }, [dispatch, id]);

  const subject = task ? taskSubject(task) : { kind: "customer" as const, id: "" };
  const linkedName = subject.id ? lookups.label(subject.kind, subject.id) : "";

  // Single-fetch guard ref for linked record details
  const lastFetchedSubjectRef = useRef<string | null>(null);

  // Load linked record details
  useEffect(() => {
    if (!subject.id && !task?.customerId) return;
    const effectiveSubjectKey = `${subject.kind}:${subject.id}:${task?.customerId || ""}`;
    if (lastFetchedSubjectRef.current === effectiveSubjectKey) return;
    lastFetchedSubjectRef.current = effectiveSubjectKey;

    const customerToLoad = subject.kind === "customer" ? subject.id : task?.customerId;
    if (customerToLoad) {
      const existing = customerItems?.find((c) => c.id === customerToLoad);
      if (existing) {
        setLinkedCustomer(existing);
      }
      setLinkedLoading(!existing);

      void getCustomerDetail(customerToLoad)
        .then((detail) => {
          if (detail?.customer) {
            setLinkedCustomer(detail.customer);
            setCustomerDossier(detail.dossier);
          }
        })
        .catch((err) => {
          console.error("Failed to load customer detail:", err);
        })
        .finally(() => {
          setLinkedLoading(false);
        });
    }

    if (subject.kind === "job" && subject.id) {
      setLinkedLoading(true);
      void getJob(subject.id)
        .then((item) => {
          if (item) {
            setLinkedJob(item);
            if (item.customerId && item.customerId !== customerToLoad) {
              void getCustomerDetail(item.customerId).then((cd) => {
                if (cd?.customer) {
                  setLinkedCustomer(cd.customer);
                  setCustomerDossier(cd.dossier);
                }
              });
            }
          }
        })
        .catch((err) => {
          console.error("Failed to load job detail:", err);
        })
        .finally(() => {
          setLinkedLoading(false);
        });
    } else if (subject.kind === "request" && subject.id) {
      setLinkedLoading(true);
      void getRequest(subject.id)
        .then((item) => {
          if (item) {
            setLinkedRequest(item);
            if (item.customerId && item.customerId !== customerToLoad) {
              void getCustomerDetail(item.customerId).then((cd) => {
                if (cd?.customer) {
                  setLinkedCustomer(cd.customer);
                  setCustomerDossier(cd.dossier);
                }
              });
            }
          }
        })
        .catch((err) => {
          console.error("Failed to load request detail:", err);
        })
        .finally(() => {
          setLinkedLoading(false);
        });
    } else if (subject.kind === "estimate" && subject.id) {
      setLinkedLoading(true);
      void getEstimate(subject.id)
        .then((item) => {
          if (item) {
            setLinkedEstimate(item);
            if (item.customerId && item.customerId !== customerToLoad) {
              void getCustomerDetail(item.customerId).then((cd) => {
                if (cd?.customer) {
                  setLinkedCustomer(cd.customer);
                  setCustomerDossier(cd.dossier);
                }
              });
            }
          }
        })
        .catch((err) => {
          console.error("Failed to load estimate detail:", err);
        })
        .finally(() => {
          setLinkedLoading(false);
        });
    }
  }, [subject.kind, subject.id, task?.customerId, customerItems]);

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
  const overdue = taskIsOverdue(task);

  const assignedPerson = (() => {
    if (task.assignedEmployeeName) {
      return {
        name: task.assignedEmployeeName,
        type: "Employee",
        href: task.assignedEmployeeId ? `/pro/dashboard/team/${task.assignedEmployeeId}` : "/pro/dashboard/team",
      };
    }
    if (employee) {
      return {
        name: `${employee.firstName} ${employee.lastName}`.trim(),
        type: "Employee",
        href: `/pro/dashboard/team/${employee.id}`,
      };
    }
    if (task.assignedContractorName) {
      return {
        name: task.assignedContractorName,
        type: "Contractor",
        href: task.assignedContractorId ? `/pro/dashboard/contractors/${task.assignedContractorId}` : "/pro/dashboard/contractors",
      };
    }
    if (task.assignedVendorName) {
      return {
        name: task.assignedVendorName,
        type: "Vendor",
        href: task.assignedVendorId ? `/pro/dashboard/vendors/${task.assignedVendorId}` : "/pro/dashboard/vendors",
      };
    }
    return null;
  })();

  const handleSetStatus = async (nextStatus: PortalTask["status"]) => {
    if (statusUpdating) return;
    setStatusUpdating(true);
    setFetched((prev) => (prev ? { ...prev, status: nextStatus } : prev));
    try {
      const updated = await dispatch(patchTaskStatus({ id: task.id, status: nextStatus })).unwrap();
      setFetched(updated);
      toast.success(`Task status changed to ${crmTaskStatusLabel(nextStatus)}.`);
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

  const targetCustomerId =
    subject.kind === "customer"
      ? subject.id
      : linkedCustomer?.id || task.customerId || linkedJob?.customerId || linkedRequest?.customerId || linkedEstimate?.customerId || "";

  const customerEmail = linkedCustomer?.email || (subject.kind === "request" ? linkedRequest?.customerEmail : "") || "";
  const customerPhone = linkedCustomer?.phone || (subject.kind === "request" ? linkedRequest?.customerPhone : "") || "";
  const customerAddress = linkedCustomer?.addresses?.[0];
  const customerAddressStr = customerAddress
    ? [customerAddress.street, customerAddress.city, customerAddress.state, customerAddress.zip].filter(Boolean).join(", ")
    : "";
  const customerDisplayName =
    linkedCustomer
      ? crmCustomerName(linkedCustomer)
      : task.customerName || (subject.kind === "customer" ? linkedName : "") || "Customer";
  const isArchived = records.isArchived("task", task.id);

  return (
    <>
      <RecordWorkspace
        href={`/pro/dashboard/tasks/${task.id}`}
        label={`${task.number} · ${task.title}`}
        kind="task"
        tabs={[
          { id: "profile", label: "Details", icon: FileText },
          { id: "linked", label: "Linked record", icon: Link2 },
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
              <Link href="/pro/dashboard/tasks">Close</Link>
            </Button>
            <Button size="sm" onClick={() => setEditOpen(true)}>
              Edit
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  More actions
                  <ChevronDown className="size-3.5" aria-hidden="true" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-44">
                {task.status !== "done" ? (
                  <DropdownMenuItem
                    onSelect={() => void handleSetStatus("done")}
                    disabled={statusUpdating}
                    className="cursor-pointer text-xs"
                  >
                    Mark done
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem
                    onSelect={() => void handleSetStatus("open")}
                    disabled={statusUpdating}
                    className="cursor-pointer text-xs"
                  >
                    Reopen task
                  </DropdownMenuItem>
                )}
                {task.status !== "in_progress" ? (
                  <DropdownMenuItem
                    onSelect={() => void handleSetStatus("in_progress")}
                    disabled={statusUpdating}
                    className="cursor-pointer text-xs"
                  >
                    Mark in progress
                  </DropdownMenuItem>
                ) : null}
                {task.status !== "blocked" ? (
                  <DropdownMenuItem
                    onSelect={() => void handleSetStatus("blocked")}
                    disabled={statusUpdating}
                    className="cursor-pointer text-xs"
                  >
                    Mark blocked
                  </DropdownMenuItem>
                ) : null}
                {task.status !== "open" && task.status !== "done" ? (
                  <DropdownMenuItem
                    onSelect={() => void handleSetStatus("open")}
                    disabled={statusUpdating}
                    className="cursor-pointer text-xs"
                  >
                    Mark open
                  </DropdownMenuItem>
                ) : null}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="cursor-pointer text-xs"
                  onSelect={() => {
                    if (isArchived) {
                      records.unarchive("task", task.id);
                      toast.success(`${task.number} restored.`);
                    } else {
                      records.archive("task", task.id);
                      toast.success(`${task.number} archived.`);
                    }
                  }}
                >
                  {isArchived ? "Restore task" : "Archive task"}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="cursor-pointer text-xs text-red-600 focus:text-red-600"
                  onSelect={() => setDeleteOpen(true)}
                  disabled={deleting}
                >
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
              return (
                <div className="rounded-lg border border-black/10 bg-card p-8 text-center text-sm text-muted-foreground">
                  <Link2 className="size-8 mx-auto mb-2 text-muted-foreground/40" />
                  <p className="font-medium text-foreground">No Linked Record</p>
                  <p className="mt-1 text-xs">This task is not linked to any customer, job, lead, or estimate.</p>
                </div>
              );
            }

            if (subject.kind === "customer") {
              return (
                <div className="space-y-4">
                  <div className="grid gap-4 lg:grid-cols-[1.35fr_0.85fr]">
                    {/* Customer Main Profile Card */}
                    <section className="overflow-hidden rounded-lg border border-black/10 bg-card shadow-[0_10px_28px_rgba(4,26,54,0.07)]">
                      <header className="flex items-center gap-4 border-b border-black/10 bg-[linear-gradient(180deg,#f8fafc_0%,#fff_100%)] px-5 py-4">
                        <CrmMark
                          name={customerDisplayName}
                          kind={linkedCustomer?.entityKind === "company" ? "company" : "person"}
                          photoKey={linkedCustomer?.firstName}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h2 className="text-lg font-semibold capitalize tracking-tight">{customerDisplayName}</h2>
                            {linkedCustomer ? (
                              <>
                                <StatusPill
                                  label={linkedCustomer.entityKind === "company" ? "Company" : "Individual"}
                                  tone="primary"
                                />
                                <StatusPill label={crmTypeLabel(linkedCustomer.customerType)} tone="neutral" />
                              </>
                            ) : null}
                          </div>
                          <p className="mt-1 text-sm text-muted-foreground">
                            #{linkedCustomer?.customerNumber || (subject.id ? `CUST-${subject.id.slice(-4).toUpperCase()}` : "Customer")}
                            {linkedCustomer?.email ? ` · ${linkedCustomer.email}` : ""}
                            {linkedCustomer?.phone ? ` · ${linkedCustomer.phone}` : ""}
                          </p>
                        </div>
                        <Button asChild size="sm" variant="outline" className="gap-1.5 shrink-0">
                          <Link href={`/pro/dashboard/customers/${subject.id}`}>
                            Open file
                            <ExternalLink className="size-3.5" />
                          </Link>
                        </Button>
                      </header>

                      {linkedLoading && !linkedCustomer ? (
                        <div className="p-8 text-center text-sm text-muted-foreground">
                          <Loader2 className="size-5 animate-spin mx-auto mb-2 text-primary" />
                          Loading customer details…
                        </div>
                      ) : (
                        <div className="grid sm:grid-cols-2">
                          <InfoRow
                            icon={Building2}
                            label="Source"
                            value={linkedCustomer ? crmSourceLabel(linkedCustomer.source) : "Direct CRM"}
                          />
                          {linkedCustomer?.email?.trim() ? (
                            <InfoRow
                              icon={Mail}
                              label="Email"
                              value={
                                <a href={`mailto:${linkedCustomer.email}`} className="text-primary hover:underline">
                                  {linkedCustomer.email}
                                </a>
                              }
                            />
                          ) : null}
                          {linkedCustomer?.phone?.trim() ? (
                            <InfoRow
                              icon={Phone}
                              label="Phone"
                              value={
                                <a href={`tel:${linkedCustomer.phone}`} className="hover:underline">
                                  {linkedCustomer.phone}
                                </a>
                              }
                            />
                          ) : null}
                          {linkedCustomer?.altPhone?.trim() ? (
                            <InfoRow
                              icon={Phone}
                              label="Alternate Phone"
                              value={
                                <a href={`tel:${linkedCustomer.altPhone}`} className="hover:underline">
                                  {linkedCustomer.altPhone}
                                </a>
                              }
                            />
                          ) : null}
                          {customerAddressStr ? (
                            <InfoRow
                              icon={MapPin}
                              label="Address"
                              value={customerAddressStr}
                            />
                          ) : null}
                          {linkedCustomer?.entityKind === "company" && linkedCustomer.ein ? (
                            <InfoRow icon={Shield} label="EIN" value={linkedCustomer.ein} />
                          ) : null}
                          {linkedCustomer?.entityKind === "company" && linkedCustomer.website ? (
                            <InfoRow
                              icon={Globe}
                              label="Website"
                              value={
                                <a href={linkedCustomer.website} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                                  {linkedCustomer.website.replace(/^https?:\/\//, "")}
                                </a>
                              }
                            />
                          ) : null}
                          {linkedCustomer?.createdAt ? (
                            <InfoRow icon={CalendarDays} label="Created" value={formatDate(linkedCustomer.createdAt)} />
                          ) : null}
                          {linkedCustomer?.membership && linkedCustomer.membership !== "none" ? (
                            <InfoRow icon={Shield} label="Membership" value={linkedCustomer.membership} />
                          ) : null}
                          {linkedCustomer?.notes?.trim() ? (
                            <InfoRow
                              icon={NotebookPen}
                              label="Notes"
                              value={linkedCustomer.notes}
                              className="sm:col-span-2"
                            />
                          ) : null}
                        </div>
                      )}
                    </section>

                    {/* Right Column: Account / Dossier Summary */}
                    <div className="grid gap-4">
                      <section className="overflow-hidden rounded-lg border border-black/10 bg-card shadow-[0_10px_28px_rgba(4,26,54,0.07)]">
                        <header className="flex items-center gap-2 border-b border-black/10 bg-[#f7f8fa] px-5 py-3">
                          <Wallet className="size-4 text-primary" aria-hidden="true" />
                          <h3 className="text-sm font-semibold">Customer Account</h3>
                        </header>
                        <div className="grid grid-cols-1 gap-px bg-black/5">
                          <MoneyCell
                            label="Amount owing"
                            value={formatMoney(customerDossier?.balanceDue ?? linkedCustomer?.amountOwing ?? 0)}
                            emphasize={(customerDossier?.balanceDue ?? linkedCustomer?.amountOwing ?? 0) > 0}
                          />
                        </div>
                        {customerDossier ? (
                          <>
                            <div className="grid grid-cols-2 gap-px bg-black/5">
                              <MoneyCell
                                label="Total invoiced"
                                value={formatMoney(customerDossier.totalInvoiced ?? 0)}
                              />
                              <MoneyCell
                                label="Total paid"
                                value={formatMoney(customerDossier.totalPaid ?? 0)}
                              />
                            </div>
                            <div className="grid grid-cols-3 gap-px bg-black/5 text-center">
                              <div className="bg-card p-3">
                                <p className="text-[10px] uppercase text-muted-foreground font-medium">Jobs</p>
                                <p className="text-base font-semibold">{customerDossier.jobsCount}</p>
                              </div>
                              <div className="bg-card p-3">
                                <p className="text-[10px] uppercase text-muted-foreground font-medium">Estimates</p>
                                <p className="text-base font-semibold">{customerDossier.estimatesCount}</p>
                              </div>
                              <div className="bg-card p-3">
                                <p className="text-[10px] uppercase text-muted-foreground font-medium">Invoices</p>
                                <p className="text-base font-semibold">{customerDossier.invoicesCount}</p>
                              </div>
                            </div>
                          </>
                        ) : null}
                      </section>
                    </div>
                  </div>
                </div>
              );
            }

            if (subject.kind === "job") {
              return (
                <div className="space-y-4">
                  <section className="overflow-hidden rounded-lg border border-black/10 bg-card shadow-[0_10px_28px_rgba(4,26,54,0.07)]">
                    <header className="flex items-center gap-4 border-b border-black/10 bg-[linear-gradient(180deg,#f8fafc_0%,#fff_100%)] px-5 py-4">
                      <CrmMark name={linkedJob?.title || "Job"} kind="person" photoKey={linkedJob?.title} />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="text-lg font-semibold capitalize tracking-tight">
                            {linkedJob?.title || linkedName || "Job"}
                          </h2>
                          {linkedJob?.status ? (
                            <StatusPill label={jobStatusLabel(linkedJob.status)} tone="primary" />
                          ) : null}
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">
                          #{linkedJob?.number || "Job"}
                          {linkedJob?.customerId ? ` · ${lookups.label("customer", linkedJob.customerId)}` : ""}
                        </p>
                      </div>
                      <Button asChild size="sm" variant="outline" className="gap-1.5 shrink-0">
                        <Link href={`/pro/dashboard/jobs/${subject.id}`}>
                          Open job file
                          <ExternalLink className="size-3.5" />
                        </Link>
                      </Button>
                    </header>
                    {linkedJob ? (
                      <div className="grid sm:grid-cols-2">
                        <InfoRow
                          icon={CalendarDays}
                          label="Scheduled"
                          value={linkedJob.scheduledAt ? formatDate(linkedJob.scheduledAt) : "Not scheduled"}
                        />
                        <InfoRow
                          icon={CalendarDays}
                          label="Due Date"
                          value={linkedJob.dueAt ? formatDate(linkedJob.dueAt) : "No due date"}
                        />
                        {linkedJob.customerId ? (
                          <InfoRow icon={Building2} label="Customer" value={lookups.label("customer", linkedJob.customerId)} />
                        ) : null}
                        {linkedJob.address?.street ? (
                          <InfoRow
                            icon={MapPin}
                            label="Location"
                            value={`${linkedJob.address.street}, ${formatLocation(linkedJob.address.city || "", linkedJob.address.state || "", linkedJob.address.zip || "")}`}
                          />
                        ) : null}
                        {linkedJob.notes ? (
                          <InfoRow icon={NotebookPen} label="Notes" value={linkedJob.notes} className="sm:col-span-2" />
                        ) : null}
                      </div>
                    ) : (
                      <div className="p-6 text-center text-sm text-muted-foreground">
                        <Loader2 className="size-4 animate-spin mx-auto mb-2 text-primary" />
                        Loading job details…
                      </div>
                    )}
                  </section>
                </div>
              );
            }

            if (subject.kind === "request") {
              return (
                <div className="space-y-4">
                  <section className="overflow-hidden rounded-lg border border-black/10 bg-card shadow-[0_10px_28px_rgba(4,26,54,0.07)]">
                    <header className="flex items-center gap-4 border-b border-black/10 bg-[linear-gradient(180deg,#f8fafc_0%,#fff_100%)] px-5 py-4">
                      <CrmMark name={linkedRequest?.serviceName || "Lead"} kind="person" photoKey={linkedRequest?.serviceName} />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="text-lg font-semibold capitalize tracking-tight">
                            {linkedRequest?.serviceName || linkedName || "Lead"}
                          </h2>
                          <StatusPill
                            label={linkedRequest?.channel === "direct" ? "Direct" : "Marketplace"}
                            tone="primary"
                          />
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">
                          #{linkedRequest?.number || "Lead"} · {linkedRequest?.customerName || ""}
                        </p>
                      </div>
                      <Button asChild size="sm" variant="outline" className="gap-1.5 shrink-0">
                        <Link href={`/pro/dashboard/requests/${subject.id}`}>
                          Open lead file
                          <ExternalLink className="size-3.5" />
                        </Link>
                      </Button>
                    </header>
                    {linkedRequest ? (
                      <div className="grid sm:grid-cols-2">
                        <InfoRow icon={Building2} label="Customer" value={linkedRequest.customerName || "Customer"} />
                        {linkedRequest.customerEmail ? (
                          <InfoRow icon={Mail} label="Email" value={linkedRequest.customerEmail} />
                        ) : null}
                        {linkedRequest.customerPhone ? (
                          <InfoRow icon={Phone} label="Phone" value={linkedRequest.customerPhone} />
                        ) : null}
                        <InfoRow
                          icon={MapPin}
                          label="Location"
                          value={formatLocation(linkedRequest.neighborhood || linkedRequest.city || "", linkedRequest.state || "", linkedRequest.zip || "")}
                        />
                        {linkedRequest.details ? (
                          <InfoRow icon={NotebookPen} label="Details" value={linkedRequest.details} className="sm:col-span-2" />
                        ) : null}
                      </div>
                    ) : (
                      <div className="p-6 text-center text-sm text-muted-foreground">
                        <Loader2 className="size-4 animate-spin mx-auto mb-2 text-primary" />
                        Loading lead details…
                      </div>
                    )}
                  </section>
                </div>
              );
            }

            if (subject.kind === "estimate") {
              return (
                <div className="space-y-4">
                  <section className="overflow-hidden rounded-lg border border-black/10 bg-card shadow-[0_10px_28px_rgba(4,26,54,0.07)]">
                    <header className="flex items-center gap-4 border-b border-black/10 bg-[linear-gradient(180deg,#f8fafc_0%,#fff_100%)] px-5 py-4">
                      <CrmMark name={linkedEstimate?.number || "Estimate"} kind="person" photoKey={linkedEstimate?.number} />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="text-lg font-semibold capitalize tracking-tight">
                            {linkedEstimate?.number || linkedName || "Estimate"}
                          </h2>
                          {linkedEstimate?.status ? (
                            <StatusPill label={linkedEstimate.status.replace(/_/g, " ")} tone="primary" />
                          ) : null}
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">
                          Total: {formatMoney(linkedEstimate?.total || 0)}
                        </p>
                      </div>
                      <Button asChild size="sm" variant="outline" className="gap-1.5 shrink-0">
                        <Link href={`/pro/dashboard/estimates/${subject.id}`}>
                          Open estimate
                          <ExternalLink className="size-3.5" />
                        </Link>
                      </Button>
                    </header>
                    {linkedEstimate ? (
                      <div className="grid sm:grid-cols-2">
                        <InfoRow icon={CalendarDays} label="Created" value={formatDate(linkedEstimate.createdAt)} />
                        {linkedEstimate.expiresAt ? (
                          <InfoRow icon={CalendarDays} label="Expires" value={formatDate(linkedEstimate.expiresAt)} />
                        ) : null}
                        <InfoRow icon={Wallet} label="Subtotal" value={formatMoney(linkedEstimate.subtotal || 0)} />
                        <InfoRow icon={Wallet} label="Total" value={formatMoney(linkedEstimate.total || 0)} />
                      </div>
                    ) : (
                      <div className="p-6 text-center text-sm text-muted-foreground">
                        <Loader2 className="size-4 animate-spin mx-auto mb-2 text-primary" />
                        Loading estimate details…
                      </div>
                    )}
                  </section>
                </div>
              );
            }

            return (
              <div className="rounded-lg border border-black/10 bg-card p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[11px] font-medium tracking-[0.12em] text-muted-foreground uppercase">
                      {reminderSubjectKindLabel(subject.kind)}
                    </p>
                    <div className="mt-1">
                      <ReminderSubjectLink kind={subject.kind} id={subject.id} name={linkedName} />
                    </div>
                  </div>
                </div>
              </div>
            );
          }

          // Default tab: "profile" (Details)
          return (
            <div className="space-y-4">
              <div className="grid gap-4 lg:grid-cols-[1.35fr_0.85fr]">
                {/* Main Task Profile Card */}
                <section className="overflow-hidden rounded-lg border border-black/10 bg-card shadow-[0_10px_28px_rgba(4,26,54,0.07)]">
                  <header className="flex items-center gap-4 border-b border-black/10 bg-[linear-gradient(180deg,#f8fafc_0%,#fff_100%)] px-5 py-4">
                    <CrmMark name={task.title} kind="person" photoKey={task.title} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-lg font-semibold capitalize tracking-tight">{task.title}</h2>
                        <StatusPill label={crmTaskPriorityLabel(task.priority)} tone={priorityTone(task.priority)} />
                        <StatusPill
                          label={overdue ? "Overdue" : crmTaskStatusLabel(task.status)}
                          tone={overdue ? "danger" : statusTone(task.status)}
                        />
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        #{task.number} · Created {formatDate(task.createdAt)}
                      </p>
                    </div>
                  </header>
                  <div className="grid sm:grid-cols-2">
                    <InfoRow
                      icon={CalendarDays}
                      label="Due Date"
                      value={task.dueAt ? formatDate(task.dueAt) : "No due date"}
                      warn={overdue}
                    />
                    <InfoRow
                      icon={Shield}
                      label="Priority"
                      value={crmTaskPriorityLabel(task.priority)}
                    />
                    <InfoRow
                      icon={CheckCircle2}
                      label="Status"
                      value={overdue ? "Overdue" : crmTaskStatusLabel(task.status)}
                      warn={overdue || task.status === "blocked"}
                    />
                    <InfoRow
                      icon={Calendar}
                      label="Created"
                      value={formatDate(task.createdAt)}
                    />
                    <InfoRow
                      icon={NotebookPen}
                      label="Notes / Description"
                      value={task.note ? task.note : <span className="text-muted-foreground italic">No notes provided for this task.</span>}
                      className="sm:col-span-2"
                    />
                  </div>
                </section>

                {/* Right Column: Assignment & Quick Linked Card */}
                <div className="grid gap-4">
                  {/* Assignee Card */}
                  <section className="overflow-hidden rounded-lg border border-black/10 bg-card shadow-[0_10px_28px_rgba(4,26,54,0.07)]">
                    <header className="flex items-center gap-2 border-b border-black/10 bg-[#f7f8fa] px-5 py-3">
                      <UserRound className="size-4 text-primary" aria-hidden="true" />
                      <h3 className="text-sm font-semibold">Assigned Team Member</h3>
                    </header>
                    <div className="px-5 py-4">
                      {assignedPerson ? (
                        <div className="flex items-center gap-3">
                          <CrmMark name={assignedPerson.name} kind="person" photoKey={assignedPerson.name} size="md" />
                          <div className="min-w-0 flex-1">
                            <Link href={assignedPerson.href} className="font-medium text-primary hover:underline text-sm block truncate">
                              {assignedPerson.name}
                            </Link>
                            <p className="text-xs text-muted-foreground capitalize">{assignedPerson.type}</p>
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground italic">No team member assigned to this task.</p>
                      )}
                    </div>
                  </section>

                  {/* Customer Details Card */}
                  <section className="overflow-hidden rounded-lg border border-black/10 bg-card shadow-[0_10px_28px_rgba(4,26,54,0.07)]">
                    <header className="flex items-center justify-between border-b border-black/10 bg-[#f7f8fa] px-5 py-3">
                      <div className="flex items-center gap-2">
                        <UserRound className="size-4 text-primary" aria-hidden="true" />
                        <h3 className="text-sm font-semibold">Customer Details</h3>
                      </div>
                      {targetCustomerId ? (
                        <Button asChild size="sm" variant="outline" className="h-7 text-xs gap-1">
                          <Link href={`/pro/dashboard/customers/${targetCustomerId}`}>
                            Open file
                            <ExternalLink className="size-3" />
                          </Link>
                        </Button>
                      ) : null}
                    </header>
                    <div className="px-5 py-4">
                      {targetCustomerId || customerDisplayName !== "Customer" ? (
                        <div className="space-y-3">
                          <div className="flex items-center gap-3">
                            <CrmMark
                              name={customerDisplayName}
                              kind={linkedCustomer?.entityKind === "company" ? "company" : "person"}
                              photoKey={linkedCustomer?.firstName || customerDisplayName}
                              size="md"
                            />
                            <div className="min-w-0 flex-1">
                              <Link
                                href={targetCustomerId ? `/pro/dashboard/customers/${targetCustomerId}` : "#"}
                                className="font-semibold text-primary hover:underline text-sm block truncate"
                              >
                                {customerDisplayName}
                              </Link>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <span className="text-xs text-muted-foreground">
                                  #{linkedCustomer?.customerNumber || (targetCustomerId ? `CUST-${targetCustomerId.slice(-4).toUpperCase()}` : "Customer")}
                                </span>
                                {linkedCustomer?.customerType ? (
                                  <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-700 capitalize">
                                    {linkedCustomer.customerType}
                                  </span>
                                ) : null}
                              </div>
                            </div>
                          </div>

                          <div className="space-y-2 pt-3 border-t border-black/5 text-xs">
                            {customerEmail ? (
                              <div className="flex items-center gap-2 text-muted-foreground">
                                <Mail className="size-3.5 shrink-0 text-primary/70" />
                                <a href={`mailto:${customerEmail}`} className="text-foreground hover:text-primary hover:underline truncate font-medium">
                                  {customerEmail}
                                </a>
                              </div>
                            ) : null}
                            {customerPhone ? (
                              <div className="flex items-center gap-2 text-muted-foreground">
                                <Phone className="size-3.5 shrink-0 text-primary/70" />
                                <a href={`tel:${customerPhone}`} className="text-foreground hover:underline font-medium">
                                  {customerPhone}
                                </a>
                              </div>
                            ) : null}
                            {customerAddressStr ? (
                              <div className="flex items-start gap-2 text-muted-foreground">
                                <MapPin className="size-3.5 shrink-0 text-primary/70 mt-0.5" />
                                <span className="text-foreground line-clamp-2">{customerAddressStr}</span>
                              </div>
                            ) : null}
                          </div>

                          {subject.kind !== "customer" && subject.id ? (
                            <div className="pt-2 border-t border-black/5 flex items-center justify-between text-xs">
                              <span className="text-muted-foreground">Linked {reminderSubjectKindLabel(subject.kind)}:</span>
                              <ReminderSubjectLink kind={subject.kind} id={subject.id} name={linkedName} />
                            </div>
                          ) : null}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground italic">No customer linked to this task.</p>
                      )}
                    </div>
                  </section>
                </div>
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

function InfoRow({
  icon: Icon,
  label,
  value,
  warn,
  className,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: React.ReactNode;
  warn?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex items-start gap-3 border-b border-black/5 px-5 py-3 last:border-b-0", className)}>
      <Icon className="mt-0.5 size-3.5 shrink-0 text-primary/70" />
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">{label}</p>
        <div
          className={
            warn
              ? "text-sm font-medium text-red-700 whitespace-pre-wrap break-words"
              : "text-sm whitespace-pre-wrap break-words"
          }
        >
          {value}
        </div>
      </div>
    </div>
  );
}

function MoneyCell({
  label,
  value,
  emphasize,
}: {
  label: string;
  value: string;
  emphasize?: boolean;
}) {
  return (
    <div className="bg-card px-5 py-4">
      <p className="text-[10px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">{label}</p>
      <p className={emphasize ? "mt-1 text-xl font-semibold tabular-nums text-primary" : "mt-1 text-xl font-semibold tabular-nums"}>
        {value}
      </p>
    </div>
  );
}

