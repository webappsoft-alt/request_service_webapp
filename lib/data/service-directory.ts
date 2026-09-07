import { slugifyJob } from "@/lib/data/jobs";
import { getServiceCategoryBySlug } from "@/lib/data/services";
import type { ServiceCategorySlug } from "@/lib/types";

export type DirectoryFilterOption = {
  value: string;
  label: string;
  hint?: string;
  match?: string[];
  job?: string;
};

export type DirectoryFilter = {
  id: string;
  label: string;
  options: DirectoryFilterOption[];
};

export type QualifyQuestion = {
  id: string;
  title: string;
  hint?: string;
  options: DirectoryFilterOption[];
};

const timeline: DirectoryFilter = {
  id: "timeline",
  label: "When do you want to start?",
  options: [
    { value: "48h", label: "Within 48 hours", hint: "Need a pro right away" },
    { value: "week", label: "Within a week", hint: "Ready to hire, not rushed" },
    { value: "flexible", label: "Flexible on timeline", hint: "Still researching" },
    { value: "specific", label: "Specific date" },
  ],
};

const frequency: DirectoryFilter = {
  id: "frequency",
  label: "How often?",
  options: [
    { value: "once", label: "Just once" },
    { value: "weekly", label: "Every week" },
    { value: "biweekly", label: "Every 2 weeks" },
    { value: "monthly", label: "Once a month" },
  ],
};

const bedrooms: DirectoryFilter = {
  id: "bedrooms",
  label: "Number of bedrooms",
  options: [
    { value: "1", label: "1 bedroom" },
    { value: "2", label: "2 bedrooms" },
    { value: "3", label: "3 bedrooms" },
    { value: "4", label: "4 bedrooms" },
    { value: "5", label: "5+ bedrooms" },
  ],
};

