"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowLeft, CheckCircle2, Clock3, FilePlus2, MapPin, Phone } from "lucide-react";
import { ChangeOrderRequestDialog } from "@/components/contractor/change-order-request-dialog";
import { CompleteJobDialog } from "@/components/contractor/complete-job-dialog";
import { ContractorChatButton, ContractorMapButton } from "@/components/contractor/contractor-job-actions";
import { ContractorClockButton, ContractorTimeSummary } from "@/components/contractor/contractor-job-extras";
import { FieldExtraWork } from "@/components/contractor/field-change-orders";
import { acceptContractorChangeOrder } from "@/lib/api/contractor-portal-client";
import { PayStatePill, payTermsLabel } from "@/components/contractor/views/contractor-payouts-view";
import {
  PhotoGrid,
  RequestStatusPill,
  RequirementsList,
  siteLine,
} from "@/components/contractor/contractor-ui";
import { PortalPage } from "@/components/portal/portal-page";
import { DetailCard, EmptyNote, JobStatusPill, KeyValue } from "@/components/technician/tech-ui";
import { Button } from "@/components/ui/button";
import { CenteredSpinner } from "@/components/ui/spinner";
import type { ContractorJob } from "@/lib/api/contractor-portal-client";
import { contractorPaths } from "@/lib/contractor-paths";
import { formatDate, formatMoney } from "@/lib/format";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { fetchContractorJob } from "@/store/contractorPortalSlice";

const CLOSED_STATUSES = ["completed", "invoiced", "paid", "cancelled"];

/** Banner explaining where the completion stands and what to do next. */
function CompletionBanner({ job, onResubmit }: { job: ContractorJob; onResubmit: () => void }) {
  const completion = job.completion;
  if (!completion) return null;
  if (completion.status === "pending_pro_approval") {
    return (
      <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        <Clock3 className="mt-0.5 size-4 shrink-0" aria-hidden />
        <div>
          <p className="font-semibold">Waiting for office approval</p>
          <p className="text-amber-800">
            You submitted completion proof{completion.submittedAt ? ` on ${formatDate(completion.submittedAt)}` : ""}. You&apos;ll
            be notified when it&apos;s reviewed.
          </p>
        </div>
      </div>
    );
  }
  if (completion.status === "rejected") {
    return (
      <div className="flex flex-wrap items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
        <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="font-semibold">Re-work requested</p>
          <p className="text-red-800">{completion.reviewNote || "The office asked for changes before closing this job."}</p>
        </div>
        <Button size="sm" onClick={onResubmit}>
          Resubmit
        </Button>
      </div>
    );
  }
  return (
    <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
      <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div>
        <p className="font-semibold">Work approved</p>
        <p className="text-emerald-800">
          The office approved your work{completion.reviewedAt ? ` on ${formatDate(completion.reviewedAt)}` : ""}.
          {completion.reviewNote ? ` "${completion.reviewNote}"` : ""}
        </p>
      </div>
    </div>
  );
}

