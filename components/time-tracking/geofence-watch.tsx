"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { subscribeRealtime } from "@/components/realtime/realtime-provider";
import { getContractorActiveEntry, reportContractorLocation } from "@/lib/api/contractor-portal-client";
import { reportTechnicianLocation } from "@/lib/api/technician-client";
import type { DeviceLocation } from "@/lib/geolocation";
import type { LocationReport, TimeEntry } from "@/lib/time-tracking";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { contractorRefreshRequested } from "@/store/contractorPortalSlice";
import { techRefreshRequested } from "@/store/technicianSlice";
import { timeEntryReceived } from "@/store/timeTrackingSlice";

/** Report at most this often unless the device moved farther than MIN_MOVE_METERS. */
const MIN_INTERVAL_MS = 30_000;
const MIN_MOVE_METERS = 50;
/** watchPosition may stay quiet while standing still: ask for a position this often too. */
const POLL_MS = 60_000;

function metersBetween(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const rad = (deg: number) => (deg * Math.PI) / 180;
  const h =
    Math.sin(rad(b.lat - a.lat) / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.min(1, Math.sqrt(h)));
}

const awayText = (meters: number | null) =>
  meters == null ? "" : meters >= 1000 ? ` (about ${(meters / 1000).toFixed(1)} km away)` : ` (about ${meters} m away)`;

/**
 * While a session is running (not paused), watches the device position and reports it. The
 * server clocks the worker out automatically after they stay outside the 200 m site radius
 * for about a minute; this warns first, then explains the automatic clock-out.
 * Works while the portal is open: browsers don't share location from closed / background tabs.
 */
function GeofenceWatch({
  active,
  report,
  onReport,
}: {
  active: TimeEntry | null;
  report: (location: DeviceLocation) => Promise<LocationReport>;
  onReport: (result: LocationReport) => void;
}) {
  const reportRef = useRef(report);
  const onReportRef = useRef(onReport);
  useEffect(() => {
    reportRef.current = report;
    onReportRef.current = onReport;
  });

  const watching = Boolean(active && active.status === "active" && !active.pausedAt);
  const entryId = active?.id;

  useEffect(() => {
    if (!watching || typeof navigator === "undefined" || !navigator.geolocation) return;
    let last: { at: number; lat: number; lng: number } | null = null;
    let sending = false;
    let warnedOutside = false;
    let warnedOff = false;
    let stopped = false;

    async function send(position: GeolocationPosition) {
      const location: DeviceLocation = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        accuracy: position.coords.accuracy,
      };
      const now = Date.now();
      if (sending || stopped) return;
      if (last && now - last.at < MIN_INTERVAL_MS && metersBetween(last, location) < MIN_MOVE_METERS) return;
      sending = true;
      last = { at: now, lat: location.lat, lng: location.lng };
      try {
        const result = await reportRef.current(location);
        if (stopped) return;
        if (result.autoClockedOut) {
          toast.warning("You were clocked out automatically", {
            description: `You left the job site${awayText(result.distanceMeters)}. Time after you left isn't counted. Clock in again when you're back on site.`,
            duration: 15000,
          });
        } else if (result.outside && !warnedOutside) {
          warnedOutside = true;
          toast.warning("You're outside the job site", {
            description: `You're more than 200 m from the job${awayText(result.distanceMeters)}. Go back, or pause your timer — otherwise you'll be clocked out automatically in about a minute.`,
            duration: 12000,
          });
        } else if (!result.outside) {
          warnedOutside = false;
        }
        onReportRef.current(result);
      } catch {
        // Offline or a hiccup: the next position tries again.
      } finally {
        sending = false;
      }
    }

    function onError(error: GeolocationPositionError) {
      if (error.code === error.PERMISSION_DENIED && !warnedOff) {
        warnedOff = true;
        toast.error("Keep location on while clocked in", {
          description: "Your location is needed to confirm you're at the job site. Turn it back on for this site.",
          duration: 12000,
        });
      }
    }

    const options: PositionOptions = { enableHighAccuracy: true, maximumAge: 15000, timeout: 30000 };
    const watchId = navigator.geolocation.watchPosition((position) => void send(position), onError, options);
    const poll = window.setInterval(() => {
      navigator.geolocation.getCurrentPosition((position) => void send(position), onError, options);
    }, POLL_MS);
    return () => {
      stopped = true;
      navigator.geolocation.clearWatch(watchId);
      window.clearInterval(poll);
    };
  }, [watching, entryId]);

  return null;
}

/** Technician portal: watches the running timer kept in Redux. */
export function TechnicianGeofenceWatch() {
  const dispatch = useAppDispatch();
  const active = useAppSelector((state) => state.timeTracking.active);
  return (
    <GeofenceWatch
      active={active}
      report={reportTechnicianLocation}
      onReport={(result) => {
        if (result.entry) dispatch(timeEntryReceived({ entry: result.entry, technician: true }));
        if (result.autoClockedOut) dispatch(techRefreshRequested(["dashboard", "jobs", "estimates", "payments"]));
      }}
    />
  );
}

/** Contractor portal: loads its own running timer and follows clock changes from any tab. */
export function ContractorGeofenceWatch() {
  const dispatch = useAppDispatch();
  const [active, setActive] = useState<TimeEntry | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      getContractorActiveEntry()
        .then((entry) => {
          if (!cancelled) setActive(entry?.status === "active" ? entry : null);
        })
        .catch(() => undefined);
    };
    load();
    const unsubscribe = subscribeRealtime((detail) => {
      const type = String(detail?.type || "");
      if (type === "TIME_ENTRY_UPDATED" || type === "SOCKET_RECONNECTED") load();
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  return (
    <GeofenceWatch
      active={active}
      report={reportContractorLocation}
      onReport={(result) => {
        setActive(result.entry?.status === "active" ? result.entry : null);
        if (result.autoClockedOut) dispatch(contractorRefreshRequested(["jobs", "payouts", "dashboard"]));
      }}
    />
  );
}
