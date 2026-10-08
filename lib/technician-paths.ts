/** Technician (employee) portal routes. Technicians sign in on their own login page. */
export const technicianPaths = {
  login: "/technical/login",
  dashboard: "/technical",
  jobs: "/technical/jobs",
  job: (id: string) => `/technical/jobs/${id}`,
  estimates: "/technical/estimates",
  estimate: (id: string) => `/technical/estimates/${id}`,
  schedule: "/technical/schedule",
  time: "/technical/time-tracking",
  payments: "/technical/payments",
  messages: "/technical/messages",
  message: (threadId: string) => `/technical/messages?thread=${threadId}`,
  profile: "/technical/profile",
} as const;

export function isTechnicianPath(pathname: string): boolean {
  return pathname === "/technical" || pathname.startsWith("/technical/");
}

export function isTechnicianLoginPath(pathname: string): boolean {
  return pathname === technicianPaths.login || pathname.startsWith(`${technicianPaths.login}/`);
}

export function isTechnicianRole(role: string | null | undefined): boolean {
  return String(role || "").toLowerCase() === "technician";
}
