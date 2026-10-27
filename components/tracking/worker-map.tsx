"use client";

import { useMemo } from "react";
import Link from "next/link";
import { CircleMarker, Marker, Polyline, Popup, Tooltip } from "react-leaflet";
import L from "leaflet";
import { FitMapBounds, LeafletMap } from "@/components/shared/leaflet-map";
import {
  formatClock,
  recordHref,
  timeAgo,
  type LiveWorker,
  type RoutePoint,
  type WorkerType,
} from "@/lib/tracking";

/** Marker / route colour by who it is: employees blue, subcontractors orange. */
export const WORKER_COLORS: Record<WorkerType, { fill: string; dark: string; label: string }> = {
  technician: { fill: "#2563eb", dark: "#1e40af", label: "Employee" },
  contractor: { fill: "#ea580c", dark: "#9a3412", label: "Subcontractor" },
};

/** Status dot on the pin: on the clock / on a break / clocked out. */
const STATUS_COLORS = { on: "#16a34a", paused: "#f59e0b", off: "#94a3b8" };

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] || "") + (parts[1]?.[0] || "")).toUpperCase() || "?";
}

function escapeHtml(text: string) {
  return text.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);
}

/** Teardrop pin with initials, coloured by type, a status dot, and the first name underneath. */
function workerIcon(worker: LiveWorker, selected: boolean) {
  const color = WORKER_COLORS[worker.participantType] || WORKER_COLORS.technician;
  const status = !worker.clockedIn ? STATUS_COLORS.off : worker.paused ? STATUS_COLORS.paused : STATUS_COLORS.on;
  const firstName = escapeHtml(worker.name.split(/\s+/)[0] || worker.name);
  const ring = selected ? `0 0 0 3px #fff, 0 0 0 5px ${color.dark}` : "0 2px 6px rgba(15,23,42,.35)";
  const dim = worker.clockedIn ? "1" : "0.85";
  return L.divIcon({
    className: "rs-worker-marker",
    html: `
      <div style="position:relative;width:40px;height:62px;opacity:${dim}">
        <div style="position:absolute;left:2px;top:0;width:36px;height:36px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:${color.fill};border:2px solid #fff;box-shadow:${ring}"></div>
        <div style="position:absolute;left:2px;top:0;width:36px;height:36px;display:flex;align-items:center;justify-content:center;color:#fff;font:700 12px/1 system-ui,sans-serif;letter-spacing:.02em">${escapeHtml(initials(worker.name))}</div>
        <span style="position:absolute;left:28px;top:-2px;width:12px;height:12px;border-radius:9999px;background:${status};border:2px solid #fff"></span>
        <span style="position:absolute;left:50%;top:44px;transform:translateX(-50%);white-space:nowrap;padding:1px 6px;border-radius:9999px;background:#fff;color:#0f172a;font:600 10px/1.5 system-ui,sans-serif;box-shadow:0 1px 3px rgba(15,23,42,.25)">${firstName}</span>
      </div>`,
    iconSize: [40, 62],
    iconAnchor: [20, 42],
    popupAnchor: [0, -40],
    tooltipAnchor: [0, -40],
  });
}

/** Start / End flag pins for a route. */
function flagIcon(label: "Start" | "End", color: string, time: string) {
  return L.divIcon({
    className: "rs-route-flag",
    html: `
      <div style="position:relative;transform:translate(-50%,-100%);display:inline-flex;flex-direction:column;align-items:center">
        <span style="white-space:nowrap;padding:2px 8px;border-radius:9999px;background:${color};color:#fff;font:700 11px/1.4 system-ui,sans-serif;box-shadow:0 2px 6px rgba(15,23,42,.3)">${label} · ${escapeHtml(time)}</span>
        <span style="width:2px;height:10px;background:${color}"></span>
        <span style="width:10px;height:10px;border-radius:9999px;background:${color};border:2px solid #fff;box-shadow:0 1px 3px rgba(15,23,42,.35)"></span>
      </div>`,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  });
}

/** Small arrowhead pointing along the route. */
function arrowIcon(bearing: number, color: string) {
  return L.divIcon({
    className: "rs-route-arrow",
    html: `<div style="transform:translate(-50%,-50%) rotate(${bearing}deg);width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent;border-bottom:11px solid ${color};filter:drop-shadow(0 0 1px #fff)"></div>`,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  });
}

