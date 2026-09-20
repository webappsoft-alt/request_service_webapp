import {
  createAsyncThunk,
  createSlice,
  type PayloadAction,
} from "@reduxjs/toolkit";
import { extractErrorMessage } from "@/components/api/extractErrorMessage";
import {
  createJob,
  createTask,
  deleteJob,
  deleteReminder,
  deleteTask,
  getCustomerDetail,
  queryCustomerTimeline,
  queryCustomers,
  queryEstimates,
  queryInvoices,
  queryJobs,
  queryReminders,
  querySchedule,
  queryTasks,
  updateCustomer,
  updateJob,
  updateJobStatus,
  updateReminderStatus,
  updateTask,
  updateTaskStatus,
} from "@/lib/api/crm-client";
import type {
  CustomerDetailPayload,
  CustomerDossier,
  CustomerTimelineEvent,
  PortalCustomerCrm,
  PortalReminder,
  PortalTask,
} from "@/lib/data/crm-people";
import type { PortalCalendarEvent, PortalEmployee } from "@/lib/data/portal";
import type { Estimate, Invoice, Job } from "@/lib/types";

type PaginationMeta = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

type TabListState<T> = {
  customerId: string;
  filterKey: string;
  items: T[];
  /** True after a successful GET for this customerId + filterKey (including empty lists). */
  loaded: boolean;
  loading: boolean;
  error: string | null;
  page: number;
  total: number;
  totalPages: number;
};

function emptyTabList<T>(): TabListState<T> {
  return {
    customerId: "",
    filterKey: "",
    items: [],
    loaded: false,
    loading: false,
    error: null,
    page: 1,
    total: 0,
    totalPages: 1,
  };
}

type CustomersState = {
  items: PortalCustomerCrm[];
  pagesCache: Record<string, PortalCustomerCrm[]>;
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  search: string;
  /** Active A–Z letter (`""` = All). Sent as the API `search` param when set. */
  letter: string;
  loading: boolean;
  error: string | null;
  detail: PortalCustomerCrm | null;
  dossier: CustomerDossier | null;
  detailLoading: boolean;
  detailError: string | null;
  estimates: TabListState<Estimate>;
  jobs: TabListState<Job>;
  schedule: TabListState<PortalCalendarEvent>;
  invoices: TabListState<Invoice>;
  tasks: TabListState<PortalTask>;
  reminders: TabListState<PortalReminder>;
  timeline: TabListState<CustomerTimelineEvent>;
};

const DEFAULT_LIMIT = 10;
const DETAIL_TAB_LIMIT = 10;
const TIMELINE_LIMIT = 10;

const EMPTY_DOSSIER: CustomerDossier = {
  balanceDue: 0,
  totalInvoiced: 0,
  totalPaid: 0,
  estimatesCount: 0,
  jobsCount: 0,
  invoicesCount: 0,
  activeJobs: [],
  recentEstimates: [],
  recentJobs: [],
  recentInvoices: [],
};

const initialState: CustomersState = {
  items: [],
  pagesCache: {},
  page: 1,
  limit: DEFAULT_LIMIT,
  total: 0,
  totalPages: 1,
  search: "",
  letter: "",
  loading: false,
  error: null,
  detail: null,
  dossier: null,
  detailLoading: false,
  detailError: null,
  estimates: emptyTabList(),
  jobs: emptyTabList(),
  schedule: emptyTabList(),
  invoices: emptyTabList(),
  tasks: emptyTabList(),
  reminders: emptyTabList(),
  timeline: emptyTabList(),
};

export function customersPageCacheKey(
  search: string,
  letter: string,
  page: number,
  limit: number,
) {
  return `${letter.trim()}|${search.trim()}|${page}|${limit}`;
}

/** Letter filter takes priority; otherwise free-text search. */
export function customersApiSearch(search: string, letter: string) {
  const activeLetter = letter.trim();
  if (activeLetter) return activeLetter;
  return search.trim();
}

export type FetchCustomersArg = {
  page?: number;
  limit?: number;
  search?: string;
  letter?: string;
  /** Bypass pagesCache and always hit the API. */
  force?: boolean;
};

type CustomerTabArg = {
  customerId: string;
  status?: string;
  /** Soft-archive filter — independent of lifecycle `status`. */
  isArchived?: boolean;
  search?: string;
  page?: number;
  limit?: number;
  force?: boolean;
  type?: string;
};

