"use client";

import axios, {
  type AxiosError,
  type AxiosInstance,
  type AxiosRequestConfig,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from "axios";
import Cookies from "js-cookie";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { getStore } from "@/store";
import { logout as logoutAction } from "@/store/authSlice";
import { decryptData } from "./encrypted";
import {
  TOKEN_COOKIE_NAME,
  TOKEN_STORAGE_KEY,
  USER_STORAGE_KEY,
  type AuthUser,
  getAuthToken,
  getUserDataCookie,
  removeAuthToken,
  removeUserDataCookie,
  setUserDataCookie,
  shouldSuppressAuthChange,
  logUserCookieDebug,
} from "./cookieUtils";
import { userApi } from "./ApiRoutesFile";

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

export type QueryParams = Record<
  string,
  string | number | boolean | null | undefined
>;

export type RequestOptions = {
  /** Skip Sonner toasts for this call (caller handles UI). */
  silent?: boolean;
  /** Send multipart/form-data (do not force JSON Content-Type). */
  multipart?: boolean;
  /** Override Bearer token for this request. */
  token?: string | null;
  /** Extra Axios config merged into the request. */
  config?: AxiosRequestConfig;
};

export type LogoutOptions = {
  silent?: boolean;
  skipRedirect?: boolean;
};

type CookiesWithPatch = typeof Cookies & { __rsPatched?: boolean };

/* -------------------------------------------------------------------------- */
/* Env / URL                                                                  */
/* -------------------------------------------------------------------------- */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

function buildUrl(endpoint: string): string {
  const base = String(API_BASE_URL || "").replace(/\/+$/, "");
  const path = String(endpoint || "").replace(/^\/+/, "");
  if (!base) return `/${path}`;
  return `${base}/${path}`;
}

/* -------------------------------------------------------------------------- */
/* Cookie auth-change patch (browser only)                                    */
/* -------------------------------------------------------------------------- */

function patchCookieAuthEvents(): void {
  if (!isBrowser()) return;

  const cookieJar = Cookies as CookiesWithPatch;
  if (cookieJar.__rsPatched) return;

  const originalSet = Cookies.set.bind(Cookies);
  Cookies.set = ((
    name: string,
    value: string,
    options?: Cookies.CookieAttributes,
  ) => {
    const result = originalSet(name, value, options);
    if (
      !shouldSuppressAuthChange() &&
      (name === TOKEN_COOKIE_NAME ||
        name.startsWith("userData-rs-user") ||
        name.startsWith("rs-user-data-chunk"))
    ) {
      window.dispatchEvent(new Event("auth-change"));
    }
    return result;
  }) as typeof Cookies.set;

  const originalRemove = Cookies.remove.bind(Cookies);
  Cookies.remove = ((name: string, options?: Cookies.CookieAttributes) => {
    const result = originalRemove(name, options);
    if (
      !shouldSuppressAuthChange() &&
      (name === TOKEN_COOKIE_NAME ||
        name.startsWith("userData-rs-user") ||
        name.startsWith("rs-user-data-chunk"))
    ) {
      window.dispatchEvent(new Event("auth-change"));
    }
    return result;
  }) as typeof Cookies.remove;

  cookieJar.__rsPatched = true;
}

patchCookieAuthEvents();

/* -------------------------------------------------------------------------- */
/* Auth helpers                                                               */
/* -------------------------------------------------------------------------- */

/** Shared /user/me bootstrap so every useAuth() mount does not hit the network. */
let authMePromise: Promise<AuthUser | null> | null = null;
let logoutInFlight = false;

function clearAuthMeCache(): void {
  authMePromise = null;
}

function getBearerToken(override?: string | null): string | null {
  if (override !== undefined && override !== null) return override;
  if (!isBrowser()) return null;
  return getAuthToken();
}

function extractErrorMessage(error: unknown): string {
  if (!axios.isAxiosError(error)) {
    if (error instanceof Error && error.message) return error.message;
    return "Something went wrong. Please try again.";
  }

  const data = error.response?.data as
    | { message?: string; error?: string; errors?: string[] }
    | string
    | undefined;

  if (typeof data === "string" && data.trim()) return data;
  if (data && typeof data === "object") {
    if (typeof data.message === "string" && data.message.trim()) {
      return data.message;
    }
    if (typeof data.error === "string" && data.error.trim()) {
      return data.error;
    }
    if (Array.isArray(data.errors) && data.errors.length > 0) {
      return data.errors.join(", ");
    }
  }

  if (error.code === "ERR_NETWORK") {
    return "Network error. Check your connection and try again.";
  }

  if (error.response?.status === 500) {
    return "Server error. Please try again shortly.";
  }

  return error.message || "Request failed. Please try again.";
}

/**
 * Clears encrypted session, dispatches Redux logout, and redirects safely.
 */
export function handleUserLogout(options: LogoutOptions = {}): void {
  if (logoutInFlight) return;
  logoutInFlight = true;

  try {
    clearAuthMeCache();

    if (isBrowser()) {
      try {
        getStore().dispatch(logoutAction());
      } catch {
        // Store may be unavailable outside the provider tree — still clear storage.
        removeAuthToken();
        removeUserDataCookie();
      }

      try {
        localStorage.removeItem(TOKEN_STORAGE_KEY);
        localStorage.removeItem(USER_STORAGE_KEY);
        localStorage.removeItem("rs-temp-otp-token");
        localStorage.removeItem("rs-redux-auth");
      } catch {
        // ignore storage errors
      }

      if (!options.silent) {
        toast.success("Signed out successfully");
      }

      if (!options.skipRedirect) {
        const path = window.location.pathname || "";
        const isAuthPage =
          path.startsWith("/login") ||
          path.startsWith("/register") ||
          path.startsWith("/signup") ||
          path.startsWith("/pro/login") ||
          path.startsWith("/pro/register") ||
          path.startsWith("/forgot-password") ||
          path.startsWith("/reset-password") ||
          path.startsWith("/pro/forgot-password") ||
          path.startsWith("/pro/reset-password");

        if (!isAuthPage) {
          window.location.href = path.startsWith("/pro")
            ? "/pro/login"
            : "/login";
        }
      }
    } else {
      // SSR / non-browser: clear cookie helpers only (no window / no redirect).
      removeAuthToken();
      removeUserDataCookie();
    }
  } finally {
    // Allow a future logout after navigation settles.
    if (isBrowser()) {
      window.setTimeout(() => {
        logoutInFlight = false;
      }, 800);
    } else {
      logoutInFlight = false;
    }
  }
}

function notifyRequestError(error: unknown, silent?: boolean): void {
  if (silent) return;
  if (!isBrowser()) return;
  toast.error(extractErrorMessage(error));
}

function handleHttpError(error: unknown, silent?: boolean): never {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status;
    if (status === 401) {
      if (!silent && isBrowser()) {
        toast.error("Your session has expired. Please sign in again.");
      }
      handleUserLogout({ silent: true });
      throw error;
    }
  }

  notifyRequestError(error, silent);
  throw error;
}

