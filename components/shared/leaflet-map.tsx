"use client";

import { useEffect, useState, type ReactNode } from "react";
import {
  MapContainer,
  TileLayer,
  ZoomControl,
  useMap,
  type MapContainerProps,
} from "react-leaflet";
import L from "leaflet";
import { useTheme } from "next-themes";
import { getMapTileLayerProps } from "@/lib/maps";
import "leaflet/dist/leaflet.css";

type LeafletMapProps = Omit<MapContainerProps, "children"> & {
  children?: ReactNode;
  zoomPosition?: "topleft" | "topright" | "bottomleft" | "bottomright" | false;
  showZoom?: boolean;
  /** When supplied, the map will be re-centered / fitted whenever the value changes. */
  fitBoundsPoints?: { lat: number; lng: number }[];
  fitBoundsPadding?: number;
  fitBoundsMaxZoom?: number;
  fitBoundsMinZoom?: number;
};

function isUsableCoord(point: { lat: number; lng: number }) {
  if (!Number.isFinite(point.lat) || !Number.isFinite(point.lng)) return false;
  if (point.lat < -90 || point.lat > 90) return false;
  if (point.lng < -180 || point.lng > 180) return false;
  // Skip obvious null-island placeholders (exactly 0,0 or very close to it) — these
  // almost always indicate a missing backend value, not a real location in the
  // Gulf of Guinea.
  if (Math.abs(point.lat) < 0.0001 && Math.abs(point.lng) < 0.0001) return false;
  return true;
}

function runFit(
  map: L.Map,
  points: { lat: number; lng: number }[],
  padding: number,
  minZoom: number | undefined,
  maxZoom: number,
  onCenter?: { lat: number; lng: number; zoom?: number },
): boolean {
  const size = map.getSize();
  if (!size || size.x <= 0 || size.y <= 0) return false;

  const usable = points.filter(isUsableCoord);

  if (usable.length) {
    const bounds = L.latLngBounds(
      usable.map((point) => [point.lat, point.lng]),
    );
    if (bounds.isValid()) {
      const ne = bounds.getNorthEast();
      const sw = bounds.getSouthWest();
      const samePoint =
        Math.abs(ne.lat - sw.lat) < 0.0002 &&
        Math.abs(ne.lng - sw.lng) < 0.0002;

      if (samePoint || usable.length === 1) {
        const zoom = Math.max(minZoom ?? 11, maxZoom ?? 13);
        map.setView([usable[0].lat, usable[0].lng], zoom, {
          animate: false,
        });
      } else {
        map.fitBounds(bounds.pad(padding), {
          maxZoom,
          animate: false,
        });
        if (typeof minZoom === "number" && map.getZoom() < minZoom) {
          map.setZoom(minZoom);
        }
      }
      return true;
    }
  }

  if (onCenter && isUsableCoord(onCenter)) {
    map.setView(
      [onCenter.lat, onCenter.lng],
      onCenter.zoom ?? minZoom ?? Math.max(map.getZoom(), 11),
      { animate: false },
    );
    return true;
  }

  return false;
}

export function FitMapBounds({
  points,
  padding = 0.28,
  maxZoom = 13,
  minZoom,
  onCenter,
}: {
  points: { lat: number; lng: number }[];
  padding?: number;
  maxZoom?: number;
  minZoom?: number;
  /** Optional recenter-only point when there are no bounds to fit. */
  onCenter?: { lat: number; lng: number; zoom?: number };
}) {
  const map = useMap();

  useEffect(() => {
    map.invalidateSize();

    // Immediately try, then retry via rAF chain until the map has layout.
    // React-leaflet's first paint occasionally has a 0x0 container which
    // silently collapses fitBounds to the world-level zoom.
    let attempts = 0;
    let raf = 0;
    const tryRun = () => {
      attempts += 1;
      const ok = runFit(map, points, padding, minZoom, maxZoom, onCenter);
      if (!ok && attempts < 8) {
        map.invalidateSize();
        raf = window.requestAnimationFrame(tryRun);
      }
    };
    raf = window.requestAnimationFrame(tryRun);

    return () => {
      if (raf) window.cancelAnimationFrame(raf);
    };
  }, [map, points, padding, maxZoom, minZoom, onCenter]);

  return null;
}

export function RecenterMap({
  lat,
  lng,
  zoom,
}: {
  lat: number;
  lng: number;
  zoom?: number;
}) {
  const map = useMap();

  useEffect(() => {
    let attempts = 0;
    let raf = 0;
    const tryRun = () => {
      attempts += 1;
      const size = map.getSize();
      if ((!size || size.x <= 0 || size.y <= 0) && attempts < 8) {
        map.invalidateSize();
        raf = window.requestAnimationFrame(tryRun);
        return;
      }
      map.invalidateSize();
      map.setView([lat, lng], zoom ?? map.getZoom(), { animate: false });
    };
    raf = window.requestAnimationFrame(tryRun);
    return () => {
      if (raf) window.cancelAnimationFrame(raf);
    };
  }, [lat, lng, zoom, map]);

  return null;
}

export function LeafletMap({
  children,
  className,
  zoomControl = false,
  showZoom = true,
  zoomPosition = "bottomright",
  fitBoundsPoints,
  fitBoundsPadding,
  fitBoundsMaxZoom,
  fitBoundsMinZoom,
  center,
  zoom = 11,
  scrollWheelZoom = false,
  ...rest
}: LeafletMapProps) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = mounted && resolvedTheme === "dark";
  const mapTiles = getMapTileLayerProps(isDark);

  return (
    <MapContainer
      center={center ?? [39.8283, -98.5795]}
      zoom={zoom}
      minZoom={2}
      maxZoom={19}
      zoomControl={zoomControl}
      scrollWheelZoom={scrollWheelZoom}
      className={className ?? "h-full w-full"}
      {...rest}
    >
      <TileLayer key={isDark ? "dark-tiles" : "light-tiles"} attribution={mapTiles.attribution} url={mapTiles.url} />
      {showZoom && zoomPosition !== false ? (
        <ZoomControl position={zoomPosition} />
      ) : null}
      {fitBoundsPoints ? (
        <FitMapBounds
          points={fitBoundsPoints}
          padding={fitBoundsPadding}
          maxZoom={fitBoundsMaxZoom}
          minZoom={fitBoundsMinZoom}
          onCenter={(() => {
            if (!center) return undefined;
            if (Array.isArray(center)) {
              return { lat: center[0], lng: center[1], zoom };
            }
            if (typeof center === "object" && "lat" in center && "lng" in center) {
              return {
                lat: (center as { lat: number; lng: number }).lat,
                lng: (center as { lat: number; lng: number }).lng,
                zoom,
              };
            }
            return undefined;
          })()}
        />
      ) : null}
      {children}
    </MapContainer>
  );
}
