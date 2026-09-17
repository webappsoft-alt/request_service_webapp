"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Bell,
  Briefcase,
  CalendarDays,
  ExternalLink,
  FilePlus2,
  FileText,
  ImageIcon,
  LayoutDashboard,
  ListTodo,
  Loader2,
  Mail,
  MessageCircle,
  MessageSquare,
  NotebookPen,
  Phone,
  Settings,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";
import { ArchiveBadge, ArchiveButton } from "@/components/portal/archive-control";
import { AssignEventDialog } from "@/components/portal/assign-event-dialog";
import { AddNoteButton, SetReminderButton, SetTaskButton } from "@/components/portal/create-person-dialogs";
import { NotesPanel } from "@/components/portal/notes-panel";
import { ChatPanel } from "@/components/shared/chat-panel";
import { useChatThreads } from "@/components/portal/use-chat-threads";
import { ConvertLeadToEstimateDialog } from "@/components/portal/convert-lead-to-estimate-dialog";
import { EventCalendar, type CalendarMove } from "@/components/portal/event-calendar";
import { jobBoardColumns } from "@/components/portal/job-columns";
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
import { getRequest, updateRequestStatus } from "@/lib/api/crm-client";
import { ensureProviderChatThread } from "@/lib/api/chat-client";
import { useRealtime } from "@/components/realtime/realtime-provider";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { CenteredSpinner } from "@/components/ui/spinner";
import { ChatPanelSkeleton } from "@/components/shared/loading-skeletons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { getAvatarColor, getInitials } from "@/lib/chat-format";
import {
  crmCustomerName,
  crmReminderStatusLabel,
  crmTaskStatusLabel,
  reminderMatches,
  taskMatches,
} from "@/lib/data/crm-people";
import {
  calendarEventKindLabel,
  estimateStatusLabel,
  estimateStatusTone,
  formatClock,
  getPortalCustomerName,
  requestStatusLabel,
  timeWindowLabel,
  windowFromMinutes,
  type PortalCalendarEvent,
  type PortalRequest,
  type PortalTimeWindow,
} from "@/lib/data/portal";
import { formatDate, formatLocation } from "@/lib/format";
import type { RequestStatus } from "@/lib/types";
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

const LEAD_WINDOWS = ["Morning", "Afternoon", "Evening", "Flexible", "Any time"];
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

