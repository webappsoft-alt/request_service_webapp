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
