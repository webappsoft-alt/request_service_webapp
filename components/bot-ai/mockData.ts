import type { MockCategory, MockProvider, MockService, MockSubService } from "./types";

/**
 * Static preview data for the AI assistant. Category slugs match lib/data/services.ts
 * so quote links resolve; provider slugs with a profile match lib/data/providers.ts.
 * Replace with API data once the assistant backend is wired.
 */

export const mockCategories: MockCategory[] = [
  {
    slug: "plumbing",
    name: "Plumbing",
    emoji: "🚰",
    keywords: [
      "plumb", "pipe", "leak", "drip", "tap", "faucet", "sink", "toilet", "drain",
      "clog", "sewer", "manhole", "main hole", "water heater", "geyser", "shower", "water pressure",
      "burst", "flood", "garbage disposal",
    ],
  },
  {
    slug: "electrical",
    name: "Electrical",
    emoji: "⚡",
    keywords: [
      "electric", "wiring", "wire", "outlet", "socket", "switch", "breaker", "fuse", "spark",
      "power", "light", "lighting", "fixture", "panel", "short circuit", "ev charger", "ceiling fan",
    ],
  },
  {
    slug: "hvac",
    name: "HVAC",
    emoji: "❄️",
    keywords: [
      "hvac", "ac", "a/c", "air condition", "aircon", "cooling", "heating", "heater", "furnace",
      "heat pump", "thermostat", "duct", "vent", "not cooling", "not heating",
    ],
  },
  {
    slug: "handyman",
    name: "Handyman",
    emoji: "🛠️",
    keywords: [
      "handyman", "fix", "repair", "mount", "tv", "shelf", "door", "drywall", "hole in wall",
      "cabinet", "furniture", "assemble", "hinge", "window",
    ],
  },
  {
    slug: "roofing",
    name: "Roofing",
    emoji: "🏠",
    keywords: ["roof", "shingle", "gutter", "ceiling leak", "attic", "skylight", "flashing"],
  },
  {
    slug: "house-cleaning",
    name: "House Cleaning",
    emoji: "🧽",
    keywords: ["clean", "cleaning", "maid", "deep clean", "move out", "move-out", "carpet"],
  },
  {
    slug: "painting",
    name: "Painting",
    emoji: "🎨",
    keywords: ["paint", "painting", "repaint", "wall color", "stain", "primer"],
  },
  {
    slug: "pest-control",
    name: "Pest Control",
    emoji: "🐜",
    keywords: ["pest", "termite", "ant", "roach", "cockroach", "rodent", "mice", "rat", "bed bug", "wasp"],
  },
  {
    slug: "landscaping",
    name: "Landscaping",
    emoji: "🌿",
    keywords: ["lawn", "garden", "landscap", "yard", "tree", "mow", "sprinkler", "irrigation", "hedge"],
  },
];