function leadFlowIndex(status: RequestStatus, hasEstimate: boolean, hasJob: boolean) {
  if (hasJob || status === "converted_to_job") return 4;
  if (status === "accepted") return 3;
  if (status === "estimate_sent" || hasEstimate) return 2;
  if (status === "contacted" || status === "viewed") return 1;
  if (status === "declined" || status === "closed") return 0;
  return 0;
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
  const { requests, estimates, jobs, invoices, provider } = usePortalWorkspace();
  const crm = useCrmApiData();
  const { customers, reminders, tasks, setReminderStatus, setTaskStatus } = useCrmDirectory();
  const { events, employees, assign, employeeLabel } = usePortalCrew();
  const records = usePortalRecords();
  const chat = useChatThreads();
  const searchParams = useSearchParams();
  const tab = (searchParams.get("tab") ?? "summary") as LeadTab;
  const [estimateOpen, setEstimateOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [apiLead, setApiLead] = useState<PortalRequest | null>(null);
  const [apiLoading, setApiLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setApiLoading(true);
    void getRequest(id, { silent: true })
      .then((item) => {
        if (!cancelled && item) {
          setApiLead(item);
          // Backend GET auto-transitions status to "viewed", refresh counters
          crm.refresh({ silent: true });
        }
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setApiLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    if (searchParams.get("convert") === "1") {
      setEstimateOpen(true);
    }
  }, [searchParams]);

  const allRequests = records.mergeRequests(requests);
  const request = apiLead || allRequests.find((item) => item.id === id);
  const pending = useCrmRecordPending() || (apiLoading && !request);
  const allEstimates = records.mergeEstimates(estimates);
  const allJobs = records.mergeJobs(jobs);
  const relatedEstimates = allEstimates.filter((item) => item.requestId === id);
  const relatedJobs = allJobs.filter((item) => relatedEstimates.some((estimate) => estimate.id === item.estimateId));
  const estimate = relatedEstimates[0];
  const job = relatedJobs[0];
  const customer = customers.find((item) => item.id === request?.customerId);
  const relatedReminders = reminders.filter((item) => reminderMatches(item, "request", id));
  const relatedTasks = tasks.filter((item) => taskMatches(item, "request", id));
  const event = events.find((item) => item.kind === "request" && item.recordId === id);
  const requestEvent: PortalCalendarEvent = event ?? {
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

  useEffect(() => {
    if (request?.status === "new") records.setStatus("request", request.id, "viewed");
    // Mark seen once when the file opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request?.id, request?.status]);

  useEffect(() => {
    if (tab === "messages" && thread?.unreadForProvider) chat.markRead(thread.id);
  }, [chat.markRead, tab, thread?.id, thread?.unreadForProvider]);

  const { joinThread, leaveThread, setTyping, connected } = useRealtime();
  const [startingChat, setStartingChat] = useState(false);

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
      crm.refresh({ silent: true });
      toast.success(`Chat started with ${request.customerName}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not start chat");
    } finally {
      setStartingChat(false);
    }
  }

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

  const hasEstimate = relatedEstimates.length > 0;
  const hasJob = relatedJobs.length > 0;
  const lead = request;
  const customerLabel = customer ? crmCustomerName(customer) : lead.customerName;
  const lost = lead.status === "declined" || lead.status === "closed";

  async function markContacted() {
    records.setStatus("request", lead.id, "contacted");
    setApiLead((prev) => (prev ? { ...prev, status: "contacted" } : prev));
    try {
      await updateRequestStatus(lead.id, "contacted");
      crm.refresh({ silent: true });
    } catch {
      /* handled */
    }
    toast.success("Lead marked contacted.");
  }

  async function declineLead() {
    records.setStatus("request", lead.id, "declined");
    setApiLead((prev) => (prev ? { ...prev, status: "declined" } : prev));
    try {
      await updateRequestStatus(lead.id, "declined");
      crm.refresh({ silent: true });
    } catch {
      /* handled */
    }
    toast.success("Lead declined.");
  }

  function moveEvent(move: CalendarMove) {
    assign({
      kind: "request",
      recordId: lead.id,
      date: move.date,
      endDate: move.endDate,
      startMinutes: move.startMinutes,
      endMinutes: move.endMinutes,
      timeWindow: windowFromMinutes(move.startMinutes, move.endMinutes) || requestEvent.timeWindow,
      employeeId: event?.employeeId ?? "",
    });
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
            <StatusPill label={request.channel === "direct" ? "Direct" : "Marketplace"} />
            <ArchiveBadge kind="request" id={request.id} />
          </>
        }
        notice={<FileNotices kind="request" id={request.id} />}
        actions={
          <>
            {hasJob ? (
              <Button size="sm" asChild>
                <Link href={`/pro/dashboard/jobs/${job.id}`}>Open {job.number}</Link>
              </Button>
            ) : hasEstimate ? (
              <Button size="sm" asChild>
                <Link href={`/pro/dashboard/estimates/${estimate.id}`}>Open {estimate.number}</Link>
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
            {request.status === "new" || request.status === "viewed" ? (
              <Button size="sm" variant="outline" onClick={markContacted}>
                Mark contacted
              </Button>
            ) : null}
            <Button size="sm" variant="outline" onClick={() => setAssignOpen(true)}>
              Schedule visit
            </Button>
            <SetTaskButton subjectKind="request" subjectId={request.id} />
            <SetReminderButton subjectKind="request" subjectId={request.id} />
            <AddNoteButton subjectKind="request" subjectId={request.id} />
            {lost ? null : (
              <Button size="sm" variant="outline" onClick={declineLead}>
                Decline
              </Button>
            )}
            <ArchiveButton kind="request" id={request.id} label={request.number} />
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
                      "rounded-[4px] border px-4 py-3 text-sm",
                      lost ? "border-red-200 bg-red-50 text-red-950" : "border-black/10 bg-[#e8eef5] text-[#003F7D]",
                    )}
                  >
                    {leadStageCopy(request.status, hasEstimate, hasJob)}
                  </div>
                  <div className="grid gap-4 lg:grid-cols-[1.35fr_0.85fr]">
                    <div className="grid gap-3 rounded-[4px] border border-black/10 p-4 sm:grid-cols-2">
                      <Fact label="Service" value={request.serviceName} />
                      <Fact label="Category" value={request.categoryName} />
                      <Fact label="Preferred date" value={request.preferredDate ? formatDate(request.preferredDate) : "Flexible"} />
                      <Fact label="Window" value={request.preferredTimeWindow ?? "Any time"} />
                      <Fact label="Area" value={`${request.neighborhood} ${request.zip}`} />
                      <Fact label="Received" value={formatDate(request.createdAt)} />
                      {request.answers?.length ? (
                        <div className="sm:col-span-2 space-y-2">
                          <p className="text-[11px] font-medium tracking-[0.12em] text-muted-foreground uppercase">
                            Quote answers
                          </p>
                          <dl className="grid gap-2 sm:grid-cols-2">
                            {request.answers.map((item) => (
                              <div key={item.id} className="rounded-[4px] bg-[#f8fafc] px-3 py-2">
                                <dt className="text-[11px] text-muted-foreground">{item.label}</dt>
                                <dd className="mt-0.5 text-sm font-medium">{item.value}</dd>
                              </div>
                            ))}
                          </dl>
                          {request.details.split("\n\n")[0] && !request.details.startsWith("Answers") ? (
                            <Fact label="Notes" value={request.details.split("\n\n")[0]} />
                          ) : null}
                        </div>
                      ) : (
                        <div className="sm:col-span-2">
                          <Fact label="What they asked for" value={request.details} />
                        </div>
                      )}
                    </div>
                    <div className="rounded-[4px] border border-black/10 p-4">
                      <p className="text-[11px] font-medium tracking-[0.12em] text-muted-foreground uppercase">Customer</p>
                      {request.customerId ? (
                        <Link href={`/pro/dashboard/customers/${request.customerId}`} className="mt-1 block font-semibold text-primary hover:underline">
                          {customerLabel}
                        </Link>
                      ) : (
                        <p className="mt-1 font-semibold">{customerLabel}</p>
                      )}
                      <p className="mt-1 text-sm text-muted-foreground">
                        {request.customerPhone} · {request.customerEmail}
                      </p>
                      <p className="mt-3 text-sm text-muted-foreground">
                        {formatLocation(request.city ?? "", request.state ?? "", request.zip)}
                      </p>
                      {event?.date ? (
                        <p className="mt-3 text-sm">
                          Visit {formatDate(event.date)}
                          {event.employeeId ? ` · ${employeeLabel(event.employeeId)}` : ""}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            case "customer":
              return (
                <div className="grid gap-3 text-sm sm:grid-cols-2">
                  <Fact label="Name" value={customerLabel} />
                  <Fact label="Phone" value={request.customerPhone} />
                  <Fact label="Email" value={request.customerEmail} />
                  <Fact label="Neighborhood" value={`${request.neighborhood} ${request.zip}`} />
                  {customer ? (
                    <div className="sm:col-span-2">
                      <Button size="sm" asChild>
                        <Link href={`/pro/dashboard/customers/${customer.id}`}>Open customer file</Link>
                      </Button>
                    </div>
                  ) : null}
                </div>
              );
            case "qualify":
              return (
                <QualifyTab
                  request={request}
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
                      {relatedEstimates.length ? `${relatedEstimates.length} estimate${relatedEstimates.length === 1 ? "" : "s"} from this lead` : "No estimate yet"}
                    </p>
                    <Button size="sm" onClick={() => setEstimateOpen(true)}>
                      {hasEstimate ? "Another estimate" : "Create estimate"}
                    </Button>
                  </div>
                  {relatedEstimates.length ? (
                    <PortalDataTable
                      filename={`${request.number}-estimates`}
                      countLabel="Estimates"
                      searchPlaceholder="Search estimates"
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
              return relatedJobs.length ? (
                <PortalDataTable
                  filename={`${request.number}-jobs`}
                  countLabel="Jobs"
                  searchPlaceholder="Search jobs"
                  rows={relatedJobs}
                  rowKey={(row) => row.id}
                  rowHref={(row) => `/pro/dashboard/jobs/${row.id}`}
                  columns={jobBoardColumns({
                    estimates: allEstimates,
                    requests: allRequests,
                    invoices,
                    events,
                    employeeLabel,
                    customerName: (customerId) => {
                      const match = customers.find((item) => item.id === customerId);
                      return match ? crmCustomerName(match) : getPortalCustomerName(provider, customerId);
                    },
                  })}
                />
              ) : (
                <p className="text-sm text-muted-foreground">
                  No job yet. The customer signs the estimate, then this lead becomes a job.
                </p>
              );
            case "schedule":
              return (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">
                      {event?.date
                        ? `${formatDate(event.date)} · ${calendarEventKindLabel(event.kind)} · ${employeeLabel(event.employeeId)}`
                        : "No visit on the calendar yet."}
                    </p>
                    <Button size="sm" onClick={() => setAssignOpen(true)}>
                      Schedule visit
                    </Button>
                  </div>
                  <EventCalendar
                    events={event ? [event] : []}
                    employees={employees}
                    employeeLabel={employeeLabel}
                    onEventOpen={() => setAssignOpen(true)}
                    onMove={(_, move) => moveEvent(move)}
                  />
                  {event?.startMinutes != null ? (
                    <p className="text-sm text-muted-foreground">
                      {timeWindowLabel(event.timeWindow)} · {formatClock(event.startMinutes)}
                      {event.endMinutes != null ? `–${formatClock(event.endMinutes)}` : ""}
                    </p>
                  ) : null}
                </div>
              );
            case "tasks":
              return (
                <LinkedList
                  empty="Create a task against this lead — call back, qualify, or pull a permit."
                  items={relatedTasks.map((item) => ({
                    id: item.id,
                    href: `/pro/dashboard/tasks/${item.id}`,
                    title: `${item.number} · ${item.title}`,
                    detail: `Due ${formatDate(item.dueAt)} · ${item.note}`,
                    pill: crmTaskStatusLabel(item.status),
                    action: item.status === "done" ? undefined : () => setTaskStatus(item.id, "done"),
                  }))}
                />
              );
            case "reminders":
              return (
                <LinkedList
                  empty="Set a reminder so this inbound request does not sit."
                  items={relatedReminders.map((item) => ({
                    id: item.id,
                    href: `/pro/dashboard/reminders/${item.id}`,
                    title: item.title,
                    detail: `Due ${formatDate(item.dueAt)} · ${item.note}`,
                    pill: crmReminderStatusLabel(item.status),
                    action: item.status === "open" ? () => setReminderStatus(item.id, "done") : undefined,
                  }))}
                />
              );
            case "messages": {
              const customerName = thread?.customerName || customerLabel || request.customerName;
              const customerEmail = thread?.customerEmail || customer?.email || request.customerEmail;
              const customerPhone = thread?.customerPhone || customer?.phone || request.customerPhone;
              const customerAvatar = thread?.customerAvatar;

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
                            connected ? "bg-emerald-500" : "bg-muted-foreground/50",
                          )}
                          aria-label={connected ? "Online" : "Offline"}
                        />
                      </div>

                      {/* Contact Info */}
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h2 className="truncate text-sm font-semibold text-foreground sm:text-base">
                            {customerName}
                          </h2>
                          {connected ? (
                            <span className="hidden items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400 sm:inline-flex">
                              <span className="size-1.5 animate-pulse rounded-full bg-emerald-500" />
                              Live
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
                      otherName={customerName}
                      otherAvatar={customerAvatar}
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
          crm.refresh({ silent: true });
        }}
      />
      <AssignEventDialog
        open={assignOpen}
        onOpenChange={setAssignOpen}
        event={requestEvent}
        events={[requestEvent]}
        employees={employees}
        defaultDate={request.preferredDate}
        onSave={(assignment) => {
          assign(assignment);
          if (request.status === "new" || request.status === "viewed") records.setStatus("request", request.id, "contacted");
          toast.success("Visit put on the calendar.");
        }}
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
    <ol className="grid grid-cols-2 gap-2 rounded-[4px] border border-black/10 bg-card p-3 sm:grid-cols-5">
      {LEAD_STEPS.map((step, index) => {
        const done = !lost && index < current;
        const active = !lost && index === current;
        return (
          <li
            key={step.id}
            className={cn(
              "flex items-center gap-2 rounded-[4px] px-2 py-2",
              active && "bg-[#003F7D] text-white",
              done && !active && "bg-[#e8eef5] text-[#003F7D]",
              !done && !active && "bg-[#f8fafc] text-muted-foreground",
              lost && "bg-red-50 text-red-800",
            )}
          >
            <span
              className={cn(
                "flex size-6 shrink-0 items-center justify-center rounded-[4px] text-[11px] font-semibold",
                active && "bg-white/15 text-white",
                done && !active && "bg-white text-[#003F7D]",
                !done && !active && "bg-white text-muted-foreground",
                lost && "bg-white text-red-800",
              )}
            >
              {String(index + 1).padStart(2, "0")}
            </span>
            <span className="text-sm font-medium">{step.label}</span>
          </li>
        );
      })}
    </ol>
  );
}

function QualifyTab({
  request,
  onSave,
  onStatus,
}: {
  request: PortalRequest;
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
  const [draft, setDraft] = useState({
    serviceName: request.serviceName,
    details: request.details,
    preferredDate: request.preferredDate ?? "",
    preferredTimeWindow: request.preferredTimeWindow ?? "Morning",
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
        <Button size="sm" onClick={() => onSave(draft)}>
          Save details
        </Button>
      </div>
      <div className="grid gap-3 rounded-[4px] border border-black/10 p-4 sm:grid-cols-2">
        <label className="grid gap-1.5 text-sm">
          <span className="font-medium">Service</span>
          <Input value={draft.serviceName} onChange={(event) => setDraft({ ...draft, serviceName: event.target.value })} />
        </label>
        <label className="grid gap-1.5 text-sm">
          <span className="font-medium">Status</span>
          <NativeSelect className="w-full" value={request.status} onChange={(event) => onStatus(event.target.value as RequestStatus)}>
            {LEAD_STATUSES.map((status) => (
              <NativeSelectOption key={status} value={status}>
                {requestStatusLabel(status)}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </label>
        <label className="grid gap-1.5 text-sm sm:col-span-2">
          <span className="font-medium">What they asked for</span>
          <Textarea value={draft.details} onChange={(event) => setDraft({ ...draft, details: event.target.value })} />
        </label>
        <label className="grid gap-1.5 text-sm">
          <span className="font-medium">Preferred date</span>
          <Input
            type="date"
            value={draft.preferredDate}
            onChange={(event) => setDraft({ ...draft, preferredDate: event.target.value })}
          />
        </label>
        <label className="grid gap-1.5 text-sm">
          <span className="font-medium">Window</span>
          <NativeSelect
            className="w-full"
            value={draft.preferredTimeWindow}
            onChange={(event) => setDraft({ ...draft, preferredTimeWindow: event.target.value })}
          >
            {LEAD_WINDOWS.map((item) => (
              <NativeSelectOption key={item} value={item}>
                {item}
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

function LinkedList({
  items,
  empty,
}: {
  empty: string;
  items: { id: string; href: string; title: string; detail: string; pill: string; action?: () => void }[];
}) {
  if (!items.length) return <p className="text-sm text-muted-foreground">{empty}</p>;
  return (
    <div className="space-y-2">
      {items.map((item) => (
        <div key={item.id} className="flex items-center justify-between gap-3 border border-black/10 px-3 py-2.5">
          <div>
            <Link href={item.href} className="text-sm font-medium text-primary hover:underline">
              {item.title}
            </Link>
            <p className="text-xs text-muted-foreground">{item.detail}</p>
          </div>
          <div className="flex items-center gap-2">
            <StatusPill label={item.pill} />
            {item.action ? (
              <Button size="sm" variant="outline" onClick={item.action}>
                Mark done
              </Button>
            ) : null}
          </div>
        </div>
      ))}
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
