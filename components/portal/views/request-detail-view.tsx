"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Archive,
  ArchiveRestore,
  Bell,
  Briefcase,
  Building2,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Clock,
  ExternalLink,
  FilePlus2,
  FileText,
  ImageIcon,
  Info,
  LayoutDashboard,
  ListTodo,
  Loader2,
  Mail,
  MapPin,
  MessageCircle,
  MessageSquare,
  NotebookPen,
  Phone,
  PhoneCall,
  Receipt,
  RotateCcw,
  Search,
  Settings,
  UserRound,
  Wallet,
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
import { EventCalendar, type CalendarMove } from "@/components/portal/event-calendar";
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
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { getAvatarColor, getInitials } from "@/lib/chat-format";
import { CrmMark } from "@/components/portal/crm-mark";
import { CustomerLocationMapLazy } from "@/components/portal/customer-location-map-lazy";
import {
  crmCustomerName,
  crmReminderStatusLabel,
  crmSourceLabel,
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
  { id: "summary", label: "Summary", icon: LayoutDashboard },
  { id: "customer", label: "Customer", icon: UserRound },
  { id: "qualify", label: "Qualify", icon: Settings },
  { id: "estimates", label: "Estimates", icon: FileText },
  { id: "jobs", label: "Jobs", icon: Briefcase },
  { id: "schedule", label: "Schedule", icon: CalendarDays },
  { id: "tasks", label: "Tasks", icon: ListTodo },
  { id: "reminders", label: "Reminders", icon: Bell },
  { id: "messages", label: "Messages", icon: MessageCircle },
  { id: "notes", label: "Notes", icon: NotebookPen },
  { id: "photos", label: "Photos", icon: ImageIcon },
];

type LeadTab =
  | "summary"
  | "customer"
  | "qualify"
  | "estimates"
  | "jobs"
  | "schedule"
  | "tasks"
  | "reminders"
  | "messages"
  | "notes"
  | "photos";

const LEAD_STEPS = [
  { id: "new", label: "New" },
  { id: "contacted", label: "Contacted" },
  { id: "estimate", label: "Estimate" },
  { id: "won", label: "Won" },
  { id: "job", label: "Job" },
] as const;

const LEAD_WINDOWS: { value: PortalTimeWindow; label: string }[] = [
  { value: "morning", label: "Morning" },
  { value: "afternoon", label: "Afternoon" },
  { value: "all_day", label: "All Day" },
];
const LEAD_STATUSES: RequestStatus[] = [
  "new",
  "viewed",
  "contacted",
  "estimate_sent",
  "accepted",
  "declined",
  "converted_to_job",
  "closed",
];

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

function leadFlowIndex(status: RequestStatus, hasEstimate: boolean, hasJob: boolean) {
  if (hasJob || status === "converted_to_job") return 4;
  if (status === "accepted") return 3;
  if (status === "estimate_sent" || hasEstimate) return 2;
  if (status === "contacted" || status === "viewed") return 1;
  if (status === "declined" || status === "closed") return 0;
  return 0;
}

function getAvailableLeadStatuses(
  status: RequestStatus,
  hasEstimate: boolean,
  hasJob: boolean,
): RequestStatus[] {
  if (hasJob || status === "converted_to_job") {
    return ["converted_to_job", "closed"];
  }
  if (status === "accepted") {
    return ["accepted", "converted_to_job", "declined", "closed"];
  }
  if (hasEstimate || status === "estimate_sent") {
    return ["estimate_sent", "accepted", "converted_to_job", "declined"];
  }
  if (status === "contacted") {
    return ["contacted", "estimate_sent", "declined"];
  }
  if (status === "viewed") {
    return ["viewed", "contacted", "estimate_sent", "declined"];
  }
  if (status === "declined") {
    return ["declined", "contacted"];
  }
  if (status === "closed") {
    return ["closed", "contacted"];
  }
  return ["new", "viewed", "contacted", "estimate_sent", "declined"];
}

function leadStageCopy(status: RequestStatus, hasEstimate: boolean, hasJob: boolean) {
  if (hasJob || status === "converted_to_job") return "This lead became a job. The signed scope is on the jobs board.";
  if (status === "declined") return "They passed. Keep the file for history or reopen it if they call back.";
  if (status === "closed") return "Closed without a job.";
  if (status === "accepted") return "They accepted. Start the job from the signed estimate.";
  if (status === "estimate_sent" || hasEstimate) return "A quote is on this lead. Follow up if they have not signed.";
  if (status === "contacted") return "You spoke with them. Qualify the work, then write the estimate.";
  if (status === "viewed") return "Seen in the inbox. Call or text so this does not go cold.";
  return "New inbound request. Review their answers, then send a written estimate if you can take it.";
}

