"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MapContainer, Marker, TileLayer, ZoomControl, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import { X } from "lucide-react";
import { ProviderCard } from "@/components/shared/provider-card";
import { getStartingPrice } from "@/lib/data/provider-media";
import { formatStartingPrice } from "@/lib/format";
import { getMapTileLayerProps } from "@/lib/maps";
import type { Provider } from "@/lib/types";
import "leaflet/dist/leaflet.css";

const mapTiles = getMapTileLayerProps();

function FitToProviders({
  providers,
  selectedId,
  fitToken,
}: {
  providers: Provider[];
  selectedId: string | null;
  fitToken: number;
}) {
  const map = useMap();
  const fitted = useRef(false);
  const lastFit = useRef(-1);
  const lastIds = useRef("");
  const lastSelected = useRef<string | null>(null);

  useEffect(() => {
    map.invalidateSize();
    if (!providers.length) return;

    const ids = providers.map((provider) => provider.id).join();
    const shouldFit =
      !fitted.current || lastFit.current !== fitToken || lastIds.current !== ids;

    if (shouldFit) {
      fitted.current = true;
      lastFit.current = fitToken;
      lastIds.current = ids;
      const bounds = L.latLngBounds(providers.map((provider) => [provider.lat, provider.lng]));
      map.fitBounds(bounds.pad(0.32), { animate: fitted.current && lastFit.current > 0 });
      lastSelected.current = selectedId;
      return;
    }

    if (selectedId && selectedId !== lastSelected.current) {
      const selected = providers.find((provider) => provider.id === selectedId);
      if (selected) {
        map.flyTo([selected.lat, selected.lng], Math.max(map.getZoom(), 13), {
          duration: 0.55,
        });
      }
    }
    lastSelected.current = selectedId;
  }, [fitToken, map, providers, selectedId]);

  return null;
}

function MapDismiss({ onDismiss }: { onDismiss: () => void }) {
  useMapEvents({
    click: onDismiss,
  });
  return null;
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

function PriceMarker({
  provider,
  active,
  onSelect,
  onHover,
}: {
  provider: Provider;
  active: boolean;
  onSelect: (id: string) => void;
  onHover: (id: string | null) => void;
}) {
  return (
    <Marker
      position={[provider.lat, provider.lng]}
      icon={markerIcon(provider, active)}
      zIndexOffset={active ? 80 : 0}
      eventHandlers={{
        click: (event) => {
          L.DomEvent.stopPropagation(event);
          event.originalEvent.stopPropagation();
          onSelect(provider.id);
        },
        mouseover: () => onHover(provider.id),
        mouseout: () => onHover(null),
      }}
    />
  );
}

function MarkerBoundCard({
  provider,
  onClose,
}: {
  provider: Provider;
  onClose: () => void;
}) {
  const map = useMap();
  const cardRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ left: 0, top: 0, ready: false });

  useEffect(() => {
    const CARD_WIDTH = 320;
    const MARKER_HEIGHT = 28;
    const GAP = 12;

    const update = () => {
      const point = map.latLngToContainerPoint([provider.lat, provider.lng]);
      const size = map.getSize();
      const height = cardRef.current?.offsetHeight ?? 420;
      const spaceAbove = point.y - MARKER_HEIGHT;
      const placeBelow = spaceAbove < height + GAP && size.y - point.y > spaceAbove;

      let left = point.x - CARD_WIDTH / 2;
      left = Math.max(16, Math.min(left, size.x - CARD_WIDTH - 16));

      let top = placeBelow ? point.y + GAP : point.y - MARKER_HEIGHT - height - GAP;
      top = Math.max(16, Math.min(top, size.y - height - 16));

      setBox({ left, top, ready: true });
    };

    update();
    const frame = requestAnimationFrame(update);
    map.on("move zoom resize", update);
    return () => {
      cancelAnimationFrame(frame);
      map.off("move zoom resize", update);
    };
  }, [map, provider]);

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
    map.getContainer()
  );
}

export function ProviderMap({
  providers,
  selectedId,
  hoveredId,
  fitToken,
  onSelect,
  onHover,
}: {
  providers: Provider[];
  selectedId: string | null;
  hoveredId: string | null;
  fitToken: number;
  onSelect: (id: string) => void;
  onHover: (id: string | null) => void;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const ignoreDismiss = useRef(false);
  const preview = providers.find((provider) => provider.id === openId) ?? null;

  function openPreview(id: string) {
    ignoreDismiss.current = true;
    onSelect(id);
    setOpenId(id);
    window.setTimeout(() => {
      ignoreDismiss.current = false;
    }, 0);
  }
  const center = useMemo<[number, number]>(() => {
    if (!providers.length) return [39.8283, -98.5795];
    const lat = providers.reduce((sum, provider) => sum + provider.lat, 0) / providers.length;
    const lng = providers.reduce((sum, provider) => sum + provider.lng, 0) / providers.length;
    return [lat, lng];
  }, [providers]);

  useEffect(() => {
    if (openId && !providers.some((provider) => provider.id === openId)) {
      setOpenId(null);
    }
  }, [openId, providers]);

  if (!providers.length) {
    return (
      <div className="flex h-full items-center justify-center bg-muted text-sm text-muted-foreground">
        No professionals mapped for this category yet.
      </div>
    );
  }

  return (
    <div className="rs-map relative h-full w-full">
      <MapContainer
        center={center}
        zoom={12}
        zoomControl={false}
        scrollWheelZoom
        className="h-full w-full"
      >
        <TileLayer
          attribution={mapTiles.attribution}
          url={mapTiles.url}
        />
        <ZoomControl position="bottomright" />
        <FitToProviders providers={providers} selectedId={selectedId} fitToken={fitToken} />
        <MapDismiss
          onDismiss={() => {
            if (!ignoreDismiss.current) setOpenId(null);
          }}
        />
        {providers.map((provider) => (
          <PriceMarker
            key={provider.id}
            provider={provider}
            active={provider.id === selectedId || provider.id === hoveredId || provider.id === openId}
            onSelect={openPreview}
            onHover={onHover}
          />
        ))}
        {preview ? (
          <MarkerBoundCard provider={preview} onClose={() => setOpenId(null)} />
        ) : null}
      </MapContainer>
    </div>
  );
}
