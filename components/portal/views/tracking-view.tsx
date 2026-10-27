"use client";

import { useCallback, useEffect, useMemo } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Clock3, MapPin, Route, Timer, UserRound } from "lucide-react";
import { PortalPage } from "@/components/portal/portal-page";
import { usePortalWorkspace } from "@/components/portal/use-portal-workspace";
import { subscribeRealtime } from "@/components/realtime/realtime-provider";
import { WorkerStatusDot, WorkerTypeBadge, workerStatusText } from "@/components/tracking/live-team-map";
import { useLiveWorkers, useNow } from "@/components/tracking/use-live-workers";
import { WorkerPicker } from "@/components/tracking/worker-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  formatClock,
  formatDistance,
  recordHref,
  timeAgo,
  toDateKey,
  workerHref,
  type LiveWorker,
  type RoutePoint,
  type WorkerType,
} from "@/lib/tracking";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { fetchWorkerRoute, routeKey, routePointAppended, selectRoute } from "@/store/trackingSlice";

const WorkerMap = dynamic(() => import("@/components/tracking/worker-map").then((mod) => mod.WorkerMap), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-muted" />,
});

const EVENT_TEXT: Record<string, string> = {
  clock_in: "Clocked in",
  clock_out: "Clocked out",
  pause: "Paused",
  resume: "Resumed",
};

