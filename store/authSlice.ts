import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import {
  type AuthUser,
  getAuthToken,
  getUserDataCookie,
  removeAuthToken,
  removeUserDataCookie,
  setAuthToken,
  setUserDataCookie,
} from "@/components/api/cookieUtils";

export type AuthStatus = "idle" | "authenticated" | "failed" | string;

export type AuthState = {
  token: string | null;
  user: AuthUser | null;
  role: string | null;
  hydrated: boolean;
  status: AuthStatus;
  error: string | null;
};

const initialState: AuthState = {
  token: null,
  user: null,
  role: null,
  hydrated: false,
  status: "idle",
  error: null,
};

type CredentialsPayload = {
  token?: string;
  user?: AuthUser;
};

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    hydrateAuth(state) {
      if (typeof window === "undefined") {
        state.hydrated = true;
        return;
      }
      state.token = getAuthToken();
      state.user = getUserDataCookie();
      state.role = state.user?.role || null;
      state.hydrated = true;
    },
    setCredentials(state, action: PayloadAction<CredentialsPayload>) {
      const { token, user } = action.payload || {};
      if (token) {
        setAuthToken(token);
        state.token = token;
      }
      if (user) {
        setUserDataCookie(user);
        state.user = user;
        state.role = user.role || null;
      }
      state.error = null;
      state.status = "authenticated";
    },
    setUser(state, action: PayloadAction<AuthUser>) {
      const user = action.payload;
      setUserDataCookie(user);
      state.user = user;
      state.role = user?.role || null;
    },
    setAuthStatus(state, action: PayloadAction<AuthStatus>) {
      state.status = action.payload;
    },
    setAuthError(state, action: PayloadAction<string | null>) {
      state.error = action.payload;
      state.status = "failed";
    },
    clearAuth(state) {
      removeAuthToken();
      removeUserDataCookie();
      state.token = null;
      state.user = null;
      state.role = null;
      state.error = null;
      state.status = "idle";
    },
  },
});

export const {
  hydrateAuth,
  setCredentials,
  setUser,
  setAuthStatus,
  setAuthError,
  clearAuth,
} = authSlice.actions;

/** Alias used by the API layer for session expiry / forced sign-out. */
export const logout = clearAuth;

export const selectAuth = (state: { auth: AuthState }) => state.auth;
export const selectIsAuthenticated = (state: { auth: AuthState }) =>
  Boolean(state.auth.token);
export const selectAuthUser = (state: { auth: AuthState }) => state.auth.user;
export const selectAuthToken = (state: { auth: AuthState }) => state.auth.token;

export default authSlice.reducer;
