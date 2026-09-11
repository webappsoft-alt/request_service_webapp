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
} as const;

/** Public catalog endpoints (no provider auth required for reads). */
export const publicApi = {
  /** GET active categories; use `only_parent` / `parent_category_id` */
  categories: "public/categories",
  /** GET public professionals directory (Find a Professional) */
  professionals: "public/professionals",
  /** GET related professionals for a pro or fixed service */
  professionalsRelated: "public/professionals/related",
  /** GET public fixed-services search (customer directory) */
  fixedServices: "public/fixed-services",
  /** GET one public fixed service by id or slug */
  fixedService: (idOrSlug: string) => `public/fixed-services/${idOrSlug}`,
  /** POST contact inquiry */
  contactUs: "public/contact-us",
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
