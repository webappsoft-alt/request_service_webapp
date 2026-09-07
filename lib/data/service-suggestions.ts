import { slugifyJob } from "@/lib/data/jobs";
import { serviceCategories } from "@/lib/data/services";
import type { ServiceCategorySlug } from "@/lib/types";

export type ServiceSuggestion = {
  label: string;
  service: ServiceCategorySlug;
  job?: string;
  keywords: string[];
  priority: number;
};

type StemSpec = {
  stem: string;
  job?: string;
  actions?: readonly string[];
  places?: readonly string[];
  problems?: readonly string[];
  extras?: readonly string[];
};

type CategoryPack = {
  service: ServiceCategorySlug;
  extras: readonly string[];
  stems: readonly StemSpec[];
};

const repairs = ["repair", "replacement", "installation"] as const;
const inspect = ["inspection", "repair"] as const;
const clean = ["cleaning", "deep clean"] as const;

const packs: readonly CategoryPack[] = [
  {
    service: "plumbing",
    extras: [
      "Plumber",
      "Plumbing",
      "Plumbing repair",
      "Emergency plumber",
      "Licensed plumber",
      "No hot water",
      "Low water pressure",
      "Burst pipe",
      "Frozen pipe",
      "Pipe leak",
      "Slab leak",
      "Sewer backup",
      "Wet basement",
      "Water in basement",
      "Leaking under sink",
      "Water heater not heating",
      "Water heater leaking",
      "Toilet running",
      "Toilet overflowing",
      "Toilet not flushing",
      "Clogged toilet",
      "Clogged drain",
      "Slow drain",
      "Dripping faucet",
      "Leaking faucet",
      "Garbage disposal jammed",
      "Shower not draining",
      "Tub not draining",
      "Main water shutoff",
      "Leak repair",
      "Water leak",
      "Plumbing leak",
      "Kitchen plumber",
      "Bathroom plumber",
      "Emergency leak",
    ],
    stems: [
      { stem: "faucet", job: "Faucet installation", actions: repairs, places: ["kitchen", "bathroom"], problems: ["leaking", "dripping"] },
      { stem: "sink", job: "Fixture replacement", actions: repairs, places: ["kitchen", "bathroom"], problems: ["leaking", "clogged"] },
      { stem: "toilet", job: "Toilet repair", actions: [...repairs, "unclog"], places: ["bathroom", "half bath"], problems: ["running", "clogged", "leaking"] },
      { stem: "drain", job: "Drain cleaning", actions: ["cleaning", "unclog", "repair"], places: ["kitchen", "bathroom", "shower", "basement"], problems: ["clogged", "slow"] },
      { stem: "pipe", job: "Leak detection and repair", actions: repairs, places: ["kitchen", "bathroom", "basement"], problems: ["leaking", "burst", "frozen"] },
      { stem: "water heater", job: "Water heater installation", actions: [...repairs, "flush"], problems: ["leaking", "not heating"] },
      { stem: "tankless water heater", job: "Water heater installation", actions: repairs },
      { stem: "garbage disposal", job: "Garbage disposal repair", actions: [...repairs, "unjam"], problems: ["jammed", "leaking"] },
      { stem: "shower", job: "Fixture replacement", actions: repairs, problems: ["leaking"] },
      { stem: "bathtub", job: "Fixture replacement", actions: repairs, problems: ["leaking"] },
      { stem: "sump pump", job: "Emergency shutoff support", actions: [...repairs, "inspection"] },
      { stem: "sewer line", job: "Sewer line inspection", actions: inspect },
      { stem: "water line", job: "Leak detection and repair", actions: repairs },
      { stem: "dishwasher hookup", job: "Fixture replacement", actions: ["installation", "repair"] },
      { stem: "washing machine hookup", job: "Fixture replacement", actions: ["installation", "repair"] },
      { stem: "water softener", actions: [...repairs, "inspection"] },
      { stem: "outdoor faucet", job: "Faucet installation", actions: repairs, problems: ["leaking"] },
      { stem: "shower valve", job: "Fixture replacement", actions: repairs, problems: ["leaking"] },
      { stem: "tub spout", job: "Fixture replacement", actions: repairs, problems: ["leaking"] },
      { stem: "bidet", actions: repairs },
      { stem: "water filter", actions: [...repairs, "installation"] },
      { stem: "recirculating pump", actions: repairs },
      { stem: "ejector pump", actions: repairs },
      { stem: "hose bib", job: "Faucet installation", actions: repairs, problems: ["leaking"] },
    ],
  },
  {
    service: "hvac",
    extras: [
      "HVAC",
      "HVAC repair",
      "HVAC technician",
      "Heating and cooling",
      "AC not cooling",
      "AC blowing warm air",
      "AC leaking water",
      "AC frozen",
      "AC not turning on",
      "No air conditioning",
      "No heat",
      "Furnace not heating",
      "Furnace blowing cold air",
      "Heater not working",
      "Thermostat not working",
      "Musty smell from vents",
      "Weak airflow",
      "High energy bill HVAC",
      "AC recharge",
      "Furnace tune-up",
      "Central air repair",
    ],
    stems: [
      { stem: "AC", job: "AC repair and recharge", actions: [...repairs, "recharge", "tune-up"], problems: ["not cooling", "frozen", "leaking"] },
      { stem: "air conditioner", job: "AC repair and recharge", actions: [...repairs, "recharge"], problems: ["not cooling"] },
      { stem: "central air", job: "AC installation", actions: repairs },
      { stem: "furnace", job: "Furnace service", actions: [...repairs, "tune-up"], problems: ["not heating"] },
      { stem: "heater", job: "Furnace service", actions: repairs, problems: ["not working"] },
      { stem: "heat pump", job: "Heat pump service", actions: repairs },
      { stem: "thermostat", job: "Thermostat installation", actions: repairs },
      { stem: "smart thermostat", job: "Thermostat installation", actions: ["installation"] },
      { stem: "duct", job: "Duct inspection", actions: ["inspection", "cleaning", "repair", "sealing"] },
      { stem: "ductwork", job: "Duct inspection", actions: ["cleaning", "repair"] },
      { stem: "air filter", job: "Seasonal maintenance", actions: ["replacement"] },
      { stem: "humidifier", actions: repairs },
      { stem: "mini split", job: "AC installation", actions: repairs },
      { stem: "boiler", job: "Furnace service", actions: repairs },
      { stem: "indoor air quality", job: "Duct cleaning", actions: ["inspection"] },
      { stem: "condenser", job: "AC repair and recharge", actions: repairs },
      { stem: "evaporator coil", job: "AC repair and recharge", actions: ["cleaning", "repair"] },
      { stem: "attic fan", actions: repairs },
      { stem: "vent register", job: "Duct inspection", actions: ["replacement", "cleaning"] },
      { stem: "condensate pump", job: "AC repair and recharge", actions: repairs },
      { stem: "AC tune-up", job: "Seasonal maintenance" },
    ],
  },
  {
    service: "electrical",
    extras: [
      "Electrician",
      "Electrical",
      "Electrical repair",
      "Licensed electrician",
      "Outlet not working",
      "Lights flickering",
      "Breaker tripping",
      "No power",
      "Sparking outlet",
      "Burnt outlet",
      "Fan wobbling",
      "Whole house surge protector",
      "Home electrician",
      "Emergency electrician",
    ],
    stems: [
      { stem: "outlet", job: "Outlet and switch repair", actions: repairs, places: ["kitchen", "bathroom", "bedroom", "garage"], problems: ["dead", "sparking"] },
      { stem: "GFCI outlet", job: "Outlet and switch repair", actions: repairs, places: ["kitchen", "bathroom"] },
      { stem: "light switch", job: "Outlet and switch repair", actions: repairs },
      { stem: "lighting", job: "Lighting installation", actions: repairs, places: ["kitchen", "bathroom", "bedroom"] },
      { stem: "recessed lighting", job: "Lighting installation", actions: ["installation"] },
      { stem: "ceiling fan", job: "Ceiling fan installation", actions: repairs },
      { stem: "chandelier", job: "Lighting installation", actions: ["installation"] },
      { stem: "breaker panel", job: "Panel upgrades", actions: ["upgrade", "inspection", "replacement"] },
      { stem: "electrical panel", job: "Panel upgrades", actions: ["upgrade", "replacement"] },
      { stem: "circuit breaker", job: "Dedicated circuit install", actions: ["replacement", "repair"] },
      { stem: "EV charger", job: "EV charger preparation", actions: ["installation"] },
      { stem: "wiring", job: "Safety inspections", actions: ["repair", "inspection"] },
      { stem: "smoke detector", job: "Smoke detector install", actions: ["installation", "replacement"] },
      { stem: "carbon monoxide detector", job: "Smoke detector install", actions: ["installation"] },
      { stem: "doorbell", actions: repairs },
      { stem: "landscape lighting", job: "Lighting installation", actions: repairs },
      { stem: "dimmer switch", job: "Outlet and switch repair", actions: repairs },
      { stem: "pendant light", job: "Lighting installation", actions: ["installation"] },
      { stem: "under cabinet lighting", job: "Lighting installation", actions: ["installation"] },
      { stem: "USB outlet", job: "Outlet and switch repair", actions: ["installation"] },
      { stem: "220V outlet", job: "Dedicated circuit install", actions: ["installation"] },
      { stem: "dryer outlet", job: "Dedicated circuit install", actions: repairs },
      { stem: "subpanel", job: "Panel upgrades", actions: ["installation", "upgrade"] },
      { stem: "whole house generator", actions: ["installation"] },
    ],
  },
  {
    service: "handyman",
    extras: [
      "Handyman",
      "Handyman services",
      "Home repair",
      "Small home repairs",
      "Assemble IKEA furniture",
      "Mount a TV",
      "Hang pictures",
      "Hole in wall",
      "Sticky door",
      "Squeaky door",
      "Loose cabinet door",
      "Home handyman",
      "Odd jobs handyman",
    ],
    stems: [
      { stem: "furniture assembly", job: "Furniture assembly", extras: ["IKEA assembly"] },
      { stem: "TV mounting", job: "TV and shelf mounting" },
      { stem: "shelf mounting", job: "TV and shelf mounting" },
      { stem: "picture hanging", job: "Picture hanging" },
      { stem: "door", job: "Door and trim repair", actions: ["repair", "adjustment", "replacement"] },
      { stem: "door lock", job: "Lock replacement", actions: repairs },
      { stem: "drywall", job: "Small drywall repair", actions: ["repair", "patch"] },
      { stem: "caulking", job: "Caulking and patching", places: ["kitchen", "bathroom"] },
      { stem: "cabinet hardware", job: "Hardware replacement", actions: ["replacement", "installation"] },
      { stem: "curtain rod", actions: ["installation"] },
      { stem: "blinds", actions: ["installation", "repair"] },
      { stem: "baseboard", actions: ["repair", "installation"] },
      { stem: "closet rod", actions: ["installation", "repair"] },
      { stem: "weatherstripping", actions: ["installation", "replacement"] },
      { stem: "screen door", actions: repairs },
      { stem: "baby gate", actions: ["installation"] },
      { stem: "grab bar", job: "Hardware replacement", actions: ["installation"] },
      { stem: "towel bar", actions: ["installation", "repair"] },
      { stem: "shower rod", actions: ["installation"] },
      { stem: "mailbox", actions: ["installation", "repair"] },
      { stem: "closet organizer", actions: ["installation"] },
      { stem: "door closer", job: "Door and trim repair", actions: repairs },
    ],
  },
  {
    service: "house-cleaning",
    extras: [
      "House cleaning",
      "House Cleaning",
      "Maid service",
      "Housekeeper",
      "Need a cleaner",
      "Spring cleaning",
      "Dirty house cleaning",
      "Airbnb cleaning",
      "Vacation rental cleaning",
      "Office cleaning",
      "House cleaners",
      "Residential cleaning",
    ],
    stems: [
      { stem: "house cleaning", job: "Recurring house cleaning", extras: ["weekly house cleaning", "biweekly house cleaning", "monthly house cleaning"] },
      { stem: "deep cleaning", job: "Deep cleaning" },
      { stem: "move-out cleaning", job: "Move-in and move-out cleans" },
      { stem: "move-in cleaning", job: "Move-in and move-out cleans" },
      { stem: "recurring cleaning", job: "Recurring house cleaning" },
      { stem: "kitchen cleaning", job: "Kitchen and bath focus", actions: clean },
      { stem: "bathroom cleaning", job: "Kitchen and bath focus", actions: clean },
      { stem: "carpet cleaning", job: "Carpet cleaning" },
      { stem: "window cleaning", job: "Window cleaning" },
      { stem: "oven cleaning", job: "Add-on appliance cleaning" },
      { stem: "refrigerator cleaning", job: "Add-on appliance cleaning" },
      { stem: "post renovation cleaning", job: "Post-renovation cleaning" },
      { stem: "appliance cleaning", job: "Add-on appliance cleaning" },
      { stem: "garage cleaning", job: "Deep cleaning" },
      { stem: "basement cleaning", job: "Deep cleaning" },
      { stem: "grout cleaning", job: "Kitchen and bath focus" },
      { stem: "upholstery cleaning", job: "Carpet cleaning" },
      { stem: "fridge cleaning", job: "Add-on appliance cleaning" },
    ],
  },
  {
    service: "roofing",
    extras: [
      "Roofing",
      "Roofer",
      "Roof leaking",
      "Leaking roof",
      "Roof leak",
      "Water stain on ceiling",
      "Ceiling leak from roof",
      "Missing shingles",
      "Storm damaged roof",
      "Hail damaged roof",
      "Roof after storm",
      "Emergency roof repair",
      "Roof leak companies",
    ],
    stems: [
      { stem: "roof", job: "Leak repair", actions: ["repair", "inspection", "replacement"], problems: ["leaking"] },
      { stem: "roof leak", job: "Leak repair", extras: ["emergency roof leak", "roof leak repair"] },
      { stem: "shingle", job: "Shingle replacement", actions: ["replacement", "repair"] },
      { stem: "roof flashing", job: "Roof flashing repair", actions: ["repair", "replacement"] },
      { stem: "gutter", job: "Gutter installation", actions: [...repairs, "cleaning"], problems: ["leaking", "clogged"] },
      { stem: "skylight", actions: repairs, problems: ["leaking"] },
      { stem: "chimney flashing", job: "Roof flashing repair", actions: ["repair"] },
      { stem: "flat roof", job: "Full roof replacement estimates", actions: ["repair", "replacement"] },
      { stem: "metal roof", job: "Full roof replacement estimates", actions: ["repair", "installation"] },
      { stem: "tile roof", job: "Full roof replacement estimates", actions: ["repair"] },
      { stem: "ridge vent", actions: ["installation", "repair"] },
      { stem: "ice dam", job: "Storm damage assessment", actions: ["removal", "repair"] },
      { stem: "roof inspection", job: "Roof inspections" },
      { stem: "roof replacement", job: "Full roof replacement estimates" },
      { stem: "soffit", actions: repairs },
      { stem: "fascia", actions: repairs },
      { stem: "downspout", job: "Gutter installation", actions: repairs, problems: ["clogged", "leaking"] },
      { stem: "chimney cap", actions: ["installation", "repair"] },
      { stem: "roof vent", actions: ["installation", "repair"] },
    ],
  },
  {
    service: "landscaping",
    extras: [
      "Landscaping",
      "Landscaper",
      "Lawn care",
      "Yard work",
      "Overgrown lawn",
      "Yellow grass",
      "Sprinkler not working",
      "Weedy yard",
      "Lawn service",
      "Yard maintenance",
    ],
    stems: [
      { stem: "lawn", job: "Lawn maintenance", actions: ["mowing", "maintenance", "fertilizing"] },
      { stem: "lawn mowing", job: "Lawn maintenance" },
      { stem: "yard cleanup", job: "Seasonal cleanup" },
      { stem: "seasonal cleanup", job: "Seasonal cleanup" },
      { stem: "mulch", job: "Mulch and planting", actions: ["installation"] },
      { stem: "planting", job: "Mulch and planting" },
      { stem: "hedge", job: "Shrub trimming", actions: ["trimming"] },
      { stem: "shrub", job: "Shrub trimming", actions: ["trimming"] },
      { stem: "tree", job: "Tree trimming", actions: ["trimming", "pruning"] },
      { stem: "irrigation", job: "Irrigation checks", actions: ["repair", "inspection", "installation"] },
      { stem: "sprinkler", job: "Irrigation checks", actions: ["repair", "installation"] },
      { stem: "sod", job: "Sod installation", actions: ["installation"] },
      { stem: "leaf cleanup", job: "Seasonal cleanup" },
      { stem: "garden bed", job: "Mulch and planting", actions: ["installation"] },
      { stem: "weed control", job: "Lawn maintenance" },
      { stem: "lawn aeration", job: "Lawn maintenance" },
      { stem: "overseeding", job: "Lawn maintenance" },
      { stem: "french drain", job: "Irrigation checks", actions: ["installation", "repair"] },
      { stem: "retaining wall", actions: ["repair", "installation"] },
      { stem: "patio", actions: ["cleaning", "repair"] },
    ],
  },
  {
    service: "painting",
    extras: [
      "Painting",
      "Painter",
      "House painting",
      "Paint my house",
      "Paint bedroom",
      "Paint living room",
      "Interior house painting",
      "Exterior house painting",
      "Interior painters",
      "House painters",
      "Bathroom painters",
      "Exterior painting",
    ],
    stems: [
      { stem: "interior painting", job: "Interior painting", places: ["bedroom", "living room", "kitchen", "bathroom"] },
      { stem: "exterior painting", job: "Exterior painting" },
      { stem: "bathroom painting", job: "Bathroom painting", places: ["bathroom"] },
      { stem: "cabinet painting", job: "Cabinet painting", places: ["kitchen", "bathroom"] },
      { stem: "room painting", job: "Interior painting" },
      { stem: "ceiling painting", job: "Interior painting" },
      { stem: "trim painting", job: "Trim and door finishing" },
      { stem: "door painting", job: "Trim and door finishing" },
      { stem: "deck staining", job: "Deck staining" },
      { stem: "fence staining", job: "Deck staining" },
      { stem: "wallpaper removal", job: "Wallpaper removal" },
      { stem: "drywall prep", job: "Drywall prep" },
      { stem: "color consultation", job: "Color consultation" },
      { stem: "accent wall", job: "Interior painting" },
      { stem: "garage door painting", job: "Exterior painting" },
      { stem: "popcorn ceiling", job: "Drywall prep", extras: ["popcorn ceiling removal"] },
      { stem: "brick painting", job: "Exterior painting" },
    ],
  },
  {
    service: "bathroom-remodeling",
    extras: [
      "Bathroom remodeling",
      "Bathroom remodel",
      "Bath remodel",
      "Update bathroom",
      "Old bathroom remodel",
      "Small bathroom remodel",
      "Master bathroom remodel",
      "Guest bathroom remodel",
      "Bathroom renovation",
      "Shower upgrade",
    ],
    stems: [
      { stem: "bathroom remodel", job: "Full bathroom remodels" },
      { stem: "shower remodel", job: "Tile and shower updates" },
      { stem: "tub to shower conversion", job: "Tile and shower updates" },
      { stem: "vanity", job: "Vanity replacement", actions: ["replacement", "installation"] },
      { stem: "bathroom tile", job: "Tile and shower updates", actions: ["installation", "repair"] },
      { stem: "shower door", job: "Shower door install", actions: ["installation", "replacement"] },
      { stem: "bathtub refinishing", job: "Bathtub refinishing" },
      { stem: "bathroom fixtures", job: "Fixture upgrades", actions: ["replacement", "upgrade"] },
      { stem: "bathroom lighting", job: "Lighting and ventilation", actions: ["installation"] },
      { stem: "bathroom fan", job: "Lighting and ventilation", actions: repairs },
      { stem: "accessible bathroom", job: "Accessibility improvements" },
      { stem: "half bath remodel", job: "Full bathroom remodels" },
      { stem: "walk-in shower", job: "Tile and shower updates" },
      { stem: "medicine cabinet", job: "Vanity replacement", actions: ["installation", "replacement"] },
      { stem: "bathroom flooring", job: "Full bathroom remodels", actions: ["installation"] },
    ],
  },
  {
    service: "pest-control",
    extras: [
      "Pest control",
      "Exterminator",
      "Bug problem",
      "Pest infestation",
      "Ants in the house",
      "Roaches in the kitchen",
      "Mouse in the house",
      "Rats in the attic",
      "Wasp nest",
      "Bees near the house",
      "Pest inspection",
      "Bug exterminator",
    ],
    stems: [
      { stem: "pest inspection", job: "General pest inspections" },
      { stem: "ant", job: "Ant and roach treatment", extras: ["ant treatment", "carpenter ants"] },
      { stem: "roach", job: "Ant and roach treatment", extras: ["cockroach treatment"] },
      { stem: "mouse", job: "Rodent exclusion", extras: ["mice removal", "mouse infestation"] },
      { stem: "rat", job: "Rodent exclusion", extras: ["rat removal"] },
      { stem: "rodent", job: "Rodent exclusion", actions: ["exclusion", "treatment"] },
      { stem: "termite", job: "Termite inspections", actions: ["inspection", "treatment"] },
      { stem: "bed bug", job: "Bed bug treatment", actions: ["treatment", "inspection"] },
      { stem: "mosquito", job: "Mosquito treatment", actions: ["treatment"] },
      { stem: "wasp", extras: ["wasp nest removal", "hornet nest"] },
      { stem: "spider", extras: ["spider treatment"] },
      { stem: "flea", extras: ["flea treatment"] },
      { stem: "tick", extras: ["tick treatment"] },
      { stem: "seasonal pest prevention", job: "Seasonal prevention plans" },
      { stem: "wildlife removal", extras: ["raccoon removal", "squirrel removal"] },
      { stem: "gopher", extras: ["gopher treatment"] },
      { stem: "mole", extras: ["mole treatment"] },
      { stem: "attic wildlife", extras: ["animals in attic"] },
    ],
  },
];

