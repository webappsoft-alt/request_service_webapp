/** Centralized API route map — only endpoints used by this webapp */

export const authApi = {
  login: "auth/login",
  register: "auth/register",
  sendOtp: "auth/send-otp",
  verifyOtp: "auth/verify-otp",
  forgotPassword: "auth/forgot-password",
  verifyResetOtp: "auth/verify-reset-otp",
  resetPassword: "auth/reset-password",
  me: "auth/me",
} as const;

export const userApi = {
  me: "user/me",
  profile: "user/profile",
  updatePassword: "user/update-password",
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
