"use client";

import { Plus, Trash2 } from "lucide-react";
import {
  jobCostKindLabel,
  lineTotal,
  useJobCosting,
  type JobCostKind,
  type JobCostLine,
} from "@/components/portal/use-job-costing";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
      return locked ? "This quote is converted. Qty and price are locked." : "Add or edit lines until this quote becomes a job.";
    case "invoice":
      return locked ? "This invoice has left draft. Qty and price are locked." : "Add or edit lines until this invoice is sent.";
    case "job":
      return locked ? "This job is invoiced. Qty and price are locked." : "Add or edit lines until the job is invoiced.";
    default: {
      const _never: never = noun;
      return _never;
    }
  }
}

export function JobCosting({
  job,
  locked = false,
  noun = "job",
  onMutate,
}: {
  job: Job;
  locked?: boolean;
  noun?: CostingNoun;
  onMutate?: (title: string, detail: string) => void;
}) {
  const { lines, mix, updateLine, addLine, removeLine } = useJobCosting(job);

  function add(kind: JobCostKind) {
    if (locked) return;
    addLine(kind);
    onMutate?.(`Added ${jobCostKindLabel(kind).toLowerCase()}`, "Line opened on the job file");
  }

  function change(id: string, patch: Partial<JobCostLine>) {
    if (locked) return;
    updateLine(id, patch);
  }

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-base font-semibold">Labor and materials</h2>
          <p className="mt-1 text-sm text-muted-foreground">{costingHint(noun, locked)}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" disabled={locked} onClick={() => add("labor")}>
            <Plus />
            Add labor
          </Button>
          <Button size="sm" disabled={locked} onClick={() => add("materials")}>
            <Plus />
            Add material
          </Button>
        </div>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Description</TableHead>
            <TableHead>Type</TableHead>
            <TableHead className="w-24">Qty</TableHead>
            <TableHead className="w-28">Price</TableHead>
            <TableHead className="text-right">Total</TableHead>
            <TableHead className="w-10">
              <span className="sr-only">Remove</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {lines.map((line) => (
            <CostRow
              key={line.id}
              line={line}
              locked={locked}
              onChange={change}
              onRemove={
                !locked
                  ? (id) => {
                      removeLine(id);
                      onMutate?.("Cost line removed", line.description || jobCostKindLabel(line.kind));
                    }
                  : undefined
              }
            />
          ))}
        </TableBody>
      </Table>
      <dl className="mt-4 ml-auto grid max-w-xs grid-cols-2 gap-y-1 text-sm">
        <dt className="text-muted-foreground">Labor</dt>
        <dd className="text-right tabular-nums">{formatMoney(mix.labor)}</dd>
        <dt className="text-muted-foreground">Materials</dt>
        <dd className="text-right tabular-nums">{formatMoney(mix.materials)}</dd>
        <dt className="font-medium">{noun === "estimate" ? "Quote total" : noun === "invoice" ? "Invoice total" : "Job total"}</dt>
        <dd className="text-right font-semibold tabular-nums">{formatMoney(mix.total)}</dd>
      </dl>
    </div>
  );
}

function CostRow({
  line,
  locked,
  onChange,
  onRemove,
}: {
  line: JobCostLine;
  locked: boolean;
  onChange: (id: string, patch: Partial<JobCostLine>) => void;
  onRemove?: (id: string) => void;
}) {
  return (
    <TableRow>
      <TableCell>
        <Input
          aria-label="Description"
          disabled={locked}
          placeholder={line.kind === "labor" ? "Additional labor" : "Additional material"}
          value={line.description}
          onChange={(event) => onChange(line.id, { description: event.target.value })}
        />
      </TableCell>
      <TableCell>
        <NativeSelect
          aria-label="Type"
          className="w-full min-w-28"
          disabled={locked}
          value={line.kind}
          onChange={(event) => onChange(line.id, { kind: event.target.value as JobCostKind })}
        >
          <NativeSelectOption value="labor">Labor</NativeSelectOption>
          <NativeSelectOption value="materials">Materials</NativeSelectOption>
        </NativeSelect>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-1.5">
          <Input
            aria-label="Quantity"
            className="tabular-nums"
            disabled={locked}
            inputMode="decimal"
            min={0}
            step="any"
            type="number"
            value={Number.isFinite(line.quantity) ? line.quantity : 0}
            onChange={(event) => onChange(line.id, { quantity: Number(event.target.value) || 0 })}
          />
          <span className="text-xs text-muted-foreground">{line.unit}</span>
        </div>
      </TableCell>
      <TableCell>
        <Input
          aria-label="Unit price"
          className="tabular-nums"
          disabled={locked}
          inputMode="decimal"
          min={0}
          placeholder="0"
          step="0.01"
          type="number"
          value={line.unitPrice ? line.unitPrice : ""}
          onChange={(event) => onChange(line.id, { unitPrice: Number(event.target.value) || 0 })}
        />
      </TableCell>
      <TableCell className="text-right font-medium tabular-nums">{formatMoney(lineTotal(line))}</TableCell>
      <TableCell>
        {onRemove ? (
          <Button
            aria-label={`Remove ${line.description || jobCostKindLabel(line.kind)}`}
            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
            size="icon-sm"
            variant="ghost"
            onClick={() => onRemove(line.id)}
          >
            <Trash2 />
          </Button>
        ) : null}
      </TableCell>
    </TableRow>
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
      <div className="flex items-baseline justify-between border-t border-black/10 pt-3">
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
    <div className="rounded-[4px] border border-black/8 bg-[#f7f9fb] px-3 py-3">
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
