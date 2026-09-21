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
import portfolioReducer from "./portfolioSlice";
import locationReducer from "./locationSlice";
import publicFixedServicesReducer from "./publicFixedServicesSlice";
import publicProfessionalsReducer from "./publicProfessionalsSlice";
import contactUsReducer from "./contactUsSlice";
import ordersReducer from "./ordersSlice";
import providerOrdersReducer from "./providerOrdersSlice";
import customersReducer from "./customersSlice";
import estimatesReducer from "./estimatesSlice";
import customerQuotesReducer from "./customerQuotesSlice";
import teamReducer from "./teamSlice";
import contractorsReducer from "./contractorsSlice";
import vendorsReducer from "./vendorsSlice";
import remindersReducer from "./remindersSlice";
import tasksReducer from "./tasksSlice";
import jobsReducer from "./jobsSlice";
import invoicesReducer from "./invoicesSlice";
import requestsReducer from "./requestsSlice";
import {
  contractorNotesModule,
  customerNotesModule,
  employeeNotesModule,
  estimateNotesModule,
  invoiceNotesModule,
  jobNotesModule,
  requestNotesModule,
  vendorNotesModule,
} from "./notes/modules";

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
  portfolio: portfolioReducer,
  location: locationReducer,
  publicFixedServices: publicFixedServicesReducer,
  publicProfessionals: publicProfessionalsReducer,
  contactUs: contactUsReducer,
  orders: ordersReducer,
  providerOrders: providerOrdersReducer,
  customers: customersReducer,
  estimates: estimatesReducer,
  customerQuotes: customerQuotesReducer,
  team: teamReducer,
  contractors: contractorsReducer,
  vendors: vendorsReducer,
  reminders: remindersReducer,
  tasks: tasksReducer,
  jobs: jobsReducer,
  invoices: invoicesReducer,
  requests: requestsReducer,
  customerNotes: customerNotesModule.reducer,
  estimateNotes: estimateNotesModule.reducer,
  requestNotes: requestNotesModule.reducer,
  jobNotes: jobNotesModule.reducer,
  employeeNotes: employeeNotesModule.reducer,
  contractorNotes: contractorNotesModule.reducer,
  vendorNotes: vendorNotesModule.reducer,
  invoiceNotes: invoiceNotesModule.reducer,
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

function needsReducerHotReplace(state: RootState) {
  return (
    state.serviceAreas === undefined ||
    state.categories === undefined ||
    state.fixedServices === undefined ||
    state.portfolio === undefined ||
    state.location === undefined ||
    state.publicFixedServices === undefined ||
    state.publicProfessionals === undefined ||
    state.contactUs === undefined ||
    state.orders === undefined ||
    state.providerOrders === undefined ||
    state.customers === undefined ||
    state.estimates === undefined ||
    state.team === undefined ||
    state.contractors === undefined ||
    state.vendors === undefined ||
    state.reminders === undefined ||
    state.tasks === undefined ||
    state.jobs === undefined ||
    state.invoices === undefined ||
    state.requests === undefined ||
    state.customerNotes === undefined ||
    state.estimateNotes === undefined ||
    state.requestNotes === undefined ||
    state.jobNotes === undefined ||
    state.employeeNotes === undefined ||
    state.contractorNotes === undefined ||
    state.vendorNotes === undefined ||
    state.invoiceNotes === undefined
  );
}

export function getStore(): AppStore {
  if (typeof window === "undefined") {
    return makeStore();
  }
  if (!clientStore) {
    clientStore = makeStore();
    clientStore.__persistor = persistStore(clientStore);
  } else if (needsReducerHotReplace(clientStore.getState())) {
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
