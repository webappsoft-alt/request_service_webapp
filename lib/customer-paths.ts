export const customerPaths = {
  dashboard: "/account/dashboard",
  orders: "/account/dashboard/orders",
  order: (id: string) => `/account/dashboard/orders/${id}`,
  estimates: "/account/dashboard/estimates",
  estimateRequest: "/account/dashboard/estimates/request",
  estimateRequests: "/account/dashboard/estimates?tab=requests",
  estimate: (token: string) => `/account/dashboard/estimates/${token}`,
  quoteRequest: (batchId: string) =>
    `/account/dashboard/estimates/requests/${batchId}`,
  invoices: "/account/dashboard/invoices",
  invoice: (id: string) => `/account/dashboard/invoices/${id}`,
  messages: "/account/dashboard/messages",
  settings: "/account/dashboard/settings",
  site: "/",
} as const;

export function customerDashboard(path = "") {
  if (!path || path === "/") return customerPaths.dashboard;
  return `${customerPaths.dashboard}${path.startsWith("/") ? path : `/${path}`}`;
}
