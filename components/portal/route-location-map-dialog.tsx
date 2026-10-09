"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import {
  ExternalLink,
  MapPin,
  Navigation,
  ArrowRight,
  Car,
  Clock,
  Loader2,
  Building2,
  HardHat,
  Home,
} from "lucide-react";
import { onSocketEvent } from "@/components/socket/socket-api";
import { getTechnicianLocations, type TechnicianLocation } from "@/lib/api/technician-chat-client";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { RouteLocationMapInnerProps } from "@/components/portal/route-location-map-inner";

const RouteLocationMapInner = dynamic(
  () =>
    import("@/components/portal/route-location-map-inner").then(
      (mod) => mod.RouteLocationMapInner,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[440px] sm:h-[490px] w-full flex-col items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 text-muted-foreground dark:border-slate-700 dark:bg-slate-900">
        <Loader2 className="size-6 animate-spin text-primary" />
        <p className="text-sm font-medium">Loading interactive route map…</p>
      </div>
    ),
  },
);

export type RouteLocationMapDialogProps = RouteLocationMapInnerProps & {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recordType?: "job" | "estimate";
  recordNumber?: string;
  /** Origin heading — "Business (Origin)" for the office, "Your location" for technicians. */
  originLabel?: string;
  /** Subtitle under the title. */
  description?: string;
  /**
   * Customer's own (profile) address. When given, the dialog shows two tabs:
   * "Site location" (where the work is) and "Customer location".
   */
  billingAddress?: string;
  billingCoords?: RouteLocationMapInnerProps["customerCoords"];
  /** Assigned technicians: adds a tab per technician routing their live location to the job site. */
  technicians?: { employeeId: string; name: string }[];
};

type RouteTab = { key: string; label: string; kind: "site" | "customer" | "technician"; employeeId?: string; name?: string };

function ago(value: string | null) {
  if (!value) return "";
  const mins = Math.round((Date.now() - new Date(value).getTime()) / 60000);
  if (!Number.isFinite(mins)) return "";
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  return new Date(value).toLocaleDateString([], { month: "short", day: "numeric" });
}

