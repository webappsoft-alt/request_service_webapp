import {
  createAsyncThunk,
  createSlice,
  type PayloadAction,
} from "@reduxjs/toolkit";
import { extractErrorMessage } from "@/components/api/extractErrorMessage";
import {
  addVendorAttachment,
  addVendorInventoryItem,
  createVendor,
  createVendorOrder,
  deleteVendor,
  deleteVendorAttachment,
  deleteVendorInventoryItem,
  deleteVendorOrder,
  getVendor,
  listVendorInventory,
  listVendorJobs,
  listVendorOrders,
  queryVendors,
  receiveVendorInventory,
  updateVendor,
  updateVendorOrder,
} from "@/lib/api/crm-client";
import type {
  PortalVendor,
  PortalVendorInventoryItem,
  PortalVendorPurchaseOrder,
} from "@/lib/data/crm-people";
import type { Job } from "@/lib/types";

/** List page size for GET /provider/vendors */
export const VENDORS_DEFAULT_LIMIT = 10;
const DETAIL_TAB_LIMIT = 50;

type TabListState<T> = {
  vendorId: string;
  filterKey: string;
  items: T[];
  loaded: boolean;
  loading: boolean;
  error: string | null;
  page: number;
  total: number;
  totalPages: number;
  stats?: { totalSkus?: number; totalOnHandValue?: number; totalOrders?: number; totalAmount?: number };
};

