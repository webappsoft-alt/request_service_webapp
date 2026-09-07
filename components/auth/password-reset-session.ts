/** Session helpers for the password-reset OTP flow (auth.md §3.4–3.6). */

export const PASSWORD_RESET_EMAIL_KEY = "rs-password-reset-email";
export const PASSWORD_RESET_TOKEN_KEY = "rs-password-reset-token";

export type PasswordResetSession = {
  email: string;
  token: string;
};

export function savePasswordResetEmail(email: string): void {
  try {
    sessionStorage.setItem(PASSWORD_RESET_EMAIL_KEY, email.trim());
  } catch {
    // ignore
  }
}

export function readPasswordResetEmail(): string {
  try {
    return sessionStorage.getItem(PASSWORD_RESET_EMAIL_KEY)?.trim() || "";
  } catch {
    return "";
  }
}

export function savePasswordResetToken(token: string, email?: string): void {
  try {
    sessionStorage.setItem(PASSWORD_RESET_TOKEN_KEY, token);
    if (email) savePasswordResetEmail(email);
  } catch {
    // ignore
  }
}

export function readPasswordResetToken(): string {
  try {
    return sessionStorage.getItem(PASSWORD_RESET_TOKEN_KEY)?.trim() || "";
  } catch {
    return "";
  }
}

export function clearPasswordResetSession(): void {
  try {
    sessionStorage.removeItem(PASSWORD_RESET_EMAIL_KEY);
    sessionStorage.removeItem(PASSWORD_RESET_TOKEN_KEY);
  } catch {
    // ignore
  }
}