function durationText(seconds: number) {
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)} h ${minutes % 60} min`;
}

/**
 * Employee & subcontractor tracking: everyone's position for a day, or one person's route
 * (breadcrumb line, clock events, distance, sessions). Filters live in the URL, so a link from
 * an employee / contractor page opens their route directly.
 */
export function TrackingView() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const today = toDateKey(new Date());
  const dateKey = /^\d{4}-\d{2}-\d{2}$/.test(searchParams.get("date") || "") ? searchParams.get("date")! : today;
  const workerId = /^[a-f0-9]{24}$/i.test(searchParams.get("worker") || "") ? searchParams.get("worker")! : "";
  const workerType: WorkerType = searchParams.get("type") === "contractor" ? "contractor" : "technician";
  const now = useNow();
  const { provider } = usePortalWorkspace();
  const businessCenter = provider?.lat && provider?.lng ? { lat: provider.lat, lng: provider.lng } : null;

  const live = useLiveWorkers(dateKey);
  const dispatch = useAppDispatch();
  // Routes are cached per worker + day in the tracking slice: a revisit shows the last route at
  // once while a fresh copy loads in the background.
  const selectedRouteKey = routeKey(workerId, dateKey);
  const routeEntry = useAppSelector((state) => selectRoute(state, selectedRouteKey));
  const route = workerId ? routeEntry.route : null;
  const routeStatus: "idle" | "loading" | "ready" | "failed" = !workerId
    ? "idle"
    : routeEntry.loaded
      ? "ready"
      : routeEntry.error
        ? "failed"
        : "loading";

  const setParams = useCallback(
    (patch: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(patch)) {
        if (value) params.set(key, value);
        else params.delete(key);
      }
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const loadRoute = useCallback(() => {
    if (!workerId) return;
    void dispatch(fetchWorkerRoute({ workerId, dateKey }));
  }, [dispatch, workerId, dateKey]);

  useEffect(() => {
    loadRoute();
  }, [loadRoute]);

  // Today: new positions extend the route as they arrive (no refetch).
  useEffect(() => {
    if (!workerId || dateKey !== today) return;
    return subscribeRealtime((detail) => {
      if (detail?.type !== "WORKER_LOCATION_UPDATED") return;
      const payload = (detail.payload || {}) as Record<string, unknown>;
      if (String(payload.workerId || "") !== workerId) return;
      const lat = Number(payload.lat);
      const lng = Number(payload.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
      const point: RoutePoint = {
        lat,
        lng,
        accuracyMeters: Number.isFinite(Number(payload.accuracyMeters)) ? Number(payload.accuracyMeters) : null,
        source: (String(payload.source || "ping") as RoutePoint["source"]) || "ping",
        at: String(payload.at || new Date().toISOString()),
      };
      dispatch(routePointAppended({ key: routeKey(workerId, dateKey), point }));
      // Clock events change the sessions list: refresh that once.
      if (point.source !== "ping") loadRoute();
    });
  }, [workerId, dateKey, today, loadRoute, dispatch]);

  const liveSelected = useMemo(
    () => live.items.find((item) => item.workerId === workerId) || null,
    [live.items, workerId],
  );
  const events = useMemo(() => (route?.points || []).filter((point) => point.source !== "ping"), [route]);
  const firstSeen = route?.points[0]?.at;
  const lastSeen = route?.points.length ? route.points[route.points.length - 1].at : undefined;
  const workedSeconds = (route?.sessions || []).reduce(
    (sum, session) =>
      sum +
      (session.clockOutAt
        ? session.durationSeconds
        : Math.max(0, Math.floor((now - new Date(session.clockInAt).getTime()) / 1000))),
    0,
  );

  function selectWorker(worker: { id: string; participantType: WorkerType } | null) {
    setParams({ worker: worker?.id || null, type: worker ? worker.participantType : null });
  }

  const selectedName = route?.worker.name || liveSelected?.name || "";

  return (
    <PortalPage
      eyebrow="People / Tracking"
      title="Employee tracking"
      description="Where employees and subcontractors are, and the route they took each day. Positions are recorded only while someone is clocked in."
      actions={
        <Button asChild variant="outline" size="sm" className="gap-1.5">
          <Link href="/pro/dashboard/timesheets">
            <Timer className="size-3.5" />
            Timesheets
          </Link>
        </Button>
      }
    >
      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-[#94a3b8] bg-card px-4 py-3">
        <div className="w-full space-y-1 sm:w-72">
          <Label htmlFor="tracking-employee">Select employee</Label>
          <WorkerPicker
            id="tracking-employee"
            type="technician"
            placeholder="All employees"
            value={workerId && workerType === "technician" ? { id: workerId, participantType: "technician" } : null}
            valueLabel={workerType === "technician" ? selectedName : undefined}
            onChange={(worker) => selectWorker(worker)}
          />
        </div>
        <div className="w-full space-y-1 sm:w-72">
          <Label htmlFor="tracking-contractor">Select subcontractor</Label>
          <WorkerPicker
            id="tracking-contractor"
            type="contractor"
            placeholder="All subcontractors"
            value={workerId && workerType === "contractor" ? { id: workerId, participantType: "contractor" } : null}
            valueLabel={workerType === "contractor" ? selectedName : undefined}
            onChange={(worker) => selectWorker(worker)}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="tracking-date">Date</Label>
          <Input
            id="tracking-date"
            type="date"
            className="h-10 w-44"
            max={today}
            value={dateKey}
            onChange={(event) => setParams({ date: event.target.value && event.target.value !== today ? event.target.value : null })}
          />
        </div>
        {dateKey !== today ? (
          <Button variant="ghost" size="sm" className="h-10" onClick={() => setParams({ date: null })}>
            Back to today
          </Button>
        ) : null}
        {workerId ? (
          <Button variant="outline" size="sm" className="ml-auto h-10 gap-1.5" onClick={() => selectWorker(null)}>
            <ArrowLeft className="size-3.5" />
            Everyone
          </Button>
        ) : null}
      </div>

      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="relative h-[460px] overflow-hidden rounded-2xl border border-[#94a3b8] bg-card xl:h-[600px]">
          <WorkerMap
            workers={workerId ? (liveSelected && dateKey === today ? [liveSelected] : []) : live.items}
            route={workerId ? route?.points || [] : []}
            routeType={workerType}
            fallbackCenter={businessCenter}
            selectedId={workerId || null}
            onSelect={workerId ? undefined : (worker: LiveWorker) => selectWorker({ id: worker.workerId, participantType: worker.participantType })}
            now={now}
            className="h-full w-full"
          />
          {(workerId ? routeStatus === "ready" && !route?.points.length : live.status === "ready" && !live.items.length) ? (
            <div className="pointer-events-none absolute inset-0 z-[400] flex items-center justify-center p-6">
              <p className="max-w-sm rounded-lg bg-card/95 px-4 py-3 text-center text-sm text-muted-foreground shadow">
                {workerId
                  ? `No locations for ${selectedName || "this person"} on this day. Positions are recorded while they're clocked in.`
                  : "No one was clocked in on this day."}
              </p>
            </div>
          ) : null}
          {(workerId ? routeStatus === "failed" : live.status === "failed") ? (
            <div className="absolute inset-x-0 top-3 z-[400] flex justify-center">
              <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900 shadow">
                Couldn&apos;t load locations.{" "}
                <button
                  type="button"
                  className="font-semibold underline"
                  onClick={() => (workerId ? loadRoute() : live.reload())}
                >
                  Retry
                </button>
              </p>
            </div>
          ) : null}
        </div>

        <aside className="space-y-3">
          {workerId ? (
            <>
              <section className="rounded-2xl border border-[#94a3b8] bg-card px-4 py-3">
                <div className="flex items-center gap-2">
                  {liveSelected && dateKey === today ? <WorkerStatusDot worker={liveSelected} /> : null}
                  <h2 className="min-w-0 flex-1 truncate text-sm font-semibold">{selectedName || "Loading…"}</h2>
                  <Link
                    href={workerHref({ participantType: workerType, id: workerId })}
                    className="inline-flex shrink-0 items-center gap-1 text-xs text-primary hover:underline"
                  >
                    <UserRound className="size-3" />
                    Profile
                  </Link>
                </div>
                {liveSelected && dateKey === today ? (
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {workerStatusText(liveSelected)} · updated {timeAgo(liveSelected.at, now)}
                  </p>
                ) : null}
                <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-lg bg-muted/60 px-2.5 py-2">
                    <dt className="text-muted-foreground">Distance</dt>
                    <dd className="text-sm font-semibold">{route ? formatDistance(route.distanceMeters) : "—"}</dd>
                  </div>
                  <div className="rounded-lg bg-muted/60 px-2.5 py-2">
                    <dt className="text-muted-foreground">Clocked time</dt>
                    <dd className="text-sm font-semibold">{route ? durationText(workedSeconds) : "—"}</dd>
                  </div>
                  <div className="rounded-lg bg-muted/60 px-2.5 py-2">
                    <dt className="text-muted-foreground">First seen</dt>
                    <dd className="text-sm font-semibold">{formatClock(firstSeen)}</dd>
                  </div>
                  <div className="rounded-lg bg-muted/60 px-2.5 py-2">
                    <dt className="text-muted-foreground">Last seen</dt>
                    <dd className="text-sm font-semibold">{formatClock(lastSeen)}</dd>
                  </div>
                </dl>
                {route && route.totalPoints > route.points.length ? (
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    Showing {route.points.length} of {route.totalPoints} points (thinned for the map).
                  </p>
                ) : null}
              </section>

              <section className="rounded-2xl border border-[#94a3b8] bg-card px-4 py-3">
                <h3 className="flex items-center gap-1.5 text-sm font-semibold">
                  <Clock3 className="size-3.5 text-primary" />
                  Sessions
                </h3>
                {route?.sessions.length ? (
                  <ul className="mt-2 space-y-2">
                    {route.sessions.map((session) => {
                      const href = recordHref(session.record);
                      return (
                        <li key={session.id} className="rounded-lg border border-input px-2.5 py-2 text-xs">
                          <p className="font-medium">
                            {href && session.record ? (
                              <Link href={href} className="text-primary hover:underline">
                                {session.record.number || session.record.title}
                              </Link>
                            ) : (
                              "Session"
                            )}
                            {session.record?.title && session.record.number ? ` · ${session.record.title}` : ""}
                          </p>
                          <p className="text-muted-foreground">
                            {formatClock(session.clockInAt)} – {session.clockOutAt ? formatClock(session.clockOutAt) : "now"}
                            {session.clockOutAt ? ` · ${durationText(session.durationSeconds)}` : session.paused ? " · on a break" : " · running"}
                          </p>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {routeStatus === "loading" ? "Loading…" : "No sessions on this day."}
                  </p>
                )}
              </section>

              {events.length ? (
                <section className="rounded-2xl border border-[#94a3b8] bg-card px-4 py-3">
                  <h3 className="flex items-center gap-1.5 text-sm font-semibold">
                    <Route className="size-3.5 text-primary" />
                    Timeline
                  </h3>
                  <ol className="mt-2 space-y-1 text-xs">
                    {events.map((point, index) => (
                      <li key={`${point.at}-${index}`} className="flex gap-2">
                        <span className="w-16 shrink-0 tabular-nums text-muted-foreground">{formatClock(point.at)}</span>
                        <span>{EVENT_TEXT[point.source] || "Location"}</span>
                      </li>
                    ))}
                  </ol>
                </section>
              ) : null}
            </>
          ) : (
            <section className="rounded-2xl border border-[#94a3b8] bg-card">
              <div className="border-b border-input px-4 py-2.5">
                <h2 className="text-sm font-semibold">
                  {dateKey === today ? "Today" : new Date(`${dateKey}T12:00:00`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                </h2>
                <p className="text-xs text-muted-foreground">
                  {live.status === "loading" ? "Loading…" : `${live.items.length} people with locations · pick one for their route`}
                </p>
              </div>
              <ul className="max-h-[540px] divide-y divide-input overflow-y-auto">
                {live.items.map((worker) => (
                  <li key={worker.workerId}>
                    <button
                      type="button"
                      className="w-full px-4 py-2.5 text-left text-sm hover:bg-muted/50"
                      onClick={() => selectWorker({ id: worker.workerId, participantType: worker.participantType })}
                    >
                      <span className="flex items-center gap-2">
                        {dateKey === today ? <WorkerStatusDot worker={worker} /> : <MapPin className="size-3 text-muted-foreground" />}
                        <span className="min-w-0 flex-1 truncate font-medium">{worker.name}</span>
                        <WorkerTypeBadge type={worker.participantType} />
                      </span>
                      <span className="mt-0.5 block truncate pl-4 text-xs text-muted-foreground">
                        {dateKey === today ? `${workerStatusText(worker)} · ` : "Last seen "}
                        {dateKey === today ? `updated ${timeAgo(worker.at, now)}` : formatClock(worker.at)}
                        {worker.record ? ` · ${worker.record.number || worker.record.title}` : ""}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </aside>
      </div>
    </PortalPage>
  );
}
