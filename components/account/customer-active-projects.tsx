"use client";

import Link from "next/link";
import { ArrowRight, Layers } from "lucide-react";
import { BoardCard } from "@/components/portal/dashboard-widgets";
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
