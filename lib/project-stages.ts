/**
 * Stages of a larger project (e.g. Removal → Installation → Cleanup), each with its own
 * duration and progress. Shared by the provider estimate page and the customer estimate page.
 */

export type ProjectStageStatus = "pending" | "in_progress" | "completed";

export type ProjectStage = {
  id: string;
  name: string;
  /** Line section it covers ("" = General). */
  section: string;
  durationDays: number;
  durationHours: number;
  status: ProjectStageStatus;
  /** Calendar dates once scheduled (ISO). */
  startDate?: string;
  endDate?: string;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

const isoOrUndefined = (value: unknown) => {
  if (!value) return undefined;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
};

export function mapProjectStages(raw: unknown): ProjectStage[] {
  const rows: { stage: ProjectStage; order: number }[] = [];
  (Array.isArray(raw) ? raw : []).forEach((item, index) => {
    const row = asRecord(item);
    const id = String(row.id || row._id || "");
    const name = String(row.name || "").trim();
    if (!id || !name) return;
    const status: ProjectStageStatus =
      row.status === "in_progress" || row.status === "completed" ? row.status : "pending";
    rows.push({
      stage: {
        id,
        name,
        section: String(row.section || ""),
        durationDays: Math.max(0, Math.floor(Number(row.durationDays) || 0)),
        durationHours: Math.max(0, Number(row.durationHours) || 0),
        status,
        startDate: isoOrUndefined(row.startDate),
        endDate: isoOrUndefined(row.endDate),
      },
      order: Number.isFinite(Number(row.order)) ? Number(row.order) : index,
    });
  });
  return rows.sort((a, b) => a.order - b.order).map((item) => item.stage);
}

/** Total time across stages. */
export function stageTotals(stages: Pick<ProjectStage, "durationDays" | "durationHours">[]) {
  return stages.reduce(
    (sum, stage) => ({ days: sum.days + (stage.durationDays || 0), hours: sum.hours + (stage.durationHours || 0) }),
    { days: 0, hours: 0 },
  );
}

/** "3 days 4 h", "6 h", "2 days" (or "—" when empty). */
export function formatStageDuration({ days, hours }: { days: number; hours: number }) {
  const parts = [];
  if (days) parts.push(`${days} day${days === 1 ? "" : "s"}`);
  if (hours) parts.push(`${Math.round(hours * 100) / 100} h`);
  return parts.join(" ") || "—";
}

export function stageStatusLabel(status: ProjectStageStatus) {
  return status === "completed" ? "Completed" : status === "in_progress" ? "In progress" : "Not started";
}

export function stageStatusTone(status: ProjectStageStatus) {
  return status === "completed"
    ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
    : status === "in_progress"
      ? "bg-sky-50 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300"
      : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300";
}

/** Share of stages completed, 0–100. */
export function stageProgress(stages: ProjectStage[]) {
  if (!stages.length) return 0;
  return Math.round((stages.filter((stage) => stage.status === "completed").length / stages.length) * 100);
}

/** "Mar 3 – Mar 5" for a scheduled stage (dates are calendar days, shown in UTC). */
export function stageDateRange(stage: Pick<ProjectStage, "startDate" | "endDate">) {
  if (!stage.startDate) return "";
  const fmt = (value: string) =>
    new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  const start = fmt(stage.startDate);
  const end = stage.endDate ? fmt(stage.endDate) : start;
  return start === end ? start : `${start} – ${end}`;
}
