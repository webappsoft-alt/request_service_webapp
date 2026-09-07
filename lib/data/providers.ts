import type { Provider, WorkingHours } from "@/lib/types";
import { nearbyProviders } from "@/lib/data/nearby-providers";

export const weekdayHours: WorkingHours[] = [
  { day: "monday", open: "08:00", close: "17:00", closed: false },
  { day: "tuesday", open: "08:00", close: "17:00", closed: false },
  { day: "wednesday", open: "08:00", close: "17:00", closed: false },
  { day: "thursday", open: "08:00", close: "17:00", closed: false },
  { day: "friday", open: "08:00", close: "17:00", closed: false },
  { day: "saturday", open: "09:00", close: "13:00", closed: false },
  { day: "sunday", open: null, close: null, closed: true },
];

export const providers: Provider[] = [
  {
    id: "prov_summit",
    slug: "summit-home-systems",
    companyName: "Summit Home Systems",
    logoInitials: "SH",
    logoUrl: "/images/providers/logo-summit.jpg",
    coverImage: "/images/services/service-plumbing.jpg",
    images: [
      "/images/services/service-bathroom.jpg",
      "/images/home/hero-home.jpg",
      "/images/services/service-hvac.jpg",
    ],
    startingPrice: 129,
    tagline: "Plumbing and HVAC for Austin homes.",
    description:
      "Summit Home Systems is a locally owned plumbing and HVAC company serving Central Austin. The team focuses on diagnostics first, written estimates, and clean job close-out so homeowners know exactly what is being repaired and why.",
    rating: 4.9,
    reviewCount: 128,
    yearsInBusiness: 12,
    licensed: true,
    insured: true,
    categoryIds: ["cat_plumbing", "cat_hvac"],
    serviceArea: ["78701", "78702", "78703", "78704", "78705", "78731"],
    city: "Austin",
    state: "TX",
    zip: "78701",
    street: "312 Congress Avenue",
    lat: 30.2711,
    lng: -97.7437,
    phone: "(512) 555-0182",
    email: "hello@summithomesystems.example",
    website: "https://summithomesystems.example",
    contact: { name: "David Nguyen", role: "Business owner" },
    social: {
      facebook: "https://www.facebook.com/summithomesystems",
      google: "https://www.google.com/search?q=Summit+Home+Systems+Austin+TX",
      instagram: "https://www.instagram.com/summithomesystems",
      x: "https://x.com/summithomesys",
    },
    workingHours: weekdayHours,
    gallery: [
      "Kitchen plumbing fixture replacement",
      "Water heater installation",
      "HVAC seasonal maintenance",
      "Completed bathroom supply line repair",
    ],
    foundedYear: 2014,
    employeeCount: "8–15",
    featured: true,
    reviews: [
      {
        id: "rev_summit_1",
        providerId: "prov_summit",
        customerName: "Alicia M.",
        rating: 5,
        title: "Clear estimate, on-time arrival",
        body: "Demo review: the technician explained the leak, sent a written estimate, and completed the repair the same week.",
        serviceName: "Plumbing",
        createdAt: "2026-04-12",
        isDemo: true,
      },
      {
        id: "rev_summit_2",
        providerId: "prov_summit",
        customerName: "James R.",
        rating: 5,
        body: "Demo review: HVAC maintenance was thorough and the follow-up notes were easy to understand.",
        serviceName: "HVAC",
        createdAt: "2026-02-03",
        isDemo: true,
      },
    ],
  },
  {
    id: "prov_harbor",
    slug: "harbor-electric",
    companyName: "Harbor Electric",
    logoInitials: "HE",
    logoUrl: "/images/providers/logo-harbor.jpg",
    images: [
      "/images/services/service-electrical.jpg",
      "/images/home/step-search.jpg",
      "/images/home/step-hire.jpg",
    ],
    startingPrice: 149,
    tagline: "Licensed electrical work with documented scopes.",
    description:
      "Harbor Electric handles residential electrical repairs, lighting, and panel upgrades across Greater Boston. Every job starts with a documented scope and a signed estimate before work begins.",
    rating: 4.8,
    reviewCount: 96,
    yearsInBusiness: 9,
    licensed: true,
    insured: true,
    categoryIds: ["cat_electrical"],
    serviceArea: ["02108", "02109", "02110", "02111", "02113", "02114"],
    city: "Boston",
    state: "MA",
    zip: "02108",
    street: "18 Beacon Street",
    lat: 42.3588,
    lng: -71.0636,
    phone: "(617) 555-0134",
    email: "jobs@harborelectric.example",
    website: "https://harborelectric.example",
    contact: { name: "Andrea Cole", role: "Lead contractor" },
    workingHours: weekdayHours,
    gallery: [
      "Panel upgrade",
      "Kitchen lighting install",
      "EV charger preparation",
      "Safety inspection report",
    ],
    foundedYear: 2017,
    employeeCount: "5–10",
    featured: true,
    reviews: [
      {
        id: "rev_harbor_1",
        providerId: "prov_harbor",
        customerName: "Priya S.",
        rating: 5,
        body: "Demo review: the estimate listed every circuit and the crew finished the lighting install without surprises.",
        serviceName: "Electrical",
        createdAt: "2026-03-18",
        isDemo: true,
      },
    ],
  },
  {
    id: "prov_cedar",
    slug: "cedar-line-painting",
    companyName: "Cedar Line Painting",
    logoInitials: "CL",
    logoUrl: "/images/providers/logo-cedar.jpg",
    images: [
      "/images/services/service-painting.jpg",
      "/images/home/step-hire.jpg",
      "/images/home/split-homeowner.jpg",
    ],
    startingPrice: 219,
    tagline: "Interior and exterior painting with prep in writing.",
    description:
      "Cedar Line Painting is a Denver-area painting company known for careful prep, clean masking, and finish details that are specified before the first coat.",
    rating: 4.7,
    reviewCount: 84,
    yearsInBusiness: 7,
    licensed: true,
    insured: true,
    categoryIds: ["cat_painting"],
    serviceArea: ["80202", "80203", "80204", "80205", "80206", "80218"],
    city: "Denver",
    state: "CO",
    lat: 39.7392,
    lng: -104.9903,
    zip: "80202",
    street: "1644 Platte Street",
    phone: "(303) 555-0176",
    email: "hello@cedarlinepainting.example",
    website: "https://cedarlinepainting.example",
    contact: { name: "Luis Ortega", role: "Business owner" },
    workingHours: weekdayHours,
    gallery: [
      "Living room interior paint",
      "Exterior trim",
      "Cabinet refinishing",
      "Stairwell finish",
    ],
    foundedYear: 2019,
    employeeCount: "6–12",
    featured: true,
    reviews: [
      {
        id: "rev_cedar_1",
        providerId: "prov_cedar",
        customerName: "Noah K.",
        rating: 5,
        body: "Demo review: prep work was listed in the estimate and the finish matched the sample we approved.",
        serviceName: "Painting",
        createdAt: "2026-05-02",
        isDemo: true,
      },
    ],
  },
  {
    id: "prov_northstar",
    slug: "northstar-roofing",
    companyName: "Northstar Roofing",
    logoInitials: "NR",
    logoUrl: "/images/providers/logo-northstar.jpg",
    images: [
      "/images/services/service-roofing.jpg",
      "/images/home/step-compare.jpg",
      "/images/home/hero-home.jpg",
    ],
    startingPrice: 289,
    tagline: "Inspections, leak repair, and replacement estimates.",
    description:
      "Northstar Roofing serves Minneapolis homeowners with photo-backed inspections, leak repair, and replacement estimates that separate materials, labor, and optional upgrades.",
    rating: 4.8,
    reviewCount: 151,
    yearsInBusiness: 16,
    licensed: true,
    insured: true,
    categoryIds: ["cat_roofing"],
    serviceArea: ["55401", "55402", "55403", "55404", "55405", "55408"],
    city: "Minneapolis",
    state: "MN",
    lat: 44.9778,
    lng: -93.265,
    zip: "55401",
    street: "225 S 6th Street",
    phone: "(612) 555-0190",
    email: "office@northstarroofing.example",
    website: "https://northstarroofing.example",
    contact: { name: "Hannah Berg", role: "Office manager" },
    workingHours: weekdayHours,
    gallery: [
      "Shingle replacement",
      "Leak repair",
      "Inspection photos",
      "Completed ridge line",
    ],
    foundedYear: 2010,
    employeeCount: "12–20",
    featured: true,
    reviews: [
      {
        id: "rev_northstar_1",
        providerId: "prov_northstar",
        customerName: "Elena V.",
        rating: 5,
        body: "Demo review: the inspection photos made the estimate easy to approve.",
        serviceName: "Roofing",
        createdAt: "2026-01-22",
        isDemo: true,
      },
    ],
  },
  {
    id: "prov_bright",
    slug: "bright-path-cleaning",
    companyName: "Bright Path Cleaning",
    logoInitials: "BP",
    logoUrl: "/images/providers/logo-brightpath.jpg",
    images: [
      "/images/services/service-cleaning.jpg",
      "/images/home/split-homeowner.jpg",
      "/images/home/step-search.jpg",
    ],
    startingPrice: 129,
    tagline: "Recurring house cleaning with a published checklist.",
    description:
      "Bright Path Cleaning provides recurring and one-time residential cleaning in Seattle. Every visit follows a published checklist so customers know what is included before the crew arrives.",
    rating: 4.9,
    reviewCount: 203,
    yearsInBusiness: 6,
    licensed: true,
    insured: true,
    categoryIds: ["cat_house_cleaning"],
    serviceArea: ["98101", "98102", "98103", "98104", "98109", "98112"],
    city: "Seattle",
    state: "WA",
    lat: 47.6097,
    lng: -122.3331,
    zip: "98101",
    street: "1201 2nd Avenue",
    phone: "(206) 555-0118",
    email: "schedule@brightpathcleaning.example",
    website: "https://brightpathcleaning.example",
    contact: { name: "Sofia Grant", role: "Business owner" },
    workingHours: weekdayHours,
    gallery: [
      "Kitchen after service",
      "Bathroom detail",
      "Living area reset",
      "Move-out clean",
    ],
    foundedYear: 2020,
    employeeCount: "10–18",
    featured: true,
    reviews: [
      {
        id: "rev_bright_1",
        providerId: "prov_bright",
        customerName: "Maya L.",
        rating: 5,
        body: "Demo review: the checklist matched the visit and the crew was on time.",
        serviceName: "House Cleaning",
        createdAt: "2026-06-09",
        isDemo: true,
      },
    ],
  },
  {
    id: "prov_oak",
    slug: "oak-and-iron-handyman",
    companyName: "Oak & Iron Handyman",
    logoInitials: "OI",
    logoUrl: "/images/providers/logo-oakiron.jpg",
    images: [
      "/images/services/service-handyman.jpg",
      "/images/services/service-bathroom.jpg",
      "/images/home/step-hire.jpg",
    ],
    startingPrice: 99,
    tagline: "Small repairs, mounting, and punch-list work.",
    description:
      "Oak & Iron Handyman helps Charlotte homeowners close out small repairs that do not need a full contractor. Requests with photos are scoped before a visit is scheduled.",
    rating: 4.6,
    reviewCount: 67,
    yearsInBusiness: 5,
    licensed: true,
    insured: true,
    categoryIds: ["cat_handyman", "cat_bathroom_remodeling"],
    serviceArea: ["28202", "28203", "28204", "28205", "28207", "28209"],
    city: "Charlotte",
    state: "NC",
    lat: 35.2271,
    lng: -80.8431,
    zip: "28202",
    street: "201 S Tryon Street",
    phone: "(704) 555-0161",
    email: "hello@oakandiron.example",
    website: "https://oakandiron.example",
    contact: { name: "Chris Walker", role: "Contractor" },
    workingHours: weekdayHours,
    gallery: [
      "TV mounting",
      "Vanity hardware",
      "Door adjustment",
      "Punch-list repairs",
    ],
    foundedYear: 2021,
    employeeCount: "3–6",
    featured: true,
    reviews: [
      {
        id: "rev_oak_1",
        providerId: "prov_oak",
        customerName: "Chris D.",
        rating: 5,
        body: "Demo review: several small items were completed in one visit and billed to the estimate.",
        serviceName: "Handyman",
        createdAt: "2026-03-01",
        isDemo: true,
      },
    ],
  },
  {
    id: "prov_greenfield",
    slug: "greenfield-landscape",
    companyName: "Greenfield Landscape",
    logoInitials: "GL",
    logoUrl: "/images/providers/logo-greenfield.jpg",
    images: [
      "/images/services/service-landscaping.jpg",
      "/images/home/split-provider.jpg",
      "/images/home/step-compare.jpg",
    ],
    startingPrice: 159,
    tagline: "Lawn care and seasonal outdoor maintenance.",
    description:
      "Greenfield Landscape maintains residential properties across Phoenix. Recurring lawn care and seasonal cleanup are estimated with a defined property scope.",
    rating: 4.7,
    reviewCount: 112,
    yearsInBusiness: 11,
    licensed: true,
    insured: true,
    categoryIds: ["cat_landscaping"],
    serviceArea: ["85003", "85004", "85006", "85007", "85008", "85012"],
    city: "Phoenix",
    state: "AZ",
    lat: 33.4484,
    lng: -112.074,
    zip: "85003",
    street: "2 N Central Avenue",
    phone: "(602) 555-0144",
    email: "office@greenfieldlandscape.example",
    website: "https://greenfieldlandscape.example",
    contact: { name: "Maya Chen", role: "Service manager" },
    workingHours: weekdayHours,
    gallery: [
      "Front yard maintenance",
      "Seasonal cleanup",
      "Planting bed",
      "Irrigation check",
    ],
    foundedYear: 2015,
    employeeCount: "9–14",
    featured: true,
    reviews: [
      {
        id: "rev_greenfield_1",
        providerId: "prov_greenfield",
        customerName: "Sofia H.",
        rating: 4,
        body: "Demo review: the crew followed the property map in the estimate and left a visit summary.",
        serviceName: "Landscaping",
        createdAt: "2026-04-27",
        isDemo: true,
      },
    ],
  },
  {
    id: "prov_shield",
    slug: "shield-pest-solutions",
    companyName: "Shield Pest Solutions",
    logoInitials: "SP",
    logoUrl: "/images/providers/logo-shield.jpg",
    images: [
      "/images/services/service-pest.jpg",
      "/images/home/step-search.jpg",
      "/images/home/split-homeowner.jpg",
    ],
    startingPrice: 109,
    tagline: "Inspections, treatment, and prevention plans.",
    description:
      "Shield Pest Solutions provides residential inspections and treatment plans in Tampa. Follow-up visits are scheduled from the original estimate so customers can see the full plan before approving.",
    rating: 4.8,
    reviewCount: 73,
    yearsInBusiness: 8,
    licensed: true,
    insured: true,
    categoryIds: ["cat_pest_control"],
    serviceArea: ["33602", "33603", "33604", "33605", "33606", "33607"],
    city: "Tampa",
    state: "FL",
    lat: 27.9475,
    lng: -82.4584,
    zip: "33602",
    street: "401 E Jackson Street",
    phone: "(813) 555-0127",
    email: "service@shieldpest.example",
    website: "https://shieldpest.example",
    contact: { name: "Ryan Miles", role: "Business owner" },
    workingHours: weekdayHours,
    gallery: [
      "Inspection visit",
      "Exterior treatment",
      "Exclusion work",
      "Follow-up checklist",
    ],
    foundedYear: 2018,
    employeeCount: "4–8",
    featured: true,
    reviews: [
      {
        id: "rev_shield_1",
        providerId: "prov_shield",
        customerName: "David P.",
        rating: 5,
        body: "Demo review: the inspection report and prevention plan were easy to approve before treatment.",
        serviceName: "Pest Control",
        createdAt: "2026-05-19",
        isDemo: true,
      },
    ],
  },
];

