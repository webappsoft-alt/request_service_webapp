"use client";

import { useEffect } from "react";
import { Marker, Popup, Circle } from "react-leaflet";
import L from "leaflet";
import {
  LeafletMap,
  FitMapBounds,
  RecenterMap,
} from "@/components/shared/leaflet-map";
import { getServiceAreaPoints } from "@/lib/data/provider-media";
import { formatLocation } from "@/lib/format";
import type { Provider, ServiceAddress } from "@/lib/types";

export function getCustomerMapPoint(provider: Provider, address: ServiceAddress) {
  const zipPoint =
    getServiceAreaPoints(provider).find((point) => point.zip === address.zip) ?? {
      lat: provider.lat,
      lng: provider.lng,
    };
  const streetNumber = Number.parseInt(address.street, 10) || 0;
  const hash = address.street.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return {
    lat: zipPoint.lat + ((streetNumber % 17) - 8) * 0.00032 + ((hash % 7) - 3) * 0.0001,
    lng: zipPoint.lng + ((streetNumber % 13) - 6) * 0.00038 + ((hash % 5) - 2) * 0.00012,
  };
}

function addressIcon() {
  return L.divIcon({
    className: "rs-marker-wrap",
    html: `<div class="rs-pill is-active">Job site</div>`,
    iconSize: [86, 28],
    iconAnchor: [43, 28],
    popupAnchor: [0, -24],
  });
}

export function CustomerLocationMap({
  provider,
  address,
  name,
  simpro = false,
  plain = false,
}: {
  provider: Provider;
  address: ServiceAddress;
  name: string;
  /** Soft section header (legacy). */
  simpro?: boolean;
  /** No card border — location label + address, then map below. */
  plain?: boolean;
}) {
  const point = getCustomerMapPoint(provider, address);
  const line = `${address.street}${address.unit ? `, ${address.unit}` : ""}, ${formatLocation(address.city, address.state, address.zip)}`;

  const MapNode = (
    <LeafletMap
      center={[point.lat, point.lng]}
      zoom={16}
      showZoom
      zoomPosition="bottomright"
    >
      <RecenterMap lat={point.lat} lng={point.lng} zoom={16} />
      <Marker position={[point.lat, point.lng]} icon={addressIcon()}>
        <Popup>
          <p className="text-sm font-semibold">{name}</p>
          <p className="text-xs text-muted-foreground">{line}</p>
        </Popup>
      </Marker>
    </LeafletMap>
  );

  if (plain) {
    return (
      <section className="space-y-3">
        <div>
          <p className="text-[11px] font-medium text-muted-foreground">Location</p>
          <p className="mt-1 text-sm font-medium text-foreground">{line}</p>
        </div>
        <div className="rs-map h-72 overflow-hidden rounded-xl">{MapNode}</div>
      </section>
    );
  }

  return (
    <section className="overflow-hidden rounded-xl border border-border-soft dark:border-border bg-card shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
      {simpro ? (
        <header className="flex h-11 shrink-0 items-center justify-between gap-3 border-b border-border-soft dark:border-border bg-muted/40 dark:bg-slate-800/80 px-4">
          <h3 className="text-sm font-semibold text-primary">Location</h3>
        </header>
      ) : (
        <header className="border-b border-border-soft dark:border-border px-5 py-3">
          <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Location</p>
          <h3 className="text-sm font-semibold text-foreground">{line}</h3>
        </header>
      )}
      {simpro ? (
        <div className="border-b border-border-soft dark:border-border bg-card px-4 py-2.5">
          <p className="text-sm font-medium text-foreground">{line}</p>
        </div>
      ) : null}
      <div className="rs-map h-72">{MapNode}</div>
    </section>
  );
}
