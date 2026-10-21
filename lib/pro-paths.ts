import { slugifyPlace } from "@/lib/public-paths";

export const proPaths = {
  /** Public Pro acquisition pages (marketing). */
  home: "/for-pros",
  pricing: "/for-pros/pricing",
  /** Pro registration flow. `register` is kept as an alias so older call sites keep working. */
  join: "/for-pros/join",
  register: "/for-pros/join",
  trade: (trade: string) => `/for-pros/${trade}`,
  location: (state: string, city: string) =>
    `/for-pros/locations/${state.toLowerCase()}/${slugifyPlace(city)}`,
  /** Pro auth + portal (app). */
  login: "/pro/login",
  forgotPassword: "/pro/forgot-password",
  resetPassword: "/pro/reset-password",
  dashboard: "/pro/dashboard",
} as const;

/** Public Pro marketing pages: /for-pros and everything under it. */
export function isProMarketingPath(pathname: string) {
  return pathname === proPaths.home || pathname.startsWith(`${proPaths.home}/`);
}

export function proDashboard(path = "") {
  if (!path || path === "/") return proPaths.dashboard;
  return `${proPaths.dashboard}${path.startsWith("/") ? path : `/${path}`}`;
}
