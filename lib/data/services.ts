import type { ServiceCategory } from "@/lib/types";

export const serviceCategories: ServiceCategory[] = [
  {
    id: "cat_plumbing",
    slug: "plumbing",
    name: "Plumbing",
    shortName: "Plumbing",
    tagline: "Leaks & water heaters",
    description:
      "Licensed plumbers for leaks, water heaters, drain cleaning, and fixture installation.",
    longDescription:
      "Connect with licensed local plumbers for repairs, replacements, and planned upgrades. From a dripping faucet to a full water heater replacement, Request Services helps you submit one request and hear from professionals who actually serve your ZIP code.",
    commonServices: [
      "Leak detection and repair",
      "Water heater installation",
      "Drain cleaning",
      "Fixture replacement",
      "Sewer line inspection",
      "Emergency shutoff support",
      "Toilet repair",
      "Faucet installation",
      "Garbage disposal repair",
    ],
    benefits: [
      "Licensed and insured professionals",
      "Written estimates before work begins",
      "Photo-supported requests",
      "Clear scheduling and follow-up",
    ],
    seoTitle: "Local Plumbing Services | Licensed Plumbers Near You",
    seoDescription:
      "Find licensed local plumbers for leaks, water heaters, drain cleaning, and fixture installation. Submit a request or book a professional directly on Request Services.",
    icon: "droplets",
    image: "/images/services/service-plumbing.jpg",
    imageAlt: "Copper pipes and a chrome kitchen faucet being repaired",
  },
  {
    id: "cat_hvac",
    slug: "hvac",
    name: "HVAC",
    shortName: "HVAC",
    tagline: "Heating & cooling",
    description:
      "Heating, cooling, and indoor air quality service from local HVAC professionals.",
    longDescription:
      "Keep your home comfortable year-round with local HVAC technicians who handle diagnostics, seasonal maintenance, system replacement, and indoor air quality upgrades.",
    commonServices: [
      "AC repair and recharge",
      "Furnace service",
      "Seasonal maintenance",
      "Thermostat installation",
      "Duct inspection",
      "System replacement estimates",
      "AC installation",
      "Duct cleaning",
      "Heat pump service",
    ],
    benefits: [
      "Seasonal maintenance reminders",
      "Transparent system replacement quotes",
      "Local technicians who know your climate",
      "Documented service history",
    ],
    seoTitle: "HVAC Repair & Installation | Local Heating and Cooling Pros",
    seoDescription:
      "Request HVAC repair, maintenance, and installation from local heating and cooling professionals. Compare estimates and book service through Request Services.",
    icon: "thermometer",
    image: "/images/services/service-hvac.jpg",
    imageAlt: "Outdoor air conditioner with service gauges attached",
  },
  {
    id: "cat_electrical",
    slug: "electrical",
    name: "Electrical",
    shortName: "Electrical",
    tagline: "Panels & lighting",
    description:
      "Panel upgrades, lighting, outlets, and electrical safety work from licensed electricians.",
    longDescription:
      "Hire licensed electricians for repairs, safety inspections, panel upgrades, EV charger prep, and lighting projects — with estimates you can review before any work starts.",
    commonServices: [
      "Outlet and switch repair",
      "Lighting installation",
      "Panel upgrades",
      "EV charger preparation",
      "Safety inspections",
      "Ceiling fan installation",
      "Dedicated circuit install",
      "Smoke detector install",
    ],
    benefits: [
      "Licensed electrical work",
      "Safety-first diagnostics",
      "Written scopes of work",
      "Photo documentation of completed jobs",
    ],
    seoTitle: "Licensed Electricians Near You | Electrical Repair & Upgrades",
    seoDescription:
      "Find licensed electricians for panel upgrades, lighting, outlets, and electrical safety work. Request service or book a professional on Request Services.",
    icon: "zap",
    image: "/images/services/service-electrical.jpg",
    imageAlt: "Open residential breaker panel with circuit work in progress",
  },
  {
    id: "cat_handyman",
    slug: "handyman",
    name: "Handyman",
    shortName: "Handyman",
    tagline: "Small home repairs",
    description:
      "Reliable help for small repairs, assembly, mounting, and punch-list home projects.",
    longDescription:
      "A professional handyman can close the gap between DIY and a full contractor. Request help for repairs, mounting, assembly, and punch-list items around the house.",
    commonServices: [
      "Furniture assembly",
      "TV and shelf mounting",
      "Door and trim repair",
      "Caulking and patching",
      "Hardware replacement",
      "Small drywall repair",
      "Lock replacement",
      "Picture hanging",
    ],
    benefits: [
      "One request for multiple small jobs",
      "Clear hourly or project estimates",
      "Local professionals with verified profiles",
      "Photo uploads for faster scoping",
    ],
    seoTitle: "Local Handyman Services | Small Home Repairs Done Right",
    seoDescription:
      "Book a local handyman for assembly, mounting, repairs, and punch-list work. Submit a request with photos and get a professional estimate on Request Services.",
    icon: "wrench",
    image: "/images/services/service-handyman.jpg",
    imageAlt: "Cordless drill mounting a wood floating shelf",
  },
  {
    id: "cat_house_cleaning",
    slug: "house-cleaning",
    name: "House Cleaning",
    shortName: "Cleaning",
    tagline: "Recurring & deep cleans",
    description:
      "Recurring and one-time home cleaning with clear scopes and professional crews.",
    longDescription:
      "Schedule one-time deep cleans or recurring house cleaning with local professionals. Review what’s included, request add-ons, and keep service history in one place.",
    commonServices: [
      "Recurring house cleaning",
      "Move-in and move-out cleans",
      "Deep cleaning",
      "Kitchen and bath focus",
      "Post-renovation cleaning",
      "Add-on appliance cleaning",
      "Carpet cleaning",
      "Window cleaning",
    ],
    benefits: [
      "Defined cleaning checklists",
      "Recurring scheduling options",
      "Insured professional crews",
      "Easy add-ons before the visit",
    ],
    seoTitle: "House Cleaning Services Near You | Recurring & Deep Cleans",
    seoDescription:
      "Find local house cleaning professionals for recurring service, deep cleans, and move-out cleaning. Request a quote on Request Services.",
    icon: "sparkles",
    image: "/images/services/service-cleaning.jpg",
    imageAlt: "Sunlit kitchen island being wiped after a clean",
  },
  {
    id: "cat_roofing",
    slug: "roofing",
    name: "Roofing",
    shortName: "Roofing",
    tagline: "Repairs & replacement",
    description:
      "Roof inspections, repairs, and replacement estimates from local roofing companies.",
    longDescription:
      "Protect your home with local roofing professionals who can inspect storm damage, repair leaks, and provide replacement estimates you can review and sign digitally.",
    commonServices: [
      "Roof inspections",
      "Leak repair",
      "Shingle replacement",
      "Storm damage assessment",
      "Gutter coordination",
      "Full roof replacement estimates",
      "Gutter installation",
      "Roof flashing repair",
    ],
    benefits: [
      "Photo-backed inspections",
      "Itemized replacement estimates",
      "Licensed and insured contractors",
      "Digital approval before work begins",
    ],
    seoTitle: "Roof Repair & Replacement | Local Roofing Contractors",
    seoDescription:
      "Request a roof inspection, leak repair, or replacement estimate from local roofing contractors. Compare professionals on Request Services.",
    icon: "house",
    image: "/images/services/service-roofing.jpg",
    imageAlt: "Asphalt roof shingles under a blue sky",
  },
  {
    id: "cat_landscaping",
    slug: "landscaping",
    name: "Landscaping",
    shortName: "Landscaping",
    tagline: "Lawns & outdoor care",
    description:
      "Lawn care, seasonal cleanup, planting, and outdoor maintenance from local crews.",
    longDescription:
      "Keep your property maintained with local landscaping professionals for lawn care, seasonal cleanup, planting, and larger outdoor improvement projects.",
    commonServices: [
      "Lawn maintenance",
      "Seasonal cleanup",
      "Mulch and planting",
      "Shrub trimming",
      "Irrigation checks",
      "Yard improvement estimates",
      "Tree trimming",
      "Sod installation",
    ],
    benefits: [
      "Recurring and one-time options",
      "Clear property-scope estimates",
      "Local crews familiar with your climate",
      "Photo documentation of completed work",
    ],
    seoTitle: "Landscaping & Lawn Care Near You | Local Outdoor Pros",
    seoDescription:
      "Hire local landscaping professionals for lawn care, seasonal cleanup, and outdoor maintenance. Request service through Request Services.",
    icon: "trees",
    image: "/images/services/service-landscaping.jpg",
    imageAlt: "Green hedges being trimmed in a front yard",
  },
  {
    id: "cat_painting",
    slug: "painting",
    name: "Painting",
    shortName: "Painting",
    tagline: "Interior & exterior",
    description:
      "Interior and exterior painting with written scopes, prep details, and finish options.",
    longDescription:
      "Refresh interiors or protect exteriors with local painting professionals. Review prep work, materials, and finish options in a written estimate before the first coat.",
    commonServices: [
      "Interior painting",
      "Exterior painting",
      "Bathroom painting",
      "Cabinet painting",
      "Drywall prep",
      "Trim and door finishing",
      "Color consultation",
      "Deck staining",
      "Wallpaper removal",
    ],
    benefits: [
      "Itemized prep and materials",
      "Finish and sheen options in writing",
      "Insured painting crews",
      "Photo galleries of prior work",
    ],
    seoTitle: "Interior & Exterior Painting | Local Professional Painters",
    seoDescription:
      "Find local painting professionals for interior, exterior, and cabinet projects. Review estimates and book service on Request Services.",
    icon: "paint-roller",
    image: "/images/services/service-painting.jpg",
    imageAlt: "Paint roller applying terracotta paint to a wall",
  },
  {
    id: "cat_bathroom_remodeling",
    slug: "bathroom-remodeling",
    name: "Bathroom Remodeling",
    shortName: "Bath Remodel",
    tagline: "Tile & fixtures",
    description:
      "Vanity, tile, fixture, and full bathroom remodel projects with staged estimates.",
    longDescription:
      "Plan a bathroom refresh or full remodel with professionals who can scope tile, fixtures, plumbing coordination, and finish work — then convert an approved estimate into a managed job.",
    commonServices: [
      "Vanity replacement",
      "Tile and shower updates",
      "Fixture upgrades",
      "Lighting and ventilation",
      "Accessibility improvements",
      "Full bathroom remodels",
      "Shower door install",
      "Bathtub refinishing",
    ],
    benefits: [
      "Staged estimates for phased work",
      "Change-order support if scope expands",
      "Coordinated plumbing and electrical",
      "Photo documentation throughout the job",
    ],
    seoTitle: "Bathroom Remodeling Near You | Local Bath Contractors",
    seoDescription:
      "Request bathroom remodeling estimates for vanities, tile, fixtures, and full remodels. Work with local professionals on Request Services.",
    icon: "bath",
    image: "/images/services/service-bathroom.jpg",
    imageAlt: "White subway tile shower with chrome fixtures",
  },
  {
    id: "cat_pest_control",
    slug: "pest-control",
    name: "Pest Control",
    shortName: "Pest Control",
    tagline: "Inspect & prevent",
    description:
      "Inspections, treatments, and prevention plans from local pest control professionals.",
    longDescription:
      "Address infestations and prevent return visits with local pest control professionals. Request an inspection, review a treatment plan, and keep service on a documented schedule.",
    commonServices: [
      "General pest inspections",
      "Ant and roach treatment",
      "Rodent exclusion",
      "Termite inspections",
      "Seasonal prevention plans",
      "Follow-up treatments",
      "Bed bug treatment",
      "Mosquito treatment",
    ],
    benefits: [
      "Inspection-first treatment plans",
      "Recurring prevention options",
      "Licensed application professionals",
      "Clear follow-up schedules",
    ],
    seoTitle: "Pest Control Near You | Inspections, Treatment & Prevention",
    seoDescription:
      "Find local pest control professionals for inspections, treatments, and prevention plans. Request service on Request Services.",
    icon: "bug",
    image: "/images/services/service-pest.jpg",
    imageAlt: "Pest treatment along a brick home foundation",
  },
];

export function getServiceCategoryBySlug(slug: string) {
  return serviceCategories.find((category) => category.slug === slug);
}

export function getServiceCategoryById(id: string) {
  return serviceCategories.find((category) => category.id === id);
}
