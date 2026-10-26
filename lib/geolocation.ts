/**
 * Device position for clock in / pause / resume / clock out. The server checks clock-in and
 * resume against the job site (200 m), so location must be on for those.
 */

export type DeviceLocation = { lat: number; lng: number; accuracy: number };

export class LocationError extends Error {
  /** Short heading for the toast. */
  readonly title: string;
  constructor(title: string, message: string) {
    super(message);
    this.title = title;
    this.name = "LocationError";
  }
}

/** Current position (fresh within 30 s), or a LocationError explaining how to fix it. */
export function getDeviceLocation(timeoutMs = 15000): Promise<DeviceLocation> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(
        new LocationError(
          "Location isn't available",
          "This browser can't share your location. Use a phone or browser with location services to check in/out.",
        ),
      );
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) =>
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
        }),
      (error) => {
        if (error.code === error.PERMISSION_DENIED) {
          reject(
            new LocationError(
              "Turn on location to check in/out",
              "Location permission is blocked. Allow location for this site in your browser / phone settings, then try again.",
            ),
          );
        } else if (error.code === error.TIMEOUT) {
          reject(
            new LocationError(
              "Couldn't find your location",
              "Getting your position took too long. Make sure location services (GPS) are on, then try again.",
            ),
          );
        } else {
          reject(
            new LocationError(
              "Couldn't find your location",
              "Your device couldn't determine where you are. Turn on location services (GPS) and try again.",
            ),
          );
        }
      },
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 30000 },
    );
  });
}

/** Position when the device gives one within a few seconds; null otherwise (clock out / pause only record it). */
export async function tryDeviceLocation(): Promise<DeviceLocation | null> {
  try {
    return await getDeviceLocation(4000);
  } catch {
    return null;
  }
}
