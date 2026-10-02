"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Archive,
  ArchiveRestore,
  Bell,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ExternalLink,
  FilePlus2,
  ListTodo,
  Loader2,
  Mail,
  MessageSquare,
  NotebookPen,
  Phone,
  PhoneCall,
  RotateCcw,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { ArchiveBadge, archiveRowAction } from "@/components/portal/archive-control";
import { AssignEventDialog } from "@/components/portal/assign-event-dialog";
import { DeleteConfirmDialog } from "@/components/portal/delete-confirm-dialog";
import {
  CreateNoteDialog,
  CreateReminderDialog,
  CreateTaskDialog,
} from "@/components/portal/create-person-dialogs";
import { NotesPanel } from "@/components/portal/notes-panel";
import { ChatPanel } from "@/components/shared/chat-panel";
import { useChatThreads } from "@/components/portal/use-chat-threads";
import { ConvertLeadToEstimateDialog } from "@/components/portal/convert-lead-to-estimate-dialog";
import { EventCalendar, EventCalendarSkeleton, type CalendarMove } from "@/components/portal/event-calendar";
import { jobBoardColumns } from "@/components/portal/job-columns";
import { LocalFilterTabs } from "@/components/portal/local-filter-tabs";
import { PortalDataTable } from "@/components/portal/portal-data-table";
import { RecordWorkspace } from "@/components/portal/record-workspace";
import { StatusPill, requestTone } from "@/components/portal/status-pill";
import { FileNotices } from "@/components/portal/task-banner";
import { useCrmDirectory } from "@/components/portal/use-crm-directory";
import { useCrmRecordPending } from "@/components/portal/use-crm-record-pending";
import { usePortalCrew } from "@/components/portal/use-portal-crew";
import { usePortalRecords } from "@/components/portal/use-portal-records";
import { usePortalWorkspace } from "@/components/portal/use-portal-workspace";
import { useCrmApiData } from "@/components/portal/use-crm-api-data";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { selectAuth, selectAuthUser } from "@/store/authSlice";
import { deleteTaskRecord, patchTaskStatus } from "@/store/tasksSlice";
import { deleteReminderRecord, patchReminderStatus } from "@/store/remindersSlice";
import {
  fetchRequestDetail,
  fetchLeadCustomer,
  fetchLeadEstimates,
  fetchLeadJobs,
  fetchLeadTasks,
  fetchLeadReminders,
  fetchLeadSchedule,
  bookLeadSchedule,
  updateLeadSchedule,
  deleteLeadSchedule,
  upsertLeadScheduleLocal,
  setLeadScheduleLocal,
  removeLeadScheduleLocal,
  leadTabCacheKey,
  upsertLeadTask,
  removeLeadTask,
  upsertLeadReminder,
  removeLeadReminder,
  setRequestStatusLocal,
  patchLeadStatus,
  preserveScheduledLeadState,
} from "@/store/requestsSlice";
import { getCustomer, getRequest, queryEstimates, queryJobs, queryTasks, queryReminders } from "@/lib/api/crm-client";
import { ensureProviderChatThread } from "@/lib/api/chat-client";
import { subscribeRealtime, useRealtime } from "@/components/realtime/realtime-provider";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { CenteredSpinner } from "@/components/ui/spinner";
import { ChatPanelSkeleton } from "@/components/shared/loading-skeletons";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getAvatarColor, getInitials } from "@/lib/chat-format";
import { CustomerLocationMapLazy } from "@/components/portal/customer-location-map-lazy";
import {
  crmCustomerName,
  crmReminderStatusLabel,
  crmTaskPriorityLabel,
  crmTaskStatusLabel,
  reminderIsOverdue,
  reminderMatches,
  taskIsOverdue,
  taskMatches,
  type CrmTaskPriority,
  type CrmTaskStatus,
  type PortalCustomerCrm,
  type PortalReminder,
  type PortalTask,
} from "@/lib/data/crm-people";
import {
  calendarEventKindLabel,
  estimateStatusLabel,
  estimateStatusTone,
  formatClock,
  getPortalCustomerName,
  minutesForWindow,
  requestStatusLabel,
  timeWindowLabel,
  windowFromMinutes,
  type PortalCalendarEvent,
  type PortalEmployee,
  type PortalRequest,
  type PortalTimeWindow,
} from "@/lib/data/portal";
import { formatDate, formatLocation, formatMoney } from "@/lib/format";
import type { Estimate, Job, RequestStatus, ServiceAddress } from "@/lib/types";
import { cn } from "@/lib/utils";

const TABS = [
  { id: "summary", label: "Summary" },
  { id: "estimates", label: "Estimates" },
  { id: "jobs", label: "Jobs" },
  { id: "schedule", label: "Schedule" },
  { id: "tasks", label: "Tasks" },
  { id: "reminders", label: "Reminders" },
  { id: "messages", label: "Messages" },
  { id: "notes", label: "Notes" },
  { id: "photos", label: "Photos" },
];

type LeadTab =
  | "summary"
  | "estimates"
  | "jobs"
  | "schedule"
  | "tasks"
  | "reminders"
  | "messages"
  | "notes"
  | "photos";

const REMINDER_FILTER_OPTIONS = [
  { value: "", label: "All" },
  { value: "open", label: "Open" },
  { value: "done", label: "Done" },
  { value: "overdue", label: "Overdue" },
];

const TASK_FILTER_OPTIONS = [
  { value: "", label: "All" },
  { value: "open", label: "Open" },
  { value: "in_progress", label: "In progress" },
  { value: "blocked", label: "Blocked" },
  { value: "done", label: "Done" },
  { value: "overdue", label: "Overdue" },
];

function leadStageCopy(status: RequestStatus, hasEstimate: boolean, hasJob: boolean) {
  if (hasJob || status === "converted_to_job") return "This lead became a job. The signed scope is on the jobs board.";
  if (status === "declined") return "They passed. Keep the file for history or reopen it if they call back.";
  if (status === "closed") return "Closed without a job.";
  if (status === "accepted") return "They accepted. Start the job from the signed estimate.";
  if (status === "estimate_sent" || hasEstimate) return "A quote is on this lead. Follow up if they have not signed.";
  if (status === "scheduled") return "Visit is on the calendar. Confirm details, then write or send the estimate.";
  if (status === "contacted") return "You spoke with them. Confirm the work, then write the estimate.";
  if (status === "viewed") return "Seen in the inbox. Call or text so this does not go cold.";
  return "New inbound request. Review their answers, then send a written estimate if you can take it.";
}

function windowFromLabel(value?: string): PortalTimeWindow {
  const label = value?.toLowerCase() ?? "";
  if (label.includes("morning")) return "morning";
  if (label.includes("afternoon") || label.includes("evening")) return "afternoon";
  return "all_day";
}

function leadChannelCopy(channel?: string) {
  if (channel === "direct") {
    return "Lead source: submitted on your company website";
  }
  return "Lead source: came through the marketplace";
}

function leadStatusAlertClass(status: string) {
  switch (status) {
    case "contacted":
    case "estimate_sent":
      return "bg-amber-50 text-amber-950";
    case "accepted":
    case "converted_to_job":
      return "bg-emerald-50 text-emerald-950";
    case "declined":
    case "closed":
      return "bg-red-50 text-red-950";
    case "new":
    case "viewed":
    case "scheduled":
      return "bg-[#eef4fa] text-[#0f2f52]";
    default:
      return "bg-slate-50 text-slate-900";
  }
}

function LeadCard({
  title,
  action,
  children,
  className,
  hideHeader = false,
  borderless = true,
}: {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  /** Hide title bar when the main tab already names this section. */
  hideHeader?: boolean;
  /** No outer border/shadow — flat panel. Default true for lead detail tabs. */
  borderless?: boolean;
}) {
  return (
    <section
      className={cn(
        "overflow-hidden rounded-md bg-card",
        !borderless && "border border-border-soft",
        className,
      )}
    >
      {!hideHeader && title ? (
        <header className="flex h-10 shrink-0 items-center justify-between gap-3 border-b border-border-soft bg-secondary/40 px-4">
          <h3 className="truncate text-sm font-semibold text-foreground">{title}</h3>
          {action ? <div className="flex h-8 shrink-0 items-center gap-2">{action}</div> : null}
        </header>
      ) : null}
      <div className="bg-card">{children}</div>
    </section>
  );
}

function InfoRow({
  label,
  value,
  warn,
  className,
}: {
  label: string;
  value: ReactNode;
  warn?: boolean;
  className?: string;
}) {
  if (value == null || value === "") return null;
  return (
    <div className={cn("min-w-0", className)}>
      <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
      <div
        className={
          warn
            ? "mt-1 text-sm font-medium text-red-700 whitespace-pre-wrap break-words"
            : "mt-1 text-sm font-medium text-foreground whitespace-pre-wrap break-words"
        }
      >
        {value}
      </div>
    </div>
  );
}

