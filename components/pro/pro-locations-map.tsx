"use client";

import { useEffect } from "react";
import { Circle, MapContainer, Marker, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import { getMapTileLayerProps } from "@/lib/maps";
import "leaflet/dist/leaflet.css";

const mapTiles = getMapTileLayerProps();

export const locationShops = [
  {
    name: "Aurora shop",
    short: "Aurora",
    zips: "80010 · 80012 · 80014",
    jobs: "5 jobs this week",
    lat: 39.7294,
    lng: -104.8319,
  },
  {
    name: "Lakewood yard",
    short: "Lakewood",
    zips: "80214 · 80226 · 80228",
    jobs: "2 jobs this week",
    lat: 39.7047,
    lng: -105.0814,
  },
  {
    name: "Denver office",
    short: "Denver",
    zips: "80205 · 80211 · 80218",
    jobs: "3 jobs this week",
    lat: 39.7392,
    lng: -104.9903,
  },
] as const;

const jobPins = [
  { shop: 0, price: "$1,660", job: "Water heater", lat: 39.742, lng: -104.808 },
  { shop: 0, price: "$415", job: "Leak repair", lat: 39.716, lng: -104.858 },
  { shop: 1, price: "$189", job: "Drain line", lat: 39.712, lng: -105.102 },
  { shop: 2, price: "$240", job: "Bath fan", lat: 39.752, lng: -104.976 },
  { shop: 2, price: "$2,180", job: "Panel upgrade", lat: 39.726, lng: -105.016 },
] as const;

function FitShops() {
  const map = useMap();

  useEffect(() => {
    map.invalidateSize();
    const bounds = L.latLngBounds(locationShops.map((shop) => [shop.lat, shop.lng]));
    map.fitBounds(bounds.pad(0.38), { animate: false });
  }, [map]);

  return null;
}

function shopIcon(label: string, active: boolean) {
  const width = Math.max(86, label.length * 7.4 + 28);
  return L.divIcon({
    className: "rs-marker-wrap",
    html: `<div class="rs-shop-pin${active ? " is-active" : ""}">${label}</div>`,
    iconSize: [width, 30],
    iconAnchor: [width / 2, 30],
  });
}

function priceIcon(label: string, active: boolean) {
  const width = Math.max(56, label.length * 8 + 22);
  return L.divIcon({
    className: "rs-marker-wrap",
    html: `<div class="rs-pill${active ? " is-active" : ""}">${label}</div>`,
    iconSize: [width, 28],
    iconAnchor: [width / 2, 28],
  });
}

export function ProLocationsMap({
  active,
  onPick,
}: {
  active: number;
  onPick: (value: number) => void;
}) {
  const shop = locationShops[active] ?? locationShops[0];

  return (
    <div className="rs-map h-[268px] w-full">
      <MapContainer
        center={[39.73, -104.96]}
        zoom={11}
        zoomControl={false}
        scrollWheelZoom={false}
        dragging={false}
        doubleClickZoom={false}
        attributionControl={false}
        className="h-full w-full"
      >
        <TileLayer url={mapTiles.url} attribution={mapTiles.attribution} />
        <FitShops />
        <Circle
          center={[shop.lat, shop.lng]}
          radius={4200}
          pathOptions={{
            color: "#003F7D",
            weight: 1.25,
            fillColor: "#003F7D",
            fillOpacity: 0.1,
          }}
        />
        {locationShops.map((item, index) => (
          <Marker
            key={item.name}
            position={[item.lat, item.lng]}
            icon={shopIcon(item.short, index === active)}
            zIndexOffset={index === active ? 90 : 40}
            eventHandlers={{
              click: () => onPick(index),
            }}
          />
        ))}
        {jobPins.map((pin) => (
          <Marker
            key={`${pin.job}-${pin.price}`}
            position={[pin.lat, pin.lng]}
            icon={priceIcon(pin.price, pin.shop === active)}
            zIndexOffset={pin.shop === active ? 80 : 10}
            eventHandlers={{
              click: () => onPick(pin.shop),
            }}
          />
        ))}
      </MapContainer>
    </div>
  );
}
