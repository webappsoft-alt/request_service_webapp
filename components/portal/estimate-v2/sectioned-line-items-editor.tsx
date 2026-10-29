"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { FolderPlus, Pencil, Plus, Trash2 } from "lucide-react";
import {
  createEmptyLine,
  LineItemsEditor,
} from "@/components/portal/line-items-editor";
import {
  addEmptySectionPlaceholder,
  groupLinesBySection,
  removeSection,
  renameSection,
} from "@/components/portal/estimate-v2/line-sections";
import { type JobCostKind, type JobCostLine } from "@/components/portal/use-job-costing";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";

function sectionEditKey(groupKey: string) {
  return groupKey || "__general";
}

export function SectionedLineItemsEditor({
  lines,
  onChange,
  locked = false,
  showPricing = true,
  sectionActions,
  soft = false,
}: {
  lines: JobCostLine[];
  /** Shadowed cards with light dividers instead of the dark section borders. */
  soft?: boolean;
  onChange: (lines: JobCostLine[]) => void;
  locked?: boolean;
  /** Extra control in each section header (e.g. the stage time), shown even when locked. */
  sectionActions?: (section: { key: string; label: string }) => React.ReactNode;
  /** Price / Total columns and section totals (default true). */
  showPricing?: boolean;
}) {
  const groups = useMemo(() => groupLinesBySection(lines), [lines]);
  const [draftSection, setDraftSection] = useState("");
  /** Which section title is in rename mode (pencil → input). */
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [titleDraft, setTitleDraft] = useState("");
  const titleInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editingKey) return;
    titleInputRef.current?.focus();
    titleInputRef.current?.select();
  }, [editingKey]);

  function replaceGroupLines(sectionKey: string, nextGroupLines: JobCostLine[]) {
    const stamped = nextGroupLines.map((line) =>
      sectionKey
        ? { ...line, section: sectionKey }
        : { ...line, section: undefined },
    );
    const other = lines.filter(
      (line) => String(line.section || "").trim() !== sectionKey,
    );
    const rebuilt: JobCostLine[] = [];
    let replaced = false;
    for (const group of groups) {
      if (group.key === sectionKey) {
        rebuilt.push(...stamped);
        replaced = true;
      } else {
        rebuilt.push(...group.lines);
      }
    }
    if (!replaced) rebuilt.push(...stamped);
    const seen = new Set(rebuilt.map((line) => line.id));
    for (const line of other) {
      if (!seen.has(line.id)) rebuilt.push(line);
    }
    onChange(rebuilt);
  }

  function addLine(sectionKey: string, kind: JobCostKind) {
    const line = {
      ...createEmptyLine(kind),
      ...(sectionKey ? { section: sectionKey } : {}),
    };
    replaceGroupLines(sectionKey, [
      ...(groups.find((group) => group.key === sectionKey)?.lines || []),
      line,
    ]);
  }

  /** Section names are unique per estimate, ignoring case and extra spaces. */
  function sectionNameTaken(name: string, exceptKey?: string) {
    const wanted = name.trim().replace(/s+/g, " ").toLowerCase();
    if (!wanted) return false;
    return groups.some(
      (group) =>
        group.key !== exceptKey &&
        [group.key, group.label].some(
          (existing) => String(existing || "").trim().replace(/s+/g, " ").toLowerCase() === wanted,
        ),
    );
  }
  const draftTaken = sectionNameTaken(draftSection);

  function handleAddSection() {
    const name = draftSection.trim();
    if (!name || locked || draftTaken) return;
    onChange(addEmptySectionPlaceholder(lines, name, () => createEmptyLine("labor")));
    setDraftSection("");
  }

  function startRename(groupKey: string, label: string) {
    if (locked) return;
    setEditingKey(sectionEditKey(groupKey));
    setTitleDraft(label);
  }

  function cancelRename() {
    setEditingKey(null);
    setTitleDraft("");
  }

  function commitTitle(groupKey: string) {
    const next = titleDraft.trim() || "General";
    setEditingKey(null);
    setTitleDraft("");
    const normalizedNext = next.toLowerCase() === "general" ? "" : next;
    const normalizedCurrent = String(groupKey || "").trim();
    if (normalizedNext === normalizedCurrent) return;
    if (!normalizedCurrent && !normalizedNext) return;
    if (sectionNameTaken(next, groupKey)) {
      toast.error(`A section named "${next}" already exists.`);
      return;
    }
    onChange(renameSection(lines, groupKey, next));
  }

  return (
    <div className="space-y-4">
      {!locked ? (
        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={draftSection}
            onChange={(event) => setDraftSection(event.target.value)}
            placeholder="Section name (e.g. Plumbing)"
            className="h-9 max-w-xs"
            aria-invalid={draftTaken || undefined}
            aria-describedby={draftTaken ? "section-name-taken" : undefined}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                handleAddSection();
              }
            }}
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={!draftSection.trim() || draftTaken}
            onClick={handleAddSection}
          >
            <FolderPlus className="size-3.5" />
            Add section
          </Button>
          {draftTaken ? (
            <p id="section-name-taken" className="w-full text-xs text-destructive">
              A section with this name already exists. Use a different name.
            </p>
          ) : null}
        </div>
      ) : null}

      {groups.map((group) => {
        const key = sectionEditKey(group.key);
        const isEditing = !locked && editingKey === key;

        return (
          <div
            key={key}
            className="overflow-hidden rounded-xl border border-[#94a3b8] bg-card"
          >
            <div
              className={cn(
                "flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2",
                soft ? "border-slate-200 bg-[#f7f8fa] dark:border-border-soft dark:bg-muted/40" : "border-[#94a3b8] bg-[#f7f8fa]",
              )}
            >
              {isEditing ? (
                <Input
                  ref={titleInputRef}
                  value={titleDraft}
                  placeholder="General"
                  className="h-8 max-w-xs border-input bg-white px-2 text-sm font-semibold shadow-none"
                  onChange={(event) => setTitleDraft(event.target.value)}
                  onBlur={() => commitTitle(group.key)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      (event.target as HTMLInputElement).blur();
                    }
                    if (event.key === "Escape") {
                      event.preventDefault();
                      cancelRename();
                    }
                  }}
                  aria-label="Section name"
                />
              ) : (
                <div className="flex min-w-0 items-center gap-1.5">
                  <p className="truncate text-sm font-semibold text-slate-800">
                    {group.label}
                  </p>
                  {!locked ? (
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="size-7 shrink-0 text-slate-500 hover:text-slate-800"
                      onClick={() => startRename(group.key, group.label)}
                      aria-label={`Rename section ${group.label}`}
                    >
                      <Pencil className="size-3.5" />
                    </Button>
                  ) : null}
                </div>
              )}
              <div className="flex flex-wrap items-center gap-1.5">
                {sectionActions?.({ key: group.key, label: group.label })}
                {!locked ? (
                  <>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      onClick={() => addLine(group.key, "labor")}
                    >
                      <Plus className="size-3" />
                      Labour
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      onClick={() => addLine(group.key, "materials")}
                    >
                      <Plus className="size-3" />
                      Material
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      onClick={() => addLine(group.key, "equipment")}
                    >
                      <Plus className="size-3" />
                      Equipment
                    </Button>
                    {group.key ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs text-destructive"
                        onClick={() => onChange(removeSection(lines, group.key))}
                        aria-label={`Remove section ${group.label}`}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    ) : null}
                  </>
                ) : null}
              </div>
            </div>

            <LineItemsEditor
              lines={group.lines}
              onChange={(next) => replaceGroupLines(group.key, next)}
              locked={locked}
              showPricing={showPricing}
              className={cn(
                "rounded-none border-0",
                soft &&
                  "[&_th]:bg-white [&_tr]:border-slate-100 dark:[&_th]:bg-card dark:[&_tr]:border-border-soft",
              )}
            />

            {showPricing ? (
            <div
              className={cn(
                "flex items-center justify-between border-t px-3 py-2 text-sm",
                soft ? "border-slate-100 bg-white dark:border-border-soft dark:bg-card" : "border-[#94a3b8] bg-[#f8fafc]",
              )}
            >
              <span className="font-medium text-slate-600">
                {group.label} total
              </span>
              <span className="font-semibold tabular-nums text-slate-900">
                {formatMoney(group.total)}
              </span>
            </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