export function RequestDetailView({ id }: { id: string }) {
  const dispatch = useAppDispatch();
  const auth = useAppSelector(selectAuth);
  const user = useAppSelector(selectAuthUser);
  const useApi =
    auth.hydrated &&
    Boolean(auth.token) &&
    (user?.role === "provider" || auth.role === "provider");

  const { requests, estimates, jobs, invoices, provider } = usePortalWorkspace();
  const crm = useCrmApiData();
  const { customers, reminders, tasks, contractors, setReminderStatus, setTaskStatus, remove } = useCrmDirectory();
  const { events, employees: crewEmployees, employeeLabel } = usePortalCrew();
  const teamItems = useAppSelector((state) => state.team?.items ?? []);
  const allEmployees = useMemo(() => {
    const pool = [...(crm.employees || []), ...(teamItems || []), ...(crewEmployees || [])];
    const map = new Map<string, PortalEmployee>();
    for (const item of pool) {
      if (item?.id && !map.has(item.id)) map.set(item.id, item);
    }
    return Array.from(map.values());
  }, [crm.employees, teamItems, crewEmployees]);
  const employees = allEmployees.length > 0 ? allEmployees : crewEmployees;
  const records = usePortalRecords();
  const searchParams = useSearchParams();
  const tab = (searchParams.get("tab") ?? "summary") as LeadTab;
  const chat = useChatThreads({ enabled: tab === "messages" });
  const [estimateOpen, setEstimateOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [taskOpen, setTaskOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<PortalTask | null>(null);
  const [deletingTask, setDeletingTask] = useState<PortalTask | null>(null);
  const [deleteTaskLoading, setDeleteTaskLoading] = useState(false);
  const [busyTaskRowIds, setBusyTaskRowIds] = useState<string[]>([]);
  const [taskStatusFilter, setTaskStatusFilter] = useState<string>("");
  const [taskPriorityFilter, setTaskPriorityFilter] = useState<string>("");
  const [noteOpen, setNoteOpen] = useState(false);
  const [reminderOpen, setReminderOpen] = useState(false);
  const [editingReminder, setEditingReminder] = useState<PortalReminder | null>(null);
  const [deletingReminder, setDeletingReminder] = useState<PortalReminder | null>(null);
  const [deleteReminderLoading, setDeleteReminderLoading] = useState(false);
  const [busyReminderRowIds, setBusyReminderRowIds] = useState<string[]>([]);
  const [reminderStatusFilter, setReminderStatusFilter] = useState<string>("");
  const [apiLead, setApiLead] = useState<PortalRequest | null>(null);
  const [apiLoading, setApiLoading] = useState(false);
  const [apiCustomer, setApiCustomer] = useState<PortalCustomerCrm | null>(null);
  const [apiEstimates, setApiEstimates] = useState<Estimate[] | null>(null);
  const [estimatesLoading, setEstimatesLoading] = useState(false);
  const [apiJobs, setApiJobs] = useState<Job[] | null>(null);
  const [jobsLoading, setJobsLoading] = useState(false);
  const [apiTasks, setApiTasks] = useState<PortalTask[] | null>(null);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [apiReminders, setApiReminders] = useState<PortalReminder[] | null>(null);
  const [remindersLoading, setRemindersLoading] = useState(false);
  const [apiSchedules, setApiSchedules] = useState<PortalCalendarEvent[] | null | undefined>(undefined);
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [photosLoading, setPhotosLoading] = useState(false);
  const [unlinkingScheduleId, setUnlinkingScheduleId] = useState<string | null>(null);
  const [selectedScheduleForEdit, setSelectedScheduleForEdit] = useState<PortalCalendarEvent | null>(null);
  const loadedTabsRef = useRef<{
    customer?: string;
    estimates?: string;
    jobs?: string;
    tasks?: string;
    reminders?: string;
    schedule?: string;
    photos?: string;
  }>({});

  const reduxRequests = useAppSelector((state) => state.requests);
  const cachedLead = reduxRequests.detailsCache[id];
  const allRequests = records.mergeRequests(requests);
  const request =
    cachedLead ||
    (apiLead?.id === id ? apiLead : null) ||
    allRequests.find((item) => item.id === id);

  const tabKey = leadTabCacheKey(id, request?.customerId);
  const cachedCustomer = request?.customerId ? reduxRequests.customerCache[request.customerId] : undefined;
  const cachedEstimates = reduxRequests.estimatesCache[tabKey];
  const cachedJobs = reduxRequests.jobsCache[tabKey];
  const cachedTasks = reduxRequests.tasksCache[tabKey];
  const cachedReminders = reduxRequests.remindersCache[tabKey];
  const cachedSchedules = reduxRequests.scheduleCache[tabKey];

  const hasCustomerCached = Boolean(cachedCustomer);
  /** True only when there is at least one row to show (empty [] still means "no data"). */
  const hasEstimatesData = (cachedEstimates?.length ?? apiEstimates?.length ?? 0) > 0;
  const hasJobsData = (cachedJobs?.length ?? apiJobs?.length ?? 0) > 0;
  const hasTasksData = (cachedTasks?.length ?? apiTasks?.length ?? 0) > 0;
  const hasRemindersData = (cachedReminders?.length ?? apiReminders?.length ?? 0) > 0;
  const hasScheduleData =
    (cachedSchedules?.length ?? (apiSchedules?.length ?? 0)) > 0;
  const hasPhotosData = (request?.photoUrls?.length ?? 0) > 0;

  const detailFetchedForIdRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const cached = reduxRequests.detailsCache[id];
    // Trust cache only for progressed statuses. For new/viewed/contacted always
    // hit View once so the server can heal "has calendar visit → Scheduled" into MongoDB.
    const trustCache =
      cached &&
      cached.status !== "new" &&
      cached.status !== "viewed" &&
      cached.status !== "contacted";

    if (trustCache) {
      setApiLead(cached);
      setApiLoading(false);
      detailFetchedForIdRef.current = id;
      return () => {
        cancelled = true;
      };
    }

    if (detailFetchedForIdRef.current === id && trustCache) {
      setApiLead(cached);
      setApiLoading(false);
      return () => {
        cancelled = true;
      };
    }

    if (!cached) {
      setApiLoading(true);
    }
    detailFetchedForIdRef.current = id;
    const wasNew = !cached || cached.status === "new";
    void dispatch(fetchRequestDetail(id))
      .unwrap()
      .then((item) => {
        if (!cancelled && item) {
          setApiLead(preserveScheduledLeadState(item, cached || null));
          if (wasNew && item.status !== "scheduled" && typeof window !== "undefined") {
            window.dispatchEvent(
              new CustomEvent("rs-realtime", {
                detail: { type: "INBOX_SUMMARY_INVALIDATE" },
              }),
            );
          }
        }
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setApiLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- cache-first detail load by id
  }, [id, dispatch]);

  useEffect(() => {
    const handleLeadStatus = (event: Event) => {
      const custom = event as CustomEvent<{ id?: string; status?: string }>;
      const detail = custom?.detail;
      if (detail?.id === id && detail?.status) {
        dispatch(
          setRequestStatusLocal({
            id,
            status: detail.status as PortalRequest["status"],
          }),
        );
        setApiLead((prev) =>
          prev ? { ...prev, status: detail.status as PortalRequest["status"] } : prev,
        );
      }
    };
    window.addEventListener("rs-lead-status", handleLeadStatus);
    return () => {
      window.removeEventListener("rs-lead-status", handleLeadStatus);
    };
  }, [id, dispatch]);

  useEffect(() => {
    if (searchParams.get("convert") === "1" && request?.status !== "estimate_sent" && request?.status !== "accepted" && request?.status !== "converted_to_job") {
      setEstimateOpen(true);
    }
  }, [searchParams, request?.status]);

  const pending = useCrmRecordPending() || (!request && (apiLoading || reduxRequests.detailLoading));
  const allEstimates = records.mergeEstimates(estimates);
  const allJobs = records.mergeJobs(jobs);

  const customer = cachedCustomer || apiCustomer || customers.find((item) => item.id === request?.customerId);
  const baseEstimates = useMemo(() => {
    if (useApi) return cachedEstimates ?? apiEstimates ?? [];
    return allEstimates;
  }, [useApi, cachedEstimates, apiEstimates, allEstimates]);

  const relatedEstimates = useMemo(() => {
    const estId = (request as { estimateId?: string })?.estimateId;
    // API already scopes by requestId when useApi; keep client filter as a safety net.
    if (useApi && (cachedEstimates || apiEstimates)) {
      return baseEstimates.filter(
        (item) => !item.requestId || item.requestId === id || (estId && item.id === estId),
      );
    }
    return baseEstimates.filter(
      (item) => item.requestId === id || (estId && item.id === estId),
    );
  }, [baseEstimates, id, request, useApi, cachedEstimates, apiEstimates]);

  const baseJobs = useMemo(() => {
    if (useApi) return cachedJobs ?? apiJobs ?? [];
    return allJobs;
  }, [useApi, cachedJobs, apiJobs, allJobs]);

  const relatedJobs = useMemo(() => {
    const estId = (request as { estimateId?: string })?.estimateId;
    const jId = (request as { jobId?: string })?.jobId;
    // Lead jobs API scopes via estimate.requestId — trust that list when present.
    if (useApi && (cachedJobs || apiJobs)) {
      return baseJobs;
    }
    return baseJobs.filter(
      (item) =>
        (item as { requestId?: string }).requestId === id ||
        relatedEstimates.some((estimate) => estimate.id === item.estimateId) ||
        (estId && item.estimateId === estId) ||
        (jId && item.id === jId),
    );
  }, [baseJobs, id, request, relatedEstimates, useApi, cachedJobs, apiJobs]);

  const estimate = relatedEstimates[0];
  const job = relatedJobs[0];

  const refreshEstimates = useCallback(() => {
    if (!hasEstimatesData) setEstimatesLoading(true);
    void dispatch(
      fetchLeadEstimates({
        customerId: request?.customerId || undefined,
        requestId: id,
      }),
    )
      .unwrap()
      .then((result) => {
        if (result?.items) {
          setApiEstimates(result.items);
        }
      })
      .catch(() => undefined)
      .finally(() => setEstimatesLoading(false));
  }, [id, request?.customerId, dispatch, hasEstimatesData]);

  const refreshJobs = useCallback(() => {
    if (!hasJobsData) setJobsLoading(true);
    void dispatch(
      fetchLeadJobs({
        customerId: request?.customerId || undefined,
        requestId: id,
      }),
    )
      .unwrap()
      .then((result) => {
        if (result?.items) {
          setApiJobs(result.items);
        }
      })
      .catch(() => undefined)
      .finally(() => setJobsLoading(false));
  }, [id, request?.customerId, dispatch, hasJobsData]);

  const refreshTasks = useCallback(() => {
    if (!hasTasksData) setTasksLoading(true);
    void dispatch(
      fetchLeadTasks({
        customerId: request?.customerId || undefined,
        requestId: id,
      }),
    )
      .unwrap()
      .then((result) => {
        if (result?.items) {
          setApiTasks(result.items);
        }
      })
      .catch(() => undefined)
      .finally(() => setTasksLoading(false));
  }, [id, request?.customerId, dispatch, hasTasksData]);

  const refreshReminders = useCallback(() => {
    if (!hasRemindersData) setRemindersLoading(true);
    void dispatch(
      fetchLeadReminders({
        customerId: request?.customerId || undefined,
        requestId: id,
      }),
    )
      .unwrap()
      .then((result) => {
        if (result?.items) {
          setApiReminders(result.items);
        }
      })
      .catch(() => undefined)
      .finally(() => setRemindersLoading(false));
  }, [id, request?.customerId, dispatch, hasRemindersData]);

  const refreshSchedule = useCallback(() => {
    if (!hasScheduleData) setScheduleLoading(true);
    void dispatch(
      fetchLeadSchedule({
        requestId: id,
        customerId: request?.customerId || undefined,
      }),
    )
      .unwrap()
      .then((result) => {
        setApiSchedules(result?.events ?? []);
      })
      .catch(() => {
        setApiSchedules([]);
      })
      .finally(() => setScheduleLoading(false));
  }, [id, request?.customerId, dispatch, hasScheduleData]);

  // Clear lead-scoped local state when opening a different lead.
  useEffect(() => {
    setApiLead(null);
    setApiCustomer(null);
    setApiEstimates(null);
    setApiJobs(null);
    setApiTasks(null);
    setApiReminders(null);
    setApiSchedules(undefined);
    setEstimatesLoading(false);
    setJobsLoading(false);
    setTasksLoading(false);
    setRemindersLoading(false);
    setScheduleLoading(false);
    setPhotosLoading(false);
    loadedTabsRef.current = {};
  }, [id]);

  // Fetch / silent-refresh each lead tab when it becomes active.
  useEffect(() => {
    let cancelled = false;
    if (!id) return () => undefined;

    const customerId = request?.customerId || undefined;

    // Snapshot has-data at tab-open time (do not put these in effect deps).
    const estimatesHaveData = (cachedEstimates?.length ?? apiEstimates?.length ?? 0) > 0;
    const jobsHaveData = (cachedJobs?.length ?? apiJobs?.length ?? 0) > 0;
    const tasksHaveData = (cachedTasks?.length ?? apiTasks?.length ?? 0) > 0;
    const remindersHaveData = (cachedReminders?.length ?? apiReminders?.length ?? 0) > 0;
    const scheduleHaveData =
      (cachedSchedules?.length ?? (apiSchedules?.length ?? 0)) > 0;
    const photosHaveData = (cachedLead?.photoUrls?.length ?? apiLead?.photoUrls?.length ?? 0) > 0;

    // 1. Customer (for info bar — always load when linked)
    if (request?.customerId) {
      void dispatch(fetchLeadCustomer(request.customerId))
        .unwrap()
        .then((cust) => {
          if (!cancelled && cust) setApiCustomer(cust);
        })
        .catch(() => undefined);
    }

    // 2. Estimates (also when Jobs needs them / status implies estimate)
    const shouldFetchEstimates =
      tab === "estimates" ||
      tab === "jobs" ||
      request?.status === "estimate_sent" ||
      request?.status === "accepted" ||
      request?.status === "converted_to_job";

    if (shouldFetchEstimates) {
      if (tab === "estimates" && !estimatesHaveData) setEstimatesLoading(true);
      void dispatch(fetchLeadEstimates({ customerId, requestId: id }))
        .unwrap()
        .then((result) => {
          if (!cancelled && result?.items) setApiEstimates(result.items);
        })
        .catch(() => undefined)
        .finally(() => {
          if (!cancelled) setEstimatesLoading(false);
        });
    }

    // 3. Jobs
    if (tab === "jobs" || request?.status === "converted_to_job") {
      if (tab === "jobs" && !jobsHaveData) setJobsLoading(true);
      void dispatch(fetchLeadJobs({ customerId, requestId: id }))
        .unwrap()
        .then((result) => {
          if (!cancelled && result?.items) setApiJobs(result.items);
        })
        .catch(() => undefined)
        .finally(() => {
          if (!cancelled) setJobsLoading(false);
        });
    }

    // 4. Tasks
    if (tab === "tasks") {
      if (!tasksHaveData) setTasksLoading(true);
      void dispatch(fetchLeadTasks({ customerId, requestId: id }))
        .unwrap()
        .then((result) => {
          if (!cancelled && result?.items) {
            setApiTasks(result.items);
            result.items.forEach((t) => crm.addTask?.(t));
          }
        })
        .catch(() => undefined)
        .finally(() => {
          if (!cancelled) setTasksLoading(false);
        });
    }

    // 5. Reminders
    if (tab === "reminders") {
      if (!remindersHaveData) setRemindersLoading(true);
      void dispatch(fetchLeadReminders({ customerId, requestId: id }))
        .unwrap()
        .then((result) => {
          if (!cancelled && result?.items) {
            setApiReminders(result.items);
            result.items.forEach((r) => crm.addReminder?.(r));
          }
        })
        .catch(() => undefined)
        .finally(() => {
          if (!cancelled) setRemindersLoading(false);
        });
    }

    // 6. Schedule
    if (tab === "schedule") {
      if (!scheduleHaveData) setScheduleLoading(true);
      void dispatch(fetchLeadSchedule({ requestId: id, customerId }))
        .unwrap()
        .then((result) => {
          if (!cancelled) setApiSchedules(result?.events ?? []);
        })
        .catch(() => {
          if (!cancelled) setApiSchedules([]);
        })
        .finally(() => {
          if (!cancelled) setScheduleLoading(false);
        });
    }

    // 7. Photos — revalidate detail; spinner only when no photos to show yet
    if (tab === "photos") {
      if (!photosHaveData) setPhotosLoading(true);
      void dispatch(fetchRequestDetail(id))
        .unwrap()
        .then((item) => {
          if (!cancelled && item) {
            setApiLead(preserveScheduledLeadState(item, cachedLead || null));
          }
        })
        .catch(() => undefined)
        .finally(() => {
          // Always clear so a cancelled/re-run effect cannot leave an endless spinner.
          setPhotosLoading(false);
        });
    } else {
      setPhotosLoading(false);
    }

    return () => {
      cancelled = true;
    };
    // Only re-run when the active tab or lead changes (not when cache fills).
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: tab-open refresh
  }, [tab, id, request?.customerId, request?.status, dispatch]);

  const allReminders = useMemo(() => {
    if (useApi) return cachedReminders ?? apiReminders ?? [];
    return reminders;
  }, [useApi, cachedReminders, apiReminders, reminders]);

  const allTasks = useMemo(() => {
    if (useApi) return cachedTasks ?? apiTasks ?? [];
    return tasks;
  }, [useApi, cachedTasks, apiTasks, tasks]);

  const relatedReminders = useMemo(() => {
    // API already scopes by subjectKind=request + subjectId; trust that list when present.
    if (useApi && (cachedReminders || apiReminders)) {
      return allReminders;
    }
    return allReminders.filter(
      (item) =>
        reminderMatches(item, "request", id) ||
        (item.subjectKind === "request" && item.subjectId === id) ||
        item.subjectId === id ||
        (item.subjectKind === "estimate" && relatedEstimates.some((e) => e.id === item.subjectId)) ||
        (item.subjectKind === "job" && relatedJobs.some((j) => j.id === item.subjectId)),
    );
  }, [allReminders, id, relatedEstimates, relatedJobs, useApi, cachedReminders, apiReminders]);

  const relatedTasks = useMemo(() => {
    if (useApi && (cachedTasks || apiTasks)) {
      return allTasks;
    }
    return allTasks.filter(
      (item) =>
        taskMatches(item, "request", id) ||
        (item.subjectKind === "request" && item.subjectId === id) ||
        item.subjectId === id ||
        (item.jobId && relatedJobs.some((j) => j.id === item.jobId)) ||
        (item.subjectKind === "job" && relatedJobs.some((j) => j.id === item.subjectId)) ||
        (item.subjectKind === "estimate" && relatedEstimates.some((e) => e.id === item.subjectId)),
    );
  }, [allTasks, id, relatedJobs, relatedEstimates, useApi, cachedTasks, apiTasks]);

  const displayedTasks = useMemo(() => {
    let list = relatedTasks;
    if (taskStatusFilter === "overdue") {
      list = list.filter((item) => taskIsOverdue(item) && item.status !== "done");
    } else if (taskStatusFilter) {
      list = list.filter((item) => item.status === taskStatusFilter);
    }
    if (taskPriorityFilter) {
      list = list.filter((item) => item.priority === taskPriorityFilter);
    }
    return list;
  }, [relatedTasks, taskStatusFilter, taskPriorityFilter]);

  const displayedReminders = useMemo(() => {
    let list = relatedReminders;
    if (reminderStatusFilter === "overdue") {
      list = list.filter((item) => reminderIsOverdue(item) && item.status !== "done");
    } else if (reminderStatusFilter) {
      list = list.filter((item) => item.status === reminderStatusFilter);
    }
    return list;
  }, [relatedReminders, reminderStatusFilter]);

  const handleTaskStatus = async (row: PortalTask, nextStatus: CrmTaskStatus) => {
    setBusyTaskRowIds((prev) => [...prev, row.id]);
    try {
      const updated = await dispatch(patchTaskStatus({ id: row.id, status: nextStatus })).unwrap();
      setApiTasks((prev) => (prev ? prev.map((t) => (t.id === row.id ? updated : t)) : [updated]));
      toast.success(`Task status updated to ${crmTaskStatusLabel(nextStatus)}.`);
      refreshTasks();
    } catch (err) {
      toast.error(typeof err === "string" ? err : err instanceof Error ? err.message : "Failed to update task status.");
    } finally {
      setBusyTaskRowIds((prev) => prev.filter((id) => id !== row.id));
    }
  };

  const confirmDeleteTask = async () => {
    if (!deletingTask || deleteTaskLoading) return;
    setDeleteTaskLoading(true);
    try {
      await dispatch(deleteTaskRecord(deletingTask.id)).unwrap();
      dispatch(removeLeadTask({ key: tabKey, taskId: deletingTask.id }));
      setApiTasks((prev) => (prev ? prev.filter((t) => t.id !== deletingTask.id) : []));
      toast.success(`${deletingTask.number} removed.`);
      setDeletingTask(null);
      refreshTasks();
    } catch (err) {
      toast.error(typeof err === "string" ? err : err instanceof Error ? err.message : "Failed to delete task.");
    } finally {
      setDeleteTaskLoading(false);
    }
  };

  const handleReminderStatus = async (row: PortalReminder, nextStatus: "open" | "done") => {
    setBusyReminderRowIds((prev) => [...prev, row.id]);
    try {
      const updated = await dispatch(patchReminderStatus({ id: row.id, status: nextStatus })).unwrap();
      dispatch(upsertLeadReminder({ key: tabKey, reminder: updated }));
      setApiReminders((prev) => (prev ? prev.map((r) => (r.id === row.id ? updated : r)) : [updated]));
      toast.success(`Reminder marked ${crmReminderStatusLabel(nextStatus).toLowerCase()}.`);
      refreshReminders();
    } catch (err) {
      toast.error(typeof err === "string" ? err : err instanceof Error ? err.message : "Failed to update reminder status.");
    } finally {
      setBusyReminderRowIds((prev) => prev.filter((id) => id !== row.id));
    }
  };

  const confirmDeleteReminder = async () => {
    if (!deletingReminder || deleteReminderLoading) return;
    setDeleteReminderLoading(true);
    try {
      await dispatch(deleteReminderRecord(deletingReminder.id)).unwrap();
      dispatch(removeLeadReminder({ key: tabKey, reminderId: deletingReminder.id }));
      setApiReminders((prev) => (prev ? prev.filter((r) => r.id !== deletingReminder.id) : []));
      toast.success("Reminder removed.");
      setDeletingReminder(null);
      refreshReminders();
    } catch (err) {
      toast.error(typeof err === "string" ? err : err instanceof Error ? err.message : "Failed to delete reminder.");
    } finally {
      setDeleteReminderLoading(false);
    }
  };

  const scheduledVisits: PortalCalendarEvent[] = useMemo(() => {
    // Only lead-scoped schedule from the lead API / cache — never the global calendar.
    if (cachedSchedules !== undefined) return cachedSchedules;
    if (apiSchedules !== undefined && apiSchedules !== null) return apiSchedules;
    return [];
  }, [cachedSchedules, apiSchedules]);

  // Local-only heal: if a visit is on the calendar but badge still says Viewed, promote in Redux.
  // Do NOT PUT /status here — that re-fetches inbox noise and fails when API rejects "scheduled".
  useEffect(() => {
    if (!request?.id) return;
    const stuck =
      request.status === "new" ||
      request.status === "viewed" ||
      request.status === "contacted";
    const visit = scheduledVisits.find((v) => Boolean(v.date));
    if (!stuck || !visit?.date) return;
    const scheduledIso = visit.date.includes("T")
      ? visit.date
      : `${visit.date}T00:00:00.000Z`;
    dispatch(
      setRequestStatusLocal({
        id: request.id,
        status: "scheduled",
        scheduledDate: request.scheduledDate || scheduledIso,
      }),
    );
    setApiLead((prev) =>
      prev
        ? {
            ...prev,
            status: "scheduled",
            scheduledDate: prev.scheduledDate || scheduledIso,
          }
        : prev,
    );
  }, [
    dispatch,
    request?.id,
    request?.status,
    request?.scheduledDate,
    scheduledVisits,
  ]);

  const handleDeleteSchedule = async (targetVisit: PortalCalendarEvent) => {
    if (!targetVisit?.id) return;
    setUnlinkingScheduleId(targetVisit.id);
    try {
      if (!targetVisit.id.startsWith("cal_")) {
        await dispatch(deleteLeadSchedule({ id: targetVisit.id, key: tabKey })).unwrap();
      } else {
        dispatch(removeLeadScheduleLocal({ key: tabKey, id: targetVisit.id }));
      }
      setApiSchedules((prev) => (prev ? prev.filter((item) => item.id !== targetVisit.id) : []));
      // Revalidate lead schedule so calendar/list stay in sync without a page refresh.
      void dispatch(
        fetchLeadSchedule({
          requestId: id,
          customerId: request?.customerId || undefined,
        }),
      )
        .unwrap()
        .then((result) => setApiSchedules(result?.events ?? []))
        .catch(() => undefined);
      toast.success("Schedule visit unlinked.");
    } catch (err) {
      toast.error(typeof err === "string" ? err : "Failed to unlink schedule.");
    } finally {
      setUnlinkingScheduleId(null);
    }
  };

  const thread =
    chat.threads.find((item) => item.requestId === request?.id) ??
    chat.threads.find(
      (item) => item.customerEmail.toLowerCase() === (request?.customerEmail ?? "").toLowerCase(),
    );

  const viewedMarkedRef = useRef<Record<string, boolean>>({});

  useEffect(() => {
    if (request?.id && request?.status === "new" && !viewedMarkedRef.current[request.id]) {
      viewedMarkedRef.current[request.id] = true;
      records.setStatus("request", request.id, "viewed");
    }
  }, [request?.id, request?.status, records]);

  useEffect(() => {
    if (tab === "messages" && thread?.unreadForProvider) chat.markRead(thread.id);
  }, [chat.markRead, tab, thread?.id, thread?.unreadForProvider]);

  const {
    joinThread,
    leaveThread,
    setTyping,
    connected,
    getPresence,
    queryUserPresence,
  } = useRealtime();
  const [startingChat, setStartingChat] = useState(false);
  const [isOtherTyping, setIsOtherTyping] = useState(false);

  useEffect(() => {
    const custId = thread?.customerUserId || request?.customerUserId;
    if (custId && /^[0-9a-fA-F]{24}$/.test(custId)) {
      queryUserPresence(custId);
    }
  }, [thread?.customerUserId, request?.customerUserId, queryUserPresence]);

  useEffect(() => {
    setIsOtherTyping(false);
    if (!thread?.id || tab !== "messages") return;

    let timer: ReturnType<typeof setTimeout>;
    const unsub = subscribeRealtime((detail) => {
      if (detail?.type === "CHAT_TYPING" && detail.payload) {
        const payload = detail.payload as {
          threadId?: string;
          from?: string;
          isTyping?: boolean;
        };
        if (payload.threadId === thread.id && payload.from !== "provider") {
          setIsOtherTyping(Boolean(payload.isTyping));
          clearTimeout(timer);
          if (payload.isTyping) {
            timer = setTimeout(() => setIsOtherTyping(false), 3500);
          }
        }
      }
    });

    return () => {
      clearTimeout(timer);
      unsub();
    };
  }, [thread?.id, tab]);

  useEffect(() => {
    if (!thread?.id || tab !== "messages") return;
    joinThread(thread.id);
    return () => leaveThread(thread.id);
  }, [joinThread, leaveThread, thread?.id, tab]);

  async function handleStartChat() {
    if (startingChat || !request) return;
    setStartingChat(true);
    try {
      await ensureProviderChatThread({
        customerName: request.customerName,
        customerEmail: request.customerEmail,
        customerId: request.customerId || null,
        requestId: request.id,
      });
      await chat.refresh();
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("rs-realtime", {
            detail: { type: "INBOX_SUMMARY_INVALIDATE" },
          }),
        );
      }
      toast.success(`Chat started with ${request.customerName}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not start chat");
    } finally {
      setStartingChat(false);
    }
  }

  // NOTE: must be declared before the early return to satisfy Rules of Hooks
  // Lead Schedule tab shows only this lead's visits — never the overall provider calendar.
  const calendarEvents = useMemo(() => {
    return [...scheduledVisits];
  }, [scheduledVisits]);

  if (!request) {
    if (pending) {
      return (
        <div className="border-border-soft bg-card" aria-busy="true">
          <CenteredSpinner label="Loading lead details" className="min-h-[28rem]" />
        </div>
      );
    }
    return (
      <div className="bg-card p-6">
        <h1 className="text-lg font-semibold">Lead not found</h1>
        <Button asChild className="mt-4" size="sm">
          <Link href="/pro/dashboard/requests">Back to leads</Link>
        </Button>
      </div>
    );
  }

  const hasEstimate =
    relatedEstimates.length > 0 ||
    request.status === "estimate_sent" ||
    request.status === "accepted" ||
    request.status === "converted_to_job";
  const hasJob =
    relatedJobs.length > 0 || request.status === "converted_to_job";
  const lead = request;
  const customerLabel = customer ? crmCustomerName(customer) : lead.customerName;
  const lost = lead.status === "declined" || lead.status === "closed";
  const isArchived = records.isArchived("request", lead.id);

  const leadAddress: ServiceAddress = customer?.addresses?.[0] ?? {
    id: `addr_${request.id}`,
    street: request.neighborhood ? request.neighborhood : (request.city || "Address pending"),
    city: request.city || "Faisalabad",
    state: request.state || "NA",
    zip: request.zip || "38000",
    country: "US",
  };

  const siteAddress = [
    customer?.addresses?.[0]?.street,
    formatLocation(
      customer?.addresses?.[0]?.city || request.city || request.neighborhood || "",
      customer?.addresses?.[0]?.state || request.state || "",
      customer?.addresses?.[0]?.zip || request.zip,
    ),
  ]
    .filter(Boolean)
    .join(", ");

  async function markContacted() {
    setApiLead((prev) => (prev ? { ...prev, status: "contacted" } : prev));
    try {
      await records.setStatus("request", lead.id, "contacted");
      toast.success("Lead marked contacted.");
    } catch {
      toast.error("Failed to update status.");
    }
  }

  async function markAccepted() {
    setApiLead((prev) => (prev ? { ...prev, status: "accepted" } : prev));
    try {
      await records.setStatus("request", lead.id, "accepted");
      toast.success("Lead marked accepted.");
    } catch {
      toast.error("Failed to update status.");
    }
  }

  async function reopenLead() {
    setApiLead((prev) => (prev ? { ...prev, status: "contacted" } : prev));
    try {
      await records.setStatus("request", lead.id, "contacted");
      toast.success("Lead reopened as active.");
    } catch {
      toast.error("Failed to reopen lead.");
    }
  }

  async function declineLead() {
    setApiLead((prev) => (prev ? { ...prev, status: "declined" } : prev));
    try {
      await records.setStatus("request", lead.id, "declined");
      toast.success("Lead declined.");
    } catch {
      toast.error("Failed to decline lead.");
    }
  }

  async function handleCalendarMove(calEvent: PortalCalendarEvent, move: CalendarMove) {
    const fallbackWindow = minutesForWindow(calEvent.timeWindow);
    const startMinutes = move.startMinutes ?? calEvent.startMinutes ?? fallbackWindow.startMinutes;
    const endMinutes = move.endMinutes ?? calEvent.endMinutes ?? fallbackWindow.endMinutes;
    const timeWin = windowFromMinutes(startMinutes, endMinutes) || calEvent.timeWindow;

    const updatedEvent: PortalCalendarEvent = {
      ...calEvent,
      date: move.date,
      endDate: move.endDate,
      startMinutes,
      endMinutes,
      timeWindow: timeWin,
    };

    // Optimistic local updates (do NOT call assign() here — it also PUTs/POSTs
    // schedule and races with updateLeadSchedule below, causing 409 collisions).
    dispatch(upsertLeadScheduleLocal({ key: tabKey, event: updatedEvent }));
    setApiSchedules((prev) => {
      const list = prev ? [...prev] : [];
      const idx = list.findIndex((e) => e.id === updatedEvent.id);
      if (idx >= 0) list[idx] = updatedEvent;
      else list.push(updatedEvent);
      return list;
    });

    const startFormatted = formatDate(move.date);
    const effectiveEndDate = move.endDate || (calEvent.endDate && calEvent.endDate > move.date ? calEvent.endDate : undefined);
    const endFormatted = effectiveEndDate && effectiveEndDate > move.date ? ` – ${formatDate(effectiveEndDate)}` : "";
    const timeFormatted = move.startMinutes != null ? ` at ${formatClock(move.startMinutes)}` : "";
    toast.success(
      `${calEvent.title}: ${startFormatted}${endFormatted}${timeFormatted}`,
    );

    // Persist to API (single write — avoids duplicate create/update races).
    const isLeadEvent =
      calEvent.kind === "request" &&
      (calEvent.recordId === id ||
        calEvent.id.startsWith("cal_") ||
        scheduledVisits.some((v) => v.id === calEvent.id));

    if (isLeadEvent) {
      try {
        if (calEvent.id && !calEvent.id.startsWith("cal_")) {
          const res = await dispatch(
            updateLeadSchedule({
              id: calEvent.id,
              key: tabKey,
              data: {
                date: move.date,
                endDate: move.endDate,
                startMinutes,
                endMinutes,
                timeWindow: timeWin,
              },
            }),
          ).unwrap();
          if (res?.event) {
            dispatch(upsertLeadScheduleLocal({ key: tabKey, event: res.event }));
            setApiSchedules((prev) => {
              const list = prev ? [...prev] : [];
              const idx = list.findIndex((e) => e.id === res.event.id);
              if (idx >= 0) list[idx] = res.event;
              else list.push(res.event);
              return list;
            });
          }
        } else if (move.date) {
          const res = await dispatch(
            bookLeadSchedule({
              key: tabKey,
              assignment: {
                recordId: id,
                kind: "request",
                title: `${request.number} · ${request.serviceName || "Visit"}`,
                date: move.date,
                endDate: move.endDate,
                startMinutes,
                endMinutes,
                timeWindow: timeWin,
                employeeId: calEvent.employeeId || null,
                contractorId: null,
                status: "scheduled",
              },
            }),
          ).unwrap();
          if (res?.event) {
            dispatch(upsertLeadScheduleLocal({ key: tabKey, event: res.event }));
            setApiSchedules((prev) => {
              const list = prev ? [...prev] : [];
              const idx = list.findIndex((e) => e.id === res.event.id);
              if (idx >= 0) list[idx] = res.event;
              else list.push(res.event);
              return list;
            });
          }
        }
      } catch (err) {
        // Rollback on network failure
        dispatch(upsertLeadScheduleLocal({ key: tabKey, event: calEvent }));
        setApiSchedules((prev) => {
          const list = prev ? [...prev] : [];
          const idx = list.findIndex((e) => e.id === calEvent.id);
          if (idx >= 0) list[idx] = calEvent;
          return list;
        });
        toast.error(typeof err === "string" ? err : "Failed to sync schedule update.");
      }
    }
  }

  return (
    <>
      <RecordWorkspace
        href={`/pro/dashboard/requests/${request.id}`}
        label={`${request.number} · ${request.serviceName}`}
        kind="request"
        tabs={TABS}
        subnavTabs={["tasks", "reminders", "notes"]}
        subnav={(activeTab) => {
          if (activeTab === "tasks") {
            return (
              <LocalFilterTabs
                flush
                value={taskStatusFilter}
                onChange={setTaskStatusFilter}
                options={TASK_FILTER_OPTIONS}
                trailing={
                  <>
                    <Select
                      value={taskPriorityFilter || "all"}
                      onValueChange={(val) => setTaskPriorityFilter(val === "all" ? "" : val)}
                    >
                      <SelectTrigger size="sm" className="h-8 w-36 py-0 text-xs leading-none bg-card border-border-soft">
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
                    <Button
                      className="h-8 shrink-0 text-xs leading-none"
                      onClick={() => { setEditingTask(null); setTaskOpen(true); }}
                    >
                      + Create task
                    </Button>
                  </>
                }
              />
            );
          }
          if (activeTab === "reminders") {
            return (
              <LocalFilterTabs
                flush
                value={reminderStatusFilter}
                onChange={setReminderStatusFilter}
                options={REMINDER_FILTER_OPTIONS}
                trailing={
                  <Button
                    className="h-8 shrink-0 text-xs leading-none"
                    onClick={() => { setEditingReminder(null); setReminderOpen(true); }}
                  >
                    + Set reminder
                  </Button>
                }
              />
            );
          }
          if (activeTab === "notes") {
            return (
              <div className="flex w-full flex-wrap items-center justify-between gap-x-4 gap-y-2">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-foreground">Notes</p>
                  <p className="text-xs text-muted-foreground">
                    Desk notes stay with this lead.
                  </p>
                </div>
                <Button
                  size="sm"
                  className="h-8 shrink-0"
                  onClick={() => setNoteOpen(true)}
                >
                  + Add note
                </Button>
              </div>
            );
          }
          return null;
        }}
        badge={
          <>
            <StatusPill label={requestStatusLabel(request.status)} tone={requestTone(request.status)} />
            <StatusPill label={request.channel === "direct" ? "Direct" : "Marketplace"} tone="neutral" />
            <ArchiveBadge kind="request" id={request.id} />
          </>
        }
        notice={<FileNotices kind="request" id={request.id} />}
        actions={
          <>
            <Button asChild variant="outline" size="sm">
              <Link href="/pro/dashboard/requests">Close</Link>
            </Button>
            {hasJob ? (
              <Button size="sm" asChild>
                <Link href={job ? `/pro/dashboard/jobs/${job.id}` : `/pro/dashboard/requests/${request.id}?tab=jobs`}>
                  {job?.number ? `Open ${job.number}` : "Open job"}
                </Link>
              </Button>
            ) : estimate ? (
              <Button size="sm" asChild>
                <Link href={`/pro/dashboard/new-estimate/${estimate.id}`}>
                  {estimate.number ? `Open ${estimate.number}` : "Open estimate"}
                </Link>
              </Button>
            ) : hasEstimate ? (
              <Button size="sm" asChild>
                <Link href={`/pro/dashboard/requests/${request.id}?tab=estimates`}>
                  View estimate
                </Link>
              </Button>
            ) : (
              <Button size="sm" onClick={() => setEstimateOpen(true)}>
                Create estimate
              </Button>
            )}
            <Button size="sm" variant="outline" asChild className="gap-1.5">
              <Link href={`/pro/dashboard/requests/${request.id}?tab=messages`}>
                <MessageSquare className="size-3.5" />
                Chat
              </Link>
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1">
                  More actions
                  <ChevronDown className="size-3.5" aria-hidden="true" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-44">
                {request.status === "new" || request.status === "viewed" ? (
                  <DropdownMenuItem onSelect={markContacted} className="gap-2 cursor-pointer text-xs">
                    <PhoneCall className="size-3.5 text-muted-foreground" />
                    Mark contacted
                  </DropdownMenuItem>
                ) : null}
                {request.status === "estimate_sent" ? (
                  <DropdownMenuItem onSelect={markAccepted} className="gap-2 cursor-pointer text-xs text-emerald-600 focus:text-emerald-600 font-medium">
                    <CheckCircle2 className="size-3.5 text-emerald-600" />
                    Mark accepted
                  </DropdownMenuItem>
                ) : null}
                {lost ? (
                  <DropdownMenuItem onSelect={reopenLead} className="gap-2 cursor-pointer text-xs text-blue-600 focus:text-blue-600">
                    <RotateCcw className="size-3.5 text-blue-600" />
                    Reopen lead
                  </DropdownMenuItem>
                ) : null}
                <DropdownMenuItem onSelect={() => setAssignOpen(true)} className="gap-2 cursor-pointer text-xs">
                  <CalendarDays className="size-3.5 text-muted-foreground" />
                  Schedule visit
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setTaskOpen(true)} className="gap-2 cursor-pointer text-xs">
                  <ListTodo className="size-3.5 text-muted-foreground" />
                  Create task
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setNoteOpen(true)} className="gap-2 cursor-pointer text-xs">
                  <NotebookPen className="size-3.5 text-muted-foreground" />
                  Add note
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setReminderOpen(true)} className="gap-2 cursor-pointer text-xs">
                  <Bell className="size-3.5 text-muted-foreground" />
                  Set reminder
                </DropdownMenuItem>
                {!lost ? (
                  <DropdownMenuItem onSelect={declineLead} className="gap-2 cursor-pointer text-xs text-red-600 focus:text-red-600">
                    <XCircle className="size-3.5 text-red-500" />
                    Decline
                  </DropdownMenuItem>
                ) : null}
                <DropdownMenuItem
                  className="gap-2 cursor-pointer text-xs"
                  onSelect={() => {
                    if (isArchived) {
                      records.unarchive("request", request.id);
                      toast.success(`${request.number} restored.`);
                    } else {
                      records.archive("request", request.id);
                      toast.success(`${request.number} archived.`);
                    }
                  }}
                >
                  {isArchived ? (
                    <ArchiveRestore className="size-3.5 text-muted-foreground" />
                  ) : (
                    <Archive className="size-3.5 text-muted-foreground" />
                  )}
                  {isArchived ? "Restore" : "Archive"}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        }
      >
        {(current) => {
          const leadTab = current as LeadTab;
          switch (leadTab) {
            case "summary":
              return (
                <div className="space-y-5">
                  <div className="flex flex-wrap items-center gap-x-6 gap-y-1.5 rounded-md border border-border-soft bg-[#f7f8fa] px-4 py-2 text-sm">
                    <span className="inline-flex min-w-0 flex-wrap items-center gap-1">
                      <span className="text-muted-foreground">Customer:</span>
                      {request.customerId ? (
                        <Link
                          href={`/pro/dashboard/customers/${request.customerId}`}
                          className="truncate font-semibold text-primary hover:underline"
                        >
                          {customerLabel?.trim() || "View customer"}
                        </Link>
                      ) : (
                        <span className="truncate font-medium text-foreground">
                          {customerLabel?.trim() || "—"}
                        </span>
                      )}
                    </span>
                    {siteAddress ? (
                      <span className="inline-flex min-w-0 flex-wrap items-center gap-1">
                        <span className="text-muted-foreground">Site:</span>
                        <span className="truncate font-medium text-foreground">{siteAddress}</span>
                      </span>
                    ) : null}
                    {(customer?.phone || request.customerPhone) ? (
                      <span className="inline-flex items-center gap-1">
                        <span className="text-muted-foreground">Phone:</span>
                        <span className="font-medium text-foreground">
                          {customer?.phone || request.customerPhone}
                        </span>
                      </span>
                    ) : null}
                    <span className="inline-flex items-center gap-1.5">
                      <span className="text-muted-foreground">Status:</span>
                      <span className="inline-flex items-center gap-1.5 font-medium text-foreground">
                        <span className="size-2 shrink-0 rounded-full bg-primary" aria-hidden />
                        {requestStatusLabel(request.status)}
                      </span>
                    </span>
                  </div>
                  <LeadCard hideHeader borderless>
                    <div className="space-y-6 px-1 py-1 sm:px-2">
                      <div>
                        <h2 className="text-base font-semibold capitalize tracking-tight text-foreground">
                          {request.serviceName}
                        </h2>
                        <p className="mt-1 text-sm text-muted-foreground">
                          #{request.number}
                          {request.categoryName ? ` · ${request.categoryName}` : ""}
                          {" · "}
                          {request.customerId ? (
                            <Link
                              href={`/pro/dashboard/customers/${request.customerId}`}
                              className="text-primary hover:underline"
                            >
                              {customerLabel}
                            </Link>
                          ) : (
                            customerLabel
                          )}
                        </p>
                      </div>

                      <div
                        className={cn(
                          "rounded-md px-3 py-2",
                          leadStatusAlertClass(request.status),
                        )}
                      >
                        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                          <p className="text-xs font-semibold">
                            {requestStatusLabel(request.status)}
                          </p>
                          <span className="text-xs opacity-40" aria-hidden="true">
                            ·
                          </span>
                          <p className="text-xs leading-snug">
                            {leadStageCopy(request.status, hasEstimate, hasJob)}
                          </p>
                        </div>
                        <p className="mt-1 text-[11px] leading-snug opacity-75">
                          {leadChannelCopy(request.channel)}
                        </p>
                      </div>

                      <div className="grid gap-x-10 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
                        <InfoRow
                          label="Source"
                          value={
                            request.channel === "direct"
                              ? "Company website"
                              : "Marketplace"
                          }
                        />
                        <InfoRow
                          label="Email"
                          value={
                            request.customerEmail?.trim() ? (
                              <span className="text-primary">{request.customerEmail}</span>
                            ) : null
                          }
                        />
                        <InfoRow label="Phone" value={request.customerPhone?.trim() || null} />
                        <InfoRow
                          label="Location"
                          value={
                            customer?.addresses?.[0]?.street
                              ? `${customer.addresses[0].street}, ${formatLocation(
                                  request.city ?? customer.addresses[0].city,
                                  request.state ?? customer.addresses[0].state,
                                  request.zip,
                                )}`
                              : formatLocation(
                                  request.neighborhood || request.city || "Address pending",
                                  request.state || "",
                                  request.zip,
                                )
                          }
                        />
                        <InfoRow
                          label="Preferred date"
                          value={request.preferredDate ? formatDate(request.preferredDate) : "Flexible"}
                        />
                        <InfoRow label="Window" value={request.preferredTimeWindow ?? "Any time"} />
                        <InfoRow label="Date created" value={formatDate(request.createdAt)} />
                        {request.scheduledDate ? (
                          <InfoRow label="Scheduled date" value={formatDate(request.scheduledDate)} />
                        ) : null}
                        {scheduledVisits.length > 0 ? (
                          <InfoRow
                            label={scheduledVisits.length > 1 ? "Scheduled visits" : "Scheduled visit"}
                            value={
                              scheduledVisits.length === 1
                                ? `${scheduledVisits[0].date ? formatDate(scheduledVisits[0].date) : "Date pending"}${scheduledVisits[0].employeeId ? ` · ${employeeLabel(scheduledVisits[0].employeeId)}` : ""}`
                                : `${scheduledVisits.length} visits (${scheduledVisits.map((v) => (v.date ? formatDate(v.date) : "Date pending")).join(", ")})`
                            }
                          />
                        ) : null}
                        <InfoRow
                          label="Amount owing"
                          value={customer?.amountOwing != null ? formatMoney(customer.amountOwing) : "$0.00"}
                        />
                        <InfoRow
                          label="Estimate total"
                          value={estimate ? formatMoney(estimate.total) : "$0.00"}
                        />
                      </div>

                      {request.answers?.length ? (
                        <div className="rounded-lg bg-[#f7f9fc] px-4 py-3.5">
                          <p className="mb-3 text-[11px] font-semibold text-[#003F7D]">Quote answers</p>
                          <dl className="grid gap-x-8 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
                            {request.answers.map((item) => (
                              <div key={item.id} className="min-w-0">
                                <dt className="text-[11px] font-medium text-muted-foreground">{item.label}</dt>
                                <dd className="mt-1 text-sm font-medium text-foreground wrap-break-word">{item.value}</dd>
                              </div>
                            ))}
                          </dl>
                          {request.details?.split("\n\n")[0] && !request.details.startsWith("Answers") ? (
                            <div className="mt-4 pt-3">
                              <p className="text-[11px] font-medium text-muted-foreground">Notes</p>
                              <p className="mt-1.5 text-sm leading-relaxed text-foreground">
                                {request.details.split("\n\n")[0]}
                              </p>
                            </div>
                          ) : null}
                        </div>
                      ) : null}

                      {request.details?.trim() && (!request.answers?.length || request.details.startsWith("Answers")) ? (
                        <div className="rounded-lg bg-[#f7f9fc] px-4 py-3.5">
                          <p className="mb-1.5 text-[11px] font-semibold text-[#003F7D]">What they asked for</p>
                          <p className="text-sm leading-relaxed whitespace-pre-wrap break-words text-foreground">
                            {request.details}
                          </p>
                        </div>
                      ) : null}
                    </div>
                  </LeadCard>

                  <CustomerLocationMapLazy
                    provider={provider}
                    address={leadAddress}
                    name={customerLabel}
                    plain
                  />
                </div>
              );
            case "estimates":
              return (
                <LeadCard hideHeader>
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm text-muted-foreground">
                        {estimatesLoading && !hasEstimatesData
                          ? "Loading estimates..."
                          : relatedEstimates.length
                            ? `${relatedEstimates.length} estimate${relatedEstimates.length === 1 ? "" : "s"} from this lead`
                            : hasEstimate
                              ? "Estimate proposal created for this lead"
                              : "No estimate yet"}
                      </p>
                      {!hasEstimate ? (
                        <Button size="sm" className="h-8" onClick={() => setEstimateOpen(true)}>
                          Create estimate
                        </Button>
                      ) : null}
                    </div>
                    {(estimatesLoading && !hasEstimatesData) || relatedEstimates.length ? (
                      <PortalDataTable
                        filename={`${request.number}-estimates`}
                        countLabel="Estimates"
                        searchPlaceholder="Search estimates"
                        loading={estimatesLoading && !hasEstimatesData}
                        rows={relatedEstimates}
                        rowKey={(row) => row.id}
                        rowHref={(row) => `/pro/dashboard/new-estimate/${row.id}`}
                        columns={[
                          {
                            id: "number",
                            header: "Quote #",
                            sortValue: (row) => row.number,
                            searchValue: (row) => row.number,
                            exportValue: (row) => row.number,
                            cell: (row) => (
                              <Link href={`/pro/dashboard/new-estimate/${row.id}`} className="font-semibold text-primary hover:underline">
                                {row.number}
                              </Link>
                            ),
                          },
                          {
                            id: "name",
                            header: "Estimate name",
                            sortValue: (row) => row.title?.trim() || "",
                            searchValue: (row) => row.title?.trim() || "",
                            exportValue: (row) => row.title?.trim() || "",
                            cell: (row) => row.title?.trim() || "—",
                          },
                          {
                            id: "issued",
                            header: "Issued",
                            sortValue: (row) => row.issuedAt,
                            searchValue: (row) => formatDate(row.issuedAt),
                            exportValue: (row) => formatDate(row.issuedAt),
                            cell: (row) => formatDate(row.issuedAt),
                          },
                          {
                            id: "siteVisit",
                            header: "Site visit",
                            sortValue: (row) => row.siteVisit?.visitedAt || "",
                            searchValue: (row) =>
                              row.siteVisit?.visitedAt
                                ? formatDate(row.siteVisit.visitedAt)
                                : "",
                            exportValue: (row) =>
                              row.siteVisit?.visitedAt
                                ? formatDate(row.siteVisit.visitedAt)
                                : "",
                            cell: (row) =>
                              row.siteVisit?.visitedAt
                                ? formatDate(row.siteVisit.visitedAt)
                                : "—",
                          },
                          {
                            id: "technician",
                            header: "Technician",
                            sortValue: (row) => {
                              const visit = row.siteVisit;
                              if (visit?.technician?.trim()) return visit.technician.trim();
                              if (visit?.employeeId) return employeeLabel(visit.employeeId);
                              return "";
                            },
                            searchValue: (row) => {
                              const visit = row.siteVisit;
                              if (visit?.technician?.trim()) return visit.technician.trim();
                              if (visit?.employeeId) return employeeLabel(visit.employeeId);
                              return "";
                            },
                            exportValue: (row) => {
                              const visit = row.siteVisit;
                              if (visit?.technician?.trim()) return visit.technician.trim();
                              if (visit?.employeeId) return employeeLabel(visit.employeeId);
                              return "";
                            },
                            cell: (row) => {
                              const visit = row.siteVisit;
                              if (visit?.technician?.trim()) return visit.technician.trim();
                              if (visit?.employeeId) {
                                const name = employeeLabel(visit.employeeId);
                                return name && name !== visit.employeeId ? name : "—";
                              }
                              return "—";
                            },
                          },
                          {
                            id: "total",
                            header: "Total",
                            sortValue: (row) => row.total,
                            searchValue: (row) => formatMoney(row.total),
                            exportValue: (row) => formatMoney(row.total),
                            className: "tabular-nums",
                            cell: (row) => formatMoney(row.total),
                          },
                          {
                            id: "status",
                            header: "Status",
                            sortValue: (row) => row.status,
                            searchValue: (row) => estimateStatusLabel(row.status),
                            exportValue: (row) => estimateStatusLabel(row.status),
                            cell: (row) => (
                              <StatusPill label={estimateStatusLabel(row.status)} className={estimateStatusTone(row.status)} />
                            ),
                          },
                        ]}
                      />
                    ) : (
                      <p className="text-sm text-muted-foreground">Write the quote from this lead once you have the scope.</p>
                    )}
                  </div>
                </LeadCard>
              );
            case "jobs":
              return (
                <LeadCard hideHeader>
                  <div>
                    {(jobsLoading && !hasJobsData) || relatedJobs.length ? (
                      <PortalDataTable
                        filename={`${request.number}-jobs`}
                        countLabel="Jobs"
                        searchPlaceholder="Search jobs"
                        loading={jobsLoading && !hasJobsData}
                        rows={relatedJobs}
                        rowKey={(row) => row.id}
                        rowHref={(row) => `/pro/dashboard/jobs/${row.id}`}
                        empty="No job yet. The customer signs the estimate, then this lead becomes a job."
                        columns={jobBoardColumns({
                          estimates: baseEstimates,
                          requests: allRequests,
                          invoices,
                          events,
                          employeeLabel,
                          customerName: (customerId) => {
                            const match = (apiCustomer && apiCustomer.id === customerId) ? apiCustomer : customers.find((item) => item.id === customerId);
                            return match ? crmCustomerName(match) : (customerId === request.customerId && (request.customerName || customerLabel)) ? (request.customerName || customerLabel) : getPortalCustomerName(provider, customerId);
                          },
                        })}
                      />
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        No job yet. The customer signs the estimate, then this lead becomes a job.
                      </p>
                    )}
                  </div>
                </LeadCard>
              );
            case "schedule": {
              const visitsCount = scheduledVisits.length;
              if (scheduleLoading && !hasScheduleData) {
                return <EventCalendarSkeleton />;
              }
              return (
                <div className="space-y-0">
                  {/* Toolbar — attached secondary bar (no floating title + gap) */}
                  <div className="-mx-4 -mt-1.5 mb-0 flex flex-wrap items-center justify-between gap-3 bg-secondary px-4 py-2">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <h2 className="text-sm font-bold text-foreground">Scheduled visits</h2>
                      {visitsCount > 0 ? (
                        <span className="text-xs font-medium text-muted-foreground">
                          {visitsCount} {visitsCount === 1 ? "visit" : "visits"}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          Site inspection, estimate walkthrough, or intake call
                        </span>
                      )}
                    </div>
                    <Button
                      className="h-8 shrink-0 text-xs leading-none"
                      onClick={() => {
                        setSelectedScheduleForEdit(null);
                        setAssignOpen(true);
                      }}
                    >
                      + Schedule visit
                    </Button>
                  </div>

                  {scheduledVisits.length > 0 ? (
                    <div className="space-y-0 border-b border-border-soft">
                      {scheduledVisits.map((v, index) => {
                        const isUnlinkingThis = unlinkingScheduleId === v.id;
                        const effectiveEnd =
                          v.endDate && v.date && v.endDate > v.date ? v.endDate : undefined;
                        return (
                          <div
                            key={v.id || index}
                            className="border-b border-border-soft bg-card px-0 py-3 last:border-b-0 sm:px-0"
                          >
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div className="min-w-0 space-y-2">
                                <div className="flex flex-wrap items-center gap-2">
                                  <CalendarDays className="size-4 shrink-0 text-primary" />
                                  <span className="text-sm font-semibold text-foreground">
                                    {visitsCount > 1 ? `Visit ${index + 1} · ` : ""}
                                    {v.date ? formatDate(v.date) : "Date pending"}
                                    {effectiveEnd ? ` – ${formatDate(effectiveEnd)}` : ""}
                                  </span>
                                  {v.status ? (
                                    <span className="rounded-md bg-secondary px-2 py-0.5 text-[11px] font-semibold capitalize text-primary">
                                      {v.status.replace(/_/g, " ")}
                                    </span>
                                  ) : null}
                                </div>
                                <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs">
                                  <p>
                                    <span className="text-muted-foreground">Time · </span>
                                    <span className="font-medium text-foreground">
                                      {timeWindowLabel(v.timeWindow)}
                                      {v.startMinutes != null
                                        ? ` · ${formatClock(v.startMinutes)}${v.endMinutes != null ? `–${formatClock(v.endMinutes)}` : ""}`
                                        : ""}
                                    </span>
                                  </p>
                                  <p>
                                    <span className="text-muted-foreground">Assigned · </span>
                                    <span className="font-medium text-foreground">
                                      {v.employeeId ? employeeLabel(v.employeeId) : "Unassigned"}
                                    </span>
                                  </p>
                                </div>
                              </div>
                              <div className="flex shrink-0 items-center gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-8 text-xs text-red-600 hover:bg-red-50 hover:text-red-700 border-border-soft"
                                  disabled={isUnlinkingThis}
                                  onClick={() => handleDeleteSchedule(v)}
                                >
                                  {isUnlinkingThis ? "Unlinking..." : "Unlink"}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-8 text-xs border-border-soft"
                                  onClick={() => {
                                    setSelectedScheduleForEdit(v);
                                    setAssignOpen(true);
                                  }}
                                >
                                  Reschedule
                                </Button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="border-b border-border-soft py-3 text-sm text-muted-foreground">
                      No visits yet. Schedule a site inspection or walkthrough from this lead.
                    </p>
                  )}

                  {/* Calendar — only this lead's visits */}
                  <EventCalendar
                    events={calendarEvents}
                    employees={employees}
                    employeeLabel={employeeLabel}
                    onMove={handleCalendarMove}
                    onEventOpen={(calEvent) => {
                      setSelectedScheduleForEdit(calEvent);
                      setAssignOpen(true);
                    }}
                  />
                </div>
              );
            }
            case "tasks":
              return (tasksLoading && !hasTasksData) || displayedTasks.length ? (
                    <PortalDataTable
                      filename={`${request.number}-tasks`}
                      countLabel="Tasks"
                      searchPlaceholder="Search tasks"
                      loading={tasksLoading && !hasTasksData}
                      rows={displayedTasks}
                      rowKey={(row) => row.id}
                      rowHref={(row) => `/pro/dashboard/tasks/${row.id}`}
                      pageSize={20}
                      busyRowIds={busyTaskRowIds}
                      empty="No tasks match this filter."
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
                          id: "assigned",
                          header: "Assigned",
                          sortValue: (row) => {
                            if (row.assignedEmployeeName) return row.assignedEmployeeName;
                            const emp = employees.find((item) => item.id === row.assignedEmployeeId);
                            return emp ? `${emp.firstName} ${emp.lastName}`.trim() : row.assignedContractorName || row.assignedVendorName || "";
                          },
                          searchValue: (row) => {
                            if (row.assignedEmployeeName) return row.assignedEmployeeName;
                            const emp = employees.find((item) => item.id === row.assignedEmployeeId);
                            return emp ? `${emp.firstName} ${emp.lastName}`.trim() : row.assignedContractorName || row.assignedVendorName || "";
                          },
                          exportValue: (row) => {
                            if (row.assignedEmployeeName) return row.assignedEmployeeName;
                            const emp = employees.find((item) => item.id === row.assignedEmployeeId);
                            return emp ? `${emp.firstName} ${emp.lastName}`.trim() : row.assignedContractorName || row.assignedVendorName || "";
                          },
                          cell: (row) => {
                            if (row.assignedEmployeeName) return row.assignedEmployeeName;
                            if (row.assignedEmployeeId) {
                              const emp = employees.find((item) => item.id === row.assignedEmployeeId);
                              if (emp) return `${emp.firstName} ${emp.lastName}`.trim();
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
                          cell: (row) => (
                            <StatusPill
                              label={crmTaskPriorityLabel(row.priority)}
                              tone={row.priority === "urgent" ? "danger" : row.priority === "high" ? "warning" : "neutral"}
                            />
                          ),
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
                              tone={
                                taskIsOverdue(row)
                                  ? "danger"
                                  : row.status === "done"
                                    ? "success"
                                    : row.status === "in_progress"
                                      ? "warning"
                                      : "primary"
                              }
                            />
                          ),
                        },
                      ]}
                      actions={(row) => [
                        { label: "Open file", href: `/pro/dashboard/tasks/${row.id}` },
                        {
                          label: "Edit task",
                          onSelect: () => {
                            setEditingTask(row);
                            setTaskOpen(true);
                          },
                        },
                        ...(row.status === "done"
                          ? [
                              {
                                label: "Reopen",
                                onSelect: () => void handleTaskStatus(row, "open"),
                              },
                            ]
                          : row.status === "in_progress"
                            ? [
                                {
                                  label: "Mark done",
                                  onSelect: () => void handleTaskStatus(row, "done"),
                                },
                                {
                                  label: "Block",
                                  onSelect: () => void handleTaskStatus(row, "blocked"),
                                },
                                {
                                  label: "Reset to open",
                                  onSelect: () => void handleTaskStatus(row, "open"),
                                },
                              ]
                            : row.status === "blocked"
                              ? [
                                  {
                                    label: "Unblock & Start",
                                    onSelect: () => void handleTaskStatus(row, "in_progress"),
                                  },
                                  {
                                    label: "Mark open",
                                    onSelect: () => void handleTaskStatus(row, "open"),
                                  },
                                  {
                                    label: "Mark done",
                                    onSelect: () => void handleTaskStatus(row, "done"),
                                  },
                                ]
                              : [
                                  {
                                    label: "Start",
                                    onSelect: () => void handleTaskStatus(row, "in_progress"),
                                  },
                                  {
                                    label: "Block",
                                    onSelect: () => void handleTaskStatus(row, "blocked"),
                                  },
                                  {
                                    label: "Mark done",
                                    onSelect: () => void handleTaskStatus(row, "done"),
                                  },
                                ]),
                        archiveRowAction(records, "task", row.id, row.number),
                        {
                          label: "Delete",
                          variant: "destructive",
                          onSelect: () => setDeletingTask(row),
                        },
                      ]}
                    />
                  ) : (
                    <div className="p-8 text-center">
                      <ListTodo className="mx-auto size-8 text-muted-foreground/60" />
                      <h4 className="mt-2 text-sm font-semibold">No tasks yet</h4>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Create a task against this lead — call back, confirm scope, or pull a permit.
                      </p>
                      <Button size="sm" className="mt-4 h-8" onClick={() => { setEditingTask(null); setTaskOpen(true); }}>
                        + Create task
                      </Button>
                    </div>
                  );
            case "reminders":
              return (remindersLoading && !hasRemindersData) || displayedReminders.length ? (
                    <PortalDataTable
                      filename={`${request.number}-reminders`}
                      countLabel="Reminders"
                      searchPlaceholder="Search reminders"
                      loading={remindersLoading && !hasRemindersData}
                      rows={displayedReminders}
                      rowKey={(row) => row.id}
                      rowHref={(row) => `/pro/dashboard/reminders/${row.id}`}
                      pageSize={20}
                      busyRowIds={busyReminderRowIds}
                      empty="No reminders match this filter."
                      columns={[
                        {
                          id: "title",
                          header: "Reminder",
                          sortValue: (row) => row.title,
                          searchValue: (row) => `${row.title} ${row.note}`,
                          exportValue: (row) => row.title,
                          cell: (row) => (
                            <div>
                              <Link href={`/pro/dashboard/reminders/${row.id}`} className="font-medium text-primary hover:underline">
                                {row.title}
                              </Link>
                              {row.note ? (
                                <p className="text-xs text-muted-foreground line-clamp-1">{row.note}</p>
                              ) : null}
                            </div>
                          ),
                        },
                        {
                          id: "assigned",
                          header: "Assigned",
                          sortValue: (row) => {
                            if (row.assignedEmployeeName) return row.assignedEmployeeName;
                            const emp = employees.find((item) => item.id === row.assignedEmployeeId);
                            return emp ? `${emp.firstName} ${emp.lastName}`.trim() : row.assignedContractorName || row.assignedVendorName || "";
                          },
                          searchValue: (row) => {
                            if (row.assignedEmployeeName) return row.assignedEmployeeName;
                            const emp = employees.find((item) => item.id === row.assignedEmployeeId);
                            return emp ? `${emp.firstName} ${emp.lastName}`.trim() : row.assignedContractorName || row.assignedVendorName || "";
                          },
                          exportValue: (row) => {
                            if (row.assignedEmployeeName) return row.assignedEmployeeName;
                            const emp = employees.find((item) => item.id === row.assignedEmployeeId);
                            return emp ? `${emp.firstName} ${emp.lastName}`.trim() : row.assignedContractorName || row.assignedVendorName || "";
                          },
                          cell: (row) => {
                            if (row.assignedEmployeeName) return row.assignedEmployeeName;
                            if (row.assignedEmployeeId) {
                              const emp = employees.find((item) => item.id === row.assignedEmployeeId);
                              if (emp) return `${emp.firstName} ${emp.lastName}`.trim();
                            }
                            if (row.assignedContractorName) return row.assignedContractorName;
                            if (row.assignedVendorName) return row.assignedVendorName;
                            return "Unassigned";
                          },
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
                          searchValue: (row) => crmReminderStatusLabel(row.status),
                          exportValue: (row) => crmReminderStatusLabel(row.status),
                          cell: (row) => (
                            <StatusPill
                              label={
                                row.status === "open" && reminderIsOverdue(row)
                                  ? "Overdue"
                                  : crmReminderStatusLabel(row.status)
                              }
                              tone={row.status === "done" ? "success" : reminderIsOverdue(row) ? "danger" : "warning"}
                            />
                          ),
                        },
                      ]}
                      actions={(row) => [
                        { label: "Open file", href: `/pro/dashboard/reminders/${row.id}` },
                        // {
                        //   label: "Edit reminder",
                        //   onSelect: () => {
                        //     setEditingReminder(row);
                        //     setReminderOpen(true);
                        //   },
                        // },
                        {
                          label: row.status === "open" ? "Mark done" : "Reopen",
                          onSelect: () => {
                            const next = row.status === "open" ? "done" : "open";
                            void handleReminderStatus(row, next);
                          },
                        },
                        {
                          label: "Delete",
                          variant: "destructive",
                          onSelect: () => setDeletingReminder(row),
                        },
                      ]}
                    />
                  ) : (
                    <div className="p-8 text-center">
                      <Bell className="mx-auto size-8 text-muted-foreground/60" />
                      <h4 className="mt-2 text-sm font-semibold">No reminders yet</h4>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Set a reminder to follow up on this lead.
                      </p>
                      <Button size="sm" className="mt-4 h-8" onClick={() => { setEditingReminder(null); setReminderOpen(true); }}>
                        + Set reminder
                      </Button>
                    </div>
                  );
            case "messages": {
              const customerName = thread?.customerName || customerLabel || request.customerName;
              const customerEmail = thread?.customerEmail || customer?.email || request.customerEmail;
              const customerPhone = thread?.customerPhone || customer?.phone || request.customerPhone;
              const customerAvatar = thread?.customerAvatar;
              const custUserId =
                thread?.customerUserId ||
                request?.customerUserId ||
                null;
              const custPresence = custUserId
                ? getPresence(custUserId)
                : undefined;
              const isCustomerOnline = custPresence?.isOnline ?? thread?.presence?.customer?.isOnline ?? thread?.isOnline ?? false;

              return (
                <div className="flex h-[calc(100vh-270px)] min-h-[520px] flex-col overflow-hidden rounded-xl bg-card">
                  {/* Chat Top Header */}
                  <header className="flex h-14 shrink-0 items-center justify-between border-b border-border-soft bg-white px-4 sm:px-6">
                    <div className="flex min-w-0 items-center gap-3">
                      {/* Customer Avatar */}
                      <div className="relative shrink-0">
                        <Avatar className="size-9 shadow-2xs ring-1 ring-border-soft">
                          {customerAvatar ? (
                            <AvatarImage
                              src={customerAvatar}
                              alt={customerName}
                            />
                          ) : null}
                          <AvatarFallback
                            className={cn(
                              "text-xs font-semibold",
                              getAvatarColor(customerName),
                            )}
                          >
                            {getInitials(customerName)}
                          </AvatarFallback>
                        </Avatar>
                        <span
                          className={cn(
                            "absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full ring-2 ring-card",
                            isCustomerOnline ? "bg-emerald-500" : "bg-muted-foreground/30",
                          )}
                          aria-label={isCustomerOnline ? "Online" : "Offline"}
                        />
                      </div>

                      {/* Contact Info */}
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h2 className="truncate text-sm font-semibold text-foreground sm:text-base">
                            {customerName}
                          </h2>
                          {isCustomerOnline ? (
                            <span className="hidden items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400 sm:inline-flex">
                              <span className="size-1.5 animate-pulse rounded-full bg-emerald-500" />
                              Online
                            </span>
                          ) : null}
                        </div>

                        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                          {customerEmail ? (
                            <a
                              href={`mailto:${customerEmail}`}
                              className="inline-flex items-center gap-1 hover:text-foreground hover:underline"
                            >
                              <Mail className="size-3 shrink-0" />
                              <span className="max-w-44 truncate sm:max-w-xs">
                                {customerEmail}
                              </span>
                            </a>
                          ) : null}

                          {customerPhone ? (
                            <a
                              href={`tel:${customerPhone}`}
                              className="inline-flex items-center gap-1 hover:text-foreground hover:underline"
                            >
                              <Phone className="size-3 shrink-0" />
                              <span>{customerPhone}</span>
                            </a>
                          ) : null}
                        </div>
                      </div>
                    </div>

                    {/* Actions Header */}
                    <div className="flex items-center gap-2">
                      {thread ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="hidden sm:inline-flex gap-1.5 text-xs font-medium"
                          asChild
                        >
                          <Link href={`/pro/dashboard/messages?thread=${thread.id}`}>
                            <ExternalLink className="size-3.5" />
                            Open in Messages
                          </Link>
                        </Button>
                      ) : null}
                      <Button
                        size="sm"
                        className="gap-1.5 bg-[#003F7D] text-white hover:bg-[#003264] text-xs font-medium"
                        asChild
                      >
                        <Link href={`/pro/dashboard/new-estimate/new?request=${request.id}`}>
                          <FilePlus2 className="size-3.5" />
                          <span className="hidden sm:inline">Write</span> Estimate
                        </Link>
                      </Button>
                    </div>
                  </header>

                  {/* Chat Panel or Initializer / Skeleton */}
                  {chat.loading && !thread ? (
                    <ChatPanelSkeleton />
                  ) : thread ? (
                    <ChatPanel
                      messages={thread.messages}
                      self="provider"
                      recipientUnreadCount={thread.unreadForCustomer}
                      otherName={customerName}
                      otherAvatar={customerAvatar}
                      isOtherTyping={isOtherTyping}
                      otherTypingName={customerName}
                      onSend={async (text, attachments) => {
                        await chat.send(thread.id, "provider", text, attachments);
                        if (request.status === "new" || request.status === "viewed") {
                          records.setStatus("request", request.id, "contacted");
                        }
                      }}
                      onTypingChange={(isTyping) => setTyping(thread.id, isTyping)}
                    />
                  ) : (
                    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
                      <div className="flex size-14 items-center justify-center rounded-2xl bg-[#003F7D]/10 text-[#003F7D]">
                        <MessageSquare className="size-7" />
                      </div>
                      <div className="max-w-md">
                        <h3 className="text-base font-semibold text-foreground">
                          Start conversation with {customerName}
                        </h3>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Directly message {customerName} regarding their inquiry for {request.serviceName}. The customer will be notified in their portal immediately.
                        </p>
                      </div>
                      <Button
                        disabled={startingChat}
                        onClick={handleStartChat}
                        className="gap-2 bg-[#003F7D] text-white hover:bg-[#003264] text-xs font-medium"
                      >
                        {startingChat ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <MessageSquare className="size-4" />
                        )}
                        Start conversation
                      </Button>
                    </div>
                  )}
                </div>
              );
            }
            case "notes":
              return (
                <LeadCard hideHeader>
                  <NotesPanel
                    kind="request"
                    id={request.id}
                    showAddInToolbar={false}
                    empty="Add the first note on this lead."
                  />
                </LeadCard>
              );
            case "photos":
              return (
                <LeadCard hideHeader>
                  <div>
                    {photosLoading && !hasPhotosData ? (
                      <CenteredSpinner label="Loading photos…" className="min-h-[12rem]" />
                    ) : hasPhotosData ? (
                      <div className="space-y-3">
                        <p className="text-sm text-muted-foreground">
                          {request.photoUrls.length} photo
                          {request.photoUrls.length === 1 ? "" : "s"} from the customer
                          request.
                        </p>
                        <div className="grid gap-3 sm:grid-cols-2">
                          {request.photoUrls.map((src) => (
                            <a
                              key={src}
                              href={src}
                              target="_blank"
                              rel="noreferrer"
                              className="relative block h-56 overflow-hidden rounded-lg bg-muted/30 transition hover:opacity-90"
                            >
                              <Image
                                src={src}
                                alt={request.serviceName}
                                fill
                                className="object-cover"
                                sizes="(min-width: 640px) 50vw, 100vw"
                                unoptimized={src.startsWith("http")}
                              />
                            </a>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        No photos came in with this request.
                      </p>
                    )}
                  </div>
                </LeadCard>
              );
            default: {
              const _never: never = leadTab;
              return _never;
            }
          }
        }}
      </RecordWorkspace>
      <ConvertLeadToEstimateDialog
        open={estimateOpen}
        onOpenChange={setEstimateOpen}
        lead={lead}
        onConverted={() => {
          refreshEstimates();
          if (typeof window !== "undefined") {
            window.dispatchEvent(
              new CustomEvent("rs-realtime", {
                detail: { type: "INBOX_SUMMARY_INVALIDATE" },
              }),
            );
          }
          toast.success(
            "Estimate created as Draft. Click Finalize & send to email the customer.",
          );
        }}
      />
      <AssignEventDialog
        open={assignOpen}
        onOpenChange={(next) => {
          setAssignOpen(next);
          if (!next) setSelectedScheduleForEdit(null);
        }}
        event={
          selectedScheduleForEdit ?? {
            id: `cal_${id}_new`,
            kind: "request",
            recordId: id,
            title: `${request.number} · ${request.serviceName || "Visit"}`,
            detail: request.serviceName || "Site visit",
            customerName: request.customerName,
            date: request.preferredDate || "",
            timeWindow: windowFromLabel(request.preferredTimeWindow),
            href: `/pro/dashboard/requests/${id}`,
            status: "scheduled",
          }
        }
        events={calendarEvents}
        employees={employees}
        defaultDate={request.preferredDate}
        onSave={async (assignment) => {
          const isContractor = contractors.some((c) => c.id === assignment.employeeId);
          try {
            let savedEvent: PortalCalendarEvent;
            const isEditing =
              Boolean(selectedScheduleForEdit?.id) &&
              !selectedScheduleForEdit!.id.startsWith("cal_");

            if (isEditing) {
              const res = await dispatch(
                updateLeadSchedule({
                  id: selectedScheduleForEdit!.id,
                  key: tabKey,
                  data: {
                    date: assignment.date,
                    endDate: assignment.endDate,
                    startMinutes: assignment.startMinutes ?? 540,
                    endMinutes: assignment.endMinutes ?? 660,
                    timeWindow: assignment.timeWindow,
                    employeeId: isContractor ? null : assignment.employeeId,
                    contractorId: isContractor ? assignment.employeeId : null,
                    status: "scheduled",
                  },
                }),
              ).unwrap();
              savedEvent = res.event;
            } else {
              const res = await dispatch(
                bookLeadSchedule({
                  key: tabKey,
                  assignment: {
                    recordId: request.id,
                    kind: "request",
                    title: `${request.number} · ${request.serviceName || "Visit"}`,
                    date: assignment.date,
                    endDate: assignment.endDate,
                    startMinutes: assignment.startMinutes ?? 540,
                    endMinutes: assignment.endMinutes ?? 660,
                    timeWindow: assignment.timeWindow,
                    employeeId: isContractor ? null : assignment.employeeId,
                    contractorId: isContractor ? assignment.employeeId : null,
                    status: "scheduled",
                  },
                }),
              ).unwrap();
              savedEvent = res.event;
            }
            dispatch(upsertLeadScheduleLocal({ key: tabKey, event: savedEvent }));
            setApiSchedules((prev) => {
              const list = prev ? [...prev] : [];
              const idx = list.findIndex((e) => e.id === savedEvent.id);
              if (idx >= 0) list[idx] = savedEvent;
              else list.push(savedEvent);
              return list;
            });
            // Revalidate so list + calendar reflect the latest server state immediately.
            void dispatch(
              fetchLeadSchedule({
                requestId: id,
                customerId: request?.customerId || undefined,
              }),
            )
              .unwrap()
              .then((result) => setApiSchedules(result?.events ?? []))
              .catch(() => undefined);
            // Do not call assign() again — bookLeadSchedule/updateLeadSchedule
            // already persisted the calendar row (avoids collision + status races).
            const scheduledIso = assignment.date
              ? `${assignment.date}T00:00:00.000Z`
              : undefined;
            if (scheduledIso) {
              // Update Redux/detail from schedule response only — no View/Details reload,
              // no status PUT (assignSchedule already sets scheduled on the server).
              dispatch(
                setRequestStatusLocal({
                  id: request.id,
                  status: "scheduled",
                  scheduledDate: scheduledIso,
                }),
              );
              setApiLead((prev) =>
                prev
                  ? { ...prev, status: "scheduled", scheduledDate: scheduledIso }
                  : prev,
              );
            }
            toast.success(isEditing ? "Visit rescheduled." : "Visit scheduled on the calendar.");
            setSelectedScheduleForEdit(null);
          } catch (err) {
            // Re-throw so AssignEventDialog handles collision or error display nicely
            throw err;
          }
        }}
      />
      <CreateTaskDialog
        open={taskOpen || Boolean(editingTask)}
        task={editingTask}
        subjectKind="request"
        subjectId={request.id}
        onOpenChange={(next) => {
          setTaskOpen(next);
          if (!next) setEditingTask(null);
        }}
        onCreated={(saved) => {
          if (saved) {
            dispatch(upsertLeadTask({ key: tabKey, task: saved }));
            setApiTasks((prev) => [saved, ...(prev || []).filter((t) => t.id !== saved.id)]);
            crm.addTask?.(saved);
          }
          refreshTasks();
          if (crm.enabled) void crm.refresh({ silent: true });
        }}
      />
      <CreateReminderDialog
        open={reminderOpen || Boolean(editingReminder)}
        reminder={editingReminder}
        onOpenChange={(next) => {
          setReminderOpen(next);
          if (!next) setEditingReminder(null);
        }}
        subjectKind="request"
        subjectId={request.id}
        onCreated={(saved) => {
          if (saved) {
            dispatch(upsertLeadReminder({ key: tabKey, reminder: saved }));
            setApiReminders((prev) => [saved, ...(prev || []).filter((r) => r.id !== saved.id)]);
            crm.addReminder?.(saved);
          }
          refreshReminders();
          if (crm.enabled) void crm.refresh({ silent: true });
        }}
      />
      <CreateNoteDialog
        open={noteOpen}
        onOpenChange={setNoteOpen}
        subjectKind="request"
        subjectId={request.id}
      />
      <DeleteConfirmDialog
        open={Boolean(deletingTask)}
        onOpenChange={(open) => {
          if (!open && !deleteTaskLoading) setDeletingTask(null);
        }}
        title="Delete task?"
        description={
          deletingTask
            ? `This will permanently remove “${deletingTask.number} · ${deletingTask.title}”.`
            : "This will permanently remove this task."
        }
        confirmLabel="Delete"
        loading={deleteTaskLoading}
        onConfirm={confirmDeleteTask}
      />
      <DeleteConfirmDialog
        open={Boolean(deletingReminder)}
        onOpenChange={(open) => {
          if (!open && !deleteReminderLoading) setDeletingReminder(null);
        }}
        title="Delete reminder?"
        description={
          deletingReminder
            ? `This will permanently remove “${deletingReminder.title}”.`
            : "This will permanently remove this reminder."
        }
        confirmLabel="Delete"
        loading={deleteReminderLoading}
        onConfirm={confirmDeleteReminder}
      />
    </>
  );
}
