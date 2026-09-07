export type MarketCity = {
  city: string;
  state: string;
  zip: string;
};

/** Primary Colorado markets used for local service × city keywords. */
export const COLORADO_CITIES: MarketCity[] = [
  { city: "Denver", state: "CO", zip: "80202" },
  { city: "Colorado Springs", state: "CO", zip: "80903" },
  { city: "Aurora", state: "CO", zip: "80012" },
  { city: "Fort Collins", state: "CO", zip: "80521" },
  { city: "Lakewood", state: "CO", zip: "80214" },
  { city: "Thornton", state: "CO", zip: "80229" },
  { city: "Arvada", state: "CO", zip: "80002" },
  { city: "Westminster", state: "CO", zip: "80030" },
  { city: "Pueblo", state: "CO", zip: "81003" },
  { city: "Centennial", state: "CO", zip: "80112" },
  { city: "Boulder", state: "CO", zip: "80301" },
  { city: "Greeley", state: "CO", zip: "80631" },
  { city: "Longmont", state: "CO", zip: "80501" },
  { city: "Loveland", state: "CO", zip: "80537" },
  { city: "Grand Junction", state: "CO", zip: "81501" },
  { city: "Broomfield", state: "CO", zip: "80020" },
  { city: "Castle Rock", state: "CO", zip: "80104" },
  { city: "Commerce City", state: "CO", zip: "80022" },
  { city: "Parker", state: "CO", zip: "80134" },
  { city: "Littleton", state: "CO", zip: "80120" },
];

export const FEATURED_MARKETS: MarketCity[] = [
  { city: "Austin", state: "TX", zip: "78701" },
  { city: "Boston", state: "MA", zip: "02108" },
  { city: "Minneapolis", state: "MN", zip: "55401" },
  { city: "Seattle", state: "WA", zip: "98101" },
  { city: "Charlotte", state: "NC", zip: "28202" },
  { city: "Phoenix", state: "AZ", zip: "85003" },
  { city: "Tampa", state: "FL", zip: "33602" },
];

const ALL_MARKETS = [...COLORADO_CITIES, ...FEATURED_MARKETS];

const CITY_BY_ZIP: Record<string, MarketCity> = {
  ...Object.fromEntries(ALL_MARKETS.map((market) => [market.zip, market])),
  "80010": { city: "Aurora", state: "CO", zip: "80010" },
  "80013": { city: "Aurora", state: "CO", zip: "80013" },
  "80014": { city: "Aurora", state: "CO", zip: "80014" },
  "80015": { city: "Aurora", state: "CO", zip: "80015" },
  "80016": { city: "Aurora", state: "CO", zip: "80016" },
  "80017": { city: "Aurora", state: "CO", zip: "80017" },
  "80203": { city: "Denver", state: "CO", zip: "80203" },
  "80204": { city: "Denver", state: "CO", zip: "80204" },
  "80205": { city: "Denver", state: "CO", zip: "80205" },
  "80206": { city: "Denver", state: "CO", zip: "80206" },
  "80211": { city: "Denver", state: "CO", zip: "80211" },
  "80218": { city: "Denver", state: "CO", zip: "80218" },
  "78702": { city: "Austin", state: "TX", zip: "78702" },
  "78703": { city: "Austin", state: "TX", zip: "78703" },
  "78704": { city: "Austin", state: "TX", zip: "78704" },
};

const ZIP3_TO_CITY: Record<string, MarketCity> = {
  "802": { city: "Denver", state: "CO", zip: "80202" },
  "803": { city: "Boulder", state: "CO", zip: "80301" },
  "809": { city: "Colorado Springs", state: "CO", zip: "80903" },
  "810": { city: "Pueblo", state: "CO", zip: "81003" },
  "815": { city: "Grand Junction", state: "CO", zip: "81501" },
  "806": { city: "Greeley", state: "CO", zip: "80631" },
  "787": { city: "Austin", state: "TX", zip: "78701" },
  "021": { city: "Boston", state: "MA", zip: "02108" },
  "554": { city: "Minneapolis", state: "MN", zip: "55401" },
  "981": { city: "Seattle", state: "WA", zip: "98101" },
  "282": { city: "Charlotte", state: "NC", zip: "28202" },
  "850": { city: "Phoenix", state: "AZ", zip: "85003" },
  "336": { city: "Tampa", state: "FL", zip: "33602" },
};

