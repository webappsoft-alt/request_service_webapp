"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { MapPinned, Route, Users } from "lucide-react";
import { usePortalWorkspace } from "@/components/portal/use-portal-workspace";
import { useLiveWorkers, useNow } from "@/components/tracking/use-live-workers";
import { Button } from "@/components/ui/button";
import {
  listWorkers,
  recordHref,
  timeAgo,
  trackingHref,
  type LiveWorker,
  type WorkerOption,
} from "@/lib/tracking";
import { cn } from "@/lib/utils";

const WorkerMap = dynamic(
  () => import("@/components/tracking/worker-map").then((mod) => mod.WorkerMap),
  {
    ssr: false,
    loading: () => <div className="h-full w-full animate-pulse bg-muted" />,
  },
);

export function WorkerStatusDot({
  worker,
}: {
  worker: Pick<LiveWorker, "clockedIn" | "paused">;
}) {
  return (
    <span
      className={cn(
        "inline-block size-2 shrink-0 rounded-full",
        !worker.clockedIn
          ? "bg-slate-400"
          : worker.paused
            ? "bg-amber-500"
            : "bg-emerald-500",
      )}
      aria-hidden
    />
  );
}

/** "Employee" (blue) / "Subcontractor" (orange) — same colours as the map pins. */
export function WorkerTypeBadge({
  type,
}: {
  type: LiveWorker["participantType"];
}) {
  return (
    <span
      className={cn(
        "shrink-0 rounded-full px-1.5 py-px text-[10px] font-medium",
        type === "contractor"
          ? "bg-orange-50 text-orange-700 dark:bg-orange-950/60 dark:text-orange-300"
          : "bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300",
      )}
    >
      {type === "contractor" ? "Subcontractor" : "Employee"}
    </span>
  );
}

export function workerStatusText(
  worker: Pick<LiveWorker, "clockedIn" | "paused">,
) {
  return !worker.clockedIn
    ? "Clocked out"
    : worker.paused
      ? "On a break"
      : "On the clock";
}

