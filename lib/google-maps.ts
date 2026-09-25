"use client";

/**
 * Google Maps JS + Places loader — mirrors binsapp `lib/googleMaps.js`
 * (see docs/GOOGLE_AUTOCOMPLETE.md). Uses our existing env keys only.
 */

const SCRIPT_ATTR = "data-rs-google-maps";
let loadPromise: Promise<void> | null = null;

export function getGoogleMapsApiKey(): string {
  return (
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim() ||
    process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY?.trim() ||
    process.env.GOOGLE_MAPS_API_KEY?.trim() ||
    ""
  );
}

export function isGoogleMapsReady(): boolean {
  return Boolean(
    typeof window !== "undefined" &&
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- google maps global
      ((window as any).google?.maps?.places ||
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (window as any).google?.maps?.Map),
  );
}

/** Loads `maps/api/js?libraries=places` once per page. */
export function loadGoogleMapsScript(
  apiKey = getGoogleMapsApiKey(),
): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("window unavailable"));
  }
  if (isGoogleMapsReady()) return Promise.resolve();
  if (loadPromise) return loadPromise;
  if (!apiKey) {
    return Promise.reject(new Error("Google Maps API key is missing"));
  }

  const existing = document.querySelector(
    `script[${SCRIPT_ATTR}="true"], script[src*="maps.googleapis.com/maps/api/js"]`,
  );

  loadPromise = new Promise<void>((resolve, reject) => {
    if (existing) {
      if (isGoogleMapsReady()) {
        resolve();
        return;
      }
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener(
        "error",
        () => reject(new Error("Google Maps failed to load")),
        { once: true },
      );
      return;
    }

    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=places`;
    script.async = true;
    script.defer = true;
    script.setAttribute(SCRIPT_ATTR, "true");
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Google Maps failed to load"));
    document.head.appendChild(script);
  });

  return loadPromise;
}
