"use client";

import axios, {
  type AxiosError,
  type AxiosInstance,
  type AxiosRequestConfig,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from "axios";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { getStore } from "@/store";
import {
  clearAuth,
  logout as logoutAction,
  setCredentials,
  updateAuthUser,
  type AuthPayload,
  type AuthUser,
} from "@/store/authSlice";
import { decryptData } from "./encrypted";
import { authApi } from "./ApiRoutesFile";

export type QueryParams = Record<
  string,
  string | number | boolean | null | undefined
>;

export type RequestOptions = {
  silent?: boolean;
  multipart?: boolean;
  token?: string | null;
  config?: AxiosRequestConfig;
  skipLogoutOn401?: boolean;
};

export type LogoutOptions = {
  silent?: boolean;
  skipRedirect?: boolean;
};

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

let authMePromise: Promise<AuthUser | null> | null = null;
let logoutInFlight = false;

function clearAuthMeCache(): void {
  authMePromise = null;
}

/** Decrypt the persisted `userData` blob from Redux. */
export function getPersistedAuth(): AuthPayload | null {
  if (!isBrowser()) return null;
  try {
    const encrypted = getStore().getState().auth.userData;
    if (!encrypted) return null;
    return decryptData<AuthPayload>(encrypted);
  } catch {
    return null;
  }
}

export function getAuthToken(): string | null {
  if (!isBrowser()) return null;
  const fromPersist = getPersistedAuth()?.token;
  if (fromPersist) return fromPersist;
  return getStore().getState().auth.token;
}

export function getAuthUser(): AuthUser | null {
  if (!isBrowser()) return null;
  const fromPersist = getPersistedAuth()?.user;
  if (fromPersist) return fromPersist;
  return getStore().getState().auth.user;
}

function getBearerToken(override?: string | null): string | null {
  if (override !== undefined && override !== null) return override;
  return getAuthToken();
}

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

export function showApiErrorToast(
  errorOrMessage: unknown,
  fallback = "Something went wrong. Please try again.",
): string {
  const message =
    typeof errorOrMessage === "string" && errorOrMessage.trim()
      ? errorOrMessage.trim()
      : extractErrorMessage(errorOrMessage) || fallback;
  if (isBrowser()) toast.error(message);
  return message;
}

export function handleUserLogout(options: LogoutOptions = {}): void {
  if (logoutInFlight) return;
  logoutInFlight = true;

  try {
    clearAuthMeCache();
    if (isBrowser()) {
      try {
        getStore().dispatch(logoutAction());
      } catch {
        getStore().dispatch(clearAuth());
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
          path.startsWith("/verify-otp") ||
          path.startsWith("/pro/login") ||
          path.startsWith("/pro/register") ||
          path.startsWith("/forgot-password") ||
          path.startsWith("/verify-forgot-otp") ||
          path.startsWith("/reset-password") ||
          path.startsWith("/pro/forgot-password") ||
          path.startsWith("/pro/verify-forgot-otp") ||
          path.startsWith("/pro/reset-password");

        if (!isAuthPage) {
          window.location.href = path.startsWith("/pro")
            ? "/pro/login"
            : "/login";
        }
      }
    }
  } finally {
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

function handleHttpError(
  error: unknown,
  options?: RequestOptions | boolean,
): never {
  const silent = typeof options === "boolean" ? options : options?.silent;
  const skipLogout =
    typeof options === "object" && Boolean(options?.skipLogoutOn401);

  if (axios.isAxiosError(error)) {
    const status = error.response?.status;
    if (status === 401) {
      if (!silent && isBrowser()) {
        toast.error(
          extractErrorMessage(error) ||
            "Your session has expired. Please sign in again.",
        );
      }
      if (!skipLogout) {
        handleUserLogout({ silent: true });
      }
      throw error;
    }
  }

  notifyRequestError(error, silent);
  throw error;
}

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
    (error: AxiosError) => Promise.reject(error),
  );

  return instance;
}

const http = createApiClient();

function resolveConfig(options: RequestOptions = {}): AxiosRequestConfig {
  const headers: Record<string, string> = {};
  const token = getBearerToken(options.token);
  if (token) headers.Authorization = `Bearer ${token}`;

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
    handleHttpError(error, options);
  }
}

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

export async function deleteData<T = unknown>(
  endpoint: string,
  options?: RequestOptions,
): Promise<T> {
  return unwrap<T>(
    http.delete<T>(buildUrl(endpoint), resolveConfig(options)),
    options,
  );
}

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

/**
 * Refresh latest user via GET /auth/me when logged in.
 * Only updates the persisted `user` (and provider) — never replaces the
 * login/register token or full session blob.
 */
export async function refreshAuthMe(): Promise<AuthUser | null> {
  if (!isBrowser()) return null;

  const previousToken = getAuthToken();
  if (!previousToken) return null;
  if (authMePromise) return authMePromise;

  authMePromise = (async () => {
    try {
      const meRes = await getData<{
        user?: AuthUser & { _id?: string; name?: string };
        provider?: unknown;
      }>(authApi.me, undefined, { silent: true });

      const rawUser = meRes?.user;
      if (!rawUser || typeof rawUser !== "object") return null;

      getStore().dispatch(
        updateAuthUser({
          user: rawUser,
          ...(meRes?.provider !== undefined
            ? { provider: meRes.provider }
            : {}),
        }),
      );

      return getAuthUser();
    } finally {
      authMePromise = null;
    }
  })();

  return authMePromise;
}

export function useAuth() {
  const [token, setToken] = useState<string | null>(() =>
    isBrowser() ? getAuthToken() : null,
  );
  const [userData, setUserData] = useState<AuthUser | null>(() =>
    isBrowser() ? getAuthUser() : null,
  );

  useEffect(() => {
    if (!isBrowser()) return;

    const sync = () => {
      clearAuthMeCache();
      setToken(getAuthToken());
      setUserData(getAuthUser());
    };

    window.addEventListener("auth-change", sync);
    window.addEventListener("storage", sync);

    return () => {
      window.removeEventListener("auth-change", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  return {
    token,
    userData,
    handleUserLogout,
    getPersistedAuth,
    getAuthToken,
    getAuthUser,
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