function tabCacheKey(arg: {
  status?: string;
  isArchived?: boolean;
  search?: string;
  page?: number;
  type?: string;
}) {
  const base = `${arg.status?.trim() || ""}|${arg.search?.trim() || ""}|${arg.type?.trim() || ""}|${arg.page ?? 1}`;
  if (arg.isArchived === true) return `archived|${base}`;
  if (arg.isArchived === false) return `active|${base}`;
  return base;
}


export function customerTabFilterKey(arg: {
  status?: string;
  isArchived?: boolean;
  search?: string;
  page?: number;
  type?: string;
}) {
  return tabCacheKey(arg);
}

export function selectCustomerTabShowLoader<T>(
  tab: TabListState<T> | null | undefined,
  customerId: string,
  filterKey = "|||1",
) {
  if (!customerId) return false;
  if (!tab) return true;
  const sameView = tab.customerId === customerId && tab.filterKey === filterKey;
  // Different customer/filter (or unbound) → show loader until this view binds.
  if (!sameView) return true;
  // Notes pattern: spinner only when empty + loading. If rows exist, keep them
  // visible while the GET refreshes in the background.
  return Boolean(tab.loading && tab.items.length === 0);
}

/** Prefer Redux tab rows whenever they belong to this customer (including empty loaded lists). */
export function selectCustomerTabRows<T>(
  tab: TabListState<T> | null | undefined,
  customerId: string,
  filterKey = "|||1",
  fallback: T[] = [],
): T[] {
  if (!tab || tab.customerId !== customerId) return fallback;
  if (tab.loaded && tab.filterKey === filterKey) return tab.items;
  if (tab.loading || tab.items.length > 0) return tab.items;
  return fallback;
}

export const fetchCustomers = createAsyncThunk<
  {
    items: PortalCustomerCrm[];
    pagination: PaginationMeta;
    search: string;
    letter: string;
  },
  FetchCustomersArg | void,
  { state: { customers: CustomersState }; rejectValue: string }
>(
  "customers/fetchList",
  async (params, { getState, rejectWithValue }) => {
    const state = getState().customers;
    const page = params?.page ?? state.page;
    const limit = params?.limit ?? state.limit;
    const search = params?.search ?? state.search;
    const letter = params?.letter ?? state.letter;
    const apiSearch = customersApiSearch(search, letter);

    try {
      const result = await queryCustomers({
        page,
        limit,
        search: apiSearch || undefined,
        silent: true,
        force: true,
      });
      return {
        items: result.items,
        pagination: {
          page: result.page,
          limit: result.limit,
          total: result.total,
          totalPages: result.totalPages,
        },
        search,
        letter,
      };
    } catch (error) {
      return rejectWithValue(extractErrorMessage(error));
    }
  },
  {
    condition: (params, { getState }) => {
      if (params?.force) return true;
      const state = getState().customers;
      if (!state) return true;
      const page = params?.page ?? state.page;
      const limit = params?.limit ?? state.limit;
      const search = params?.search ?? state.search;
      const letter = params?.letter ?? state.letter;
      const key = customersPageCacheKey(search, letter, page, limit);
      if (key in state.pagesCache) return false;
      return true;
    },
  },
);

/** GET /api/provider/customers/:id */
export const fetchCustomerDetail = createAsyncThunk<
  CustomerDetailPayload,
  string,
  { rejectValue: string }
>("customers/fetchDetail", async (id, { rejectWithValue }) => {
  try {
    const detail = await getCustomerDetail(id);
    if (!detail) return rejectWithValue("Customer not found.");
    return detail;
  } catch (error) {
    return rejectWithValue(extractErrorMessage(error));
  }
});

export const updateCustomerDetail = createAsyncThunk<
  CustomerDetailPayload,
  { id: string; patch: Partial<PortalCustomerCrm> | PortalCustomerCrm },
  { rejectValue: string }
>("customers/updateDetail", async ({ id, patch }, { rejectWithValue }) => {
  try {
    await updateCustomer(id, patch);
    const detail = await getCustomerDetail(id);
    if (!detail) return rejectWithValue("Customer was updated but could not be read.");
    return detail;
  } catch (error) {
    return rejectWithValue(extractErrorMessage(error));
  }
});

export const fetchCustomerEstimates = createAsyncThunk<
  { customerId: string; filterKey: string; items: Estimate[]; page: number; total: number; totalPages: number },
  CustomerTabArg,
  { state: { customers: CustomersState }; rejectValue: string }
