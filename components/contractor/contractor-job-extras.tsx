"use client";

import { useState } from "react";
import { Loader2, Play, Square } from "lucide-react";
import { toast } from "sonner";
import { LiveTimer } from "@/components/time-tracking/time-tracking-ui";
import { Button } from "@/components/ui/button";
import { contractorClockIn, contractorClockOut, type ContractorJobDetail } from "@/lib/api/contractor-portal-client";
import { formatMoney } from "@/lib/format";
import { useAppDispatch } from "@/store/hooks";
import { fetchContractorJob } from "@/store/contractorPortalSlice";

function hoursLabel(seconds: number) {
  const hours = Math.round((seconds / 3600) * 100) / 100;
  return `${hours} h`;
}

/**
 * Clock in / out on an assigned job (top of the job page). Hourly jobs are
 * paid from these sessions; the running timer is the server's entry, so it
 * survives refresh.
 */
export function ContractorClockButton({ detail, closed }: { detail: ContractorJobDetail; closed: boolean }) {
  const dispatch = useAppDispatch();
  const [busy, setBusy] = useState(false);
  const { job, activeEntry } = detail;
  const runningHere = activeEntry?.status === "active" && activeEntry.job?.id === job.id;
  const runningElsewhere = activeEntry?.status === "active" && !runningHere;

  async function toggle() {
    setBusy(true);
    try {
      if (runningHere) {
        await contractorClockOut(job.id);
        toast.success("Clocked out.");
      } else {
        await contractorClockIn(job.id);
        toast.success(`Clocked in on ${job.number}.`);
      }
      await dispatch(fetchContractorJob(job.id));
    } catch (error) {
      const message = error && typeof error === "object" && "message" in error ? String(error.message) : "";
      toast.error(message || "Could not update your time.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button
      type="button"
      onClick={() => void toggle()}
      disabled={busy || closed || runningElsewhere}
      variant={runningHere ? "destructive" : "default"}
      title={runningElsewhere ? `Clocked in on ${activeEntry?.job?.number || "another job"} — clock out there first.` : undefined}
    >
      {busy ? <Loader2 className="animate-spin" /> : runningHere ? <Square /> : <Play />}
      {runningHere && activeEntry ? (
        <>
          Clock out · <LiveTimer entry={activeEntry} />
        </>
      ) : (
        "Clock in"
      )}
    </Button>
  );
}

/** Time logged on this job (the clock button lives in the page header). */
export function ContractorTimeSummary({ detail }: { detail: ContractorJobDetail }) {
  const { job, activeEntry, timeSummary, timeEntries } = detail;
  const runningHere = activeEntry?.status === "active" && activeEntry.job?.id === job.id;
  const runningElsewhere = activeEntry?.status === "active" && !runningHere;
  return (
    <div className="flex flex-col gap-2">
      <p className="text-[10px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
        {runningHere ? "On the clock" : "Logged on this job"}
      </p>
      {runningHere && activeEntry ? (
        <LiveTimer entry={activeEntry} className="text-2xl font-semibold text-emerald-700" />
      ) : (
        <p className="text-2xl font-semibold tabular-nums">{hoursLabel(timeSummary.totalSeconds)}</p>
      )}
      {runningElsewhere ? (
        <p className="text-xs text-amber-700">
          You&apos;re clocked in on {activeEntry?.job?.number || "another job"}. Clock out there first.
        </p>
      ) : null}
      {timeEntries.length ? (
        <p className="text-xs text-muted-foreground">
          {timeSummary.sessions} session{timeSummary.sessions === 1 ? "" : "s"}
          {job.assignment.payType === "hourly" ? ` · ${formatMoney(timeSummary.totalPay)} at your job rate` : ""}
        </p>
      ) : null}
    </div>
  );
}
