"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Camera,
  ChevronDown,
  CreditCard,
  FileText,
  LayoutDashboard,
  Loader2,
  NotebookPen,
  Paperclip,
  ScrollText,
  Settings,
  Share2,
} from "lucide-react";
import { toast } from "sonner";
import { ArchiveBadge, ArchiveButton, ConfirmArchiveDialog } from "@/components/portal/archive-control";
import {
  NotesPanel,
  CreateNoteDialogForSubject,
} from "@/components/portal/notes-panel";
import {
  CreateReminderDialog,
  CreateTaskDialog,
} from "@/components/portal/create-person-dialogs";
import { FileNotices } from "@/components/portal/task-banner";
import { AssignEventDialog } from "@/components/portal/assign-event-dialog";
import {
  EstimateFileChrome,
  EstimateSettingsTab,
} from "@/components/portal/estimate-file";
import {
  EstimatePipeline,
  EstimateSiteVisitTab,
  EstimateStageBanner,
} from "@/components/portal/estimate-flow";
import { EstimateShareTab } from "@/components/portal/share-estimate-panel";
import { SendApprovalDialog } from "@/components/portal/send-approval-dialog";
import { useCrmApiData } from "@/components/portal/use-crm-api-data";
import { useCrmRecordPending } from "@/components/portal/use-crm-record-pending";
import { useEstimateShare } from "@/components/portal/use-estimate-share";
import {
  ApplyPaymentButton,
  InvoiceFileChrome,
  InvoicePaymentsTab,
  InvoiceSummaryTab,
} from "@/components/portal/invoice-file";
import { sendInvoice as sendInvoiceApi } from "@/lib/api/crm-client";
import {
  PaymentFileChrome,
  PaymentSummaryTab,
} from "@/components/portal/payment-file";
import {
  JobAttachmentsTab,
  JobFileChrome,
  JobLogsTab,
  JobMaterialsTab,
  JobSettingsTab,
  JobSummaryTab,
} from "@/components/portal/job-file";
import {
  copyCostLines,
  readCostLines,
  writeCostLines,
} from "@/components/portal/use-job-costing";
import {
  appendJobAttachments,
  applyEstimateSettings,
  applyInvoiceSettings,
  applyJobSettings,
  siteVisitFromRecord,
  siteVisitToRecord,
  writeSiteVisit,
  type EstimateSiteVisit,
  useEstimateSettings,
  useEstimateSiteVisit,
  useInvoiceSettings,
  useJobSettings,
} from "@/components/portal/use-job-file";
import { usePortalRecords } from "@/components/portal/use-portal-records";
import { RecordWorkspace } from "@/components/portal/record-workspace";
import { PortalPage } from "@/components/portal/portal-page";
import { StatusPill } from "@/components/portal/status-pill";
import { CenteredSpinner } from "@/components/ui/spinner";
import { useCrmDirectory } from "@/components/portal/use-crm-directory";
import { usePortalCrew } from "@/components/portal/use-portal-crew";
import { usePortalWorkspace } from "@/components/portal/use-portal-workspace";
import { useAppSelector } from "@/store/hooks";
import { selectAuth, selectAuthUser } from "@/store/authSlice";
import {
  estimateAsJob,
  filledWorkLines,
  invoiceAsJob,
  buildInvoice,
  buildJob,
  linesToEstimateItems,
  nextRecordNumber,
  todayISO,
} from "@/components/portal/work-builders";
import {
  convertEstimateToJob as convertEstimateToJobApi,
  convertJobToInvoice as convertJobToInvoiceApi,
  deleteJob as deleteJobApi,
  finalizeEstimate as finalizeEstimateApi,
  getEstimate,
  getJob,
  updateEstimate as updateEstimateApi,
  updateEstimateArchive as updateEstimateArchiveApi,
  updateEstimateSiteVisit,
} from "@/lib/api/crm-client";
import {
  extractErrorMessage,
  getAuthToken,
} from "@/components/api/apiFuntions";
import type { Estimate, Job } from "@/lib/types";
import { crmCustomerName } from "@/lib/data/crm-people";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  calendarEventKindLabel,
  employeeName,
  estimateCanConvert,
  estimateCanShare,
  estimateDisplayName,
  estimateStatusLabel,
  estimateStatusTone,
  getPortalCustomerName,
  invoiceDaysOverdue,
  invoiceKind,
  invoiceKindLabel,
  invoiceStatusLabel,
  invoiceStatusTone,
  jobServiceLabel,
  paymentKind,
  paymentKindLabel,
  paymentNumber,
  paymentStatusLabel,
  paymentStatusTone,
  jobStatusLabel,
  jobStatusTone,
  minutesForWindow,
  type PortalCalendarEvent,
} from "@/lib/data/portal";

