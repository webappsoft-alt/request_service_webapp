import Cookies from "js-cookie";
import { decryptData, encryptData } from "./encrypted";

const COOKIE_BASE_NAME = "rs-user-data-chunk";
const LEGACY_COOKIE_NAME = "userData-rs-user";
export const TOKEN_COOKIE_NAME = "token-rs-user";
export const TOKEN_STORAGE_KEY = "token-rs-user";
export const USER_STORAGE_KEY = "userData-rs-user";

export type AuthUser = {
  id?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  role?: string;
  [key: string]: unknown;
};

export type CookieWriteOptions = {
  quiet?: boolean;
};

/** When true, cookie write/remove should not emit auth-change (avoids fetch loops). */
let suppressAuthChangeEvents = 0;

export function beginQuietAuthCookieWrite(): void {
  suppressAuthChangeEvents += 1;
}

export function endQuietAuthCookieWrite(): void {
  suppressAuthChangeEvents = Math.max(0, suppressAuthChangeEvents - 1);
}

export function shouldSuppressAuthChange(): boolean {
  return suppressAuthChangeEvents > 0;
}

/** Debug helper — lists Request Services auth cookie names in the browser. */
export function logUserCookieDebug(label = "Cookie debug"): void {
  if (typeof window === "undefined") return;

  const cookieNames = document.cookie
    .split(";")
    .map((c) => c.trim().split("=")[0])
    .filter(Boolean);

  const rsCookies = cookieNames.filter(
    (name) =>
      name.includes("rs-user") ||
      name.includes("userData-rs") ||
      name.includes("token-rs"),
  );

  if (process.env.NODE_ENV === "development") {
    console.debug(`[${label}]`, rsCookies);
  }
}

/** Persist user cookie (chunked for size limits). */
export function setUserDataCookie(
  userData: AuthUser | Record<string, unknown>,
  options: CookieWriteOptions = {},
): void {
  const quiet = options.quiet === true;
  if (quiet) beginQuietAuthCookieWrite();

  try {
    const encrypted = encryptData(userData);
    const chunkSize = 1000;

    let i = 0;
    while (Cookies.get(`${COOKIE_BASE_NAME}-${i}`)) {
      Cookies.remove(`${COOKIE_BASE_NAME}-${i}`, { path: "/" });
      i++;
    }

    Cookies.remove(LEGACY_COOKIE_NAME, { path: "/" });
    Cookies.remove(LEGACY_COOKIE_NAME);

    if (!encrypted) {
      console.warn("[setUserDataCookie] encrypt returned empty — not saving");
      return;
    }

    let currentChunk = 0;
    for (let offset = 0; offset < encrypted.length; offset += chunkSize) {
      const chunk = encrypted.slice(offset, offset + chunkSize);
      Cookies.set(`${COOKIE_BASE_NAME}-${currentChunk}`, chunk, {
        expires: 7,
        path: "/",
      });
      currentChunk++;
    }

    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(USER_STORAGE_KEY, encrypted);
      } catch (err) {
        console.warn("[setUserDataCookie] localStorage fallback failed:", err);
      }
      if (!quiet) {
        window.dispatchEvent(new Event("auth-change"));
      }
    }
  } finally {
    if (quiet) endQuietAuthCookieWrite();
  }
}

export function getUserDataCookieStr(): string {
  let cookieValue = "";
  let i = 0;

  while (true) {
    const name = `${COOKIE_BASE_NAME}-${i}`;
    const chunk = Cookies.get(name);
    if (!chunk) break;
    cookieValue += chunk;
    i++;
  }

  if (!cookieValue) {
    const legacy = Cookies.get(LEGACY_COOKIE_NAME);
    if (legacy) return legacy;
  }

  return cookieValue;
}

export function getUserDataCookie(): AuthUser | null {
  const cookieValue = getUserDataCookieStr();

  if (!cookieValue) {
    if (typeof window !== "undefined") {
      const fromStorage = localStorage.getItem(USER_STORAGE_KEY);
      if (fromStorage) return decryptData<AuthUser>(fromStorage);
    }
    return null;
  }

  return decryptData<AuthUser>(cookieValue);
}

export function removeUserDataCookie(): void {
  let i = 0;
  while (Cookies.get(`${COOKIE_BASE_NAME}-${i}`)) {
    Cookies.remove(`${COOKIE_BASE_NAME}-${i}`, { path: "/" });
    i++;
  }

  Cookies.remove(LEGACY_COOKIE_NAME, { path: "/" });
  Cookies.remove(LEGACY_COOKIE_NAME);

  if (typeof window !== "undefined") {
    localStorage.removeItem(USER_STORAGE_KEY);
    window.dispatchEvent(new Event("auth-change"));
  }
}

export function setAuthToken(
  token: string,
  options: CookieWriteOptions = {},
): void {
  const quiet = options.quiet === true;
  if (quiet) beginQuietAuthCookieWrite();
  try {
    const encrypted = encryptData(token);
    if (!encrypted) return;
    Cookies.set(TOKEN_COOKIE_NAME, encrypted, { expires: 7, path: "/" });
    if (typeof window !== "undefined") {
      localStorage.setItem(TOKEN_STORAGE_KEY, encrypted);
      if (!quiet) window.dispatchEvent(new Event("auth-change"));
    }
  } finally {
    if (quiet) endQuietAuthCookieWrite();
  }
}

export function getAuthToken(): string | null {
  const cookieToken = Cookies.get(TOKEN_COOKIE_NAME);
  if (cookieToken) {
    const decrypted = decryptData<string>(cookieToken);
    return typeof decrypted === "string" ? decrypted : null;
  }
  if (typeof window !== "undefined") {
    const stored = localStorage.getItem(TOKEN_STORAGE_KEY);
    if (!stored) return null;
    const decrypted = decryptData<string>(stored);
    return typeof decrypted === "string" ? decrypted : null;
  }
  return null;
}

export function removeAuthToken(): void {
  Cookies.remove(TOKEN_COOKIE_NAME, { path: "/" });
  Cookies.remove(TOKEN_COOKIE_NAME);
  if (typeof window !== "undefined") {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
  }
}