/** Pro dashboard: where employees and subcontractors are today (live while they're on the clock). */
export function LiveTeamMap() {
  const { items, status } = useLiveWorkers();
  const now = useNow();
  const { provider } = usePortalWorkspace();
  const onClock = items.filter((worker) => worker.clockedIn).length;
  const businessCenter =
    provider?.lat && provider?.lng
      ? { lat: provider.lat, lng: provider.lng }
      : null;

  // Nobody seen today: list the team instead (one small request), so the panel isn't empty.
  const [roster, setRoster] = useState<{
    items: WorkerOption[];
    hasMore: boolean;
  } | null>(null);
  const showRoster = status === "ready" && !items.length;
  useEffect(() => {
    if (!showRoster || roster) return;
    let cancelled = false;
    listWorkers({ type: "all", page: 1, limit: 8 })
      .then((page) => {
        if (!cancelled) setRoster({ items: page.items, hasMore: page.hasMore });
      })
      .catch(() => {
        if (!cancelled) setRoster({ items: [], hasMore: false });
      });
    return () => {
      cancelled = true;
    };
  }, [showRoster, roster]);

  return (
    <section className="overflow-hidden rounded-2xl border border-[#94a3b8] bg-card">
      <div className="flex flex-wrap items-center gap-3 border-b border-input px-4 py-3">
        <MapPinned className="size-4 text-primary" aria-hidden />
        <div className="min-w-0">
          <h2 className="text-sm font-semibold">Team locations today</h2>
          <p className="text-xs text-muted-foreground">
            {status === "loading"
              ? "Loading…"
              : `${onClock} on the clock · ${items.length} seen today · positions are shared only while clocked in`}
          </p>
        </div>
        <Button
          asChild
          size="sm"
          variant="outline"
          className="ml-auto h-8 gap-1.5"
        >
          <Link href="/pro/dashboard/tracking">
            <Route className="size-3.5" />
            Tracking & history
          </Link>
        </Button>
      </div>

      <div className="grid lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="relative h-[320px] lg:h-[360px]">
          <WorkerMap
            workers={items}
            now={now}
            className="h-full w-full"
            fallbackCenter={businessCenter}
          />
          {status !== "loading" && !items.length ? (
            <div className="pointer-events-none absolute inset-0 z-[400] flex items-center justify-center p-6">
              <p className="rounded-lg bg-card/95 px-4 py-3 text-center text-sm text-muted-foreground shadow">
                {status === "failed"
                  ? "Couldn't load team locations. It retries when you come back to this tab."
                  : "No one has clocked in today yet. Markers appear here when your team starts work."}
              </p>
            </div>
          ) : null}
        </div>
        {showRoster ? (
          <div className="flex max-h-[360px] flex-col border-t border-input lg:border-t-0 lg:border-l">
            <div className="flex items-center gap-2 border-b border-input px-4 py-2.5">
              <Users className="size-3.5 text-muted-foreground" aria-hidden />
              <p className="text-xs font-semibold">Your team</p>
              <span className="ml-auto text-[11px] text-muted-foreground">
                Not clocked in today
              </span>
            </div>
            <ul className="flex-1 divide-y divide-input overflow-y-auto">
              {!roster ? (
                [0, 1, 2, 3].map((row) => (
                  <li key={row} className="flex items-center gap-2 px-4 py-3">
                    <span className="size-2 rounded-full bg-muted" />
                    <span className="h-3 flex-1 animate-pulse rounded bg-muted" />
                  </li>
                ))
              ) : roster.items.length ? (
                roster.items.map((worker) => (
                  <li
                    key={worker.id}
                    className="flex items-center gap-2 px-4 py-2.5 text-sm"
                  >
                    <WorkerStatusDot
                      worker={{ clockedIn: false, paused: false }}
                    />
                    <span className="min-w-0 flex-1 truncate">
                      {worker.name}
                    </span>
                    <WorkerTypeBadge type={worker.participantType} />
                    <Link
                      href={trackingHref({
                        id: worker.id,
                        participantType: worker.participantType,
                      })}
                      className="shrink-0 text-xs text-primary hover:underline"
                    >
                      History
                    </Link>
                  </li>
                ))
              ) : (
                <li className="px-4 py-6 text-center text-xs text-muted-foreground">
                  Add employees or subcontractors to see them here.
                </li>
              )}
            </ul>
            {roster?.hasMore ? (
              <Link
                href="/pro/dashboard/tracking"
                className="border-t border-input px-4 py-2 text-center text-xs font-medium text-primary hover:bg-muted/50"
              >
                See everyone
              </Link>
            ) : null}
          </div>
        ) : (
          <ul className="max-h-[360px] divide-y divide-input overflow-y-auto border-t border-input lg:border-t-0 lg:border-l">
            {items.map((worker) => {
              const href = recordHref(worker.record);
              return (
                <li key={worker.workerId} className="px-4 py-2.5 text-sm">
                  <div className="flex items-center gap-2">
                    <WorkerStatusDot worker={worker} />
                    <span className="min-w-0 flex-1 truncate font-medium">
                      {worker.name}
                    </span>
                    <WorkerTypeBadge type={worker.participantType} />
                    <Link
                      href={trackingHref({
                        id: worker.workerId,
                        participantType: worker.participantType,
                      })}
                      className="shrink-0 text-xs text-primary hover:underline"
                    >
                      Route
                    </Link>
                  </div>
                  <p className="mt-0.5 truncate pl-4 text-xs text-muted-foreground">
                    {workerStatusText(worker)}
                    {worker.record ? (
                      <>
                        {" · "}
                        {href ? (
                          <Link href={href} className="hover:underline">
                            {worker.record.number || worker.record.title}
                          </Link>
                        ) : null}
                      </>
                    ) : null}
                  </p>
                  <p className="pl-4 text-[11px] text-muted-foreground">
                    Updated {timeAgo(worker.at, now)}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
