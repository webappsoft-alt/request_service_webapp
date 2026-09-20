import {
  createAsyncThunk,
  createSlice,
  type PayloadAction,
} from "@reduxjs/toolkit";
import { extractErrorMessage } from "@/components/api/extractErrorMessage";
import {
  createContractor,
  deleteContractor,
  addContractorAttachment,
  deleteContractorAttachment,
  deleteReminder,
  deleteTask,
  getContractor,
  queryContractors,
  queryEstimates,
  queryJobs,
  queryReminders,
  querySchedule,
  queryTasks,
  updateContractor,
  updateReminderStatus,
  updateTaskStatus,
} from "@/lib/api/crm-client";
import type { PortalContractor, PortalReminder, PortalTask } from "@/lib/data/crm-people";
import type { PortalCalendarEvent } from "@/lib/data/portal";
import type { Estimate, Job } from "@/lib/types";

/** List page size for GET /provider/contractors */
export const CONTRACTORS_DEFAULT_LIMIT = 10;
const DETAIL_TAB_LIMIT = 10;

type TabListState<T> = {
  contractorId: string;
  filterKey: string;
  items: T[];
  /** True after a successful GET for this contractorId + filterKey (including empty lists). */
  loaded: boolean;
  loading: boolean;
  error: string | null;
  page: number;
  total: number;
  totalPages: number;
};

