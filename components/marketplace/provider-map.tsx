"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import L from "leaflet";
import { X } from "lucide-react";
import { ProviderCard } from "@/components/shared/provider-card";
import { getStartingPrice } from "@/lib/data/provider-media";
import { formatStartingPrice } from "@/lib/format";
import { getMapTileLayerProps } from "@/lib/maps";
import type { Provider } from "@/lib/types";
import "leaflet/dist/leaflet.css";

const mapTiles = getMapTileLayerProps();

function hasValidCoords(provider: Provider) {
  return (
    Number.isFinite(provider.lat) &&
    Number.isFinite(provider.lng) &&
    !(provider.lat === 0 && provider.lng === 0)
  );
}

/** Keep one marker per list provider when several share the same API coordinates. */
function withSpreadCoords(providers: Provider[]): Provider[] {
  const groups = new Map<string, number>();
  return providers.map((provider) => {
    if (!hasValidCoords(provider)) return provider;
    const key = `${provider.lat.toFixed(5)},${provider.lng.toFixed(5)}`;
    const index = groups.get(key) ?? 0;
    groups.set(key, index + 1);
    if (index === 0) return provider;
    const angle = index * (Math.PI / 3.2);
    const radius = 0.0011 * Math.ceil(index / 6);
    return {
      ...provider,
      lat: provider.lat + Math.sin(angle) * radius,
      lng: provider.lng + Math.cos(angle) * radius,
    };
  });
}

function markerIcon(provider: Provider, active: boolean) {
  const label = formatStartingPrice(getStartingPrice(provider));
  const width = Math.max(56, label.length * 8 + 20);

  return L.divIcon({
    className: "rs-marker-wrap",
    html: `<div class="rs-pill${active ? " is-active" : ""}">${label}</div>`,
    iconSize: [width, 28],
    iconAnchor: [width / 2, 28],
  });
}

function MarkerBoundCard({
  map,
  provider,
  onClose,
}: {
  map: L.Map;
  provider: Provider;
  onClose: () => void;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ left: 0, top: 0, ready: false });

  useEffect(() => {
    const CARD_WIDTH = 320;
    const MARKER_HEIGHT = 28;
    const GAP = 12;

    const update = () => {
      try {
        const point = map.latLngToContainerPoint([provider.lat, provider.lng]);
        const size = map.getSize();
        const height = cardRef.current?.offsetHeight ?? 420;
        const spaceAbove = point.y - MARKER_HEIGHT;
        const placeBelow =
          spaceAbove < height + GAP && size.y - point.y > spaceAbove;

        let left = point.x - CARD_WIDTH / 2;
        left = Math.max(16, Math.min(left, size.x - CARD_WIDTH - 16));

        let top = placeBelow
          ? point.y + GAP
          : point.y - MARKER_HEIGHT - height - GAP;
        top = Math.max(16, Math.min(top, size.y - height - 16));

        setBox({ left, top, ready: true });
      } catch {
        /* map tearing down */
      }
    };

    update();
    const frame = requestAnimationFrame(update);
    map.on("move zoom resize", update);
    return () => {
      cancelAnimationFrame(frame);
      map.off("move zoom resize", update);
    };
  }, [map, provider]);

  let container: HTMLElement | null = null;
  try {
    container = map.getContainer();
  } catch {
    container = null;
  }
  if (!container) return null;

  return createPortal(
    <div
      ref={cardRef}
      className="absolute z-[1200] w-80"
      style={{
        left: box.left,
        top: box.top,
        visibility: box.ready ? "visible" : "hidden",
      }}
      onClick={(event) => event.stopPropagation()}
    >
      <button
        type="button"
        className="absolute top-0 right-0 z-20 flex size-6 translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white text-foreground shadow-md"
        onClick={onClose}
        aria-label="Close"
      >
        <X className="size-3.5" />
      </button>
      <ProviderCard provider={provider} visual className="h-auto" />
    </div>,
    container,
  );
}