const filtersByService: Record<ServiceCategorySlug, DirectoryFilter[]> = {
  plumbing: [
    {
      id: "job-type",
      label: "What needs work?",
      options: [
        { value: "leak", label: "Leak or drip", match: ["leak", "faucet"] },
        { value: "clog", label: "Drain or clog", match: ["drain", "clog", "disposal"] },
        { value: "heater", label: "Water heater", match: ["water heater"] },
        { value: "fixture", label: "Toilet or fixture", match: ["toilet", "fixture"] },
        { value: "sewer", label: "Sewer line", match: ["sewer"] },
        { value: "emergency", label: "Emergency shutoff", match: ["emergency", "shutoff"] },
      ],
    },
    {
      id: "area",
      label: "Where is the work?",
      options: [
        { value: "kitchen", label: "Kitchen" },
        { value: "bath", label: "Bathroom" },
        { value: "utility", label: "Utility / laundry" },
        { value: "outside", label: "Outside / yard" },
      ],
    },
  ],
  hvac: [
    {
      id: "job-type",
      label: "What needs service?",
      options: [
        { value: "ac", label: "Air conditioning", match: ["ac", "air"] },
        { value: "furnace", label: "Furnace / heat", match: ["furnace", "heat"] },
        { value: "pump", label: "Heat pump", match: ["heat pump"] },
        { value: "ducts", label: "Ducts", match: ["duct"] },
        { value: "thermo", label: "Thermostat", match: ["thermostat"] },
        { value: "install", label: "New system", match: ["installation", "replacement"] },
      ],
    },
    {
      id: "intent",
      label: "What do you need?",
      options: [
        { value: "repair", label: "Repair now" },
        { value: "maintain", label: "Seasonal maintenance" },
        { value: "replace", label: "Replacement estimate" },
      ],
    },
  ],
  electrical: [
    {
      id: "job-type",
      label: "What kind of electrical work?",
      options: [
        { value: "outlet", label: "Outlet or switch", match: ["outlet", "switch"] },
        { value: "lighting", label: "Lighting", match: ["lighting", "fan"] },
        { value: "panel", label: "Panel upgrade", match: ["panel"] },
        { value: "ev", label: "EV charger", match: ["ev charger"] },
        { value: "safety", label: "Safety / detectors", match: ["safety", "smoke", "circuit"] },
      ],
    },
  ],
  handyman: [
    {
      id: "job-type",
      label: "What should they handle?",
      options: [
        { value: "assemble", label: "Assembly", match: ["assembly"] },
        { value: "mount", label: "Mounting", match: ["mounting", "hanging"] },
        { value: "door", label: "Doors and trim", match: ["door", "trim", "lock"] },
        { value: "patch", label: "Patching and caulk", match: ["caulk", "drywall", "patch"] },
        { value: "hardware", label: "Hardware", match: ["hardware"] },
      ],
    },
    {
      id: "size",
      label: "How big is the job?",
      options: [
        { value: "small", label: "Under 2 hours" },
        { value: "half", label: "Half day" },
        { value: "full", label: "Full day" },
        { value: "multi", label: "More than one day" },
      ],
    },
  ],
  "house-cleaning": [
    frequency,
    bedrooms,
    {
      id: "job-type",
      label: "Cleaning type",
      options: [
        { value: "standard", label: "Standard cleaning", match: ["recurring", "house cleaning"] },
        { value: "deep", label: "Deep cleaning", match: ["deep"] },
        { value: "move", label: "Move-in / move-out", match: ["move"] },
        { value: "reno", label: "Post-renovation", match: ["renovation"] },
        { value: "carpet", label: "Carpet or windows", match: ["carpet", "window"] },
      ],
    },
  ],
  roofing: [
    {
      id: "job-type",
      label: "What do you need?",
      options: [
        { value: "inspect", label: "Inspection", match: ["inspection"] },
        { value: "leak", label: "Leak repair", match: ["leak"] },
        { value: "shingle", label: "Shingles or flashing", match: ["shingle", "flashing"] },
        { value: "storm", label: "Storm damage", match: ["storm"] },
        { value: "replace", label: "Full replacement", match: ["replacement"] },
        { value: "gutter", label: "Gutters", match: ["gutter"] },
      ],
    },
    {
      id: "stories",
      label: "How many stories?",
      options: [
        { value: "1", label: "1 story" },
        { value: "2", label: "2 stories" },
        { value: "3", label: "3 or more" },
      ],
    },
  ],
  landscaping: [
    frequency,
    {
      id: "job-type",
      label: "Outdoor work",
      options: [
        { value: "lawn", label: "Lawn care", match: ["lawn"] },
        { value: "cleanup", label: "Seasonal cleanup", match: ["cleanup"] },
        { value: "plant", label: "Mulch and planting", match: ["mulch", "planting", "sod"] },
        { value: "trim", label: "Trees and shrubs", match: ["trim", "tree", "shrub"] },
        { value: "irrigation", label: "Irrigation", match: ["irrigation"] },
      ],
    },
    {
      id: "yard",
      label: "Yard size",
      options: [
        { value: "small", label: "Small lot" },
        { value: "medium", label: "Medium lot" },
        { value: "large", label: "Large lot" },
      ],
    },
  ],
  painting: [
    {
      id: "job-type",
      label: "What are you painting?",
      options: [
        { value: "interior", label: "Interior", match: ["interior"] },
        { value: "exterior", label: "Exterior", match: ["exterior"] },
        { value: "bathroom", label: "Bathroom", match: ["bathroom"] },
        { value: "cabinets", label: "Cabinets", match: ["cabinet"] },
        { value: "deck", label: "Deck or trim", match: ["deck", "trim", "wallpaper"] },
      ],
    },
    {
      id: "rooms",
      label: "How much of the home?",
      options: [
        { value: "1", label: "1 room" },
        { value: "few", label: "2–3 rooms" },
        { value: "whole", label: "Whole home" },
      ],
    },
  ],
  "bathroom-remodeling": [
    {
      id: "job-type",
      label: "Project size",
      options: [
        { value: "vanity", label: "Vanity or fixtures", match: ["vanity", "fixture"] },
        { value: "shower", label: "Shower or tile", match: ["tile", "shower", "bathtub"] },
        { value: "full", label: "Full remodel", match: ["full bathroom", "remodel"] },
        { value: "access", label: "Accessibility", match: ["accessibility"] },
      ],
    },
    {
      id: "ready",
      label: "How far along are you?",
      options: [
        { value: "ideas", label: "Collecting ideas" },
        { value: "ready", label: "Ready for a quote" },
        { value: "hired", label: "Ready to start soon" },
      ],
    },
  ],
  "pest-control": [
    {
      id: "job-type",
      label: "What pest?",
      options: [
        { value: "general", label: "General inspection", match: ["general", "inspection"] },
        { value: "ants", label: "Ants or roaches", match: ["ant", "roach"] },
        { value: "rodent", label: "Rodents", match: ["rodent"] },
        { value: "termite", label: "Termites", match: ["termite"] },
        { value: "bugs", label: "Bed bugs or mosquitoes", match: ["bed bug", "mosquito"] },
      ],
    },
    {
      id: "plan",
      label: "Treatment plan",
      options: [
        { value: "once", label: "One-time visit" },
        { value: "seasonal", label: "Seasonal plan" },
        { value: "monthly", label: "Monthly prevention" },
      ],
    },
  ],
};

