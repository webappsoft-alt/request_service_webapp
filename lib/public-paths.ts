/**
 * Public SEO directory URLs (customer discovery + pro profiles).
 * Build every public link through these so a URL change happens in one place.
 */

/** "Fort Collins" → "fort-collins", "St. Louis" → "st-louis". */
export function slugifyPlace(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export const publicPaths = {
  services: "/services",
  service: (category: string) => `/services/${category}`,
  subService: (category: string, subcategory: string) =>
    `/services/${category}/${subcategory}`,

  locations: "/locations",
  /** `state` is a 2-letter code or its slug; always rendered lower-case. */
  locationState: (state: string) => `/locations/${state.toLowerCase()}`,
  locationCity: (state: string, city: string) =>
    `/locations/${state.toLowerCase()}/${slugifyPlace(city)}`,
  locationService: (state: string, city: string, category: string) =>
    `/locations/${state.toLowerCase()}/${slugifyPlace(city)}/${category}`,
  locationSubService: (state: string, city: string, category: string, subcategory: string) =>
    `/locations/${state.toLowerCase()}/${slugifyPlace(city)}/${category}/${subcategory}`,

  professional: (slug: string) => `/pros/${slug}`,
  professionalProject: (slug: string, project: string) => `/pros/${slug}/projects/${project}`,
} as const;
