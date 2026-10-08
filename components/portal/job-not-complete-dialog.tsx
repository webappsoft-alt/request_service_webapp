"use client";

import Link from "next/link";
import { Handshake, HardHat } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Job } from "@/lib/types";

export type CompletionBlocker = { kind: "technician" | "contractor"; name: string };

const DONE = ["completed", "invoiced", "paid"];

/**
 * Who still has to finish the job before it can be invoiced. Empty when the job
 * is already completed, or nobody (technician / contractor) is assigned.
 */
export function jobCompletionBlockers(job: Pick<Job, "status" | "crewContractors">, technician?: string): CompletionBlocker[] {
  if (DONE.includes(job.status)) return [];
  const blockers: CompletionBlocker[] = [];
  if (technician?.trim()) blockers.push({ kind: "technician", name: technician.trim() });
  for (const row of job.crewContractors || []) {
    blockers.push({ kind: "contractor", name: row.name || "Contractor" });
  }
  return blockers;
}

/** Shown instead of converting when field staff haven't completed the job yet. */
export function JobNotCompleteDialog({
  jobId,
  jobNumber,
  blockers,
  open,
  onOpenChange,
}: {
  jobId: string;
  jobNumber: string;
  blockers: CompletionBlocker[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const hasContractor = blockers.some((item) => item.kind === "contractor");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{jobNumber || "This job"} isn&apos;t completed yet</DialogTitle>
          <DialogDescription>
            A job can only be converted to an invoice once the work is complete. Waiting on:
          </DialogDescription>
        </DialogHeader>
        <ul className="flex flex-col gap-2">
          {blockers.map((item, index) => (
            <li
              key={`${item.kind}-${item.name}-${index}`}
              className="flex items-start gap-3 rounded-md border border-border-soft bg-muted/30 px-3 py-2"
            >
              <span
                className={
                  item.kind === "contractor"
                    ? "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-[#e7f5f1] text-[#0f7b68]"
                    : "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-[#eef3f9] text-[#003f7d]"
                }
                aria-hidden
              >
                {item.kind === "contractor" ? <Handshake className="size-3.5" /> : <HardHat className="size-3.5" />}
              </span>
              <span className="min-w-0 text-sm">
                <span className="font-semibold text-foreground">{item.name}</span>{" "}
                <span className="text-xs text-muted-foreground">({item.kind === "contractor" ? "Contractor" : "Technician"})</span>
                <span className="block text-xs text-muted-foreground">
                  {item.kind === "contractor"
                    ? "Has not completed their work yet — approve their completion proof first."
                    : "Has not completed this job yet."}
                </span>
              </span>
            </li>
          ))}
        </ul>
        <DialogFooter>
          {hasContractor ? (
            <Button variant="outline" asChild>
              <Link href={`/pro/dashboard/jobs/${jobId}?tab=requests`} onClick={() => onOpenChange(false)}>
                Review requests
              </Link>
            </Button>
          ) : null}
          <Button onClick={() => onOpenChange(false)}>OK</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
