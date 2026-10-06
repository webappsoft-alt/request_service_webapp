"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Marker,
  Popup,
  Polyline,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import { LeafletMap } from "@/components/shared/leaflet-map";
import { formatLocation } from "@/lib/format";
import type { Provider, ServiceAddress } from "@/lib/types";
import { getCustomerMapPoint } from "@/components/portal/customer-location-map";

export type LatLngPoint = {
  lat: number;
  lng: number;
};

export type RouteLocationMapInnerProps = {
  provider?: Provider | null;
  businessName?: string;
  businessAddress?: string;
  businessCoords?: LatLngPoint | null;

  customerName?: string;
  customerAddress?: string;
  customerCoords?: LatLngPoint | null;
  serviceAddress?: Partial<ServiceAddress> | { street?: string; city?: string; state?: string; zip?: string } | null;

  onRouteCalculated?: (info: {
    distanceMiles: number;
    distanceKm: number;
    durationMins: number;
    isRoadRoute: boolean;
  }) => void;
};

export function calculateHaversineMiles(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 3958.8; // Radius of Earth in miles
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function calculateBearing(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const y = Math.sin(((lon2 - lon1) * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180);
  const x =
    Math.cos((lat1 * Math.PI) / 180) * Math.sin((lat2 * Math.PI) / 180) -
    Math.sin((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.cos(((lon2 - lon1) * Math.PI) / 180);
  const θ = Math.atan2(y, x);
  return ((θ * 180) / Math.PI + 360) % 360;
}

function providerDivIcon(name: string) {
  const safeName = (name || "Business").slice(0, 24);
  return L.divIcon({
    className: "rs-route-marker-wrap",
    html: `<div style="display:inline-flex;align-items:center;gap:6px;background:#003F7D;color:#ffffff;padding:5px 11px;border-radius:9999px;border:2px solid #ffffff;box-shadow:0 6px 16px rgba(0,63,125,0.4);font-size:11px;font-weight:700;letter-spacing:0.02em;white-space:nowrap;cursor:pointer;">
      <span style="display:inline-block;width:8px;height:8px;border-radius:9999px;background:#38bdf8;box-shadow:0 0 6px #38bdf8;"></span>
      <span>${safeName}</span>
      <span style="font-size:9px;background:rgba(255,255,255,0.22);padding:1px 5px;border-radius:9999px;text-transform:uppercase;">Start</span>
    </div>`,
    iconSize: [140, 30],
    iconAnchor: [70, 15],
    popupAnchor: [0, -18],
  });
}

function customerDivIcon(name: string) {
  const safeName = (name || "Customer Site").slice(0, 24);
  return L.divIcon({
    className: "rs-route-marker-wrap",
    html: `<div style="display:inline-flex;align-items:center;gap:6px;background:#059669;color:#ffffff;padding:5px 11px;border-radius:9999px;border:2px solid #ffffff;box-shadow:0 6px 16px rgba(5,150,105,0.4);font-size:11px;font-weight:700;letter-spacing:0.02em;white-space:nowrap;cursor:pointer;">
      <span style="display:inline-block;width:8px;height:8px;border-radius:9999px;background:#a7f3d0;box-shadow:0 0 6px #a7f3d0;"></span>
      <span>${safeName}</span>
      <span style="font-size:9px;background:rgba(255,255,255,0.22);padding:1px 5px;border-radius:9999px;text-transform:uppercase;">Dest</span>
    </div>`,
    iconSize: [140, 30],
    iconAnchor: [70, 15],
    popupAnchor: [0, -18],
  });
}

function arrowDivIcon(bearing: number) {
  return L.divIcon({
    className: "rs-route-arrow-wrap",
    html: `<div style="transform:rotate(${bearing}deg);display:flex;align-items:center;justify-content:center;width:24px;height:24px;background:#0284c7;border:2px solid #ffffff;border-radius:9999px;box-shadow:0 3px 8px rgba(0,0,0,0.3);color:#ffffff;">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
        <polygon points="12 3 21 21 12 17 3 21 12 3"></polygon>
      </svg>
    </div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
}

/** Component inside LeafletMap that ensures map bounds fit both origin and destination + route */
function RouteBoundsFitter({
  points,
}: {
  points: [number, number][];
}) {
  const map = useMap();

  useEffect(() => {
    if (!points.length) return;
    map.invalidateSize();

    let attempts = 0;
    let raf = 0;

    const fit = () => {
      attempts += 1;
      const size = map.getSize();
      if ((!size || size.x <= 0 || size.y <= 0) && attempts < 8) {
        map.invalidateSize();
        raf = window.requestAnimationFrame(fit);
        return;
      }
      try {
        const bounds = L.latLngBounds(points);
        if (bounds.isValid()) {
          map.fitBounds(bounds.pad(0.22), { maxZoom: 15, animate: false });
        }
      } catch {
        // Fallback
      }
    };

    raf = window.requestAnimationFrame(fit);
    return () => {
      if (raf) window.cancelAnimationFrame(raf);
    };
  }, [map, points]);

  return null;
}

export function RouteLocationMapInner({
  provider,
  businessName,
  businessAddress,
  businessCoords,
  customerName,
  customerAddress,
  customerCoords,
  serviceAddress,
  onRouteCalculated,
}: RouteLocationMapInnerProps) {
  const [resolvedOrigin, setResolvedOrigin] = useState<LatLngPoint | null>(null);
  const [resolvedDest, setResolvedDest] = useState<LatLngPoint | null>(null);
  const [routeCoordinates, setRouteCoordinates] = useState<[number, number][]>([]);
  const [routingDone, setRoutingDone] = useState(false);

  // 1. Resolve Origin (Provider / Business) coordinates
  useEffect(() => {
    let cancelled = false;

    async function resolveOrigin() {
      if (
        businessCoords &&
        Number.isFinite(businessCoords.lat) &&
        Number.isFinite(businessCoords.lng) &&
        !(businessCoords.lat === 0 && businessCoords.lng === 0)
      ) {
        if (!cancelled) setResolvedOrigin(businessCoords);
        return;
      }

      if (
        provider &&
        Number.isFinite(provider.lat) &&
        Number.isFinite(provider.lng) &&
        !(provider.lat === 0 && provider.lng === 0)
      ) {
        if (!cancelled) setResolvedOrigin({ lat: provider.lat, lng: provider.lng });
        return;
      }

      const queryAddr =
        businessAddress ||
        (provider
          ? [provider.street, provider.city, provider.state, provider.zip]
              .filter(Boolean)
              .join(", ")
          : "");

      if (queryAddr) {
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
              queryAddr,
            )}&limit=1`,
            { headers: { "Accept-Language": "en" } },
          );
          if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data) && data[0]?.lat && data[0]?.lon) {
              const pt = { lat: Number(data[0].lat), lng: Number(data[0].lon) };
              if (!cancelled) {
                setResolvedOrigin(pt);
                return;
              }
            }
          }
        } catch {
          // Fall through
        }
      }

      // Final default fallback (Central New Jersey / metro default if nothing matches)
      if (!cancelled) {
        setResolvedOrigin({ lat: 40.4862, lng: -74.4518 });
      }
    }

    void resolveOrigin();
    return () => {
      cancelled = true;
    };
  }, [businessCoords, provider, businessAddress]);

  // 2. Resolve Destination (Customer / Site) coordinates
  useEffect(() => {
    let cancelled = false;

    async function resolveDest() {
      if (
        customerCoords &&
        Number.isFinite(customerCoords.lat) &&
        Number.isFinite(customerCoords.lng) &&
        !(customerCoords.lat === 0 && customerCoords.lng === 0)
      ) {
        if (!cancelled) setResolvedDest(customerCoords);
        return;
      }

      if (customerAddress) {
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
              customerAddress,
            )}&limit=1`,
            { headers: { "Accept-Language": "en" } },
          );
          if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data) && data[0]?.lat && data[0]?.lon) {
              const pt = { lat: Number(data[0].lat), lng: Number(data[0].lon) };
              if (!cancelled) {
                setResolvedDest(pt);
                return;
              }
            }
          }
        } catch {
          // Fall through
        }
      }

      if (provider && serviceAddress && serviceAddress.street && serviceAddress.city) {
        const pt = getCustomerMapPoint(provider, serviceAddress as ServiceAddress);
        if (!cancelled) {
          setResolvedDest(pt);
          return;
        }
      }

      // If customerAddress has street/zip or fallback offset from origin
      if (resolvedOrigin) {
        if (!cancelled) {
          setResolvedDest({
            lat: resolvedOrigin.lat + 0.038,
            lng: resolvedOrigin.lng - 0.042,
          });
        }
      }
    }

    void resolveDest();
    return () => {
      cancelled = true;
    };
  }, [customerCoords, customerAddress, provider, serviceAddress, resolvedOrigin]);

  // 3. Fetch Road Route from OSRM between Origin and Destination
  useEffect(() => {
    if (!resolvedOrigin || !resolvedDest) return;
    const origin = resolvedOrigin;
    const dest = resolvedDest;
    let cancelled = false;

    async function fetchRoute() {
      const origLng = origin.lng;
      const origLat = origin.lat;
      const destLng = dest.lng;
      const destLat = dest.lat;

      const directLine: [number, number][] = [
        [origLat, origLng],
        [destLat, destLng],
      ];
      const haversineDist = calculateHaversineMiles(origLat, origLng, destLat, destLng);
      const estDuration = Math.max(1, Math.round(haversineDist * 1.9));

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4500);

        const res = await fetch(
          `https://router.project-osrm.org/route/v1/driving/${origLng},${origLat};${destLng},${destLat}?overview=full&geometries=geojson`,
          { signal: controller.signal },
        );
        clearTimeout(timeoutId);

        if (res.ok) {
          const data = await res.json();
          if (data?.routes?.[0]?.geometry?.coordinates?.length) {
            const coords: [number, number][] = data.routes[0].geometry.coordinates.map(
              ([lon, lat]: [number, number]) => [lat, lon],
            );
            const distMeters = data.routes[0].distance;
            const distMiles = distMeters / 1609.344;
            const durationMins = Math.max(1, Math.round(data.routes[0].duration / 60));

            if (!cancelled) {
              setRouteCoordinates(coords);
              setRoutingDone(true);
              onRouteCalculated?.({
                distanceMiles: Number(distMiles.toFixed(1)),
                distanceKm: Number((distMeters / 1000).toFixed(1)),
                durationMins,
                isRoadRoute: true,
              });
              return;
            }
          }
        }
      } catch {
        // Fallback to straight line
      }

      if (!cancelled) {
        setRouteCoordinates(directLine);
        setRoutingDone(true);
        onRouteCalculated?.({
          distanceMiles: Number(haversineDist.toFixed(1)),
          distanceKm: Number((haversineDist * 1.60934).toFixed(1)),
          durationMins: estDuration,
          isRoadRoute: false,
        });
      }
    }

    void fetchRoute();
    return () => {
      cancelled = true;
    };
  }, [resolvedOrigin, resolvedDest, onRouteCalculated]);

  // Intermediate arrow markers along the route to indicate direction from Business -> Customer
  const arrowMarkers = useMemo(() => {
    if (!routeCoordinates || routeCoordinates.length < 2) return [];

    const count = routeCoordinates.length;
    // Pick 2 to 3 points along the route
    const indices =
      count > 12
        ? [Math.floor(count * 0.28), Math.floor(count * 0.58), Math.floor(count * 0.82)]
        : [Math.floor(count * 0.5)];

    const markers: { position: [number, number]; bearing: number }[] = [];

    for (const idx of indices) {
      const p1 = routeCoordinates[Math.max(0, idx - 1)];
      const p2 = routeCoordinates[Math.min(count - 1, idx + 1)];
      if (p1 && p2) {
        const bearing = calculateBearing(p1[0], p1[1], p2[0], p2[1]);
        markers.push({
          position: routeCoordinates[idx],
          bearing,
        });
      }
    }

    return markers;
  }, [routeCoordinates]);

  if (!resolvedOrigin || !resolvedDest) {
    return (
      <div className="flex h-[420px] w-full items-center justify-center bg-slate-50 text-sm text-slate-500">
        Loading map and locations…
      </div>
    );
  }

  const allPoints: [number, number][] =
    routeCoordinates.length > 0
      ? routeCoordinates
      : [
          [resolvedOrigin.lat, resolvedOrigin.lng],
          [resolvedDest.lat, resolvedDest.lng],
        ];

  return (
    <div className="rs-map relative h-[440px] sm:h-[490px] w-full overflow-hidden rounded-xl border border-slate-200">
      <LeafletMap
        center={[resolvedOrigin.lat, resolvedOrigin.lng]}
        zoom={13}
        showZoom
        zoomPosition="bottomright"
      >
        <RouteBoundsFitter points={allPoints} />

        {/* Outer glowing path */}
        {routeCoordinates.length > 0 ? (
          <Polyline
            positions={routeCoordinates}
            pathOptions={{
              color: "#0284c7",
              weight: 6,
              opacity: 0.85,
              lineCap: "round",
              lineJoin: "round",
            }}
          />
        ) : null}

        {/* Inner high-contrast path */}
        {routeCoordinates.length > 0 ? (
          <Polyline
            positions={routeCoordinates}
            pathOptions={{
              color: "#38bdf8",
              weight: 3,
              opacity: 1,
              dashArray: "6, 6",
            }}
          />
        ) : null}

        {/* Direction arrows along route */}
        {arrowMarkers.map((arrow, i) => (
          <Marker
            key={`arrow-${i}`}
            position={arrow.position}
            icon={arrowDivIcon(arrow.bearing)}
            interactive={false}
          />
        ))}

        {/* Origin: Business / Provider */}
        <Marker
          position={[resolvedOrigin.lat, resolvedOrigin.lng]}
          icon={providerDivIcon(businessName || provider?.companyName || "Provider")}
        >
          <Popup>
            <div className="space-y-1 p-1">
              <span className="inline-block rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-bold text-blue-800 uppercase tracking-wider">
                Start · Provider Location
              </span>
              <p className="text-sm font-semibold text-slate-900">
                {businessName || provider?.companyName || "Service Business"}
              </p>
              {businessAddress || provider?.street ? (
                <p className="text-xs text-slate-600">
                  {businessAddress ||
                    [
                      provider?.street,
                      formatLocation(provider?.city || "", provider?.state || "", provider?.zip),
                    ]
                      .filter(Boolean)
                      .join(", ")}
                </p>
              ) : null}
            </div>
          </Popup>
        </Marker>

        {/* Destination: Customer / Site */}
        <Marker
          position={[resolvedDest.lat, resolvedDest.lng]}
          icon={customerDivIcon(customerName || "Customer Site")}
        >
          <Popup>
            <div className="space-y-1 p-1">
              <span className="inline-block rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-800 uppercase tracking-wider">
                Destination · Customer / Job Site
              </span>
              <p className="text-sm font-semibold text-slate-900">
                {customerName || "Customer Location"}
              </p>
              {customerAddress ? (
                <p className="text-xs text-slate-600">{customerAddress}</p>
              ) : null}
            </div>
          </Popup>
        </Marker>
      </LeafletMap>
    </div>
  );
}