export function EstimateDetailView({ id }: { id: string }) {
  const router = useRouter();
  const auth = useAppSelector(selectAuth);
  const user = useAppSelector(selectAuthUser);
  const isProvider =
    auth.hydrated &&
    Boolean(auth.token) &&
    (user?.role === "provider" || auth.role === "provider");
  const crm = useCrmApiData();
  const { session, estimates, provider, jobs } = usePortalWorkspace();
  const { customers } = useCrmDirectory();
  const { events, employees, assign } = usePortalCrew();
  const records = usePortalRecords();
  const settings = useEstimateSettings(id);
  const localVisit = useEstimateSiteVisit(id);
  const share = useEstimateShare();
  const [assignOpen, setAssignOpen] = useState(false);
  const [approvalOpen, setApprovalOpen] = useState(false);
  const [converting, setConverting] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [reminderOpen, setReminderOpen] = useState(false);
  const [taskOpen, setTaskOpen] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [fetched, setFetched] = useState<Estimate | null>(null);
  const [fetching, setFetching] = useState(false);
  const [statusOverride, setStatusOverride] = useState<
    Estimate["status"] | null
  >(null);
  const listed = records
    .mergeEstimates(estimates)
    .find((item) => item.id === id);
  // Prioritize live API data fetched from /api/provider/estimates/{id}
  const seeded = fetched ?? listed;
  const estimate = seeded
    ? applyEstimateSettings(
        {
          ...seeded,
          status:
            statusOverride ??
            records.statusOf("estimate", seeded.id, seeded.status),
        },
        settings,
      )
    : undefined;
  const allJobs = records.mergeJobs(jobs);
  const job =
    allJobs.find((item) => item.id === seeded?.jobId) ??
    allJobs.find((item) => item.id === records.linkedId("estimate", id)) ??
    allJobs.find((item) => item.estimateId === id);
  const siteVisit = localVisit ?? siteVisitFromRecord(seeded?.siteVisit);
  const event = events.find(
    (item) => item.kind === "estimate" && item.recordId === id,
  );
  const customer = customers.find((item) => item.id === estimate?.customerId);
  const customerLabel = customer
    ? crmCustomerName(customer)
    : estimate?.customerName?.trim() || "Customer";

  const approval = share.approvalOf(id);
  const apiReady =
    isProvider ||
    crm.enabled ||
    (typeof window !== "undefined" && Boolean(getAuthToken()));
  const pending = useCrmRecordPending();

  useEffect(() => {
    setFetched(null);
    setStatusOverride(null);
  }, [id]);

  useEffect(() => {
    if (crm.enabled && !crm.ready) {
      void crm.ensureLoaded();
    }
  }, [crm.enabled, crm.ready, crm.ensureLoaded]);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setFetching(true);
    void getEstimate(id)
      .then((item) => {
        if (!cancelled && item) setFetched(item);
      })
      .catch((error) => {
        if (!cancelled) {
          toast.error(
            error instanceof Error && error.message
              ? error.message
              : "Could not load estimate.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setFetching(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (!estimate) {
    return pending || fetching || crm.refreshing ? (
      <div className="flex min-h-[50vh] items-center justify-center py-12">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    ) : (
      <Missing title="Estimate not found" href="/pro/dashboard/estimates" />
    );
  }

  const quote = estimate;
  const asJob = estimateAsJob(quote);
  const service = settings?.name || estimateDisplayName(estimate);
  const signed = Boolean(
    approval ||
    estimate.signature ||
    estimate.status === "accepted" ||
    (estimate.status as string) === "approved" ||
    estimate.status === "converted_to_job",
  );
  const canShare = estimateCanShare(estimate.status);
  const canConvert =
    signed && estimateCanConvert(estimate.status, Boolean(job));
  const visitLocked =
    estimate.status === "finalized" ||
    estimate.status === "sent" ||
    estimate.status === "accepted" ||
    Boolean(job);
  const assignedTechId =
    event?.employeeId ||
    siteVisit?.employeeId ||
    estimate.siteVisit?.employeeId ||
    undefined;
  const visitDate = (
    siteVisit?.visitedAt ||
    estimate.siteVisit?.visitedAt ||
    estimate.issuedAt
  ).slice(0, 10);
  const visitWindow = minutesForWindow("morning");
  const estimateAssignmentEvent: PortalCalendarEvent = event
    ? {
        ...event,
        employeeId: event.employeeId || assignedTechId,
      }
    : {
        id: `cal_${estimate.id}`,
        kind: "estimate",
        recordId: estimate.id,
        title: estimate.number,
        detail: `${service} · site visit`,
        customerName: customerLabel,
        date: visitDate,
        endDate: visitDate,
        timeWindow: "morning",
        startMinutes: visitWindow.startMinutes,
        endMinutes: visitWindow.endMinutes,
        employeeId:
          assignedTechId ||
          employees.find(
            (item) =>
              item.active &&
              (String(item.role || "").toLowerCase().trim() === "technician" ||
                String(item.role || "").toLowerCase().trim() === "tech"),
          )?.id,
        href: `/pro/dashboard/estimates/${estimate.id}`,
        status: estimate.status,
      };

  async function setEstimateStatus(
    status: (typeof quote)["status"],
    message: string,
  ) {
    if (apiReady) {
      const updated = await updateEstimateApi(quote.id, { ...quote, status });
      if (updated) {
        crm.patchEstimate(quote.id, updated);
        setFetched(updated);
      } else {
        crm.patchEstimate(quote.id, { status });
        setFetched((prev) => (prev ? { ...prev, status } : prev));
      }
    } else {
      records.setStatus("estimate", quote.id, status);
    }
    toast.success(message);
  }

  function openApproval() {
    if (!canShare) {
      toast.error(
        "Finalize the estimate in the office before sending it for approval.",
      );
      return;
    }
    setApprovalOpen(true);
  }

  async function finalizeEstimate() {
    if (finalizing || canShare || quote.status === "site_visit") {
      if (quote.status === "site_visit") {
        toast.error(
          "Complete and save the site inspection before finalizing the estimate.",
        );
      }
      return;
    }
    setFinalizing(true);
    try {
      const lines = filledWorkLines(readCostLines(session?.email, asJob));
      const items = lines.length
        ? linesToEstimateItems(quote.id, lines)
        : quote.items;
      if (apiReady) {
        const saved = await finalizeEstimateApi(quote.id, { ...quote, items });
        const nextStatus =
          saved?.status === "finalized" || !saved ? "finalized" : saved.status;
        setStatusOverride(nextStatus);
        if (saved) {
          crm.patchEstimate(quote.id, saved);
          setFetched(saved);
        } else {
          crm.patchEstimate(quote.id, { status: "finalized", items });
        }
      } else {
        records.setStatus("estimate", quote.id, "finalized");
        setStatusOverride("finalized");
      }
      toast.success(
        "Estimate finalized. Open Share to send the customer link.",
      );
    } catch (error) {
      const message = extractErrorMessage(error);
      if (/status/i.test(message) && /finalized|one of|valid/i.test(message)) {
        setStatusOverride("finalized");
        crm.patchEstimate(quote.id, { status: "finalized" });
        toast.success(
          "Estimate finalized. Open Share to send the customer link.",
        );
        return;
      }
      toast.error(message || "Could not finalize this estimate.");
    } finally {
      setFinalizing(false);
    }
  }

  async function convertToJob() {
    if (job) {
      router.push(`/pro/dashboard/jobs/${job.id}`);
      return;
    }
    if (!canConvert || converting) {
      if (!canConvert)
        toast.error("This estimate cannot be converted right now.");
      return;
    }
    setConverting(true);
    try {
      const lines = filledWorkLines(readCostLines(session?.email, asJob));
      const items = lines.length
        ? linesToEstimateItems(quote.id, lines)
        : quote.items;
      const siteVisitRecord = siteVisit
        ? siteVisitToRecord(siteVisit)
        : quote.siteVisit;
      const title = quote.title || service;
      if (apiReady) {
        const created = await convertEstimateToJobApi(quote.id, {
          title,
          items,
          siteVisit: siteVisitRecord,
        });
        if (!created?.id)
          throw new Error("The CRM did not return the new job.");
        copyCostLines(session?.email, quote.id, created.id);
        if (siteVisit?.photos.length) {
          appendJobAttachments(session?.email, created.id, siteVisit.photos);
        }
        records.cacheJob(created);
        records.linkRecords("estimate", quote.id, created.id);
        setStatusOverride("converted_to_job");
        // Patch the estimate locally — no full CRM refresh needed
        crm.patchEstimate(quote.id, {
          status: "converted_to_job",
          jobId: created.id,
        });
        toast.success(
          `${created.number || "Job"} created from ${quote.number}. This estimate stays an estimate.`,
        );
        return;
      }
      const created = buildJob({
        number: nextRecordNumber(
          "JOB",
          allJobs.map((item) => item.number),
        ),
        title,
        providerId: provider.id,
        customerId: quote.customerId,
        estimateId: quote.id,
        address: quote.propertyAddress,
        assignedTo: siteVisit?.technician,
        scheduledAt: todayISO(),
        notes: [
          quote.title ? `Estimate: ${quote.title}` : "",
          `Converted from ${quote.number}`,
          quote.notes,
          siteVisit?.accessNotes ? `Access: ${siteVisit.accessNotes}` : "",
          siteVisit?.findings ? `Findings: ${siteVisit.findings}` : "",
          siteVisit?.recommendations
            ? `Recommended: ${siteVisit.recommendations}`
            : "",
          siteVisit?.measurements
            ? `Measurements: ${siteVisit.measurements}`
            : "",
        ]
          .filter(Boolean)
          .join("\n\n"),
        status: "unscheduled",
        lines,
      });
      records.cacheJob(created);
      records.linkRecords("estimate", quote.id, created.id);
      records.setStatus("estimate", quote.id, "converted_to_job");
      writeCostLines(session?.email, created.id, lines);
      if (siteVisit?.photos.length) {
        appendJobAttachments(session?.email, created.id, siteVisit.photos);
      }
      setStatusOverride("converted_to_job");
      toast.success(
        `${created.number} created from ${quote.number}. This estimate stays an estimate.`,
      );
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not convert this estimate.",
      );
    } finally {
      setConverting(false);
    }
  }

  return (
    <>
      <RecordWorkspace
        href={`/pro/dashboard/estimates/${estimate.id}`}
        label={estimate.number}
        kind="estimate"
        tabs={[
          { id: "summary", label: "Summary", icon: LayoutDashboard },
          { id: "visit", label: "Site visit", icon: Camera },
          { id: "materials", label: "Line items", icon: FileText },
          { id: "share", label: "Share", icon: Share2 },
          { id: "logs", label: "Logs", icon: ScrollText },
          { id: "notes", label: "Notes", icon: NotebookPen },
          { id: "attachments", label: "Attachments", icon: Paperclip },
          { id: "settings", label: "Estimate settings", icon: Settings },
        ]}
        badge={
          <>
            <StatusPill
              label={estimateStatusLabel(estimate.status)}
              className={estimateStatusTone(estimate.status)}
            />
            {job || estimate.status === "converted_to_job" ? (
              <StatusPill
                label="Converted to job"
                className="bg-emerald-50 text-emerald-800"
              />
            ) : null}
            {signed ? (
              <StatusPill
                label="Signed"
                className="bg-emerald-50 text-emerald-800"
              />
            ) : null}
            <ArchiveBadge kind="estimate" id={estimate.id} />
          </>
        }
        actions={
          <>
            {job ? (
              <Button size="sm" asChild>
                <Link href={`/pro/dashboard/jobs/${job.id}`}>
                  Open {job.number}
                </Link>
              </Button>
            ) : signed ? (
              <Button
                size="sm"
                data-action="convert-to-job"
                disabled={converting}
                onClick={convertToJob}
              >
                {converting ? "Converting…" : "Convert to job"}
              </Button>
            ) : (
              <>
                {canShare ? (
                  <Button size="sm" variant="default" onClick={openApproval}>
                    <Share2 className="size-3.5" />
                    Send for approval
                  </Button>
                ) : estimate.status === "site_visit" ? null : (
                  <Button
                    size="sm"
                    disabled={finalizing}
                    onClick={() => void finalizeEstimate()}
                  >
                    {finalizing ? "Finalizing…" : "Finalize estimate"}
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setAssignOpen(true)}
                >
                  Assign technician
                </Button>
              </>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  More actions
                  <ChevronDown className="size-3.5" aria-hidden="true" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-44">
                {!signed && !job ? (
                  <>
                    <DropdownMenuItem onSelect={() => setAssignOpen(true)}>
                      Assign technician
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => setTaskOpen(true)}>
                      Create task
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => setNoteOpen(true)}>
                      Add note
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => setReminderOpen(true)}>
                      Set reminder
                    </DropdownMenuItem>
                  </>
                ) : null}
                {records.isArchived("estimate", estimate.id) ? (
                  <DropdownMenuItem
                    disabled={restoring}
                    onSelect={async () => {
                      setRestoring(true);
                      try {
                        if (apiReady) {
                          const updated = await updateEstimateArchiveApi(estimate.id, false);
                          if (updated) {
                            crm.patchEstimate(estimate.id, updated);
                            setFetched(updated);
                          } else {
                            crm.patchEstimate(estimate.id, { isArchived: false, isArchieved: false });
                          }
                          if (crm.ready) {
                            void crm.refresh({ silent: true });
                          }
                        }
                        records.unarchive("estimate", estimate.id);
                        toast.success(`${estimate.number} restored.`);
                      } catch (error) {
                        toast.error(
                          error instanceof Error
                            ? error.message
                            : "Could not restore this estimate.",
                        );
                      } finally {
                        setRestoring(false);
                      }
                    }}
                  >
                    {restoring ? "Restoring…" : "Restore estimate"}
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem
                    onSelect={() => {
                      setArchiveOpen(true);
                    }}
                  >
                    Archive estimate
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        }
        notice={<FileNotices kind="estimate" id={estimate.id} />}
      >
        {(tab) => {
          const body = (() => {
            switch (tab) {
              case "summary":
                return (
                  <JobSummaryTab
                    job={asJob}
                    estimate={estimate}
                    technician=""
                    noun="estimate"
                    locked={signed}
                  />
                );
              case "visit":
                return (
                  <EstimateSiteVisitTab
                    estimate={estimate}
                    asJob={asJob}
                    locked={signed || visitLocked}
                    onSave={async (visit) => {
                      const nextStatus =
                        estimate.status === "draft" ||
                        estimate.status === "site_visit"
                          ? "inspected"
                          : estimate.status;
                      if (apiReady) {
                        try {
                          const siteVisitRecord = siteVisitToRecord(visit);
                          const updated = await updateEstimateSiteVisit(
                            estimate.id,
                            siteVisitRecord ?? { photos: [] },
                            nextStatus !== estimate.status
                              ? nextStatus
                              : undefined,
                          );
                          if (updated) {
                            crm.patchEstimate(estimate.id, updated);
                            setFetched(updated);
                          } else {
                            crm.patchEstimate(estimate.id, {
                              status: nextStatus,
                              siteVisit: siteVisitRecord,
                            });
                            setFetched((prev) =>
                              prev
                                ? {
                                    ...prev,
                                    status: nextStatus,
                                    siteVisit: siteVisitRecord,
                                  }
                                : prev,
                            );
                          }
                          if (crm.ready) {
                            void crm.refresh({ silent: true });
                          }
                        } catch (error) {
                          toast.error(
                            error instanceof Error
                              ? error.message
                              : "Could not update this estimate.",
                          );
                          throw error;
                        }
                      } else {
                        if (
                          estimate.status === "draft" ||
                          estimate.status === "site_visit"
                        ) {
                          records.setStatus(
                            "estimate",
                            estimate.id,
                            "inspected",
                          );
                        }
                      }
                    }}
                  />
                );
              case "materials":
                return (
                  <JobMaterialsTab
                    job={asJob}
                    estimate={estimate}
                    technician=""
                    noun="estimate"
                    locked={signed}
                    onSave={async (lines) => {
                      const filled = filledWorkLines(lines);
                      const items = linesToEstimateItems(quote.id, filled);
                      writeCostLines(session?.email, quote.id, lines);
                      if (apiReady) {
                        try {
                          const updated = await updateEstimateApi(quote.id, {
                            ...quote,
                            items,
                          });
                          if (updated) {
                            crm.patchEstimate(quote.id, updated);
                            setFetched(updated);
                          } else {
                            crm.patchEstimate(quote.id, { items });
                          }
                          if (crm.ready) {
                            void crm.refresh({ silent: true });
                          }
                        } catch (error) {
                          toast.error(
                            error instanceof Error
                              ? error.message
                              : "Could not save line items to server.",
                          );
                          throw error;
                        }
                      }
                    }}
                  />
                );
              case "share":
                return (
                  <EstimateShareTab
                    estimate={estimate}
                    customer={customer}
                    customerLabel={customerLabel}
                    locked={signed}
                    onFinalize={() => void finalizeEstimate()}
                    finalizing={finalizing}
                    onSent={(result) => {
                      if (!result?.viaApi)
                        records.setStatus("estimate", estimate.id, "sent");
                    }}
                  />
                );
              case "logs":
                return (
                  <JobLogsTab
                    job={asJob}
                    estimate={estimate}
                    technician=""
                    noun="estimate"
                  />
                );
              case "notes":
                return (
                  <NotesPanel
                    kind="estimate"
                    id={estimate.id}
                    locked={signed}
                    empty="Add the first note on this estimate."
                  />
                );
              case "attachments":
                return (
                  <JobAttachmentsTab
                    job={asJob}
                    estimate={estimate}
                    technician=""
                    noun="estimate"
                    locked={signed}
                    onSave={(updated) => {
                      setFetched(updated);
                    }}
                  />
                );
              case "settings":
                return (
                  <EstimateSettingsTab
                    estimate={estimate}
                    job={job}
                    service={service}
                    locked={signed}
                    onSave={(updated) => {
                      setFetched(updated);
                    }}
                  />
                );
              default:
                return (
                  <JobSummaryTab
                    job={asJob}
                    estimate={estimate}
                    technician=""
                    noun="estimate"
                    locked={signed}
                  />
                );
            }
          })();
          return (
            <div className="space-y-4">
              <EstimatePipeline
                status={estimate.status}
                signed={signed}
                hasJob={Boolean(job)}
                hasSiteVisit={Boolean(siteVisit)}
              />
              <EstimateStageBanner
                status={estimate.status}
                signed={signed}
                hasJob={Boolean(job)}
              />
              {job ? (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
                  <p className="text-sm font-semibold text-emerald-900">
                    Converted to job
                  </p>
                  <p className="mt-1 text-sm text-emerald-950">
                    This estimate is locked to{" "}
                    <Link
                      href={`/pro/dashboard/jobs/${job.id}`}
                      className="font-semibold underline"
                    >
                      {job.number}
                    </Link>
                    . Delete that job if you need to convert it again.
                  </p>
                  <div className="mt-3 flex justify-end">
                    <Button size="sm" asChild>
                      <Link href={`/pro/dashboard/jobs/${job.id}`}>
                        Open {job.number}
                      </Link>
                    </Button>
                  </div>
                </div>
              ) : canConvert ? (
                <div className="rounded-lg border border-[#003F7D]/20 bg-[#f4f7fb] px-4 py-3">
                  <p className="text-sm font-semibold text-[#003F7D]">
                    Convert to job
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Create a job with this customer, address, line items, notes,
                    and site photos. The job will keep a reference back to{" "}
                    {estimate.number}.
                  </p>
                  <div className="mt-3 flex justify-end">
                    <Button
                      size="sm"
                      disabled={converting}
                      onClick={convertToJob}
                    >
                      {converting ? "Converting…" : "Convert to job"}
                    </Button>
                  </div>
                </div>
              ) : null}
              <EstimateFileChrome
                estimate={estimate}
                customer={customer}
                customerLabel={customerLabel}
                service={service}
                job={job}
              />
              {body}
            </div>
          );
        }}
      </RecordWorkspace>
      <AssignEventDialog
        open={assignOpen}
        onOpenChange={setAssignOpen}
        event={estimateAssignmentEvent}
        events={[estimateAssignmentEvent]}
        employees={employees}
        onSave={async (assignment) => {
          await assign(assignment);

          const selectedTech = employees.find(
            (emp) => emp.id === assignment.employeeId,
          );
          const techName = selectedTech
            ? employeeName(selectedTech)
            : assignment.employeeId || "";
          const currentVisit =
            siteVisit || siteVisitFromRecord(estimate.siteVisit);
          const visitIso = assignment.date
            ? `${assignment.date}T00:00:00.000Z`
            : currentVisit?.visitedAt || new Date().toISOString();

          const updatedSiteVisit: EstimateSiteVisit = {
            employeeId: assignment.employeeId || "",
            technician: techName,
            visitedAt: visitIso,
            accessNotes: currentVisit?.accessNotes || "",
            findings: currentVisit?.findings || "",
            recommendations: currentVisit?.recommendations || "",
            measurements: currentVisit?.measurements || "",
            photos: currentVisit?.photos || [],
          };

          writeSiteVisit(session?.email, estimate.id, updatedSiteVisit);

          if (apiReady) {
            try {
              const siteVisitRecord = siteVisitToRecord(updatedSiteVisit);
              const updated = await updateEstimateSiteVisit(
                estimate.id,
                siteVisitRecord ?? { photos: [] },
              );
              if (updated) {
                crm.patchEstimate(estimate.id, updated);
                setFetched(updated);
              } else {
                crm.patchEstimate(estimate.id, {
                  siteVisit: siteVisitRecord,
                });
                setFetched((prev) =>
                  prev ? { ...prev, siteVisit: siteVisitRecord } : prev,
                );
              }
              if (crm.ready) {
                void crm.refresh({ silent: true });
              }
            } catch {
              // local fallback already written
            }
          }

          toast.success(
            `${techName ? `${techName} assigned to estimate` : "Assignment saved"} and scheduled on the calendar.`,
          );
        }}
      />
      <SendApprovalDialog
        open={approvalOpen}
        onOpenChange={setApprovalOpen}
        estimate={estimate}
        customer={customer}
        customerLabel={customerLabel}
        onSent={({ viaApi }) => {
          if (!viaApi) records.setStatus("estimate", estimate.id, "sent");
        }}
      />
      <CreateReminderDialog
        open={reminderOpen}
        onOpenChange={setReminderOpen}
        subjectKind="estimate"
        subjectId={estimate.id}
      />
      <CreateTaskDialog
        open={taskOpen}
        onOpenChange={setTaskOpen}
        subjectKind="estimate"
        subjectId={estimate.id}
      />
      <CreateNoteDialogForSubject
        open={noteOpen}
        onOpenChange={setNoteOpen}
        subjectKind="estimate"
        subjectId={estimate.id}
      />
      <ConfirmArchiveDialog
        open={archiveOpen}
        onOpenChange={(open) => {
          if (!archiving) setArchiveOpen(open);
        }}
        kind="estimate"
        number={estimate.number}
        loading={archiving}
        onConfirm={async () => {
          setArchiving(true);
          try {
            if (apiReady) {
              const updated = await updateEstimateArchiveApi(estimate.id, true);
              if (updated) {
                crm.patchEstimate(estimate.id, updated);
                setFetched(updated);
              } else {
                crm.patchEstimate(estimate.id, { isArchived: true, isArchieved: true });
              }
              if (crm.ready) {
                void crm.refresh({ silent: true });
              }
            }
            records.archive("estimate", estimate.id);
            toast.success(`${estimate.number} archived.`);
            setArchiveOpen(false);
          } catch (error) {
            toast.error(
              error instanceof Error
                ? error.message
                : "Could not archive this estimate.",
            );
          } finally {
            setArchiving(false);
          }
        }}
      />
    </>
  );
}

export function JobDetailView({ id }: { id: string }) {
  const router = useRouter();
  const crm = useCrmApiData();
  const { session, jobs, estimates, invoices, requests, provider } =
    usePortalWorkspace();
  const { customers } = useCrmDirectory();
  const { events, employees, assign, employeeLabel } = usePortalCrew();
  const records = usePortalRecords();
  const settings = useJobSettings(id);
  const [assignOpen, setAssignOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [reminderOpen, setReminderOpen] = useState(false);
  const [taskOpen, setTaskOpen] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [fetched, setFetched] = useState<Job | null>(null);
  const [fetching, setFetching] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const allJobs = records.mergeJobs(jobs);
  const allEstimates = records.mergeEstimates(estimates);
  const allInvoices = records.mergeInvoices(invoices);
  const listed = allJobs.find((item) => item.id === id);
  // Prefer live GET /api/provider/jobs/:id over workspace list seed.
  const seeded = fetched ?? listed;
  const job = seeded
    ? applyJobSettings(
        { ...seeded, status: records.statusOf("job", seeded.id, seeded.status) },
        settings,
      )
    : undefined;
  const estimate = allEstimates.find((item) => item.id === job?.estimateId);
  const invoice =
    allInvoices.find((item) => item.id === records.linkedId("job", id)) ??
    allInvoices.find((item) => item.id === job?.invoiceId) ??
    allInvoices.find((item) => item.jobId === id);
  const event = events.find(
    (item) => item.kind === "job" && item.recordId === id,
  );
  const start = settings?.start || event?.date || job?.scheduledAt;
  const due = settings?.due || event?.endDate || job?.dueAt;
  const customer = customers.find((item) => item.id === job?.customerId);
  const customerLabel = customer
    ? crmCustomerName(customer)
    : job
      ? getPortalCustomerName(provider, job.customerId)
      : "Customer";
  const apiReady = crm.enabled && crm.ready;
  const pending = useCrmRecordPending();

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
    // MD / CRM: GET /api/provider/jobs/:id
    void getJob(id)
      .then((item) => {
        if (cancelled) return;
        if (!item) {
          setFetched(null);
          setFetchError("Job not found");
          return;
        }
        setFetched(item);
        records.cacheJob(item);
      })
      .catch((error) => {
        if (cancelled) return;
        setFetched(null);
        setFetchError(
          error instanceof Error && error.message
            ? error.message
            : "Could not load this job.",
        );
      })
      .finally(() => {
        if (!cancelled) setFetching(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- records.cacheJob is stable enough; avoid refetch loops
  }, [id]);

  if (!job) {
    if (pending || fetching || crm.refreshing) {
      return (
        <div className="border border-black/15 bg-card" aria-busy="true">
          <CenteredSpinner className="min-h-[22rem]" />
        </div>
      );
    }
    return (
      <Missing
        title={fetchError || "Job not found"}
        href="/pro/dashboard/jobs"
      />
    );
  }

  const currentJob = job;
  const technician =
    settings?.assignedTo ||
    (event ? employeeLabel(event.employeeId) : (currentJob.assignedTo ?? ""));
  const service =
    settings?.name || job.title || jobServiceLabel(job, allEstimates, requests);
  const jobWindow = minutesForWindow("morning");
  const jobStartDate = (start || todayISO()).slice(0, 10);
  const jobEndDate = (due || start || todayISO()).slice(0, 10);
  const jobAssignmentEvent: PortalCalendarEvent = event ?? {
    id: `cal_${job.id}`,
    kind: "job",
    recordId: job.id,
    title: job.number,
    detail: service,
    customerName: customerLabel,
    date: jobStartDate,
    endDate: jobEndDate,
    timeWindow: "morning",
    startMinutes: jobWindow.startMinutes,
    endMinutes: jobWindow.endMinutes,
    employeeId:
      settings?.employeeId || employees.find((item) => item.active)?.id,
    href: `/pro/dashboard/jobs/${job.id}`,
    status: job.status,
  };

  async function convertToInvoice() {
    try {
      if (invoice) {
        router.push(`/pro/dashboard/invoices/${invoice.id}`);
        return;
      }
      if (apiReady) {
        const created = await convertJobToInvoiceApi(currentJob.id);
        if (!created?.id)
          throw new Error("The CRM did not return the new invoice.");
        await crm.refresh();
        toast.success(
          `${created.number || "Invoice"} drafted from ${currentJob.number}.`,
        );
        router.push(`/pro/dashboard/invoices/${created.id}`);
        return;
      }
      const lines = readCostLines(session?.email, currentJob);
      const created = buildInvoice({
        number: nextRecordNumber(
          "INV",
          allInvoices.map((item) => item.number),
        ),
        providerId: provider.id,
        customerId: currentJob.customerId,
        jobId: currentJob.id,
        lines: lines.length
          ? lines
          : currentJob.items.map((item) => ({
              id: item.id,
              description: item.description,
              kind: "materials" as const,
              quantity: item.quantity,
              unit: item.unit,
              unitPrice: item.unitPrice,
            })),
      });
      records.addInvoice(created);
      records.linkRecords("job", currentJob.id, created.id);
      records.setStatus("job", currentJob.id, "invoiced");
      toast.success(`${created.number} drafted from ${currentJob.number}.`);
      router.push(`/pro/dashboard/invoices/${created.id}`);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not convert this job.",
      );
    }
  }

  async function deleteJob() {
    if (deleting) return;
    const confirmed = window.confirm(
      `Delete ${currentJob.number}? The source estimate can be converted again.`,
    );
    if (!confirmed) return;
    setDeleting(true);
    try {
      if (apiReady) {
        await deleteJobApi(currentJob.id);
        await crm.refresh();
      } else {
        records.remove("job", currentJob.id);
        if (currentJob.estimateId) {
          records.setStatus("estimate", currentJob.estimateId, "draft");
        }
      }
      toast.success(
        `${currentJob.number} deleted. The estimate can be converted again.`,
      );
      router.push("/pro/dashboard/jobs");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not delete this job.",
      );
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <RecordWorkspace
        href={`/pro/dashboard/jobs/${job.id}`}
        label={job.number}
        kind="job"
        tabs={[
          { id: "summary", label: "Summary", icon: LayoutDashboard },
          { id: "materials", label: "Materials", icon: FileText },
          { id: "logs", label: "Logs", icon: ScrollText },
          { id: "notes", label: "Notes", icon: NotebookPen },
          { id: "attachments", label: "Attachments", icon: Paperclip },
          { id: "settings", label: "Job settings", icon: Settings },
        ]}
        badge={
          <>
            <StatusPill
              label={jobStatusLabel(job.status)}
              className={jobStatusTone(job.status)}
            />
            <ArchiveBadge kind="job" id={job.id} />
          </>
        }
        actions={
          <>
            {invoice ? (
              <Button size="sm" variant="outline" asChild>
                <Link href={`/pro/dashboard/invoices/${invoice.id}`}>
                  Open {invoice.number}
                </Link>
              </Button>
            ) : (
              <Button
                size="sm"
                data-action="convert-to-invoice"
                onClick={convertToInvoice}
              >
                Convert to invoice
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={() => setAssignOpen(true)}
            >
              Assign technician
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  More actions
                  <ChevronDown className="size-3.5" aria-hidden="true" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-44">
                <DropdownMenuItem asChild>
                  <Link href="/pro/dashboard/schedule">Open calendar</Link>
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setTaskOpen(true)}>
                  Create task
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setNoteOpen(true)}>
                  Add note
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setReminderOpen(true)}>
                  Set reminder
                </DropdownMenuItem>
                {records.isArchived("job", job.id) ? (
                  <DropdownMenuItem
                    onSelect={() => {
                      records.restore("job", job.id);
                      toast.success(`${job.number} restored.`);
                    }}
                  >
                    Restore job
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem
                    onSelect={() => {
                      records.archive("job", job.id);
                      toast.success(`${job.number} archived.`);
                    }}
                  >
                    Archive job
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  disabled={deleting}
                  onSelect={deleteJob}
                >
                  {deleting ? "Deleting…" : "Delete job"}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        }
        notice={<FileNotices kind="job" id={job.id} />}
      >
        {(tab) => {
          const body = (() => {
            switch (tab) {
              case "summary":
                return (
                  <JobSummaryTab
                    job={job}
                    estimate={estimate}
                    invoice={invoice}
                    technician={technician}
                  />
                );
              case "materials":
                return (
                  <JobMaterialsTab
                    job={job}
                    estimate={estimate}
                    invoice={invoice}
                    technician={technician}
                  />
                );
              case "logs":
                return (
                  <JobLogsTab
                    job={job}
                    estimate={estimate}
                    invoice={invoice}
                    technician={technician}
                  />
                );
              case "notes":
                return (
                  <NotesPanel
                    kind="job"
                    id={job.id}
                    empty="Add the first note on this job."
                  />
                );
              case "attachments":
                return (
                  <JobAttachmentsTab
                    job={job}
                    estimate={estimate}
                    invoice={invoice}
                    technician={technician}
                  />
                );
              case "settings":
                return (
                  <JobSettingsTab
                    job={job}
                    estimate={estimate}
                    invoice={invoice}
                    technician={technician}
                    service={service}
                    start={start}
                    due={due}
                    employeeId={settings?.employeeId || event?.employeeId}
                  />
                );
              default:
                return (
                  <JobSummaryTab
                    job={job}
                    estimate={estimate}
                    invoice={invoice}
                    technician={technician}
                  />
                );
            }
          })();
          return (
            <div className="space-y-4">
              {estimate ? (
                <div className="rounded-[4px] border border-[#003F7D]/15 bg-[#f4f7fb] px-4 py-3">
                  <p className="text-sm font-semibold text-[#003F7D]">
                    Converted from estimate
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    This job was created from{" "}
                    <Link
                      href={`/pro/dashboard/estimates/${estimate.id}`}
                      className="font-semibold text-primary underline"
                    >
                      {estimate.number}
                    </Link>
                    {estimate.title ? ` · ${estimate.title}` : ""}. Open the
                    estimate to see the original quote.
                  </p>
                </div>
              ) : job.estimateId ? (
                <div className="rounded-[4px] border border-[#003F7D]/15 bg-[#f4f7fb] px-4 py-3">
                  <p className="text-sm font-semibold text-[#003F7D]">
                    Converted from estimate
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    This job keeps a reference to its source estimate.
                  </p>
                </div>
              ) : null}
              <JobFileChrome
                job={job}
                customer={customer}
                customerLabel={customerLabel}
                service={service}
                estimate={estimate}
                invoice={invoice}
                start={start}
                due={due}
                technician={technician}
              />
              {body}
            </div>
          );
        }}
      </RecordWorkspace>
      <AssignEventDialog
        open={assignOpen}
        onOpenChange={setAssignOpen}
        event={jobAssignmentEvent}
        events={[jobAssignmentEvent]}
        employees={employees}
        onSave={async (assignment) => {
          await assign(assignment);
          toast.success(
            `${calendarEventKindLabel(assignment.kind)} assigned on the calendar.`,
          );
        }}
      />
      <CreateReminderDialog
        open={reminderOpen}
        onOpenChange={setReminderOpen}
        subjectKind="job"
        subjectId={job.id}
      />
      <CreateTaskDialog
        open={taskOpen}
        onOpenChange={setTaskOpen}
        subjectKind="job"
        subjectId={job.id}
      />
      <CreateNoteDialogForSubject
        open={noteOpen}
        onOpenChange={setNoteOpen}
        subjectKind="job"
        subjectId={job.id}
      />
    </>
  );
}

export function InvoiceDetailView({ id }: { id: string }) {
  const { invoices, jobs, estimates, requests, payments, provider } =
    usePortalWorkspace();
  const { customers } = useCrmDirectory();
  const records = usePortalRecords();
  const settings = useInvoiceSettings(id);
  const seeded = records.mergeInvoices(invoices).find((item) => item.id === id);
  const invoice = seeded
    ? {
        ...applyInvoiceSettings(seeded, settings),
        status: records.statusOf("invoice", seeded.id, seeded.status),
      }
    : undefined;
  const allJobs = records.mergeJobs(jobs);
  const allEstimates = records.mergeEstimates(estimates);
  const job = allJobs.find((item) => item.id === invoice?.jobId);
  const estimate = allEstimates.find((item) => item.id === job?.estimateId);
  const relatedPayments = records
    .mergePayments(payments)
    .filter((item) => item.invoiceId === id);
  const customer = customers.find((item) => item.id === invoice?.customerId);
  const customerLabel = customer
    ? crmCustomerName(customer)
    : invoice
      ? getPortalCustomerName(provider, invoice.customerId)
      : "Customer";
  const pending = useCrmRecordPending();

  if (!invoice) {
    return pending ? (
      <div className="flex min-h-[50vh] items-center justify-center py-12">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    ) : (
      <Missing title="Invoice not found" href="/pro/dashboard/invoices" />
    );
  }

  const asJob = invoiceAsJob(invoice, job);
  const service = job
    ? jobServiceLabel(job, allEstimates, requests)
    : invoice.items[0]?.description || "Service";

  return (
    <RecordWorkspace
      href={`/pro/dashboard/invoices/${invoice.id}`}
      label={invoice.number}
      kind="invoice"
      tabs={[
        { id: "summary", label: "Summary", icon: LayoutDashboard },
        { id: "materials", label: "Line items", icon: FileText },
        { id: "payments", label: "Payments", icon: CreditCard },
        { id: "attachments", label: "Attachments", icon: Paperclip },
        { id: "logs", label: "Logs", icon: ScrollText },
      ]}
      badge={
        <>
          <StatusPill
            label={invoiceStatusLabel(invoice.status)}
            className={invoiceStatusTone(invoice.status)}
          />
          <StatusPill label={invoiceKindLabel(invoiceKind(invoice))} />
          {invoiceDaysOverdue(invoice) ? (
            <StatusPill
              label={`${invoiceDaysOverdue(invoice)} days overdue`}
              className="bg-red-50 text-red-700"
            />
          ) : null}
          <ArchiveBadge kind="invoice" id={invoice.id} />
        </>
      }
      actions={
        <>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              void (async () => {
                try {
                  await sendInvoiceApi(invoice.id);
                  await records.setStatus("invoice", invoice.id, "sent");
                  toast.success(`${invoice.number} marked sent.`);
                } catch (error) {
                  toast.error(
                    error instanceof Error
                      ? error.message
                      : "Could not send this invoice.",
                  );
                }
              })();
            }}
          >
            Send invoice
          </Button>
          <ApplyPaymentButton invoice={invoice} />
          {job ? (
            <Button size="sm" variant="outline" asChild>
              <Link href={`/pro/dashboard/jobs/${job.id}`}>
                Open {job.number}
              </Link>
            </Button>
          ) : null}
          <ArchiveButton
            kind="invoice"
            id={invoice.id}
            label={invoice.number}
          />
        </>
      }
    >
      {(tab) => {
        const body = (() => {
          switch (tab) {
            case "summary":
              return (
                <InvoiceSummaryTab
                  invoice={invoice}
                  customer={customer}
                  customerLabel={customerLabel}
                  service={service}
                  job={job}
                  estimate={estimate}
                  payments={relatedPayments}
                />
              );
            case "materials":
              return (
                <JobMaterialsTab
                  job={asJob}
                  estimate={estimate}
                  invoice={invoice}
                  technician=""
                  noun="invoice"
                />
              );
            case "payments":
              return (
                <InvoicePaymentsTab
                  invoice={invoice}
                  payments={relatedPayments}
                />
              );
            case "attachments":
              return (
                <JobAttachmentsTab
                  job={asJob}
                  estimate={estimate}
                  invoice={invoice}
                  technician=""
                  noun="invoice"
                />
              );
            case "logs":
              return (
                <JobLogsTab
                  job={asJob}
                  estimate={estimate}
                  invoice={invoice}
                  technician=""
                  noun="invoice"
                />
              );
            default:
              return (
                <InvoiceSummaryTab
                  invoice={invoice}
                  customer={customer}
                  customerLabel={customerLabel}
                  service={service}
                  job={job}
                  estimate={estimate}
                  payments={relatedPayments}
                />
              );
          }
        })();
        return (
          <div className="space-y-4">
            <InvoiceFileChrome
              invoice={invoice}
              customer={customer}
              customerLabel={customerLabel}
              service={service}
              job={job}
              estimate={estimate}
            />
            {body}
          </div>
        );
      }}
    </RecordWorkspace>
  );
}

export function PaymentDetailView({ id }: { id: string }) {
  const { invoices, jobs, estimates, requests, payments, provider } =
    usePortalWorkspace();
  const { customers } = useCrmDirectory();
  const records = usePortalRecords();
  const payment = records
    .mergePayments(payments)
    .map((item) => ({
      ...item,
      status: records.statusOf("payment", item.id, item.status),
    }))
    .find((item) => item.id === id);
  const allInvoices = records.mergeInvoices(invoices);
  const allJobs = records.mergeJobs(jobs);
  const allEstimates = records.mergeEstimates(estimates);
  const invoice = allInvoices.find((item) => item.id === payment?.invoiceId);
  const job = allJobs.find((item) => item.id === invoice?.jobId);
  const customer = customers.find((item) => item.id === invoice?.customerId);
  const customerLabel = customer
    ? crmCustomerName(customer)
    : invoice
      ? getPortalCustomerName(provider, invoice.customerId)
      : "Customer";
  const service = job
    ? jobServiceLabel(job, allEstimates, requests)
    : invoice?.items[0]?.description || "Service";
  const pending = useCrmRecordPending();

  if (!payment) {
    return pending ? (
      <div className="flex min-h-[50vh] items-center justify-center py-12">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    ) : (
      <Missing title="Payment not found" href="/pro/dashboard/payments" />
    );
  }

  return (
    <RecordWorkspace
      href={`/pro/dashboard/payments/${payment.id}`}
      label={paymentNumber(payment)}
      kind="payment"
      tabs={[{ id: "summary", label: "Summary", icon: LayoutDashboard }]}
      badge={
        <>
          <StatusPill
            label={paymentStatusLabel(payment.status)}
            className={paymentStatusTone(payment.status)}
          />
          <StatusPill label={paymentKindLabel(paymentKind(payment))} />
          <ArchiveBadge kind="payment" id={payment.id} />
        </>
      }
      actions={
        <>
          {invoice ? (
            <Button size="sm" variant="outline" asChild>
              <Link href={`/pro/dashboard/invoices/${invoice.id}`}>
                Open {invoice.number}
              </Link>
            </Button>
          ) : null}
          {job ? (
            <Button size="sm" variant="outline" asChild>
              <Link href={`/pro/dashboard/jobs/${job.id}`}>
                Open {job.number}
              </Link>
            </Button>
          ) : null}
          <ArchiveButton
            kind="payment"
            id={payment.id}
            label={paymentNumber(payment)}
          />
        </>
      }
    >
      {() => (
        <div className="space-y-4">
          <PaymentFileChrome
            payment={payment}
            invoice={invoice}
            customerLabel={customerLabel}
            service={service}
            job={job}
          />
          <PaymentSummaryTab
            payment={payment}
            invoice={invoice}
            customer={customer}
            customerLabel={customerLabel}
            service={service}
            job={job}
          />
        </div>
      )}
    </RecordWorkspace>
  );
}

function Missing({ title, href }: { title: string; href: string }) {
  return (
    <PortalPage title={title}>
      <Button asChild>
        <Link href={href}>Back</Link>
      </Button>
    </PortalPage>
  );
}
