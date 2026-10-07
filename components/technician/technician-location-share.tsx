"use client";

import { useEffect, useRef } from "react";
import { shareTechnicianLocation } from "@/lib/api/technician-chat-client";

/** Send at most once a minute, sooner only after moving ~50 m. */
const MIN_INTERVAL_MS = 60_000;
const MIN_MOVE_MILES = 0.03;

function milesBetween(lat1: number, lng1: number, lat2: number, lng2: number) {
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLng = (lng2 - lng1) * rad;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLng / 2) ** 2;
  return 3958.8 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Shares the technician's live position with their provider while the portal
 * is open (the provider's route map shows it on the "Technician" tab). Uses
 * the browser's own location permission; nothing is sent if it is denied.
 */
export function TechnicianLocationShare() {
  const last = useRef<{ lat: number; lng: number; at: number } | null>(null);

  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return;
    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        if (document.visibilityState === "hidden") return;
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        const now = Date.now();
        const prev = last.current;
        if (prev) {
          const moved = milesBetween(prev.lat, prev.lng, lat, lng);
          if (now - prev.at < MIN_INTERVAL_MS && moved < MIN_MOVE_MILES) return;
          if (now - prev.at < 15_000) return;
        }
        last.current = { lat, lng, at: now };
        void shareTechnicianLocation({ lat, lng, accuracy: Math.round(position.coords.accuracy) }).catch(() => {});
      },
      () => {
        // Location off — the provider map just shows "no live location".
      },
      { enableHighAccuracy: true, maximumAge: 30_000, timeout: 20_000 },
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  return null;
}
