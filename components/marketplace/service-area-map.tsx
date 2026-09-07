"use client";

import { useEffect, useMemo } from "react";
import { MapContainer, Marker, Popup, TileLayer, ZoomControl, useMap } from "react-leaflet";
import L from "leaflet";
import { getServiceAreaPoints } from "@/lib/data/provider-media";
import { formatLocation } from "@/lib/format";
import type { Provider } from "@/lib/types";
import "leaflet/dist/leaflet.css";

function FitBounds({
  points,
}: {
  points: { lat: number; lng: number }[];
}) {
  const map = useMap();

  useEffect(() => {
    map.invalidateSize();
    if (!points.length) return;
    const bounds = L.latLngBounds(points.map((point) => [point.lat, point.lng]));
    map.fitBounds(bounds.pad(0.28), { animate: false });
  }, [map, points]);

  return null;
}

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
  const allPoints = useMemo(
    () => [{ lat: provider.lat, lng: provider.lng, zip: provider.zip, office: true }, ...points],
    [points, provider.lat, provider.lng, provider.zip]
  );

  return (
    <div className="rs-map h-80 overflow-hidden rounded-xl border border-black/15">
      <MapContainer
        center={[provider.lat, provider.lng]}
        zoom={12}
        zoomControl={false}
        scrollWheelZoom={false}
        className="h-full w-full"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        />
        <ZoomControl position="bottomright" />
        <FitBounds points={allPoints} />
        <Marker position={[provider.lat, provider.lng]} icon={areaIcon("Office", true)}>
          <Popup>
            <p className="text-sm font-semibold">{provider.companyName}</p>
            <p className="text-xs text-muted-foreground">
              {formatLocation(provider.city, provider.state)}
            </p>
          </Popup>
        </Marker>
        {points.map((point) => (
          <Marker key={point.zip} position={[point.lat, point.lng]} icon={areaIcon(point.name)}>
            <Popup>
              <p className="text-sm font-medium">Serves {point.name}</p>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
