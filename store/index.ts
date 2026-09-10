import {
  configureStore,
  combineReducers,
  createAction,
  type Action,
  type Reducer,
} from "@reduxjs/toolkit";
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
import categoriesReducer from "./categoriesSlice";
import fixedServicesReducer from "./fixedServicesSlice";
import locationReducer from "./locationSlice";

/**
 * Redux Persist storage key: `userData`
 * Only the encrypted `auth.userData` string is saved.
 * List slices stay in-memory only (not persisted).
 */
const authPersistConfig = {
  key: "userData",
  storage,
  whitelist: ["userData"],
};

const rootReducer = combineReducers({
  auth: persistReducer(authPersistConfig, authReducer),
  serviceAreas: serviceAreasReducer,
  categories: categoriesReducer,
  fixedServices: fixedServicesReducer,
  location: locationReducer,
});

export type RootState = ReturnType<typeof rootReducer>;

/** Clears the entire Redux tree (auth, location, categories, etc.) in one action. */
export const resetStore = createAction("app/reset");

const appReducer: Reducer<RootState> = (
  state: RootState | undefined,
  action: Action,
) => {
  if (resetStore.match(action)) {
    return rootReducer(undefined, action);
  }
  return rootReducer(state, action);
};

export function makeStore() {
  return configureStore({
    reducer: appReducer,
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
    // HMR can keep an older store instance before new reducers were added.
    (clientStore.getState() as {
      serviceAreas?: unknown;
      categories?: unknown;
      fixedServices?: unknown;
      location?: unknown;
    }).serviceAreas === undefined ||
    (clientStore.getState() as { categories?: unknown }).categories === undefined ||
    (clientStore.getState() as { fixedServices?: unknown }).fixedServices === undefined ||
    (clientStore.getState() as { location?: unknown }).location === undefined
  ) {
    clientStore.replaceReducer(appReducer);
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
