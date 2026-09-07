"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Camera, CreditCard, FileText, LayoutDashboard, NotebookPen, Paperclip, ScrollText, Settings, Share2 } from "lucide-react";
import { toast } from "sonner";
import { ArchiveBadge, ArchiveButton } from "@/components/portal/archive-control";
import { AddNoteButton, SetReminderButton, SetTaskButton } from "@/components/portal/create-person-dialogs";
import { NotesPanel } from "@/components/portal/notes-panel";
import { FileNotices } from "@/components/portal/task-banner";
import { AssignEventDialog } from "@/components/portal/assign-event-dialog";
import { EstimateFileChrome, EstimateSettingsTab } from "@/components/portal/estimate-file";
import { EstimatePipeline, EstimateSiteVisitTab, EstimateStageBanner } from "@/components/portal/estimate-flow";
import { EstimateShareTab } from "@/components/portal/share-estimate-panel";
import { SendApprovalDialog } from "@/components/portal/send-approval-dialog";
import { useEstimateShare } from "@/components/portal/use-estimate-share";
import { ApplyPaymentButton, InvoiceFileChrome, InvoicePaymentsTab, InvoiceSummaryTab } from "@/components/portal/invoice-file";
import { PaymentFileChrome, PaymentSummaryTab } from "@/components/portal/payment-file";
import {
  JobAttachmentsTab,
  JobFileChrome,
  JobLogsTab,
  JobMaterialsTab,
  JobSettingsTab,
  JobSummaryTab,
} from "@/components/portal/job-file";
import { readCostLines, writeCostLines } from "@/components/portal/use-job-costing";
import {
  applyEstimateSettings,
  applyInvoiceSettings,
  applyJobSettings,
  useEstimateSettings,
  useEstimateSiteVisit,
  useInvoiceSettings,
  useJobSettings,
} from "@/components/portal/use-job-file";
import { usePortalRecords } from "@/components/portal/use-portal-records";
import { RecordWorkspace } from "@/components/portal/record-workspace";
import { PortalPage } from "@/components/portal/portal-page";
import { StatusPill } from "@/components/portal/status-pill";
import { useCrmDirectory } from "@/components/portal/use-crm-directory";
import { usePortalCrew } from "@/components/portal/use-portal-crew";
import { usePortalWorkspace } from "@/components/portal/use-portal-workspace";
import { estimateAsJob, invoiceAsJob, buildInvoice, buildJob, nextRecordNumber, todayISO } from "@/components/portal/work-builders";
import { crmCustomerName } from "@/lib/data/crm-people";
import { Button } from "@/components/ui/button";
import {
  calendarEventKindLabel,
  estimateCanConvert,
  estimateCanShare,
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
} from "@/lib/data/portal";

