import axios from "axios";

/** Pure error-message helper — safe for Redux slices (no store import). */
export function extractErrorMessage(error: unknown): string {
  if (!axios.isAxiosError(error)) {
    if (typeof error === "string" && error.trim()) return error.trim();
    if (error instanceof Error && error.message) return error.message;
    return "Something went wrong. Please try again.";
  }

  const data = error.response?.data as
    | {
        message?: string;
        error?: string;
        errors?: Array<string | { field?: string; message?: string }>;
      }
    | string
    | undefined;

  if (typeof data === "string" && data.trim()) return data.trim();

  if (data && typeof data === "object") {
    const fieldErrors = Array.isArray(data.errors)
      ? data.errors
          .map((item) => {
            if (typeof item === "string") return item.trim();
            const field = item.field?.trim();
            const msg = item.message?.trim();
            if (field && msg) return `${field}: ${msg}`;
            return msg || field || "";
          })
          .filter(Boolean)
      : [];

    const apiMessage =
      (typeof data.message === "string" && data.message.trim()) ||
      (typeof data.error === "string" && data.error.trim()) ||
      "";

    if (apiMessage && fieldErrors.length > 0) {
      if (fieldErrors.length === 1 && fieldErrors[0] === apiMessage) {
        return apiMessage;
      }
      if (/validation error/i.test(apiMessage)) return fieldErrors.join(" · ");
      return `${apiMessage} — ${fieldErrors.join(" · ")}`;
    }

    if (apiMessage) return apiMessage;
    if (fieldErrors.length > 0) return fieldErrors.join(" · ");
  }

  if (error.code === "ERR_NETWORK") {
    return "Network error. Check your connection and try again.";
  }

  if (error.response?.status === 500) {
    return "Server error. Please try again shortly.";
  }

  return error.message || "Request failed. Please try again.";
}