const extraSubServices: Partial<Record<ServiceCategorySlug, DirectoryFilterOption[]>> = {
  plumbing: [
    { value: "dripping-faucet", label: "Dripping faucet", job: "faucet-installation", match: ["faucet"] },
    { value: "clogged-toilet", label: "Clogged toilet", job: "toilet-repair", match: ["toilet"] },
    { value: "clogged-drain", label: "Clogged drain", job: "drain-cleaning", match: ["drain"] },
    { value: "no-hot-water", label: "No hot water", job: "water-heater-installation", match: ["water heater"] },
    { value: "burst-pipe", label: "Burst or leaking pipe", job: "leak-detection-and-repair", match: ["leak"] },
  ],
  hvac: [
    { value: "ac-not-cooling", label: "AC not cooling", job: "ac-repair-and-recharge", match: ["ac", "air"] },
    { value: "no-heat", label: "No heat", job: "furnace-service", match: ["furnace", "heat"] },
    { value: "thermostat-issue", label: "Thermostat not working", job: "thermostat-installation", match: ["thermostat"] },
  ],
  electrical: [
    { value: "outlet-dead", label: "Outlet not working", job: "outlet-and-switch-repair", match: ["outlet", "switch"] },
    { value: "flickering-lights", label: "Lights flickering", job: "lighting-installation", match: ["lighting"] },
    { value: "breaker-trips", label: "Breaker tripping", job: "panel-upgrades", match: ["panel"] },
  ],
  handyman: [
    { value: "mount-tv", label: "Mount a TV", job: "tv-and-shelf-mounting", match: ["mounting"] },
    { value: "ikea-assembly", label: "Furniture assembly", job: "furniture-assembly", match: ["assembly"] },
    { value: "hole-in-wall", label: "Hole in the wall", job: "small-drywall-repair", match: ["drywall"] },
  ],
  "house-cleaning": [
    { value: "weekly-clean", label: "Weekly house cleaning", job: "recurring-house-cleaning", match: ["recurring"] },
    { value: "move-out-clean", label: "Move-out clean", job: "move-in-and-move-out-cleans", match: ["move"] },
  ],
  roofing: [
    { value: "roof-leaking", label: "Roof leaking", job: "leak-repair", match: ["leak"] },
    { value: "missing-shingles", label: "Missing shingles", job: "shingle-replacement", match: ["shingle"] },
    { value: "storm-damage", label: "Storm damage", job: "storm-damage-assessment", match: ["storm"] },
  ],
  landscaping: [
    { value: "lawn-mowing", label: "Lawn mowing", job: "lawn-maintenance", match: ["lawn"] },
    { value: "overgrown-yard", label: "Overgrown yard", job: "seasonal-cleanup", match: ["cleanup"] },
  ],
  painting: [
    { value: "house-painting", label: "House painting", job: "exterior-painting", match: ["exterior"] },
    { value: "paint-bedroom", label: "Paint a bedroom", job: "interior-painting", match: ["interior"] },
    { value: "paint-bathroom", label: "Paint a bathroom", job: "bathroom-painting", match: ["bathroom"] },
  ],
  "bathroom-remodeling": [
    { value: "update-bathroom", label: "Update bathroom", job: "full-bathroom-remodels", match: ["full bathroom", "remodel"] },
    { value: "new-shower", label: "New shower", job: "tile-and-shower-updates", match: ["shower", "tile"] },
  ],
  "pest-control": [
    { value: "ants-in-house", label: "Ants in the house", job: "ant-and-roach-treatment", match: ["ant", "roach"] },
    { value: "mouse-in-house", label: "Mouse in the house", job: "rodent-exclusion", match: ["rodent"] },
  ],
};

