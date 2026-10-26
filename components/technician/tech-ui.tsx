"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2, MapPin, MapPinOff, Navigation, Pause, Play, Square } from "lucide-react";
import { toast } from "sonner";
import { useRouteMap } from "@/components/portal/route-map-provider";
import { StatusPill } from "@/components/portal/status-pill";
import { LiveTimer } from "@/components/time-tracking/time-tracking-ui";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { TechCustomer, TechLocation } from "@/lib/api/technician-client";
import { pauseTimer, resumeTimer, type ClockTarget } from "@/lib/api/technician-client";
import { extractErrorMessage } from "@/components/api/extractErrorMessage";
import { getDeviceLocation, LocationError, tryDeviceLocation, type DeviceLocation } from "@/lib/geolocation";
import {
  estimateStatusLabel,
  estimateStatusTone,
  jobStatusLabel,
  jobStatusTone,
} from "@/lib/data/portal";
import type { EstimateStatus, JobStatus } from "@/lib/types";
import { technicianPaths } from "@/lib/technician-paths";
import { cn } from "@/lib/utils";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { clockInThunk, clockOutThunk, timeEntryReceived } from "@/store/timeTrackingSlice";
import { techRefreshRequested } from "@/store/technicianSlice";

function humanize(value: string) {
  return value ? value.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase()) : "—";
}

export function JobStatusPill({ status }: { status: string }) {
  let label = humanize(status);
  let tone = "bg-muted text-foreground";
  try {
    label = jobStatusLabel(status as JobStatus) || label;
    tone = jobStatusTone(status as JobStatus) || tone;
  } catch {
    /* unknown status — keep fallback */
  }
  return <StatusPill label={label} className={tone} />;
}

export function EstimateStatusPill({ status }: { status: string }) {
  let label = humanize(status);
  let tone: string | undefined;
  try {
    label = estimateStatusLabel(status as EstimateStatus) || label;
    tone = estimateStatusTone(status as EstimateStatus) || undefined;
  } catch {
    /* unknown status — keep fallback */
  }
  return <StatusPill label={label} className={tone} />;
}

export function customerName(customer?: TechCustomer | null, snapshot?: Record<string, unknown>) {
  const source = (customer || snapshot || {}) as Record<string, unknown>;
  const company = String(source.companyName || "").trim();
  const person = `${source.firstName || ""} ${source.lastName || ""}`.trim();
  return company || person || "Customer";
}