export const mockSubServices: MockSubService[] = [
  { id: "pipe-repair", categorySlug: "plumbing", name: "Pipe Repair", keywords: ["pipe", "burst", "main hole", "manhole", "leak"] },
  { id: "drain-cleaning", categorySlug: "plumbing", name: "Drain Cleaning", keywords: ["drain", "clog", "blocked", "sewer", "backed up", "slow drain"] },
  { id: "faucet-repair", categorySlug: "plumbing", name: "Faucet / Tap Repair", keywords: ["tap", "faucet", "drip", "sink"] },
  { id: "toilet-repair", categorySlug: "plumbing", name: "Toilet Repair", keywords: ["toilet", "flush", "running toilet"] },
  { id: "water-heater", categorySlug: "plumbing", name: "Water Heater", keywords: ["water heater", "geyser", "no hot water", "hot water"] },

  { id: "outlet-repair", categorySlug: "electrical", name: "Outlet & Switch Repair", keywords: ["outlet", "socket", "switch"] },
  { id: "breaker-panel", categorySlug: "electrical", name: "Breaker / Panel", keywords: ["breaker", "panel", "fuse", "tripping", "trips"] },
  { id: "lighting-install", categorySlug: "electrical", name: "Lighting Install", keywords: ["light", "fixture", "ceiling fan", "lighting"] },

  { id: "ac-repair", categorySlug: "hvac", name: "AC Repair", keywords: ["ac", "a/c", "air condition", "not cooling", "aircon", "cooling"] },
  { id: "furnace-repair", categorySlug: "hvac", name: "Heating / Furnace", keywords: ["furnace", "heating", "heater", "not heating", "heat pump"] },
  { id: "hvac-tuneup", categorySlug: "hvac", name: "Seasonal Tune-up", keywords: ["tune", "maintenance", "service", "filter"] },

  { id: "tv-mounting", categorySlug: "handyman", name: "TV & Shelf Mounting", keywords: ["tv", "mount", "shelf"] },
  { id: "drywall-repair", categorySlug: "handyman", name: "Drywall Repair", keywords: ["drywall", "hole in wall", "patch"] },
  { id: "door-repair", categorySlug: "handyman", name: "Door & Window Fixes", keywords: ["door", "hinge", "window", "lock"] },

  { id: "roof-leak", categorySlug: "roofing", name: "Roof Leak Repair", keywords: ["roof leak", "ceiling leak", "leak"] },
  { id: "gutter-cleaning", categorySlug: "roofing", name: "Gutter Cleaning", keywords: ["gutter"] },
  { id: "roof-inspection", categorySlug: "roofing", name: "Roof Inspection", keywords: ["inspection", "inspect", "shingle"] },

  { id: "standard-clean", categorySlug: "house-cleaning", name: "Standard Cleaning", keywords: ["clean", "maid", "regular"] },
  { id: "deep-clean", categorySlug: "house-cleaning", name: "Deep Cleaning", keywords: ["deep clean", "deep"] },
  { id: "move-out-clean", categorySlug: "house-cleaning", name: "Move-out Cleaning", keywords: ["move out", "move-out"] },

  { id: "interior-paint", categorySlug: "painting", name: "Interior Painting", keywords: ["interior", "room", "wall"] },
  { id: "exterior-paint", categorySlug: "painting", name: "Exterior Painting", keywords: ["exterior", "outside", "siding"] },

  { id: "general-pest", categorySlug: "pest-control", name: "General Pest Treatment", keywords: ["ant", "roach", "cockroach", "pest", "spider"] },
  { id: "termite", categorySlug: "pest-control", name: "Termite Inspection", keywords: ["termite"] },
  { id: "rodent", categorySlug: "pest-control", name: "Rodent Control", keywords: ["rodent", "mice", "mouse", "rat"] },

  { id: "lawn-care", categorySlug: "landscaping", name: "Lawn Care", keywords: ["lawn", "mow", "grass"] },
  { id: "irrigation", categorySlug: "landscaping", name: "Sprinkler / Irrigation", keywords: ["sprinkler", "irrigation"] },
  { id: "tree-trim", categorySlug: "landscaping", name: "Tree & Hedge Trimming", keywords: ["tree", "hedge", "trim"] },
];