export function ContractorJobDetailView({ id }: { id: string }) {
  const dispatch = useAppDispatch();
  const entry = useAppSelector((state) => state.contractorPortal.jobDetails[id]);
  const version = useAppSelector((state) => state.contractorPortal.versions.jobs);
  const [completeOpen, setCompleteOpen] = useState(false);
  const [changeOpen, setChangeOpen] = useState(false);

  useEffect(() => {
    void dispatch(fetchContractorJob(id));
  }, [dispatch, id, version]);

  const detail = entry?.data;
  if (!detail) {
    return entry?.error ? (
      <PortalPage eyebrow="Contractor / Assigned jobs" title="Job not available">
        <EmptyNote>{entry.error}</EmptyNote>
        <Button asChild variant="outline" className="self-start">
          <Link href={contractorPaths.jobs}>
            <ArrowLeft /> Back to jobs
          </Link>
        </Button>
      </PortalPage>
    ) : (
      <CenteredSpinner label="Loading job" />
    );
  }

  const { job, completions, changeRequests, pay, payments } = detail;
  const closed = CLOSED_STATUSES.includes(job.status);
  const awaiting = job.completion?.status === "pending_pro_approval";
  const approved = job.completion?.status === "approved";
  const canComplete = !closed && !awaiting && !approved;

  return (
    <PortalPage
      eyebrow="Contractor / Assigned jobs"
      title={
        <span className="flex flex-wrap items-center gap-2">
          {job.number}
          {job.title ? <span className="font-normal text-slate-600">· {job.title}</span> : null}
        </span>
      }
      badge={<JobStatusPill status={job.status} />}
      actions={
        <div className="flex flex-wrap gap-2">
          <ContractorClockButton detail={detail} closed={closed} />
          <ContractorMapButton job={job} />
          <ContractorChatButton jobId={job.id} number={job.number} />
          <Button variant="outline" onClick={() => setChangeOpen(true)} disabled={closed}>
            <FilePlus2 /> Request change order
          </Button>
          <Button onClick={() => setCompleteOpen(true)} disabled={!canComplete}>
            <CheckCircle2 /> Mark as complete
          </Button>
        </div>
      }
    >
      <Link href={contractorPaths.jobs} className="inline-flex items-center gap-1 self-start text-xs font-medium text-slate-600 hover:text-slate-900">
        <ArrowLeft className="size-3.5" /> All assigned jobs
      </Link>

      <CompletionBanner job={job} onResubmit={() => setCompleteOpen(true)} />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-4">
          <DetailCard title="Your scope">
            {job.assignment.title ? (
              <p className="mb-1 text-sm font-semibold text-foreground">{job.assignment.title}</p>
            ) : null}
            {job.assignment.startAt ? (
              <p className="mb-2 text-xs text-muted-foreground">
                {new Date(job.assignment.startAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}
                {job.assignment.endAt
                  ? ` → ${new Date(job.assignment.endAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}`
                  : ""}
              </p>
            ) : null}
            {job.assignment.instructions ? (
              <p className="text-sm whitespace-pre-wrap text-foreground">{job.assignment.instructions}</p>
            ) : (
              <p className="text-sm text-muted-foreground">
                No separate instructions. Work from the job requirements below.
              </p>
            )}
          </DetailCard>

          <DetailCard title="Requirements">
            <div className="flex flex-col gap-4">
              <RequirementsList job={job} />
              <FieldExtraWork
                orders={job.changeOrders}
                onAccept={async (order) => {
                  await acceptContractorChangeOrder(job.id, order.id);
                  await dispatch(fetchContractorJob(job.id));
                }}
              />
            </div>
          </DetailCard>

          {job.notes ? (
            <DetailCard title="Notes from the office">
              <p className="text-sm whitespace-pre-wrap text-foreground">{job.notes}</p>
            </DetailCard>
          ) : null}

          <DetailCard title="Completion history">
            {completions.length ? (
              <ul className="flex flex-col gap-4">
                {completions.map((item) => (
                  <li key={item.id} className="flex flex-col gap-2 rounded-md border border-border-soft p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium">Submitted {formatDate(item.createdAt)}</span>
                      <span className="ml-auto">
                        <RequestStatusPill status={item.status} />
                      </span>
                    </div>
                    <PhotoGrid photos={item.photos} />
                    {item.notes ? <p className="text-sm text-muted-foreground">Your notes: {item.notes}</p> : null}
                    {item.reviewNote ? (
                      <p className="rounded bg-muted px-2.5 py-1.5 text-sm">
                        <span className="font-medium">{item.reviewedBy || "Office"}:</span> {item.reviewNote}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyNote>When you finish, use &ldquo;Mark as complete&rdquo; to send photos of the work for approval.</EmptyNote>
            )}
          </DetailCard>
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          <DetailCard title="Time on this job">
            <ContractorTimeSummary detail={detail} />
          </DetailCard>

          <DetailCard title="Pay" action={pay ? <PayStatePill row={pay} /> : null}>
            {pay ? (
              <div className="flex flex-col gap-3">
                <p className="text-xs text-muted-foreground">{payTermsLabel(pay)}</p>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-lg bg-muted/50 px-2 py-2">
                    <p className="text-sm font-semibold tabular-nums">{formatMoney(pay.earned)}</p>
                    <p className="text-[11px] text-muted-foreground">Earned</p>
                  </div>
                  <div className="rounded-lg bg-emerald-50 px-2 py-2">
                    <p className="text-sm font-semibold tabular-nums text-emerald-700">{formatMoney(pay.paid)}</p>
                    <p className="text-[11px] text-muted-foreground">Paid</p>
                  </div>
                  <div className="rounded-lg bg-amber-50 px-2 py-2">
                    <p className="text-sm font-semibold tabular-nums text-amber-800">{formatMoney(pay.balance)}</p>
                    <p className="text-[11px] text-muted-foreground">Balance</p>
                  </div>
                </div>
                {pay.extras > 0 ? (
                  <p className="text-xs text-muted-foreground">Includes {formatMoney(pay.extras)} from accepted change orders.</p>
                ) : null}
                {!pay.approved ? (
                  <p className="text-xs text-muted-foreground">Payment is released once the office approves your completed work.</p>
                ) : null}
                {payments.length ? (
                  <ul className="divide-y divide-border-soft border-t border-border-soft text-xs">
                    {payments.map((payment) => (
                      <li key={payment.id} className="flex items-center justify-between gap-2 py-1.5">
                        <span>
                          {payment.number} · {formatDate(payment.paidAt)}
                        </span>
                        <span className="font-semibold tabular-nums">{formatMoney(payment.amount)}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Pay terms haven&apos;t been set for this job.</p>
            )}
          </DetailCard>

          <DetailCard title="Site">
            <div className="flex flex-col gap-3">
              <KeyValue
                label="Address"
                value={
                  siteLine(job) ? (
                    <span className="inline-flex items-start gap-1.5">
                      <MapPin className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                      <span className="min-w-0 flex-1">{siteLine(job)}</span>
                      <ContractorMapButton job={job} compact />
                    </span>
                  ) : null
                }
              />
              <KeyValue label="Scheduled" value={job.scheduledAt ? formatDate(job.scheduledAt) : "Not scheduled"} />
              {job.dueAt ? <KeyValue label="Due" value={formatDate(job.dueAt)} /> : null}
              <KeyValue label="Customer" value={job.customer.name} />
              {job.customer.phone ? (
                <KeyValue
                  label="Site contact"
                  value={
                    <a href={`tel:${job.customer.phone}`} className="inline-flex items-center gap-1.5 hover:underline">
                      <Phone className="size-3.5 text-muted-foreground" aria-hidden />
                      {job.customer.phone}
                    </a>
                  }
                />
              ) : null}
            </div>
          </DetailCard>

          <DetailCard
            title="Change requests"
            action={
              !closed ? (
                <button type="button" onClick={() => setChangeOpen(true)} className="text-xs font-medium text-[var(--ct-accent)] hover:underline">
                  New
                </button>
              ) : null
            }
          >
            {changeRequests.length ? (
              <ul className="flex flex-col divide-y divide-border-soft">
                {changeRequests.map((item) => (
                  <li key={item.id} className="flex flex-col gap-1 py-2.5 first:pt-0 last:pb-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className="line-clamp-2 text-sm text-foreground">{item.description}</p>
                      <RequestStatusPill status={item.status} type="change_order" />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Est. {formatMoney(item.estimatedCost)} · {formatDate(item.createdAt)}
                      {item.changeOrderNumber ? ` · ${item.changeOrderNumber}` : ""}
                    </p>
                    {item.reviewNote ? <p className="text-xs text-foreground">Office: {item.reviewNote}</p> : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Need extra material or work? Request a change order.</p>
            )}
          </DetailCard>
        </div>
      </div>

      <CompleteJobDialog job={job} open={completeOpen} onOpenChange={setCompleteOpen} />
      <ChangeOrderRequestDialog job={job} open={changeOpen} onOpenChange={setChangeOpen} />
    </PortalPage>
  );
}