export function EstimateDetailView({ id }: { id: string }) {
  const router = useRouter();
  const { session, estimates, provider, jobs } = usePortalWorkspace();
  const { customers } = useCrmDirectory();
  const { events, employees, assign, employeeLabel } = usePortalCrew();
  const records = usePortalRecords();
  const settings = useEstimateSettings(id);
  const siteVisit = useEstimateSiteVisit(id);
  const share = useEstimateShare();
  const [assignOpen, setAssignOpen] = useState(false);
  const [approvalOpen, setApprovalOpen] = useState(false);
  const seeded = records.mergeEstimates(estimates).find((item) => item.id === id);
  const estimate = seeded
    ? applyEstimateSettings({ ...seeded, status: records.statusOf("estimate", seeded.id, seeded.status) }, settings)
    : undefined;
  const allJobs = records.mergeJobs(jobs);
  const job =
    allJobs.find((item) => item.id === records.linkedId("estimate", id)) ??
    allJobs.find((item) => item.estimateId === id);
  const event = events.find((item) => item.kind === "estimate" && item.recordId === id);
  const customer = customers.find((item) => item.id === estimate?.customerId);
  const customerLabel = customer
    ? crmCustomerName(customer)
    : estimate
      ? getPortalCustomerName(provider, estimate.customerId)
      : "Customer";

  const approval = share.approvalOf(id);

  if (!estimate) return <Missing title="Estimate not found" href="/pro/dashboard/estimates" />;

  const quote = estimate;
  const asJob = estimateAsJob(quote);
  const service = settings?.name || estimate.items[0]?.description.replace(/ labor$/i, "") || "Service";
  const signed = Boolean(approval || estimate.signature);
  const canShare = estimateCanShare(estimate.status);
  const canConvert = estimateCanConvert(estimate.status, signed);
  const visitLocked = estimate.status === "finalized" || estimate.status === "sent" || estimate.status === "accepted" || Boolean(job);

  function openApproval() {
    if (!canShare) {
      toast.error("Finalize the estimate in the office before sending it for approval.");
      return;
    }
    setApprovalOpen(true);
  }

  function markInspected() {
    const visit = siteVisit;
    if (!visit?.findings && !visit?.photos.length) {
      toast.error("Add findings or photos on the Site visit tab first.");
      return;
    }
    records.setStatus("estimate", quote.id, "inspected");
    toast.success("Inspection saved. Price the quote in the office, then finalize.");
  }

  function finalizeEstimate() {
    if (quote.status === "site_visit") {
      toast.error("Mark the site visit inspected before you finalize.");
      return;
    }
    records.setStatus("estimate", quote.id, "finalized");
    toast.success("Estimate finalized. Share it so the customer can sign.");
  }

  function convertToJob() {
    if (job) {
      router.push(`/pro/dashboard/jobs/${job.id}`);
      return;
    }
    if (!canConvert) {
      toast.error("The customer must sign before this becomes a job.");
      return;
    }
    const lines = readCostLines(session?.email, asJob);
    const created = buildJob({
      number: nextRecordNumber("JOB", allJobs.map((item) => item.number)),
      providerId: provider.id,
      customerId: quote.customerId,
      estimateId: quote.id,
      address: quote.propertyAddress,
      assignedTo: siteVisit?.technician,
      scheduledAt: todayISO(),
      notes: [quote.notes, siteVisit?.recommendations].filter(Boolean).join("\n\n"),
      status: "scheduled",
      lines,
    });
    records.addJob(created);
    records.linkRecords("estimate", quote.id, created.id);
    records.setStatus("estimate", quote.id, "accepted");
    writeCostLines(session?.email, created.id, lines);
    toast.success(`${created.number} started from the signed estimate.`);
    router.push(`/pro/dashboard/jobs/${created.id}`);
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
            <StatusPill label={estimateStatusLabel(estimate.status)} className={estimateStatusTone(estimate.status)} />
            {signed ? <StatusPill label="Signed" className="bg-emerald-50 text-emerald-800" /> : null}
            <ArchiveBadge kind="estimate" id={estimate.id} />
          </>
        }
        actions={
          <>
            {job ? (
              <Button size="sm" asChild>
                <Link href={`/pro/dashboard/jobs/${job.id}`}>Open {job.number}</Link>
              </Button>
            ) : canConvert ? (
              <Button size="sm" data-action="convert-to-job" onClick={convertToJob}>
                Start job
              </Button>
            ) : estimate.status === "site_visit" ? (
              <Button size="sm" onClick={markInspected}>
                Mark inspected
              </Button>
            ) : estimate.status === "inspected" || estimate.status === "draft" || estimate.status === "changes_requested" ? (
              <Button size="sm" onClick={finalizeEstimate}>
                Finalize estimate
              </Button>
            ) : (
              <Button size="sm" variant={canShare ? "default" : "outline"} onClick={openApproval}>
                <Share2 />
                Send for approval
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={() => setAssignOpen(true)}>
              Assign technician
            </Button>
            <ArchiveButton kind="estimate" id={estimate.id} label={estimate.number} />
            <SetReminderButton subjectKind="estimate" subjectId={estimate.id} />
            <SetTaskButton subjectKind="estimate" subjectId={estimate.id} />
            <AddNoteButton subjectKind="estimate" subjectId={estimate.id} />
          </>
        }
        notice={<FileNotices kind="estimate" id={estimate.id} />}
      >
        {(tab) => {
          const body = (() => {
            switch (tab) {
              case "summary":
                return <JobSummaryTab job={asJob} estimate={estimate} technician="" noun="estimate" />;
              case "visit":
                return (
                  <EstimateSiteVisitTab
                    estimate={estimate}
                    asJob={asJob}
                    locked={visitLocked}
                    onSave={() => {
                      if (estimate.status === "draft") records.setStatus("estimate", estimate.id, "site_visit");
                    }}
                  />
                );
              case "materials":
                return <JobMaterialsTab job={asJob} estimate={estimate} technician="" noun="estimate" />;
              case "share":
                return (
                  <EstimateShareTab
                    estimate={estimate}
                    customer={customer}
                    customerLabel={customerLabel}
                    onSent={() => records.setStatus("estimate", estimate.id, "sent")}
                  />
                );
              case "logs":
                return <JobLogsTab job={asJob} estimate={estimate} technician="" noun="estimate" />;
              case "notes":
                return <NotesPanel kind="estimate" id={estimate.id} empty="Add the first note on this estimate." />;
              case "attachments":
                return <JobAttachmentsTab job={asJob} estimate={estimate} technician="" noun="estimate" />;
              case "settings":
                return <EstimateSettingsTab estimate={estimate} job={job} service={service} />;
              default:
                return <JobSummaryTab job={asJob} estimate={estimate} technician="" noun="estimate" />;
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
              <EstimateStageBanner status={estimate.status} signed={signed} hasJob={Boolean(job)} />
              {signed && !job ? (
                <div className="rounded-[4px] border border-emerald-200 bg-emerald-50 px-4 py-3">
                  <p className="text-sm font-semibold text-emerald-900">
                    {approval?.signedBy || estimate.signature?.signedBy} signed this estimate
                  </p>
                  <p className="mt-1 text-sm text-emerald-950">The quote is approved. Start the job to put it on the schedule.</p>
                  <Button className="mt-3" size="sm" onClick={convertToJob}>
                    Start job
                  </Button>
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
        event={event}
        events={events}
        employees={employees}
        onSave={(assignment) => {
          assign(assignment);
          toast.success(`${calendarEventKindLabel(assignment.kind)} placed on the calendar.`);
        }}
      />
      <SendApprovalDialog
        open={approvalOpen}
        onOpenChange={setApprovalOpen}
        estimate={estimate}
        customer={customer}
        customerLabel={customerLabel}
        onSent={() => records.setStatus("estimate", estimate.id, "sent")}
      />
    </>
  );
}

export function JobDetailView({ id }: { id: string }) {
  const router = useRouter();
  const { session, jobs, estimates, invoices, requests, provider } = usePortalWorkspace();
  const { customers } = useCrmDirectory();
  const { events, employees, assign, employeeLabel } = usePortalCrew();
  const records = usePortalRecords();
  const settings = useJobSettings(id);
  const [assignOpen, setAssignOpen] = useState(false);
  const allJobs = records.mergeJobs(jobs);
  const allEstimates = records.mergeEstimates(estimates);
  const allInvoices = records.mergeInvoices(invoices);
  const seeded = allJobs.find((item) => item.id === id);
  const job = seeded ? applyJobSettings({ ...seeded, status: records.statusOf("job", seeded.id, seeded.status) }, settings) : undefined;
  const estimate = allEstimates.find((item) => item.id === job?.estimateId);
  const invoice =
    allInvoices.find((item) => item.id === records.linkedId("job", id)) ??
    allInvoices.find((item) => item.id === job?.invoiceId) ??
    allInvoices.find((item) => item.jobId === id);
  const event = events.find((item) => item.kind === "job" && item.recordId === id);
  const start = settings?.start || event?.date || job?.scheduledAt;
  const due = settings?.due || event?.endDate || job?.dueAt;
  const customer = customers.find((item) => item.id === job?.customerId);
  const customerLabel = customer
    ? crmCustomerName(customer)
    : job
      ? getPortalCustomerName(provider, job.customerId)
      : "Customer";

  if (!job) return <Missing title="Job not found" href="/pro/dashboard/jobs" />;

  const currentJob = job;
  const technician = settings?.assignedTo || (event ? employeeLabel(event.employeeId) : currentJob.assignedTo ?? "");
  const service = settings?.name || jobServiceLabel(job, allEstimates, requests);

  function convertToInvoice() {
    try {
      if (invoice) {
        router.push(`/pro/dashboard/invoices/${invoice.id}`);
        return;
      }
      const lines = readCostLines(session?.email, currentJob);
      const created = buildInvoice({
        number: nextRecordNumber("INV", allInvoices.map((item) => item.number)),
        providerId: provider.id,
        customerId: currentJob.customerId,
        jobId: currentJob.id,
        lines: lines.length ? lines : currentJob.items.map((item) => ({
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
      toast.error(error instanceof Error ? error.message : "Could not convert this job.");
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
            <StatusPill label={jobStatusLabel(job.status)} className={jobStatusTone(job.status)} />
            <ArchiveBadge kind="job" id={job.id} />
          </>
        }
        actions={
          <>
            {invoice ? (
              <Button size="sm" variant="outline" asChild>
                <Link href={`/pro/dashboard/invoices/${invoice.id}`}>Open {invoice.number}</Link>
              </Button>
            ) : (
              <Button size="sm" data-action="convert-to-invoice" onClick={convertToInvoice}>
                Convert to invoice
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={() => setAssignOpen(true)}>
              Assign technician
            </Button>
            <Button size="sm" variant="outline" asChild>
              <Link href="/pro/dashboard/schedule">Open calendar</Link>
            </Button>
            <ArchiveButton kind="job" id={job.id} label={job.number} />
            <SetReminderButton subjectKind="job" subjectId={job.id} />
            <SetTaskButton subjectKind="job" subjectId={job.id} />
            <AddNoteButton subjectKind="job" subjectId={job.id} />
          </>
        }
        notice={<FileNotices kind="job" id={job.id} />}
      >
        {(tab) => {
          const body = (() => {
            switch (tab) {
              case "summary":
                return <JobSummaryTab job={job} estimate={estimate} invoice={invoice} technician={technician} />;
              case "materials":
                return <JobMaterialsTab job={job} estimate={estimate} invoice={invoice} technician={technician} />;
              case "logs":
                return <JobLogsTab job={job} estimate={estimate} invoice={invoice} technician={technician} />;
              case "notes":
                return <NotesPanel kind="job" id={job.id} empty="Add the first note on this job." />;
              case "attachments":
                return <JobAttachmentsTab job={job} estimate={estimate} invoice={invoice} technician={technician} />;
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
                return <JobSummaryTab job={job} estimate={estimate} invoice={invoice} technician={technician} />;
            }
          })();
          return (
            <div className="space-y-4">
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
        event={event}
        events={events}
        employees={employees}
        onSave={(assignment) => {
          assign(assignment);
          toast.success(`${calendarEventKindLabel(assignment.kind)} assigned on the calendar.`);
        }}
      />
    </>
  );
}

export function InvoiceDetailView({ id }: { id: string }) {
  const { invoices, jobs, estimates, requests, payments, provider } = usePortalWorkspace();
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
  const relatedPayments = records.mergePayments(payments).filter((item) => item.invoiceId === id);
  const customer = customers.find((item) => item.id === invoice?.customerId);
  const customerLabel = customer
    ? crmCustomerName(customer)
    : invoice
      ? getPortalCustomerName(provider, invoice.customerId)
      : "Customer";

  if (!invoice) return <Missing title="Invoice not found" href="/pro/dashboard/invoices" />;

  const asJob = invoiceAsJob(invoice, job);
  const service = job ? jobServiceLabel(job, allEstimates, requests) : invoice.items[0]?.description || "Service";

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
          <StatusPill label={invoiceStatusLabel(invoice.status)} className={invoiceStatusTone(invoice.status)} />
          <StatusPill label={invoiceKindLabel(invoiceKind(invoice))} />
          {invoiceDaysOverdue(invoice) ? (
            <StatusPill label={`${invoiceDaysOverdue(invoice)} days overdue`} className="bg-red-50 text-red-700" />
          ) : null}
          <ArchiveBadge kind="invoice" id={invoice.id} />
        </>
      }
      actions={
        <>
          <ApplyPaymentButton invoice={invoice} />
          {job ? (
            <Button size="sm" variant="outline" asChild>
              <Link href={`/pro/dashboard/jobs/${job.id}`}>Open {job.number}</Link>
            </Button>
          ) : null}
          <ArchiveButton kind="invoice" id={invoice.id} label={invoice.number} />
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
              return <JobMaterialsTab job={asJob} estimate={estimate} invoice={invoice} technician="" noun="invoice" />;
            case "payments":
              return <InvoicePaymentsTab invoice={invoice} payments={relatedPayments} />;
            case "attachments":
              return <JobAttachmentsTab job={asJob} estimate={estimate} invoice={invoice} technician="" noun="invoice" />;
            case "logs":
              return <JobLogsTab job={asJob} estimate={estimate} invoice={invoice} technician="" noun="invoice" />;
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
  const { invoices, jobs, estimates, requests, payments, provider } = usePortalWorkspace();
  const { customers } = useCrmDirectory();
  const records = usePortalRecords();
  const payment = records
    .mergePayments(payments)
    .map((item) => ({ ...item, status: records.statusOf("payment", item.id, item.status) }))
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

  if (!payment) return <Missing title="Payment not found" href="/pro/dashboard/payments" />;

  return (
    <RecordWorkspace
      href={`/pro/dashboard/payments/${payment.id}`}
      label={paymentNumber(payment)}
      kind="payment"
      tabs={[{ id: "summary", label: "Summary", icon: LayoutDashboard }]}
      badge={
        <>
          <StatusPill label={paymentStatusLabel(payment.status)} className={paymentStatusTone(payment.status)} />
          <StatusPill label={paymentKindLabel(paymentKind(payment))} />
          <ArchiveBadge kind="payment" id={payment.id} />
        </>
      }
      actions={
        <>
          {invoice ? (
            <Button size="sm" variant="outline" asChild>
              <Link href={`/pro/dashboard/invoices/${invoice.id}`}>Open {invoice.number}</Link>
            </Button>
          ) : null}
          {job ? (
            <Button size="sm" variant="outline" asChild>
              <Link href={`/pro/dashboard/jobs/${job.id}`}>Open {job.number}</Link>
            </Button>
          ) : null}
          <ArchiveButton kind="payment" id={payment.id} label={paymentNumber(payment)} />
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
