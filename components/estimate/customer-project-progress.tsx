"use client";

import { AlertTriangle, CheckCircle2, Circle, Layers, Loader2, MessageSquare } from "lucide-react";
import { noteRoleLabel, type ProjectUpdate } from "@/lib/field-notes";
import {
  formatStageDuration,
  stageDateRange,
  stageDisplayStatus,
  stageProgress,
  stageStatusLabel,
  stageStatusTone,
  stageTotals,
  type ProjectStage,
} from "@/lib/project-stages";
import { cn } from "@/lib/utils";

function formatWhen(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

/**
 * The customer's view of the work: project stages (time, dates, progress) and the updates the
 * provider / crew shared. Hidden when there's neither.
 */
export function CustomerProjectProgress({ stages, updates }: { stages: ProjectStage[]; updates: ProjectUpdate[] }) {
  if (!stages.length && !updates.length) return null;
  const progress = stageProgress(stages);
  // Notes the crew wrote on a stage show under it; the rest stay in "Project updates".
  const stageIds = new Set(stages.map((stage) => stage.id));
  const notesFor = (stageId: string) => updates.filter((update) => update.stageId === stageId);
  const general = updates.filter((update) => !update.stageId || !stageIds.has(update.stageId));
  return (
    <section className="mx-auto w-full max-w-[8.5in] space-y-4 rounded-xl border border-border bg-card p-4 shadow-xs print:hidden">
      {stages.length ? (
        <div>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="flex items-center gap-1.5 text-sm font-semibold">
              <Layers className="size-4 text-primary" aria-hidden />
              Project timeline
            </h2>
            <p className="text-xs text-muted-foreground">
              {stages.length} stage{stages.length === 1 ? "" : "s"} · {formatStageDuration(stageTotals(stages))} in total ·{" "}
              <span className="font-semibold text-foreground">{progress}% complete</span>
            </p>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted" aria-hidden>
            <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${progress}%` }} />
          </div>
          <ol className="mt-3 space-y-2">
            {stages.map((stage, index) => {
              const shown = stageDisplayStatus(stage);
              const notes = notesFor(stage.id);
              return (
              <li key={stage.id} className="flex items-start gap-3 rounded-lg border border-border px-3 py-2">
                <span className="mt-0.5 shrink-0" aria-hidden>
                  {shown === "completed" ? (
                    <CheckCircle2 className="size-4 text-emerald-600" />
                  ) : shown === "late" ? (
                    <AlertTriangle className="size-4 text-rose-600" />
                  ) : shown === "in_progress" ? (
                    <Loader2 className="size-4 text-sky-600" />
                  ) : (
                    <Circle className="size-4 text-muted-foreground" />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">
                    {index + 1}. {stage.name}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {formatStageDuration({ days: stage.durationDays, hours: stage.durationHours })}
                    {stage.startDate ? ` · ${stageDateRange(stage)}` : " · dates to be scheduled"}
                    {stage.statusUpdatedBy && stage.status !== "pending" ? ` · updated by ${stage.statusUpdatedBy}` : ""}
                  </span>
                  {notes.length ? (
                    <ul className="mt-1.5 space-y-1">
                      {notes.map((update) => (
                        <li key={update.id} className="rounded-md bg-muted/60 px-2 py-1 text-xs">
                          <span className="font-semibold">{update.authorName || noteRoleLabel(update.authorRole)}</span>
                          <span className="text-muted-foreground"> · {formatWhen(update.createdAt)}</span>
                          <span className="block whitespace-pre-wrap">{update.content}</span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </span>
                <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold", stageStatusTone(shown))}>
                  {stageStatusLabel(shown)}
                </span>
              </li>
              );
            })}
          </ol>
        </div>
      ) : null}

      {general.length ? (
        <div className={cn(stages.length && "border-t border-border pt-4")}>
          <h2 className="flex items-center gap-1.5 text-sm font-semibold">
            <MessageSquare className="size-4 text-primary" aria-hidden />
            Project updates
          </h2>
          <ul className="mt-2 space-y-2">
            {general.map((update) => (
              <li key={update.id} className="rounded-lg border border-border px-3 py-2">
                <p className="text-xs text-muted-foreground">
                  <span className="font-semibold text-foreground">{update.authorName || noteRoleLabel(update.authorRole)}</span>
                  {update.authorRole !== "provider" ? ` · ${noteRoleLabel(update.authorRole)}` : ""} ·{" "}
                  {formatWhen(update.createdAt)}
                </p>
                <p className="mt-1 text-sm whitespace-pre-wrap">{update.content}</p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