function windowFromLabel(value?: string): PortalTimeWindow {
  const label = value?.toLowerCase() ?? "";
  if (label.includes("morning")) return "morning";
  if (label.includes("afternoon") || label.includes("evening")) return "afternoon";
  return "all_day";
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
  const { events, employees: crewEmployees, assign, employeeLabel } = usePortalCrew();
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
  const [customerLoading, setCustomerLoading] = useState(false);
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
  const [unlinkingScheduleId, setUnlinkingScheduleId] = useState<string | null>(null);
  const [selectedScheduleForEdit, setSelectedScheduleForEdit] = useState<PortalCalendarEvent | null>(null);
  const loadedTabsRef = useRef<{
    customer?: string;
    estimates?: string;
    jobs?: string;
    tasks?: string;
    reminders?: string;
    schedule?: string;
  }>({});

  const reduxRequests = useAppSelector((state) => state.requests);
  const cachedLead = reduxRequests.detailsCache[id];
  const allRequests = records.mergeRequests(requests);
  const request = cachedLead || apiLead || allRequests.find((item) => item.id === id);

  const tabKey = leadTabCacheKey(id, request?.customerId);
  const cachedCustomer = request?.customerId ? reduxRequests.customerCache[request.customerId] : undefined;
  const cachedEstimates = reduxRequests.estimatesCache[tabKey];
  const cachedJobs = reduxRequests.jobsCache[tabKey];
  const cachedTasks = reduxRequests.tasksCache[tabKey];
  const cachedReminders = reduxRequests.remindersCache[tabKey];
  const cachedSchedules = reduxRequests.scheduleCache[tabKey];

  const hasCustomerCached = Boolean(cachedCustomer);
  const hasEstimatesCached = Boolean(cachedEstimates);
  const hasJobsCached = Boolean(cachedJobs);
  const hasTasksCached = Boolean(cachedTasks);
  const hasRemindersCached = Boolean(cachedReminders);
  const hasScheduleCached = cachedSchedules !== undefined;

  useEffect(() => {
    let cancelled = false;
    if (!cachedLead) {
      setApiLoading(true);
    }
    void dispatch(fetchRequestDetail(id))
      .unwrap()
      .then((item) => {
        if (!cancelled && item) {
          setApiLead(item);
          // Backend GET auto-transitions status to "viewed", refresh badge counters
          if (typeof window !== "undefined") {
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
  }, [id, dispatch, Boolean(cachedLead)]);

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
    return baseEstimates.filter(
      (item) =>
        item.requestId === id ||
        (estId && item.id === estId) ||
        (request?.customerId && item.customerId === request.customerId),
    );
  }, [baseEstimates, id, request]);

  const baseJobs = useMemo(() => {
    if (useApi) return cachedJobs ?? apiJobs ?? [];
    return allJobs;
  }, [useApi, cachedJobs, apiJobs, allJobs]);

  const relatedJobs = useMemo(() => {
    const estId = (request as { estimateId?: string })?.estimateId;
    const jId = (request as { jobId?: string })?.jobId;
    return baseJobs.filter(
      (item) =>
        (item as { requestId?: string }).requestId === id ||
        (request?.customerId && item.customerId === request.customerId) ||
        relatedEstimates.some((estimate) => estimate.id === item.estimateId) ||
        (estId && item.estimateId === estId) ||
        (jId && item.id === jId),
    );
  }, [baseJobs, id, request, relatedEstimates]);

  const estimate = relatedEstimates[0];
  const job = relatedJobs[0];

  const refreshEstimates = useCallback(() => {
    if (!hasEstimatesCached) setEstimatesLoading(true);
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
  }, [id, request?.customerId, dispatch, hasEstimatesCached]);

  const refreshJobs = useCallback(() => {
    if (!hasJobsCached) setJobsLoading(true);
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
  }, [id, request?.customerId, dispatch, hasJobsCached]);

  const refreshTasks = useCallback(() => {
    if (!hasTasksCached) setTasksLoading(true);
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
  }, [id, request?.customerId, dispatch, hasTasksCached]);

  const refreshReminders = useCallback(() => {
    if (!hasRemindersCached) setRemindersLoading(true);
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
  }, [id, request?.customerId, dispatch, hasRemindersCached]);

  // Fetch data per tab or when lead status indicates estimate/job exists
  useEffect(() => {
    let cancelled = false;

    // 1. Customer tab active -> fetch customer if linked
    if (tab === "customer" && request?.customerId) {
      if (loadedTabsRef.current.customer !== request.customerId) {
        loadedTabsRef.current.customer = request.customerId;
        if (!cachedCustomer) setCustomerLoading(true);
        void dispatch(fetchLeadCustomer(request.customerId))
          .unwrap()
          .then((cust) => {
            if (!cancelled && cust) setApiCustomer(cust);
          })
          .catch(() => undefined)
          .finally(() => {
            if (!cancelled) setCustomerLoading(false);
          });
      }
    }

    // 2. Estimates tab active OR status indicates estimate exists -> fetch estimates for this lead
    const shouldFetchEstimates =
      tab === "estimates" ||
      tab === "jobs" ||
      request?.status === "estimate_sent" ||
      request?.status === "accepted" ||
      request?.status === "converted_to_job";

    const estimatesFetchKey = `${id}_${request?.customerId || "none"}`;
    if (shouldFetchEstimates && (id || request?.customerId)) {
      if (loadedTabsRef.current.estimates !== estimatesFetchKey) {
        loadedTabsRef.current.estimates = estimatesFetchKey;
        if (!cachedEstimates) setEstimatesLoading(true);
        void dispatch(
          fetchLeadEstimates({
            customerId: request?.customerId || undefined,
            requestId: id,
          }),
        )
          .unwrap()
          .then((result) => {
            if (!cancelled && result?.items) {
              setApiEstimates(result.items);
            }
          })
          .catch(() => undefined)
          .finally(() => {
            if (!cancelled) setEstimatesLoading(false);
          });
      }
    }

    // 3. Jobs tab active -> fetch jobs for this lead
    const jobsFetchKey = `${id}_${request?.customerId || "none"}`;
    if ((tab === "jobs" || request?.status === "converted_to_job") && (id || request?.customerId)) {
      if (loadedTabsRef.current.jobs !== jobsFetchKey) {
        loadedTabsRef.current.jobs = jobsFetchKey;
        if (!cachedJobs) setJobsLoading(true);
        void dispatch(
          fetchLeadJobs({
            customerId: request?.customerId || undefined,
            requestId: id,
          }),
        )
          .unwrap()
          .then((result) => {
            if (!cancelled && result?.items) {
              setApiJobs(result.items);
            }
          })
          .catch(() => undefined)
          .finally(() => {
            if (!cancelled) setJobsLoading(false);
          });
      }
    }

    // 4. Tasks: fetch on lead load or when tab is active
    const taskFetchKey = `${id}_${request?.customerId || "none"}`;
    if (id && loadedTabsRef.current.tasks !== taskFetchKey) {
      loadedTabsRef.current.tasks = taskFetchKey;
      if (!cachedTasks) setTasksLoading(true);
      void dispatch(
        fetchLeadTasks({
          customerId: request?.customerId || undefined,
          requestId: id,
        }),
      )
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

    // 5. Reminders: fetch on lead load or when tab is active
    const reminderFetchKey = `${id}_${request?.customerId || "none"}`;
    if (id && loadedTabsRef.current.reminders !== reminderFetchKey) {
      loadedTabsRef.current.reminders = reminderFetchKey;
      if (!cachedReminders) setRemindersLoading(true);
      void dispatch(
        fetchLeadReminders({
          customerId: request?.customerId || undefined,
          requestId: id,
        }),
      )
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

    // 6. Schedule: fetch on lead load or when tab is active
    const scheduleFetchKey = `${id}_${request?.customerId || "none"}`;
    if (id && loadedTabsRef.current.schedule !== scheduleFetchKey) {
      loadedTabsRef.current.schedule = scheduleFetchKey;
      if (!hasScheduleCached) setScheduleLoading(true);
      void dispatch(
        fetchLeadSchedule({
          requestId: id,
          customerId: request?.customerId || undefined,
        }),
      )
        .unwrap()
        .then((result) => {
          if (!cancelled && result?.events) {
            setApiSchedules(result.events);
          }
        })
        .catch(() => undefined)
        .finally(() => {
          if (!cancelled) setScheduleLoading(false);
        });
    }

    return () => {
      cancelled = true;
    };
  }, [
    tab,
    id,
    request?.customerId,
    request?.status,
    crm,
    dispatch,
    Boolean(cachedCustomer),
    Boolean(cachedEstimates),
    Boolean(cachedJobs),
    Boolean(cachedTasks),
    Boolean(cachedReminders),
    hasScheduleCached,
  ]);

  const allReminders = useMemo(() => {
    if (useApi) return cachedReminders ?? apiReminders ?? [];
    return reminders;
  }, [useApi, cachedReminders, apiReminders, reminders]);

  const allTasks = useMemo(() => {
    if (useApi) return cachedTasks ?? apiTasks ?? [];
    return tasks;
  }, [useApi, cachedTasks, apiTasks, tasks]);

  const relatedReminders = useMemo(() => {
    return allReminders.filter(
      (item) =>
        reminderMatches(item, "request", id) ||
        item.subjectId === id ||
        (request?.customerId &&
          (item.customerId === request.customerId ||
            item.subjectId === request.customerId ||
            reminderMatches(item, "customer", request.customerId))) ||
        (item.subjectKind === "estimate" && relatedEstimates.some((e) => e.id === item.subjectId)) ||
        (item.subjectKind === "job" && relatedJobs.some((j) => j.id === item.subjectId)),
    );
  }, [allReminders, id, request?.customerId, relatedEstimates, relatedJobs]);

  const relatedTasks = useMemo(() => {
    return allTasks.filter(
      (item) =>
        taskMatches(item, "request", id) ||
        item.subjectId === id ||
        (request?.customerId &&
          (item.customerId === request.customerId ||
            item.subjectId === request.customerId ||
            taskMatches(item, "customer", request.customerId))) ||
        (item.jobId && relatedJobs.some((j) => j.id === item.jobId)) ||
        (item.subjectKind === "job" && relatedJobs.some((j) => j.id === item.subjectId)) ||
        (item.subjectKind === "estimate" && relatedEstimates.some((e) => e.id === item.subjectId)),
    );
  }, [allTasks, id, request?.customerId, relatedJobs, relatedEstimates]);

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
    if (cachedSchedules !== undefined) return cachedSchedules;
    if (apiSchedules !== undefined && apiSchedules !== null) return apiSchedules;
    return events.filter(
      (item) => item.kind === "request" && (item.recordId === id || item.id === `cal_${id}`),
    );
  }, [cachedSchedules, apiSchedules, events, id]);

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
      toast.success("Schedule visit unlinked.");
    } catch (err) {
      toast.error(typeof err === "string" ? err : "Failed to unlink schedule.");
    } finally {
      setUnlinkingScheduleId(null);
    }
  };

  const defaultRequestEvent: PortalCalendarEvent = {
    id: `cal_${id}`,
    kind: "request",
    recordId: id,
    title: request?.number ?? "Lead",
    detail: request?.serviceName ?? "",
    customerName: request?.customerName,
    date: request?.preferredDate,
    timeWindow: windowFromLabel(request?.preferredTimeWindow),
    href: `/pro/dashboard/requests/${id}`,
    status: request?.status ?? "new",
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
    const custId = thread?.customerId || request?.customerId;
    if (custId && /^[0-9a-fA-F]{24}$/.test(custId)) {
      queryUserPresence(custId);
    }
  }, [thread?.customerId, request?.customerId, queryUserPresence]);

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
  const calendarEvents = useMemo(() => {
    const list = events.filter(
      (item) =>
        !(
          item.kind === "request" &&
          (item.recordId === id ||
            item.id === `cal_${id}` ||
            scheduledVisits.some((v) => v.id === item.id))
        ),
    );
    if (scheduledVisits.length > 0) {
      list.push(...scheduledVisits);
    } else if (defaultRequestEvent.date) {
      list.push(defaultRequestEvent);
    }
    return list;
  }, [events, scheduledVisits, id, defaultRequestEvent]);

  if (!request) {
    if (pending) {
      return (
        <div className="border border-black/15 bg-card" aria-busy="true">
          <CenteredSpinner label="Loading lead details" className="min-h-[28rem]" />
        </div>
      );
    }
    return (
      <div className="border border-black/15 bg-card p-6">
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

    // 1. Instant optimistic updates in local React state and Redux cache:
    dispatch(upsertLeadScheduleLocal({ key: tabKey, event: updatedEvent }));
    setApiSchedules((prev) => {
      const list = prev ? [...prev] : [];
      const idx = list.findIndex((e) => e.id === updatedEvent.id);
      if (idx >= 0) list[idx] = updatedEvent;
      else list.push(updatedEvent);
      return list;
    });

    // 2. Keep portal crew in sync
    assign({
      kind: calEvent.kind,
      recordId: calEvent.recordId,
      date: move.date,
      endDate: move.endDate,
      startMinutes,
      endMinutes,
      timeWindow: timeWin,
      employeeId: calEvent.employeeId ?? "",
    });

    const startFormatted = formatDate(move.date);
    const effectiveEndDate = move.endDate || (calEvent.endDate && calEvent.endDate > move.date ? calEvent.endDate : undefined);
    const endFormatted = effectiveEndDate && effectiveEndDate > move.date ? ` – ${formatDate(effectiveEndDate)}` : "";
    const timeFormatted = move.startMinutes != null ? ` at ${formatClock(move.startMinutes)}` : "";
    toast.success(
      `${calEvent.title}: ${startFormatted}${endFormatted}${timeFormatted}`,
    );

    // 3. Persist to API in background:
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
                <Link href={`/pro/dashboard/estimates/${estimate.id}`}>
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
                <div className="space-y-4">
                  <LeadPipeline status={request.status} hasEstimate={hasEstimate} hasJob={hasJob} />
                  <div
                    className={cn(
                      "flex items-center gap-2.5 rounded-lg border px-4 py-2.5 text-xs font-medium",
                      lost
                        ? "border-red-200 bg-red-50 text-red-950"
                        : "border-black/10 bg-[#e8eef5]/60 text-[#003F7D]",
                    )}
                  >
                    <Info className="size-4 shrink-0 text-[#003F7D]/70" aria-hidden="true" />
                    <span>{leadStageCopy(request.status, hasEstimate, hasJob)}</span>
                  </div>
                  <div className="grid gap-4 lg:grid-cols-[1.35fr_0.85fr]">
                    <section className="overflow-hidden rounded-lg border border-black/10 bg-card shadow-[0_10px_28px_rgba(4,26,54,0.07)]">
                      <header className="flex items-center gap-4 border-b border-black/10 bg-[linear-gradient(180deg,#f8fafc_0%,#fff_100%)] px-5 py-4">
                        <CrmMark
                          name={request.serviceName || "Lead"}
                          kind="person"
                          photoKey={request.serviceName}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h2 className="text-lg font-semibold capitalize tracking-tight">
                              {request.serviceName}
                            </h2>
                            <StatusPill
                              label={request.channel === "direct" ? "Direct" : "Marketplace"}
                              tone="primary"
                            />
                            {request.categoryName ? (
                              <StatusPill label={request.categoryName} tone="neutral" />
                            ) : null}
                          </div>
                          <p className="mt-1 text-sm text-muted-foreground">
                            #{request.number} · {customerLabel}
                            {request.customerEmail ? ` · ${request.customerEmail}` : ""}
                          </p>
                        </div>
                      </header>
                      <div className="grid sm:grid-cols-2">
                        <InfoRow
                          icon={Building2}
                          label="Source"
                          value={request.channel === "direct" ? "Website request" : "Marketplace lead"}
                        />
                        {request.customerEmail?.trim() ? (
                          <InfoRow
                            icon={Mail}
                            label="Email"
                            value={<span className="text-primary">{request.customerEmail}</span>}
                          />
                        ) : null}
                        {request.customerPhone?.trim() ? (
                          <InfoRow icon={Phone} label="Phone" value={request.customerPhone} />
                        ) : null}
                        <InfoRow
                          icon={MapPin}
                          label="Street / Area"
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
                          icon={CalendarDays}
                          label="Preferred date"
                          value={request.preferredDate ? formatDate(request.preferredDate) : "Flexible"}
                        />
                        <InfoRow
                          icon={Clock}
                          label="Window"
                          value={request.preferredTimeWindow ?? "Any time"}
                        />
                        <InfoRow
                          icon={CalendarDays}
                          label="Date created"
                          value={formatDate(request.createdAt)}
                        />
                        {scheduledVisits.length > 0 ? (
                          <InfoRow
                            icon={CalendarDays}
                            label={scheduledVisits.length > 1 ? "Scheduled visits" : "Scheduled visit"}
                            value={
                              scheduledVisits.length === 1
                                ? `${scheduledVisits[0].date ? formatDate(scheduledVisits[0].date) : "Date pending"}${scheduledVisits[0].employeeId ? ` · ${employeeLabel(scheduledVisits[0].employeeId)}` : ""}`
                                : `${scheduledVisits.length} visits (${scheduledVisits.map((v) => (v.date ? formatDate(v.date) : "Date pending")).join(", ")})`
                            }
                          />
                        ) : null}
                        {request.answers?.length ? (
                          <div className="sm:col-span-2 border-b border-black/5 bg-[#f8fafc] px-5 py-4">
                            <p className="text-[10px] font-semibold tracking-[0.12em] text-muted-foreground uppercase mb-3">
                              Quote answers
                            </p>
                            <dl className="grid gap-2 sm:grid-cols-2">
                              {request.answers.map((item) => (
                                <div
                                  key={item.id}
                                  className="rounded-md border border-black/5 bg-card p-3 shadow-2xs"
                                >
                                  <dt className="text-[11px] font-medium text-muted-foreground">{item.label}</dt>
                                  <dd className="mt-1 text-sm font-semibold text-foreground">{item.value}</dd>
                                </div>
                              ))}
                            </dl>
                            {request.details?.split("\n\n")[0] && !request.details.startsWith("Answers") ? (
                              <div className="mt-3">
                                <p className="text-[10px] font-semibold tracking-[0.12em] text-muted-foreground uppercase mb-1">
                                  Notes
                                </p>
                                <p className="text-sm">{request.details.split("\n\n")[0]}</p>
                              </div>
                            ) : null}
                          </div>
                        ) : null}
                        {request.details?.trim() && (!request.answers?.length || request.details.startsWith("Answers")) ? (
                          <InfoRow
                            icon={NotebookPen}
                            label="What they asked for"
                            value={request.details}
                            className="sm:col-span-2"
                          />
                        ) : null}
                      </div>
                    </section>

                    <div className="grid gap-4 self-start">
                      <section className="overflow-hidden rounded-lg border border-black/10 bg-card shadow-[0_10px_28px_rgba(4,26,54,0.07)]">
                        <header className="flex items-center gap-2 border-b border-black/10 bg-[#f7f8fa] px-5 py-3">
                          <Wallet className="size-4 text-primary" aria-hidden="true" />
                          <h3 className="text-sm font-semibold">Account</h3>
                        </header>
                        <div className="grid grid-cols-1 gap-px bg-black/5">
                          <MoneyCell
                            label="Amount owing"
                            value={customer?.amountOwing != null ? formatMoney(customer.amountOwing) : "$0.00"}
                            emphasize={Boolean(customer && customer.amountOwing > 0)}
                          />
                        </div>
                        <div className="grid sm:grid-cols-2">
                          <InfoRow
                            icon={FileText}
                            label="Estimate total"
                            value={estimate ? formatMoney(estimate.total) : "$0.00"}
                            className="sm:col-span-2"
                          />
                        </div>
                      </section>

                      <section className="overflow-hidden rounded-lg border border-black/10 bg-card shadow-[0_10px_28px_rgba(4,26,54,0.07)]">
                        <header className="flex items-center justify-between border-b border-black/10 bg-[#f7f8fa] px-5 py-3">
                          <div className="flex items-center gap-2">
                            <UserRound className="size-4 text-primary" aria-hidden="true" />
                            <h3 className="text-sm font-semibold">Customer</h3>
                          </div>
                          {request.customerId ? (
                            <Link
                              href={`/pro/dashboard/customers/${request.customerId}`}
                              className="text-xs font-medium text-primary hover:underline"
                            >
                              Open file &rarr;
                            </Link>
                          ) : null}
                        </header>
                        <div className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <CrmMark
                              name={customerLabel}
                              kind="person"
                              photoKey={customer?.firstName}
                              size="md"
                            />
                            <div className="min-w-0 flex-1">
                              {request.customerId ? (
                                <Link
                                  href={`/pro/dashboard/customers/${request.customerId}`}
                                  className="font-medium text-primary hover:underline block truncate"
                                >
                                  {customerLabel}
                                </Link>
                              ) : (
                                <p className="font-medium text-foreground truncate">{customerLabel}</p>
                              )}
                              <p className="text-xs text-muted-foreground truncate mt-0.5">
                                {request.customerPhone} · {request.customerEmail}
                              </p>
                              <p className="text-xs text-muted-foreground truncate mt-0.5">
                                {formatLocation(request.city ?? "", request.state ?? "", request.zip)}
                              </p>
                            </div>
                          </div>
                        </div>
                      </section>
                    </div>
                  </div>
                  <CustomerLocationMapLazy
                    provider={provider}
                    address={leadAddress}
                    name={customerLabel}
                  />
                </div>
              );
            case "customer":
              if (customerLoading && !customer) {
                return (
                  <div className="flex min-h-[16rem] items-center justify-center rounded-lg border border-black/10 bg-card p-6">
                    <CenteredSpinner label="Loading customer details..." />
                  </div>
                );
              }
              return (
                <section className="overflow-hidden rounded-lg border border-black/10 bg-card shadow-[0_10px_28px_rgba(4,26,54,0.07)]">
                  <header className="flex items-center justify-between border-b border-black/10 bg-[linear-gradient(180deg,#f8fafc_0%,#fff_100%)] px-5 py-4">
                    <div className="flex items-center gap-4">
                      <CrmMark name={customerLabel} kind="person" photoKey={customer?.firstName} />
                      <div>
                        <h2 className="text-lg font-semibold tracking-tight">{customerLabel}</h2>
                        <p className="mt-0.5 text-sm text-muted-foreground">
                          {customer?.phone || request.customerPhone} · {customer?.email || request.customerEmail}
                        </p>
                      </div>
                    </div>
                    {customer ? (
                      <Button size="sm" asChild>
                        <Link href={`/pro/dashboard/customers/${customer.id}`}>Open customer file</Link>
                      </Button>
                    ) : null}
                  </header>
                  <div className="grid sm:grid-cols-2">
                    <InfoRow icon={UserRound} label="Customer name" value={customerLabel} />
                    <InfoRow icon={Phone} label="Phone" value={customer?.phone || request.customerPhone} />
                    <InfoRow
                      icon={Mail}
                      label="Email"
                      value={<span className="text-primary">{customer?.email || request.customerEmail}</span>}
                    />
                    <InfoRow
                      icon={MapPin}
                      label="Service area"
                      value={
                        customer?.addresses?.[0]
                          ? `${customer.addresses[0].street ? `${customer.addresses[0].street}, ` : ""}${formatLocation(
                              customer.addresses[0].city || request.city || "",
                              customer.addresses[0].state || request.state || "",
                              customer.addresses[0].zip || request.zip,
                            )}`
                          : formatLocation(
                              request.neighborhood || request.city || "",
                              request.state || "",
                              request.zip,
                            )
                      }
                    />
                    {customer ? (
                      <>
                        <InfoRow icon={Building2} label="Source" value={crmSourceLabel(customer.source)} />
                        <InfoRow icon={CalendarDays} label="Client since" value={formatDate(customer.createdAt)} />
                      </>
                    ) : null}
                  </div>
                </section>
              );
            case "qualify":
              return (
                <QualifyTab
                  request={request}
                  hasEstimate={hasEstimate}
                  hasJob={hasJob}
                  onSave={(patch) => {
                    records.updateRequest(request.id, patch);
                    toast.success("Lead details saved.");
                  }}
                  onStatus={(status) => {
                    records.setStatus("request", request.id, status);
                    toast.success(`Lead marked ${requestStatusLabel(status).toLowerCase()}.`);
                  }}
                />
              );
            case "estimates":
              return (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">
                      {estimatesLoading && !hasEstimatesCached
                        ? "Loading estimates..."
                        : relatedEstimates.length
                          ? `${relatedEstimates.length} estimate${relatedEstimates.length === 1 ? "" : "s"} from this lead`
                          : hasEstimate
                            ? "Estimate proposal created for this lead"
                            : "No estimate yet"}
                    </p>
                    {!hasEstimate ? (
                      <Button size="sm" onClick={() => setEstimateOpen(true)}>
                        Create estimate
                      </Button>
                    ) : null}
                  </div>
                  {(estimatesLoading && !hasEstimatesCached) || relatedEstimates.length ? (
                    <PortalDataTable
                      filename={`${request.number}-estimates`}
                      countLabel="Estimates"
                      searchPlaceholder="Search estimates"
                      loading={estimatesLoading && !hasEstimatesCached}
                      rows={relatedEstimates}
                      rowKey={(row) => row.id}
                      rowHref={(row) => `/pro/dashboard/estimates/${row.id}`}
                      columns={[
                        {
                          id: "number",
                          header: "Quote #",
                          sortValue: (row) => row.number,
                          searchValue: (row) => row.number,
                          exportValue: (row) => row.number,
                          cell: (row) => (
                            <Link href={`/pro/dashboard/estimates/${row.id}`} className="font-semibold text-primary hover:underline">
                              {row.number}
                            </Link>
                          ),
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
              );
            case "jobs":
              return (jobsLoading && !hasJobsCached) || relatedJobs.length ? (
                <PortalDataTable
                  filename={`${request.number}-jobs`}
                  countLabel="Jobs"
                  searchPlaceholder="Search jobs"
                  loading={jobsLoading && !hasJobsCached}
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
              );
            case "schedule": {
              const visitsCount = scheduledVisits.length;
              return (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-base font-semibold">Scheduled visits</h2>
                        {visitsCount > 0 ? (
                          <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-[#003F7D] border border-blue-200">
                            {visitsCount} {visitsCount === 1 ? "visit" : "visits"}
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Site inspection, estimate walkthrough, or intake call on the calendar.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        onClick={() => {
                          setSelectedScheduleForEdit(null);
                          setAssignOpen(true);
                        }}
                      >
                        + Schedule visit
                      </Button>
                    </div>
                  </div>

                  {scheduledVisits.length > 0 ? (
                    <div className="grid gap-3 sm:grid-cols-2">
                      {scheduledVisits.map((v, index) => {
                        const isUnlinkingThis = unlinkingScheduleId === v.id;
                        const effectiveEnd =
                          v.endDate && v.date && v.endDate > v.date ? v.endDate : undefined;
                        return (
                          <div
                            key={v.id || index}
                            className="rounded-[4px] border border-black/10 bg-card p-4 shadow-2xs hover:border-black/20 transition-colors flex flex-col justify-between"
                          >
                            <div>
                              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-black/5 pb-2.5 mb-3">
                                <div className="flex items-center gap-2 min-w-0">
                                  <CalendarDays className="size-4 text-[#003F7D] shrink-0" />
                                  <span className="font-semibold text-foreground text-sm truncate">
                                    {v.date ? formatDate(v.date) : "Date pending"}
                                    {effectiveEnd ? ` – ${formatDate(effectiveEnd)}` : ""}
                                  </span>
                                  {visitsCount > 1 ? (
                                    <span className="text-[10px] uppercase font-semibold text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                                      Visit {index + 1}
                                    </span>
                                  ) : null}
                                </div>
                                {v.status ? (
                                  <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-[#003F7D] border border-blue-200 capitalize">
                                    {v.status.replace(/_/g, " ")}
                                  </span>
                                ) : null}
                              </div>

                              <div className="grid gap-2 text-xs mb-3">
                                <div>
                                  <p className="text-muted-foreground font-medium">Time slot</p>
                                  <p className="mt-0.5 font-semibold text-foreground">
                                    {timeWindowLabel(v.timeWindow)}
                                    {v.startMinutes != null
                                      ? ` · ${formatClock(v.startMinutes)}${v.endMinutes != null ? `–${formatClock(v.endMinutes)}` : ""}`
                                      : ""}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-muted-foreground font-medium">
                                    Assigned staff / technician
                                  </p>
                                  <p className="mt-0.5 font-semibold text-foreground">
                                    {v.employeeId ? employeeLabel(v.employeeId) : "Unassigned"}
                                  </p>
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center justify-end gap-2 pt-2 border-t border-black/5 mt-auto">
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                                disabled={isUnlinkingThis}
                                onClick={() => handleDeleteSchedule(v)}
                              >
                                {isUnlinkingThis ? "Unlinking..." : "Unlink visit"}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs"
                                onClick={() => {
                                  setSelectedScheduleForEdit(v);
                                  setAssignOpen(true);
                                }}
                              >
                                Reschedule
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : null}

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
              return (
                <div className="space-y-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <LocalFilterTabs
                      value={taskStatusFilter}
                      onChange={setTaskStatusFilter}
                      options={TASK_FILTER_OPTIONS}
                    />
                    <div className="flex flex-wrap items-center gap-2">
                      <Select
                        value={taskPriorityFilter || "all"}
                        onValueChange={(val) => setTaskPriorityFilter(val === "all" ? "" : val)}
                      >
                        <SelectTrigger className="h-8 w-32 text-xs bg-card">
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
                      <Button size="sm" onClick={() => { setEditingTask(null); setTaskOpen(true); }}>
                        + Create task
                      </Button>
                    </div>
                  </div>
                  {(tasksLoading && !hasTasksCached) || displayedTasks.length ? (
                    <PortalDataTable
                      filename={`${request.number}-tasks`}
                      countLabel="Tasks"
                      searchPlaceholder="Search tasks"
                      loading={tasksLoading && !hasTasksCached}
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
                    <div className="rounded-lg border border-dashed border-black/15 bg-card p-8 text-center">
                      <ListTodo className="mx-auto size-8 text-muted-foreground/60" />
                      <h4 className="mt-2 text-sm font-semibold">No tasks yet</h4>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Create a task against this lead — call back, qualify, or pull a permit.
                      </p>
                      <Button size="sm" className="mt-4" onClick={() => { setEditingTask(null); setTaskOpen(true); }}>
                        + Create task
                      </Button>
                    </div>
                  )}
                </div>
              );
            case "reminders":
              return (
                <div className="space-y-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <LocalFilterTabs
                      value={reminderStatusFilter}
                      onChange={setReminderStatusFilter}
                      options={REMINDER_FILTER_OPTIONS}
                    />
                    <Button size="sm" onClick={() => { setEditingReminder(null); setReminderOpen(true); }}>
                      + Set reminder
                    </Button>
                  </div>
                  {(remindersLoading && !hasRemindersCached) || displayedReminders.length ? (
                    <PortalDataTable
                      filename={`${request.number}-reminders`}
                      countLabel="Reminders"
                      searchPlaceholder="Search reminders"
                      loading={remindersLoading && !hasRemindersCached}
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
                    <div className="rounded-lg border border-dashed border-black/15 bg-card p-8 text-center">
                      <Bell className="mx-auto size-8 text-muted-foreground/60" />
                      <h4 className="mt-2 text-sm font-semibold">No reminders yet</h4>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Set a reminder to follow up on this lead.
                      </p>
                      <Button size="sm" className="mt-4" onClick={() => { setEditingReminder(null); setReminderOpen(true); }}>
                        + Set reminder
                      </Button>
                    </div>
                  )}
                </div>
              );
            case "messages": {
              const customerName = thread?.customerName || customerLabel || request.customerName;
              const customerEmail = thread?.customerEmail || customer?.email || request.customerEmail;
              const customerPhone = thread?.customerPhone || customer?.phone || request.customerPhone;
              const customerAvatar = thread?.customerAvatar;
              const custPresence = thread?.customerId
                ? getPresence(thread.customerId)
                : request?.customerId
                  ? getPresence(request.customerId)
                  : undefined;
              const isCustomerOnline = custPresence?.isOnline ?? thread?.isOnline ?? false;

              return (
                <div className="flex h-[calc(100vh-270px)] min-h-[520px] flex-col overflow-hidden rounded-xl border border-border bg-card shadow-2xs">
                  {/* Chat Top Header */}
                  <header className="flex h-16 shrink-0 items-center justify-between border-b border-border bg-card px-4 sm:px-6 shadow-2xs">
                    <div className="flex min-w-0 items-center gap-3">
                      {/* Customer Avatar */}
                      <div className="relative shrink-0">
                        <Avatar className="size-10 shadow-2xs ring-1 ring-border">
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
                        <Link href={`/pro/dashboard/estimates/new?request=${request.id}`}>
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
              return <NotesPanel kind="request" id={request.id} empty="Add the first note on this lead." />;
            case "photos":
              return request.photoUrls.length ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  {request.photoUrls.map((src) => (
                    <div key={src} className="relative h-56 overflow-hidden rounded-[4px] border border-black/10">
                      <Image src={src} alt={request.serviceName} fill className="object-cover" sizes="(min-width: 640px) 50vw, 100vw" />
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No photos came in with this request.</p>
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
        onConverted={(estimateId) => {
          setApiLead((prev) => (prev ? { ...prev, status: "estimate_sent" } : prev));
          records.setStatus("request", lead.id, "estimate_sent");
          refreshEstimates();
          if (typeof window !== "undefined") {
            window.dispatchEvent(
              new CustomEvent("rs-realtime", {
                detail: { type: "INBOX_SUMMARY_INVALIDATE" },
              }),
            );
          }
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
            assign(assignment);
            if (request.status === "new" || request.status === "viewed") {
              void records.setStatus("request", request.id, "contacted");
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
        subjectKind={request.customerId ? "customer" : undefined}
        subjectId={request.customerId || undefined}
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
        subjectKind={request.customerId ? "customer" : undefined}
        subjectId={request.customerId || undefined}
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

function LeadPipeline({
  status,
  hasEstimate,
  hasJob,
}: {
  status: RequestStatus;
  hasEstimate: boolean;
  hasJob: boolean;
}) {
  const current = leadFlowIndex(status, hasEstimate, hasJob);
  const lost = status === "declined" || status === "closed";
  return (
    <ol className="grid grid-cols-2 gap-2 rounded-lg border border-black/10 bg-card p-2 shadow-[0_4px_16px_rgba(4,26,54,0.04)] sm:grid-cols-5">
      {LEAD_STEPS.map((step, index) => {
        const done = !lost && index < current;
        const active = !lost && index === current;
        return (
          <li
            key={step.id}
            className={cn(
              "flex items-center gap-2.5 rounded-md px-3 py-2 transition-all",
              active && "bg-[#003F7D] text-white shadow-xs font-semibold",
              done && !active && "bg-[#e8eef5] text-[#003F7D] font-medium",
              !done && !active && "bg-[#f8fafc] text-muted-foreground",
              lost && "bg-red-50 text-red-800",
            )}
          >
            <span
              className={cn(
                "flex size-5 shrink-0 items-center justify-center rounded-sm text-[10px] font-semibold",
                active && "bg-white/20 text-white",
                done && !active && "bg-white text-[#003F7D] shadow-2xs",
                !done && !active && "bg-white text-muted-foreground",
                lost && "bg-white text-red-800",
              )}
            >
              {String(index + 1).padStart(2, "0")}
            </span>
            <span className="text-xs">{step.label}</span>
          </li>
        );
      })}
    </ol>
  );
}

function QualifyTab({
  request,
  hasEstimate,
  hasJob,
  onSave,
  onStatus,
}: {
  request: PortalRequest;
  hasEstimate?: boolean;
  hasJob?: boolean;
  onSave: (patch: {
    serviceName: string;
    details: string;
    preferredDate?: string;
    preferredTimeWindow?: string;
    zip: string;
    city?: string;
    state?: string;
  }) => void;
  onStatus: (status: RequestStatus) => void;
}) {
  const { customers } = useCrmDirectory();
  const availableStatuses = useMemo(
    () => getAvailableLeadStatuses(request.status, Boolean(hasEstimate), Boolean(hasJob)),
    [request.status, hasEstimate, hasJob],
  );
  const [draft, setDraft] = useState<{
    serviceName: string;
    details: string;
    preferredDate: string;
    preferredTimeWindow: PortalTimeWindow;
    zip: string;
    city: string;
    state: string;
  }>({
    serviceName: request.serviceName,
    details: request.details,
    preferredDate: request.preferredDate ?? "",
    preferredTimeWindow: (request.preferredTimeWindow?.toLowerCase().startsWith("after")
      ? "afternoon"
      : request.preferredTimeWindow?.toLowerCase().startsWith("all")
        ? "all_day"
        : "morning") as PortalTimeWindow,
    zip: request.zip,
    city: request.city ?? "",
    state: request.state ?? "",
  });

  return (
    <div className="space-y-4">
      {request.answers && request.answers.length > 0 ? (
        <div className="rounded-[4px] border border-black/10 bg-slate-50 p-4">
          <h3 className="text-sm font-semibold text-slate-800 mb-2.5">
            Diagnostic Intake Answers
          </h3>
          <dl className="grid gap-2 sm:grid-cols-2">
            {request.answers.map((ans, idx) => (
              <div
                key={ans.id || idx}
                className="rounded bg-white p-2.5 border border-slate-200"
              >
                <dt className="text-xs font-medium text-muted-foreground">{ans.label}</dt>
                <dd className="text-sm font-semibold text-foreground mt-0.5">{ans.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Qualify this lead</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Confirm the work, the window, and where you are going before you write a quote.
          </p>
        </div>
        <Button
          size="sm"
          disabled={!draft.serviceName.trim() || !draft.details.trim() || !draft.preferredDate || !draft.preferredTimeWindow}
          onClick={() => {
            if (!draft.serviceName.trim()) {
              toast.error("Please enter a service name.");
              return;
            }
            if (!draft.details.trim()) {
              toast.error("Please enter details.");
              return;
            }
            if (!draft.preferredDate) {
              toast.error("Please select a preferred date.");
              return;
            }
            if (!draft.preferredTimeWindow) {
              toast.error("Please select a time window.");
              return;
            }
            onSave(draft);
          }}
        >
          Save details
        </Button>
      </div>
      <div className="grid gap-3 rounded-[4px] border border-black/10 p-4 sm:grid-cols-2">
        <label className="grid gap-1.5 text-sm">
          <span className="font-medium">
            Service <span className="text-destructive">*</span>
          </span>
          <Input value={draft.serviceName} onChange={(event) => setDraft({ ...draft, serviceName: event.target.value })} />
        </label>
        <label className="grid gap-1.5 text-sm">
          <span className="font-medium">Status</span>
          <NativeSelect className="w-full" value={request.status} onChange={(event) => onStatus(event.target.value as RequestStatus)}>
            {availableStatuses.map((status: RequestStatus) => (
              <NativeSelectOption key={status} value={status}>
                {requestStatusLabel(status)}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </label>
        <label className="grid gap-1.5 text-sm sm:col-span-2">
          <span className="font-medium">
            What they asked for <span className="text-destructive">*</span>
          </span>
          <Textarea value={draft.details} onChange={(event) => setDraft({ ...draft, details: event.target.value })} />
        </label>
        <label className="grid gap-1.5 text-sm">
          <span className="font-medium">
            Preferred date <span className="text-destructive">*</span>
          </span>
          <Input
            type="date"
            value={draft.preferredDate}
            onChange={(event) => setDraft({ ...draft, preferredDate: event.target.value })}
          />
        </label>
        <label className="grid gap-1.5 text-sm">
          <span className="font-medium">
            Window <span className="text-destructive">*</span>
          </span>
          <NativeSelect
            className="w-full"
            value={draft.preferredTimeWindow}
            onChange={(event) => setDraft({ ...draft, preferredTimeWindow: event.target.value as PortalTimeWindow })}
          >
            {LEAD_WINDOWS.map((item) => (
              <NativeSelectOption key={item.value} value={item.value}>
                {item.label}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </label>
        <label className="grid gap-1.5 text-sm">
          <span className="font-medium">City</span>
          <Input value={draft.city} onChange={(event) => setDraft({ ...draft, city: event.target.value })} />
        </label>
        <label className="grid gap-1.5 text-sm">
          <span className="font-medium">ZIP</span>
          <Input value={draft.zip} onChange={(event) => setDraft({ ...draft, zip: event.target.value })} />
        </label>
        {customers.length && request.customerId ? (
          <p className="text-sm text-muted-foreground sm:col-span-2">
            Customer on file: {crmCustomerName(customers.find((item) => item.id === request.customerId) ?? customers[0])}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function InfoRow({
  icon: Icon,
  label,
  value,
  warn,
  className,
}: {
  icon: typeof Building2;
  label: string;
  value: ReactNode;
  warn?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex items-start gap-3 border-b border-black/5 px-5 py-3 last:border-b-0", className)}>
      <Icon className="mt-0.5 size-3.5 shrink-0 text-primary/70" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">{label}</p>
        <p
          className={
            warn
              ? "text-sm font-medium text-red-700 whitespace-pre-wrap break-words"
              : "text-sm whitespace-pre-wrap break-words"
          }
        >
          {value}
        </p>
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

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] font-medium tracking-[0.12em] text-muted-foreground uppercase">{label}</p>
      <p className="mt-1 text-sm font-medium">{value}</p>
    </div>
  );
}
