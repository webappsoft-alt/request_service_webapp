/** Leaflet tile config from `.env` (no hardcoded credentials). */
export function getMapTileLayerProps() {
  const apiKey = process.env.NEXT_PUBLIC_MAPS_API_KEY || "";
  const tileUrl =
    process.env.NEXT_PUBLIC_MAPS_TILE_URL ||
    "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png";

  const url = apiKey
    ? tileUrl
        .replaceAll("{key}", apiKey)
        .replaceAll("{apikey}", apiKey)
    : tileUrl;

  return {
    url,
    attribution:
      process.env.NEXT_PUBLIC_MAPS_ATTRIBUTION ||
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>',
  } as const;
}
