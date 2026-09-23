/** Centralized API route map — paths relative to NEXT_PUBLIC_API_BASE_URL (/api). */

export const authApi = {
  login: "auth/login",
  customerRegister: "auth/customer/register",
  providerRegister: "auth/provider/register",
  sendOtp: "auth/send-otp",
  verifyOtp: "auth/verify-otp",
  /** Password recovery step 1 */
  forgotPassword: "auth/forgot-password-otp",
  /** Password recovery step 2 — body: `{ code }` */
  verifyForgotOtp: "auth/verify-forgot-otp",
  /** Password recovery step 3 — PUT with Bearer reset token + `{ newPassword }` */
  updatePasswordReset: "auth/update-password",
  refreshToken: "auth/refresh-token",
} as const;

export const userApi = {
  me: "user/me",
  profile: "user/profile",
  updatePassword: "user/update-password",
  /** GET customer quote/lead batches with professional seen tracking */
  quoteRequests: "user/quote-requests",
  /** GET customer estimates across CRM providers */
  estimates: "user/estimates",
  /** GET one customer estimate by CRM id */
  estimate: (id: string) => `user/estimates/${id}`,
  estimateApprove: (id: string) => `user/estimates/${id}/approve`,
  estimateReject: (id: string) => `user/estimates/${id}/reject`,
  estimateRequestChanges: (id: string) =>
    `user/estimates/${id}/request-changes`,
  /** GET customer invoices sent by providers */
  invoices: "user/invoices",
  /** GET one customer invoice by id */
  invoice: (id: string) => `user/invoices/${id}`,
} as const;

/** Customer bookings & orders (Bearer JWT, role: customer). */
export const bookingsApi = {
  /** GET slot availability — query: serviceId, date (YYYY-MM-DD), timezone? */
  availability: "bookings/availability",
} as const;

export const ordersApi = {
  /** GET customer order history */
  list: "orders",
  /** POST instant checkout & slot lock */
  checkout: "orders/checkout",
  /** GET/PUT one order by id */
  byId: (id: string) => `orders/${id}`,
  changeOrder: (id: string) => `orders/${id}/change-order`,
  signOff: (id: string) => `orders/${id}/sign-off`,
  cancel: (id: string) => `orders/${id}/cancel`,
  dispute: (id: string) => `orders/${id}/dispute`,
} as const;

export const providerApi = {
  /** GET/PUT provider business profile */
  profile: "provider/profile",
  /** PUT `{ workingHours: [...] }` */
  officeHours: "provider/settings/office-hours",
  /** GET list / POST create provider operational service areas */
  serviceAreas: "provider/service-areas",
  /** GET/PUT/DELETE one service area by id */
  serviceArea: (id: string) => `provider/service-areas/${id}`,
  /** GET list / POST create fixed-scope service packages */
  fixedServices: "provider/fixed-services",
  /** GET/PUT/DELETE one fixed service by id */
  fixedService: (id: string) => `provider/fixed-services/${id}`,
  /** GET list / POST create portfolio showcase projects */
  portfolio: "provider/portfolio",
  /** GET/PUT/DELETE one portfolio project by id */
  portfolioItem: (id: string) => `provider/portfolio/${id}`,
  /** PUT toggle featured flag (no body) */
  portfolioFeature: (id: string) => `provider/portfolio/${id}/feature`,
} as const;

export const providerOrdersApi = {
  /** GET list of provider assigned operational work orders */
  list: "provider/orders",
  /** GET one operational order details by id */
  byId: (id: string) => `provider/orders/${id}`,
  /** PUT accept booking request */
  accept: (id: string) => `provider/orders/${id}/accept`,
  /** PUT reject booking request */
  reject: (id: string) => `provider/orders/${id}/reject`,
  /** PUT depart / start transit */
  transit: (id: string) => `provider/orders/${id}/transit`,
  /** PUT arrive on site with geofence verification */
  arrive: (id: string) => `provider/orders/${id}/arrive`,
  /** PUT start physical work */
  startWork: (id: string) => `provider/orders/${id}/start-work`,
  /** POST propose in-app change order */
  changeOrder: (id: string) => `provider/orders/${id}/change-order`,
  /** PUT submit work completion with evidence */
  complete: (id: string) => `provider/orders/${id}/complete`,
  /** PUT provider emergency cancellation */
  cancel: (id: string) => `provider/orders/${id}/cancel`,
} as const;

