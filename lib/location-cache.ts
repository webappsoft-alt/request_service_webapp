/**
 * Warm device location for the crew portals (technician / contractor).
 *
 * The portal starts watching the position as soon as it opens and keeps the latest fix here,
 * updating it as the device moves. Depart / Arrive / Check in then use that fix instantly instead
 * of waiting for a brand-new high-accuracy GPS reading (which often timed out on laptops / indoors).
 */

export type CachedFix = { lat: number; lng: number; accuracy: number; at: number };

let latest: CachedFix | null = null;
let watchId: number | null = null;
let watchers = 0;

/** A fix newer than `maxAgeMs` (default 2 min), or null. */
export function getCachedFix(maxAgeMs = 120_000): CachedFix | null {
  if (!latest) return null;
  return Date.now() - latest.at <= maxAgeMs ? latest : null;
}

function remember(position: GeolocationPosition) {
  latest = {
    lat: position.coords.latitude,
    lng: position.coords.longitude,
    accuracy: position.coords.accuracy,
    at: position.timestamp || Date.now(),
  };
}

/** Start watching (ref-counted); returns a stop function. Safe to call when location is unavailable. */
export function startLocationWarmup(): () => void {
  if (typeof navigator === "undefined" || !navigator.geolocation) return () => undefined;
  watchers += 1;
  if (watchId === null) {
    // Quick coarse fix first (Wi-Fi / cell, usually < 1 s), then the watch refines it on the move.
    navigator.geolocation.getCurrentPosition(remember, () => undefined, {
      enableHighAccuracy: false,
      timeout: 20_000,
      maximumAge: 120_000,
    });
    watchId = navigator.geolocation.watchPosition(remember, () => undefined, {
      enableHighAccuracy: true,
      timeout: 60_000,
      maximumAge: 30_000,
    });
  }
  return () => {
    watchers = Math.max(0, watchers - 1);
    if (watchers === 0 && watchId !== null) {
      navigator.geolocation.clearWatch(watchId);
      watchId = null;
    }
  };
}

/**
 * Position fast: the warm fix when fresh, else a coarse reading (accepts one up to 2 min old),
 * else one high-accuracy try. Rejects with the browser's GeolocationPositionError.
 */
export function getFastPosition(maxAgeMs = 120_000): Promise<CachedFix> {
  const cached = getCachedFix(maxAgeMs);
  if (cached) return Promise.resolve(cached);
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject({ code: 2, message: "Geolocation is not supported by your browser." });
      return;
    }
    const done = (position: GeolocationPosition) => {
      remember(position);
      resolve(latest as CachedFix);
    };
    navigator.geolocation.getCurrentPosition(
      done,
      (coarseError) => {
        if (coarseError.code === coarseError.PERMISSION_DENIED) {
          reject(coarseError);
          return;
        }
        navigator.geolocation.getCurrentPosition(done, reject, {
          enableHighAccuracy: true,
          timeout: 15_000,
          maximumAge: maxAgeMs,
        });
      },
      { enableHighAccuracy: false, timeout: 12_000, maximumAge: maxAgeMs },
    );
  });
}
