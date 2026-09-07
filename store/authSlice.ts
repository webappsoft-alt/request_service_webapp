import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import { decryptData, encryptData } from "@/components/api/encrypted";

export type AuthUser = {
  id?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  role?: string;
  phone?: string;
  zip?: string;
  /** Customer avatar URL from auth /me and profile update */
  avatarUrl?: string;
  avatar?: string;
  name?: string;
  status?: string;
  location?: {
    type?: string;
    coordinates?: [number, number] | number[];
    city?: string;
    country?: string;
    address?: string;
    zip?: string;
    state?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
};

/** Resolve display URL from avatarUrl / avatar. */
export function getUserAvatarSrc(
  user: AuthUser | null | undefined,
): string | undefined {
  if (!user) return undefined;
  for (const key of ["avatarUrl", "avatar"] as const) {
    const value = user[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return undefined;
}

/**
 * Normalize profile /me user payloads (may use `_id` + combined `name`)
 * into the shape we store from login/register.
 */
export function normalizeAuthUser(
  raw: AuthUser & { _id?: string; name?: string },
  previous?: AuthUser | null,
): AuthUser {
  const id =
    (typeof raw.id === "string" && raw.id) ||
    (typeof raw._id === "string" && raw._id) ||
    previous?.id;

  let firstName =
    typeof raw.firstName === "string" ? raw.firstName.trim() : undefined;
  let lastName =
    typeof raw.lastName === "string" ? raw.lastName.trim() : undefined;

  if ((!firstName || !lastName) && typeof raw.name === "string" && raw.name.trim()) {
    const parts = raw.name.trim().split(/\s+/);
    firstName = firstName || parts[0] || previous?.firstName;
    lastName =
      lastName ||
      (parts.length > 1 ? parts.slice(1).join(" ") : previous?.lastName);
  }

  return {
    ...previous,
    ...raw,
    id,
    firstName: firstName || previous?.firstName,
    lastName: lastName || previous?.lastName,
    email: (typeof raw.email === "string" && raw.email) || previous?.email,
    phone: (typeof raw.phone === "string" && raw.phone) || previous?.phone,
    zip: (typeof raw.zip === "string" && raw.zip) || previous?.zip,
    avatarUrl:
      (typeof raw.avatarUrl === "string" && raw.avatarUrl) ||
      previous?.avatarUrl,
    role: (typeof raw.role === "string" && raw.role) || previous?.role,
  };
}

/** US state / province codes sometimes arrive in `country` from the API. */
function looksLikeRegionCode(value: string): boolean {
  return /^[A-Za-z]{2}$/.test(value.trim());
}

function fixMistakenCountry(
  country: unknown,
  state: unknown,
): string | undefined {
  if (typeof country !== "string" || !country.trim()) {
    return typeof country === "string" ? country : undefined;
  }
  const c = country.trim();
  const s = typeof state === "string" ? state.trim() : "";
  if (s && c.toUpperCase() === s.toUpperCase() && looksLikeRegionCode(c)) {
    return "US";
  }
  return c;
}

/**
 * Clean login/register payloads before persist (keep token untouched).
 * Fixes common provider country=state mistakes from the API.
 */
export function normalizeAuthPayload(payload: AuthPayload): AuthPayload {
  const user = payload.user
    ? normalizeAuthUser(payload.user as AuthUser & { _id?: string; name?: string })
    : payload.user;

  let provider = payload.provider;
  if (provider && typeof provider === "object") {
    const next = { ...(provider as Record<string, unknown>) };
    next.country = fixMistakenCountry(next.country, next.state) ?? next.country;

    if (next.location && typeof next.location === "object") {
      const location = { ...(next.location as Record<string, unknown>) };
      const state = location.state ?? next.state;
      location.country =
        fixMistakenCountry(location.country, state) ?? location.country;
      next.location = location;
    }
    provider = next;
  }

  return {
    ...payload,
    user,
    provider,
  };
}

/** Shape of login / verify-otp payloads we encrypt into `userData`. */
export type AuthPayload = {
  token?: string;
  refreshToken?: string;
  user?: AuthUser;
  provider?: unknown;
  message?: string;
  verificationToken?: string;
  email?: string;
  [key: string]: unknown;
};

export type AuthState = {
  /** Single encrypted blob persisted by redux-persist (key: userData). */
  userData: string | null;
  user: AuthUser | null;
  token: string | null;
  refreshToken: string | null;
  role: string | null;
  isAuthenticated: boolean;
  loading: boolean;
  error: string | null;
  hydrated: boolean;
};

const initialState: AuthState = {
  userData: null,
  user: null,
  token: null,
  refreshToken: null,
  role: null,
  isAuthenticated: false,
  loading: false,
  error: null,
  hydrated: false,
};

function applyDecryptedPayload(state: AuthState, payload: AuthPayload | null) {
  if (!payload?.token || !payload?.user) {
    state.user = null;
    state.token = null;
    state.refreshToken = null;
    state.role = null;
    state.isAuthenticated = false;
    return;
  }
  state.user = payload.user;
  state.token = payload.token;
  state.refreshToken =
    typeof payload.refreshToken === "string" ? payload.refreshToken : null;
  state.role = payload.user.role || null;
  state.isAuthenticated = true;
}

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    /** Mark persist rehydration complete and decrypt `userData` into memory. */
    hydrateAuth(state) {
      if (state.userData) {
        applyDecryptedPayload(state, decryptData<AuthPayload>(state.userData));
      } else {
        applyDecryptedPayload(state, null);
      }
      state.hydrated = true;
      state.error = null;
    },

    /**
     * Encrypt the full login / register / verify-otp response
     * and store it as the single persisted `userData` field.
     */
    setCredentials(state, action: PayloadAction<AuthPayload>) {
      const normalized = normalizeAuthPayload(action.payload);
      const encrypted = encryptData(normalized);
      if (!encrypted) {
        state.error = "Could not save session.";
        return;
      }
      state.userData = encrypted;
      applyDecryptedPayload(state, normalized);
      state.loading = false;
      state.error = null;
    },

    /**
     * Replace only the persisted `user` (and optional `provider`) from
     * profile update or GET /auth/me. Token / refreshToken stay as-is.
     */
    updateAuthUser(
      state,
      action: PayloadAction<{
        user: AuthUser & { _id?: string; name?: string };
        provider?: unknown;
      }>,
    ) {
      const current =
        (state.userData
          ? decryptData<AuthPayload>(state.userData)
          : null) ||
        (state.token && state.user
          ? {
              token: state.token,
              refreshToken: state.refreshToken || undefined,
              user: state.user,
            }
          : null);

      if (!current?.token) {
        state.error = "No active session to update.";
        return;
      }

      const nextUser = normalizeAuthUser(action.payload.user, current.user);
      const nextPayload: AuthPayload = {
        ...current,
        token: current.token,
        refreshToken: current.refreshToken,
        user: nextUser,
      };

      if (action.payload.provider !== undefined) {
        nextPayload.provider = action.payload.provider;
      }

      const encrypted = encryptData(nextPayload);
      if (!encrypted) {
        state.error = "Could not save session.";
        return;
      }

      state.userData = encrypted;
      state.user = nextUser;
      state.role = nextUser.role || state.role;
      // token + refreshToken intentionally untouched
      state.error = null;
    },

    setAuthLoading(state, action: PayloadAction<boolean>) {
      state.loading = action.payload;
    },

    setAuthError(state, action: PayloadAction<string | null>) {
      state.error = action.payload;
      state.loading = false;
    },

    clearAuthError(state) {
      state.error = null;
    },

    clearAuth(state) {
      state.userData = null;
      applyDecryptedPayload(state, null);
      state.loading = false;
      state.error = null;
    },
  },
});

export const {
  hydrateAuth,
  setCredentials,
  updateAuthUser,
  setAuthLoading,
  setAuthError,
  clearAuthError,
  clearAuth,
} = authSlice.actions;

export const logout = clearAuth;

export const selectAuth = (state: { auth: AuthState }) => state.auth;
export const selectIsAuthenticated = (state: { auth: AuthState }) =>
  state.auth.isAuthenticated || Boolean(state.auth.token);
export const selectAuthUser = (state: { auth: AuthState }) => state.auth.user;
export const selectAuthToken = (state: { auth: AuthState }) => state.auth.token;
export const selectAuthLoading = (state: { auth: AuthState }) =>
  state.auth.loading;
export const selectAuthError = (state: { auth: AuthState }) => state.auth.error;
export const selectEncryptedUserData = (state: { auth: AuthState }) =>
  state.auth.userData;

export default authSlice.reducer;
