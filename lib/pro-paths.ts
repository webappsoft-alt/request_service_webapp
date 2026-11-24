import { slugifyPlace } from "@/lib/public-paths";

export const proPaths = {
  /**
   * Public Pro acquisition pages (marketing). Moved /for-pros → /pros (old URLs 308 in next.config).
   * /pros/<slug> stays the public Pro profile, so the Pro site uses fixed sections only:
   * /pros, /pros/pricing, /pros/join, /pros/blog, /pros/locations/…, /pros/trades/<trade>.
   */
  home: "/pros",
  pricing: "/pros/pricing",
  blog: "/pros/blog",
  /** Pro registration flow. `register` is kept as an alias so older call sites keep working. */
  join: "/pros/join",
  register: "/pros/join",
  trade: (trade: string) => `/pros/trades/${trade}`,
  location: (state: string, city: string) =>
    `/pros/locations/${state.toLowerCase()}/${slugifyPlace(city)}`,
  /** Pro auth + portal (app). */
  login: "/pro/login",
  forgotPassword: "/pro/forgot-password",
  resetPassword: "/pro/reset-password",
  dashboard: "/pro/dashboard",
} as const;

/**
 * First path segments under /pros that belong to the Pro marketing site. Anything else under
 * /pros is a public Pro profile (/pros/<slug>), so these words are reserved as profile slugs
 * (backend: Provider generateUniqueSlug — keep in sync).
 */
export const PRO_SITE_SECTIONS = ["pricing", "join", "blog", "locations", "trades"] as const;

/** Public Pro marketing pages: /pros and its fixed sections (not /pros/<profile-slug>). */
export function isProMarketingPath(pathname: string) {
  const path = (pathname || "").replace(/\/+$/, "") || "/";
  if (path === proPaths.home) return true;
  const [, root, section] = path.split("/");
  return root === "pros" && (PRO_SITE_SECTIONS as readonly string[]).includes(section || "");
}

export function proDashboard(path = "") {
  if (!path || path === "/") return proPaths.dashboard;
  return `${proPaths.dashboard}${path.startsWith("/") ? path : `/${path}`}`;
}