type ProviderMapProps = {
  providers: Provider[];
  selectedId: string | null;
  hoveredId: string | null;
  fitToken: number;
  onSelect: (id: string) => void;
  onHover: (id: string | null) => void;
};

export function ProviderMap({
  providers,
  selectedId,
  hoveredId,
  fitToken,
  onSelect,
  onHover,
}: ProviderMapProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef(new Map<string, L.Marker>());
  const ignoreDismiss = useRef(false);
  const fitted = useRef(false);
  const lastFit = useRef(-1);
  const lastIds = useRef("");
  const lastSelected = useRef<string | null>(null);
  const handlersRef = useRef({ onSelect, onHover });

  const [mapReady, setMapReady] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  handlersRef.current = { onSelect, onHover };

  const mappable = useMemo(
    () => withSpreadCoords(providers.filter(hasValidCoords)),
    [providers],
  );

  const center = useMemo<[number, number]>(() => {
    if (!mappable.length) return [39.8283, -98.5795];
    const lat =
      mappable.reduce((sum, provider) => sum + provider.lat, 0) /
      mappable.length;
    const lng =
      mappable.reduce((sum, provider) => sum + provider.lng, 0) /
      mappable.length;
    return [lat, lng];
  }, [mappable]);

  // Imperative Leaflet init — avoids react-leaflet Strict Mode / HMR appendChild crashes.
  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;

    let cancelled = false;
    let map: L.Map | null = null;
    let ro: ResizeObserver | null = null;
    let raf = 0;
    let attempts = 0;

    const start = () => {
      if (cancelled || !hostRef.current) return;
      const node = hostRef.current;
      if (node.clientWidth <= 0 || node.clientHeight <= 0) {
        attempts += 1;
        if (attempts < 60) {
          raf = window.requestAnimationFrame(start);
        }
        return;
      }

      map = L.map(node, {
        zoomControl: false,
        scrollWheelZoom: true,
      }).setView(center, 11);

      L.tileLayer(mapTiles.url, {
        attribution: mapTiles.attribution,
      }).addTo(map);

      L.control.zoom({ position: "bottomright" }).addTo(map);

      map.on("click", () => {
        if (!ignoreDismiss.current) setOpenId(null);
      });

      mapRef.current = map;
      setMapReady(true);

      ro = new ResizeObserver(() => {
        try {
          map?.invalidateSize({ animate: false });
        } catch {
          /* ignore */
        }
      });
      ro.observe(node);
      window.requestAnimationFrame(() => {
        try {
          map?.invalidateSize({ animate: false });
        } catch {
          /* ignore */
        }
      });
    };

    raf = window.requestAnimationFrame(start);

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(raf);
      ro?.disconnect();
      markersRef.current.forEach((marker) => {
        try {
          marker.remove();
        } catch {
          /* ignore */
        }
      });
      markersRef.current.clear();
      if (map) {
        try {
          map.remove();
        } catch {
          /* ignore */
        }
      }
      mapRef.current = null;
      setMapReady(false);
      fitted.current = false;
      lastFit.current = -1;
      lastIds.current = "";
    };
    // center is only used for initial view; later fits update the viewport.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount once
  }, []);

  useEffect(() => {
    if (openId && !mappable.some((provider) => provider.id === openId)) {
      setOpenId(null);
    }
  }, [openId, mappable]);

  // Sync markers with the current provider list / selection state.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    const activeIds = new Set(mappable.map((provider) => provider.id));
    const existing = markersRef.current;

    existing.forEach((marker, id) => {
      if (!activeIds.has(id)) {
        marker.remove();
        existing.delete(id);
      }
    });

    mappable.forEach((provider) => {
      const active =
        provider.id === selectedId ||
        provider.id === hoveredId ||
        provider.id === openId;
      const icon = markerIcon(provider, active);
      let marker = existing.get(provider.id);

      if (!marker) {
        marker = L.marker([provider.lat, provider.lng], {
          icon,
          zIndexOffset: active ? 80 : 0,
        });
        marker.on("click", (event) => {
          L.DomEvent.stopPropagation(event);
          ignoreDismiss.current = true;
          handlersRef.current.onSelect(provider.id);
          setOpenId(provider.id);
          window.setTimeout(() => {
            ignoreDismiss.current = false;
          }, 0);
        });
        marker.on("mouseover", () => handlersRef.current.onHover(provider.id));
        marker.on("mouseout", () => handlersRef.current.onHover(null));
        marker.addTo(map);
        existing.set(provider.id, marker);
      } else {
        marker.setLatLng([provider.lat, provider.lng]);
        marker.setIcon(icon);
        marker.setZIndexOffset(active ? 80 : 0);
      }
    });
  }, [hoveredId, mapReady, mappable, openId, selectedId]);

  // Fit / fly-to — mirrors previous FitToProviders behavior.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    const frame = window.requestAnimationFrame(() => {
      try {
        map.invalidateSize();
      } catch {
        /* ignore */
      }
    });

    if (!mappable.length) {
      return () => window.cancelAnimationFrame(frame);
    }

    const ids = mappable.map((provider) => provider.id).join();
    const shouldFit =
      !fitted.current || lastFit.current !== fitToken || lastIds.current !== ids;

    if (shouldFit) {
      fitted.current = true;
      lastFit.current = fitToken;
      lastIds.current = ids;
      try {
        const bounds = L.latLngBounds(
          mappable.map((provider) => [provider.lat, provider.lng]),
        );
        if (bounds.isValid()) {
          const ne = bounds.getNorthEast();
          const sw = bounds.getSouthWest();
          const samePoint =
            Math.abs(ne.lat - sw.lat) < 0.0002 &&
            Math.abs(ne.lng - sw.lng) < 0.0002;
          if (samePoint || mappable.length === 1) {
            map.setView([mappable[0].lat, mappable[0].lng], 11, {
              animate: lastFit.current > 0,
            });
          } else {
            map.fitBounds(bounds.pad(0.5), {
              maxZoom: 12,
              animate: lastFit.current > 0,
            });
          }
        }
      } catch {
        /* ignore */
      }
      lastSelected.current = selectedId;
      return () => window.cancelAnimationFrame(frame);
    }

    if (selectedId && selectedId !== lastSelected.current) {
      const selected = mappable.find((provider) => provider.id === selectedId);
      if (selected) {
        try {
          const nextZoom = Math.min(Math.max(map.getZoom(), 11), 13);
          map.flyTo([selected.lat, selected.lng], nextZoom, {
            duration: 0.55,
          });
        } catch {
          /* ignore */
        }
      }
    }
    lastSelected.current = selectedId;
    return () => window.cancelAnimationFrame(frame);
  }, [fitToken, mapReady, mappable, selectedId]);

  const preview = mappable.find((provider) => provider.id === openId) ?? null;
  const map = mapRef.current;

  return (
    <div className="rs-map relative h-full min-h-52 w-full">
      {/* Leaflet owns this node exclusively — keep it free of React children. */}
      <div ref={hostRef} className="h-full w-full" />

      {!mapReady ? (
        <div className="pointer-events-none absolute inset-0 z-[400] flex items-center justify-center bg-muted text-sm text-muted-foreground">
          Loading map…
        </div>
      ) : null}

      {mapReady && !mappable.length ? (
        <div className="pointer-events-none absolute inset-0 z-[500] flex items-center justify-center bg-muted/80 text-sm text-muted-foreground">
          No professionals mapped for this category yet.
        </div>
      ) : null}

      {mapReady && map && preview ? (
        <MarkerBoundCard
          map={map}
          provider={preview}
          onClose={() => setOpenId(null)}
        />
      ) : null}
    </div>
  );
}