export const mockProviders: MockProvider[] = [
  {
    id: "prov-summit",
    slug: "summit-home-systems",
    name: "Summit Home Systems",
    initials: "SH",
    accent: "from-sky-500 to-blue-700",
    rating: 4.9,
    reviewCount: 214,
    verified: true,
    distanceMiles: 2.4,
    city: "Austin, TX",
    categorySlugs: ["plumbing", "hvac"],
    responseTime: "Replies in ~15 min",
    yearsInBusiness: 12,
  },
  {
    id: "prov-flowright",
    slug: null,
    name: "FlowRight Plumbing Co.",
    initials: "FR",
    accent: "from-cyan-500 to-teal-700",
    rating: 4.8,
    reviewCount: 132,
    verified: true,
    distanceMiles: 3.9,
    city: "Round Rock, TX",
    categorySlugs: ["plumbing"],
    responseTime: "Replies in ~30 min",
    yearsInBusiness: 8,
  },
  {
    id: "prov-harbor",
    slug: "harbor-electric",
    name: "Harbor Electric",
    initials: "HE",
    accent: "from-amber-400 to-orange-600",
    rating: 4.8,
    reviewCount: 176,
    verified: true,
    distanceMiles: 4.1,
    city: "Boston, MA",
    categorySlugs: ["electrical"],
    responseTime: "Replies in ~20 min",
    yearsInBusiness: 15,
  },
  {
    id: "prov-voltline",
    slug: null,
    name: "VoltLine Electricians",
    initials: "VL",
    accent: "from-yellow-400 to-amber-600",
    rating: 4.6,
    reviewCount: 58,
    verified: false,
    distanceMiles: 6.7,
    city: "Cambridge, MA",
    categorySlugs: ["electrical"],
    responseTime: "Replies in ~1 hr",
    yearsInBusiness: 5,
  },
  {
    id: "prov-oak-iron",
    slug: "oak-and-iron-handyman",
    name: "Oak & Iron Handyman",
    initials: "OI",
    accent: "from-stone-500 to-stone-800",
    rating: 4.6,
    reviewCount: 98,
    verified: true,
    distanceMiles: 1.8,
    city: "Charlotte, NC",
    categorySlugs: ["handyman", "plumbing"],
    responseTime: "Replies in ~45 min",
    yearsInBusiness: 9,
  },
  {
    id: "prov-northstar",
    slug: "northstar-roofing",
    name: "Northstar Roofing",
    initials: "NR",
    accent: "from-slate-500 to-slate-800",
    rating: 4.8,
    reviewCount: 141,
    verified: true,
    distanceMiles: 5.2,
    city: "Minneapolis, MN",
    categorySlugs: ["roofing"],
    responseTime: "Replies in ~1 hr",
    yearsInBusiness: 18,
  },
  {
    id: "prov-bright-path",
    slug: "bright-path-cleaning",
    name: "Bright Path Cleaning",
    initials: "BP",
    accent: "from-emerald-400 to-emerald-700",
    rating: 4.9,
    reviewCount: 305,
    verified: true,
    distanceMiles: 2.9,
    city: "Seattle, WA",
    categorySlugs: ["house-cleaning"],
    responseTime: "Replies in ~10 min",
    yearsInBusiness: 7,
  },
  {
    id: "prov-cedar",
    slug: "cedar-line-painting",
    name: "Cedar Line Painting",
    initials: "CL",
    accent: "from-rose-400 to-rose-700",
    rating: 4.7,
    reviewCount: 87,
    verified: true,
    distanceMiles: 3.3,
    city: "Denver, CO",
    categorySlugs: ["painting"],
    responseTime: "Replies in ~40 min",
    yearsInBusiness: 11,
  },
  {
    id: "prov-shield",
    slug: "shield-pest-solutions",
    name: "Shield Pest Solutions",
    initials: "SP",
    accent: "from-lime-500 to-green-700",
    rating: 4.8,
    reviewCount: 119,
    verified: true,
    distanceMiles: 4.6,
    city: "Tampa, FL",
    categorySlugs: ["pest-control"],
    responseTime: "Replies in ~25 min",
    yearsInBusiness: 10,
  },
  {
    id: "prov-greenfield",
    slug: "greenfield-landscape",
    name: "Greenfield Landscape",
    initials: "GL",
    accent: "from-green-500 to-emerald-800",
    rating: 4.7,
    reviewCount: 76,
    verified: true,
    distanceMiles: 6.1,
    city: "Phoenix, AZ",
    categorySlugs: ["landscaping"],
    responseTime: "Replies in ~1 hr",
    yearsInBusiness: 6,
  },
  {
    id: "prov-coolbreeze",
    slug: null,
    name: "CoolBreeze Heating & Air",
    initials: "CB",
    accent: "from-indigo-400 to-indigo-700",
    rating: 4.7,
    reviewCount: 93,
    verified: true,
    distanceMiles: 3.5,
    city: "Austin, TX",
    categorySlugs: ["hvac"],
    responseTime: "Replies in ~35 min",
    yearsInBusiness: 9,
  },
];