const sharedSuffixes = ["services", "companies", "near me"] as const;
const repairSuffixes: Partial<Record<ServiceCategorySlug, readonly string[]>> = {
  plumbing: ["repair", "plumber"],
  hvac: ["repair", "technician"],
  electrical: ["repair", "electrician"],
  handyman: ["repair"],
  roofing: ["repair", "roofer"],
  landscaping: ["lawn care"],
  painting: ["painter"],
  "pest-control": ["exterminator"],
};

const specialCase: Record<string, string> = {
  ac: "AC",
  gfci: "GFCI",
  hvac: "HVAC",
  ev: "EV",
  tv: "TV",
  ikea: "IKEA",
};

function titleCase(value: string) {
  return value
    .trim()
    .replace(/\s+/g, " ")
    .split(" ")
    .map((word) => {
      const lower = word.toLowerCase();
      if (specialCase[lower]) return specialCase[lower];
      if (lower === "and") return "and";
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(" ");
}

function jobSlug(job?: string) {
  return job ? slugifyJob(job) : undefined;
}

function addSuggestion(
  catalog: Map<string, ServiceSuggestion>,
  service: ServiceCategorySlug,
  label: string,
  job?: string,
  extraKeywords: readonly string[] = [],
  priority = 1
) {
  const cleaned = titleCase(label);
  if (cleaned.length < 3) return;
  const key = cleaned.toLowerCase();
  const keywords = extraKeywords.map((item) => item.toLowerCase());
  const existing = catalog.get(key);
  if (existing) {
    existing.keywords.push(...keywords);
    existing.priority = Math.max(existing.priority, priority);
    if (!existing.job && job) existing.job = jobSlug(job);
    return;
  }
  catalog.set(key, {
    label: cleaned,
    service,
    job: jobSlug(job),
    keywords: [cleaned.toLowerCase(), service, ...keywords],
    priority,
  });
}

function expandStem(catalog: Map<string, ServiceSuggestion>, service: ServiceCategorySlug, spec: StemSpec) {
  const extras = spec.extras ?? [];
  addSuggestion(catalog, service, spec.stem, spec.job, extras, 2);

  for (const action of spec.actions ?? []) {
    addSuggestion(catalog, service, `${spec.stem} ${action}`, spec.job, extras);
  }

  for (const place of spec.places ?? []) {
    addSuggestion(catalog, service, `${place} ${spec.stem}`, spec.job, extras);
    for (const action of spec.actions ?? []) {
      addSuggestion(catalog, service, `${place} ${spec.stem} ${action}`, spec.job, extras);
    }
  }

  for (const problem of spec.problems ?? []) {
    const natural = problem.startsWith("not ") ? `${spec.stem} ${problem}` : `${problem} ${spec.stem}`;
    addSuggestion(catalog, service, natural, spec.job, [problem, ...extras], 2);
    if (!problem.startsWith("not ")) {
      addSuggestion(catalog, service, `${spec.stem} ${problem}`, spec.job, [problem, ...extras]);
    }
    for (const place of spec.places ?? []) {
      addSuggestion(catalog, service, `${place} ${natural}`, spec.job, [problem, ...extras]);
    }
  }

  for (const extra of extras) {
    addSuggestion(catalog, service, extra, spec.job, [], 2);
  }
}

function buildCatalog() {
  const catalog = new Map<string, ServiceSuggestion>();

  for (const category of serviceCategories) {
    addSuggestion(catalog, category.slug, category.name, undefined, [], 3);
    addSuggestion(catalog, category.slug, category.shortName, undefined, [], 3);
    for (const suffix of [...sharedSuffixes, ...(repairSuffixes[category.slug] ?? [])]) {
      addSuggestion(catalog, category.slug, `${category.name} ${suffix}`, undefined, [], 2);
    }
    for (const job of category.commonServices) {
      addSuggestion(catalog, category.slug, job, job, [], 2);
      addSuggestion(catalog, category.slug, `${job} services`, job, [], 1);
    }
  }

  for (const pack of packs) {
    for (const extra of pack.extras) {
      addSuggestion(catalog, pack.service, extra, undefined, [], 2);
    }
    for (const stem of pack.stems) {
      expandStem(catalog, pack.service, stem);
    }
  }

  return [...catalog.values()];
}

export const serviceSuggestions = buildCatalog();

export const popularServiceSuggestions = serviceCategories.map((category) => ({
  label: category.name,
  service: category.slug,
  keywords: [category.name.toLowerCase(), category.slug],
  priority: 3,
})) satisfies ServiceSuggestion[];