>(
  "customers/fetchEstimates",
  async (arg, { rejectWithValue }) => {
    try {
      const page = arg.page ?? 1;
      const result = await queryEstimates({
        customerId: arg.customerId,
        // Never send UI "archived" as status — use isArchived instead.
        status: arg.status || undefined,
        isArchived: arg.isArchived === true,
        search: arg.search || undefined,
        page,
        limit: arg.limit ?? DETAIL_TAB_LIMIT,
        force: true,
        silent: true,
      });
      return {
        customerId: arg.customerId,
        filterKey: tabCacheKey(arg),
        items: result.items,
        page: result.page,
        total: result.total,
        totalPages: result.totalPages,
      };
    } catch (error) {
      return rejectWithValue(extractErrorMessage(error));
    }
  },
);

export const fetchCustomerJobs = createAsyncThunk<
  { customerId: string; filterKey: string; items: Job[]; page: number; total: number; totalPages: number },
  CustomerTabArg,
  { state: { customers: CustomersState }; rejectValue: string }
>(
  "customers/fetchJobs",
  async (arg, { rejectWithValue }) => {
    try {
      const result = await queryJobs({
        customerId: arg.customerId,
        status: arg.status || undefined,
        isArchived: arg.isArchived === true,
        search: arg.search || undefined,
        page: arg.page ?? 1,
        limit: arg.limit ?? DETAIL_TAB_LIMIT,
        force: true,
        silent: true,
      });
      return {
        customerId: arg.customerId,
        filterKey: tabCacheKey(arg),
        items: result.items,
        page: result.page,
        total: result.total,
        totalPages: result.totalPages,
      };
    } catch (error) {
      return rejectWithValue(extractErrorMessage(error));
    }
  },
);

export const fetchCustomerSchedule = createAsyncThunk<
  { customerId: string; filterKey: string; items: PortalCalendarEvent[] },
  CustomerTabArg,
  { state: { customers: CustomersState }; rejectValue: string }
>(
  "customers/fetchSchedule",
  async (arg, { rejectWithValue }) => {
    try {
      const items = await querySchedule({
        customerId: arg.customerId,
        force: true,
        silent: true,
      });
      return {
        customerId: arg.customerId,
        filterKey: tabCacheKey(arg),
        items,
      };
    } catch (error) {
      return rejectWithValue(extractErrorMessage(error));
    }
  },
);

export const fetchCustomerInvoices = createAsyncThunk<
  { customerId: string; filterKey: string; items: Invoice[]; page: number; total: number; totalPages: number },
  CustomerTabArg,
  { state: { customers: CustomersState }; rejectValue: string }
>(
  "customers/fetchInvoices",
  async (arg, { rejectWithValue }) => {
    try {
      const result = await queryInvoices({
        customerId: arg.customerId,
        status: arg.status || undefined,
        search: arg.search || undefined,
        page: arg.page ?? 1,
        limit: arg.limit ?? DETAIL_TAB_LIMIT,
        force: true,
        silent: true,
      });
      return {
        customerId: arg.customerId,
        filterKey: tabCacheKey(arg),
        items: result.items,
        page: result.page,
        total: result.total,
        totalPages: result.totalPages,
      };
    } catch (error) {
      return rejectWithValue(extractErrorMessage(error));
    }
  },
);

export const fetchCustomerTasks = createAsyncThunk<
  { customerId: string; filterKey: string; items: PortalTask[]; page: number; total: number; totalPages: number },
  CustomerTabArg,
  { state: { customers: CustomersState }; rejectValue: string }
>(
  "customers/fetchTasks",
  async (arg, { rejectWithValue }) => {
    try {
      const result = await queryTasks({
        customerId: arg.customerId,
        status: arg.status || undefined,
        page: arg.page ?? 1,
        limit: arg.limit ?? DETAIL_TAB_LIMIT,
        force: true,
        silent: true,
      });
      return {
        customerId: arg.customerId,
        filterKey: tabCacheKey(arg),
        items: result.items,
        page: result.page,
        total: result.total,
        totalPages: result.totalPages,
      };
    } catch (error) {
      return rejectWithValue(extractErrorMessage(error));
    }
  },
);

export const fetchCustomerReminders = createAsyncThunk<
  { customerId: string; filterKey: string; items: PortalReminder[]; page: number; total: number; totalPages: number },
  CustomerTabArg,
  { state: { customers: CustomersState }; rejectValue: string }
