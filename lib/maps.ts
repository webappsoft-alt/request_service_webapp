/** Leaflet tile configuration — 100% free by default, no API key required.
 *
 * Defaults to official OpenStreetMap raster tiles. Override via env vars if you
 * want to swap in a premium style; no credential ever leaves this module.
 */
export function getMapTileLayerProps() {
  const tileUrl =
    process.env.NEXT_PUBLIC_MAPS_TILE_URL ||
    "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";

  const defaultAttribution =
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

  const apiKey = process.env.NEXT_PUBLIC_MAPS_TILE_API_KEY || "";
  const url = apiKey
    ? tileUrl
        .replaceAll("{key}", apiKey)
        .replaceAll("{apikey}", apiKey)
    : tileUrl;

  return {
    url,
    attribution: process.env.NEXT_PUBLIC_MAPS_ATTRIBUTION || defaultAttribution,
  } as const;
}

export function getLeafletTileLayer() {
  return getMapTileLayerProps();
}
