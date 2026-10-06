"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
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
export function RouteMapProvider({
  origin,
  currentLocation = false,
  children,
}: {
  origin: RouteOrigin;
  /**
   * Technician portal: start the route from the device's current location
   * (browser geolocation). Falls back to `origin` while locating or if denied.
   */
  currentLocation?: boolean;
  children: ReactNode;
}) {
  const [target, setTarget] = useState<RouteTarget | null>(null);
  const [open, setOpen] = useState(false);
  const [here, setHere] = useState<{ coords: LatLng; address: string } | null>(null);
  const [locating, setLocating] = useState<"idle" | "pending" | "denied">("idle");
  const requestId = useRef(0);

  const locate = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setLocating("denied");
      return;
    }
    const id = ++requestId.current;
    setLocating("pending");
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        if (id !== requestId.current) return;
        const coords = { lat: position.coords.latitude, lng: position.coords.longitude };
        let address = `${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`;
        try {
          // Same OpenStreetMap geocoder the route map already uses.
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${coords.lat}&lon=${coords.lng}&zoom=17`,
            { headers: { Accept: "application/json" } },
          );
          const data = (await res.json()) as { display_name?: string };
          if (data?.display_name) address = data.display_name.split(",").slice(0, 4).join(",").trim();
        } catch {
          // Coordinates are enough for the route; the label just stays numeric.
        }
        if (id !== requestId.current) return;
        setHere({ coords, address });
        setLocating("idle");
      },
      () => {
        if (id === requestId.current) setLocating("denied");
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  }, []);

  const show = useCallback(
    (next: RouteTarget) => {
      setTarget(next);
      setOpen(true);
      if (currentLocation) locate();
    },
    [currentLocation, locate],
  );

  const effectiveOrigin: RouteOrigin =
    currentLocation && here
      ? { businessName: "Your current location", businessAddress: here.address, businessCoords: here.coords }
      : origin;
  const originLabel = currentLocation
    ? here
      ? "Your location (Origin)"
      : locating === "pending"
        ? "Locating you… (business for now)"
        : "Business (location off)"
    : undefined;
  const description = currentLocation
    ? here
      ? "Route and drive time from where you are now to the job site."
      : locating === "denied"
        ? "Allow location access in your browser to route from where you are now. Showing the route from the business."
        : "Finding your current location…"
    : undefined;

  return (
    <RouteMapContext.Provider value={show}>
      {children}
      {target ? (
        <RouteLocationMapDialog
          open={open}
          onOpenChange={setOpen}
          recordType={target.recordType ?? "job"}
          recordNumber={target.recordNumber}
          originLabel={originLabel}
          description={description}
          provider={effectiveOrigin.provider ?? null}
          businessName={effectiveOrigin.businessName}
          businessAddress={effectiveOrigin.businessAddress}
          businessCoords={effectiveOrigin.businessCoords ?? null}
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
