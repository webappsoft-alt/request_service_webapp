import { findSubServiceValue, getSubServices } from "@/lib/data/service-directory";
import { getServiceCategoryBySlug } from "@/lib/data/services";
import { serviceSuggestions, type ServiceSuggestion } from "@/lib/data/service-suggestions";

const synonyms: Record<string, string[]> = {
  leaking: ["leak", "leaky", "drip", "dripping"],
  leak: ["leaking", "leaky", "drip", "dripping"],
  leaky: ["leak", "leaking"],
  dripping: ["drip", "leak", "leaking"],
  drip: ["dripping", "leak"],
  clogged: ["clog", "backup", "blocked"],
  clog: ["clogged", "unclog"],
  roof: ["roofing", "shingle", "shingles"],
  roofing: ["roof"],
  ac: ["air", "cooling", "conditioner"],
  air: ["ac", "cooling"],
  cooling: ["ac", "air"],
  heater: ["heating", "furnace"],
  heating: ["heater", "furnace", "heat"],
  furnace: ["heater", "heating"],
  clean: ["cleaning", "maid", "housekeeper"],
  cleaning: ["clean", "maid"],
  maid: ["cleaning", "housekeeper"],
  paint: ["painting", "painter"],
  painting: ["paint", "painter"],
  bug: ["pest", "insect", "bugs"],
  bugs: ["pest", "insect", "bug"],
  pest: ["bug", "bugs", "exterminator"],
  yard: ["lawn", "landscaping"],
  lawn: ["yard", "landscaping"],
  electrician: ["electrical", "wiring"],
  electrical: ["electrician", "wiring"],
  plumber: ["plumbing"],
  plumbing: ["plumber"],
  remodel: ["remodeling", "renovation"],
  remodeling: ["remodel"],
};

const shortTokens = new Set(["ac", "ev", "tv"]);
const stopWords = new Set(["my", "is", "the", "a", "an", "to", "for", "and", "or", "in", "on", "of", "me", "i"]);

export type ServiceMatch = {
  service: string;
  job?: string;
  label: string;
};

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

function tokens(value: string) {
  return normalize(value)
    .split(" ")
    .filter((token) => token.length >= 2 || shortTokens.has(token));
}

function expandToken(token: string) {
  return [token, ...(synonyms[token] ?? [])];
}

function suggestionHaystack(item: ServiceSuggestion) {
  return normalize([item.label, item.service, ...item.keywords].join(" "));
}

function scoreSuggestion(item: ServiceSuggestion, query: string, queryTokens: string[]) {
  const label = normalize(item.label);
  const haystack = suggestionHaystack(item);
  let score = 0;

  if (label === query) score += 200;
  if (label.startsWith(query)) score += 120;
  if (label.split(" ").some((word) => word.startsWith(query))) score += 90;
  if (label.includes(query)) score += 70;

  let matchedTokens = 0;
  for (const token of queryTokens) {
    const variants = expandToken(token);
    const hit = variants.some((variant) => haystack.includes(variant) || haystack.split(" ").some((word) => word.startsWith(variant)));
    if (hit) {
      matchedTokens += 1;
      score += 18;
    }
  }

  if (queryTokens.length && matchedTokens === queryTokens.length) score += 50;
  if (matchedTokens === 0 && !label.includes(query)) return 0;

  const leakOnly = queryTokens.length === 1 && (query === "leak" || query === "leaking");
  if (leakOnly) {
    const roofRelated = /roof|gutter|skylight|shingle|flashing/.test(label);
    if (item.service === "plumbing" && !roofRelated) score += 45;
    if (item.service === "roofing" && !roofRelated) score -= 25;
  }

  score += item.priority * 20;
  score += Math.max(0, 8 - item.label.split(" ").length);

  return score;
}

function toMatch(item: ServiceSuggestion): ServiceMatch {
  return {
    service: item.service,
    job: item.job,
    label: item.label,
  };
}