>(
  "customers/fetchReminders",
  async (arg, { rejectWithValue }) => {
    try {
      const result = await queryReminders({
        customerId: arg.customerId,
        status: arg.status || undefined,
        page: arg.page ?? 1,
        limit: arg.limit ?? DETAIL_TAB_LIMIT,
        force: true,
        silent: true,
      });
      return {
        customerId: arg.customerId,
        filterKey: tabCacheKey(arg),
        items: result.items,
        page: result.page,
        total: result.total,
        totalPages: result.totalPages,
      };
    } catch (error) {
      return rejectWithValue(extractErrorMessage(error));
    }
  },
);

export const fetchCustomerTimeline = createAsyncThunk<
  { customerId: string; filterKey: string; items: CustomerTimelineEvent[]; page: number; total: number; totalPages: number },
  CustomerTabArg,
  { state: { customers: CustomersState }; rejectValue: string }
>(
  "customers/fetchTimeline",
  async (arg, { rejectWithValue }) => {
    try {
      const result = await queryCustomerTimeline(arg.customerId, {
        page: arg.page ?? 1,
        limit: arg.limit ?? TIMELINE_LIMIT,
        type: arg.type,
        force: true,
        silent: true,
      });
      return {
        customerId: arg.customerId,
        filterKey: tabCacheKey(arg),
        items: result.items,
        page: result.page,
        total: result.total,
        totalPages: result.totalPages,
      };
    } catch (error) {
      return rejectWithValue(extractErrorMessage(error));
    }
  },
);

export const patchCustomerTaskStatus = createAsyncThunk<
  PortalTask,
  { id: string; status: PortalTask["status"]; customerId: string },
  { rejectValue: string }
>("customers/patchTaskStatus", async ({ id, status }, { rejectWithValue }) => {
  try {
    const updated = await updateTaskStatus(id, status);
    if (!updated) return rejectWithValue("Task status was updated but could not be read.");
    return updated;
  } catch (error) {
    return rejectWithValue(extractErrorMessage(error));
  }
});

export const patchCustomerReminderStatus = createAsyncThunk<
  PortalReminder,
  { id: string; status: PortalReminder["status"]; customerId: string },
  { rejectValue: string }
>("customers/patchReminderStatus", async ({ id, status }, { rejectWithValue }) => {
  try {
    const updated = await updateReminderStatus(id, status);
    if (!updated) return rejectWithValue("Reminder status was updated but could not be read.");
    return updated;
  } catch (error) {
    return rejectWithValue(extractErrorMessage(error));
  }
});

/** POST /api/provider/jobs — MD Create Job (customerId required). */
export const createCustomerJob = createAsyncThunk<
  Job,
  { job: Job; employees: PortalEmployee[] },
  { rejectValue: string }
>("customers/createJob", async ({ job, employees }, { rejectWithValue }) => {
  try {
    const created = await createJob(job, employees);
    if (!created) return rejectWithValue("Job was created but could not be read.");
    return created;
  } catch (error) {
    return rejectWithValue(extractErrorMessage(error));
  }
});

export const updateCustomerJob = createAsyncThunk<
  Job,
  { id: string; job: Job; employees: PortalEmployee[]; customerId: string },
  { rejectValue: string }
>("customers/updateJob", async ({ id, job, employees }, { rejectWithValue }) => {
  try {
    const updated = await updateJob(id, job, employees);
    if (!updated) return rejectWithValue("Job was updated but could not be read.");
    return updated;
  } catch (error) {
    return rejectWithValue(extractErrorMessage(error));
  }
});

export const patchCustomerJobStatus = createAsyncThunk<
  Job,
  { id: string; status: Job["status"]; notes?: string; customerId: string },
  { rejectValue: string }
>("customers/patchJobStatus", async ({ id, status, notes }, { rejectWithValue }) => {
  try {
    const updated = await updateJobStatus(id, status, notes || "");
    if (!updated) return rejectWithValue("Job status was updated but could not be read.");
    return updated;
  } catch (error) {
    return rejectWithValue(extractErrorMessage(error));
  }
});

export const deleteCustomerJob = createAsyncThunk<
  { id: string; customerId: string },
  { id: string; customerId: string },
  { rejectValue: string }
>("customers/deleteJob", async ({ id, customerId }, { rejectWithValue }) => {
  try {
    await deleteJob(id);
    return { id, customerId };
  } catch (error) {
    return rejectWithValue(extractErrorMessage(error));
  }
});

/** POST /api/provider/tasks — MD Create Task Action (customerId required). */
export const createCustomerTask = createAsyncThunk<
  PortalTask,
  PortalTask,
  { rejectValue: string }
