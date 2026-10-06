"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  Clock3,
  Loader2,
  Pencil,
  Share2,
} from "lucide-react";
import { toast } from "sonner";
import { ArchiveBadge, ConfirmArchiveDialog } from "@/components/portal/archive-control";
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
  ChangeVisitAssignmentDialog,
  ScheduleAnotherSiteVisitDialog,
  SiteVisitDetailsDialog,
} from "@/components/portal/schedule-another-site-visit-dialog";
import {
  EstimateSettingsDialog,
} from "@/components/portal/estimate-file";
import {
  EstimateSiteVisitTab,
  EstimateStageBanner,
} from "@/components/portal/estimate-flow";
import { EstimateShareTab } from "@/components/portal/share-estimate-panel";
import { SendApprovalDialog } from "@/components/portal/send-approval-dialog";
import { useCrmApiData } from "@/components/portal/use-crm-api-data";
import { useCrmRecordPending } from "@/components/portal/use-crm-record-pending";
import { useEstimateShare } from "@/components/portal/use-estimate-share";
import {
  InvoiceFileChrome,
  InvoicePaymentsTab,
  InvoiceSummaryTab,
} from "@/components/portal/invoice-file";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { selectAuth, selectAuthUser } from "@/store/authSlice";
import { patchEstimateLocally } from "@/store/estimatesSlice";
import {
  fetchInvoiceDetail,
  patchInvoiceArchive,
  sendInvoiceRecord,
  updateInvoiceRecord,
} from "@/store/invoicesSlice";
import {
  fetchPaymentDetail,
  fetchPayments,
  invalidatePaymentsCache,
  patchPaymentArchive,
  upsertPaymentItem,
} from "@/store/paymentsSlice";
import {
  PaymentFileChrome,
  PaymentSummaryTab,
} from "@/components/portal/payment-file";
import {
  JobAttachmentsTab,
  JobLogsTab,
  JobMaterialsTab,
  JobSettingsTab,
  JobSummaryTab,
} from "@/components/portal/job-file";
import { JobChangeOrderDialog } from "@/components/portal/job-change-order-dialog";
import { JobChangeOrdersPanel } from "@/components/portal/job-change-orders-panel";
import {
  costingHint,
  type JobCostingActions,
} from "@/components/portal/job-costing";
import { LineItemsActions } from "@/components/portal/line-items-editor";
import {
  copyCostLines,
  jobCostMix,
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
import {
  convertJobToInvoiceRecord,
  deleteJobRecord,
  fetchJobDetail,
  patchJobArchive,
  patchJobLocally,
  updateJobRecord,
  upsertJobItem,
} from "@/store/jobsSlice";
import {
  estimateAsJob,
  filledWorkLines,
  invoiceAsJob,
  buildInvoice,
  buildJob,
  linesToEstimateItems,
  linesToInvoiceItems,
  linesToJobItems,
  nextRecordNumber,
  todayISO,
} from "@/components/portal/work-builders";
import {
  convertEstimateToJob as convertEstimateToJobApi,
  createEstimateActivity,
  deleteJob as deleteJobApi,
  finalizeEstimate as finalizeEstimateApi,
  getEstimate,
  getJob,
  getInvoiceWithPayments,
  queryInvoices,
  resolveCrmObjectId,
  isLocalInvoicePortalKey,
  sendInvoice as sendInvoiceApi,
  updateEstimate as updateEstimateApi,
  updateEstimateArchive as updateEstimateArchiveApi,
  updateEstimateSiteVisit,
} from "@/lib/api/crm-client";
import {
  canStartJobNow,
  clearCalendarAssignment,
  syncCalendarAssignment,
} from "@/lib/portal-schedule-sync";
import type { Estimate, EstimateSiteVisitRecord, Invoice, Job, Payment } from "@/lib/types";
import {
  extractErrorMessage,
  getAuthToken,
} from "@/components/api/apiFuntions";
import { crmCustomerName } from "@/lib/data/crm-people";
import { formatDate, formatLocation, formatMoney } from "@/lib/format";
import { TimeTrackingPanel } from "@/components/time-tracking/time-tracking-panel";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  calendarEventKindLabel,
  estimateCanConvert,
  estimateCanFinalize,
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

function siteVisitScheduledActivityDescription(input: {
  date: string;
  startMinutes?: number;
  endMinutes?: number;
  technician?: string;
  visitLabel?: string;
}) {
  const dateLabel = input.date
    ? new Date(`${input.date}T12:00:00`).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "TBD";
  const start =
    typeof input.startMinutes === "number" ? input.startMinutes : 540;
  const end =
    typeof input.endMinutes === "number" ? input.endMinutes : start + 30;
  const fmt = (m: number) => {
    const h24 = Math.floor(m / 60) % 24;
    const mins = m % 60;
    const period = h24 >= 12 ? "PM" : "AM";
    const h12 = h24 % 12 || 12;
    return `${h12}:${String(mins).padStart(2, "0")} ${period}`;
  };
  const tech = String(input.technician || "").trim() || "Unassigned";
  const visit = input.visitLabel
    ? `<p><strong>${input.visitLabel}</strong></p>`
    : "";
  return `${visit}<p><span style="display:inline-block;padding:2px 8px;border-radius:999px;background:#e8eef5;color:#003F7D;font-weight:600;font-size:12px;">Site visit scheduled</span></p><p><strong>Date:</strong> ${dateLabel}</p><p><strong>Time:</strong> ${fmt(start)} – ${fmt(end)}</p><p><strong>Technician:</strong> ${tech}</p>`;
}

function cloneVisitRecord(entry: EstimateSiteVisitRecord): EstimateSiteVisitRecord {
  return {
    ...entry,
    photos: Array.isArray(entry.photos)
      ? entry.photos.map((photo) => ({ ...photo }))
      : [],
  };
}

/** Always return the full visit history — never collapse to a single siteVisit. */
function resolveSiteVisitList(
  estimate: Estimate,
  local?: EstimateSiteVisit | null,
): EstimateSiteVisitRecord[] {
  if (Array.isArray(estimate.siteVisits) && estimate.siteVisits.length > 0) {
    return estimate.siteVisits.map(cloneVisitRecord);
  }
  if (estimate.siteVisit) {
    return [cloneVisitRecord(estimate.siteVisit)];
  }
  if (local) {
    const record = siteVisitToRecord(local);
    return record ? [cloneVisitRecord(record)] : [];
  }
  return [];
}

/** Prefer the longer local history if the API response dropped earlier visits. */
function preferFullVisitHistory(
  localVisits: EstimateSiteVisitRecord[],
  apiVisits?: EstimateSiteVisitRecord[] | null,
): EstimateSiteVisitRecord[] {
  if (!apiVisits?.length) return localVisits;
  if (apiVisits.length < localVisits.length) return localVisits;
  return apiVisits.map((entry, index) => {
    const prev = localVisits[index];
    if (!prev) return cloneVisitRecord(entry);
    return {
      ...cloneVisitRecord(entry),
      id: entry.id || prev.id,
      label: entry.label || prev.label,
      detailsPending:
        entry.detailsPending === true
          ? true
          : entry.detailsPending === false
            ? false
            : prev.detailsPending,
      photos:
        entry.photos?.length || !prev.photos?.length
          ? entry.photos || []
          : prev.photos,
      accessNotes: entry.accessNotes || prev.accessNotes,
      findings: entry.findings || prev.findings,
      visitedAt: entry.visitedAt || prev.visitedAt,
      scheduledAt: entry.scheduledAt || prev.scheduledAt,
      technician: entry.technician || prev.technician,
      employeeId: entry.employeeId || prev.employeeId,
    };
  });
}

export function EstimateDetailView({ id }: { id: string }) {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const auth = useAppSelector(selectAuth);
  const user = useAppSelector(selectAuthUser);
  const isProvider =
    auth.hydrated &&
    Boolean(auth.token) &&
    (user?.role === "provider" || auth.role === "provider");
  const crm = useCrmApiData();
  const { session, estimates, provider, jobs, invoices } = usePortalWorkspace();
  const { customers } = useCrmDirectory();
  const { events } = usePortalCrew();
  const records = usePortalRecords();
  const settings = useEstimateSettings(id);
  const localVisit = useEstimateSiteVisit(id);
  const share = useEstimateShare();
  const [changeAssignOpen, setChangeAssignOpen] = useState(false);
  const [scheduleAnotherOpen, setScheduleAnotherOpen] = useState(false);
  const [visitDetailsOpen, setVisitDetailsOpen] = useState(false);
  const [editingVisitIndex, setEditingVisitIndex] = useState<number | null>(
    null,
  );
  const [visitDetailsMode, setVisitDetailsMode] = useState<"add" | "edit">(
    "add",
  );
  const [approvalOpen, setApprovalOpen] = useState(false);
  const [converting, setConverting] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [reminderOpen, setReminderOpen] = useState(false);
  const [taskOpen, setTaskOpen] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [fetched, setFetched] = useState<Estimate | null>(null);
  const [fetching, setFetching] = useState(false);
  const [materialsActions, setMaterialsActions] =
    useState<JobCostingActions | null>(null);
  const onMaterialsActionsChange = useCallback(
    (next: JobCostingActions | null) => {
      setMaterialsActions((prev) => {
        if (!prev && !next) return prev;
        if (!next) return null;
        if (
          prev &&
          prev.locked === next.locked &&
          prev.saving === next.saving &&
          prev.addLabor === next.addLabor &&
          prev.addMaterial === next.addMaterial
        ) {
          return prev;
        }
        return next;
      });
    },
    [],
  );
  const [attachmentsActions, setAttachmentsActions] = useState<{
    locked: boolean;
    saving: boolean;
    uploading: boolean;
    dirty: boolean;
    save: () => void;
  } | null>(null);
  const onAttachmentsActionsChange = useCallback(
    (
      next: {
        locked: boolean;
        saving: boolean;
        uploading: boolean;
        dirty: boolean;
        save: () => void;
      } | null,
    ) => {
      setAttachmentsActions((prev) => {
        if (!prev && !next) return prev;
        if (!next) return null;
        if (
          prev &&
          prev.locked === next.locked &&
          prev.saving === next.saving &&
          prev.uploading === next.uploading &&
          prev.dirty === next.dirty &&
          prev.save === next.save
        ) {
          return prev;
        }
        return next;
      });
    },
    [],
  );
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

  const localApproval = share.approvalOf(id);
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
    if (!id || id === "new") return;
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
      <Missing title="Estimate not found" href="/pro/dashboard/new-estimate" />
    );
  }

  const quote = estimate;
  const asJob = estimateAsJob(quote);
  const service = settings?.name || estimateDisplayName(estimate);
  const siteAddress = [
    estimate.propertyAddress?.address || estimate.propertyAddress?.street,
    formatLocation(
      estimate.propertyAddress?.city || "",
      estimate.propertyAddress?.state || "",
      estimate.propertyAddress?.zip,
    ),
  ]
    .filter(Boolean)
    .join(", ");
  const quoteTotal = jobCostMix(
    filledWorkLines(readCostLines(session?.email, asJob)),
  ).total;
  const customerSignature =
    estimate.signature ||
    (localApproval
      ? {
          signedBy: localApproval.signedBy,
          signedAt: localApproval.signedAt,
          imageBase64: localApproval.signatureDataUrl || undefined,
        }
      : undefined);
  const signed = Boolean(
    customerSignature ||
    estimate.status === "accepted" ||
    (estimate.status as string) === "approved" ||
    estimate.status === "converted_to_job",
  );
  const canShare = estimateCanShare(estimate.status);
  const canFinalize = estimateCanFinalize(estimate.status);
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
    event?.date ||
    siteVisit?.visitedAt ||
    estimate.siteVisit?.visitedAt ||
    estimate.scheduledDate ||
    estimate.issuedAt ||
    ""
  ).slice(0, 10);
  const visitWindow = minutesForWindow(event?.timeWindow || "morning");
  const hasVisitAssignment = Boolean(
    assignedTechId ||
      visitDate ||
      siteVisit?.visitedAt ||
      estimate.siteVisit?.visitedAt,
  );
  const estimateAssignmentEvent: PortalCalendarEvent = {
    id: event?.id || `cal_${estimate.id}`,
    kind: "estimate",
    recordId: estimate.id,
    title:
      event?.title ||
      `${estimate.number || "Estimate"} site visit`,
    detail: event?.detail || `${service} · site visit`,
    customerName: event?.customerName || customerLabel,
    date: visitDate,
    endDate: (event?.endDate || visitDate).slice(0, 10),
    timeWindow: event?.timeWindow || "morning",
    startMinutes: event?.startMinutes ?? visitWindow.startMinutes,
    endMinutes: event?.endMinutes ?? visitWindow.endMinutes,
    employeeId: assignedTechId,
    href: `/pro/dashboard/new-estimate/${estimate.id}`,
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
      if (quote.status === "site_visit") {
        toast.error(
          "Complete the site visit and field notes before sending this estimate.",
        );
      } else if (quote.status === "inspected" || quote.status === "draft") {
        toast.error(
          "Finalize the estimate in the office before sending it for approval.",
        );
      } else {
        toast.error(
          "Finalize the estimate in the office before sending it for approval.",
        );
      }
      return;
    }
    setApprovalOpen(true);
  }

  async function finalizeEstimate() {
    if (finalizing) return;
    if (quote.status === "site_visit") {
      toast.error(
        "Complete and save the site inspection before finalizing the estimate.",
      );
      return;
    }
    if (!estimateCanFinalize(quote.status)) {
      toast.error("This estimate cannot be finalized in its current status.");
      return;
    }
    setFinalizing(true);
    try {
      const lines = filledWorkLines(readCostLines(session?.email, asJob));
      const taxRatePercent = await (
        await import("@/lib/tax/state-tax")
      ).fetchTaxRatePercent(quote.propertyAddress?.state);
      const items = lines.length
        ? linesToEstimateItems(quote.id, lines, taxRatePercent)
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
      toast.success("Estimate finalized. Send it to the customer to review & sign.");
      // Immediately open Send for approval — creating/finalizing alone does not notify.
      setApprovalOpen(true);
    } catch (error) {
      const message = extractErrorMessage(error);
      if (/status/i.test(message) && /finalized|one of|valid/i.test(message)) {
        setStatusOverride("finalized");
        crm.patchEstimate(quote.id, { status: "finalized" });
        toast.success("Estimate finalized. Send it to the customer to review & sign.");
        setApprovalOpen(true);
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
      const taxRatePercent = await (
        await import("@/lib/tax/state-tax")
      ).fetchTaxRatePercent(quote.propertyAddress?.state);
      const items = lines.length
        ? linesToEstimateItems(quote.id, lines, taxRatePercent)
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

  /** Reuse existing Estimate→Job + Job→Invoice APIs (no separate conversion flow). */
  async function convertToInvoice() {
    if (converting) return;

    const existingInvoiceId = resolveCrmObjectId(job?.invoiceId);
    if (existingInvoiceId) {
      router.push(`/pro/dashboard/invoices/${existingInvoiceId}`);
      return;
    }
    if (job && (job.status === "invoiced" || job.status === "paid")) {
      toast.error("This estimate’s job is already invoiced.");
      return;
    }

    setConverting(true);
    try {
      let liveJob = job ?? null;

      if (!liveJob) {
        if (!canConvert) {
          toast.error("This estimate cannot be converted right now.");
          return;
        }
        const lines = filledWorkLines(readCostLines(session?.email, asJob));
        const taxRatePercent = await (
          await import("@/lib/tax/state-tax")
        ).fetchTaxRatePercent(quote.propertyAddress?.state);
        const items = lines.length
          ? linesToEstimateItems(quote.id, lines, taxRatePercent)
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
          if (!created?.id) {
            throw new Error("The CRM did not return the new job.");
          }
          copyCostLines(session?.email, quote.id, created.id);
          if (siteVisit?.photos.length) {
            appendJobAttachments(session?.email, created.id, siteVisit.photos);
          }
          records.cacheJob(created);
          records.linkRecords("estimate", quote.id, created.id);
          setStatusOverride("converted_to_job");
          crm.patchEstimate(quote.id, {
            status: "converted_to_job",
            jobId: created.id,
          });
          liveJob = created;
        } else {
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
          setStatusOverride("converted_to_job");
          liveJob = created;
        }
      }

      if (!liveJob?.id) {
        throw new Error("Could not resolve a job for this estimate.");
      }

      const jobIsLive = Boolean(resolveCrmObjectId(liveJob.id));
      if (apiReady || jobIsLive) {
        const { invoice: created } = await dispatch(
          convertJobToInvoiceRecord(liveJob.id),
        ).unwrap();
        const dest = resolveCrmObjectId(created.id) || created.id;
        toast.success(
          `${created.number || "Invoice"} drafted from ${quote.number}.`,
        );
        if (!resolveCrmObjectId(dest)) {
          toast.error("Invoice created — open it from the Invoices list.");
          router.push("/pro/dashboard/invoices");
          return;
        }
        router.push(`/pro/dashboard/invoices/${dest}`);
        return;
      }

      const costLines = readCostLines(session?.email, liveJob);
      const draft = buildInvoice({
        number: nextRecordNumber(
          "INV",
          invoices.map((item) => item.number),
        ),
        providerId: provider.id,
        customerId: liveJob.customerId,
        jobId: liveJob.id,
        lines: costLines.length
          ? costLines
          : liveJob.items.map((item) => ({
              id: item.id,
              description: item.description,
              kind: (item.kind === "labor" ? "labor" : "materials") as
                | "labor"
                | "materials",
              quantity: item.quantity,
              unit: item.unit,
              unitPrice: item.unitPrice,
            })),
      });
      await records.addInvoice(draft);
      records.linkRecords("job", liveJob.id, draft.id);
      toast.success(`${draft.number} drafted from ${quote.number}.`);
      router.push(`/pro/dashboard/invoices/${draft.id}`);
    } catch (error) {
      toast.error(
        typeof error === "string"
          ? error
          : error instanceof Error
            ? error.message
            : "Could not convert this estimate to an invoice.",
      );
    } finally {
      setConverting(false);
    }
  }

  return (
    <>
      <RecordWorkspace
        href={`/pro/dashboard/new-estimate/${estimate.id}`}
        label={estimate.number}
        kind="estimate"
        tabs={[
          { id: "summary", label: "Summary" },
          { id: "visit", label: "Site visit" },
          { id: "materials", label: "Labour & Material" },
          { id: "share", label: "Share" },
          { id: "logs", label: "Logs" },
          { id: "notes", label: "Notes" },
          { id: "attachments", label: "Attachments" },
        ]}
        subnavTabs={["summary", "visit", "materials", "notes", "attachments"]}
        subnav={(activeTab) => {
          if (activeTab === "summary") {
            return (
              <div className="flex w-full flex-wrap items-center justify-between gap-x-4 gap-y-2">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-foreground">Summary</p>
                  <p className="text-xs text-muted-foreground">
                    Quote total, line mix, and activity for this estimate.
                  </p>
                </div>
                {signed ? null : (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 shrink-0 gap-1.5 border-border-soft"
                    onClick={() => setSettingsOpen(true)}
                  >
                    <Pencil className="size-3.5" />
                    Edit
                  </Button>
                )}
              </div>
            );
          }
          if (activeTab === "visit") {
            return (
              <div className="flex w-full flex-wrap items-center justify-between gap-x-4 gap-y-2">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-foreground">Site visit</p>
                  <p className="text-xs text-muted-foreground">
                    Findings, private notes, and photos for this estimate.
                  </p>
                </div>
              </div>
            );
          }
          if (activeTab === "materials") {
            return (
              <div className="flex w-full flex-wrap items-center justify-between gap-x-4 gap-y-2">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-foreground">
                    Labour & Material
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {costingHint("estimate", Boolean(signed))}
                  </p>
                </div>
                <LineItemsActions
                  locked={materialsActions?.locked ?? signed}
                  saving={materialsActions?.saving}
                  onAddLabor={() => materialsActions?.addLabor()}
                  onAddMaterial={() => materialsActions?.addMaterial()}
                  className="shrink-0"
                />
              </div>
            );
          }
          if (activeTab === "notes") {
            return (
              <div className="flex w-full flex-wrap items-center justify-between gap-x-4 gap-y-2">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-foreground">Notes</p>
                  <p className="text-xs text-muted-foreground">
                    Desk notes stay with this estimate.
                  </p>
                </div>
                {signed ? null : (
                  <Button
                    size="sm"
                    className="h-8 shrink-0"
                    onClick={() => setNoteOpen(true)}
                  >
                    + Add note
                  </Button>
                )}
              </div>
            );
          }
          if (activeTab === "attachments") {
            return (
              <div className="flex w-full flex-wrap items-center justify-between gap-x-4 gap-y-2">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-foreground">Attachments</p>
                  <p className="text-xs text-muted-foreground">
                    Photos, PDFs, and other quote files.
                  </p>
                </div>
                {signed ? null : (
                  <Button
                    size="sm"
                    className="h-8 shrink-0"
                    disabled={
                      !attachmentsActions ||
                      attachmentsActions.saving ||
                      attachmentsActions.uploading ||
                      !attachmentsActions.dirty
                    }
                    onClick={() => attachmentsActions?.save()}
                  >
                    {attachmentsActions?.saving ? (
                      <>
                        <Loader2 className="size-3.5 animate-spin" />
                        Saving…
                      </>
                    ) : (
                      "Save attachments"
                    )}
                  </Button>
                )}
              </div>
            );
          }
          return null;
        }}
        badge={
          <>
            <StatusPill
              label={estimateStatusLabel(estimate.status)}
              className={estimateStatusTone(estimate.status)}
            />
            {job || estimate.status === "converted_to_job" ? (
              <StatusPill
                label={
                  job?.number
                    ? `Converted to job · ${job.number}`
                    : "Converted to job"
                }
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
              <>
                {!(
                  job.invoiceId ||
                  job.status === "invoiced" ||
                  job.status === "paid"
                ) ? (
                  <Button
                    size="sm"
                    className="h-8"
                    data-action="convert-to-invoice"
                    disabled={converting}
                    onClick={() => void convertToInvoice()}
                  >
                    {converting ? "Converting…" : "Convert to invoice"}
                  </Button>
                ) : null}
                <Button size="sm" className="h-8" asChild>
                  <Link href={`/pro/dashboard/jobs/${job.id}`}>
                    Open {job.number}
                  </Link>
                </Button>
              </>
            ) : signed ? (
              <>
                <Button
                  size="sm"
                  className="h-8"
                  data-action="convert-to-job"
                  disabled={converting}
                  onClick={convertToJob}
                >
                  {converting ? "Converting…" : "Convert to job"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8"
                  data-action="convert-to-invoice"
                  disabled={converting || !canConvert}
                  onClick={() => void convertToInvoice()}
                >
                  {converting ? "Converting…" : "Convert to invoice"}
                </Button>
              </>
            ) : (
              <>
                {canShare ? (
                  <Button size="sm" className="h-8" variant="default" onClick={openApproval}>
                    <Share2 className="size-3.5" />
                    Send to customer
                  </Button>
                ) : canFinalize ? (
                  <Button
                    size="sm"
                    className="h-8"
                    disabled={finalizing}
                    onClick={() => void finalizeEstimate()}
                  >
                    {finalizing ? "Finalizing…" : "Finalize & send"}
                  </Button>
                ) : estimate.status === "site_visit" ? (
                  <Button size="sm" variant="outline" className="h-8" asChild>
                    <Link href={`/pro/dashboard/new-estimate/${estimate.id}?tab=visit`}>
                      Complete site visit
                    </Link>
                  </Button>
                ) : null}
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8"
                  onClick={() => setChangeAssignOpen(true)}
                >
                  {hasVisitAssignment ? "New assignment" : "Assign team member"}
                </Button>
              </>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-8">
                  More actions
                  <ChevronDown className="size-3.5" aria-hidden="true" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-44">
                {!job ? (
                  <>
                    <DropdownMenuItem onSelect={() => setChangeAssignOpen(true)}>
                      {hasVisitAssignment
                        ? "Change site visit assignment"
                        : "Assign site visit"}
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => setTaskOpen(true)}>
                      Create task
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => setNoteOpen(true)}>
                      Add note
                    </DropdownMenuItem>
                  </>
                ) : null}
                <DropdownMenuItem onSelect={() => setReminderOpen(true)}>
                  Set reminder
                </DropdownMenuItem>
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
                    customerLabel={customerLabel}
                    siteAddress={siteAddress}
                    quoteTotal={quoteTotal}
                    onActivitiesChange={(next) => {
                      setFetched((prev) =>
                        prev ? { ...prev, activities: next } : prev,
                      );
                      dispatch(
                        patchEstimateLocally({
                          id: estimate.id,
                          patch: { activities: next },
                        }),
                      );
                    }}
                    notice={
                      signed ||
                      estimate.status === "accepted" ||
                      canConvert ||
                      job ? (
                        <>
                          {signed ||
                          estimate.status === "accepted" ||
                          canConvert ||
                          job ? (
                            <EstimateStageBanner
                              status={estimate.status}
                              signed={signed}
                              hasJob={Boolean(job)}
                              signature={customerSignature}
                              job={job ? { id: job.id, number: job.number } : null}
                            />
                          ) : null}
                          {!job && canConvert ? (
                            <div className="rounded-lg border border-input bg-[#f4f7fb] px-4 py-3">
                              <p className="text-sm font-semibold text-[#003F7D]">
                                Convert to job
                              </p>
                              <p className="mt-1 text-sm text-muted-foreground">
                                Create a job with this customer, address, line
                                items, notes, and site photos. The job will keep
                                a reference back to {estimate.number}.
                              </p>
                              <div className="mt-3 flex justify-end">
                                <Button
                                  size="sm"
                                  className="h-8"
                                  disabled={converting}
                                  onClick={convertToJob}
                                >
                                  {converting ? "Converting…" : "Convert to job"}
                                </Button>
                              </div>
                            </div>
                          ) : null}
                        </>
                      ) : undefined
                    }
                  />
                );
              case "visit":
                return (
                  <EstimateSiteVisitTab
                    estimate={estimate}
                    locked={signed || visitLocked}
                    onScheduleAnother={() => setScheduleAnotherOpen(true)}
                    onAddVisitDetails={() => {
                      const list = resolveSiteVisitList(estimate, siteVisit);
                      if (!list.length) return;
                      const pendingIdx = list.findIndex(
                        (entry) => entry.detailsPending === true,
                      );
                      setEditingVisitIndex(
                        pendingIdx >= 0 ? pendingIdx : list.length - 1,
                      );
                      setVisitDetailsMode("add");
                      setVisitDetailsOpen(true);
                    }}
                    onEditVisit={(index) => {
                      setEditingVisitIndex(index);
                      setVisitDetailsMode("edit");
                      setVisitDetailsOpen(true);
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
                    preferApi={apiReady}
                    ready={!apiReady || Boolean(fetched)}
                    hideHeader
                    onActionsChange={onMaterialsActionsChange}
                    onSave={async (lines) => {
                      const filled = filledWorkLines(lines).map((line) => {
                        if (line.kind !== "materials") return line;
                        if (line.images?.length) return line;
                        const prev =
                          quote.items.find((item) => item.id === line.id) ||
                          quote.items.find(
                            (item) =>
                              item.type !== "labor" &&
                              (item.description || "").trim() ===
                                (line.description || "").trim(),
                          );
                        if (!prev?.images?.length) return line;
                        return { ...line, images: [...prev.images] };
                      });
                      const items = linesToEstimateItems(
                        quote.id,
                        filled,
                        await (
                          await import("@/lib/tax/state-tax")
                        ).fetchTaxRatePercent(quote.propertyAddress?.state),
                      );
                      writeCostLines(session?.email, quote.id, filled);
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
                            setFetched({ ...quote, items });
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
                    showAddInToolbar={false}
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
                    hideHeader
                    onActionsChange={onAttachmentsActionsChange}
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
                    onActivitiesChange={(next) => {
                      setFetched((prev) =>
                        prev ? { ...prev, activities: next } : prev,
                      );
                      dispatch(
                        patchEstimateLocally({
                          id: estimate.id,
                          patch: { activities: next },
                        }),
                      );
                    }}
                  />
                );
            }
          })();
          return body;
        }}
      </RecordWorkspace>
      <EstimateSettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        estimate={estimate}
        job={job}
        service={service}
        locked={signed}
        onSave={(updated) => {
          setFetched(updated);
        }}
      />
      <ChangeVisitAssignmentDialog
        open={changeAssignOpen}
        onOpenChange={setChangeAssignOpen}
        currentEmployeeId={assignedTechId}
        currentLabel={
          siteVisit?.technician ||
          estimate.siteVisit?.technician ||
          ""
        }
        onSubmit={async ({ employeeId, technician }) => {
          const existingVisits = resolveSiteVisitList(estimate, siteVisit);
          const targetIndex = Math.max(existingVisits.length - 1, 0);
          const nextSiteVisits =
            existingVisits.length > 0
              ? existingVisits.map((entry, index) =>
                  index === targetIndex
                    ? {
                        ...entry,
                        employeeId: employeeId || "",
                        technician: technician || "",
                      }
                    : entry,
                )
              : [
                  {
                    employeeId: employeeId || "",
                    technician: technician || "",
                    visitedAt: visitDate || new Date().toISOString(),
                    accessNotes: "",
                    findings: "",
                    recommendations: "",
                    measurements: "",
                    photos: [],
                    label: "Site Visit #1",
                    detailsPending: false,
                  },
                ];
          const primaryRecord = nextSiteVisits[0];
          const primaryLocal = siteVisitFromRecord(primaryRecord);
          if (primaryLocal) {
            writeSiteVisit(session?.email, estimate.id, {
              ...primaryLocal,
              // Only touch assignee on the latest visit locally when it is Visit #1.
              ...(nextSiteVisits.length === 1
                ? {
                    employeeId: employeeId || "",
                    technician: technician || "",
                  }
                : {}),
            });
          }

          if (visitDate) {
            await syncCalendarAssignment({
              kind: "estimate",
              recordId: estimate.id,
              title: estimateAssignmentEvent.title,
              date: visitDate,
              employeeId: employeeId || null,
              startMinutes: estimateAssignmentEvent.startMinutes,
              endMinutes: estimateAssignmentEvent.endMinutes,
              timeWindow: estimateAssignmentEvent.timeWindow,
              linkOnly: true,
            });
          }

          if (apiReady) {
            try {
              const updated = await updateEstimateSiteVisit(
                estimate.id,
                primaryRecord,
                undefined,
                nextSiteVisits,
              );
              const mergedVisits = preferFullVisitHistory(
                nextSiteVisits,
                updated?.siteVisits,
              );
              const patch = {
                ...(updated || {}),
                siteVisit: primaryRecord,
                siteVisits: mergedVisits,
              };
              crm.patchEstimate(estimate.id, patch);
              setFetched((prev) =>
                prev ? { ...prev, ...patch } : prev,
              );

              const activity = await createEstimateActivity(estimate.id, {
                title: "Site visit assignment updated",
                description:
                  '<p><span style="display:inline-block;padding:2px 8px;border-radius:999px;background:#e8eef5;color:#003F7D;font-weight:600;font-size:12px;">Assignment changed</span></p><p><strong>Technician:</strong> ' +
                  (technician || "Unassigned") +
                  "</p>",
              });
              if (activity) {
                const nextActivities = [
                  activity,
                  ...(updated?.activities || estimate.activities || []),
                ];
                crm.patchEstimate(estimate.id, {
                  activities: nextActivities,
                });
                setFetched((prev) =>
                  prev ? { ...prev, activities: nextActivities } : prev,
                );
              }
            } catch {
              const patch = {
                siteVisit: primaryRecord,
                siteVisits: nextSiteVisits,
              };
              crm.patchEstimate(estimate.id, patch);
              setFetched((prev) =>
                prev ? { ...prev, ...patch } : prev,
              );
            }
          } else {
            const patch = {
              siteVisit: primaryRecord,
              siteVisits: nextSiteVisits,
            };
            crm.patchEstimate(estimate.id, patch);
            setFetched((prev) =>
              prev ? { ...prev, ...patch } : prev,
            );
          }

          toast.success(
            technician
              ? `Assignment updated to ${technician}.`
              : "Site visit assignment cleared.",
          );
        }}
      />
      <ScheduleAnotherSiteVisitDialog
        open={scheduleAnotherOpen}
        onOpenChange={setScheduleAnotherOpen}
        visitNumber={resolveSiteVisitList(estimate, siteVisit).length + 1}
        onSubmit={async (result) => {
          const existingVisits = resolveSiteVisitList(estimate, siteVisit).map(
            (entry, index) => ({
              ...entry,
              detailsPending: false,
              label: entry.label || `Site Visit #${index + 1}`,
            }),
          );
          const visitNumber = existingVisits.length + 1;
          const visitLabel = `Site Visit #${visitNumber}`;
          const newVisitEntry: EstimateSiteVisitRecord = {
            ...result.visit,
            label: visitLabel,
            detailsPending: true,
          };
          const nextSiteVisits = [...existingVisits, newVisitEntry];
          // Keep primary siteVisit as Visit #1 so earlier data is never replaced.
          const primaryRecord =
            existingVisits[0] ||
            estimate.siteVisit ||
            siteVisitToRecord(
              siteVisit || {
                employeeId: "",
                technician: "",
                visitedAt: estimate.issuedAt,
                accessNotes: "",
                findings: "",
                recommendations: "",
                measurements: "",
                photos: [],
              },
            );

          await syncCalendarAssignment({
            kind: "estimate",
            recordId: estimate.id,
            title: `${estimate.number || "Estimate"} ${visitLabel}`,
            date: result.date,
            employeeId: result.employeeId || null,
            startMinutes: result.startMinutes,
            endMinutes: result.endMinutes,
            linkOnly: true,
            forceNew: true,
          });

          if (apiReady) {
            try {
              const updated = await updateEstimateSiteVisit(
                estimate.id,
                primaryRecord,
                undefined,
                nextSiteVisits,
              );
              const mergedVisits = preferFullVisitHistory(
                nextSiteVisits,
                updated?.siteVisits,
              ).map((entry, index, list) =>
                index === list.length - 1
                  ? { ...entry, detailsPending: true, label: visitLabel }
                  : { ...entry, detailsPending: false },
              );
              const patch = {
                ...(updated || {}),
                siteVisit: primaryRecord,
                siteVisits: mergedVisits,
              };
              crm.patchEstimate(estimate.id, patch);
              setFetched((prev) =>
                prev ? { ...prev, ...patch } : ({ ...estimate, ...patch } as Estimate),
              );

              const activity = await createEstimateActivity(estimate.id, {
                title: "Site visit scheduled",
                description: siteVisitScheduledActivityDescription({
                  date: result.date,
                  startMinutes: result.startMinutes,
                  endMinutes: result.endMinutes,
                  technician: result.technician,
                  visitLabel,
                }),
              });
              if (activity) {
                const nextActivities = [
                  activity,
                  ...(updated?.activities || estimate.activities || []),
                ];
                crm.patchEstimate(estimate.id, { activities: nextActivities });
                setFetched((prev) =>
                  prev ? { ...prev, activities: nextActivities } : prev,
                );
              }
            } catch {
              const patch = {
                siteVisit: primaryRecord,
                siteVisits: nextSiteVisits,
              };
              crm.patchEstimate(estimate.id, patch);
              setFetched((prev) =>
                prev ? { ...prev, ...patch } : prev,
              );
            }
          } else {
            const patch = {
              siteVisit: primaryRecord,
              siteVisits: nextSiteVisits,
            };
            crm.patchEstimate(estimate.id, patch);
            setFetched((prev) => (prev ? { ...prev, ...patch } : prev));
          }

          toast.success(`${visitLabel} scheduled. Add visit details when ready.`);
        }}
      />
      <SiteVisitDetailsDialog
        open={visitDetailsOpen}
        onOpenChange={(open) => {
          setVisitDetailsOpen(open);
          if (!open) setEditingVisitIndex(null);
        }}
        mode={visitDetailsMode}
        visitNumber={(editingVisitIndex ?? 0) + 1}
        visit={(() => {
          const list = resolveSiteVisitList(estimate, siteVisit);
          if (editingVisitIndex == null) return null;
          return list[editingVisitIndex] || null;
        })()}
        onSubmit={async (result) => {
          if (editingVisitIndex == null) return;
          const existingVisits = resolveSiteVisitList(estimate, siteVisit);
          let nextSiteVisits: EstimateSiteVisitRecord[];

          if (visitDetailsMode === "add") {
            const pendingIdx = existingVisits.findIndex(
              (entry) => entry.detailsPending === true,
            );
            if (pendingIdx >= 0) {
              // Fill the scheduled pending visit only — leave earlier visits untouched.
              nextSiteVisits = existingVisits.map((entry, index) =>
                index === pendingIdx
                  ? {
                      ...entry,
                      ...result.visit,
                      id: entry.id || result.visit.id,
                      label:
                        entry.label ||
                        result.visit.label ||
                        `Site Visit #${index + 1}`,
                      employeeId: entry.employeeId || result.visit.employeeId,
                      technician:
                        entry.technician || result.visit.technician,
                      detailsPending: false,
                    }
                  : entry,
              );
            } else if (
              editingVisitIndex >= 0 &&
              editingVisitIndex < existingVisits.length &&
              existingVisits[editingVisitIndex]?.detailsPending
            ) {
              nextSiteVisits = existingVisits.map((entry, index) =>
                index === editingVisitIndex
                  ? { ...entry, ...result.visit, detailsPending: false }
                  : entry,
              );
            } else {
              // Never overwrite a completed visit — append a new one.
              nextSiteVisits = [
                ...existingVisits.map((entry) => ({
                  ...entry,
                  detailsPending: false,
                })),
                {
                  ...result.visit,
                  label:
                    result.visit.label ||
                    `Site Visit #${existingVisits.length + 1}`,
                  detailsPending: false,
                },
              ];
            }
          } else {
            nextSiteVisits = existingVisits.map((entry, index) =>
              index === editingVisitIndex
                ? {
                    ...entry,
                    ...result.visit,
                    id: entry.id || result.visit.id,
                    label:
                      entry.label ||
                      result.visit.label ||
                      `Site Visit #${index + 1}`,
                    detailsPending: false,
                  }
                : entry,
            );
          }

          // Keep Visit #1 as the primary siteVisit record for backward compatibility.
          const primaryRecord = nextSiteVisits[0] || result.visit;
          const primaryLocal = siteVisitFromRecord(primaryRecord);
          if (primaryLocal) {
            writeSiteVisit(session?.email, estimate.id, primaryLocal);
          }

          await syncCalendarAssignment({
            kind: "estimate",
            recordId: estimate.id,
            title: `${estimate.number || "Estimate"} ${result.visit.label || `Site Visit #${editingVisitIndex + 1}`}`,
            date: result.date,
            employeeId: result.visit.employeeId || null,
            startMinutes: result.startMinutes,
            endMinutes: result.endMinutes,
            linkOnly: true,
            forceNew: visitDetailsMode === "add",
          });

          const nextStatus =
            estimate.status === "draft" || estimate.status === "site_visit"
              ? "inspected"
              : estimate.status;

          if (apiReady) {
            try {
              const updated = await updateEstimateSiteVisit(
                estimate.id,
                primaryRecord,
                nextStatus !== estimate.status ? nextStatus : undefined,
                nextSiteVisits,
              );
              const mergedVisits = preferFullVisitHistory(
                nextSiteVisits,
                updated?.siteVisits,
              );
              const patch = {
                status: nextStatus,
                siteVisit: primaryRecord,
                siteVisits: mergedVisits,
              };
              crm.patchEstimate(estimate.id, {
                ...(updated || {}),
                ...patch,
              });
              setFetched((prev) =>
                prev
                  ? { ...prev, ...(updated || {}), ...patch }
                  : prev,
              );

              const activity = await createEstimateActivity(estimate.id, {
                title: visitDetailsMode === "add"
                  ? "Site visit details added"
                  : "Site visit details updated",
                description:
                  `<p><strong>${result.visit.label || `Site Visit #${editingVisitIndex + 1}`}</strong></p><p>${visitDetailsMode === "add" ? "Details uploaded" : "Details edited"}</p>`,
              });
              if (activity) {
                const nextActivities = [
                  activity,
                  ...(updated?.activities || estimate.activities || []),
                ];
                crm.patchEstimate(estimate.id, { activities: nextActivities });
                setFetched((prev) =>
                  prev ? { ...prev, activities: nextActivities } : prev,
                );
              }
            } catch {
              const patch = {
                status: nextStatus,
                siteVisit: primaryRecord,
                siteVisits: nextSiteVisits,
              };
              crm.patchEstimate(estimate.id, patch);
              setFetched((prev) => (prev ? { ...prev, ...patch } : prev));
            }
          } else {
            const patch = {
              status: nextStatus,
              siteVisit: primaryRecord,
              siteVisits: nextSiteVisits,
            };
            crm.patchEstimate(estimate.id, patch);
            setFetched((prev) => (prev ? { ...prev, ...patch } : prev));
          }

          toast.success("Visit details saved.");
          setEditingVisitIndex(null);
        }}
      />
      <SendApprovalDialog
        open={approvalOpen}
        onOpenChange={setApprovalOpen}
        estimate={estimate}
        customer={customer}
        customerLabel={customerLabel}
        onSent={({ viaApi, status, token }) => {
          const nextStatus = (status as Estimate["status"]) || "sent";
          setStatusOverride(nextStatus);
          if (token) {
            crm.patchEstimate(estimate.id, {
              status: nextStatus,
              shareToken: token,
            });
            setFetched((prev) =>
              prev
                ? { ...prev, status: nextStatus, shareToken: token }
                : prev,
            );
          }
          if (!viaApi) records.setStatus("estimate", estimate.id, nextStatus);
          if (typeof window !== "undefined") {
            window.dispatchEvent(
              new CustomEvent("rs-realtime", {
                detail: { type: "INBOX_SUMMARY_INVALIDATE" },
              }),
            );
          }
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
  const dispatch = useAppDispatch();
  const crm = useCrmApiData();
  const { session, jobs, estimates, invoices, payments, requests, provider } =
    usePortalWorkspace();
  const { customers } = useCrmDirectory();
  const { events, employees, assign, employeeLabel } = usePortalCrew();
  const records = usePortalRecords();
  const settings = useJobSettings(id);
  const [assignOpen, setAssignOpen] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("schedule") !== "1") return;
    setAssignOpen(true);
    params.delete("schedule");
    const next = params.toString();
    window.history.replaceState(
      null,
      "",
      next ? `${window.location.pathname}?${next}` : window.location.pathname,
    );
  }, [id]);
  const [deleting, setDeleting] = useState(false);
  const [converting, setConverting] = useState(false);
  const [removingAssignee, setRemovingAssignee] = useState(false);
  const [assigneeOverride, setAssigneeOverride] = useState<{
    employeeId: string;
    name: string;
  } | null>(null);
  const [archiving, setArchiving] = useState(false);
  const [reminderOpen, setReminderOpen] = useState(false);
  const [taskOpen, setTaskOpen] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [resolvedInvoice, setResolvedInvoice] = useState<Invoice | null>(null);
  const [materialsActions, setMaterialsActions] =
    useState<JobCostingActions | null>(null);
  const onMaterialsActionsChange = useCallback(
    (next: JobCostingActions | null) => {
      setMaterialsActions((prev) => {
        if (!prev && !next) return prev;
        if (!next) return null;
        if (
          prev &&
          prev.locked === next.locked &&
          prev.saving === next.saving &&
          prev.addLabor === next.addLabor &&
          prev.addMaterial === next.addMaterial
        ) {
          return prev;
        }
        return next;
      });
    },
    [],
  );
  const [attachmentsActions, setAttachmentsActions] = useState<{
    locked: boolean;
    saving: boolean;
    uploading: boolean;
    dirty: boolean;
    save: () => void;
  } | null>(null);
  const onAttachmentsActionsChange = useCallback(
    (
      next: {
        locked: boolean;
        saving: boolean;
        uploading: boolean;
        dirty: boolean;
        save: () => void;
      } | null,
    ) => {
      setAttachmentsActions((prev) => {
        if (!prev && !next) return prev;
        if (!next) return null;
        if (
          prev &&
          prev.locked === next.locked &&
          prev.saving === next.saving &&
          prev.uploading === next.uploading &&
          prev.dirty === next.dirty &&
          prev.save === next.save
        ) {
          return prev;
        }
        return next;
      });
    },
    [],
  );
  const [settingsActions, setSettingsActions] = useState<{
    saving: boolean;
    save: () => void;
  } | null>(null);
  const onSettingsActionsChange = useCallback(
    (next: { saving: boolean; save: () => void } | null) => {
      setSettingsActions((prev) => {
        if (!prev && !next) return prev;
        if (!next) return null;
        if (
          prev &&
          prev.saving === next.saving &&
          prev.save === next.save
        ) {
          return prev;
        }
        return next;
      });
    },
    [],
  );

  // ── Redux cache ──────────────────────────────────────────────────────────
  const cachedJob = useAppSelector((s) => s.jobs.detailsCache[id]);
  const detailLoading = useAppSelector((s) => s.jobs.detailLoading);
  const detailError = useAppSelector((s) => s.jobs.detailError);

  const allJobs = records.mergeJobs(jobs);
  const allEstimates = records.mergeEstimates(estimates);
  const allInvoices = records.mergeInvoices(invoices);
  // Fall back to workspace snapshot while Redux is still loading
  const listed = allJobs.find((item) => item.id === id);
  const seeded = cachedJob ?? listed ?? null;
  const apiReady = crm.enabled && crm.ready;

  const job = seeded
    ? apiReady
      ? { ...seeded }
      : applyJobSettings(
          { ...seeded, status: records.statusOf("job", seeded.id, seeded.status) },
          settings,
        )
    : undefined;
  const estimate = allEstimates.find((item) => item.id === job?.estimateId);
  const linkedInvoiceId = records.linkedId("job", id);
  // Prefer live CRM ObjectIds over any stale local `inv_*` link from offline mode.
  const workspaceInvoice =
    allInvoices.find((item) => item.id === job?.invoiceId) ??
    allInvoices.find(
      (item) => item.jobId === id && item.invoiceType !== "change_order",
    ) ??
    (linkedInvoiceId
      ? allInvoices.find((item) => item.id === linkedInvoiceId)
      : undefined);
  const invoice = workspaceInvoice ?? resolvedInvoice ?? undefined;
  const event = events.find(
    (item) => item.kind === "job" && item.recordId === id,
  );
  const start = apiReady
    ? job?.scheduledAt || event?.date
    : job?.scheduledAt || settings?.start || event?.date;
  const due = apiReady
    ? job?.dueAt || event?.endDate
    : job?.dueAt || settings?.due || event?.endDate;
  const customer = customers.find((item) => item.id === job?.customerId);
  const customerLabel = customer
    ? crmCustomerName(customer)
    : job
      ? getPortalCustomerName(provider, job.customerId)
      : "Customer";
  const pending = useCrmRecordPending();

  // ── Fetch via Redux (cache-first: only show loading when no cached data) ──
  useEffect(() => {
    setAssigneeOverride(null);
    if (!id) return;
    dispatch(fetchJobDetail(id))
      .unwrap()
      .then((item) => {
        // Also seed the workspace records cache for backward compatibility
        records.cacheJob(item);
      })
      .catch(() => {
        // Error is stored in Redux state (detailError)
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- records.cacheJob is stable; dispatch is stable
  }, [id, dispatch]);

  // Resolve invoice by id when job is invoiced but invoice isn't in workspace list.
  useEffect(() => {
    const invoiceId = resolveCrmObjectId(job?.invoiceId);
    if (!invoiceId || workspaceInvoice) {
      setResolvedInvoice(null);
      return;
    }
    let cancelled = false;
    void getInvoiceWithPayments(invoiceId)
      .then((result) => {
        if (!cancelled && result?.invoice) setResolvedInvoice(result.invoice);
      })
      .catch(() => {
        if (!cancelled) setResolvedInvoice(null);
      });
    return () => {
      cancelled = true;
    };
  }, [job?.invoiceId, workspaceInvoice]);

  if (!job) {
    // Only show spinner if no cached data exists yet
    if (pending || (!cachedJob && detailLoading) || crm.refreshing) {
      return (
        <div className="border border-input bg-card" aria-busy="true">
          <CenteredSpinner className="min-h-[22rem]" />
        </div>
      );
    }
    return (
      <Missing
        title={detailError || "Job not found"}
        href="/pro/dashboard/jobs"
      />
    );
  }

  const currentJob = job;
  // Prefer live override (Change/Remove), then job fields, then calendar event.
  const technician =
    assigneeOverride !== null
      ? assigneeOverride.name
      : currentJob.assignedTo ||
        (currentJob.assignedEmployeeId
          ? employeeLabel(currentJob.assignedEmployeeId)
          : "") ||
        (event ? employeeLabel(event.employeeId) : "") ||
        (!apiReady ? settings?.assignedTo || "" : "");
  const service = apiReady
    ? job.title || jobServiceLabel(job, allEstimates, requests)
    : settings?.name || job.title || jobServiceLabel(job, allEstimates, requests);
  const jobWindow = minutesForWindow("morning");
  const jobStartDate = (start || todayISO()).slice(0, 10);
  const jobEndDate = (due || start || todayISO()).slice(0, 10);
  const resolvedEmployeeId =
    (assigneeOverride !== null
      ? assigneeOverride.employeeId
      : job.assignedEmployeeId) ||
    event?.employeeId ||
    (!apiReady ? settings?.employeeId : undefined) ||
    employees.find(
      (item) =>
        employeeLabel(item.id).trim().toLowerCase() ===
        String(job.assignedTo || "").trim().toLowerCase(),
    )?.id;
  const jobAssignmentEvent: PortalCalendarEvent = {
    ...(event ?? {
      id: `cal_${job.id}`,
      kind: "job",
      recordId: job.id,
      title: job.number,
      detail: service,
      customerName: customerLabel,
      timeWindow: "morning",
      startMinutes: jobWindow.startMinutes,
      endMinutes: jobWindow.endMinutes,
      employeeId: resolvedEmployeeId || employees.find((item) => item.active)?.id,
      href: `/pro/dashboard/jobs/${job.id}`,
      status: job.status,
    }),
    date: jobStartDate,
    endDate: jobEndDate,
    employeeId:
      resolvedEmployeeId ||
      event?.employeeId ||
      employees.find((item) => item.active)?.id,
    status: job.status,
  };

  async function removeJobAssignee() {
    if (!job || removingAssignee) return;
    setRemovingAssignee(true);
    // Optimistic UI — show Unassigned immediately.
    setAssigneeOverride({ employeeId: "", name: "" });
    dispatch(
      patchJobLocally({
        id: job.id,
        patch: { assignedTo: "", assignedEmployeeId: "" },
      }),
    );
    try {
      await dispatch(
        updateJobRecord({
          id: job.id,
          employees,
          job: {
            ...job,
            assignedTo: "",
            assignedEmployeeId: "",
          },
        }),
      ).unwrap();
      // Keep the calendar date; only clear the person on the schedule row.
      if (start) {
        await syncCalendarAssignment({
          kind: "job",
          recordId: job.id,
          title: job.number || "Job",
          date: start,
          endDate: due || start,
          employeeId: null,
          startMinutes: event?.startMinutes,
          endMinutes: event?.endMinutes,
          timeWindow: event?.timeWindow,
          status: "scheduled",
        });
      } else {
        await clearCalendarAssignment({ kind: "job", recordId: job.id });
      }
      if (crm.ready) void crm.refresh({ silent: true });
      toast.success("Team member removed from this job.");
    } catch (error) {
      // Roll back optimistic clear.
      setAssigneeOverride(null);
      void dispatch(fetchJobDetail(job.id));
      toast.error(
        typeof error === "string"
          ? error
          : error instanceof Error
            ? error.message
            : "Could not remove the assignee.",
      );
    } finally {
      setRemovingAssignee(false);
    }
  }

  async function convertToInvoice() {
    if (converting) return;
    const mongoExisting =
      resolveCrmObjectId(currentJob.invoiceId) ||
      resolveCrmObjectId(invoice?.id);
    if (mongoExisting) {
      router.push(`/pro/dashboard/invoices/${mongoExisting}`);
      return;
    }
    if (
      currentJob.status === "invoiced" ||
      currentJob.status === "paid"
    ) {
      // Prefer live CRM invoice linked on the job over stale local inv_* ids.
      if (crm.enabled && currentJob.invoiceId) {
        const liveId =
          resolveCrmObjectId(currentJob.invoiceId) || currentJob.invoiceId;
        if (resolveCrmObjectId(currentJob.invoiceId)) {
          router.push(`/pro/dashboard/invoices/${liveId}`);
          return;
        }
        const linked = allInvoices.find((item) => item.jobId === currentJob.id);
        if (linked?.id) {
          router.push(`/pro/dashboard/invoices/${linked.id}`);
          return;
        }
        try {
          const list = await queryInvoices({
            jobId: currentJob.id,
            limit: 5,
            silent: true,
          });
          if (list.items[0]?.id) {
            router.push(`/pro/dashboard/invoices/${list.items[0].id}`);
            return;
          }
        } catch {
          // Fall through to error toast.
        }
      }
      toast.error("This job is already invoiced but the invoice could not be loaded.");
      return;
    }
    setConverting(true);
    try {
      // Prefer API whenever this job is a live CRM record (ObjectId) or CRM is on.
      const jobIsLive = Boolean(resolveCrmObjectId(currentJob.id));
      if (crm.enabled || jobIsLive) {
        const { invoice: created } = await dispatch(
          convertJobToInvoiceRecord(currentJob.id),
        ).unwrap();
        const dest = resolveCrmObjectId(created.id) || created.id;
        toast.success(
          `${created.number || "Invoice"} drafted from ${currentJob.number}.`,
        );
        if (!resolveCrmObjectId(dest)) {
          toast.error("Invoice created — open it from the Invoices list.");
          router.push("/pro/dashboard/invoices");
          return;
        }
        router.push(`/pro/dashboard/invoices/${dest}`);
        return;
      }
      const lines = readCostLines(session?.email, currentJob);
      const draft = buildInvoice({
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
      const saved = await Promise.resolve(records.addInvoice(draft));
      const created = saved ?? draft;
      records.linkRecords("job", currentJob.id, created.id);
      records.setStatus("job", currentJob.id, "invoiced");
      toast.success(`${created.number} drafted from ${currentJob.number}.`);
      const dest = resolveCrmObjectId(created.id) || created.id;
      router.push(`/pro/dashboard/invoices/${dest}`);
    } catch (error) {
      toast.error(
        typeof error === "string"
          ? error
          : error instanceof Error
            ? error.message
            : "Could not convert this job.",
      );
    } finally {
      setConverting(false);
    }
  }

  async function toggleJobArchive() {
    if (archiving) return;
    const archived =
      Boolean(currentJob.isArchived) || records.isArchived("job", currentJob.id);
    setArchiving(true);
    try {
      if (apiReady) {
        await dispatch(
          patchJobArchive({ id: currentJob.id, isArchived: !archived }),
        ).unwrap();
      } else if (archived) {
        await records.unarchive("job", currentJob.id);
      } else {
        await records.archive("job", currentJob.id);
      }
      toast.success(
        archived
          ? `${currentJob.number} restored.`
          : `${currentJob.number} archived.`,
      );
    } catch (error) {
      toast.error(
        typeof error === "string"
          ? error
          : error instanceof Error
            ? error.message
            : "Could not update archive.",
      );
    } finally {
      setArchiving(false);
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
        await dispatch(deleteJobRecord(currentJob.id)).unwrap();
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
        typeof error === "string"
          ? error
          : error instanceof Error
            ? error.message
            : "Could not delete this job.",
      );
    } finally {
      setDeleting(false);
    }
  }

  const alreadyInvoiced = Boolean(
    invoice ||
      currentJob.invoiceId ||
      currentJob.status === "invoiced" ||
      currentJob.status === "paid",
  );
  const relatedPayments = invoice
    ? records
        .mergePayments(payments)
        .filter((item) => item.invoiceId === invoice.id)
    : [];
  const jobArchived =
    Boolean(currentJob.isArchived) || records.isArchived("job", currentJob.id);

  const jobTabs = [
    { id: "summary", label: "Summary" },
    { id: "materials", label: "Labour & Material" },
    {
      id: "change-orders",
      label: `Change Orders (${currentJob.changeOrders?.length || 0})`,
    },
    ...(alreadyInvoiced
      ? [{ id: "invoice", label: invoice?.number || "Invoice" }]
      : []),
    { id: "time", label: "Time tracking", icon: Clock3 },
    { id: "logs", label: "Logs" },
    { id: "notes", label: "Notes" },
    { id: "attachments", label: "Attachments" },
    { id: "settings", label: "Job settings" },
  ];

  return (
    <>
      <RecordWorkspace
        href={`/pro/dashboard/jobs/${job.id}`}
        label={job.number}
        kind="job"
        tabs={jobTabs}
        subnavTabs={["materials", "notes", "attachments", "settings", "invoice"]}
        subnav={(activeTab) => {
          if (activeTab === "materials") {
            return (
              <div className="flex w-full flex-wrap items-center justify-between gap-x-4 gap-y-2">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-foreground">
                    Labour & Material
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {costingHint("job", materialsActions?.locked ?? false)}
                  </p>
                </div>
                <LineItemsActions
                  locked={materialsActions?.locked}
                  saving={materialsActions?.saving}
                  onAddLabor={() => materialsActions?.addLabor()}
                  onAddMaterial={() => materialsActions?.addMaterial()}
                  className="shrink-0"
                />
              </div>
            );
          }
          if (activeTab === "notes") {
            return (
              <div className="flex w-full flex-wrap items-center justify-between gap-x-4 gap-y-2">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-foreground">Notes</p>
                  <p className="text-xs text-muted-foreground">
                    Desk notes stay with this job.
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
          if (activeTab === "attachments") {
            return (
              <div className="flex w-full flex-wrap items-center justify-between gap-x-4 gap-y-2">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-foreground">Attachments</p>
                  <p className="text-xs text-muted-foreground">
                    Photos, PDFs, and other job files.
                  </p>
                </div>
                <Button
                  size="sm"
                  className="h-8 shrink-0"
                  disabled={
                    !attachmentsActions ||
                    attachmentsActions.saving ||
                    attachmentsActions.uploading ||
                    !attachmentsActions.dirty
                  }
                  onClick={() => attachmentsActions?.save()}
                >
                  {attachmentsActions?.saving ? (
                    <>
                      <Loader2 className="size-3.5 animate-spin" />
                      Saving…
                    </>
                  ) : (
                    "Save attachments"
                  )}
                </Button>
              </div>
            );
          }
          if (activeTab === "settings") {
            return (
              <div className="flex w-full flex-wrap items-center justify-between gap-x-4 gap-y-2">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-foreground">Job settings</p>
                  <p className="text-xs text-muted-foreground">
                    Name, customer, schedule, and site address.
                  </p>
                </div>
                <Button
                  size="sm"
                  className="h-8 shrink-0"
                  disabled={!settingsActions || settingsActions.saving}
                  onClick={() => settingsActions?.save()}
                >
                  {settingsActions?.saving ? (
                    <>
                      <Loader2 className="size-3.5 animate-spin" />
                      Saving…
                    </>
                  ) : (
                    "Save settings"
                  )}
                </Button>
              </div>
            );
          }
          if (activeTab === "invoice" && invoice) {
            return (
              <div className="flex w-full flex-wrap items-center justify-between gap-x-4 gap-y-2">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-foreground">Invoice</p>
                  <p className="text-xs text-muted-foreground">
                    Billing details for {invoice.number}.
                  </p>
                </div>
                <Button size="sm" variant="outline" className="h-8 shrink-0" asChild>
                  <Link href={`/pro/dashboard/invoices/${invoice.id}`}>
                    Open {invoice.number}
                  </Link>
                </Button>
              </div>
            );
          }
          return null;
        }}
        badge={
          <>
            <StatusPill
              label={jobStatusLabel(job.status)}
              className={jobStatusTone(job.status)}
            />
            {jobArchived ? (
              <StatusPill label="Archived" className="bg-slate-100 text-slate-700" />
            ) : (
              <ArchiveBadge kind="job" id={job.id} />
            )}
          </>
        }
        actions={
          <>
            {alreadyInvoiced ? (
              <Button size="sm" variant="outline" className="h-8" asChild>
                <Link
                  href={`/pro/dashboard/invoices/${invoice?.id || currentJob.invoiceId || ""}`}
                >
                  {invoice?.number
                    ? `Open ${invoice.number}`
                    : "Open invoice"}
                </Link>
              </Button>
            ) : (
              <Button
                size="sm"
                className="h-8"
                data-action="convert-to-invoice"
                disabled={converting}
                onClick={() => void convertToInvoice()}
              >
                {converting ? "Converting…" : "Convert to invoice"}
              </Button>
            )}
            <Button size="sm" variant="outline" className="h-8" asChild>
              <Link href={`/pro/dashboard/jobs/${job.id}?tab=change-orders&create=1`}>
                Create change order
              </Link>
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8"
              onClick={() => setAssignOpen(true)}
            >
              {technician ? "New assignment" : "Assign team member"}
            </Button>
            {technician ? (
              <Button
                size="sm"
                variant="ghost"
                className="h-8 text-muted-foreground"
                disabled={removingAssignee}
                onClick={() => void removeJobAssignee()}
              >
                {removingAssignee ? "Removing…" : "Remove assignee"}
              </Button>
            ) : null}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-8">
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
                <DropdownMenuItem
                  disabled={archiving}
                  onSelect={() => {
                    void toggleJobArchive();
                  }}
                >
                  {archiving
                    ? jobArchived
                      ? "Restoring…"
                      : "Archiving…"
                    : jobArchived
                      ? "Restore job"
                      : "Archive job"}
                </DropdownMenuItem>
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
          switch (tab) {
            case "summary":
              return (
                <div className="space-y-4">
                  {estimate ? (
                    <div className="rounded-md bg-secondary px-4 py-3">
                      <p className="text-sm font-semibold text-foreground">
                        Estimate converted to {job.number}
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Created from{" "}
                        <Link
                          href={`/pro/dashboard/new-estimate/${estimate.id}`}
                          className="font-semibold text-primary underline"
                        >
                          {estimate.number}
                        </Link>
                        {estimate.title ? ` · ${estimate.title}` : ""}.
                      </p>
                    </div>
                  ) : job.estimateId ? (
                    <div className="rounded-md bg-secondary px-4 py-3">
                      <p className="text-sm font-semibold text-foreground">
                        Estimate converted to {job.number}
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        This job keeps a reference to its source estimate.
                      </p>
                    </div>
                  ) : null}
                  <div
                    className={
                      technician
                        ? "flex flex-wrap items-center justify-between gap-3 rounded-md border border-sky-200 bg-sky-50/80 px-4 py-3"
                        : "flex flex-wrap items-center justify-between gap-3 rounded-md border border-dashed border-input bg-muted/30 px-4 py-3"
                    }
                  >
                    <div className="min-w-0">
                      <p className="text-[10px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
                        Assigned technician
                      </p>
                      <p className="mt-0.5 text-sm font-semibold text-foreground">
                        {technician || "Unassigned"}
                      </p>
                      {start ? (
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          Scheduled {formatDate(start)}
                          {due && due !== start ? ` → ${formatDate(due)}` : ""}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8"
                        onClick={() => setAssignOpen(true)}
                      >
                        {technician ? "Change" : "Assign"}
                      </Button>
                      {technician ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8"
                          disabled={removingAssignee}
                          onClick={() => void removeJobAssignee()}
                        >
                          Remove
                        </Button>
                      ) : null}
                    </div>
                  </div>
                  <JobSummaryTab
                    job={job}
                    estimate={estimate}
                    invoice={invoice}
                    technician={technician}
                    customerLabel={customerLabel}
                    siteAddress={[
                      job.address?.street,
                      formatLocation(
                        job.address?.city || "",
                        job.address?.state || "",
                        job.address?.zip,
                      ),
                    ]
                      .filter(Boolean)
                      .join(", ")}
                  />
                </div>
              );
            case "materials":
              return (
                <JobMaterialsTab
                  job={job}
                  estimate={estimate}
                  invoice={invoice}
                  technician={technician}
                  preferApi={apiReady}
                  hideHeader
                  onActionsChange={onMaterialsActionsChange}
                  onSave={
                    apiReady
                      ? async (lines) => {
                          const filled = filledWorkLines(lines);
                          const items = linesToJobItems(job.id, filled);
                          try {
                            await dispatch(
                              updateJobRecord({
                                id: job.id,
                                employees,
                                job: { ...job, items },
                              }),
                            ).unwrap();
                            void dispatch(fetchJobDetail(job.id));
                            if (crm.ready) void crm.refresh({ silent: true });
                          } catch (error) {
                            toast.error(
                              error instanceof Error
                                ? error.message
                                : typeof error === "string"
                                  ? error
                                  : "Could not save line items to server.",
                            );
                            throw error;
                          }
                        }
                      : async (lines) => {
                          writeCostLines(session?.email, job.id, lines);
                        }
                  }
                />
              );
            case "change-orders":
              return (
                <JobChangeOrdersPanel
                  job={job}
                  originalAmount={(job.items || []).reduce(
                    (sum, item) => sum + (Number(item.total) || 0),
                    0,
                  )}
                  invoiceId={invoice?.id || job.invoiceId}
                  onJobUpdated={(next) => {
                    dispatch(upsertJobItem(next));
                    records.cacheJob(next);
                  }}
                />
              );
            case "time":
              return (
                <TimeTrackingPanel
                  scopeKey={`job:${job.id}`}
                  jobId={job.id}
                  defaultRange={{ preset: "all" }}
                  showEmployee
                  showByEmployee
                  allowStop
                  hrefFor={(kind, recordId) =>
                    kind === "job" ? `/pro/dashboard/jobs/${recordId}` : `/pro/dashboard/new-estimate/${recordId}`
                  }
                  header={
                    <div>
                      <p className="text-sm font-bold text-foreground">Technician time tracking</p>
                      <p className="text-xs text-muted-foreground">
                        Clock-in / clock-out sessions recorded on {job.number} by assigned technicians.
                      </p>
                    </div>
                  }
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
                  showAddInToolbar={false}
                  empty="Add the first note on this job."
                />
              );
            case "attachments":
              return (
                <JobAttachmentsTab
                  job={job}
                  invoice={invoice}
                  technician={technician}
                  noun="job"
                  hideHeader
                  onActionsChange={onAttachmentsActionsChange}
                />
              );
            case "invoice": {
              // Change orders are billed on their own invoices — listed apart from the job invoice.
              const changeOrderInvoices = (job.changeOrders || [])
                .filter((co) => co.billingInvoiceId)
                .map((co) => ({
                  co,
                  record: allInvoices.find((item) => item.id === co.billingInvoiceId),
                }));
              return (
                <div className="space-y-6">
                  {invoice ? (
                    <InvoiceSummaryTab
                      invoice={invoice}
                      customer={customer}
                      customerLabel={customerLabel}
                      service={service}
                      job={job}
                      estimate={estimate}
                      payments={relatedPayments}
                    />
                  ) : (
                    <p className="px-1 text-sm text-muted-foreground">
                      No invoice is linked to this job yet.
                    </p>
                  )}
                  {changeOrderInvoices.length ? (
                    <section className="overflow-hidden rounded-md border border-border-soft bg-card">
                      <div className="border-b border-border-soft px-4 py-3">
                        <h2 className="text-sm font-semibold">Change order invoices</h2>
                        <p className="text-xs text-muted-foreground">
                          Billed and paid separately — not included in the job total.
                        </p>
                      </div>
                      <ul className="divide-y divide-border-soft">
                        {changeOrderInvoices.map(({ co, record }) => (
                          <li
                            key={co.id}
                            className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                          >
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <Link
                                  href={`/pro/dashboard/invoices/${co.billingInvoiceId}`}
                                  className="font-semibold text-primary hover:underline"
                                >
                                  {record?.number || co.billingInvoiceNumber || "Invoice"}
                                </Link>
                                <StatusPill label="Change order invoice" tone="primary" />
                                {record ? (
                                  <StatusPill
                                    label={invoiceStatusLabel(record.status)}
                                    className={invoiceStatusTone(record.status)}
                                  />
                                ) : null}
                              </div>
                              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                                {co.number} · {co.title || co.description}
                              </p>
                            </div>
                            <div className="text-right text-sm tabular-nums">
                              <p className="font-semibold">
                                {formatMoney(record?.total ?? co.total)}
                              </p>
                              {record ? (
                                <p className="text-xs text-muted-foreground">
                                  Balance {formatMoney(record.balanceDue)}
                                </p>
                              ) : null}
                            </div>
                          </li>
                        ))}
                      </ul>
                    </section>
                  ) : null}
                </div>
              );
            }
            case "settings":
              return (
                <JobSettingsTab
                  job={job}
                  estimate={estimate}
                  invoice={invoice}
                  technician={technician}
                  service={service}
                  customerLabel={customerLabel}
                  start={start}
                  due={due}
                  employeeId={resolvedEmployeeId || event?.employeeId}
                  hideHeader
                  onActionsChange={onSettingsActionsChange}
                />
              );
            default:
              return (
                <JobSummaryTab
                  job={job}
                  estimate={estimate}
                  invoice={invoice}
                  technician={technician}
                  customerLabel={customerLabel}
                  siteAddress={[
                    job.address?.street,
                    formatLocation(
                      job.address?.city || "",
                      job.address?.state || "",
                      job.address?.zip,
                    ),
                  ]
                    .filter(Boolean)
                    .join(", ")}
                />
              );
          }
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
          const lookedUp = assignment.employeeId
            ? employeeLabel(assignment.employeeId)
            : "";
          const techName =
            String(assignment.employeeLabel || "").trim() ||
            lookedUp ||
            "";
          setAssigneeOverride({
            employeeId: assignment.employeeId || "",
            name: techName,
          });
          dispatch(
            patchJobLocally({
              id: job.id,
              patch: {
                assignedTo: techName || "",
                assignedEmployeeId: assignment.employeeId || "",
                scheduledAt: assignment.date || job.scheduledAt,
                dueAt: assignment.endDate || job.dueAt,
              },
            }),
          );
          // Persist assignee on the job document as well (schedule assign may already do this).
          try {
            await dispatch(
              updateJobRecord({
                id: job.id,
                employees,
                job: {
                  ...job,
                  assignedTo: techName || "",
                  assignedEmployeeId: assignment.employeeId || "",
                  scheduledAt: assignment.date || job.scheduledAt,
                  dueAt: assignment.endDate || job.dueAt,
                },
              }),
            ).unwrap();
          } catch {
            // Schedule already saved; local patch keeps UI correct.
          }
          // Re-fetch so assignee name matches server after refresh.
          try {
            const fresh = await dispatch(fetchJobDetail(job.id)).unwrap();
            const freshName =
              String(fresh.assignedTo || "").trim() ||
              (fresh.assignedEmployeeId
                ? employeeLabel(fresh.assignedEmployeeId)
                : "") ||
              techName;
            setAssigneeOverride({
              employeeId: fresh.assignedEmployeeId || assignment.employeeId || "",
              name: freshName,
            });
            records.cacheJob(fresh);
          } catch {
            // keep optimistic override
          }
          if (crm.ready) void crm.refresh({ silent: true });
          toast.success(
            techName
              ? `${techName} assigned to ${job.number}.`
              : `Assignment saved on ${job.number}.`,
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
  const dispatch = useAppDispatch();
  const router = useRouter();
  const auth = useAppSelector(selectAuth);
  const user = useAppSelector(selectAuthUser);
  const useApi =
    auth.hydrated &&
    Boolean(auth.token) &&
    (user?.role === "provider" || auth.role === "provider");
  const invoiceRef = String(id || "").trim();
  const mongoId = resolveCrmObjectId(invoiceRef);
  const detailKey = mongoId ?? invoiceRef;

  const detailInvoice = useAppSelector(
    (state) =>
      state.invoices?.detailsCache?.[detailKey] ??
      state.invoices?.detailsCache?.[invoiceRef] ??
      state.invoices?.detailsCache?.[id],
  );
  const detailPayments = useAppSelector(
    (state) =>
      state.invoices?.detailPayments?.[detailKey] ??
      state.invoices?.detailPayments?.[invoiceRef] ??
      state.invoices?.detailPayments?.[id] ??
      [],
  );
  const detailLoading = useAppSelector((state) =>
    Boolean(state.invoices?.detailLoading),
  );
  const detailError = useAppSelector(
    (state) => state.invoices?.detailError ?? null,
  );

  const { session, invoices, jobs, estimates, requests, payments, provider } =
    usePortalWorkspace();
  const { customers } = useCrmDirectory();
  const records = usePortalRecords();
  const settings = useInvoiceSettings(invoiceRef);
  const seeded = records
    .mergeInvoices(invoices)
    .find((item) => item.id === invoiceRef || item.id === id);
  const workspaceInvoice = seeded
    ? {
        ...applyInvoiceSettings(seeded, settings),
        status: records.statusOf("invoice", seeded.id, seeded.status),
      }
    : undefined;
  const invoice = useApi
    ? detailInvoice
      ? applyInvoiceSettings(detailInvoice, settings)
      : workspaceInvoice
    : workspaceInvoice;
  const allJobs = records.mergeJobs(jobs);
  const allEstimates = records.mergeEstimates(estimates);
  const job = allJobs.find((item) => item.id === invoice?.jobId);
  const estimate = allEstimates.find((item) => item.id === job?.estimateId);
  const relatedPayments = useApi
    ? detailPayments.length
      ? detailPayments
      : records.mergePayments(payments).filter(
          (item) => item.invoiceId === invoiceRef || item.invoiceId === invoice?.id || invoiceRef.replace(/^inv_/, "") === item.invoiceId,
        )
    : records.mergePayments(payments).filter(
        (item) => item.invoiceId === invoiceRef || item.invoiceId === id || id?.replace(/^inv_/, "") === item.invoiceId,
      );
  const customer = customers.find((item) => item.id === invoice?.customerId);
  const customerLabel = (() => {
    if (customer) {
      const name = crmCustomerName(customer).trim();
      if (name && name !== "Customer") return name;
    }
    const fromInvoice = String(invoice?.customerName || "").trim();
    if (fromInvoice && fromInvoice !== "Customer") return fromInvoice;
    const fromEstimate = String(estimate?.customerName || "").trim();
    if (fromEstimate && fromEstimate !== "Customer") return fromEstimate;
    const fromRequest = String(
      requests.find(
        (item) =>
          item.customerId === invoice?.customerId ||
          item.id === estimate?.requestId,
      )?.customerName || "",
    ).trim();
    if (fromRequest && fromRequest !== "Customer") return fromRequest;
    return fromInvoice || fromEstimate || fromRequest || "Customer";
  })();
  const [sending, setSending] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [resolvingStale, setResolvingStale] = useState(false);
  const [reminderOpen, setReminderOpen] = useState(false);
  const [changeOrderOpen, setChangeOrderOpen] = useState(false);
  const [materialsActions, setMaterialsActions] =
    useState<JobCostingActions | null>(null);
  const onMaterialsActionsChange = useCallback(
    (next: JobCostingActions | null) => {
      setMaterialsActions((prev) => {
        if (!prev && !next) return prev;
        if (!next) return null;
        if (
          prev &&
          prev.locked === next.locked &&
          prev.saving === next.saving &&
          prev.addLabor === next.addLabor &&
          prev.addMaterial === next.addMaterial
        ) {
          return prev;
        }
        return next;
      });
    },
    [],
  );
  const [attachmentsActions, setAttachmentsActions] = useState<{
    locked: boolean;
    saving: boolean;
    uploading: boolean;
    dirty: boolean;
    save: () => void;
  } | null>(null);
  const onAttachmentsActionsChange = useCallback(
    (
      next: {
        locked: boolean;
        saving: boolean;
        uploading: boolean;
        dirty: boolean;
        save: () => void;
      } | null,
    ) => {
      setAttachmentsActions((prev) => {
        if (!prev && !next) return prev;
        if (!next) return null;
        if (
          prev &&
          prev.locked === next.locked &&
          prev.saving === next.saving &&
          prev.uploading === next.uploading &&
          prev.dirty === next.dirty &&
          prev.save === next.save
        ) {
          return prev;
        }
        return next;
      });
    },
    [],
  );

  function handlePaymentApplied(result: {
    invoice: Invoice | null;
    payment: Payment | null;
  }) {
    if (!useApi) return;
    if (result.payment) dispatch(upsertPaymentItem(result.payment));
    dispatch(invalidatePaymentsCache());
    void dispatch(fetchPayments({ force: true, silent: true }));
    if (id && id !== "new") {
      void dispatch(fetchInvoiceDetail(id));
    }
  }

  useEffect(() => {
    if (!useApi || !invoiceRef) return;
    let cancelled = false;

    void (async () => {
      const isLocalPortalKey = isLocalInvoicePortalKey(invoiceRef);

      // Do not call GET /invoices/inv_muf… — those offline keys 404 by design.
      if (!isLocalPortalKey) {
        const result = await dispatch(fetchInvoiceDetail(invoiceRef));
        if (cancelled) return;
        if (fetchInvoiceDetail.fulfilled.match(result)) return;
        // Real Mongo id missing — show not-found (no stale-key recovery).
        return;
      }

      setResolvingStale(true);
      try {
        const linkedJob =
          allJobs.find(
            (item) =>
              item.invoiceId === invoiceRef ||
              records.linkedId("job", item.id) === invoiceRef,
          ) ?? null;

        let liveId: string | null = null;
        const jobId = linkedJob?.id;
        if (jobId) {
          const list = await queryInvoices({ jobId, limit: 5, silent: true });
          liveId = list.items[0]?.id ?? null;
        }

        if (!liveId && linkedJob?.invoiceId) {
          liveId = resolveCrmObjectId(linkedJob.invoiceId);
        }

        if (!liveId) {
          const recent = await queryInvoices({ limit: 20, silent: true });
          const mongoLinked = linkedJob
            ? recent.items.find((item) => item.jobId === linkedJob.id)
            : null;
          liveId = mongoLinked?.id ?? null;
        }

        if (!cancelled && liveId && liveId !== invoiceRef) {
          router.replace(`/pro/dashboard/invoices/${liveId}`);
          return;
        }

        if (!cancelled) {
          toast.error(
            "That invoice link is outdated. Open the invoice from your Invoices list.",
          );
          router.replace("/pro/dashboard/invoices");
        }
      } catch {
        if (!cancelled) {
          toast.error(
            "That invoice link is outdated. Open the invoice from your Invoices list.",
          );
          router.replace("/pro/dashboard/invoices");
        }
      } finally {
        if (!cancelled) setResolvingStale(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // allJobs/records intentionally omitted — recover once per invoiceRef
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch, useApi, invoiceRef, router]);

  if (!invoice) {
    // Wait while loading or recovering a stale local inv_* link.
    if (useApi && (detailLoading || resolvingStale)) {
      return (
        <div className="flex min-h-[50vh] items-center justify-center py-12">
          <Loader2 className="size-8 animate-spin text-primary" />
        </div>
      );
    }
    return <Missing title="Invoice not found" href="/pro/dashboard/invoices" />;
  }

  const asJob = invoiceAsJob(invoice, job);
  const service = job
    ? jobServiceLabel(job, allEstimates, requests)
    : invoice.items[0]?.description || "Service";
  const archived =
    Boolean(invoice.isArchived) || records.isArchived("invoice", invoice.id);
  const invoiceId = invoice.id;
  const invoiceNumber = invoice.number;

  async function toggleArchive() {
    if (archiving) return;
    setArchiving(true);
    try {
      if (useApi) {
        await dispatch(
          patchInvoiceArchive({ id: invoiceId, isArchived: !archived }),
        ).unwrap();
      } else if (archived) {
        await records.unarchive("invoice", invoiceId);
      } else {
        await records.archive("invoice", invoiceId);
      }
      toast.success(
        archived ? `${invoiceNumber} restored.` : `${invoiceNumber} archived.`,
      );
    } catch (error) {
      toast.error(
        typeof error === "string"
          ? error
          : error instanceof Error
            ? error.message
            : archived
              ? "Could not restore this invoice."
              : "Could not archive this invoice.",
      );
    } finally {
      setArchiving(false);
    }
  }

  return (
    <>
    <RecordWorkspace
      href={`/pro/dashboard/invoices/${invoice.id}`}
      label={invoice.number}
      kind="invoice"
      tabs={[
        { id: "summary", label: "Summary" },
        { id: "materials", label: "Labour & Material" },
        { id: "payments", label: "Payments" },
        { id: "attachments", label: "Attachments" },
        { id: "logs", label: "Logs" },
      ]}
      subnavTabs={["materials", "attachments"]}
      subnav={(activeTab) => {
        if (activeTab === "materials") {
          return (
            <div className="flex w-full flex-wrap items-center justify-between gap-x-4 gap-y-2">
              <div className="min-w-0">
                <p className="text-sm font-bold text-foreground">
                  Labour & Material
                </p>
                <p className="text-xs text-muted-foreground">
                  {costingHint("invoice", materialsActions?.locked ?? false)}
                </p>
              </div>
              <LineItemsActions
                locked={materialsActions?.locked}
                saving={materialsActions?.saving}
                onAddLabor={() => materialsActions?.addLabor()}
                onAddMaterial={() => materialsActions?.addMaterial()}
                className="shrink-0"
              />
            </div>
          );
        }
        if (activeTab === "attachments") {
          return (
            <div className="flex w-full flex-wrap items-center justify-between gap-x-4 gap-y-2">
              <div className="min-w-0">
                <p className="text-sm font-bold text-foreground">Attachments</p>
                <p className="text-xs text-muted-foreground">
                  Photos, PDFs, and other invoice files.
                </p>
              </div>
              <Button
                size="sm"
                className="h-8 shrink-0"
                disabled={
                  !attachmentsActions ||
                  attachmentsActions.saving ||
                  attachmentsActions.uploading ||
                  !attachmentsActions.dirty
                }
                onClick={() => attachmentsActions?.save()}
              >
                {attachmentsActions?.saving ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" />
                    Saving…
                  </>
                ) : (
                  "Save attachments"
                )}
              </Button>
            </div>
          );
        }
        return null;
      }}
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
          {archived ? (
            <StatusPill label="Archived" className="bg-slate-100 text-slate-700" />
          ) : (
            <ArchiveBadge kind="invoice" id={invoice.id} />
          )}
        </>
      }
      notice={<FileNotices kind="invoice" id={invoice.id} />}
      actions={
        <>
          <Button
            size="sm"
            variant="outline"
            className="h-8"
            disabled={sending || invoice.status === "paid" || archived}
            onClick={() => {
              void (async () => {
                setSending(true);
                try {
                  if (useApi) {
                    await dispatch(sendInvoiceRecord(invoice.id)).unwrap();
                  } else {
                    await sendInvoiceApi(invoice.id);
                    await records.setStatus("invoice", invoice.id, "sent");
                  }
                  toast.success(`${invoice.number} marked sent.`);
                } catch (error) {
                  toast.error(
                    typeof error === "string"
                      ? error
                      : error instanceof Error
                        ? error.message
                        : "Could not send this invoice.",
                  );
                } finally {
                  setSending(false);
                }
              })();
            }}
          >
            {sending ? "Sending…" : "Send invoice"}
          </Button>
          {job ? (
            <>
              <Button size="sm" variant="outline" className="h-8" asChild>
                <Link href={`/pro/dashboard/jobs/${job.id}`}>
                  Open {job.number}
                </Link>
              </Button>
              <Button
                size="sm"
                className="h-8"
                onClick={() => setChangeOrderOpen(true)}
              >
                Create change order
              </Button>
            </>
          ) : null}
          <Button
            size="sm"
            variant="outline"
            className="h-8"
            onClick={() => setReminderOpen(true)}
          >
            Set reminder
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={archiving}
            onClick={() => void toggleArchive()}
          >
            {archiving
              ? archived
                ? "Restoring…"
                : "Archiving…"
              : archived
                ? "Restore"
                : "Archive"}
          </Button>
        </>
      }
    >
      {(tab) => {
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
                onPaid={handlePaymentApplied}
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
                preferApi={useApi}
                ready={!useApi || Boolean(detailInvoice)}
                hideHeader
                onActionsChange={onMaterialsActionsChange}
                onSave={
                  useApi
                    ? async (lines) => {
                        const filled = filledWorkLines(lines).map((line) => {
                          if (line.kind !== "materials") return line;
                          if (line.images?.length) return line;
                          const prev =
                            invoice.items.find((item) => item.id === line.id) ||
                            invoice.items.find(
                              (item) =>
                                item.kind !== "labor" &&
                                (item.description || "").trim() ===
                                  (line.description || "").trim(),
                            );
                          if (!prev?.images?.length) return line;
                          return { ...line, images: [...prev.images] };
                        });
                        const items = linesToInvoiceItems(invoice.id, filled).map(
                          (item) => {
                            const prev = invoice.items.find(
                              (existing) => existing.id === item.id,
                            );
                            return prev
                              ? { ...item, source: prev.source }
                              : item;
                          },
                        );
                        writeCostLines(session?.email, invoice.id, filled);
                        try {
                          await dispatch(
                            updateInvoiceRecord({
                              id: invoice.id,
                              invoice: { ...invoice, items },
                            }),
                          ).unwrap();
                          void dispatch(fetchInvoiceDetail(invoice.id));
                        } catch (error) {
                          toast.error(
                            error instanceof Error
                              ? error.message
                              : typeof error === "string"
                                ? error
                                : "Could not save line items to server.",
                          );
                          throw error;
                        }
                      }
                    : async (lines) => {
                        const filled = filledWorkLines(lines);
                        const items = linesToInvoiceItems(invoice.id, filled);
                        writeCostLines(session?.email, invoice.id, filled);
                        await records.patchInvoice(invoice.id, { items });
                      }
                }
              />
            );
          case "payments":
            return (
              <InvoicePaymentsTab
                invoice={invoice}
                payments={relatedPayments}
                onPaid={handlePaymentApplied}
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
                hideHeader
                onActionsChange={onAttachmentsActionsChange}
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
                onPaid={handlePaymentApplied}
              />
            );
        }
      }}
    </RecordWorkspace>
    <CreateReminderDialog
      open={reminderOpen}
      onOpenChange={setReminderOpen}
      subjectKind="invoice"
      subjectId={invoice.id}
    />
    {job ? (
      <JobChangeOrderDialog
        job={{
          ...job,
          customerName: job.customerName || customerLabel,
        }}
        open={changeOrderOpen}
        onOpenChange={setChangeOrderOpen}
        invoiceId={invoice.id}
        onSaved={(next) => {
          dispatch(upsertJobItem(next));
          records.cacheJob(next);
          toast.success("Change order saved on the job.");
        }}
      />
    ) : null}
    </>
  );
}

export function PaymentDetailView({ id }: { id: string }) {
  const dispatch = useAppDispatch();
  const auth = useAppSelector(selectAuth);
  const user = useAppSelector(selectAuthUser);
  const useApi =
    auth.hydrated &&
    Boolean(auth.token) &&
    (user?.role === "provider" || auth.role === "provider");
  const paymentRef = String(id || "").trim();

  const cachedPayment = useAppSelector(
    (state) => state.payments?.detailsCache?.[paymentRef],
  );
  const detailLoading = useAppSelector((state) =>
    Boolean(state.payments?.detailLoading),
  );
  const listMatch = useAppSelector((state) =>
    state.payments?.items?.find((item) => item.id === paymentRef),
  );

  const { invoices, jobs, estimates, requests, payments, provider } =
    usePortalWorkspace();
  const { customers } = useCrmDirectory();
  const records = usePortalRecords();
  const [archiving, setArchiving] = useState(false);

  const localPayment = records
    .mergePayments(payments)
    .map((item) => ({
      ...item,
      status: records.statusOf("payment", item.id, item.status),
    }))
    .find((item) => item.id === paymentRef);

  const payment = useApi
    ? cachedPayment || listMatch || localPayment
    : localPayment;

  useEffect(() => {
    if (!useApi || !paymentRef) return;
    void dispatch(fetchPaymentDetail(paymentRef));
  }, [dispatch, paymentRef, useApi]);

  const allInvoices = records.mergeInvoices(invoices);
  const allJobs = records.mergeJobs(jobs);
  const allEstimates = records.mergeEstimates(estimates);
  const invoice = allInvoices.find((item) => item.id === payment?.invoiceId);
  const job = allJobs.find(
    (item) => item.id === (payment?.jobId || invoice?.jobId),
  );
  const customer = customers.find(
    (item) =>
      item.id === (invoice?.customerId || payment?.customerId || ""),
  );
  const customerLabel = (() => {
    if (customer) {
      const name = crmCustomerName(customer).trim();
      if (name && name !== "Customer") return name;
    }
    const fromPayment = String(payment?.customerName || "").trim();
    if (fromPayment && fromPayment !== "Customer") return fromPayment;
    const fromInvoice = String(invoice?.customerName || "").trim();
    if (fromInvoice && fromInvoice !== "Customer") return fromInvoice;
    const fromEstimate = String(
      allEstimates.find((item) => item.id === job?.estimateId)?.customerName ||
        "",
    ).trim();
    if (fromEstimate && fromEstimate !== "Customer") return fromEstimate;
    return fromPayment || fromInvoice || fromEstimate || "Customer";
  })();
  const customerPhone =
    customer?.phone?.trim() ||
    payment?.customerPhone?.trim() ||
    invoice?.customerPhone?.trim() ||
    "";
  const customerEmail =
    customer?.email?.trim() ||
    payment?.customerEmail?.trim() ||
    invoice?.customerEmail?.trim() ||
    "";
  const service = job
    ? jobServiceLabel(job, allEstimates, requests)
    : invoice?.items[0]?.description || "Service";
  const pending = useCrmRecordPending();
  const archived =
    Boolean(payment?.isArchived) ||
    (payment ? records.isArchived("payment", payment.id) : false);

  async function toggleArchive() {
    if (!payment || archiving) return;
    setArchiving(true);
    try {
      if (useApi) {
        await dispatch(
          patchPaymentArchive({
            id: payment.id,
            isArchived: !archived,
          }),
        ).unwrap();
        void dispatch(fetchPayments({ force: true, silent: true }));
      } else if (archived) {
        await records.unarchive("payment", payment.id);
      } else {
        await records.archive("payment", payment.id);
      }
      toast.success(
        archived
          ? `${paymentNumber(payment)} restored.`
          : `${paymentNumber(payment)} archived.`,
      );
    } catch (error) {
      toast.error(
        typeof error === "string"
          ? error
          : error instanceof Error
            ? error.message
            : archived
              ? "Could not restore this payment."
              : "Could not archive this payment.",
      );
    } finally {
      setArchiving(false);
    }
  }

  if (!payment) {
    return (useApi && detailLoading) || pending ? (
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
      tabs={[
        { id: "summary", label: "Summary" },
        { id: "customer", label: "Customer" },
      ]}
      badge={
        <>
          <StatusPill
            label={paymentStatusLabel(payment.status)}
            className={paymentStatusTone(payment.status)}
          />
          <StatusPill label={paymentKindLabel(paymentKind(payment))} />
          {archived ? (
            <StatusPill label="Archived" className="bg-slate-100 text-slate-700" />
          ) : (
            <ArchiveBadge kind="payment" id={payment.id} />
          )}
        </>
      }
      actions={
        <>
          {payment.invoiceId ? (
            <Button size="sm" variant="outline" className="h-8" asChild>
              <Link href={`/pro/dashboard/invoices/${payment.invoiceId}`}>
                Open {invoice?.number || payment.invoiceNumber || "invoice"}
              </Link>
            </Button>
          ) : null}
          {job ? (
            <Button size="sm" variant="outline" className="h-8" asChild>
              <Link href={`/pro/dashboard/jobs/${job.id}`}>
                Open {job.number}
              </Link>
            </Button>
          ) : null}
          <Button
            size="sm"
            variant="outline"
            className="h-8"
            disabled={archiving}
            onClick={() => void toggleArchive()}
          >
            {archiving
              ? archived
                ? "Restoring…"
                : "Archiving…"
              : archived
                ? "Restore"
                : "Archive"}
          </Button>
        </>
      }
    >
      {(tab) => {
        switch (tab) {
          case "customer":
            return (
              <PaymentFileChrome
                payment={payment}
                invoice={invoice}
                customer={customer}
                customerLabel={customerLabel}
                customerPhone={customerPhone}
                customerEmail={customerEmail}
                service={service}
                job={job}
              />
            );
          case "summary":
          default:
            return (
              <PaymentSummaryTab
                payment={payment}
                invoice={invoice}
                customer={customer}
                customerLabel={customerLabel}
                service={service}
                job={job}
              />
            );
        }
      }}
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