export const mockServices: MockService[] = [
  // Plumbing
  { id: "svc-summit-leak", providerId: "prov-summit", categorySlug: "plumbing", subServiceId: "pipe-repair", title: "Leak Detection & Pipe Repair", description: "Locate the leak, replace the damaged section, and pressure-test the line.", pricing: { type: "range", min: 120, max: 280 }, duration: "1–3 hrs" },
  { id: "svc-summit-drain", providerId: "prov-summit", categorySlug: "plumbing", subServiceId: "drain-cleaning", title: "Drain Snaking", description: "Clear one clogged sink, tub, or floor drain with a power auger.", pricing: { type: "fixed", amount: 99 }, duration: "~1 hr" },
  { id: "svc-summit-faucet", providerId: "prov-summit", categorySlug: "plumbing", subServiceId: "faucet-repair", title: "Faucet Repair or Swap", description: "Fix a dripping tap or install a customer-supplied faucet.", pricing: { type: "fixed", amount: 89 }, duration: "~1 hr" },
  { id: "svc-summit-heater", providerId: "prov-summit", categorySlug: "plumbing", subServiceId: "water-heater", title: "Water Heater Diagnostic", description: "Find why there's no hot water and quote the fix on the spot.", pricing: { type: "fixed", amount: 79 }, duration: "~45 min" },
  { id: "svc-flow-main", providerId: "prov-flowright", categorySlug: "plumbing", subServiceId: "pipe-repair", title: "Main Line Leak Repair", description: "Excavate-free repair for leaking main and sewer access lines.", pricing: { type: "range", min: 250, max: 650 }, duration: "Half day" },
  { id: "svc-flow-camera", providerId: "prov-flowright", categorySlug: "plumbing", subServiceId: "drain-cleaning", title: "Camera Sewer Inspection", description: "HD camera run with recorded footage and a written report.", pricing: { type: "fixed", amount: 149 }, duration: "~1 hr" },
  { id: "svc-flow-toilet", providerId: "prov-flowright", categorySlug: "plumbing", subServiceId: "toilet-repair", title: "Toilet Repair", description: "Fix running, leaking, or weak-flush toilets. Parts billed at cost.", pricing: { type: "range", min: 80, max: 180 }, duration: "~1 hr" },
  { id: "svc-oak-faucet", providerId: "prov-oak-iron", categorySlug: "plumbing", subServiceId: "faucet-repair", title: "Tap & Fixture Install", description: "Replace taps, shower heads, and supply lines.", pricing: { type: "fixed", amount: 75 }, duration: "~1 hr" },

  // Electrical
  { id: "svc-harbor-outlet", providerId: "prov-harbor", categorySlug: "electrical", subServiceId: "outlet-repair", title: "Outlet / Switch Replacement", description: "Replace up to 3 outlets or switches, including GFCI.", pricing: { type: "fixed", amount: 129 }, duration: "~1 hr" },
  { id: "svc-harbor-panel", providerId: "prov-harbor", categorySlug: "electrical", subServiceId: "breaker-panel", title: "Breaker Troubleshooting", description: "Diagnose tripping breakers and replace faulty ones.", pricing: { type: "range", min: 150, max: 350 }, duration: "1–2 hrs" },
  { id: "svc-harbor-light", providerId: "prov-harbor", categorySlug: "electrical", subServiceId: "lighting-install", title: "Light Fixture Install", description: "Mount and wire a light fixture or ceiling fan.", pricing: { type: "fixed", amount: 119 }, duration: "~1 hr" },
  { id: "svc-volt-ev", providerId: "prov-voltline", categorySlug: "electrical", title: "EV Charger Install", description: "Level 2 charger install with a dedicated circuit.", pricing: { type: "range", min: 450, max: 1200 }, duration: "Half day" },

  // HVAC
  { id: "svc-summit-ac", providerId: "prov-summit", categorySlug: "hvac", subServiceId: "ac-repair", title: "AC Diagnostic", description: "Full cooling system check with a repair quote.", pricing: { type: "fixed", amount: 89 }, duration: "~1 hr" },
  { id: "svc-summit-tune", providerId: "prov-summit", categorySlug: "hvac", subServiceId: "hvac-tuneup", title: "Seasonal Tune-up", description: "Clean coils, check refrigerant, replace filter.", pricing: { type: "fixed", amount: 129 }, duration: "1–2 hrs" },
  { id: "svc-cool-furnace", providerId: "prov-coolbreeze", categorySlug: "hvac", subServiceId: "furnace-repair", title: "Furnace Repair", description: "Ignition, blower, and thermostat troubleshooting.", pricing: { type: "range", min: 140, max: 420 }, duration: "1–3 hrs" },
  { id: "svc-cool-ac", providerId: "prov-coolbreeze", categorySlug: "hvac", subServiceId: "ac-repair", title: "AC Repair Visit", description: "Same-day AC repair for most common failures.", pricing: { type: "range", min: 120, max: 480 }, duration: "1–3 hrs" },

  // Handyman
  { id: "svc-oak-tv", providerId: "prov-oak-iron", categorySlug: "handyman", subServiceId: "tv-mounting", title: "TV Mounting", description: "Mount a TV up to 75\" on drywall, cables concealed.", pricing: { type: "fixed", amount: 99 }, duration: "~1 hr" },
  { id: "svc-oak-drywall", providerId: "prov-oak-iron", categorySlug: "handyman", subServiceId: "drywall-repair", title: "Drywall Patch", description: "Patch, sand, and prime holes up to 12\".", pricing: { type: "range", min: 90, max: 220 }, duration: "1–2 hrs" },
  { id: "svc-oak-door", providerId: "prov-oak-iron", categorySlug: "handyman", subServiceId: "door-repair", title: "Door Adjustment", description: "Fix sticking doors, hinges, and latches.", pricing: { type: "fixed", amount: 79 }, duration: "~1 hr" },

  // Roofing
  { id: "svc-north-leak", providerId: "prov-northstar", categorySlug: "roofing", subServiceId: "roof-leak", title: "Roof Leak Repair", description: "Locate and seal leaks, replace damaged shingles.", pricing: { type: "range", min: 300, max: 900 }, duration: "Half day" },
  { id: "svc-north-gutter", providerId: "prov-northstar", categorySlug: "roofing", subServiceId: "gutter-cleaning", title: "Gutter Cleaning", description: "Clean gutters and downspouts on a single-story home.", pricing: { type: "fixed", amount: 149 }, duration: "1–2 hrs" },
  { id: "svc-north-inspect", providerId: "prov-northstar", categorySlug: "roofing", subServiceId: "roof-inspection", title: "Roof Inspection", description: "Photo report covering shingles, flashing, and vents.", pricing: { type: "fixed", amount: 129 }, duration: "~1 hr" },

  // Cleaning
  { id: "svc-bright-std", providerId: "prov-bright-path", categorySlug: "house-cleaning", subServiceId: "standard-clean", title: "Standard Home Clean", description: "Kitchen, bathrooms, dusting, and floors.", pricing: { type: "fixed", amount: 139 }, duration: "2–3 hrs" },
  { id: "svc-bright-deep", providerId: "prov-bright-path", categorySlug: "house-cleaning", subServiceId: "deep-clean", title: "Deep Clean", description: "Inside appliances, baseboards, and detailed scrubbing.", pricing: { type: "range", min: 220, max: 380 }, duration: "4–6 hrs" },
  { id: "svc-bright-move", providerId: "prov-bright-path", categorySlug: "house-cleaning", subServiceId: "move-out-clean", title: "Move-out Clean", description: "Deposit-ready clean of an empty home.", pricing: { type: "range", min: 260, max: 450 }, duration: "4–6 hrs" },

  // Painting
  { id: "svc-cedar-room", providerId: "prov-cedar", categorySlug: "painting", subServiceId: "interior-paint", title: "Single Room Repaint", description: "Two coats on walls of one room, paint included.", pricing: { type: "range", min: 350, max: 650 }, duration: "1 day" },
  { id: "svc-cedar-ext", providerId: "prov-cedar", categorySlug: "painting", subServiceId: "exterior-paint", title: "Exterior Estimate Visit", description: "On-site measure and a written exterior painting quote.", pricing: { type: "fixed", amount: 0 }, duration: "~45 min" },

  // Pest control
  { id: "svc-shield-general", providerId: "prov-shield", categorySlug: "pest-control", subServiceId: "general-pest", title: "General Pest Treatment", description: "Interior and perimeter treatment for common pests.", pricing: { type: "fixed", amount: 119 }, duration: "~1 hr" },
  { id: "svc-shield-termite", providerId: "prov-shield", categorySlug: "pest-control", subServiceId: "termite", title: "Termite Inspection", description: "Full inspection with a written report.", pricing: { type: "fixed", amount: 95 }, duration: "~1 hr" },
  { id: "svc-shield-rodent", providerId: "prov-shield", categorySlug: "pest-control", subServiceId: "rodent", title: "Rodent Exclusion", description: "Seal entry points and set traps, one follow-up visit.", pricing: { type: "range", min: 180, max: 420 }, duration: "2–3 hrs" },

  // Landscaping
  { id: "svc-green-lawn", providerId: "prov-greenfield", categorySlug: "landscaping", subServiceId: "lawn-care", title: "Lawn Mow & Edge", description: "Mow, edge, and blow for an average yard.", pricing: { type: "fixed", amount: 59 }, duration: "~1 hr" },
  { id: "svc-green-sprinkler", providerId: "prov-greenfield", categorySlug: "landscaping", subServiceId: "irrigation", title: "Sprinkler Repair", description: "Fix broken heads, leaks, and controller issues.", pricing: { type: "range", min: 90, max: 260 }, duration: "1–2 hrs" },
  { id: "svc-green-trim", providerId: "prov-greenfield", categorySlug: "landscaping", subServiceId: "tree-trim", title: "Hedge & Tree Trim", description: "Shape hedges and trim small trees under 15 ft.", pricing: { type: "range", min: 150, max: 400 }, duration: "Half day" },
];

export function findCategory(slug: string | null | undefined) {
  return mockCategories.find((category) => category.slug === slug);
}

export function findSubService(id: string | null | undefined) {
  return mockSubServices.find((sub) => sub.id === id);
}

export function findProvider(id: string | null | undefined) {
  return mockProviders.find((provider) => provider.id === id);
}

export function providersForCategory(categorySlug: string) {
  return mockProviders
    .filter((provider) => provider.categorySlugs.includes(categorySlug))
    .sort((a, b) => Number(b.verified) - Number(a.verified) || b.rating - a.rating);
}

/** Provider's services in the category, with the chosen sub-service first. */
export function servicesForProvider(providerId: string, categorySlug: string | null, subServiceId: string | null) {
  const own = mockServices.filter(
    (service) =>
      service.providerId === providerId && (!categorySlug || service.categorySlug === categorySlug),
  );
  return [...own].sort(
    (a, b) => Number(b.subServiceId === subServiceId) - Number(a.subServiceId === subServiceId),
  );
}
