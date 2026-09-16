export const customerPaths = {
  dashboard: "/account/dashboard",
  orders: "/account/dashboard/orders",
  order: (id: string) => `/account/dashboard/orders/${id}`,
  estimates: "/account/dashboard/estimates",
  estimate: (token: string) => `/account/dashboard/estimates/${token}`,
  messages: "/account/dashboard/messages",
  settings: "/account/dashboard/settings",
  site: "/",
} as const;

export function customerDashboard(path = "") {
  if (!path || path === "/") return customerPaths.dashboard;
  return `${customerPaths.dashboard}${path.startsWith("/") ? path : `/${path}`}`;
}
