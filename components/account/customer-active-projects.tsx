"use client";

import Link from "next/link";
import { ArrowRight, Hammer, Layers } from "lucide-react";
import { BoardCard } from "@/components/portal/dashboard-widgets";
import { UserAvatar } from "@/components/shared/user-avatar";
import { formatMoney } from "@/lib/format";
import { customerPaths } from "@/lib/customer-paths";
import {
  isStageLate,
  stageDateRange,
  stageDisplayStatus,
  stageProgress,
  stageStatusLabel,
  stageStatusTone,
  type ProjectStage,
} from "@/lib/project-stages";
import { cn } from "@/lib/utils";
import type { CustomerApiEstimate } from "@/store/customerQuotesSlice";

/** Accepted work (or the job it became) that isn't finished yet. */
const ACTIVE_ESTIMATE_STATUSES = new Set(["accepted", "approved", "converted_to_job"]);
const FINISHED_JOB_STATUSES = new Set(["completed", "invoiced", "paid", "cancelled"]);

function isActive(estimate: CustomerApiEstimate) {
  if (!ACTIVE_ESTIMATE_STATUSES.has(estimate.status)) return false;
  const stages = estimate.stages || [];
  if (stages.length) return stageProgress(stages) < 100;
  return !FINISHED_JOB_STATUSES.has(String(estimate.jobStatus || ""));
}

/** The stage to show: the one being worked on, else the next one up. */
function currentStage(stages: ProjectStage[]) {
  return stages.find((stage) => stage.status === "in_progress") || stages.find((stage) => stage.status !== "completed") || null;
}

/** Late projects first, then by when the current stage starts. */
function sortKey(estimate: CustomerApiEstimate) {
  const stages = estimate.stages || [];
  const late = stages.some((stage) => isStageLate(stage)) ? 0 : 1;
  const start = currentStage(stages)?.startDate;
  return [late, start ? new Date(start).getTime() : Number.MAX_SAFE_INTEGER] as const;
}

function activeSorted(estimates: CustomerApiEstimate[]) {
  return estimates.filter(isActive).sort((a, b) => {
    const [lateA, startA] = sortKey(a);
    const [lateB, startB] = sortKey(b);
    return lateA - lateB || startA - startB;
  });
}

/**
 * Dashboard redesign (client: Active projects and Estimates to review looked alike): projects
 * as TILES — emerald accent, provider mark, current stage, a big progress ring/bar, status badge
 * and a "View project" button — two per row. Always renders (empty state when nothing is active).
 * The list version below (CustomerActiveProjects) is kept for reference / other use.
 */