/** Provider CRM / FSM endpoints (Bearer JWT, role: provider). */
export const providerCrmApi = {
  customers: "provider/customers",
  customer: (id: string) => `provider/customers/${id}`,
  customerTimeline: (id: string) => `provider/customers/${id}/timeline`,
  team: "provider/team",
  teamMember: (id: string) => `provider/team/${id}`,
  teamMemberAttachments: (id: string) => `provider/team/${id}/attachments`,
  teamMemberAttachment: (id: string, attachmentId: string) =>
    `provider/team/${id}/attachments/${attachmentId}`,
  contractors: "provider/contractors",
  contractor: (id: string) => `provider/contractors/${id}`,
  contractorAttachments: (id: string) => `provider/contractors/${id}/attachments`,
  contractorAttachment: (id: string, attachmentId: string) =>
    `provider/contractors/${id}/attachments/${attachmentId}`,
  vendors: "provider/vendors",
  vendor: (id: string) => `provider/vendors/${id}`,
  vendorInventory: (id: string) => `provider/vendors/${id}/inventory`,
  vendorInventoryItem: (id: string, skuId: string) =>
    `provider/vendors/${id}/inventory/${skuId}`,
  vendorInventoryReceive: (id: string, skuId: string) =>
    `provider/vendors/${id}/inventory/${skuId}/receive`,
  vendorOrders: (id: string) => `provider/vendors/${id}/orders`,
  vendorOrder: (id: string, orderId: string) => `provider/vendors/${id}/orders/${orderId}`,
  vendorJobs: (id: string) => `provider/vendors/${id}/jobs`,
  vendorAttachments: (id: string) => `provider/vendors/${id}/attachments`,
  vendorAttachment: (id: string, attachmentId: string) =>
    `provider/vendors/${id}/attachments/${attachmentId}`,
  requests: "provider/requests",
  requestsSummary: "provider/requests/summary",
  request: (id: string) => `provider/requests/${id}`,
  requestStatus: (id: string) => `provider/requests/${id}/status`,
  requestConvertToEstimate: (id: string) =>
    `provider/requests/${id}/convert-to-estimate`,
  estimates: "provider/estimates",
  estimate: (id: string) => `provider/estimates/${id}`,
  estimateActivities: (id: string) => `provider/estimates/${id}/activities`,
  estimateActivity: (id: string, activityId: string) => `provider/estimates/${id}/activities/${activityId}`,
  estimateShare: (id: string) => `provider/estimates/${id}/share`,
  estimateConvertToJob: (id: string) => `provider/estimates/${id}/convert-to-job`,
  jobs: "provider/jobs",
  job: (id: string) => `provider/jobs/${id}`,
  jobStatus: (id: string) => `provider/jobs/${id}/status`,
  jobConvertToInvoice: (id: string) => `provider/jobs/${id}/convert-to-invoice`,
  tasks: "provider/tasks",
  task: (id: string) => `provider/tasks/${id}`,
  taskStatus: (id: string) => `provider/tasks/${id}/status`,
  schedule: "provider/schedule",
  scheduleAssign: "provider/schedule/assign",
  scheduleItem: (id: string) => `provider/schedule/${id}`,
  reminders: "provider/reminders",
  reminder: (id: string) => `provider/reminders/${id}`,
  reminderStatus: (id: string) => `provider/reminders/${id}/status`,
  invoices: "provider/invoices",
  invoice: (id: string) => `provider/invoices/${id}`,
  invoiceSend: (id: string) => `provider/invoices/${id}/send`,
  invoicePayments: (id: string) => `provider/invoices/${id}/payments`,
  payments: "provider/payments",
  payment: (id: string) => `provider/payments/${id}`,
  chats: "provider/chats",
  chat: (id: string) => `provider/chats/${id}`,
  chatMessages: (id: string) => `provider/chats/${id}/messages`,
  chatRead: (id: string) => `provider/chats/${id}/read`,
  inboxSummary: "provider/chats/inbox-summary",
  /** GET list / POST create universal CRM notes */
  notes: "provider/notes",
  /** GET/PUT/DELETE one note by id */
  note: (id: string) => `provider/notes/${id}`,
  /** GET aggregated business reports dashboard */
  reports: "provider/reports",
} as const;

