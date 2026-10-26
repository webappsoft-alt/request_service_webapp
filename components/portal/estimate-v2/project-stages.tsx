"use client";

import { useEffect, useState } from "react";
import { CalendarRange, Clock3, Layers, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { extractErrorMessage } from "@/components/api/extractErrorMessage";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { saveEstimateStages, scheduleEstimateStages } from "@/lib/api/crm-client";
import {
  formatStageDuration,
  stageDateRange,
  stageProgress,
  stageStatusLabel,
  stageTotals,
  type ProjectStage,
  type ProjectStageStatus,
} from "@/lib/project-stages";
import { cn } from "@/lib/utils";

type DraftStage = {
  key: string;
  id?: string;
  name: string;
  section: string;
  durationDays: string;
  durationHours: string;
  status: ProjectStageStatus;
};

let draftCounter = 0;
const draftKey = () => `stage-${(draftCounter += 1)}`;

function toDraft(stage: ProjectStage): DraftStage {
  return {
    key: stage.id,
    id: stage.id,
    name: stage.name,
    section: stage.section,
    durationDays: stage.durationDays ? String(stage.durationDays) : "",
    durationHours: stage.durationHours ? String(stage.durationHours) : "",
    status: stage.status,
  };
}

/** One stage per named line section (e.g. Removal, Installation, Cleanup). */
function draftsFromSections(sections: string[]): DraftStage[] {
  return sections.map((section) => ({
    key: draftKey(),
    name: section || "General",
    section,
    durationDays: "",
    durationHours: "",
    status: "pending" as const,
  }));
}

function todayIso() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

/**
 * Set up a project's stages: a duration (days / hours) and progress for each, the total, and
 * optionally put every stage on the Schedule as its own entry ("EST-703 · Removal").
 */
export function ProjectStagesDialog({
  open,
  onOpenChange,
  estimateId,
  estimateNumber,
  stages,
  sections,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  estimateId: string;
  estimateNumber: string;
  stages: ProjectStage[];
  /** Line sections on the estimate, in order ("" = General). */
  sections: string[];
  onSaved: (stages: ProjectStage[]) => void;
}) {
  const [drafts, setDrafts] = useState<DraftStage[]>([]);
  const [schedule, setSchedule] = useState(true);
  const [startDate, setStartDate] = useState(todayIso());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDrafts(stages.length ? stages.map(toDraft) : draftsFromSections(sections.length ? sections : [""]));
    setStartDate(stages.find((stage) => stage.startDate)?.startDate?.slice(0, 10) || todayIso());
    setSchedule(true);
    setSaving(false);
  }, [open, sections, stages]);

  const totals = stageTotals(
    drafts.map((draft) => ({ durationDays: Number(draft.durationDays) || 0, durationHours: Number(draft.durationHours) || 0 })),
  );
  const patch = (key: string, next: Partial<DraftStage>) =>
    setDrafts((prev) => prev.map((draft) => (draft.key === key ? { ...draft, ...next } : draft)));
  const missingTime = drafts.some((draft) => !(Number(draft.durationDays) > 0) && !(Number(draft.durationHours) > 0));

  async function save() {
    if (saving) return;
    if (!drafts.length) {
      toast.error("Add at least one stage.");
      return;
    }
    if (drafts.some((draft) => !draft.name.trim())) {
      toast.error("Give every stage a name.");
      return;
    }
    if (schedule && missingTime) {
      toast.error("Give every stage some days or hours before scheduling.");
      return;
    }
    setSaving(true);
    try {
      let saved = await saveEstimateStages(
        estimateId,
        drafts.map((draft) => ({
          id: draft.id,
          name: draft.name.trim(),
          section: draft.section,
          durationDays: Math.max(0, Math.floor(Number(draft.durationDays) || 0)),
          durationHours: Math.max(0, Math.min(24, Number(draft.durationHours) || 0)),
          status: draft.status,
        })),
      );
      if (schedule) saved = await scheduleEstimateStages(estimateId, { startDate });
      onSaved(saved);
      toast.success(
        schedule
          ? `${saved.length} stage${saved.length === 1 ? "" : "s"} on the schedule as "${estimateNumber} · …".`
          : "Project stages saved.",
      );
      onOpenChange(false);
    } catch (error) {
      toast.error("Couldn't save the stages", { description: extractErrorMessage(error) || "Please try again." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !saving && onOpenChange(next)}>
      <DialogContent className="sm:max-w-2xl" data-lenis-prevent>
        <DialogHeader>
          <DialogTitle>Project stages · {estimateNumber}</DialogTitle>
          <DialogDescription>
            Break a larger job into stages, each with its own time. Each stage goes on the Schedule as its own entry,
            and the customer sees the stages and their progress.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[50vh] space-y-2 overflow-y-auto pr-1">
          <div className="hidden grid-cols-[minmax(0,1fr)_80px_80px_140px_32px] gap-2 px-1 text-[10px] font-semibold tracking-[0.12em] text-muted-foreground uppercase sm:grid">
            <span>Stage</span>
            <span>Days</span>
            <span>Hours</span>
            <span>Progress</span>
            <span />
          </div>
          {drafts.map((draft, index) => (
            <div
              key={draft.key}
              className="grid grid-cols-2 gap-2 rounded-md border border-input p-2 sm:grid-cols-[minmax(0,1fr)_80px_80px_140px_32px] sm:border-0 sm:p-0"
            >
              <Input
                className="col-span-2 sm:col-span-1"
                value={draft.name}
                aria-label={`Stage ${index + 1} name`}
                placeholder={`Stage ${index + 1} (e.g. Removal)`}
                onChange={(event) => patch(draft.key, { name: event.target.value })}
              />
              <Input
                type="number"
                min={0}
                max={365}
                inputMode="numeric"
                aria-label={`${draft.name || `Stage ${index + 1}`} days`}
                placeholder="0"
                value={draft.durationDays}
                onChange={(event) => patch(draft.key, { durationDays: event.target.value })}
              />
              <Input
                type="number"
                min={0}
                max={24}
                step={0.5}
                inputMode="decimal"
                aria-label={`${draft.name || `Stage ${index + 1}`} hours`}
                placeholder="0"
                value={draft.durationHours}
                onChange={(event) => patch(draft.key, { durationHours: event.target.value })}
              />
              <Select value={draft.status} onValueChange={(value) => patch(draft.key, { status: value as ProjectStageStatus })}>
                <SelectTrigger className="w-full" aria-label={`${draft.name || `Stage ${index + 1}`} progress`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Not started</SelectItem>
                  <SelectItem value="in_progress">In progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="size-9 text-muted-foreground hover:text-destructive"
                aria-label={`Remove ${draft.name || `stage ${index + 1}`}`}
                onClick={() => setDrafts((prev) => prev.filter((item) => item.key !== draft.key))}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
          <div className="flex flex-wrap gap-2 pt-1">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() =>
                setDrafts((prev) => [
                  ...prev,
                  { key: draftKey(), name: "", section: "", durationDays: "", durationHours: "", status: "pending" },
                ])
              }
            >
              <Plus className="size-3.5" />
              Add stage
            </Button>
            {sections.length ? (
              <Button type="button" size="sm" variant="ghost" onClick={() => setDrafts(draftsFromSections(sections))}>
                Use the line sections
              </Button>
            ) : null}
          </div>
        </div>

        <div className="space-y-3 rounded-md border border-input bg-muted/40 p-3">
          <p className="text-sm">
            Total project time: <span className="font-semibold">{formatStageDuration(totals)}</span>
            <span className="text-muted-foreground"> across {drafts.length} stage{drafts.length === 1 ? "" : "s"}</span>
          </p>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={schedule} onCheckedChange={(value) => setSchedule(value === true)} />
            Put the stages on the Schedule, one after another
          </label>
          {schedule ? (
            <div className="flex flex-wrap items-center gap-2">
              <Label htmlFor="stages-start" className="text-xs text-muted-foreground">
                First stage starts
              </Label>
              <Input
                id="stages-start"
                type="date"
                className="h-8 w-44"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
              />
              <span className="text-xs text-muted-foreground">Stages with only hours are booked from 9 AM.</span>
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={() => void save()} disabled={saving || !drafts.length || (schedule && !startDate)}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : null}
            {schedule ? "Save & schedule" : "Save stages"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type StageInput = Parameters<typeof saveEstimateStages>[1][number];

const toInput = (stage: ProjectStage): StageInput => ({
  id: stage.id,
  name: stage.name,
  section: stage.section,
  durationDays: stage.durationDays,
  durationHours: stage.durationHours,
  status: stage.status,
});

/**
 * Time for one line section (its project stage), in the section header: days, hours and
 * progress, set section by section. Stages follow the section order on the estimate.
 */
export function SectionStageButton({
  estimateId,
  section,
  label,
  stages,
  sections,
  onSaved,
}: {
  estimateId: string;
  /** Section key ("" = General). */
  section: string;
  label: string;
  stages: ProjectStage[];
  /** All line sections in order, so the stages keep the same order. */
  sections: string[];
  onSaved: (stages: ProjectStage[]) => void;
}) {
  const stage = stages.find((item) => item.section === section) || null;
  const [open, setOpen] = useState(false);
  const [days, setDays] = useState("");
  const [hours, setHours] = useState("");
  const [status, setStatus] = useState<ProjectStageStatus>("pending");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDays(stage?.durationDays ? String(stage.durationDays) : "");
    setHours(stage?.durationHours ? String(stage.durationHours) : "");
    setStatus(stage?.status || "pending");
  }, [open, stage]);

  /** Save this section's stage (null = remove it) together with the others, in section order. */
  async function save(mine: StageInput | null) {
    if (saving) return;
    setSaving(true);
    try {
      const others = stages.filter((item) => item.section !== section);
      const ordered: StageInput[] = [];
      for (const key of sections) {
        if (key === section) {
          if (mine) ordered.push(mine);
        } else {
          const other = others.find((item) => item.section === key);
          if (other) ordered.push(toInput(other));
        }
      }
      // Stages whose section was renamed or removed keep their place at the end.
      for (const other of others) if (!sections.includes(other.section)) ordered.push(toInput(other));
      onSaved(await saveEstimateStages(estimateId, ordered));
      toast.success(mine ? `Time saved for ${label}.` : `${label} is no longer a separate stage.`);
      setOpen(false);
    } catch (error) {
      toast.error("Couldn't save the time", { description: extractErrorMessage(error) || "Please try again." });
    } finally {
      setSaving(false);
    }
  }

  const dayCount = Math.max(0, Math.floor(Number(days) || 0));
  const hourCount = Math.max(0, Math.min(24, Number(hours) || 0));

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className={cn("h-7 gap-1 text-xs", stage && "border-primary/40 text-primary")}
        title={stage ? `${label}: ${stageStatusLabel(stage.status)}` : `Set the time for ${label}`}
        onClick={() => setOpen(true)}
      >
        <Clock3 className="size-3" />
        {stage ? formatStageDuration({ days: stage.durationDays, hours: stage.durationHours }) : "Set time"}
        {stage ? (
          <span
            className={cn(
              "size-1.5 rounded-full",
              stage.status === "completed" ? "bg-emerald-500" : stage.status === "in_progress" ? "bg-sky-500" : "bg-slate-300",
            )}
            aria-hidden
          />
        ) : null}
      </Button>
      <Dialog open={open} onOpenChange={(next) => !saving && setOpen(next)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Time for {label}</DialogTitle>
            <DialogDescription>
              How long this part of the project takes. Each section with a time is its own stage on the Schedule and in
              the customer&apos;s timeline.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor={`stage-days-${section || "general"}`}>Days</Label>
              <Input
                id={`stage-days-${section || "general"}`}
                type="number"
                min={0}
                max={365}
                inputMode="numeric"
                placeholder="0"
                value={days}
                onChange={(event) => setDays(event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`stage-hours-${section || "general"}`}>Hours</Label>
              <Input
                id={`stage-hours-${section || "general"}`}
                type="number"
                min={0}
                max={24}
                step={0.5}
                inputMode="decimal"
                placeholder="0"
                value={hours}
                onChange={(event) => setHours(event.target.value)}
              />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>Progress</Label>
              <Select value={status} onValueChange={(value) => setStatus(value as ProjectStageStatus)}>
                <SelectTrigger className="w-full" aria-label={`${label} progress`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Not started</SelectItem>
                  <SelectItem value="in_progress">In progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-input bg-muted/40 px-3 py-2 text-sm">
            <span className="text-muted-foreground">Stage time</span>
            <span className="font-semibold">
              {dayCount || hourCount ? formatStageDuration({ days: dayCount, hours: hourCount }) : "Enter days or hours"}
            </span>
          </div>
          {stage?.startDate ? (
            <p className="text-xs text-muted-foreground">On the Schedule: {stageDateRange(stage)}</p>
          ) : null}
          <DialogFooter className="gap-2">
            {stage ? (
              <Button
                type="button"
                variant="ghost"
                className="text-destructive sm:mr-auto"
                disabled={saving}
                onClick={() => void save(null)}
              >
                Remove time
              </Button>
            ) : null}
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button
              disabled={saving || (!dayCount && !hourCount)}
              onClick={() =>
                void save({
                  id: stage?.id,
                  name: label,
                  section,
                  durationDays: dayCount,
                  durationHours: hourCount,
                  status,
                })
              }
            >
              {saving ? <Loader2 className="size-4 animate-spin" /> : null}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** In the Estimate summary: total project time across the stages, progress, and Schedule. */
export function ProjectStagesSummary({ stages, onSchedule }: { stages: ProjectStage[]; onSchedule: () => void }) {
  const scheduled = stages.some((stage) => stage.startDate);
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#b4becc] px-4 py-2.5 text-sm">
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <Layers className="size-4 text-primary" aria-hidden />
        <span>
          Project time <span className="font-semibold">{formatStageDuration(stageTotals(stages))}</span>
        </span>
        <span className="text-slate-500">
          · {stages.length} stage{stages.length === 1 ? "" : "s"} ({stages.map((stage) => stage.name).join(", ")}) ·{" "}
          {stageProgress(stages)}% complete
        </span>
      </p>
      <Button size="sm" variant="outline" className="h-7 gap-1.5 text-xs" onClick={onSchedule}>
        <CalendarRange className="size-3.5" />
        {scheduled ? "Reschedule stages" : "Schedule stages"}
      </Button>
    </div>
  );
}

/**
 * Asks once per estimate, when it looks like a longer project (several line sections), whether
 * to set up stages and schedule days.
 */
export function ProjectStagesPrompt({
  estimateId,
  sectionCount,
  hasStages,
  onSetUp,
}: {
  estimateId: string;
  sectionCount: number;
  hasStages: boolean;
  onSetUp: () => void;
}) {
  const [open, setOpen] = useState(false);
  const storageKey = `rs-stage-prompt:${estimateId}`;

  useEffect(() => {
    if (!estimateId || hasStages || sectionCount < 2) return;
    let dismissed = false;
    try {
      dismissed = window.localStorage.getItem(storageKey) === "1";
    } catch {
      dismissed = false;
    }
    if (!dismissed) setOpen(true);
  }, [estimateId, hasStages, sectionCount, storageKey]);

  const remember = () => {
    try {
      window.localStorage.setItem(storageKey, "1");
    } catch {
      // Private mode: it may ask again next time.
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) remember();
        setOpen(next);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Is this a multi-day project?</DialogTitle>
          <DialogDescription>
            This estimate has {sectionCount} sections. You can set each one up as a stage with its own days or hours —
            each stage gets its own Schedule entry, and the customer can follow the progress.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              remember();
              setOpen(false);
            }}
          >
            Not now
          </Button>
          <Button
            onClick={() => {
              remember();
              setOpen(false);
              onSetUp();
            }}
          >
            Set up stages
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