/* -------------------------------------------------------------------------- */
/* Axios instance + interceptors                                              */
/* -------------------------------------------------------------------------- */

function createApiClient(): AxiosInstance {
  const instance = axios.create({
    baseURL: String(API_BASE_URL || "").replace(/\/+$/, "") || undefined,
    timeout: 30_000,
  });

  instance.interceptors.request.use((config: InternalAxiosRequestConfig) => {
    const headers = config.headers;
    const isMultipart =
      typeof FormData !== "undefined" && config.data instanceof FormData;

    if (!isMultipart && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }

    if (!headers.has("Authorization") && isBrowser()) {
      const token = getAuthToken();
      if (token) {
        headers.set("Authorization", `Bearer ${token}`);
      }
    }

    return config;
  });

  instance.interceptors.response.use(
    (response: AxiosResponse) => response,
    (error: AxiosError) => {
      // Let per-call handlers decide toast / logout; still normalize here for 401.
      if (error.response?.status === 401 && isBrowser()) {
        // Defer to handleHttpError when called from helpers; interceptor alone
        // should not double-toast. Logout is triggered in handleHttpError.
      }
      return Promise.reject(error);
    },
  );

  return instance;
}

const http = createApiClient();

function resolveConfig(
  options: RequestOptions = {},
): AxiosRequestConfig {
  const headers: Record<string, string> = {};
  const token = getBearerToken(options.token);

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  if (options.multipart) {
    // Let the browser set multipart boundary.
  }

  return {
    ...options.config,
    headers: {
      ...headers,
      ...(options.config?.headers as Record<string, string> | undefined),
    },
  };
}

async function unwrap<T>(
  promise: Promise<AxiosResponse<T>>,
  options?: RequestOptions,
): Promise<T> {
  try {
    const response = await promise;
    return response.data;
  } catch (error) {
    handleHttpError(error, options?.silent);
  }
}

/* -------------------------------------------------------------------------- */
/* Centralized CRUD                                                           */
/* -------------------------------------------------------------------------- */

/** GET — optional query params object. */
export async function getData<T = unknown>(
  endpoint: string,
  params?: QueryParams,
  options?: RequestOptions,
): Promise<T> {
  return unwrap<T>(
    http.get<T>(buildUrl(endpoint), {
      ...resolveConfig(options),
      params,
    }),
    options,
  );
}

/** GET that treats 404 as `null` (no error toast). */
export async function getDataOptional<T = unknown>(
  endpoint: string,
  params?: QueryParams,
  options?: RequestOptions,
): Promise<T | null> {
  try {
    return await getData<T>(endpoint, params, { ...options, silent: true });
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 404) {
      return null;
    }
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      handleUserLogout({ silent: true });
      throw error;
    }
    notifyRequestError(error, options?.silent);
    throw error;
  }
}

