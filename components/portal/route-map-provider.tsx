"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { RouteLocationMapDialog } from "@/components/portal/route-location-map-dialog";
import type { Provider } from "@/lib/types";

export type LatLng = { lat: number; lng: number };

/** Where the route starts — the provider's business location. */
export type RouteOrigin = {
  provider?: Provider | null;
  businessName?: string;
  businessAddress?: string;
  businessCoords?: LatLng | null;
};

/** One job site to show on the route map. */
export type RouteTarget = {
  recordType?: "job" | "estimate";
  recordNumber?: string;
  customerName?: string;
  customerAddress: string;
  customerCoords?: LatLng | null;
};

const RouteMapContext = createContext<((target: RouteTarget) => void) | null>(null);

/**
 * One shared route map for the whole portal. Any location (table cell, detail
 * card, technician job) opens the project's route dialog through `useRouteMap`
 * instead of leaving the app for an external map.
 */
export function RouteMapProvider({ origin, children }: { origin: RouteOrigin; children: ReactNode }) {
  const [target, setTarget] = useState<RouteTarget | null>(null);
  const [open, setOpen] = useState(false);
  const show = useCallback((next: RouteTarget) => {
    setTarget(next);
    setOpen(true);
  }, []);

  return (
    <RouteMapContext.Provider value={show}>
      {children}
      {target ? (
        <RouteLocationMapDialog
          open={open}
          onOpenChange={setOpen}
          recordType={target.recordType ?? "job"}
          recordNumber={target.recordNumber}
          provider={origin.provider ?? null}
          businessName={origin.businessName}
          businessAddress={origin.businessAddress}
          businessCoords={origin.businessCoords ?? null}
          customerName={target.customerName}
          customerAddress={target.customerAddress}
          customerCoords={target.customerCoords ?? null}
        />
      ) : null}
    </RouteMapContext.Provider>
  );
}

/** Opens the shared route map; null outside a portal shell (callers fall back to a link). */
export function useRouteMap() {
  return useContext(RouteMapContext);
}

/** Stable origin object so the provider does not re-render the dialog on every shell render. */
export function useRouteOrigin(origin: RouteOrigin): RouteOrigin {
  const { provider, businessName, businessAddress, businessCoords } = origin;
  const lat = businessCoords?.lat;
  const lng = businessCoords?.lng;
  return useMemo(
    () => ({
      provider,
      businessName,
      businessAddress,
      businessCoords: lat != null && lng != null ? { lat, lng } : null,
    }),
    [provider, businessName, businessAddress, lat, lng],
  );
}