function normalizePlace(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function getMarketByZip(zip?: string): MarketCity | undefined {
  if (!zip || !/^\d{5}$/.test(zip)) return undefined;
  return CITY_BY_ZIP[zip] ?? ZIP3_TO_CITY[zip.slice(0, 3)];
}

export function findMarketCity(city?: string, state?: string): MarketCity | undefined {
  const name = city ? normalizePlace(city) : "";
  if (!name) return undefined;
  const code = state?.trim().toUpperCase();
  return ALL_MARKETS.find((market) => {
    if (code && market.state !== code) return false;
    return normalizePlace(market.city) === name;
  });
}

export function marketsForState(state?: string): MarketCity[] {
  const code = state?.trim().toUpperCase();
  if (code === "CO") return COLORADO_CITIES;
  if (!code) return [];
  return ALL_MARKETS.filter((market) => market.state === code);
}

export function firstSearchValue(value: string | string[] | undefined) {
  return typeof value === "string" ? value : value?.[0] ?? "";
}

export type ExplorePlace = {
  zip?: string;
  city?: string;
  state?: string;
  location?: string;
};

const STATE_NAMES: Record<string, string> = {
  AZ: "Arizona",
  CA: "California",
  CO: "Colorado",
  FL: "Florida",
  GA: "Georgia",
  IL: "Illinois",
  MA: "Massachusetts",
  MN: "Minnesota",
  NY: "New York",
  TX: "Texas",
  WA: "Washington",
};

const STATE_BY_NAME = Object.fromEntries(
  Object.entries(STATE_NAMES).map(([code, name]) => [name.toLowerCase(), code]),
);

export function stateCode(value?: string) {
  const trimmed = value?.trim();
  if (!trimmed) return "";
  if (trimmed.length === 2) return trimmed.toUpperCase();
  return STATE_BY_NAME[trimmed.toLowerCase()] ?? "";
}

export function stateLabel(value?: string) {
  const code = stateCode(value);
  return (code && STATE_NAMES[code]) || value?.trim() || "";
}

export function parsePlaceInput(value?: string): ExplorePlace {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) return {};
  if (/^\d{5}$/.test(trimmed)) {
    const market = getMarketByZip(trimmed);
    return market ? { zip: trimmed, city: market.city, state: market.state } : { zip: trimmed };
  }

  const parts = trimmed.split(/[,\s]+/).filter(Boolean);
  const last = parts.at(-1) ?? "";
  const lastAsState = stateCode(last);
  if (lastAsState && parts.length > 1) {
    const city = parts.slice(0, -1).join(" ");
    const matched = findMarketCity(city, lastAsState);
    return {
      city: matched?.city || city,
      state: lastAsState,
      zip: matched?.zip,
      location: trimmed,
    };
  }

  if (lastAsState && (last.length === 2 || Boolean(STATE_BY_NAME[last.toLowerCase()]))) {
    return { state: lastAsState, location: trimmed };
  }

  const matched = findMarketCity(trimmed);
  if (matched) {
    return { city: matched.city, state: matched.state, zip: matched.zip, location: trimmed };
  }

  return { city: trimmed, location: trimmed };
}

export function getExplorePlaceLabel(place: ExplorePlace) {
  if (place.city?.trim()) return place.city.trim();
  const namedState = stateLabel(place.state);
  if (namedState) return namedState;
  if (place.location?.trim()) {
    const parsed = parsePlaceInput(place.location);
    return parsed.city || stateLabel(place.location) || place.location.trim();
  }
  return "your area";
}
