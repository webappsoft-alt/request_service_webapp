"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import {
  ExternalLink,
  MapPin,
  Navigation,
  ArrowRight,
  Car,
  Clock,
  Loader2,
} from "lucide-react";
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
      <div className="flex h-[440px] sm:h-[490px] w-full flex-col items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 text-muted-foreground">
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
};

export function RouteLocationMapDialog({
  open,
  onOpenChange,
  recordType = "job",
  recordNumber,
  provider,
  businessName,
  businessAddress,
  businessCoords,
  customerName,
  customerAddress,
  customerCoords,
  serviceAddress,
}: RouteLocationMapDialogProps) {
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

  const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(
    resolvedBusinessAddress || `${businessCoords?.lat || provider?.lat || ""},${businessCoords?.lng || provider?.lng || ""}`,
  )}&destination=${encodeURIComponent(
    customerAddress || `${customerCoords?.lat || ""},${customerCoords?.lng || ""}`,
  )}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl p-0 overflow-hidden sm:max-w-3xl lg:max-w-4xl max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="border-b border-slate-200 bg-slate-50/80 px-5 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3 pr-8">
            <div>
              <DialogTitle className="flex items-center gap-2 text-base sm:text-lg font-bold text-slate-900">
                <Navigation className="size-5 text-primary" />
                <span>
                  {recordType === "job" ? "Job Route" : "Estimate Route"}
                  {recordNumber ? ` · ${recordNumber}` : ""}
                </span>
              </DialogTitle>
              <DialogDescription className="mt-0.5 text-xs text-slate-500">
                Direction and distance from provider business location to customer job site.
              </DialogDescription>
            </div>

            {/* External Google Maps Link */}
            <Button
              size="sm"
              variant="outline"
              className="h-8 gap-1.5 text-xs text-slate-700 hover:text-primary"
              asChild
            >
              <a href={googleMapsUrl} target="_blank" rel="noopener noreferrer">
                <span>Google Maps</span>
                <ExternalLink className="size-3" />
              </a>
            </Button>
          </div>

          {/* Route details banner */}
          <div className="mt-3 grid gap-2.5 rounded-lg border border-slate-200 bg-white p-3 sm:grid-cols-[1fr_auto_1fr_auto] sm:items-center">
            {/* Origin */}
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-sky-600" />
                <span className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">
                  Business (Origin)
                </span>
              </div>
              <p className="truncate text-xs font-semibold text-slate-800">
                {resolvedBusinessName}
              </p>
              {resolvedBusinessAddress ? (
                <p className="truncate text-[11px] text-slate-500">
                  {resolvedBusinessAddress}
                </p>
              ) : null}
            </div>

            {/* Direction Arrow */}
            <div className="flex items-center justify-center text-slate-400">
              <ArrowRight className="size-4 text-sky-500" />
            </div>

            {/* Destination */}
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-emerald-600" />
                <span className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">
                  Job Site (Destination)
                </span>
              </div>
              <p className="truncate text-xs font-semibold text-slate-800">
                {resolvedCustomerName}
              </p>
              {customerAddress ? (
                <p className="truncate text-[11px] text-slate-500">
                  {customerAddress}
                </p>
              ) : null}
            </div>

            {/* Distance & Time pill */}
            <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-2 sm:border-t-0 sm:border-l sm:pl-3 sm:pt-0">
              {routeStats ? (
                <div className="flex flex-col items-start gap-1 sm:items-end">
                  <div className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2.5 py-0.5 text-xs font-bold text-sky-700 border border-sky-200">
                    <Car className="size-3 text-sky-600" />
                    <span>{routeStats.distanceMiles} mi</span>
                    <span className="text-[10px] font-normal text-sky-600">
                      ({routeStats.distanceKm} km)
                    </span>
                  </div>
                  {routeStats.durationMins > 0 ? (
                    <div className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500">
                      <Clock className="size-3 text-slate-400" />
                      <span>~{routeStats.durationMins} mins driving</span>
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="inline-flex items-center gap-1.5 text-xs text-slate-400">
                  <Loader2 className="size-3 animate-spin text-slate-400" />
                  <span>Calculating route…</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Map Body */}
        <div className="p-4 flex-1">
          {open ? (
            <RouteLocationMapInner
              provider={provider}
              businessName={resolvedBusinessName}
              businessAddress={resolvedBusinessAddress}
              businessCoords={businessCoords}
              customerName={resolvedCustomerName}
              customerAddress={customerAddress}
              customerCoords={customerCoords}
              serviceAddress={serviceAddress}
              onRouteCalculated={setRouteStats}
            />
          ) : null}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50/60 px-5 py-2.5">
          <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
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