function emptyTabList<T>(): TabListState<T> {
  return {
    vendorId: "",
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

type VendorsState = {
  items: PortalVendor[];
  pagesCache: Record<string, PortalVendor[]>;
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  search: string;
  status: string;
  loading: boolean;
  mutating: boolean;
  error: string | null;
  detail: PortalVendor | null;
  detailLoading: boolean;
  detailError: string | null;
  inventory: TabListState<PortalVendorInventoryItem>;
  orders: TabListState<PortalVendorPurchaseOrder>;
  jobs: TabListState<Job>;
};

const initialState: VendorsState = {
  items: [],
  pagesCache: {},
  page: 1,
  limit: VENDORS_DEFAULT_LIMIT,
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
  inventory: emptyTabList(),
  orders: emptyTabList(),
  jobs: emptyTabList(),
};

function cacheKey(search: string, status: string, page: number, limit: number) {
  return `${status}|${search.trim()}|${page}|${limit}`;
}

function tabCacheKey(arg: { status?: string; search?: string; page?: number }) {
  return `${arg.status?.trim() || ""}|${arg.search?.trim() || ""}|${arg.page ?? 1}`;
}

export function vendorsTabFilterKey(arg: { status?: string; search?: string; page?: number }) {
  return tabCacheKey(arg);
}

export function selectVendorsTabShowLoader<T>(
  tab: TabListState<T> | null | undefined,
  vendorId: string,
  filterKey = "||1",
) {
  if (!vendorId) return false;
  if (!tab) return true;
  const sameView = tab.vendorId === vendorId && tab.filterKey === filterKey;
  if (!sameView) return true;
  return Boolean(tab.loading && !tab.loaded);
}

export function selectVendorsTabRows<T>(
  tab: TabListState<T> | null | undefined,
  vendorId: string,
  filterKey = "||1",
  fallback: T[] = [],
): T[] {
  if (!tab || tab.vendorId !== vendorId) return fallback;
  if (tab.loaded && tab.filterKey === filterKey) return tab.items;
  if (tab.loading || tab.items.length > 0) return tab.items;
  return fallback;
}

function setTabPending<T>(tab: TabListState<T>, vendorId: string, filterKey: string) {
  const sameView = tab.vendorId === vendorId && tab.filterKey === filterKey;
  if (!sameView) {
    tab.items = [];
    tab.loaded = false;
  }
  if (!tab.loaded) tab.loading = true;
  tab.error = null;
  tab.vendorId = vendorId;
  tab.filterKey = filterKey;
}

function setTabFulfilled<T>(
  tab: TabListState<T>,
  payload: {
    vendorId: string;
    filterKey: string;
    items: T[];
    page?: number;
    total?: number;
    totalPages?: number;
    stats?: TabListState<T>["stats"];
  },
) {
  tab.loading = false;
  tab.loaded = true;
  tab.error = null;
  tab.vendorId = payload.vendorId;
  tab.filterKey = payload.filterKey;
  tab.items = payload.items;
  tab.page = payload.page ?? 1;
  tab.total = payload.total ?? payload.items.length;
  tab.totalPages = payload.totalPages ?? 1;
  tab.stats = payload.stats;
}

function setTabRejected<T>(tab: TabListState<T>, message: string) {
  tab.loading = false;
  tab.error = message;
}

function applyDetail(state: VendorsState, vendor: PortalVendor) {
  const cached =
    state.items.find((item) => item.id === vendor.id) ??
    (state.detail?.id === vendor.id ? state.detail : null);
  const merged: PortalVendor = cached
    ? {
        ...cached,
        ...vendor,
        inventory: vendor.inventory !== undefined ? vendor.inventory : cached.inventory,
        purchaseOrders:
          vendor.purchaseOrders !== undefined ? vendor.purchaseOrders : cached.purchaseOrders,
        attachments: vendor.attachments !== undefined ? vendor.attachments : cached.attachments,
      }
    : vendor;
  state.detail = merged;
  state.detailLoading = false;
  state.detailError = null;
  state.items = state.items.map((item) =>
    item.id === merged.id ? { ...item, ...merged } : item,
  );
}

type VendorTabArg = {
  vendorId: string;
  status?: string;
  search?: string;
  page?: number;
  limit?: number;
  force?: boolean;
};

export const fetchVendors = createAsyncThunk<
  {
    items: PortalVendor[];
    page: number;
    total: number;
    totalPages: number;
    search: string;
    status: string;
  },
  void,
  { state: { vendors: VendorsState }; rejectValue: string }
>("vendors/fetchList", async (_params, { getState, rejectWithValue }) => {
  const state = getState().vendors ?? initialState;
  try {
    const result = await queryVendors({
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

export const fetchVendorDetail = createAsyncThunk<
  PortalVendor,
  string,
  { rejectValue: string }
>("vendors/fetchDetail", async (id, { rejectWithValue }) => {
  try {
    const detail = await getVendor(id);
    if (!detail) return rejectWithValue("Vendor not found.");
    return detail;
  } catch (error) {
    return rejectWithValue(extractErrorMessage(error));
  }
});

export const createVendorRecord = createAsyncThunk<
  PortalVendor,
  PortalVendor,
  { rejectValue: string }
>("vendors/create", async (payload, { rejectWithValue }) => {
  try {
    const created = await createVendor(payload);
    if (!created) return rejectWithValue("Vendor was created but could not be read.");
    return created;
  } catch (error) {
    return rejectWithValue(extractErrorMessage(error));
  }
});

export const updateVendorRecord = createAsyncThunk<
  PortalVendor,
  { id: string; patch: Partial<PortalVendor> },
  { rejectValue: string }
>("vendors/update", async ({ id, patch }, { rejectWithValue }) => {
  try {
    const updated = await updateVendor(id, patch);
    if (updated) return updated;
    const detail = await getVendor(id);
    if (!detail) return rejectWithValue("Vendor was updated but could not be read.");
    return detail;
  } catch (error) {
    return rejectWithValue(extractErrorMessage(error));
  }
});

export const deleteVendorRecord = createAsyncThunk<
  string,
  string,
  { rejectValue: string }
>("vendors/delete", async (id, { rejectWithValue }) => {
  try {
    await deleteVendor(id);
    return id;
  } catch (error) {
    return rejectWithValue(extractErrorMessage(error));
  }
});

export const fetchVendorInventory = createAsyncThunk<
  {
    vendorId: string;
    filterKey: string;
    items: PortalVendorInventoryItem[];
    page: number;
    total: number;
    totalPages: number;
    stats: { totalSkus: number; totalOnHandValue: number };
  },
  VendorTabArg,
  { rejectValue: string }
>("vendors/fetchInventory", async (arg, { rejectWithValue }) => {
  const filterKey = tabCacheKey(arg);
  try {
    const result = await listVendorInventory(arg.vendorId, {
      page: arg.page ?? 1,
      limit: arg.limit ?? DETAIL_TAB_LIMIT,
      search: arg.search || undefined,
      force: true,
      silent: true,
    });
    return {
      vendorId: arg.vendorId,
      filterKey,
      items: result.items,
      page: result.page,
      total: result.total,
      totalPages: result.totalPages,
      stats: result.stats,
    };
  } catch (error) {
    return rejectWithValue(extractErrorMessage(error));
  }
});

export const addVendorSku = createAsyncThunk<
  PortalVendor,
  {
    vendorId: string;
    item: {
      sku: string;
      name: string;
      unit?: string;
      onHandCount?: number;
      reorderPoint?: number;
      unitCost?: number;
      location?: string;
    };
  },
  { rejectValue: string }
>("vendors/addSku", async ({ vendorId, item }, { rejectWithValue }) => {
  try {
    const vendor = await addVendorInventoryItem(vendorId, item);
    if (!vendor) return rejectWithValue("SKU saved but vendor could not be read.");
    return vendor;
  } catch (error) {
    return rejectWithValue(extractErrorMessage(error));
  }
});

export const receiveVendorSku = createAsyncThunk<
  PortalVendor,
  { vendorId: string; skuId: string; quantity: number },
  { rejectValue: string }
>("vendors/receiveSku", async ({ vendorId, skuId, quantity }, { rejectWithValue }) => {
  try {
    const vendor = await receiveVendorInventory(vendorId, skuId, quantity);
    if (!vendor) return rejectWithValue("Stock received but vendor could not be read.");
    return vendor;
  } catch (error) {
    return rejectWithValue(extractErrorMessage(error));
  }
});

export const removeVendorSku = createAsyncThunk<
  PortalVendor,
  { vendorId: string; skuId: string },
  { rejectValue: string }
>("vendors/removeSku", async ({ vendorId, skuId }, { rejectWithValue }) => {
  try {
    const vendor = await deleteVendorInventoryItem(vendorId, skuId);
    if (!vendor) return rejectWithValue("SKU removed but vendor could not be read.");
    return vendor;
  } catch (error) {
    return rejectWithValue(extractErrorMessage(error));
  }
});

export const fetchVendorOrders = createAsyncThunk<
  {
    vendorId: string;
    filterKey: string;
    items: PortalVendorPurchaseOrder[];
    page: number;
    total: number;
    totalPages: number;
  },
  VendorTabArg,
  { rejectValue: string }
>("vendors/fetchOrders", async (arg, { rejectWithValue }) => {
  const filterKey = tabCacheKey(arg);
  try {
    const result = await listVendorOrders(arg.vendorId, {
      page: arg.page ?? 1,
      limit: arg.limit ?? DETAIL_TAB_LIMIT,
      status: arg.status || undefined,
      search: arg.search || undefined,
      force: true,
      silent: true,
    });
    return {
      vendorId: arg.vendorId,
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

export const addVendorPurchaseOrder = createAsyncThunk<
  PortalVendor,
  {
    vendorId: string;
    order: {
      poNumber?: string;
      amount: number;
      description: string;
      jobId?: string;
      status?: string;
    };
  },
  { rejectValue: string }
>("vendors/addOrder", async ({ vendorId, order }, { rejectWithValue }) => {
  try {
    const vendor = await createVendorOrder(vendorId, order);
    if (!vendor) return rejectWithValue("Order saved but vendor could not be read.");
    return vendor;
  } catch (error) {
    return rejectWithValue(extractErrorMessage(error));
  }
});

export const patchVendorPurchaseOrder = createAsyncThunk<
  PortalVendor,
  {
    vendorId: string;
    orderId: string;
    patch: { status?: string; amount?: number; description?: string; jobId?: string | null };
  },
  { rejectValue: string }
>("vendors/patchOrder", async ({ vendorId, orderId, patch }, { rejectWithValue }) => {
  try {
    const vendor = await updateVendorOrder(vendorId, orderId, patch);
    if (!vendor) return rejectWithValue("Order updated but vendor could not be read.");
    return vendor;
  } catch (error) {
    return rejectWithValue(extractErrorMessage(error));
  }
});

export const removeVendorPurchaseOrder = createAsyncThunk<
  PortalVendor,
  { vendorId: string; orderId: string },
  { rejectValue: string }
>("vendors/removeOrder", async ({ vendorId, orderId }, { rejectWithValue }) => {
  try {
    const vendor = await deleteVendorOrder(vendorId, orderId);
    if (!vendor) return rejectWithValue("Order removed but vendor could not be read.");
    return vendor;
  } catch (error) {
    return rejectWithValue(extractErrorMessage(error));
  }
});

export const fetchVendorJobs = createAsyncThunk<
  {
    vendorId: string;
    filterKey: string;
    items: Job[];
    page: number;
    total: number;
    totalPages: number;
  },
  VendorTabArg,
  { rejectValue: string }
>("vendors/fetchJobs", async (arg, { rejectWithValue }) => {
  const filterKey = tabCacheKey(arg);
  try {
    const result = await listVendorJobs(arg.vendorId, {
      page: arg.page ?? 1,
      limit: arg.limit ?? DETAIL_TAB_LIMIT,
      status: arg.status || undefined,
      force: true,
      silent: true,
    });
    return {
      vendorId: arg.vendorId,
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

export const addVendorMemberAttachment = createAsyncThunk<
  PortalVendor,
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
>("vendors/addAttachment", async ({ id, attachment }, { rejectWithValue }) => {
  try {
    const vendor = await addVendorAttachment(id, attachment);
    if (!vendor) return rejectWithValue("Attachment saved but vendor could not be read.");
    return vendor;
  } catch (error) {
    return rejectWithValue(extractErrorMessage(error));
  }
});

export const removeVendorMemberAttachment = createAsyncThunk<
  PortalVendor,
  { id: string; attachmentId: string },
  { rejectValue: string }
>("vendors/removeAttachment", async ({ id, attachmentId }, { rejectWithValue }) => {
  try {
    const vendor = await deleteVendorAttachment(id, attachmentId);
    if (!vendor) return rejectWithValue("Attachment removed but vendor could not be read.");
    return vendor;
  } catch (error) {
    return rejectWithValue(extractErrorMessage(error));
  }
});

const vendorsSlice = createSlice({
  name: "vendors",
  initialState,
  reducers: {
    setVendorsSearch(state, action: PayloadAction<string>) {
      state.search = action.payload;
      state.page = 1;
      state.pagesCache = {};
    },
    setVendorsPage(state, action: PayloadAction<number>) {
      state.page = Math.max(1, action.payload);
      const key = cacheKey(state.search, state.status, state.page, state.limit);
      if (key in state.pagesCache) state.items = state.pagesCache[key];
    },
    setVendorsStatus(state, action: PayloadAction<string>) {
      state.status = action.payload;
      state.page = 1;
      state.pagesCache = {};
    },
    invalidateVendorsCache(state) {
      state.pagesCache = {};
    },
    clearVendorsError(state) {
      state.error = null;
    },
    clearVendorDetail(state) {
      state.detail = null;
      state.detailError = null;
      state.detailLoading = false;
    },
    bindVendorDetail(state, action: PayloadAction<string>) {
      const vendorId = action.payload;
      if (state.inventory.vendorId && state.inventory.vendorId !== vendorId) {
        state.inventory = emptyTabList();
      }
      if (state.orders.vendorId && state.orders.vendorId !== vendorId) {
        state.orders = emptyTabList();
      }
      if (state.jobs.vendorId && state.jobs.vendorId !== vendorId) {
        state.jobs = emptyTabList();
      }
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchVendors.pending, (state) => {
        if (state.items.length === 0) state.loading = true;
        state.error = null;
      })
      .addCase(fetchVendors.fulfilled, (state, action) => {
        state.loading = false;
        state.items = action.payload.items;
        state.page = action.payload.page;
        state.limit = VENDORS_DEFAULT_LIMIT;
        state.total = action.payload.total;
        state.totalPages = Math.max(1, action.payload.totalPages);
        state.search = action.payload.search;
        state.status = action.payload.status;
        state.pagesCache[
          cacheKey(state.search, state.status, state.page, state.limit)
        ] = action.payload.items;
      })
      .addCase(fetchVendors.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || "Failed to load vendors.";
      })
      .addCase(fetchVendorDetail.pending, (state, action) => {
        const nextId = action.meta.arg;
        const previousId = state.detail?.id;
        const hasCachedProfile =
          state.detail?.id === nextId || state.items.some((item) => item.id === nextId);
        state.detailLoading = !hasCachedProfile;
        state.detailError = null;
        if (previousId && previousId !== nextId) {
          state.inventory = emptyTabList();
          state.orders = emptyTabList();
          state.jobs = emptyTabList();
        }
      })
      .addCase(fetchVendorDetail.fulfilled, (state, action) => {
        applyDetail(state, action.payload);
      })
      .addCase(fetchVendorDetail.rejected, (state, action) => {
        state.detailLoading = false;
        state.detailError = action.payload || "Failed to load vendor.";
      })
      .addCase(createVendorRecord.pending, (state) => {
        state.mutating = true;
      })
      .addCase(createVendorRecord.fulfilled, (state, action) => {
        state.mutating = false;
        state.pagesCache = {};
        state.page = 1;
        state.items = [
          action.payload,
          ...state.items.filter((item) => item.id !== action.payload.id),
        ];
        state.total += 1;
      })
      .addCase(createVendorRecord.rejected, (state, action) => {
        state.mutating = false;
        state.error = action.payload || "Failed to create vendor.";
      })
      .addCase(updateVendorRecord.fulfilled, (state, action) => {
        applyDetail(state, action.payload);
      })
      .addCase(deleteVendorRecord.fulfilled, (state, action) => {
        state.pagesCache = {};
        state.items = state.items.filter((item) => item.id !== action.payload);
        state.total = Math.max(0, state.total - 1);
        if (state.detail?.id === action.payload) {
          state.detail = null;
          state.inventory = emptyTabList();
          state.orders = emptyTabList();
          state.jobs = emptyTabList();
        }
      })
      .addCase(fetchVendorInventory.pending, (state, action) => {
        setTabPending(state.inventory, action.meta.arg.vendorId, tabCacheKey(action.meta.arg));
      })
      .addCase(fetchVendorInventory.fulfilled, (state, action) => {
        setTabFulfilled(state.inventory, action.payload);
        if (state.detail?.id === action.payload.vendorId) {
          state.detail = {
            ...state.detail,
            inventory: action.payload.items,
            totalSkus: action.payload.stats.totalSkus,
            inventoryOnHandValue: action.payload.stats.totalOnHandValue,
          };
        }
      })
      .addCase(fetchVendorInventory.rejected, (state, action) => {
        setTabRejected(state.inventory, action.payload || "Failed to load inventory.");
      })
      .addCase(addVendorSku.fulfilled, (state, action) => {
        applyDetail(state, action.payload);
        if (action.payload.inventory) {
          state.inventory.items = action.payload.inventory;
          state.inventory.loaded = true;
          state.inventory.vendorId = action.payload.id;
          state.inventory.total = action.payload.inventory.length;
        }
      })
      .addCase(receiveVendorSku.fulfilled, (state, action) => {
        applyDetail(state, action.payload);
        if (action.payload.inventory) {
          state.inventory.items = action.payload.inventory;
          state.inventory.loaded = true;
          state.inventory.vendorId = action.payload.id;
        }
      })
      .addCase(removeVendorSku.fulfilled, (state, action) => {
        applyDetail(state, action.payload);
        if (action.payload.inventory) {
          state.inventory.items = action.payload.inventory;
          state.inventory.loaded = true;
          state.inventory.vendorId = action.payload.id;
          state.inventory.total = action.payload.inventory.length;
        }
      })
      .addCase(fetchVendorOrders.pending, (state, action) => {
        setTabPending(state.orders, action.meta.arg.vendorId, tabCacheKey(action.meta.arg));
      })
      .addCase(fetchVendorOrders.fulfilled, (state, action) => {
        setTabFulfilled(state.orders, action.payload);
        if (state.detail?.id === action.payload.vendorId) {
          state.detail = { ...state.detail, purchaseOrders: action.payload.items };
        }
      })
      .addCase(fetchVendorOrders.rejected, (state, action) => {
        setTabRejected(state.orders, action.payload || "Failed to load orders.");
      })
      .addCase(addVendorPurchaseOrder.fulfilled, (state, action) => {
        applyDetail(state, action.payload);
        if (action.payload.purchaseOrders) {
          state.orders.items = action.payload.purchaseOrders;
          state.orders.loaded = true;
          state.orders.vendorId = action.payload.id;
          state.orders.total = action.payload.purchaseOrders.length;
        }
      })
      .addCase(patchVendorPurchaseOrder.fulfilled, (state, action) => {
        applyDetail(state, action.payload);
        if (action.payload.purchaseOrders) {
          state.orders.items = action.payload.purchaseOrders;
          state.orders.loaded = true;
          state.orders.vendorId = action.payload.id;
        }
      })
      .addCase(removeVendorPurchaseOrder.fulfilled, (state, action) => {
        applyDetail(state, action.payload);
        if (action.payload.purchaseOrders) {
          state.orders.items = action.payload.purchaseOrders;
          state.orders.loaded = true;
          state.orders.vendorId = action.payload.id;
          state.orders.total = action.payload.purchaseOrders.length;
        }
      })
      .addCase(fetchVendorJobs.pending, (state, action) => {
        setTabPending(state.jobs, action.meta.arg.vendorId, tabCacheKey(action.meta.arg));
      })
      .addCase(fetchVendorJobs.fulfilled, (state, action) => {
        setTabFulfilled(state.jobs, action.payload);
      })
      .addCase(fetchVendorJobs.rejected, (state, action) => {
        setTabRejected(state.jobs, action.payload || "Failed to load jobs.");
      })
      .addCase(addVendorMemberAttachment.fulfilled, (state, action) => {
        applyDetail(state, action.payload);
      })
      .addCase(removeVendorMemberAttachment.fulfilled, (state, action) => {
        applyDetail(state, action.payload);
      });
  },
});

export const {
  setVendorsSearch,
  setVendorsPage,
  setVendorsStatus,
  invalidateVendorsCache,
  clearVendorsError,
  clearVendorDetail,
  bindVendorDetail,
} = vendorsSlice.actions;

export default vendorsSlice.reducer;
