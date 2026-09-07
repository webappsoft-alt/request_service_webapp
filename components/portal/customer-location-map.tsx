"use client";

import { useEffect } from "react";
import { MapContainer, Marker, Popup, TileLayer, ZoomControl, useMap } from "react-leaflet";
import L from "leaflet";
import { getServiceAreaPoints } from "@/lib/data/provider-media";
import { formatLocation } from "@/lib/format";
import type { Provider, ServiceAddress } from "@/lib/types";
import "leaflet/dist/leaflet.css";

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

function Recenter({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();

  useEffect(() => {
    map.invalidateSize();
    map.setView([lat, lng], 16, { animate: false });
  }, [lat, lng, map]);

  return null;
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
}: {
  provider: Provider;
  address: ServiceAddress;
  name: string;
}) {
  const point = getCustomerMapPoint(provider, address);
  const line = `${address.street}${address.unit ? `, ${address.unit}` : ""}, ${formatLocation(address.city, address.state, address.zip)}`;

  return (
    <section className="overflow-hidden rounded-lg border border-black/10 bg-card shadow-[0_10px_28px_rgba(4,26,54,0.07)]">
      <header className="border-b border-black/10 bg-[#f7f8fa] px-5 py-3">
        <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Location</p>
        <h3 className="text-sm font-semibold">{line}</h3>
      </header>
      <div className="rs-map h-72">
        <MapContainer
          center={[point.lat, point.lng]}
          zoom={16}
          zoomControl={false}
          scrollWheelZoom={false}
          className="h-full w-full"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <ZoomControl position="bottomright" />
          <Recenter lat={point.lat} lng={point.lng} />
          <Marker position={[point.lat, point.lng]} icon={addressIcon()}>
            <Popup>
              <p className="text-sm font-semibold">{name}</p>
              <p className="text-xs text-muted-foreground">{line}</p>
            </Popup>
          </Marker>
        </MapContainer>
      </div>
    </section>
  );
}
