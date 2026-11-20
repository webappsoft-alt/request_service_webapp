/** Third-party contractor portal routes. Contractors sign in on their own login page. */
export const contractorPaths = {
  login: "/contractor/login",
  dashboard: "/contractor/dashboard",
  jobs: "/contractor/jobs",
  job: (id: string) => `/contractor/jobs/${id}`,
  /** Fixed service orders the office assigned to this contractor. */
  orders: "/contractor/orders",
  order: (id: string) => `/contractor/orders/${id}`,
  changeRequests: "/contractor/change-requests",
  schedule: "/contractor/schedule",
  payouts: "/contractor/payouts",
  payout: (id: string) => `/contractor/payouts/${id}`,
  messages: "/contractor/messages",
  profile: "/contractor/profile",
  message: (threadId: string) => `/contractor/messages?thread=${threadId}`,
} as const;

export function isContractorPath(pathname: string): boolean {
  return pathname === "/contractor" || pathname.startsWith("/contractor/");
}

export function isContractorLoginPath(pathname: string): boolean {
  return pathname === contractorPaths.login || pathname.startsWith(`${contractorPaths.login}/`);
}

export function isContractorRole(role: string | null | undefined): boolean {
  return String(role || "").toLowerCase() === "contractor";
}
