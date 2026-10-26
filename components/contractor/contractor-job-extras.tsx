"use client";

import { useState } from "react";
import { Loader2, Pause, Play, Square } from "lucide-react";
import { toast } from "sonner";
import { LiveTimer } from "@/components/time-tracking/time-tracking-ui";
import { ContractorMapButton } from "@/components/contractor/contractor-job-actions";
import { ClockProblemDialog, type ClockProblem } from "@/components/technician/tech-ui";
import { Button } from "@/components/ui/button";
import {
  contractorClockIn,
  contractorClockOut,
  contractorPauseTimer,
  contractorResumeTimer,
  type ContractorJobDetail,
} from "@/lib/api/contractor-portal-client";
import { extractErrorMessage } from "@/components/api/extractErrorMessage";
import { getDeviceLocation, LocationError, tryDeviceLocation, type DeviceLocation } from "@/lib/geolocation";
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

  const paused = runningHere && Boolean(activeEntry?.pausedAt);
  const [problem, setProblem] = useState<ClockProblem | null>(null);

  /** The device position, or null after telling the contractor how to turn location on. */
  async function requireLocation(): Promise<DeviceLocation | null> {
    try {
      return await getDeviceLocation();
    } catch (error) {
      const issue = error instanceof LocationError ? error : null;
      setProblem({
        title: issue?.title || "Turn on location to check in/out",
        message: issue?.message || "Allow location access for this site, then try again.",
      });
      return null;
    }
  }

  async function run(action: () => Promise<unknown>, success: string, failure: string) {
    try {
      await action();
      toast.success(success);
      await dispatch(fetchContractorJob(job.id));
    } catch (error) {
      const message = extractErrorMessage(error);
      const awayFromSite = message?.startsWith("You must be at the site location");
      setProblem({
        title: awayFromSite ? "You must be at the site location to check in/out." : failure,
        message: message || "Please try again.",
      });
    }
  }

  async function toggle() {
    setBusy(true);
    try {
      if (runningHere) {
        const location = await requireLocation();
        if (!location) return;
        await run(() => contractorClockOut(job.id, "", location), "Clocked out.", "Couldn't clock out");
      } else {
        const location = await requireLocation();
        if (!location) return;
        await run(() => contractorClockIn(job.id, "", location), `Clocked in on ${job.number}.`, "Couldn't clock in");
      }
    } finally {
      setBusy(false);
    }
  }

  async function pauseOrResume() {
    setBusy(true);
    try {
      if (paused) {
        const location = await requireLocation();
        if (!location) return;
        await run(() => contractorResumeTimer(location), "Back on the clock.", "Couldn't restart your timer");
      } else {
        const location = await tryDeviceLocation();
        await run(() => contractorPauseTimer(location), "Timer paused. Paused time isn't counted.", "Couldn't pause your timer");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {runningHere ? (
        <Button type="button" variant="outline" onClick={() => void pauseOrResume()} disabled={busy}>
          {paused ? <Play /> : <Pause />}
          {paused ? "Resume" : "Pause"}
        </Button>
      ) : null}
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
            {paused ? " · paused" : ""}
          </>
        ) : (
          "Clock in"
        )}
      </Button>
      <ClockProblemDialog
        problem={problem}
        onClose={() => setProblem(null)}
        site={{ location: { address: job.site?.address, city: job.site?.city, state: job.site?.state, zip: job.site?.zip } }}
        directions={<ContractorMapButton job={job} />}
      />
    </>
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