>("customers/createTask", async (task, { rejectWithValue }) => {
  try {
    const created = await createTask(task);
    if (!created) return rejectWithValue("Task was created but could not be read.");
    return created;
  } catch (error) {
    return rejectWithValue(extractErrorMessage(error));
  }
});

export const updateCustomerTask = createAsyncThunk<
  PortalTask,
  { id: string; task: PortalTask; customerId: string },
  { rejectValue: string }
>("customers/updateTask", async ({ id, task }, { rejectWithValue }) => {
  try {
    const updated = await updateTask(id, task);
    if (!updated) return rejectWithValue("Task was updated but could not be read.");
    return updated;
  } catch (error) {
    return rejectWithValue(extractErrorMessage(error));
  }
});

export const deleteCustomerTask = createAsyncThunk<
  { id: string; customerId: string },
  { id: string; customerId: string },
  { rejectValue: string }
>("customers/deleteTask", async ({ id, customerId }, { rejectWithValue }) => {
  try {
    await deleteTask(id);
    return { id, customerId };
  } catch (error) {
    return rejectWithValue(extractErrorMessage(error));
  }
});

export const deleteCustomerReminder = createAsyncThunk<
  { id: string; customerId: string },
  { id: string; customerId: string },
  { rejectValue: string }
>("customers/deleteReminder", async ({ id, customerId }, { rejectWithValue }) => {
  try {
    await deleteReminder(id);
    return { id, customerId };
  } catch (error) {
    return rejectWithValue(extractErrorMessage(error));
  }
});

function applyDetail(state: CustomersState, payload: CustomerDetailPayload) {
  const cached =
    state.items.find((item) => item.id === payload.customer.id) ??
    (state.detail?.id === payload.customer.id ? state.detail : null);
  const customer: PortalCustomerCrm = cached
    ? { ...cached, ...payload.customer, amountOwing: payload.dossier.balanceDue || payload.customer.amountOwing }
    : { ...payload.customer, amountOwing: payload.dossier.balanceDue || payload.customer.amountOwing };
  state.detail = customer;
  state.dossier = payload.dossier;
  state.detailLoading = false;
  state.detailError = null;
  state.items = state.items.map((item) => (item.id === customer.id ? { ...item, ...customer } : item));
}

function setTabPending<T>(tab: TabListState<T>, customerId: string, filterKey: string) {
  const sameView = tab.customerId === customerId && tab.filterKey === filterKey;
  if (!sameView) {
    tab.items = [];
    tab.loaded = false;
  }
  // Notes pattern: only flip loading when there is nothing to show yet.
  if (tab.items.length === 0) {
    tab.loading = true;
  }
  tab.error = null;
  tab.customerId = customerId;
  tab.filterKey = filterKey;
}

function setTabFulfilled<T>(
  tab: TabListState<T>,
  payload: {
    customerId: string;
    filterKey: string;
    items: T[];
    page?: number;
    total?: number;
    totalPages?: number;
  },
) {
  tab.loading = false;
  tab.loaded = true;
  tab.error = null;
  tab.customerId = payload.customerId;
  tab.filterKey = payload.filterKey;
  tab.items = payload.items;
  tab.page = payload.page ?? 1;
  tab.total = payload.total ?? payload.items.length;
  tab.totalPages = payload.totalPages ?? 1;
}

function setTabRejected<T>(tab: TabListState<T>, message: string) {
  // Notes pattern: keep existing rows / loaded flag so cancel/network blips
  // don't wipe the UI or force a false "no data" empty state.
  tab.loading = false;
  tab.error = message;
}

function upsertTabItem<T extends { id: string }>(tab: TabListState<T>, item: T, customerId: string) {
  // Only patch an already-fetched tab for this customer. Otherwise the next
  // tab open should GET the full list (which will include this create).
  if (!tab.loaded || tab.customerId !== customerId) return;
  const index = tab.items.findIndex((row) => row.id === item.id);
  if (index >= 0) {
    tab.items[index] = item;
  } else {
    tab.items = [item, ...tab.items];
    tab.total = (tab.total || 0) + 1;
  }
  tab.loading = false;
  tab.error = null;
}

function removeTabItem<T extends { id: string }>(tab: TabListState<T>, id: string) {
  const next = tab.items.filter((row) => row.id !== id);
  if (next.length === tab.items.length) return;
  tab.items = next;
  tab.total = Math.max(0, (tab.total || 0) - 1);
}