/** Single-line address from a job location / estimate property address / customer address. */
export function addressLine(location?: TechLocation | Record<string, unknown> | null) {
  if (!location) return "";
  const row = location as Record<string, unknown>;
  const street = String(row.address || row.street || "").trim();
  const unit = String(row.unit || "").trim();
  const city = String(row.city || "").trim();
  const state = String(row.state || "").trim();
  const zip = String(row.zip || "").trim();
  const tail = [city, [state, zip].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  // Avoid repeating city/state when `address` is already a full formatted address.
  if (street && city && street.toLowerCase().includes(city.toLowerCase())) return street;
  return [street && unit ? `${street} ${unit}` : street, tail].filter(Boolean).join(", ");
}

function coordinatesOf(location?: TechLocation | Record<string, unknown> | null): [number, number] | null {
  if (!location) return null;
  const row = location as Record<string, unknown>;
  const coords = Array.isArray(row.coordinates) ? (row.coordinates as number[]) : null;
  // GeoJSON is [lng, lat]; [0, 0] is the schema default, not a real location.
  if (coords && coords.length === 2 && (coords[0] !== 0 || coords[1] !== 0)) return [coords[1], coords[0]];
  const lat = Number(row.lat ?? row.latitude);
  const lng = Number(row.lng ?? row.longitude);
  if (Number.isFinite(lat) && Number.isFinite(lng) && (lat !== 0 || lng !== 0)) return [lat, lng];
  return null;
}

/** Google Maps directions URL — opens the native maps app on phones. */
export function directionsUrl(location?: TechLocation | Record<string, unknown> | null) {
  const coords = coordinatesOf(location);
  if (coords) return `https://www.google.com/maps/dir/?api=1&destination=${coords[0]},${coords[1]}`;
  const address = addressLine(location);
  if (!address) return null;
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`;
}

export type MapRecord = { recordType?: "job" | "estimate"; recordNumber?: string; customerName?: string };

export function LocationBlock({
  location,
  compact = false,
  record,
}: {
  location?: TechLocation | Record<string, unknown> | null;
  compact?: boolean;
  /** Labels for the route map dialog. */
  record?: MapRecord;
}) {
  const line = addressLine(location);
  const url = directionsUrl(location);
  if (!line && !url) return <span className="text-sm text-muted-foreground">No address on file</span>;
  const coords = coordinatesOf(location);
  return (
    <div className={cn("flex items-start gap-2", compact && "items-center")}>
      <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
      <span className={cn("min-w-0 flex-1 text-sm", compact && "truncate")}>{line || "Pinned location"}</span>
      {url ? (
        <DirectionsButton
          url={url}
          compact={compact}
          target={{
            ...record,
            customerAddress: line,
            customerCoords: coords ? { lat: coords[0], lng: coords[1] } : null,
          }}
        />
      ) : null}
    </div>
  );
}

/**
 * Opens the project's route map dialog (business → job site); falls back to an
 * external directions link only outside a portal shell.
 */
export function DirectionsButton({
  url,
  compact = false,
  target,
}: {
  url: string;
  compact?: boolean;
  target?: MapRecord & { customerAddress: string; customerCoords?: { lat: number; lng: number } | null };
}) {
  const openMap = useRouteMap();
  if (openMap && target) {
    return (
      <Button
        type="button"
        size={compact ? "icon-sm" : "sm"}
        variant="outline"
        className={cn("shrink-0", !compact && "h-8")}
        title="View route on map"
        aria-label="View route on map"
        onClick={() => openMap(target)}
      >
        <Navigation className="size-3.5" aria-hidden />
        {compact ? null : "Directions"}
      </Button>
    );
  }
  return (
    <Button
      asChild
      size={compact ? "icon-sm" : "sm"}
      variant="outline"
      className={cn("shrink-0", !compact && "h-8")}
      title="Get directions"
    >
      <a href={url} target="_blank" rel="noopener noreferrer" aria-label="Get directions">
        <Navigation className="size-3.5" aria-hidden />
        {compact ? null : "Directions"}
      </a>
    </Button>
  );
}

/**
 * Clock In / Clock Out for a job or estimate. The running timer comes from the
 * persisted server entry (Redux `timeTracking.active`), so it survives refresh
 * and navigation and only stops when the technician clocks out.
 */
/** Where the clocked record is (for Directions in the clock problem dialog). */
export type ClockSite = { location?: TechLocation | Record<string, unknown> | null; record?: MapRecord };

export type ClockProblem = { title: string; message: string };

/**
 * Why a clock in / out (or resume) was refused, in full, with the site address and a
 * Directions button that opens the route map (or Google Maps outside a portal shell).
 */
export function ClockProblemDialog({
  problem,
  onClose,
  site,
  directions,
}: {
  problem: ClockProblem | null;
  onClose: () => void;
  site?: ClockSite;
  /** Custom Directions control (the contractor portal passes its own map button). */
  directions?: React.ReactNode;
}) {
  const openMap = useRouteMap();
  const line = addressLine(site?.location);
  const url = directionsUrl(site?.location);
  const coords = coordinatesOf(site?.location);
  return (
    <Dialog open={Boolean(problem)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPinOff className="size-5 shrink-0 text-destructive" aria-hidden />
            {problem?.title}
          </DialogTitle>
          <DialogDescription className="text-sm leading-relaxed whitespace-pre-line text-foreground/80">
            {problem?.message}
          </DialogDescription>
        </DialogHeader>
        {line ? (
          <div className="flex items-start gap-2 rounded-md border border-input bg-muted/40 px-3 py-2 text-sm">
            <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
            <span className="min-w-0">
              <span className="block text-[10px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">Site location</span>
              {line}
            </span>
          </div>
        ) : null}
        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Close
          </Button>
          {directions ? (
            // Close this dialog as the map opens.
            <div onClickCapture={onClose}>{directions}</div>
          ) : url && openMap ? (
            <Button
              type="button"
              onClick={() => {
                onClose();
                openMap({
                  ...site?.record,
                  customerAddress: line,
                  customerCoords: coords ? { lat: coords[0], lng: coords[1] } : null,
                });
              }}
            >
              <Navigation className="size-4" aria-hidden />
              Directions
            </Button>
          ) : url ? (
            <Button asChild>
              <a href={url} target="_blank" rel="noopener noreferrer">
                <Navigation className="size-4" aria-hidden />
                Directions
              </a>
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Refused for being away from the site: the toast says so plainly. */
function siteToastTitle(message: string | undefined, fallback: string) {
  return message?.startsWith("You must be at the site location") ? "You must be at the site location to check in/out." : fallback;
}

export function ClockControl({
  target,
  site,
  disabled,
  disabledReason,
  className,
}: {
  target: ClockTarget;
  /** The job / estimate site, for Directions when clocking in or out is refused. */
  site?: ClockSite;
  disabled?: boolean;
  disabledReason?: string;
  className?: string;
}) {
  const [problem, setProblem] = useState<ClockProblem | null>(null);
  const dispatch = useAppDispatch();
  const active = useAppSelector((state) => state.timeTracking.active);
  const activeLoaded = useAppSelector((state) => state.timeTracking.activeLoaded);
  const clocking = useAppSelector((state) => state.timeTracking.clocking);
  const [notes, setNotes] = useState("");
  /** Finding the device position / pausing or resuming (clock in & out use `clocking`). */
  const [busy, setBusy] = useState<"locating" | "pause" | "resume" | null>(null);

  const runningHere =
    active &&
    ((target.kind === "job" && active.job?.id === target.id) ||
      (target.kind === "estimate" && active.estimate?.id === target.id && !active.job));
  const runningElsewhere = active && !runningHere;
  const elsewhereHref = active?.job
    ? technicianPaths.job(active.job.id)
    : active?.estimate
      ? technicianPaths.estimate(active.estimate.id)
      : technicianPaths.time;

  /** The device position, or null after telling the worker how to turn location on. */
  async function requireLocation(): Promise<DeviceLocation | null> {
    setBusy("locating");
    try {
      return await getDeviceLocation();
    } catch (error) {
      const issue = error instanceof LocationError ? error : null;
      setProblem({
        title: issue?.title || "Turn on location to check in/out",
        message: issue?.message || "Allow location access for this site, then try again.",
      });
      return null;
    } finally {
      setBusy(null);
    }
  }

  async function onClockIn() {
    const location = await requireLocation();
    if (!location) return;
    const result = await dispatch(clockInThunk({ target, location }));
    if (clockInThunk.rejected.match(result)) {
      setProblem({ title: siteToastTitle(result.payload, "Couldn't clock in"), message: result.payload || "Please try again." });
      return;
    }
    toast.success("Clocked in. Your timer is running.");
    dispatch(techRefreshRequested([target.kind === "job" ? "jobs" : "estimates", "dashboard"]));
  }

  async function onPauseOrResume() {
    if (!active) return;
    const resuming = Boolean(active.pausedAt);
    const location = resuming ? await requireLocation() : await tryDeviceLocation();
    if (resuming && !location) return;
    setBusy(resuming ? "resume" : "pause");
    try {
      const entry = resuming && location ? await resumeTimer(location) : await pauseTimer(location);
      if (entry) dispatch(timeEntryReceived({ entry, technician: true }));
      toast.success(resuming ? "Back on the clock." : "Timer paused. Paused time isn't counted.");
    } catch (error) {
      const message = extractErrorMessage(error) || "Please try again.";
      setProblem({
        title: siteToastTitle(message, resuming ? "Couldn't restart your timer" : "Couldn't pause your timer"),
        message,
      });
    } finally {
      setBusy(null);
    }
  }

  async function onClockOut() {
    const location = await requireLocation();
    if (!location) return;
    const result = await dispatch(clockOutThunk({ target, notes: notes.trim() || undefined, location }));
    if (clockOutThunk.rejected.match(result)) {
      setProblem({ title: siteToastTitle(result.payload, "Couldn't clock out"), message: result.payload || "Please try again." });
      return;
    }
    setNotes("");
    toast.success("Clocked out. Time entry saved.");
    dispatch(techRefreshRequested([target.kind === "job" ? "jobs" : "estimates", "dashboard"]));
  }

  return (
    <div className={cn("rounded-md border border-input bg-card p-3", runningHere && "border-emerald-300 bg-emerald-50/60", className)}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">Time on this {target.kind}</p>
          {runningHere && active ? (
            <p
              className={cn(
                "mt-0.5 flex items-center gap-2 text-2xl font-semibold",
                active.pausedAt ? "text-amber-700" : "text-emerald-800",
              )}
            >
              <span
                className={cn("size-2 rounded-full", active.pausedAt ? "bg-amber-500" : "animate-pulse bg-emerald-600")}
                aria-hidden
              />
              <LiveTimer entry={active} />
              {active.pausedAt ? <span className="text-sm font-semibold">Paused</span> : null}
            </p>
          ) : (
            <p className="mt-0.5 text-sm text-muted-foreground">
              {runningElsewhere ? (
                <>
                  You are clocked in on{" "}
                  <Link href={elsewhereHref} className="font-semibold text-primary hover:underline">
                    {active?.job?.number || active?.estimate?.number || "another record"}
                  </Link>
                  . Clock out there first.
                </>
              ) : (
                "Not clocked in."
              )}
            </p>
          )}
        </div>
        {runningHere ? (
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="lg"
              variant="outline"
              className="h-10 min-w-28 font-semibold"
              disabled={clocking || Boolean(busy)}
              onClick={() => void onPauseOrResume()}
            >
              {busy === "pause" || busy === "resume" || (busy === "locating" && active?.pausedAt) ? (
                <Loader2 className="size-4 animate-spin" />
              ) : active?.pausedAt ? (
                <Play className="size-4" />
              ) : (
                <Pause className="size-4" />
              )}
              {active?.pausedAt ? "Resume" : "Pause"}
            </Button>
            <Button
              size="lg"
              variant="destructive"
              className="h-10 min-w-36 font-semibold"
              disabled={clocking || Boolean(busy)}
              onClick={() => void onClockOut()}
            >
              {clocking ? <Loader2 className="size-4 animate-spin" /> : <Square className="size-4" />}
              Clock Out
            </Button>
          </div>
        ) : (
          <Button
            size="lg"
            className="h-10 min-w-36 bg-emerald-600 font-semibold text-white hover:bg-emerald-700"
            disabled={clocking || Boolean(busy) || !activeLoaded || Boolean(runningElsewhere) || disabled}
            title={disabled ? disabledReason : undefined}
            onClick={() => void onClockIn()}
          >
            {clocking || busy === "locating" ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
            {busy === "locating" ? "Checking location…" : "Clock In"}
          </Button>
        )}
      </div>
      {runningHere ? (
        <input
          className="mt-2 h-8 w-full rounded-md border border-input bg-background px-2 text-sm"
          placeholder="Optional note for this session (saved on clock out)"
          value={notes}
          maxLength={1000}
          onChange={(event) => setNotes(event.target.value)}
        />
      ) : disabled && disabledReason ? (
        <p className="mt-2 text-xs text-muted-foreground">{disabledReason}</p>
      ) : !runningElsewhere ? (
        <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
          <MapPin className="size-3" aria-hidden />
          Location must be on. You can check in/out within 200 m of the job site.
        </p>
      ) : null}
      <ClockProblemDialog problem={problem} onClose={() => setProblem(null)} site={site} />
    </div>
  );
}

export function DetailCard({ title, children, action, className }: { title: string; children: React.ReactNode; action?: React.ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-md border border-input bg-card", className)}>
      <div className="flex items-center justify-between gap-2 border-b border-border-soft px-4 py-2.5">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        {action}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

export function KeyValue({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">{label}</p>
      <div className="mt-0.5 text-sm text-foreground">{value || "—"}</div>
    </div>
  );
}

export function EmptyNote({ children }: { children: React.ReactNode }) {
  return <p className="rounded-md border border-dashed border-border-soft px-4 py-6 text-center text-sm text-muted-foreground">{children}</p>;
}
