"use client";

import { useEffect, type ReactNode } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Briefcase,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  FilePlus2,
} from "lucide-react";
import {
  CompletionStatePill,
  RequestStatusPill,
  RequirementSummary,
  siteLine,
} from "@/components/contractor/contractor-ui";
import { PortalPage } from "@/components/portal/portal-page";
import { JobStatusPill } from "@/components/technician/tech-ui";
import { CenteredSpinner } from "@/components/ui/spinner";
import { contractorPaths } from "@/lib/contractor-paths";
import { formatDate, formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { fetchContractorDashboard } from "@/store/contractorPortalSlice";

function StatTile({
  label,
  value,
  hint,
  icon: Icon,
  href,
  tone = "neutral",
}: {
  label: string;
  value: ReactNode;
  /** Small secondary line under the label. */
  hint?: ReactNode;
  icon: typeof Briefcase;
  href: string;
  tone?: "neutral" | "warning" | "danger" | "success";
}) {
  const tones = {
    neutral: "bg-[var(--ct-accent-soft)] text-[var(--ct-accent)]",
    warning: "bg-amber-50 text-amber-700",
    danger: "bg-red-50 text-red-700",
    success: "bg-emerald-50 text-emerald-700",
  } as const;
  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-2xl border border-[var(--ct-border)] bg-white p-4 transition-colors hover:border-[var(--ct-accent)]"
    >
      <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-lg", tones[tone])}>
        <Icon className="size-5" aria-hidden />
      </span>
      <span className="min-w-0">
        <span className="block text-2xl font-semibold tabular-nums text-slate-900">{value}</span>
        <span className="block truncate text-xs text-slate-500">{label}</span>
        {hint ? <span className="mt-0.5 block truncate text-[11px] text-slate-400">{hint}</span> : null}
      </span>
    </Link>
  );
}