export function CustomerActiveProjectCards({ estimates, className }: { estimates: CustomerApiEstimate[]; className?: string }) {
  const active = activeSorted(estimates);
  return (
    <section className={cn("flex flex-col overflow-hidden rounded-xl border border-input bg-card shadow-xs", className)}>
      <div className="flex items-center justify-between gap-3 border-b border-input px-4 py-3">
        <div className="flex items-center gap-2.5">
          <span className="flex size-8 items-center justify-center rounded-lg bg-muted text-foreground/70">
            <Hammer className="size-4" aria-hidden />
          </span>
          <div>
            <h3 className="text-sm font-semibold">Active projects</h3>
            <p className="text-xs text-muted-foreground">Work in progress with your pros</p>
          </div>
          {active.length ? (
            <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground tabular-nums">
              {active.length}
            </span>
          ) : null}
        </div>
        <Link href={customerPaths.orders} className="text-xs font-medium text-primary hover:text-primary/80">
          All orders
        </Link>
      </div>
      {active.length ? (
        <div className="grid gap-3 p-3 sm:grid-cols-2">
          {active.slice(0, 4).map((estimate) => {
            const stages = estimate.stages || [];
            const stage = currentStage(stages);
            const shown = stage ? stageDisplayStatus(stage) : null;
            const progress = stages.length ? stageProgress(stages) : estimate.jobId ? 10 : 0;
            const company = estimate.provider?.companyName || "Your professional";
            return (
              <Link
                key={estimate.id}
                href={estimate.shareToken ? customerPaths.estimate(estimate.shareToken) : customerPaths.estimates}
                className="group flex flex-col gap-3 rounded-lg border border-input bg-background p-4 transition hover:border-primary/30 hover:shadow-sm"
              >
                <div className="flex items-start gap-2.5">
                  <UserAvatar name={company} className="size-8 rounded-lg bg-primary/10 text-[11px] text-primary" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{estimate.title || "Project"}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {estimate.jobNumber || estimate.number} · {company}
                    </p>
                  </div>
                  {shown ? (
                    // Muted chip (client: no over-saturated colours). Was stageStatusTone(shown) colours.
                    <span className="shrink-0 rounded-full border border-input px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                      {stageStatusLabel(shown)}
                    </span>
                  ) : (
                    <span className="shrink-0 rounded-full border border-input px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                      {estimate.jobId ? "Scheduled" : "Accepted"}
                    </span>
                  )}
                </div>
                <div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex min-w-0 items-center gap-1.5 text-muted-foreground">
                      <Layers className="size-3.5 shrink-0" aria-hidden />
                      <span className="truncate">
                        {stage
                          ? `${stage.name}${stage.startDate ? ` · ${stageDateRange(stage)}` : ""}`
                          : estimate.jobId
                            ? "Work scheduled"
                            : "Waiting to be scheduled"}
                      </span>
                    </span>
                    <span className="shrink-0 font-semibold tabular-nums">{progress}%</span>
                  </div>
                  <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
                    <span className="block h-full rounded-full bg-primary/70 transition-[width] duration-700" style={{ width: `${progress}%` }} />
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold tabular-nums">{estimate.total ? formatMoney(estimate.total) : "—"}</span>
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-primary group-hover:underline">
                    View project
                    <ArrowRight className="size-3.5" aria-hidden />
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 py-8 text-center">
          <span className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <Hammer className="size-4.5" aria-hidden />
          </span>
          <p className="text-sm font-medium">No active projects</p>
          <p className="max-w-xs text-xs text-muted-foreground">Approve an estimate and your project will show here with its progress.</p>
        </div>
      )}
    </section>
  );
}

/**
 * Customer dashboard: ongoing and upcoming projects with their stage progress, so the customer
 * can follow the work. Each row opens the estimate (timeline, progress and the crew's notes).
 */
export function CustomerActiveProjects({ estimates }: { estimates: CustomerApiEstimate[] }) {
  const active = estimates
    .filter(isActive)
    .sort((a, b) => {
      const [lateA, startA] = sortKey(a);
      const [lateB, startB] = sortKey(b);
      return lateA - lateB || startA - startB;
    });
  if (!active.length) return null;

  return (
    <BoardCard title="Active projects" href={customerPaths.estimates} hrefLabel="All estimates">
      {active.slice(0, 5).map((estimate) => {
        const stages = estimate.stages || [];
        const stage = currentStage(stages);
        const shown = stage ? stageDisplayStatus(stage) : null;
        const progress = stageProgress(stages);
        return (
          <Link
            key={estimate.id}
            href={estimate.shareToken ? customerPaths.estimate(estimate.shareToken) : customerPaths.estimates}
            className="flex items-center justify-between gap-4 px-5 py-3.5 text-sm transition-colors hover:bg-muted/40"
          >
            <span className="min-w-0 flex-1 space-y-1">
              <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <span className="truncate font-medium">{estimate.title}</span>
                <span className="text-xs text-muted-foreground">
                  {estimate.jobNumber || estimate.number}
                  {estimate.provider?.companyName ? ` · ${estimate.provider.companyName}` : ""}
                </span>
              </span>
              {stages.length ? (
                <>
                  <span className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Layers className="size-3.5 shrink-0" aria-hidden />
                    <span className="truncate">
                      {stage
                        ? `${stage.name}${stage.startDate ? ` · ${stageDateRange(stage)}` : " · dates to be scheduled"}`
                        : "All stages done"}
                    </span>
                    <span className="shrink-0 font-semibold text-foreground">{progress}%</span>
                  </span>
                  <span className="block h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
                    <span className="block h-full rounded-full bg-emerald-500" style={{ width: `${progress}%` }} />
                  </span>
                </>
              ) : (
                <span className="block text-xs text-muted-foreground">
                  {estimate.jobId ? "Work scheduled with your professional" : "Accepted — your professional will schedule the work"}
                </span>
              )}
            </span>
            {shown ? (
              <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold", stageStatusTone(shown))}>
                {stageStatusLabel(shown)}
              </span>
            ) : null}
            <ArrowRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          </Link>
        );
      })}
    </BoardCard>
  );
}