function bearingDegrees(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const rad = (deg: number) => (deg * Math.PI) / 180;
  const y = Math.sin(rad(b.lng - a.lng)) * Math.cos(rad(b.lat));
  const x =
    Math.cos(rad(a.lat)) * Math.sin(rad(b.lat)) - Math.sin(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.cos(rad(b.lng - a.lng));
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

function metersBetween(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const rad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(h));
}

/** Direction arrows at the middle of longer segments (at most ~24, evenly spread). */
function routeArrows(route: RoutePoint[]) {
  const segments: { lat: number; lng: number; bearing: number }[] = [];
  for (let i = 1; i < route.length; i += 1) {
    const a = route[i - 1];
    const b = route[i];
    if (metersBetween(a, b) < 25) continue;
    segments.push({ lat: (a.lat + b.lat) / 2, lng: (a.lng + b.lng) / 2, bearing: bearingDegrees(a, b) });
  }
  if (segments.length <= 24) return segments;
  const step = segments.length / 24;
  return Array.from({ length: 24 }, (_, index) => segments[Math.floor(index * step)]);
}

const EVENT_COLORS: Record<string, string> = {
  clock_in: "#16a34a",
  clock_out: "#dc2626",
  pause: "#f59e0b",
  resume: "#0284c7",
};

const EVENT_LABELS: Record<string, string> = {
  clock_in: "Clocked in",
  clock_out: "Clocked out",
  pause: "Paused",
  resume: "Resumed",
};

function Legend({ showRoute, routeType }: { showRoute: boolean; routeType: WorkerType }) {
  return (
    <div className="pointer-events-none absolute bottom-3 left-3 z-[400] rounded-lg bg-white/95 px-3 py-2 text-[11px] text-slate-700 shadow-md dark:bg-slate-900/95 dark:text-slate-200">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        {(Object.keys(WORKER_COLORS) as WorkerType[]).map((type) => (
          <span key={type} className="inline-flex items-center gap-1.5">
            <span className="size-2.5 rounded-full" style={{ background: WORKER_COLORS[type].fill }} />
            {WORKER_COLORS[type].label}
          </span>
        ))}
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-slate-500 dark:text-slate-400">
        <span className="inline-flex items-center gap-1">
          <span className="size-2 rounded-full" style={{ background: STATUS_COLORS.on }} /> On the clock
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="size-2 rounded-full" style={{ background: STATUS_COLORS.paused }} /> Break
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="size-2 rounded-full" style={{ background: STATUS_COLORS.off }} /> Clocked out
        </span>
      </div>
      {showRoute ? (
        <div className="mt-1 flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
          <span className="h-1 w-5 rounded-full" style={{ background: WORKER_COLORS[routeType].fill }} /> Route (arrows show direction)
        </div>
      ) : null}
    </div>
  );
}

/**
 * Leaflet map for tracking (the app's shared LeafletMap): live pins (one per person, last known
 * position) and/or one person's route for a day — the path with direction arrows, Start / End
 * flags and the clock events. Employees are blue, subcontractors orange.
 */
export function WorkerMap({
  workers = [],
  route = [],
  routeType = "technician",
  selectedId,
  onSelect,
  now,
  className,
  fallbackCenter,
}: {
  workers?: LiveWorker[];
  route?: RoutePoint[];
  /** Colours the route like that person's pin. */
  routeType?: WorkerType;
  selectedId?: string | null;
  onSelect?: (worker: LiveWorker) => void;
  /** Re-render tick for the "x mins ago" labels. */
  now: number;
  className?: string;
  /** Where to look when there are no pins or route yet (e.g. the business address). */
  fallbackCenter?: { lat: number; lng: number } | null;
}) {
  const color = WORKER_COLORS[routeType] || WORKER_COLORS.technician;
  const routeLine = useMemo(() => route.map((point) => [point.lat, point.lng] as [number, number]), [route]);
  const arrows = useMemo(() => routeArrows(route), [route]);
  const fitPoints = useMemo(
    () => (route.length ? route : workers).map((point) => ({ lat: point.lat, lng: point.lng })),
    [route, workers],
  );
  const events = useMemo(() => route.filter((point) => point.source !== "ping"), [route]);
  const start = route.length ? route[0] : null;
  const end = route.length > 1 ? route[route.length - 1] : null;
  // Start and End on the same spot: one flag says both.
  const sameSpot = start && end ? metersBetween(start, end) < 15 : false;
  const usableCenter =
    fallbackCenter && Number.isFinite(fallbackCenter.lat) && Number.isFinite(fallbackCenter.lng) &&
    !(Math.abs(fallbackCenter.lat) < 0.0001 && Math.abs(fallbackCenter.lng) < 0.0001)
      ? fallbackCenter
      : null;
  const centerLat = usableCenter?.lat;
  const centerLng = usableCenter?.lng;
  const onCenter = useMemo(
    () => (centerLat !== undefined && centerLng !== undefined ? { lat: centerLat, lng: centerLng, zoom: 12 } : undefined),
    [centerLat, centerLng],
  );

  return (
    <div className={`relative ${className || ""}`}>
      <LeafletMap
        className="h-full w-full"
        center={onCenter ? [onCenter.lat, onCenter.lng] : undefined}
        zoom={onCenter ? 12 : 4}
        scrollWheelZoom
      >
        <FitMapBounds points={fitPoints} maxZoom={17} padding={0.25} onCenter={onCenter} />

        {routeLine.length > 1 ? (
          <>
            {/* White casing under the line so it reads on any tile. */}
            <Polyline positions={routeLine} pathOptions={{ color: "#ffffff", weight: 8, opacity: 0.9 }} />
            <Polyline positions={routeLine} pathOptions={{ color: color.fill, weight: 4.5, opacity: 0.95 }} />
          </>
        ) : null}
        {route
          .filter((point) => point.source === "ping")
          .map((point, index) => (
            <CircleMarker
              key={`p${index}`}
              center={[point.lat, point.lng]}
              radius={3}
              pathOptions={{ color: color.fill, fillColor: "#ffffff", fillOpacity: 1, weight: 1.5 }}
            >
              <Tooltip direction="top">{formatClock(point.at)}</Tooltip>
            </CircleMarker>
          ))}
        {arrows.map((arrow, index) => (
          <Marker
            key={`a${index}`}
            position={[arrow.lat, arrow.lng]}
            icon={arrowIcon(arrow.bearing, color.dark)}
            interactive={false}
          />
        ))}
        {events.map((point, index) => (
          <CircleMarker
            key={`e${index}`}
            center={[point.lat, point.lng]}
            radius={7}
            pathOptions={{
              color: "#ffffff",
              fillColor: EVENT_COLORS[point.source] || color.fill,
              fillOpacity: 1,
              weight: 2,
            }}
          >
            <Tooltip direction="top">
              {EVENT_LABELS[point.source] || "Location"} · {formatClock(point.at)}
            </Tooltip>
          </CircleMarker>
        ))}
        {start ? (
          <Marker
            position={[start.lat, start.lng]}
            icon={flagIcon(
              "Start",
              "#16a34a",
              sameSpot && end ? `${formatClock(start.at)} – ${formatClock(end.at)}` : formatClock(start.at),
            )}
            zIndexOffset={500}
          />
        ) : null}
        {end && !sameSpot ? (
          <Marker position={[end.lat, end.lng]} icon={flagIcon("End", "#dc2626", formatClock(end.at))} zIndexOffset={600} />
        ) : null}

        {workers.map((worker) => {
          const href = recordHref(worker.record);
          const kind = WORKER_COLORS[worker.participantType] || WORKER_COLORS.technician;
          return (
            <Marker
              key={worker.workerId}
              position={[worker.lat, worker.lng]}
              icon={workerIcon(worker, worker.workerId === selectedId)}
              zIndexOffset={worker.workerId === selectedId ? 1000 : worker.clockedIn ? 200 : 0}
              eventHandlers={onSelect ? { click: () => onSelect(worker) } : undefined}
            >
              <Tooltip direction="top">
                {worker.name} · {timeAgo(worker.at, now)}
              </Tooltip>
              <Popup>
                <div className="min-w-48 space-y-1 text-xs">
                  <p className="flex items-center gap-1.5 text-sm font-semibold">
                    <span className="size-2.5 rounded-full" style={{ background: kind.fill }} />
                    {worker.name}
                  </p>
                  <p className="text-slate-500">
                    {kind.label}
                    {worker.trade ? ` · ${worker.trade}` : ""}
                  </p>
                  <p>
                    {!worker.clockedIn ? "Clocked out" : worker.paused ? "On a break" : "On the clock"}
                    {worker.clockedIn && worker.clockInAt ? ` since ${formatClock(worker.clockInAt)}` : ""}
                  </p>
                  {worker.record ? (
                    <p>
                      {href ? (
                        <Link href={href} className="text-[#003F7D] underline">
                          {worker.record.number || worker.record.title}
                        </Link>
                      ) : (
                        worker.record.number
                      )}
                      {worker.record.title && worker.record.number ? ` · ${worker.record.title}` : ""}
                    </p>
                  ) : null}
                  <p className="text-slate-500">Updated {timeAgo(worker.at, now)}</p>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </LeafletMap>
      <Legend showRoute={routeLine.length > 1} routeType={routeType} />
    </div>
  );
}
