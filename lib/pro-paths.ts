export const proPaths = {
  home: "/pro",
  pricing: "/pro/pricing",
  login: "/pro/login",
  register: "/pro/register",
  forgotPassword: "/pro/forgot-password",
  resetPassword: "/pro/reset-password",
  dashboard: "/pro/dashboard",
} as const;

export function proDashboard(path = "") {
  if (!path || path === "/") return proPaths.dashboard;
  return `${proPaths.dashboard}${path.startsWith("/") ? path : `/${path}`}`;
}