function emptyTabList<T>(): TabListState<T> {
  return {
    contractorId: "",
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

type ContractorsState = {
  items: PortalContractor[];
  pagesCache: Record<string, PortalContractor[]>;
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  search: string;
  status: string;
  loading: boolean;
  mutating: boolean;
  error: string | null;
  detail: PortalContractor | null;
  detailLoading: boolean;
  detailError: string | null;
  jobs: TabListState<Job>;
  estimates: TabListState<Estimate>;
  schedule: TabListState<PortalCalendarEvent>;
  tasks: TabListState<PortalTask>;
  reminders: TabListState<PortalReminder>;
};

const initialState: ContractorsState = {
  items: [],
  pagesCache: {},
  page: 1,
  limit: CONTRACTORS_DEFAULT_LIMIT,
  total: 0,
  totalPages: 1,
  search: "",
  status: "",
  loading: false,
  mutating: false,
  error: null,
  detail: null,
  detailLoading: false,
  detailError: null,
  jobs: emptyTabList(),
  estimates: emptyTabList(),
  schedule: emptyTabList(),
  tasks: emptyTabList(),
  reminders: emptyTabList(),
};

function cacheKey(search: string, status: string, page: number, limit: number) {
  return `${status}|${search.trim()}|${page}|${limit}`;
}

function tabCacheKey(arg: { status?: string; search?: string; page?: number; kind?: string }) {
  return `${arg.status?.trim() || ""}|${arg.search?.trim() || ""}|${arg.kind?.trim() || ""}|${arg.page ?? 1}`;
}

export function contractorsTabFilterKey(arg: {
  status?: string;
  search?: string;
  page?: number;
  kind?: string;
}) {
  return tabCacheKey(arg);
}

export function selectContractorsTabShowLoader<T>(
  tab: TabListState<T> | null | undefined,
  contractorId: string,
  filterKey = "|||1",
) {
  if (!contractorId) return false;
  if (!tab) return true;
  const sameView = tab.contractorId === contractorId && tab.filterKey === filterKey;
  if (!sameView) return true;
  // Cached tab (including empty lists): keep UI visible while GET refreshes.
  return Boolean(tab.loading && !tab.loaded);
}

/** Prefer Redux tab rows whenever they belong to this contractor (including empty loaded lists). */
export function selectContractorsTabRows<T>(
  tab: TabListState<T> | null | undefined,
  contractorId: string,
  filterKey = "|||1",
  fallback: T[] = [],
): T[] {
  if (!tab || tab.contractorId !== contractorId) return fallback;
  if (tab.loaded && tab.filterKey === filterKey) return tab.items;
  if (tab.loading || tab.items.length > 0) return tab.items;
  return fallback;
}

function setTabPending<T>(tab: TabListState<T>, contractorId: string, filterKey: string) {
  const sameView = tab.contractorId === contractorId && tab.filterKey === filterKey;
  if (!sameView) {
    tab.items = [];
    tab.loaded = false;
  }
  if (!tab.loaded) {
    tab.loading = true;
  }
  tab.error = null;
  tab.contractorId = contractorId;
  tab.filterKey = filterKey;
}

function setTabFulfilled<T>(
  tab: TabListState<T>,
  payload: {
    contractorId: string;
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
  tab.contractorId = payload.contractorId;
  tab.filterKey = payload.filterKey;
  tab.items = payload.items;
  tab.page = payload.page ?? 1;
  tab.total = payload.total ?? payload.items.length;
  tab.totalPages = payload.totalPages ?? 1;
}

function setTabRejected<T>(tab: TabListState<T>, message: string) {
  tab.loading = false;
  tab.error = message;
}

function upsertTabItem<T extends { id: string }>(
  tab: TabListState<T>,
  item: T,
  contractorId: string,
) {
  if (!tab.loaded || tab.contractorId !== contractorId) return;
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

type ContractorTabArg = {
  contractorId: string;
  status?: string;
  search?: string;
  page?: number;
  limit?: number;
  force?: boolean;
  kind?: string;
};

function applyDetail(state: ContractorsState, contractor: PortalContractor) {
  const cached =
    state.items.find((item) => item.id === contractor.id) ??
    (state.detail?.id === contractor.id ? state.detail : null);
  const merged: PortalContractor = cached
    ? {
        ...cached,
        ...contractor,
        overtimeRate: contractor.overtimeRate ?? cached.overtimeRate,
        travelRate: contractor.travelRate ?? cached.travelRate,
        workingHours: contractor.workingHours ?? cached.workingHours,
        attachments:
          contractor.attachments !== undefined ? contractor.attachments : cached.attachments,
      }
    : contractor;
  state.detail = merged;
  state.detailLoading = false;
  state.detailError = null;
  state.items = state.items.map((item) =>
    item.id === merged.id ? { ...item, ...merged } : item,
  );
}

export const fetchContractors = createAsyncThunk<
  {
    items: PortalContractor[];
    page: number;
    total: number;
    totalPages: number;
    search: string;
    status: string;
  },
  void,
  { state: { contractors: ContractorsState }; rejectValue: string }
>("contractors/fetchList", async (_params, { getState, rejectWithValue }) => {
  const state = getState().contractors ?? initialState;
  try {
    const result = await queryContractors({
      page: state.page,
      limit: state.limit,
      search: state.search.trim() || undefined,
      status: state.status.trim() || undefined,
      force: true,
      silent: true,
    });
    return {
      items: result.items,
      page: result.page,
      total: result.total,
      totalPages: result.totalPages,
      search: state.search,
      status: state.status,
    };
  } catch (error) {
    return rejectWithValue(extractErrorMessage(error));
  }
});

export const fetchContractorDetail = createAsyncThunk<
  PortalContractor,
  string,
  { rejectValue: string }
>("contractors/fetchDetail", async (id, { rejectWithValue }) => {
  try {
    const detail = await getContractor(id);
    if (!detail) return rejectWithValue("Contractor not found.");
    return detail;
  } catch (error) {
    return rejectWithValue(extractErrorMessage(error));
  }
});

export const createContractorRecord = createAsyncThunk<
  PortalContractor,
  PortalContractor,
  { rejectValue: string }
>("contractors/create", async (payload, { rejectWithValue }) => {
  try {
    const created = await createContractor(payload);
    if (!created) return rejectWithValue("Contractor was created but could not be read.");
    return created;
  } catch (error) {
    return rejectWithValue(extractErrorMessage(error));
  }
});

export const updateContractorRecord = createAsyncThunk<
  PortalContractor,
  { id: string; patch: Partial<PortalContractor> },
  { rejectValue: string }
>("contractors/update", async ({ id, patch }, { rejectWithValue }) => {
  try {
    const updated = await updateContractor(id, patch);
    if (updated) return updated;
    const detail = await getContractor(id);
    if (!detail) return rejectWithValue("Contractor was updated but could not be read.");
    return detail;
  } catch (error) {
    return rejectWithValue(extractErrorMessage(error));
  }
});

export const deleteContractorRecord = createAsyncThunk<
  string,
  string,
  { rejectValue: string }
>("contractors/delete", async (id, { rejectWithValue }) => {
  try {
    await deleteContractor(id);
    return id;
  } catch (error) {
    return rejectWithValue(extractErrorMessage(error));
  }
});

export const addContractorMemberAttachment = createAsyncThunk<
  PortalContractor,
  {
    id: string;
    attachment: {
      name: string;
      url: string;
      fileType?: string;
      sizeBytes?: number;
      category?: string;
    };
  },
  { rejectValue: string }
>("contractors/addAttachment", async ({ id, attachment }, { rejectWithValue }) => {
  try {
    const saved = await addContractorAttachment(id, attachment);
    const detail = await getContractor(id);
    if (!detail) {
      if (saved) return saved;
      return rejectWithValue("Attachment saved but contractor could not be read.");
    }
    const savedCount = saved?.attachments?.length ?? 0;
    const detailCount = detail.attachments?.length ?? 0;
    if (saved && savedCount > detailCount) {
      return { ...detail, attachments: saved.attachments };
    }
    if (savedCount === 0 && detailCount === 0 && attachment.url) {
      return {
        ...detail,
        attachments: [
          ...(detail.attachments ?? []),
          {
            id: `att_${Date.now()}`,
            name: attachment.name,
            url: attachment.url,
            fileType: attachment.fileType,
            sizeBytes: attachment.sizeBytes,
            category: attachment.category,
            uploadedAt: new Date().toISOString(),
          },
        ],
      };
    }
    return detail;
  } catch (error) {
    return rejectWithValue(extractErrorMessage(error));
  }
});

export const removeContractorMemberAttachment = createAsyncThunk<
  PortalContractor,
  { id: string; attachmentId: string },
  { rejectValue: string }
>("contractors/removeAttachment", async ({ id, attachmentId }, { rejectWithValue }) => {
  try {
    const detail = await deleteContractorAttachment(id, attachmentId);
    if (!detail) return rejectWithValue("Attachment removed but contractor could not be read.");
    return detail;
  } catch (error) {
    return rejectWithValue(extractErrorMessage(error));
  }
});

export const fetchContractorJobs = createAsyncThunk<
  {
    contractorId: string;
    filterKey: string;
    items: Job[];
    page: number;
    total: number;
    totalPages: number;
  },
  ContractorTabArg,
  { state: { contractors: ContractorsState }; rejectValue: string }
>("contractors/fetchJobs", async (arg, { rejectWithValue }) => {
  const filterKey = tabCacheKey(arg);
  try {
    const result = await queryJobs({
      contractorId: arg.contractorId,
      status: arg.status || undefined,
      search: arg.search || undefined,
      page: arg.page ?? 1,
      limit: arg.limit ?? DETAIL_TAB_LIMIT,
      force: true,
      silent: true,
    });
    return {
      contractorId: arg.contractorId,
      filterKey,
      items: result.items,
      page: result.page,
      total: result.total,
      totalPages: result.totalPages,
    };
  } catch (error) {
    return rejectWithValue(extractErrorMessage(error));
  }
});

export const fetchContractorEstimates = createAsyncThunk<
  {
    contractorId: string;
    filterKey: string;
    items: Estimate[];
    page: number;
    total: number;
    totalPages: number;
  },
  ContractorTabArg,
  { state: { contractors: ContractorsState }; rejectValue: string }
>("contractors/fetchEstimates", async (arg, { rejectWithValue }) => {
  const filterKey = tabCacheKey(arg);
  try {
    const result = await queryEstimates({
      contractorId: arg.contractorId,
      status: arg.status || undefined,
      search: arg.search || undefined,
      page: arg.page ?? 1,
      limit: arg.limit ?? DETAIL_TAB_LIMIT,
      force: true,
      silent: true,
    });
    return {
      contractorId: arg.contractorId,
      filterKey,
      items: result.items,
      page: result.page,
      total: result.total,
      totalPages: result.totalPages,
    };
  } catch (error) {
    return rejectWithValue(extractErrorMessage(error));
  }
});

export const fetchContractorSchedule = createAsyncThunk<
  { contractorId: string; filterKey: string; items: PortalCalendarEvent[] },
  ContractorTabArg,
  { state: { contractors: ContractorsState }; rejectValue: string }
>("contractors/fetchSchedule", async (arg, { rejectWithValue }) => {
  const filterKey = tabCacheKey(arg);
  try {
    const items = await querySchedule({
      contractorId: arg.contractorId,
      kind: arg.kind || undefined,
      force: true,
      silent: true,
    });
    return {
      contractorId: arg.contractorId,
      filterKey,
      items,
    };
  } catch (error) {
    return rejectWithValue(extractErrorMessage(error));
  }
});

export const fetchContractorTasks = createAsyncThunk<
  {
    contractorId: string;
    filterKey: string;
    items: PortalTask[];
    page: number;
    total: number;
    totalPages: number;
  },
  ContractorTabArg,
  { state: { contractors: ContractorsState }; rejectValue: string }
>("contractors/fetchTasks", async (arg, { rejectWithValue }) => {
  const filterKey = tabCacheKey(arg);
  try {
    const result = await queryTasks({
      contractorId: arg.contractorId,
      status: arg.status || undefined,
      search: arg.search || undefined,
      page: arg.page ?? 1,
      limit: arg.limit ?? DETAIL_TAB_LIMIT,
      force: true,
      silent: true,
    });
    return {
      contractorId: arg.contractorId,
      filterKey,
      items: result.items,
      page: result.page,
      total: result.total,
      totalPages: result.totalPages,
    };
  } catch (error) {
    return rejectWithValue(extractErrorMessage(error));
  }
});

export const fetchContractorReminders = createAsyncThunk<
  {
    contractorId: string;
    filterKey: string;
    items: PortalReminder[];
    page: number;
    total: number;
    totalPages: number;
  },
  ContractorTabArg,
  { state: { contractors: ContractorsState }; rejectValue: string }
>("contractors/fetchReminders", async (arg, { rejectWithValue }) => {
  const filterKey = tabCacheKey(arg);
  try {
    const result = await queryReminders({
      contractorId: arg.contractorId,
      status: arg.status || undefined,
      search: arg.search || undefined,
      page: arg.page ?? 1,
      limit: arg.limit ?? DETAIL_TAB_LIMIT,
      force: true,
      silent: true,
    });
    return {
      contractorId: arg.contractorId,
      filterKey,
      items: result.items,
      page: result.page,
      total: result.total,
      totalPages: result.totalPages,
    };
  } catch (error) {
    return rejectWithValue(extractErrorMessage(error));
  }
});

export const patchContractorReminderStatus = createAsyncThunk<
  PortalReminder,
  { id: string; status: PortalReminder["status"]; contractorId: string },
  { rejectValue: string }
>("contractors/patchReminderStatus", async ({ id, status }, { rejectWithValue }) => {
  try {
    const updated = await updateReminderStatus(id, status);
    if (!updated) return rejectWithValue("Reminder status was updated but could not be read.");
    return updated;
  } catch (error) {
    return rejectWithValue(extractErrorMessage(error));
  }
});

export const deleteContractorReminder = createAsyncThunk<
  string,
  { id: string; contractorId: string },
  { rejectValue: string }
>("contractors/deleteReminder", async ({ id }, { rejectWithValue }) => {
  try {
    await deleteReminder(id);
    return id;
  } catch (error) {
    return rejectWithValue(extractErrorMessage(error));
  }
});

export const patchContractorTaskStatus = createAsyncThunk<
  PortalTask,
  { id: string; status: PortalTask["status"]; contractorId: string },
  { rejectValue: string }
>("contractors/patchTaskStatus", async ({ id, status }, { rejectWithValue }) => {
  try {
    const updated = await updateTaskStatus(id, status);
    if (!updated) return rejectWithValue("Task status was updated but could not be read.");
    return updated;
  } catch (error) {
    return rejectWithValue(extractErrorMessage(error));
  }
});

export const deleteContractorTask = createAsyncThunk<
  string,
  { id: string; contractorId: string },
  { rejectValue: string }
>("contractors/deleteTask", async ({ id }, { rejectWithValue }) => {
  try {
    await deleteTask(id);
    return id;
  } catch (error) {
    return rejectWithValue(extractErrorMessage(error));
  }
});

const contractorsSlice = createSlice({
  name: "contractors",
  initialState,
  reducers: {
    setContractorsSearch(state, action: PayloadAction<string>) {
      state.search = action.payload;
      state.page = 1;
      state.pagesCache = {};
    },
    setContractorsPage(state, action: PayloadAction<number>) {
      state.page = Math.max(1, action.payload);
      const key = cacheKey(state.search, state.status, state.page, state.limit);
      if (key in state.pagesCache) state.items = state.pagesCache[key];
    },
    setContractorsStatus(state, action: PayloadAction<string>) {
      state.status = action.payload;
      state.page = 1;
      state.pagesCache = {};
    },
    invalidateContractorsCache(state) {
      state.pagesCache = {};
    },
    clearContractorsError(state) {
      state.error = null;
    },
    clearContractorDetail(state) {
      state.detail = null;
      state.detailError = null;
      state.detailLoading = false;
      // Keep Jobs/Estimates/Schedule caches so remounts / tab switches
      // can show existing rows while the GET refreshes (employee pattern).
    },
    /** Drop tab caches that do not belong to this contractor (contractor switch). */
    bindContractorDetail(state, action: PayloadAction<string>) {
      const contractorId = action.payload;
      if (state.jobs.contractorId && state.jobs.contractorId !== contractorId) {
        state.jobs = emptyTabList();
      }
      if (state.estimates.contractorId && state.estimates.contractorId !== contractorId) {
        state.estimates = emptyTabList();
      }
      if (state.schedule.contractorId && state.schedule.contractorId !== contractorId) {
        state.schedule = emptyTabList();
      }
      if (state.tasks.contractorId && state.tasks.contractorId !== contractorId) {
        state.tasks = emptyTabList();
      }
      if (state.reminders.contractorId && state.reminders.contractorId !== contractorId) {
        state.reminders = emptyTabList();
      }
    },
    upsertContractorTask(state, action: PayloadAction<{ contractorId: string; item: PortalTask }>) {
      upsertTabItem(state.tasks, action.payload.item, action.payload.contractorId);
    },
    upsertContractorReminder(
      state,
      action: PayloadAction<{ contractorId: string; item: PortalReminder }>,
    ) {
      upsertTabItem(state.reminders, action.payload.item, action.payload.contractorId);
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchContractors.pending, (state) => {
        if (state.items.length === 0) state.loading = true;
        state.error = null;
      })
      .addCase(fetchContractors.fulfilled, (state, action) => {
        state.loading = false;
        state.items = action.payload.items;
        state.page = action.payload.page;
        state.limit = CONTRACTORS_DEFAULT_LIMIT;
        state.total = action.payload.total;
        state.totalPages = Math.max(1, action.payload.totalPages);
        state.search = action.payload.search;
        state.status = action.payload.status;
        state.pagesCache[
          cacheKey(state.search, state.status, state.page, state.limit)
        ] = action.payload.items;
      })
      .addCase(fetchContractors.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || "Failed to load contractors.";
      })
      .addCase(fetchContractorDetail.pending, (state, action) => {
        const nextId = action.meta.arg;
        const previousId = state.detail?.id;
        const hasCachedProfile =
          state.detail?.id === nextId ||
          state.items.some((item) => item.id === nextId);
        state.detailLoading = !hasCachedProfile;
        state.detailError = null;
        if (previousId && previousId !== nextId) {
          state.jobs = emptyTabList();
          state.estimates = emptyTabList();
          state.schedule = emptyTabList();
          state.tasks = emptyTabList();
          state.reminders = emptyTabList();
        } else if (!previousId) {
          if (state.jobs.contractorId && state.jobs.contractorId !== nextId) {
            state.jobs = emptyTabList();
          }
          if (state.estimates.contractorId && state.estimates.contractorId !== nextId) {
            state.estimates = emptyTabList();
          }
          if (state.schedule.contractorId && state.schedule.contractorId !== nextId) {
            state.schedule = emptyTabList();
          }
          if (state.tasks.contractorId && state.tasks.contractorId !== nextId) {
            state.tasks = emptyTabList();
          }
          if (state.reminders.contractorId && state.reminders.contractorId !== nextId) {
            state.reminders = emptyTabList();
          }
        }
      })
      .addCase(fetchContractorDetail.fulfilled, (state, action) => {
        applyDetail(state, action.payload);
      })
      .addCase(fetchContractorDetail.rejected, (state, action) => {
        state.detailLoading = false;
        state.detailError = action.payload || "Failed to load contractor.";
      })
      .addCase(createContractorRecord.pending, (state) => {
        state.mutating = true;
      })
      .addCase(createContractorRecord.fulfilled, (state, action) => {
        state.mutating = false;
        state.pagesCache = {};
        state.page = 1;
        state.items = [
          action.payload,
          ...state.items.filter((item) => item.id !== action.payload.id),
        ];
        state.total += 1;
      })
      .addCase(createContractorRecord.rejected, (state, action) => {
        state.mutating = false;
        state.error = action.payload || "Failed to create contractor.";
      })
      .addCase(updateContractorRecord.fulfilled, (state, action) => {
        applyDetail(state, action.payload);
      })
      .addCase(addContractorMemberAttachment.fulfilled, (state, action) => {
        applyDetail(state, action.payload);
      })
      .addCase(removeContractorMemberAttachment.fulfilled, (state, action) => {
        applyDetail(state, action.payload);
      })
      .addCase(deleteContractorRecord.fulfilled, (state, action) => {
        state.pagesCache = {};
        state.items = state.items.filter((item) => item.id !== action.payload);
        state.total = Math.max(0, state.total - 1);
        if (state.detail?.id === action.payload) {
          state.detail = null;
          state.jobs = emptyTabList();
          state.estimates = emptyTabList();
          state.schedule = emptyTabList();
          state.tasks = emptyTabList();
          state.reminders = emptyTabList();
        }
      })
      .addCase(fetchContractorJobs.pending, (state, action) => {
        setTabPending(state.jobs, action.meta.arg.contractorId, tabCacheKey(action.meta.arg));
      })
      .addCase(fetchContractorJobs.fulfilled, (state, action) => {
        setTabFulfilled(state.jobs, action.payload);
      })
      .addCase(fetchContractorJobs.rejected, (state, action) => {
        setTabRejected(state.jobs, action.payload || "Failed to load jobs.");
      })
      .addCase(fetchContractorEstimates.pending, (state, action) => {
        setTabPending(state.estimates, action.meta.arg.contractorId, tabCacheKey(action.meta.arg));
      })
      .addCase(fetchContractorEstimates.fulfilled, (state, action) => {
        setTabFulfilled(state.estimates, action.payload);
      })
      .addCase(fetchContractorEstimates.rejected, (state, action) => {
        setTabRejected(state.estimates, action.payload || "Failed to load estimates.");
      })
      .addCase(fetchContractorSchedule.pending, (state, action) => {
        setTabPending(state.schedule, action.meta.arg.contractorId, tabCacheKey(action.meta.arg));
      })
      .addCase(fetchContractorSchedule.fulfilled, (state, action) => {
        setTabFulfilled(state.schedule, action.payload);
      })
      .addCase(fetchContractorSchedule.rejected, (state, action) => {
        setTabRejected(state.schedule, action.payload || "Failed to load schedule.");
      })
      .addCase(fetchContractorTasks.pending, (state, action) => {
        setTabPending(state.tasks, action.meta.arg.contractorId, tabCacheKey(action.meta.arg));
      })
      .addCase(fetchContractorTasks.fulfilled, (state, action) => {
        setTabFulfilled(state.tasks, action.payload);
      })
      .addCase(fetchContractorTasks.rejected, (state, action) => {
        setTabRejected(state.tasks, action.payload || "Failed to load tasks.");
      })
      .addCase(fetchContractorReminders.pending, (state, action) => {
        setTabPending(state.reminders, action.meta.arg.contractorId, tabCacheKey(action.meta.arg));
      })
      .addCase(fetchContractorReminders.fulfilled, (state, action) => {
        setTabFulfilled(state.reminders, action.payload);
      })
      .addCase(fetchContractorReminders.rejected, (state, action) => {
        setTabRejected(state.reminders, action.payload || "Failed to load reminders.");
      })
      .addCase(patchContractorReminderStatus.fulfilled, (state, action) => {
        const contractorId =
          action.payload.assignedContractorId ||
          (action.payload.subjectKind === "contractor" ? action.payload.subjectId : "") ||
          "";
        if (contractorId) upsertTabItem(state.reminders, action.payload, contractorId);
      })
      .addCase(deleteContractorReminder.fulfilled, (state, action) => {
        removeTabItem(state.reminders, action.payload);
      })
      .addCase(patchContractorTaskStatus.fulfilled, (state, action) => {
        const contractorId =
          action.payload.assignedContractorId ||
          (action.payload.subjectKind === "contractor" ? action.payload.subjectId : "") ||
          "";
        if (contractorId) upsertTabItem(state.tasks, action.payload, contractorId);
      })
      .addCase(deleteContractorTask.fulfilled, (state, action) => {
        removeTabItem(state.tasks, action.payload);
      })
      .addMatcher(
        (action): action is PayloadAction<PortalReminder> =>
          action.type === "reminders/create/fulfilled" ||
          action.type === "reminders/update/fulfilled" ||
          action.type === "reminders/patchStatus/fulfilled",
        (state, action) => {
          const contractorId =
            action.payload.assignedContractorId ||
            (action.payload.subjectKind === "contractor" ? action.payload.subjectId : "") ||
            "";
          if (contractorId) upsertTabItem(state.reminders, action.payload, contractorId);
        },
      )
      .addMatcher(
        (action): action is PayloadAction<string> => action.type === "reminders/delete/fulfilled",
        (state, action) => {
          removeTabItem(state.reminders, action.payload);
        },
      );
  },
});

export const {
  setContractorsSearch,
  setContractorsPage,
  setContractorsStatus,
  invalidateContractorsCache,
  clearContractorsError,
  clearContractorDetail,
  bindContractorDetail,
  upsertContractorTask,
  upsertContractorReminder,
} = contractorsSlice.actions;

export default contractorsSlice.reducer;
