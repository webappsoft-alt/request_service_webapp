"use client";

import { MapPin } from "lucide-react";
import { useRouteMap, type LatLng } from "@/components/portal/route-map-provider";

/** Any address shape the CRM returns: ServiceAddress, estimate propertyAddress, job location, or a plain string. */
export type AddressLike =
  | string
  | {
      address?: unknown;
      street?: unknown;
      unit?: unknown;
      city?: unknown;
      state?: unknown;
      zip?: unknown;
      lat?: unknown;
      lng?: unknown;
      latitude?: unknown;
      longitude?: unknown;
      coordinates?: unknown;
    }
  | null
  | undefined;

export type ResolvedLocation = { line1: string; line2: string; full: string };

function text(value: unknown) {
  return typeof value === "string" || typeof value === "number" ? String(value).trim() : "";
}

function resolveOne(value: AddressLike): ResolvedLocation | null {
  if (!value) return null;
  if (typeof value === "string") {
    const full = value.trim();
    if (!full) return null;
    const [first, ...rest] = full.split(",");
    return { line1: first.trim(), line2: rest.join(",").trim(), full };
  }
  const street = [text(value.address) || text(value.street), text(value.unit)].filter(Boolean).join(" ");
  const cityState = [text(value.city), text(value.state)].filter(Boolean).join(", ");
  const line2 = [cityState, text(value.zip)].filter(Boolean).join(" ");
  if (!street && !line2) return null;
  // Placeholder streets from older leads are not a real location.
  if (/^address pending$/i.test(street) && !line2) return null;
  return { line1: street || line2, line2: street ? line2 : "", full: [street, line2].filter(Boolean).join(", ") };
}

/** First usable address from a list of fallbacks (record → job → customer). */
export function resolveLocation(...candidates: AddressLike[]): ResolvedLocation | null {
  for (const candidate of candidates) {
    const resolved = resolveOne(candidate);
    if (resolved) return resolved;
  }
  return null;
}

/** Coordinates from the first candidate that has them (lat/lng fields or GeoJSON [lng, lat]). */
export function locationCoords(...candidates: AddressLike[]): LatLng | null {
  for (const candidate of candidates) {
    if (!candidate || typeof candidate === "string") continue;
    const coords = Array.isArray(candidate.coordinates) ? (candidate.coordinates as unknown[]) : null;
    if (coords && coords.length === 2) {
      const lng = Number(coords[0]);
      const lat = Number(coords[1]);
      if (Number.isFinite(lat) && Number.isFinite(lng) && (lat !== 0 || lng !== 0)) return { lat, lng };
    }
    const lat = Number(candidate.lat ?? candidate.latitude);
    const lng = Number(candidate.lng ?? candidate.longitude);
    if (Number.isFinite(lat) && Number.isFinite(lng) && (lat !== 0 || lng !== 0)) return { lat, lng };
  }
  return null;
}

export function locationText(...candidates: AddressLike[]) {
  return resolveLocation(...candidates)?.full ?? "";
}

/**
 * Customer location for list tables (Jobs, Estimates, Invoices, Leads):
 * street, city / state / zip, and a Map button that opens the project's route
 * map dialog. The button keeps its own click, so the rest of the row still
 * opens the record.
 */
export function LocationCell({
  candidates,
  className,
  map,
}: {
  candidates: AddressLike[];
  className?: string;
  /** Labels for the route map (record number, customer). */
  map?: { recordType?: "job" | "estimate"; recordNumber?: string; customerName?: string };
}) {
  const openMap = useRouteMap();
  const location = resolveLocation(...candidates);
  if (!location) return <span className="text-muted-foreground">No address</span>;
  const mapLabel = (
    <>
      <MapPin className="size-3" aria-hidden />
      Map
    </>
  );
  const mapClass = "mt-0.5 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline";
  return (
    <div className={className ?? "min-w-44 max-w-64"}>
      <p className="truncate font-medium" title={location.full}>
        {location.line1}
      </p>
      {location.line2 ? <p className="truncate text-xs text-muted-foreground">{location.line2}</p> : null}
      {openMap ? (
        <button
          type="button"
          className={mapClass}
          onClick={() =>
            openMap({
              recordType: map?.recordType,
              recordNumber: map?.recordNumber,
              customerName: map?.customerName,
              customerAddress: location.full,
              customerCoords: locationCoords(...candidates),
            })
          }
        >
          {mapLabel}
        </button>
      ) : (
        <a
          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location.full)}`}
          target="_blank"
          rel="noreferrer"
          className={mapClass}
        >
          {mapLabel}
        </a>
      )}
    </div>
  );
}