function isServiceSlug(value: string): value is ServiceCategorySlug {
  return value in filtersByService;
}

export function getSubServices(slug?: string): DirectoryFilter | undefined {
  if (!slug || !isServiceSlug(slug)) return undefined;

  const category = getServiceCategoryBySlug(slug);
  const fromJobs = (category?.commonServices ?? []).map((job) => ({
    value: slugifyJob(job),
    label: job,
    job: slugifyJob(job),
    match: [job.toLowerCase()],
  }));

  const extras = extraSubServices[slug] ?? [];
  const options: DirectoryFilterOption[] = [...fromJobs];
  for (const extra of extras) {
    if (!options.some((item) => item.value === extra.value || item.label.toLowerCase() === extra.label.toLowerCase())) {
      options.push(extra);
    }
  }

  return {
    id: "sub-service",
    label: "Sub-service",
    options,
  };
}

export function findSubServiceValue(slug: string, query: string, job?: string) {
  const filter = getSubServices(slug);
  if (!filter) return "";

  if (job) {
    const byJob = filter.options.find((option) => option.value === job || option.job === job);
    if (byJob) return byJob.value;
  }

  const q = query.trim().toLowerCase();
  if (!q) return "";

  const exact = filter.options.find((option) => option.label.toLowerCase() === q);
  if (exact) return exact.value;

  return (
    filter.options.find((option) =>
      option.label.toLowerCase().includes(q) ||
      option.match?.some((term) => q.includes(term) || term.includes(q))
    )?.value ?? ""
  );
}

export function getServiceFilters(slug?: string): DirectoryFilter[] {
  if (!slug || !isServiceSlug(slug)) return [];
  const sub = getSubServices(slug);
  return sub ? [sub, ...filtersByService[slug]] : filtersByService[slug];
}

export function getCommonFilters(): DirectoryFilter[] {
  return [timeline];
}

export function getSubServiceOption(slug: string, value?: string) {
  if (!value) return undefined;
  return getSubServices(slug)?.options.find((option) => option.value === value || option.job === value);
}

export function getQualifyQuestions(
  slug?: string,
  known: { subService?: boolean } = {}
): QualifyQuestion[] {
  const questions: QualifyQuestion[] = [];
  const sub = getSubServices(slug);
  if (sub && !known.subService) {
    questions.push({
      id: sub.id,
      title: "Which job do you need?",
      hint: "Pick the closest match so we show the right companies.",
      options: sub.options,
    });
  }

  questions.push({
    id: timeline.id,
    title: "What’s your timeline?",
    hint: "This helps matching companies know how soon you need someone.",
    options: timeline.options,
  });

  const extras = getServiceFilters(slug)
    .filter((filter) => filter.id !== "sub-service" && filter.id !== "job-type")
    .slice(0, 1)
    .map((filter) => ({
      id: filter.id,
      title: filter.label,
      options: filter.options,
    }));

  return [...questions, ...extras];
}

export function optionMatchesJob(option: DirectoryFilterOption, job: string) {
  const slug = slugifyJob(job);
  if (option.job === slug || option.value === slug) return true;
  if (!option.match?.length) return !option.job;
  return option.match.some((term) => job.toLowerCase().includes(term));
}

export function getProviderPresence(providerId: string) {
  let hash = 0;
  for (const char of providerId) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }

  const online = hash % 5 !== 0;
  const minutes = [18, 27, 41, 49, 75, 120][hash % 6] ?? 45;
  const responseLabel =
    minutes < 60 ? `Responds in about ${minutes} min` : `Responds in about ${Math.round(minutes / 60)} hr`;

  return { online, responseLabel };
}
