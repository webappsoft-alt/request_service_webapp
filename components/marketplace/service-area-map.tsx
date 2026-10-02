"use client";

import { useMemo } from "react";
import { Marker, Popup } from "react-leaflet";
import L from "leaflet";
import { LeafletMap } from "@/components/shared/leaflet-map";
import {
  getServiceAreaPoints,
  selectFitBoundsPoints,
  getPrimaryServiceAreaCluster,
} from "@/lib/data/provider-media";
import { formatLocation } from "@/lib/format";
import type { Provider } from "@/lib/types";

function areaIcon(label: string, office = false) {
  const width = Math.max(office ? 64 : 72, label.length * 7.2 + 22);
  return L.divIcon({
    className: "rs-marker-wrap",
    html: `<div class="rs-pill${office ? " is-active" : ""}">${label}</div>`,
    iconSize: [width, 28],
    iconAnchor: [width / 2, 28],
    popupAnchor: [0, -24],
  });
}

export function ServiceAreaMap({ provider }: { provider: Provider }) {
  const points = useMemo(() => getServiceAreaPoints(provider), [provider]);
  const officePoint = useMemo(
    () => ({ lat: provider.lat, lng: provider.lng }),
    [provider.lat, provider.lng],
  );

  const fitBoundsPoints = useMemo(
    () => selectFitBoundsPoints(points, officePoint),
    [points, officePoint],
  );

  const defaultCenter = useMemo<[number, number]>(() => {
    const primaryCluster = getPrimaryServiceAreaCluster(points);
    const refPoints = primaryCluster.length ? primaryCluster : points;
    if (refPoints.length) {
      let latSum = 0;
      let lngSum = 0;
      for (const p of refPoints) {
        latSum += p.lat;
        lngSum += p.lng;
      }
      return [latSum / refPoints.length, lngSum / refPoints.length];
    }
    return [provider.lat, provider.lng];
  }, [points, provider.lat, provider.lng]);

  return (
    <div className="rs-map h-80 overflow-hidden rounded-xl border border-input">
      <LeafletMap
        center={defaultCenter}
        zoom={12}
        fitBoundsPoints={fitBoundsPoints}
        fitBoundsPadding={0.28}
        fitBoundsMaxZoom={13}
        fitBoundsMinZoom={10}
      >
        <Marker position={[provider.lat, provider.lng]} icon={areaIcon("Office", true)}>
          <Popup>
            <p className="text-sm font-semibold">{provider.companyName}</p>
            <p className="text-xs text-muted-foreground">
              {formatLocation(provider.city, provider.state)}
            </p>
          </Popup>
        </Marker>
        {points.map((point) => (
          <Marker
            key={point.id || `${point.zip}-${point.lat}-${point.lng}`}
            position={[point.lat, point.lng]}
            icon={areaIcon(point.name)}
          >
            <Popup>
              <p className="text-sm font-medium">Serves {point.name}</p>
            </Popup>
          </Marker>
        ))}
      </LeafletMap>
    </div>
  );
}
