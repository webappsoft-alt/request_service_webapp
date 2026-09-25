"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  createEmptyLine,
  LineItemsActions,
  LineItemsEditor,
} from "@/components/portal/line-items-editor";
import {
  jobCostMix,
  useJobCosting,
  type JobCostKind,
  type JobCostLine,
} from "@/components/portal/use-job-costing";
import { mergeStashedMaterialImages, clearStashedEstimateMaterialImages, readStashedEstimateMaterialImages } from "@/components/portal/line-item-images";
import { formatMoney } from "@/lib/format";
import type { Job } from "@/lib/types";
import { cn } from "@/lib/utils";

const LABOR = "#003F7D";
const MATERIALS = "#5b8fa8";
const RING = 2 * Math.PI * 54;

export function JobCostChart({ labor, materials }: { labor: number; materials: number }) {
  const total = labor + materials;
  const laborShare = total ? labor / total : 0;
  return (
    <div className="relative mx-auto size-48">
      <svg viewBox="0 0 140 140" className="size-full -rotate-90" aria-hidden>
        <circle cx="70" cy="70" r="54" fill="none" stroke="#e6ebf0" strokeWidth="16" />
        {total > 0 ? (
          <>
            <circle
              cx="70"
              cy="70"
              r="54"
              fill="none"
              stroke={MATERIALS}
              strokeWidth="16"
              strokeDasharray={`${RING * (1 - laborShare)} ${RING}`}
              strokeDashoffset={-RING * laborShare}
              strokeLinecap="butt"
            />
            <circle
              cx="70"
              cy="70"
              r="54"
              fill="none"
              stroke={LABOR}
              strokeWidth="16"
              strokeDasharray={`${RING * laborShare} ${RING}`}
              strokeLinecap="butt"
            />
          </>
        ) : null}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Total</p>
        <p className="text-lg font-semibold tabular-nums">{formatMoney(total)}</p>
      </div>
    </div>
  );
}

export type CostingNoun = "job" | "estimate" | "invoice";

function costingHint(noun: CostingNoun, locked: boolean) {
  switch (noun) {
    case "estimate":
      return locked
        ? "This quote is converted. Qty and price are locked."
        : "Line items save automatically after you fill description and quantity, or when you leave this tab.";
    case "invoice":
      return locked
        ? "This invoice has left draft. Qty and price are locked."
        : "Line items save automatically after you fill description and quantity, or when you leave this tab.";
    case "job":
      return locked
        ? "This job is invoiced. Qty and price are locked."
        : "Line items save automatically after you fill description and quantity, or when you leave this tab.";
    default: {
      const _never: never = noun;
      return _never;
    }
  }
}

function linesEqual(a: JobCostLine[], b: JobCostLine[]) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const left = a[i];
    const right = b[i];
    if (!right) return false;
    if (
      left.id !== right.id ||
      (left.description || "").trim() !== (right.description || "").trim() ||
      left.kind !== right.kind ||
      left.quantity !== right.quantity ||
      (left.unit || "") !== (right.unit || "") ||
      left.unitPrice !== right.unitPrice ||
      JSON.stringify(left.images ?? []) !== JSON.stringify(right.images ?? [])
    ) {
      return false;
    }
  }
  return true;
}

/** Line is ready to save: has description and a positive qty (price may be 0). */
function isCompleteLine(line: JobCostLine) {
  return Boolean((line.description || "").trim()) && Number(line.quantity) > 0;
}

function completeLines(lines: JobCostLine[]) {
  return lines.filter(isCompleteLine);
}

function withPreservedImages(nextLines: JobCostLine[], seedLines: JobCostLine[]) {
  return nextLines.map((line) => {
    if (line.kind !== "materials") return line;
    if (line.images?.length) return line;
    const seed =
      seedLines.find((item) => item.id === line.id) ||
      seedLines.find(
        (item) =>
          item.kind === "materials" &&
          (item.description || "").trim() === (line.description || "").trim(),
      );
    if (!seed?.images?.length) return line;
    return { ...line, images: [...seed.images] };
  });
}