const customersSlice = createSlice({
  name: "customers",
  initialState,
  reducers: {
    setCustomersSearch(state, action: PayloadAction<string>) {
      state.search = action.payload;
      state.letter = "";
      state.page = 1;
      state.pagesCache = {};
    },
    setCustomersLetter(state, action: PayloadAction<string>) {
      state.letter = action.payload;
      state.search = "";
      state.page = 1;
      state.pagesCache = {};
    },
    setCustomersPage(state, action: PayloadAction<number>) {
      state.page = Math.max(1, action.payload);
      const key = customersPageCacheKey(
        state.search,
        state.letter,
        state.page,
        state.limit,
      );
      if (key in state.pagesCache) {
        state.items = state.pagesCache[key];
      }
    },
    /** After create / edit / delete — drop cache so the next fetch hits the API. */
    invalidateCustomersCache(state) {
      state.pagesCache = {};
    },
    clearCustomersError(state) {
      state.error = null;
    },
    clearCustomerDetail(state) {
      state.detail = null;
      state.dossier = null;
      state.detailError = null;
      state.detailLoading = false;
      state.estimates = emptyTabList();
      state.jobs = emptyTabList();
      state.schedule = emptyTabList();
      state.invoices = emptyTabList();
      state.tasks = emptyTabList();
      state.reminders = emptyTabList();
      state.timeline = emptyTabList();
    },
    invalidateCustomerDetailTabs(state) {
      state.estimates = emptyTabList();
      state.jobs = emptyTabList();
      state.schedule = emptyTabList();
      state.invoices = emptyTabList();
      state.tasks = emptyTabList();
      state.reminders = emptyTabList();
      state.timeline = emptyTabList();
    },
    upsertCustomerEstimate(state, action: PayloadAction<{ customerId: string; item: Estimate }>) {
      upsertTabItem(state.estimates, action.payload.item, action.payload.customerId);
      state.timeline = emptyTabList();
    },
    upsertCustomerJob(state, action: PayloadAction<{ customerId: string; item: Job }>) {
      upsertTabItem(state.jobs, action.payload.item, action.payload.customerId);
      state.timeline = emptyTabList();
    },
    upsertCustomerInvoice(state, action: PayloadAction<{ customerId: string; item: Invoice }>) {
      upsertTabItem(state.invoices, action.payload.item, action.payload.customerId);
      state.timeline = emptyTabList();
    },
    upsertCustomerTask(state, action: PayloadAction<{ customerId: string; item: PortalTask }>) {
      upsertTabItem(state.tasks, action.payload.item, action.payload.customerId);
      state.timeline = emptyTabList();
    },
    upsertCustomerReminder(
      state,
      action: PayloadAction<{ customerId: string; item: PortalReminder }>,
    ) {
      upsertTabItem(state.reminders, action.payload.item, action.payload.customerId);
      state.timeline = emptyTabList();
    },
    removeCustomerEstimate(state, action: PayloadAction<string>) {
      removeTabItem(state.estimates, action.payload);
    },
    removeCustomerJobLocal(state, action: PayloadAction<string>) {
      removeTabItem(state.jobs, action.payload);
    },
    removeCustomerTaskLocal(state, action: PayloadAction<string>) {
      removeTabItem(state.tasks, action.payload);
    },
    removeCustomerReminderLocal(state, action: PayloadAction<string>) {
      removeTabItem(state.reminders, action.payload);
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchCustomers.pending, (state) => {
        if (state.items.length === 0) state.loading = true;
        state.error = null;
      })
      .addCase(fetchCustomers.fulfilled, (state, action) => {
        state.loading = false;
        state.items = action.payload.items;
        state.page = action.payload.pagination.page;
        state.limit = DEFAULT_LIMIT;
        state.total = action.payload.pagination.total;
        state.totalPages = Math.max(1, action.payload.pagination.totalPages);
        state.search = action.payload.search;
        state.letter = action.payload.letter;
        const key = customersPageCacheKey(
          state.search,
          state.letter,
          state.page,
          state.limit,
        );
        state.pagesCache[key] = action.payload.items;
      })
      .addCase(fetchCustomers.rejected, (state, action) => {
        state.loading = false;
        state.error =
          action.payload ||
          action.error.message ||
          "Failed to load customers.";
      })
      .addCase(fetchCustomerDetail.pending, (state) => {
        state.detailLoading = true;
        state.detailError = null;
      })
      .addCase(fetchCustomerDetail.fulfilled, (state, action) => {
        applyDetail(state, action.payload);
      })
      .addCase(fetchCustomerDetail.rejected, (state, action) => {
        state.detailLoading = false;
        state.detailError = action.payload || "Failed to load customer.";
      })
      .addCase(updateCustomerDetail.fulfilled, (state, action) => {
        applyDetail(state, action.payload);
        state.pagesCache = {};
      })
      .addCase(fetchCustomerEstimates.pending, (state, action) => {
        setTabPending(state.estimates, action.meta.arg.customerId, tabCacheKey(action.meta.arg));
      })
      .addCase(fetchCustomerEstimates.fulfilled, (state, action) => {
        setTabFulfilled(state.estimates, action.payload);
      })
      .addCase(fetchCustomerEstimates.rejected, (state, action) => {
        setTabRejected(state.estimates, action.payload || "Failed to load estimates.");
      })
      .addCase(fetchCustomerJobs.pending, (state, action) => {
        setTabPending(state.jobs, action.meta.arg.customerId, tabCacheKey(action.meta.arg));
      })
      .addCase(fetchCustomerJobs.fulfilled, (state, action) => {
        setTabFulfilled(state.jobs, action.payload);
      })
      .addCase(fetchCustomerJobs.rejected, (state, action) => {
        setTabRejected(state.jobs, action.payload || "Failed to load jobs.");
      })
      .addCase(fetchCustomerSchedule.pending, (state, action) => {
        setTabPending(state.schedule, action.meta.arg.customerId, tabCacheKey(action.meta.arg));
      })
      .addCase(fetchCustomerSchedule.fulfilled, (state, action) => {
        setTabFulfilled(state.schedule, action.payload);
      })
      .addCase(fetchCustomerSchedule.rejected, (state, action) => {
        setTabRejected(state.schedule, action.payload || "Failed to load schedules.");
      })
      .addCase(fetchCustomerInvoices.pending, (state, action) => {
        setTabPending(state.invoices, action.meta.arg.customerId, tabCacheKey(action.meta.arg));
      })
      .addCase(fetchCustomerInvoices.fulfilled, (state, action) => {
        setTabFulfilled(state.invoices, action.payload);
      })
      .addCase(fetchCustomerInvoices.rejected, (state, action) => {
        setTabRejected(state.invoices, action.payload || "Failed to load invoices.");
      })
      .addCase(fetchCustomerTasks.pending, (state, action) => {
        setTabPending(state.tasks, action.meta.arg.customerId, tabCacheKey(action.meta.arg));
      })
      .addCase(fetchCustomerTasks.fulfilled, (state, action) => {
        setTabFulfilled(state.tasks, action.payload);
      })
      .addCase(fetchCustomerTasks.rejected, (state, action) => {
        setTabRejected(state.tasks, action.payload || "Failed to load tasks.");
      })
      .addCase(fetchCustomerReminders.pending, (state, action) => {
        setTabPending(state.reminders, action.meta.arg.customerId, tabCacheKey(action.meta.arg));
      })
      .addCase(fetchCustomerReminders.fulfilled, (state, action) => {
        setTabFulfilled(state.reminders, action.payload);
      })
      .addCase(fetchCustomerReminders.rejected, (state, action) => {
        setTabRejected(state.reminders, action.payload || "Failed to load reminders.");
      })
      .addCase(fetchCustomerTimeline.pending, (state, action) => {
        setTabPending(state.timeline, action.meta.arg.customerId, tabCacheKey(action.meta.arg));
      })
      .addCase(fetchCustomerTimeline.fulfilled, (state, action) => {
        setTabFulfilled(state.timeline, action.payload);
      })
      .addCase(fetchCustomerTimeline.rejected, (state, action) => {
        setTabRejected(state.timeline, action.payload || "Failed to load history.");
      })
      .addCase(patchCustomerTaskStatus.fulfilled, (state, action) => {
        state.tasks.items = state.tasks.items.map((item) =>
          item.id === action.payload.id ? action.payload : item,
        );
        state.timeline = emptyTabList();
      })
      .addCase(patchCustomerReminderStatus.fulfilled, (state, action) => {
        state.reminders.items = state.reminders.items.map((item) =>
          item.id === action.payload.id ? action.payload : item,
        );
        state.timeline = emptyTabList();
      })
      .addCase(createCustomerJob.fulfilled, (state, action) => {
        const customerId = action.meta.arg.job.customerId || action.payload.customerId || "";
        if (customerId) upsertTabItem(state.jobs, action.payload, customerId);
        state.timeline = emptyTabList();
        state.schedule = emptyTabList();
      })
      .addCase(updateCustomerJob.fulfilled, (state, action) => {
        upsertTabItem(state.jobs, action.payload, action.meta.arg.customerId);
        state.timeline = emptyTabList();
        state.schedule = emptyTabList();
      })
      .addCase(patchCustomerJobStatus.fulfilled, (state, action) => {
        state.jobs.items = state.jobs.items.map((item) =>
          item.id === action.payload.id ? action.payload : item,
        );
        state.timeline = emptyTabList();
        state.schedule = emptyTabList();
      })
      .addCase(createCustomerTask.fulfilled, (state, action) => {
        const customerId =
          action.meta.arg.customerId ||
          action.payload.customerId ||
          (action.payload.subjectKind === "customer" ? action.payload.subjectId : "") ||
          "";
        if (customerId) upsertTabItem(state.tasks, action.payload, customerId);
        state.timeline = emptyTabList();
      })
      .addCase(updateCustomerTask.fulfilled, (state, action) => {
        upsertTabItem(state.tasks, action.payload, action.meta.arg.customerId);
        state.timeline = emptyTabList();
      })
      .addCase(deleteCustomerJob.fulfilled, (state, action) => {
        removeTabItem(state.jobs, action.payload.id);
        state.timeline = emptyTabList();
        state.schedule = emptyTabList();
      })
      .addCase(deleteCustomerTask.fulfilled, (state, action) => {
        removeTabItem(state.tasks, action.payload.id);
        state.timeline = emptyTabList();
      })
      .addCase(deleteCustomerReminder.fulfilled, (state, action) => {
        removeTabItem(state.reminders, action.payload.id);
        state.timeline = emptyTabList();
      })
      .addMatcher(
        (action): action is PayloadAction<PortalTask> =>
          action.type === "tasks/create/fulfilled" || action.type === "tasks/update/fulfilled",
        (state, action) => {
          const customerId =
            action.payload.customerId ||
            (action.payload.subjectKind === "customer" ? action.payload.subjectId : "") ||
            "";
          if (customerId) upsertTabItem(state.tasks, action.payload, customerId);
          state.timeline = emptyTabList();
        },
      )
      .addMatcher(
        (action): action is PayloadAction<PortalTask> => action.type === "tasks/patchStatus/fulfilled",
        (state, action) => {
          const customerId =
            action.payload.customerId ||
            (action.payload.subjectKind === "customer" ? action.payload.subjectId : "") ||
            "";
          if (customerId) upsertTabItem(state.tasks, action.payload, customerId);
        },
      )
      .addMatcher(
        (action): action is PayloadAction<string> => action.type === "tasks/delete/fulfilled",
        (state, action) => {
          removeTabItem(state.tasks, action.payload);
          state.timeline = emptyTabList();
        },
      )
      .addMatcher(
        (action): action is PayloadAction<PortalReminder> =>
          action.type === "reminders/create/fulfilled" || action.type === "reminders/update/fulfilled",
        (state, action) => {
          const customerId =
            action.payload.customerId ||
            (action.payload.subjectKind === "customer" ? action.payload.subjectId : "") ||
            "";
          if (customerId) upsertTabItem(state.reminders, action.payload, customerId);
          state.timeline = emptyTabList();
        },
      )
      .addMatcher(
        (action): action is PayloadAction<PortalReminder> => action.type === "reminders/patchStatus/fulfilled",
        (state, action) => {
          const customerId =
            action.payload.customerId ||
            (action.payload.subjectKind === "customer" ? action.payload.subjectId : "") ||
            "";
          if (customerId) upsertTabItem(state.reminders, action.payload, customerId);
        },
      )
      .addMatcher(
        (action): action is PayloadAction<string> => action.type === "reminders/delete/fulfilled",
        (state, action) => {
          removeTabItem(state.reminders, action.payload);
          state.timeline = emptyTabList();
        },
      );
  },
});

export const {
  setCustomersSearch,
  setCustomersLetter,
  setCustomersPage,
  invalidateCustomersCache,
  clearCustomersError,
  clearCustomerDetail,
  invalidateCustomerDetailTabs,
  upsertCustomerEstimate,
  upsertCustomerJob,
  upsertCustomerInvoice,
  upsertCustomerTask,
  upsertCustomerReminder,
  removeCustomerEstimate,
  removeCustomerJobLocal,
  removeCustomerTaskLocal,
  removeCustomerReminderLocal,
} = customersSlice.actions;

export const selectCustomersShowLoader = (state: {
  customers?: CustomersState;
}) => {
  const slice = state.customers;
  if (!slice) return true;
  return slice.loading && slice.items.length === 0;
};

export default customersSlice.reducer;
