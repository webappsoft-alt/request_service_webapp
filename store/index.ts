import { configureStore } from "@reduxjs/toolkit";
import { decryptData, encryptData } from "@/components/api/encrypted";
import type { AuthUser } from "@/components/api/cookieUtils";
import authReducer, { type AuthState } from "./authSlice";

const SECURE_STORE_KEY = "rs-redux-auth";

type PersistedAuth = {
  token?: string | null;
  user?: AuthUser | null;
  role?: string | null;
};

type RootStateShape = {
  auth: AuthState;
};

function loadPersistedState(): { auth: AuthState } | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const raw = window.localStorage.getItem(SECURE_STORE_KEY);
    if (!raw) return undefined;
    const parsed = decryptData<PersistedAuth>(raw);
    if (!parsed || typeof parsed !== "object") return undefined;
    return {
      auth: {
        token: parsed.token ?? null,
        user: parsed.user ?? null,
        role: parsed.role ?? null,
        hydrated: false,
        status: parsed.token ? "authenticated" : "idle",
        error: null,
      },
    };
  } catch {
    return undefined;
  }
}

function persistAuthState(state: RootStateShape): void {
  if (typeof window === "undefined") return;
  const encrypted = encryptData({
    token: state.auth.token,
    user: state.auth.user,
    role: state.auth.role,
  });
  if (encrypted) {
    window.localStorage.setItem(SECURE_STORE_KEY, encrypted);
  } else {
    window.localStorage.removeItem(SECURE_STORE_KEY);
  }
}

export function makeStore(preloadedState?: { auth: AuthState }) {
  const store = configureStore({
    reducer: {
      auth: authReducer,
    },
    preloadedState,
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({
        serializableCheck: false,
      }),
    devTools: process.env.NODE_ENV !== "production",
  });

  if (typeof window !== "undefined") {
    let timer: ReturnType<typeof setTimeout> | null = null;
    store.subscribe(() => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => persistAuthState(store.getState()), 120);
    });
  }

  return store;
}

export type AppStore = ReturnType<typeof makeStore>;
export type RootState = ReturnType<AppStore["getState"]>;
export type AppDispatch = AppStore["dispatch"];

/** Browser singleton — avoid recreating the store across Fast Refresh. */
let clientStore: AppStore | undefined;

export function getStore(): AppStore {
  if (typeof window === "undefined") {
    return makeStore();
  }
  if (!clientStore) {
    clientStore = makeStore(loadPersistedState());
  }
  return clientStore;
}

export default getStore;