export function getAllProviders() {
  return [...providers, ...nearbyProviders];
}

export function getProviderBySlug(slug: string) {
  return getAllProviders().find((provider) => provider.slug === slug);
}

export function getFeaturedProviders() {
  return providers.filter((provider) => provider.featured);
}

export function getProvidersByCategoryId(categoryId: string) {
  return [...providers, ...nearbyProviders].filter((provider) =>
    provider.categoryIds.includes(categoryId)
  );
}

export function getRelatedProviders(provider: Provider, limit = 3) {
  return getAllProviders()
    .filter((item) => item.id !== provider.id)
    .map((item) => {
      const sharedCategories = item.categoryIds.filter((id) =>
        provider.categoryIds.includes(id)
      ).length;
      const sameCity = item.city === provider.city && item.state === provider.state;
      return {
        item,
        score: sharedCategories * 3 + (sameCity ? 2 : 0) + item.rating,
      };
    })
    .filter((entry) => entry.score > entry.item.rating)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((entry) => entry.item);
}

export function searchProviders(options: {
  categoryId?: string;
  zip?: string;
}) {
  const zip = options.zip?.trim();
  return providers.filter((provider) => {
    const matchesCategory = options.categoryId
      ? provider.categoryIds.includes(options.categoryId)
      : true;
    const matchesZip = zip ? provider.serviceArea.includes(zip) : true;
    return matchesCategory && matchesZip;
  });
}
