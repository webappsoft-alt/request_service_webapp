/** Centralized API route map for Request Services */

export const authApi = {
  login: "auth/login",
  register: "auth/register",
  forgotPassword: "auth/forgot-password",
  resetPassword: "auth/reset-password",
  sendCode: "auth/send-otp",
  verifyCode: "auth/verify-otp",
  logout: "auth/logout",
} as const;

export const uploadApi = {
  image: "upload/image",
  file: "upload/file",
  document: "upload/document",
} as const;

/** Aliases used by upload helpers */
export const imageUpload = uploadApi.image;
export const FileUpload = uploadApi.file;
export const DocUpload = uploadApi.document;

export const userApi = {
  me: "user/me",
  status: "user/status",
  profile: "user/profile",
  delete: "user",
} as const;

export const customerApi = {
  list: "customers",
  byId: (id: string) => `customers/${encodeURIComponent(id)}`,
  requests: "customers/requests",
} as const;

export const providerApi = {
  list: "providers",
  byId: (id: string) => `providers/${encodeURIComponent(id)}`,
  bySlug: (slug: string) => `providers/slug/${encodeURIComponent(slug)}`,
  register: "providers/register",
  profile: "providers/profile",
  verifyDocuments: "providers/documents",
} as const;

export const companyApi = {
  list: "companies",
  create: "companies",
  byId: (id: string) => `companies/${encodeURIComponent(id)}`,
  subscription: (id: string) =>
    `companies/${encodeURIComponent(id)}/subscription`,
} as const;

export const serviceApi = {
  categories: "services/categories",
  categoryBySlug: (slug: string) =>
    `services/categories/${encodeURIComponent(slug)}`,
  jobs: (categorySlug: string) =>
    `services/categories/${encodeURIComponent(categorySlug)}/jobs`,
  directory: "services/directory",
} as const;

export const quoteApi = {
  create: "quotes",
  byId: (id: string) => `quotes/${encodeURIComponent(id)}`,
  byToken: (token: string) => `quotes/token/${encodeURIComponent(token)}`,
} as const;

export const requestApi = {
  create: "requests",
  list: "requests",
  byId: (id: string) => `requests/${encodeURIComponent(id)}`,
} as const;

export const estimateApi = {
  list: "estimates",
  byId: (id: string) => `estimates/${encodeURIComponent(id)}`,
  byToken: (token: string) =>
    `estimates/share/${encodeURIComponent(token)}`,
  approve: (id: string) => `estimates/${encodeURIComponent(id)}/approve`,
} as const;

export const jobApi = {
  list: "jobs",
  byId: (id: string) => `jobs/${encodeURIComponent(id)}`,
} as const;

export const invoiceApi = {
  list: "invoices",
  byId: (id: string) => `invoices/${encodeURIComponent(id)}`,
  pay: (id: string) => `invoices/${encodeURIComponent(id)}/pay`,
} as const;

export const paymentApi = {
  create: "payments",
  transaction: "payments/transaction",
  transactions: "payments/transactions",
} as const;

export const subscriptionApi = {
  plans: "subscriptions/plans",
  current: "subscriptions/current",
  checkout: "subscriptions/checkout",
  portal: "subscriptions/portal",
} as const;

export const supportApi = {
  create: "support",
  tickets: "support/tickets",
  ticket: (id: string) => `support/tickets/${encodeURIComponent(id)}`,
} as const;

export const faqApi = {
  list: "faqs",
  byId: (id: string) => `faqs/${encodeURIComponent(id)}`,
} as const;

export const notificationApi = {
  all: "notifications",
  seen: "notifications/seen",
  byId: (id: string) => `notifications/${encodeURIComponent(id)}`,
} as const;

export const conversationApi = {
  list: (userId: string, page = 1, limit = 10) =>
    `conversations/${encodeURIComponent(userId)}?page=${encodeURIComponent(page)}&limit=${encodeURIComponent(limit)}`,
  messages: (participantId: string, page = 1, limit = 10) =>
    `conversations/${encodeURIComponent(participantId)}/messages?page=${encodeURIComponent(page)}&limit=${encodeURIComponent(limit)}&sort=desc`,
  sendMessage: "conversations/messages",
} as const;

export const placesApi = {
  suggest: "places/suggest",
} as const;