export function RouteLocationMapDialog({
  open,
  onOpenChange,
  recordType = "job",
  recordNumber,
  originLabel = "Business (Origin)",
  description = "Direction and distance from provider business location to customer job site.",
  provider,
  businessName,
  businessAddress,
  businessCoords,
  customerName,
  customerAddress,
  customerCoords,
  serviceAddress,
  billingAddress,
  billingCoords,
  technicians,
}: RouteLocationMapDialogProps) {
  const tabs = useMemo<RouteTab[]>(() => {
    const list: RouteTab[] = [{ key: "site", label: "Site location", kind: "site" }];
    if (billingAddress) {
      list.push({ key: "customer", label: "Customer location", kind: "customer" });
    }
    for (const tech of technicians ?? []) {
      if (!tech.employeeId) continue;
      list.push({
        key: `tech:${tech.employeeId}`,
        label: technicians && technicians.length > 1 ? tech.name || "Technician" : "Assigned technician",
        kind: "technician",
        employeeId: tech.employeeId,
        name: tech.name,
      });
    }
    return list;
  }, [billingAddress, technicians]);
  const [tabKey, setTabKey] = useState("site");
  const tab = tabs.find((item) => item.key === tabKey) ?? tabs[0];
  const [locations, setLocations] = useState<Record<string, TechnicianLocation>>({});
  const [locFetchedFor, setLocFetchedFor] = useState("");
  const techIds = useMemo(() => (technicians ?? []).map((t) => t.employeeId).filter(Boolean).join(","), [technicians]);
  const locLoading = open && Boolean(techIds) && locFetchedFor !== techIds;

  // Every time the dialog opens it starts on the site location.
  const [wasOpen, setWasOpen] = useState(open);
  if (wasOpen !== open) {
    setWasOpen(open);
    if (open) setTabKey("site");
  }

  // Live technician positions: one fetch when the dialog opens, then socket updates.
  useEffect(() => {
    if (!open || !techIds) return;
    let cancelled = false;
    getTechnicianLocations(techIds.split(","))
      .then((rows) => {
        if (cancelled) return;
        setLocations(Object.fromEntries(rows.map((row) => [row.employeeId, row])));
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLocFetchedFor(techIds);
      });
    const off = onSocketEvent("technician:location", (payload) => {
      if (!payload?.employeeId || !techIds.split(",").includes(payload.employeeId)) return;
      setLocations((current) => ({
        ...current,
        [payload.employeeId]: {
          employeeId: payload.employeeId,
          name: payload.name || current[payload.employeeId]?.name || "",
          lat: payload.lat,
          lng: payload.lng,
          accuracy: payload.accuracy ?? null,
          at: payload.at,
        },
      }));
    });
    return () => {
      cancelled = true;
      off();
    };
  }, [open, techIds]);

  const [routeStats, setRouteStats] = useState<{
    distanceMiles: number;
    distanceKm: number;
    durationMins: number;
    isRoadRoute: boolean;
  } | null>(null);

  const resolvedBusinessName =
    businessName || provider?.companyName || "Service Provider";
  const resolvedCustomerName = customerName || "Customer Property";

  const resolvedBusinessAddress =
    businessAddress ||
    (provider
      ? [provider.street, provider.city, provider.state, provider.zip]
          .filter(Boolean)
          .join(", ")
      : "");

  const techLocation = tab.kind === "technician" && tab.employeeId ? locations[tab.employeeId] : undefined;
  const techCoords =
    techLocation && techLocation.lat != null && techLocation.lng != null
      ? { lat: techLocation.lat, lng: techLocation.lng }
      : null;

  // Origin → destination for the selected tab.
  const route =
    tab.kind === "technician"
      ? {
          originLabel: "Technician (live location)",
          originName: tab.name || techLocation?.name || "Technician",
          originAddress: techLocation?.at ? `Shared ${ago(techLocation.at)}` : "",
          originCoords: techCoords,
          destLabel: "Site Location (Destination)",
          destName: "Site location",
          destAddress: customerAddress,
          destCoords: customerCoords ?? null,
          serviceAddress,
        }
      : tab.kind === "customer"
        ? {
            originLabel,
            originName: resolvedBusinessName,
            originAddress: resolvedBusinessAddress,
            originCoords: businessCoords ?? null,
            destLabel: "Customer Location",
            destName: resolvedCustomerName,
            destAddress: billingAddress || "",
            destCoords: billingCoords ?? null,
            serviceAddress: null,
          }
        : {
            originLabel,
            originName: resolvedBusinessName,
            originAddress: resolvedBusinessAddress,
            originCoords: businessCoords ?? null,
            destLabel: "Site Location (Destination)",
            destName: "Site location",
            destAddress: customerAddress,
            destCoords: customerCoords ?? null,
            serviceAddress,
          };
  const waitingForTech = tab.kind === "technician" && !techCoords;

  const originParam =
    tab.kind === "technician"
      ? techCoords
        ? `${techCoords.lat},${techCoords.lng}`
        : ""
      : resolvedBusinessAddress || `${businessCoords?.lat || provider?.lat || ""},${businessCoords?.lng || provider?.lng || ""}`;
  const destParam = route.destAddress || `${route.destCoords?.lat || ""},${route.destCoords?.lng || ""}`;
  const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(originParam)}&destination=${encodeURIComponent(destParam)}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl p-0 overflow-hidden sm:max-w-3xl lg:max-w-4xl max-h-[92vh] flex flex-col dark:bg-slate-900 dark:ring-slate-700">
        {/* Header */}
        <div className="border-b border-slate-200 bg-slate-50/80 px-5 py-4 dark:border-slate-700/80 dark:bg-transparent">
          <div className="flex flex-wrap items-center justify-between gap-3 pr-8">
            <div>
              <DialogTitle className="flex items-center gap-2 text-base sm:text-lg font-bold text-slate-900 dark:text-slate-50">
                <Navigation className="size-5 text-primary" />
                <span>
                  {recordType === "job" ? "Job Route" : "Estimate Route"}
                  {recordNumber ? ` · ${recordNumber}` : ""}
                </span>
              </DialogTitle>
              <DialogDescription className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                {description}
              </DialogDescription>
            </div>

            {/* External Google Maps Link */}
            <Button
              size="sm"
              variant="outline"
              className="h-8 gap-1.5 text-xs text-slate-700 hover:text-primary dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 dark:hover:text-sky-300"
              asChild
            >
              <a href={googleMapsUrl} target="_blank" rel="noopener noreferrer">
                <span>Google Maps</span>
                <ExternalLink className="size-3" />
              </a>
            </Button>
          </div>

          {tabs.length > 1 ? (
            <div role="tablist" aria-label="Locations" className="mt-3 flex flex-wrap gap-1.5">
              {tabs.map((item) => {
                const Icon = item.kind === "site" ? Building2 : item.kind === "customer" ? Home : HardHat;
                const active = item.key === tab.key;
                return (
                  <button
                    key={item.key}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => {
                      setTabKey(item.key);
                      setRouteStats(null);
                    }}
                    className={cn(
                      "inline-flex h-8 items-center gap-1.5 rounded-md border px-3 text-xs font-semibold transition-colors",
                      active
                        ? "border-primary bg-primary text-primary-foreground dark:border-sky-500 dark:bg-sky-600 dark:text-white"
                        : "border-slate-200 bg-white text-slate-600 hover:border-primary/40 hover:text-primary dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-sky-500/60 dark:hover:text-sky-300",
                    )}
                  >
                    <Icon className="size-3.5" aria-hidden />
                    {item.label}
                  </button>
                );
              })}
            </div>
          ) : null}

          {/* Route details banner */}
          <div className="mt-3 grid gap-2.5 rounded-lg border border-slate-200 bg-white p-3 sm:grid-cols-[1fr_auto_1fr_auto] sm:items-center dark:border-slate-700 dark:bg-slate-800">
            {/* Origin */}
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-sky-600" />
                <span className="text-[10px] font-bold tracking-wider text-slate-400 uppercase dark:text-slate-500">
                  {route.originLabel}
                </span>
              </div>
              <p className="truncate text-xs font-semibold text-slate-800 dark:text-slate-100">
                {route.originName}
              </p>
              {route.originAddress ? (
                <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">
                  {route.originAddress}
                </p>
              ) : null}
            </div>

            {/* Direction Arrow */}
            <div className="flex items-center justify-center text-slate-400 dark:text-slate-500">
              <ArrowRight className="size-4 text-sky-500" />
            </div>

            {/* Destination */}
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className={cn("size-2 rounded-full", tab.kind === "customer" ? "bg-violet-600" : "bg-emerald-600")} />
                <span className="text-[10px] font-bold tracking-wider text-slate-400 uppercase dark:text-slate-500">
                  {route.destLabel}
                </span>
              </div>
              <p className="truncate text-xs font-semibold text-slate-800 dark:text-slate-100">
                {route.destName}
              </p>
              {route.destAddress ? (
                <p className="truncate text-[11px] text-slate-500 dark:text-slate-400" title={route.destAddress}>
                  {route.destAddress}
                </p>
              ) : null}
            </div>

            {/* Distance & Time pill */}
            <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-2 sm:border-t-0 sm:border-l sm:pl-3 sm:pt-0 dark:border-slate-700">
              {waitingForTech ? (
                <span className="text-xs text-slate-400 dark:text-slate-500">No live location</span>
              ) : routeStats ? (
                <div className="flex flex-col items-start gap-1 sm:items-end">
                  <div className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2.5 py-0.5 text-xs font-bold text-sky-700 border border-sky-200 dark:border-sky-500/40 dark:bg-sky-500/15 dark:text-sky-300">
                    <Car className="size-3 text-sky-600" />
                    <span>{routeStats.distanceMiles} mi</span>
                    <span className="text-[10px] font-normal text-sky-600">
                      ({routeStats.distanceKm} km)
                    </span>
                  </div>
                  {routeStats.durationMins > 0 ? (
                    <div className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                      <Clock className="size-3 text-slate-400 dark:text-slate-500" />
                      <span>~{routeStats.durationMins} mins driving</span>
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="inline-flex items-center gap-1.5 text-xs text-slate-400 dark:text-slate-500">
                  <Loader2 className="size-3 animate-spin text-slate-400 dark:text-slate-500" />
                  <span>Calculating route…</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Map Body */}
        <div className="p-4 flex-1">
          {open && waitingForTech ? (
            <div className="flex h-[440px] w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-6 text-center sm:h-[490px] dark:border-slate-600 dark:bg-slate-900">
              {locLoading ? (
                <Loader2 className="size-6 animate-spin text-primary" />
              ) : (
                <HardHat className="size-8 text-slate-400 dark:text-slate-500" />
              )}
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                {locLoading ? "Finding the technician…" : `${tab.name || "The technician"} has not shared a live location yet`}
              </p>
              {!locLoading ? (
                <p className="max-w-sm text-xs text-slate-500 dark:text-slate-400">
                  Their position appears here while they have the technician portal open with location
                  allowed. It updates live, so there is no need to reopen this map.
                </p>
              ) : null}
            </div>
          ) : open ? (
            <RouteLocationMapInner
              key={tab.key}
              provider={tab.kind === "technician" ? null : provider}
              businessName={route.originName}
              businessAddress={tab.kind === "technician" ? "" : route.originAddress}
              businessCoords={route.originCoords}
              customerName={route.destName}
              customerAddress={route.destAddress}
              customerCoords={route.destCoords}
              serviceAddress={route.serviceAddress}
              onRouteCalculated={setRouteStats}
            />
          ) : null}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50/60 px-5 py-2.5 dark:border-slate-700/80 dark:bg-transparent">
          <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
            <MapPin className="size-3 text-sky-600" />
            <span>Interactive map · Route follows road network</span>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="h-8"
            onClick={() => onOpenChange(false)}
          >
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