export function suggestServices(query: string, limit = 8): ServiceMatch[] {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  const normalized = normalize(trimmed);
  const queryTokens = tokens(trimmed).filter((token) => !stopWords.has(token));
  if (!normalized || !queryTokens.length) return [];

  return serviceSuggestions
    .map((item) => ({ item, score: scoreSuggestion(item, normalized, queryTokens) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.item.label.localeCompare(b.item.label))
    .filter((entry, index, list) => list.findIndex((item) => item.item.label === entry.item.label) === index)
    .slice(0, limit)
    .map((entry) => toMatch(entry.item));
}

export function matchServiceQuery(query: string): ServiceMatch | undefined {
  const normalized = normalize(query);
  if (!normalized) return undefined;

  const exact = serviceSuggestions.find((item) => normalize(item.label) === normalized);
  if (exact) return toMatch(exact);

  return suggestServices(query, 8)[0];
}

export type SearchConfidence = "exact-job" | "exact-category" | "related";

export type SearchIntent = {
  confidence: SearchConfidence;
  query: string;
  service?: string;
  job?: string;
  zip?: string;
  location?: string;
};

export function resolveSearchIntent(input: {
  query?: string;
  picked?: ServiceMatch;
  service?: string;
  job?: string;
  zip?: string;
  location?: string;
}): SearchIntent {
  const query = input.query?.trim() ?? input.picked?.label ?? "";
  const zip = input.zip || extractZip(input.location ?? "") || undefined;
  const location = input.location?.trim() || undefined;

  if (input.picked) {
    return {
      confidence: input.picked.job ? "exact-job" : input.picked.service ? "exact-category" : "related",
      query: input.picked.label,
      service: input.picked.service,
      job: input.picked.job,
      zip,
      location,
    };
  }

  const service = input.service && getServiceCategoryBySlug(input.service) ? input.service : undefined;
  if (service && input.job) {
    return { confidence: "exact-job", query, service, job: input.job, zip, location };
  }

  if (service) {
    const sub = findSubServiceValue(service, query, input.job);
    const option = getSubServices(service)?.options.find((item) => item.value === sub);
    const exactSub = option && normalize(option.label) === normalize(query);
    if (exactSub || input.job) {
      return {
        confidence: "exact-job",
        query,
        service,
        job: option?.job ?? option?.value ?? input.job,
        zip,
        location,
      };
    }
    return { confidence: "exact-category", query, service, zip, location };
  }

  const match = query ? matchServiceQuery(query) : undefined;
  if (!match) return { confidence: "related", query, zip, location };

  const exactLabel = serviceSuggestions.some((item) => normalize(item.label) === normalize(query));
  if (exactLabel && match.job) {
    return { confidence: "exact-job", query: match.label, service: match.service, job: match.job, zip, location };
  }
  if (exactLabel && match.service) {
    return { confidence: "exact-category", query: match.label, service: match.service, zip, location };
  }

  const hits = suggestServices(query, 8);
  const sameService = hits.length > 0 && hits.every((hit) => hit.service === hits[0]?.service);
  if (sameService && match.job) {
    return { confidence: "exact-job", query, service: match.service, job: match.job, zip, location };
  }
  if (sameService && match.service) {
    return { confidence: "exact-category", query, service: match.service, zip, location };
  }

  return { confidence: "related", query, service: match.service, zip, location };
}

export function servicesHref(intent: SearchIntent) {
  const params = new URLSearchParams();
  if (intent.query) params.set("q", intent.query);
  if (intent.service) params.set("service", intent.service);
  if (intent.job) params.set("job", intent.job);
  if (intent.zip) params.set("zip", intent.zip);
  if (intent.location && intent.location !== intent.zip) params.set("loc", intent.location);
  const query = params.toString();
  return query ? `/services?${query}` : "/services";
}

export function extractZip(value: string) {
  return value.trim().match(/\b(\d{5})\b/)?.[1];
}

export function highlightQuery(label: string, query: string) {
  const needle = query.trim();
  if (!needle) return [{ text: label, match: false }];

  const index = label.toLowerCase().indexOf(needle.toLowerCase());
  if (index >= 0) {
    return [
      { text: label.slice(0, index), match: false },
      { text: label.slice(index, index + needle.length), match: true },
      { text: label.slice(index + needle.length), match: false },
    ].filter((part) => part.text);
  }

  const parts: { text: string; match: boolean }[] = [];
  const queryTokens = tokens(needle);
  const wordPattern = /([A-Za-z0-9]+|[^A-Za-z0-9]+)/g;
  for (const chunk of label.match(wordPattern) ?? [label]) {
    const lower = chunk.toLowerCase();
    const matched = queryTokens.some(
      (token) => expandToken(token).some((variant) => lower.startsWith(variant) || variant.startsWith(lower))
    );
    const last = parts.at(-1);
    if (last && last.match === matched) last.text += chunk;
    else parts.push({ text: chunk, match: matched && /[A-Za-z0-9]/.test(chunk) });
  }

  return parts.filter((part) => part.text);
}
