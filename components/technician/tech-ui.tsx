"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2, MapPin, Navigation, Play, Square } from "lucide-react";
import { toast } from "sonner";
import { StatusPill } from "@/components/portal/status-pill";
import { LiveTimer } from "@/components/time-tracking/time-tracking-ui";
import { Button } from "@/components/ui/button";
import type { TechCustomer, TechLocation } from "@/lib/api/technician-client";
import type { ClockTarget } from "@/lib/api/technician-client";
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
import { clockInThunk, clockOutThunk } from "@/store/timeTrackingSlice";
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

export function LocationBlock({
  location,
  compact = false,
}: {
  location?: TechLocation | Record<string, unknown> | null;
  compact?: boolean;
}) {
  const line = addressLine(location);
  const url = directionsUrl(location);
  if (!line && !url) return <span className="text-sm text-muted-foreground">No address on file</span>;
  return (
    <div className={cn("flex items-start gap-2", compact && "items-center")}>
      <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
      <span className={cn("min-w-0 flex-1 text-sm", compact && "truncate")}>{line || "Pinned location"}</span>
      {url ? <DirectionsButton url={url} compact={compact} /> : null}
    </div>
  );
}

export function DirectionsButton({ url, compact = false }: { url: string; compact?: boolean }) {
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
export function ClockControl({
  target,
  disabled,
  disabledReason,
  className,
}: {
  target: ClockTarget;
  disabled?: boolean;
  disabledReason?: string;
  className?: string;
}) {
  const dispatch = useAppDispatch();
  const active = useAppSelector((state) => state.timeTracking.active);
  const activeLoaded = useAppSelector((state) => state.timeTracking.activeLoaded);
  const clocking = useAppSelector((state) => state.timeTracking.clocking);
  const [notes, setNotes] = useState("");

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

  async function onClockIn() {
    const result = await dispatch(clockInThunk({ target }));
    if (clockInThunk.rejected.match(result)) {
      toast.error(result.payload || "Could not clock in.");
      return;
    }
    toast.success("Clocked in. Your timer is running.");
    dispatch(techRefreshRequested([target.kind === "job" ? "jobs" : "estimates", "dashboard"]));
  }

  async function onClockOut() {
    const result = await dispatch(clockOutThunk({ target, notes: notes.trim() || undefined }));
    if (clockOutThunk.rejected.match(result)) {
      toast.error(result.payload || "Could not clock out.");
      return;
    }
    setNotes("");
    toast.success("Clocked out. Time entry saved.");
    dispatch(techRefreshRequested([target.kind === "job" ? "jobs" : "estimates", "dashboard"]));
  }

  return (
    <div className={cn("rounded-md border border-border-soft bg-card p-3", runningHere && "border-emerald-300 bg-emerald-50/60", className)}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">Time on this {target.kind}</p>
          {runningHere && active ? (
            <p className="mt-0.5 flex items-center gap-2 text-2xl font-semibold text-emerald-800">
              <span className="size-2 animate-pulse rounded-full bg-emerald-600" aria-hidden />
              <LiveTimer entry={active} />
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
          <Button
            size="lg"
            variant="destructive"
            className="h-10 min-w-36 font-semibold"
            disabled={clocking}
            onClick={() => void onClockOut()}
          >
            {clocking ? <Loader2 className="size-4 animate-spin" /> : <Square className="size-4" />}
            Clock Out
          </Button>
        ) : (
          <Button
            size="lg"
            className="h-10 min-w-36 bg-emerald-600 font-semibold text-white hover:bg-emerald-700"
            disabled={clocking || !activeLoaded || Boolean(runningElsewhere) || disabled}
            title={disabled ? disabledReason : undefined}
            onClick={() => void onClockIn()}
          >
            {clocking ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
            Clock In
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
      ) : null}
    </div>
  );
}

export function DetailCard({ title, children, action, className }: { title: string; children: React.ReactNode; action?: React.ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-md border border-border-soft bg-card", className)}>
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