export function ContractorDashboardView() {
  const dispatch = useAppDispatch();
  const { data, loading, error } = useAppSelector((state) => state.contractorPortal.dashboard);
  const version = useAppSelector((state) => state.contractorPortal.versions.dashboard);
  const company = useAppSelector((state) => state.contractorPortal.profile.data?.provider?.name || "");
  const name = useAppSelector((state) => state.contractorPortal.profile.data?.displayName || "");

  useEffect(() => {
    void dispatch(fetchContractorDashboard());
  }, [dispatch, version]);

  const counts = data?.counts;

  return (
    <PortalPage
      eyebrow="Contractor / Dashboard"
      title={name ? `Welcome, ${name}` : "Dashboard"}
      description={company ? `Work assigned to you by ${company}.` : "Work assigned to you, and where it stands."}
    >
      {error ? <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p> : null}

      {!data && loading ? (
        <CenteredSpinner label="Loading dashboard" />
      ) : counts ? (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatTile
              label="Total assigned jobs"
              value={counts.totalAssigned}
              hint={`${counts.activeJobs} active`}
              icon={Briefcase}
              href={contractorPaths.jobs}
            />
            <StatTile
              label="Completed jobs"
              value={counts.completedJobs}
              icon={CheckCircle2}
              href={contractorPaths.jobs}
              tone="success"
            />
            <StatTile
              label="Total earned"
              value={formatMoney(data.earnings.earned)}
              hint={`${formatMoney(data.earnings.paid)} received · ${formatMoney(data.earnings.balance)} due`}
              icon={CircleDollarSign}
              href={contractorPaths.payouts}
            />
            <StatTile
              label="Pending reviews"
              value={counts.awaitingApproval}
              hint={`${counts.inProgress} in progress`}
              icon={Clock3}
              href={contractorPaths.jobs}
              tone="warning"
            />
          </div>

          {counts.reworkRequested || counts.openChangeRequests ? (
            <div className="flex flex-wrap gap-2">
              {counts.reworkRequested ? (
                <Link
                  href={contractorPaths.jobs}
                  className="inline-flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-medium text-red-800"
                >
                  <AlertTriangle className="size-3.5" aria-hidden />
                  {counts.reworkRequested} job{counts.reworkRequested === 1 ? "" : "s"} need re-work
                </Link>
              ) : null}
              {counts.openChangeRequests ? (
                <Link
                  href={contractorPaths.changeRequests}
                  className="inline-flex items-center gap-1.5 rounded-full border border-[var(--ct-border)] bg-white px-3 py-1 text-xs font-medium text-slate-700"
                >
                  <FilePlus2 className="size-3.5" aria-hidden />
                  {counts.openChangeRequests} change request{counts.openChangeRequests === 1 ? "" : "s"} waiting
                </Link>
              ) : null}
            </div>
          ) : null}

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
            <section className="rounded-2xl border border-[var(--ct-border)] bg-white">
              <div className="flex items-center justify-between border-b border-[var(--ct-divider)] px-4 py-3">
                <h2 className="text-sm font-semibold text-slate-900">Up next</h2>
                <Link href={contractorPaths.jobs} className="inline-flex items-center gap-1 text-xs font-medium text-[var(--ct-accent)] hover:underline">
                  All jobs <ArrowRight className="size-3.5" />
                </Link>
              </div>
              {data.upcoming.length ? (
                <ul className="divide-y divide-[var(--ct-divider)]">
                  {data.upcoming.map((job) => (
                    <li key={job.id}>
                      <Link href={contractorPaths.job(job.id)} className="flex flex-col gap-1 px-4 py-3 hover:bg-slate-50 dark:hover:bg-white/5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-semibold text-slate-900">{job.number}</span>
                          <span className="truncate text-sm text-slate-700">{job.title}</span>
                          <span className="ml-auto flex items-center gap-1.5">
                            <CompletionStatePill job={job} />
                            <JobStatusPill status={job.status} />
                          </span>
                        </div>
                        <p className="truncate text-xs text-slate-500">
                          {[job.scheduledAt ? formatDate(job.scheduledAt) : "Not scheduled", siteLine(job)].filter(Boolean).join(" · ")}
                        </p>
                        <p className="text-xs text-slate-600">
                          <RequirementSummary job={job} />
                        </p>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="px-4 py-8 text-center text-sm text-slate-500">No active jobs right now.</p>
              )}
            </section>

            <section className="rounded-2xl border border-[var(--ct-border)] bg-white">
              <div className="border-b border-[var(--ct-divider)] px-4 py-3">
                <h2 className="text-sm font-semibold text-slate-900">Recent office feedback</h2>
              </div>
              {data.recentFeedback.length ? (
                <ul className="divide-y divide-[var(--ct-divider)]">
                  {data.recentFeedback.map((item) => (
                    <li key={item.id} className="flex flex-col gap-1 px-4 py-3">
                      <div className="flex items-center gap-2">
                        {item.status !== "rejected" ? (
                          <CheckCircle2 className="size-4 text-emerald-600" aria-hidden />
                        ) : (
                          <AlertTriangle className="size-4 text-red-600" aria-hidden />
                        )}
                        <span className="text-sm font-medium text-slate-900">
                          {item.type === "completion" ? "Completion" : "Scope change"} · {item.job?.number || "Job"}
                        </span>
                        <span className="ml-auto">
                          <RequestStatusPill status={item.status} type={item.type} />
                        </span>
                      </div>
                      {item.reviewNote ? <p className="line-clamp-2 text-xs text-slate-600">{item.reviewNote}</p> : null}
                      <p className="text-[11px] text-slate-400">{item.reviewedAt ? formatDate(item.reviewedAt) : ""}</p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="px-4 py-8 text-center text-sm text-slate-500">Approvals and re-work requests show up here.</p>
              )}
            </section>
          </div>
        </>
      ) : null}
    </PortalPage>
  );
}