export function JobCosting({
  job,
  locked = false,
  noun = "job",
  onMutate,
  onSave,
  preferApi = false,
  /** Wait for full API record before auto-saving (avoids wiping material images). */
  ready = true,
}: {
  job: Job;
  locked?: boolean;
  noun?: CostingNoun;
  onMutate?: (title: string, detail: string) => void;
  onSave?: (lines: JobCostLine[]) => void | Promise<void>;
  preferApi?: boolean;
  ready?: boolean;
}) {
  const { lines: rawLines, commit } = useJobCosting(job, { preferApi });
  const lines = useMemo(
    () => mergeStashedMaterialImages(job.id, rawLines),
    [job.id, rawLines],
  );
  const [draft, setDraft] = useState<JobCostLine[] | null>(null);
  const [saving, setSaving] = useState(false);
  const hydratedSaveRef = useRef(false);

  const pendingActionRef = useRef<(() => void) | null>(null);
  const bypassingRef = useRef(false);
  const savingRef = useRef(false);
  const activeLinesRef = useRef<JobCostLine[]>(lines);
  const linesRef = useRef(lines);
  const persistRef = useRef<(next: JobCostLine[], opts?: { silent?: boolean }) => Promise<void>>(
    async () => undefined,
  );

  const activeLines = draft ?? lines;
  const mix = useMemo(() => jobCostMix(activeLines), [activeLines]);

  // Only treat as dirty when complete (filled) lines differ from saved complete lines.
  // Empty / incomplete new rows do not trigger an API save.
  const isDirty = useMemo(() => {
    if (!draft) return false;
    return !linesEqual(completeLines(draft), completeLines(lines));
  }, [draft, lines]);

  activeLinesRef.current = activeLines;
  linesRef.current = lines;

  // When API seed gains material images, merge them into any open draft that is missing them.
  useEffect(() => {
    setDraft((current) => {
      if (!current) return current;
      let changed = false;
      const next = current.map((line) => {
        if (line.kind !== "materials") return line;
        if (line.images?.length) return line;
        const seed =
          lines.find((item) => item.id === line.id) ||
          lines.find(
            (item) =>
              item.kind === "materials" &&
              (item.description || "").trim() === (line.description || "").trim(),
          );
        if (!seed?.images?.length) return line;
        changed = true;
        return { ...line, images: [...seed.images] };
      });
      return changed ? next : current;
    });
  }, [lines]);

  const persist = useCallback(
    async (nextLines: JobCostLine[], options?: { silent?: boolean }) => {
      if (savingRef.current || !ready) return;

      const withImages = withPreservedImages(nextLines, linesRef.current);
      const savable = completeLines(withImages);
      const saved = completeLines(linesRef.current);

      // Nothing complete to save, and nothing complete to clear → skip API.
      if (!savable.length && !saved.length) {
        setDraft(withImages);
        return;
      }
      // Incomplete-only edits (empty new row) → skip API.
      if (linesEqual(savable, saved)) {
        setDraft(withImages);
        return;
      }

      savingRef.current = true;
      setSaving(true);
      try {
        commit(withImages);
        if (onSave) {
          await onSave(withImages);
        }
        // Clear draft so seed/API state becomes source of truth — breaks save loops.
        setDraft(null);
        clearStashedEstimateMaterialImages(job.id);
        onMutate?.("Cost lines updated", `${savable.length} items on file`);
        if (!options?.silent) {
          toast.success("Line items saved.");
        }
      } catch {
        // Keep draft so the user does not lose edits on failure.
      } finally {
        savingRef.current = false;
        setSaving(false);
      }
    },
    [commit, job.id, onMutate, onSave, ready],
  );

  persistRef.current = persist;

  // One-time: push stashed convert images to API after hydrate (no loop).
  useEffect(() => {
    if (!ready || locked || hydratedSaveRef.current) return;
    const stashed = readStashedEstimateMaterialImages(job.id);
    if (!stashed.length) return;
    const merged = mergeStashedMaterialImages(job.id, rawLines);
    const needsWrite = merged.some((line) => {
      if (line.kind !== "materials" || !line.images?.length) return false;
      if (!isCompleteLine(line)) return false;
      const raw =
        rawLines.find((item) => item.id === line.id) ||
        rawLines.find(
          (item) =>
            item.kind === "materials" &&
            (item.description || "").trim() === (line.description || "").trim(),
        );
      return !raw?.images?.length;
    });
    hydratedSaveRef.current = true;
    if (!needsWrite) {
      clearStashedEstimateMaterialImages(job.id);
      return;
    }
    void persistRef.current(merged, { silent: true });
  }, [ready, locked, job.id, rawLines]);

  // Debounced auto-save only when complete line items changed
  useEffect(() => {
    if (!ready || !isDirty || locked) return;
    const timer = window.setTimeout(() => {
      void persistRef.current(activeLinesRef.current, { silent: true });
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [isDirty, locked, ready]);

  // Window beforeunload when dirty
  useEffect(() => {
    if (!isDirty) return;
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
      return "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty]);

  // Auto-save when leaving the tab / navigating away
  useEffect(() => {
    if (!ready || !isDirty || locked) return;

    const handleClickCapture = (event: MouseEvent) => {
      if (bypassingRef.current || savingRef.current) return;

      const target = event.target as HTMLElement | null;
      if (!target) return;

      if (
        target.closest("[data-job-costing-form]") ||
        target.closest("[role='dialog']") ||
        target.closest("[role='listbox']") ||
        target.closest("[data-radix-popper-content-wrapper]") ||
        target.closest("[data-radix-focus-guard]") ||
        target.closest("[data-radix-portal]") ||
        target.closest("[data-sonner-toaster]") ||
        target.closest(".sonner-toast")
      ) {
        return;
      }

      const interactiveEl = target.closest(
        "button, a[href], [role='tab'], [role='button'], [data-tab-id]",
      ) as HTMLElement | null;

      if (!interactiveEl) return;

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      pendingActionRef.current = () => {
        interactiveEl.click();
      };

      void (async () => {
        await persistRef.current(activeLinesRef.current, { silent: true });
        setDraft(null);
        const action = pendingActionRef.current;
        pendingActionRef.current = null;
        if (action) {
          bypassingRef.current = true;
          setTimeout(() => {
            action();
            setTimeout(() => {
              bypassingRef.current = false;
            }, 150);
          }, 0);
        }
      })();
    };

    document.addEventListener("click", handleClickCapture, true);
    return () => {
      document.removeEventListener("click", handleClickCapture, true);
    };
  }, [isDirty, locked, ready]);

  function add(kind: JobCostKind) {
    if (locked) return;
    setDraft([...(draft ?? lines), createEmptyLine(kind)]);
  }

  function changeLines(next: JobCostLine[]) {
    if (locked) return;
    setDraft(next);
  }

  return (
    <div data-job-costing-form>
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <h2 className="text-base font-semibold">Labor and materials</h2>
          <p className="mt-1 text-sm text-muted-foreground">{costingHint(noun, locked)}</p>
          {saving ? (
            <p className="mt-1 text-xs text-muted-foreground">Saving line items…</p>
          ) : null}
        </div>
        <LineItemsActions
          locked={locked}
          saving={saving}
          onAddLabor={() => add("labor")}
          onAddMaterial={() => add("materials")}
          className="shrink-0 self-end md:self-auto"
        />
      </div>
      <LineItemsEditor
        lines={activeLines}
        onChange={changeLines}
        locked={locked}
      />
      <dl className="mt-4 ml-auto grid max-w-xs grid-cols-2 gap-y-1 text-sm">
        <dt className="text-muted-foreground">Labor</dt>
        <dd className="text-right tabular-nums">{formatMoney(mix.labor)}</dd>
        <dt className="text-muted-foreground">Materials</dt>
        <dd className="text-right tabular-nums">{formatMoney(mix.materials)}</dd>
        <dt className="font-medium">
          {noun === "estimate" ? "Quote total" : noun === "invoice" ? "Invoice total" : "Job total"}
        </dt>
        <dd className="text-right font-semibold tabular-nums">{formatMoney(mix.total)}</dd>
      </dl>
    </div>
  );
}

export function EstimateCostChart({ labor, materials }: { labor: number; materials: number }) {
  const total = labor + materials;
  const laborPct = total ? Math.round((labor / total) * 100) : 0;
  const materialPct = total ? 100 - laborPct : 0;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <EstimateMixTile label="Labor" amount={labor} percent={laborPct} color={LABOR} />
        <EstimateMixTile label="Materials" amount={materials} percent={materialPct} color={MATERIALS} />
      </div>
      <div className="flex h-2 overflow-hidden rounded-full bg-[#e6ebf0]" aria-hidden="true">
        <div className="h-full bg-[#003F7D]" style={{ width: `${laborPct}%` }} />
        <div className="h-full bg-[#5b8fa8]" style={{ width: `${materialPct}%` }} />
      </div>
      <div className="flex items-baseline justify-between border-t border-input pt-3">
        <p className="text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">Quote</p>
        <p className="text-xl font-semibold tabular-nums text-[#003F7D]">{formatMoney(total)}</p>
      </div>
    </div>
  );
}

function EstimateMixTile({
  label,
  amount,
  percent,
  color,
}: {
  label: string;
  amount: number;
  percent: number;
  color: string;
}) {
  return (
    <div className="rounded-[4px] border border-input bg-[#f7f9fb] px-3 py-3">
      <div className="flex items-center gap-2">
        <span className="size-2 shrink-0 rounded-full" style={{ background: color }} />
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
      </div>
      <p className="mt-2 text-lg font-semibold tabular-nums text-[#003F7D]">{formatMoney(amount)}</p>
      <p className="text-xs text-muted-foreground">{percent}% of quote</p>
    </div>
  );
}

export function JobCostLegend({
  labor,
  materials,
}: {
  labor: number;
  materials: number;
}) {
  const total = labor + materials;
  return (
    <ul className="w-full space-y-3 text-sm">
      <MixLegend color={LABOR} label="Labor" amount={labor} share={total ? Math.round((labor / total) * 100) : 0} />
      <MixLegend
        color={MATERIALS}
        label="Materials"
        amount={materials}
        share={total ? Math.round((materials / total) * 100) : 0}
      />
    </ul>
  );
}

function MixLegend({
  color,
  label,
  amount,
  share,
}: {
  color: string;
  label: string;
  amount: number;
  share: number;
}) {
  return (
    <li className="flex items-center justify-between gap-3">
      <span className="flex items-center gap-2">
        <span className={cn("size-2.5 rounded-full")} style={{ background: color }} />
        {label}
      </span>
      <span className="tabular-nums text-muted-foreground">
        {share}% · <span className="font-medium text-foreground">{formatMoney(amount)}</span>
      </span>
    </li>
  );
}
