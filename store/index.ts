import { configureStore, combineReducers } from "@reduxjs/toolkit";
import {
  persistStore,
  persistReducer,
  FLUSH,
  REHYDRATE,
  PAUSE,
  PERSIST,
  PURGE,
  REGISTER,
} from "redux-persist";
import storage from "redux-persist/lib/storage";
import authReducer from "./authSlice";
import serviceAreasReducer from "./serviceAreasSlice";

/**
 * Redux Persist storage key: `userData`
 * Only the encrypted `auth.userData` string is saved.
 * `serviceAreas` stays in-memory only (not persisted).
 */
const authPersistConfig = {
  key: "userData",
  storage,
  whitelist: ["userData"],
};

const rootReducer = combineReducers({
  auth: persistReducer(authPersistConfig, authReducer),
  serviceAreas: serviceAreasReducer,
});

export function makeStore() {
  return configureStore({
    reducer: rootReducer,
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({
        serializableCheck: {
          ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
        },
      }),
    devTools: process.env.NODE_ENV !== "production",
  });
}

export type AppStore = ReturnType<typeof makeStore> & {
  __persistor?: ReturnType<typeof persistStore>;
};
export type RootState = ReturnType<AppStore["getState"]>;
export type AppDispatch = AppStore["dispatch"];

let clientStore: AppStore | undefined;

export function getStore(): AppStore {
  if (typeof window === "undefined") {
    return makeStore();
  }
  if (!clientStore) {
    clientStore = makeStore();
    clientStore.__persistor = persistStore(clientStore);
  } else if (
    // HMR can keep an older store instance before `serviceAreas` was added.
    (clientStore.getState() as { serviceAreas?: unknown }).serviceAreas ===
      undefined
  ) {
    clientStore.replaceReducer(rootReducer);
  }
  return clientStore;
}

export function getPersistor() {
  const store = getStore();
  if (!store.__persistor) {
    store.__persistor = persistStore(store);
  }
  return store.__persistor;
}

export default getStore;