/** POST */
export async function postData<T = unknown>(
  endpoint: string,
  payload?: unknown,
  options?: RequestOptions,
): Promise<T> {
  return unwrap<T>(
    http.post<T>(buildUrl(endpoint), payload, resolveConfig(options)),
    options,
  );
}

/** PUT */
export async function putData<T = unknown>(
  endpoint: string,
  payload?: unknown,
  options?: RequestOptions,
): Promise<T> {
  return unwrap<T>(
    http.put<T>(buildUrl(endpoint), payload, resolveConfig(options)),
    options,
  );
}

/** PATCH */
export async function patchData<T = unknown>(
  endpoint: string,
  payload?: unknown,
  options?: RequestOptions,
): Promise<T> {
  return unwrap<T>(
    http.patch<T>(buildUrl(endpoint), payload, resolveConfig(options)),
    options,
  );
}

/** DELETE */
export async function deleteData<T = unknown>(
  endpoint: string,
  options?: RequestOptions,
): Promise<T> {
  return unwrap<T>(
    http.delete<T>(buildUrl(endpoint), resolveConfig(options)),
    options,
  );
}

/**
 * Backward-compatible namespace used by existing call sites.
 * Prefer the named helpers (`getData`, `postData`, …) for new code.
 */
export const api = {
  get: getData,
  getOptional: getDataOptional,
  post: (endpoint: string, payload?: unknown, isMultipart = false) =>
    postData(endpoint, payload, { multipart: isMultipart }),
  put: (
    endpoint: string,
    payload?: unknown,
    isMultipart = false,
    customToken: string | null = null,
  ) =>
    putData(endpoint, payload, {
      multipart: isMultipart,
      token: customToken,
    }),
  patch: (endpoint: string, payload?: unknown, isMultipart = false) =>
    patchData(endpoint, payload, { multipart: isMultipart }),
  deleteData,
};

/* -------------------------------------------------------------------------- */
/* Auth bootstrap hook                                                        */
/* -------------------------------------------------------------------------- */

function fetchAuthMeOnce(): Promise<AuthUser | null> {
  if (authMePromise) return authMePromise;

  authMePromise = getData<Record<string, unknown>>(userApi.me, undefined, {
    silent: true,
  })
    .then((meRes) => {
      const data = meRes?.data;
      if (data && typeof data === "object" && data !== null && "user" in data) {
        return (data as { user: AuthUser }).user;
      }
      if (data && typeof data === "object" && data !== null) {
        return data as AuthUser;
      }
      if (meRes?.user && typeof meRes.user === "object") {
        return meRes.user as AuthUser;
      }
      return (meRes as unknown as AuthUser) || null;
    })
    .catch((err: unknown) => {
      authMePromise = null;
      throw err;
    });

  return authMePromise;
}

export function useAuth() {
  const readUser = (): AuthUser | null => {
    const fromCookie = getUserDataCookie();
    if (fromCookie) return fromCookie;

    if (isBrowser()) {
      try {
        const userDataStr = localStorage.getItem(USER_STORAGE_KEY);
        if (userDataStr) return decryptData<AuthUser>(userDataStr);
      } catch {
        return null;
      }
    }
    return null;
  };

  const [token, setToken] = useState<string | null>(() =>
    isBrowser() ? getAuthToken() : null,
  );
  const [userData, setUserData] = useState<AuthUser | null>(() =>
    isBrowser() ? readUser() : null,
  );

  useEffect(() => {
    if (!isBrowser()) return;

    const onAuthChange = () => {
      clearAuthMeCache();
      setToken(getAuthToken());
      setUserData(readUser());
    };

    window.addEventListener("auth-change", onAuthChange);
    window.addEventListener("storage", onAuthChange);

    (async () => {
      logUserCookieDebug("useAuth mount");
      const activeToken = getAuthToken();
      if (!activeToken) return;

      try {
        const apiUser = await fetchAuthMeOnce();
        if (apiUser && typeof apiUser === "object") {
          setUserDataCookie(apiUser, { quiet: true });
          setUserData(apiUser);
        }
      } catch (err) {
        const axiosErr = err as AxiosError;
        console.error(
          "[useAuth] GET user/me failed:",
          axiosErr?.response?.data || axiosErr?.message || err,
        );
      } finally {
        clearAuthMeCache();
      }
    })();

    return () => {
      window.removeEventListener("auth-change", onAuthChange);
      window.removeEventListener("storage", onAuthChange);
    };
  }, []);

  return {
    token,
    userData,
    handleUserLogout,
  };
}

export default function ApiFunction() {
  const auth = useAuth();
  return {
    getData,
    postData,
    putData,
    patchData,
    deleteData,
    getDataOptional,
    get: getData,
    getOptional: getDataOptional,
    post: api.post,
    put: api.put,
    patch: api.patch,
    ...auth,
  };
}

export {
  getUserDataCookie,
  setUserDataCookie,
  removeUserDataCookie,
  getAuthToken,
  setAuthToken,
  removeAuthToken,
} from "./cookieUtils";
