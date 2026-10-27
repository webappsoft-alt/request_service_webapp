/**
 * Employee / subcontractor location tracking (live map + daily route) and the people picker.
 * Positions exist only while someone is on the clock.
 */

import { getData } from "@/components/api/apiFuntions";
import { providerCrmApi } from "@/components/api/ApiRoutesFile";

export type WorkerType = "technician" | "contractor";

export type TrackedRecord = { kind: "job" | "estimate"; id: string; number: string; title: string };

export type LiveWorker = {
  workerId: string;
  participantType: WorkerType;
  name: string;
  role: string;
  trade: string;
  lat: number;
  lng: number;
  accuracyMeters: number | null;
  source: string;
  at: string;
  clockedIn: boolean;
  paused: boolean;
  clockInAt: string | null;
  record: TrackedRecord | null;
};

export type RoutePoint = {
  lat: number;
  lng: number;
  accuracyMeters: number | null;
  source: "ping" | "clock_in" | "pause" | "resume" | "clock_out";
  at: string;
};

export type RouteSession = {
  id: string;
  status: string;
  paused: boolean;
  clockInAt: string;
  clockOutAt: string | null;
  durationSeconds: number;
  record: TrackedRecord | null;
};

export type WorkerRoute = {
  worker: { workerId: string; name: string; role: string; trade: string };
  distanceMeters: number;
  totalPoints: number;
  points: RoutePoint[];
  sessions: RouteSession[];
};

export type WorkerOption = {
  id: string;
  participantType: WorkerType;
  name: string;
  detail: string;
  trade: string;
  active: boolean;
};

export type WorkerPage = { items: WorkerOption[]; page: number; hasMore: boolean };

function dataOf<T>(response: unknown): T {
  const root = (response || {}) as Record<string, unknown>;
  return (root.data ?? root) as T;
}

const quiet = { silent: true, force: true } as const;

/** "2026-10-27" for a Date, in the browser's time zone. */
export function toDateKey(date: Date) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** The local calendar day "YYYY-MM-DD" as an ISO window (what the API filters on). */
export function dayWindow(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const from = new Date(year, (month || 1) - 1, day || 1, 0, 0, 0, 0);
  const to = new Date(year, (month || 1) - 1, day || 1, 23, 59, 59, 999);
  return { from: from.toISOString(), to: to.toISOString() };
}

/** "just now", "2 mins ago", "3 h ago", or a date for older. */
export function timeAgo(value: string | Date, now = Date.now()) {
  const at = new Date(value).getTime();
  if (!Number.isFinite(at)) return "";
  const seconds = Math.max(0, Math.round((now - at) / 1000));
  if (seconds < 45) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ${minutes % 60 ? `${minutes % 60} min ` : ""}ago`;
  return new Date(at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export function formatClock(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

export function formatDistance(meters: number) {
  if (!meters) return "0 m";
  return meters >= 1000 ? `${(meters / 1000).toFixed(1)} km` : `${Math.round(meters)} m`;
}

export function recordHref(record: TrackedRecord | null) {
  if (!record) return null;
  return record.kind === "job" ? `/pro/dashboard/jobs/${record.id}` : `/pro/dashboard/estimates/${record.id}`;
}

export function workerHref(worker: { participantType: WorkerType; workerId?: string; id?: string }) {
  const id = worker.workerId || worker.id || "";
  return worker.participantType === "contractor" ? `/pro/dashboard/contractors/${id}` : `/pro/dashboard/team/${id}`;
}

export function trackingHref(worker?: { id: string; participantType: WorkerType } | null, dateKey?: string) {
  const params = new URLSearchParams();
  if (worker) {
    params.set("worker", worker.id);
    params.set("type", worker.participantType);
  }
  if (dateKey) params.set("date", dateKey);
  const qs = params.toString();
  return `/pro/dashboard/tracking${qs ? `?${qs}` : ""}`;
}

export async function getLiveLocations(window: { from: string; to: string }) {
  const data = dataOf<{ items?: LiveWorker[] }>(await getData(providerCrmApi.trackingLive, window, quiet));
  return Array.isArray(data.items) ? data.items : [];
}

export async function getWorkerRoute(workerId: string, window: { from: string; to: string }) {
  return dataOf<WorkerRoute>(await getData(providerCrmApi.trackingHistory, { workerId, ...window }, quiet));
}

export async function listWorkers(query: { q?: string; type?: "all" | WorkerType; page?: number; limit?: number }) {
  const data = dataOf<{ items?: WorkerOption[]; page?: number; hasMore?: boolean }>(
    await getData(
      providerCrmApi.trackingWorkers,
      { q: query.q || undefined, type: query.type || "all", page: query.page || 1, limit: query.limit || 20 },
      { silent: true },
    ),
  );
  return {
    items: Array.isArray(data.items) ? data.items : [],
    page: data.page || query.page || 1,
    hasMore: Boolean(data.hasMore),
  } satisfies WorkerPage;
}

/** A socket WORKER_LOCATION_UPDATED payload applied to the live list. */
export function applyLocationUpdate(items: LiveWorker[], payload: Record<string, unknown>): LiveWorker[] | null {
  const workerId = String(payload.workerId || "");
  const lat = Number(payload.lat);
  const lng = Number(payload.lng);
  if (!workerId || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const index = items.findIndex((item) => item.workerId === workerId);
  if (index < 0) return null; // someone new: the caller refetches for their name
  const next = items.slice();
  next[index] = {
    ...items[index],
    lat,
    lng,
    accuracyMeters: Number.isFinite(Number(payload.accuracyMeters)) ? Number(payload.accuracyMeters) : null,
    source: String(payload.source || "ping"),
    at: String(payload.at || new Date().toISOString()),
    clockedIn: payload.clockedIn !== false,
    paused: Boolean(payload.paused),
  };
  return next;
}