/** Public catalog endpoints (no provider auth required for reads). */
export const publicApi = {
  /** GET active categories; use `only_parent` / `parent_category_id` */
  categories: "public/categories",
  /** GET public professionals directory (Find a Professional) */
  professionals: "public/professionals",
  /** GET one public professional by slug */
  professional: (slug: string) => `public/professionals/${slug}`,
  /** GET related professionals for a pro or fixed service */
  professionalsRelated: "public/professionals/related",
  /** GET public portfolio showcase for a professional by id or slug */
  professionalPortfolio: (idOrSlug: string) =>
    `public/professionals/${idOrSlug}/portfolio`,
  /** GET public fixed-services search (customer directory) */
  fixedServices: "public/fixed-services",
  /** GET related fixed services for a pro or fixed service */
  fixedServicesRelated: "public/fixed-services/related",
  /** GET one public fixed service by id or slug */
  fixedService: (idOrSlug: string) => `public/fixed-services/${idOrSlug}`,
  /** GET one public portfolio project by id or slug */
  portfolio: (idOrSlug: string) => `public/portfolio/${idOrSlug}`,
  /** POST contact inquiry */
  contactUs: "public/contact-us",
  /** POST track public browsing interactions / leads */
  leadsTrack: "public/leads/track",
  /** POST submit structured quote questionnaire */
  quotes: "public/quotes",
  /** GET public estimate by share token */
  estimate: (token: string) => `public/estimates/${token}`,
  /** POST customer digital approval */
  estimateApprove: (token: string) => `public/estimates/${token}/approve`,
  /** POST customer decline */
  estimateReject: (token: string) => `public/estimates/${token}/reject`,
  /** POST customer request changes (same estimate lifecycle) */
  estimateRequestChanges: (token: string) =>
    `public/estimates/${token}/request-changes`,
  /** GET public blogs — query: page, limit, search, category */
  blogs: "public/blogs",
  /** GET one public blog by slug */
  blog: (slug: string) => `public/blogs/${slug}`,
  /** POST comment to a public blog by slug */
  blogComments: (slug: string) => `public/blogs/${slug}/comments`,
} as const;

export const publicQuoteApi = {
  quotes: "public/quotes",
  requests: "public/quote-requests",
} as const;

export const chatApi = {
  publicThreads: "public/chats",
  publicMessages: (id: string) => `public/chats/${id}/messages`,
  publicRead: (id: string) => `public/chats/${id}/read`,
  providerThreads: providerCrmApi.chats,
  providerThread: providerCrmApi.chat,
  providerMessages: providerCrmApi.chatMessages,
  providerRead: providerCrmApi.chatRead,
  providerInboxSummary: providerCrmApi.inboxSummary,
} as const;

/** Authenticated in-app notifications (customer + provider). */
export const notificationsApi = {
  list: "notifications",
  markRead: (id: string) => `notifications/${id}/read`,
  markAllRead: "notifications/mark-all-read",
} as const;

export const uploadApi = {
  /** POST multipart field `image` → `{ image: url }` */
  image: "upload-image",
  file: "upload-file",
  document: "upload-file",
} as const;

/** Aliases used by upload helpers */
export const imageUpload = uploadApi.image;
export const FileUpload = uploadApi.file;
export const DocUpload = uploadApi.document;
