import {
  createAsyncThunk,
  createSlice,
  type PayloadAction,
} from "@reduxjs/toolkit";
import {
  deleteData,
  extractErrorMessage,
  getData,
  postData,
  putData,
} from "@/components/api/apiFuntions";
import { providerApi } from "@/components/api/ApiRoutesFile";

export type ServiceAreaLocation = {
  type: "Point";
  coordinates: [number, number];
  city: string;
  country: string;
  address: string;
  zip: string;
};

export type ServiceArea = {
  id: string;
  title: string;
  location: ServiceAreaLocation;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type ServiceAreaInput = {
  title: string;
  location: ServiceAreaLocation;
};

export type ServiceAreasListParams = {
  page?: number;
  limit?: number;
  search?: string;
  isActive?: boolean | null;
};

type PaginationMeta = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

type ServiceAreasState = {
  items: ServiceArea[];
  /** Cached list rows keyed by `search|page|limit` for soft page switches. */
  pagesCache: Record<string, ServiceArea[]>;
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  search: string;
  isActiveFilter: boolean | null;
  loading: boolean;
  mutating: boolean;
  error: string | null;
  /** Accumulated areas for Fixed Service form picker (See More). */
  pickerItems: ServiceArea[];
  pickerPage: number;
  pickerTotalPages: number;
  pickerLoading: boolean;
};

const DEFAULT_LIMIT = 10;

export function serviceAreasPageCacheKey(
  search: string,
  page: number,
  limit: number,
) {
  return `${search.trim()}|${page}|${limit}`;
}

const initialState: ServiceAreasState = {
  items: [],
  pagesCache: {},
  page: 1,
  limit: DEFAULT_LIMIT,
  total: 0,
  totalPages: 1,
  search: "",
  isActiveFilter: null,
  loading: false,
  mutating: false,
  error: null,
  pickerItems: [],
  pickerPage: 0,
  pickerTotalPages: 1,
  pickerLoading: false,
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function toNumber(value: unknown, fallback = 0): number {
  const next = typeof value === "number" ? value : Number(value);
  return Number.isFinite(next) ? next : fallback;
}

function normalizeLocation(raw: unknown): ServiceAreaLocation {
  const record = asRecord(raw) ?? {};
  const coordsRaw = Array.isArray(record.coordinates) ? record.coordinates : [];
  const lng = toNumber(coordsRaw[0], 0);
  const lat = toNumber(coordsRaw[1], 0);

  return {
    type: "Point",
    coordinates: [lng, lat],
    city: typeof record.city === "string" ? record.city : "",
    country: typeof record.country === "string" ? record.country : "US",
    address: typeof record.address === "string" ? record.address : "",
    zip: typeof record.zip === "string" ? record.zip : "",
  };
}

export function normalizeServiceArea(raw: unknown): ServiceArea | null {
  const record = asRecord(raw);
  if (!record) return null;

  const id =
    (typeof record.id === "string" && record.id) ||
    (typeof record._id === "string" && record._id) ||
    "";
  if (!id) return null;

  return {
    id,
    title: typeof record.title === "string" ? record.title : "",
    location: normalizeLocation(record.location),
    isActive: Boolean(record.isActive ?? true),
    createdAt: typeof record.createdAt === "string" ? record.createdAt : undefined,
    updatedAt: typeof record.updatedAt === "string" ? record.updatedAt : undefined,
  };
}

function extractListPayload(response: unknown): {
  items: ServiceArea[];
  pagination: PaginationMeta;
} {
  const root = asRecord(response) ?? {};
  const nested = asRecord(root.data);
  const listCandidate =
    (Array.isArray(root.data) && root.data) ||
    (Array.isArray(root.serviceAreas) && root.serviceAreas) ||
    (Array.isArray(nested?.items) && nested.items) ||
    (Array.isArray(nested?.docs) && nested.docs) ||
    (Array.isArray(nested?.serviceAreas) && nested.serviceAreas) ||
    (Array.isArray(response) && response) ||
    [];

  const items = listCandidate
    .map(normalizeServiceArea)
    .filter((item): item is ServiceArea => Boolean(item));

  const paginationRaw =
    asRecord(root.pagination) ||
    asRecord(nested?.pagination) ||
    asRecord(root.meta) ||
    asRecord(nested?.meta) ||
    {};

  const page = Math.max(1, toNumber(paginationRaw.page ?? root.page, 1));
  const limit = Math.max(
    1,
    toNumber(paginationRaw.limit ?? root.limit, DEFAULT_LIMIT),
  );
  const total = Math.max(
    0,
    toNumber(
      paginationRaw.total ??
        paginationRaw.totalDocs ??
        root.total ??
        nested?.total ??
        items.length,
      items.length,
    ),
  );
  const totalPages = Math.max(
    1,
    toNumber(
      paginationRaw.totalPages ?? root.totalPages ?? nested?.totalPages,
      Math.max(1, Math.ceil(total / limit) || 1),
    ),
  );

  return {
    items,
    pagination: { page, limit, total, totalPages },
  };
}

function extractEntity(response: unknown): ServiceArea | null {
  const root = asRecord(response);
  if (!root) return normalizeServiceArea(response);
  return (
    normalizeServiceArea(root.data) ||
    normalizeServiceArea(root.serviceArea) ||
    normalizeServiceArea(root)
  );
}

export const fetchServiceAreas = createAsyncThunk<
  {
    items: ServiceArea[];
    pagination: PaginationMeta;
    search: string;
    isActiveFilter: boolean | null;
  },
  ServiceAreasListParams | void,
  {
    state: { serviceAreas: ServiceAreasState };
    rejectValue: string;
  }
>("serviceAreas/fetchList", async (params, { getState, rejectWithValue }) => {
  const state = getState().serviceAreas;
  const page = params?.page ?? state.page;
  const limit = params?.limit ?? state.limit;
  const search = params?.search ?? state.search;
  const isActive =
    params && "isActive" in params ? params.isActive ?? null : state.isActiveFilter;

  try {
    const query: Record<string, string | number | boolean> = {
      page,
      limit,
    };
    if (search.trim()) query.search = search.trim();
    if (isActive !== null && isActive !== undefined) query.isActive = isActive;

    const response = await getData(providerApi.serviceAreas, query, {
      silent: true,
    });
    const parsed = extractListPayload(response);
    return {
      items: parsed.items,
      pagination: parsed.pagination,
      search,
      isActiveFilter: isActive ?? null,
    };
  } catch (error) {
    return rejectWithValue(extractErrorMessage(error));
  }
});

export const createServiceArea = createAsyncThunk<
  ServiceArea,
  ServiceAreaInput,
  { rejectValue: string }
>("serviceAreas/create", async (payload, { rejectWithValue }) => {
  try {
    const response = await postData(providerApi.serviceAreas, payload, {
      silent: true,
    });
    const created = extractEntity(response);
    if (!created) {
      return rejectWithValue("Service area was created but could not be read.");
    }
    return created;
  } catch (error) {
    return rejectWithValue(extractErrorMessage(error));
  }
});

export const updateServiceArea = createAsyncThunk<
  ServiceArea,
  { id: string } & ServiceAreaInput,
  { rejectValue: string }
>("serviceAreas/update", async ({ id, ...payload }, { rejectWithValue }) => {
  try {
    const response = await putData(providerApi.serviceArea(id), payload, {
      silent: true,
    });
    const updated = extractEntity(response) ?? {
      id,
      ...payload,
    };
    return updated;
  } catch (error) {
    return rejectWithValue(extractErrorMessage(error));
  }
});

export const deleteServiceArea = createAsyncThunk<
  string,
  string,
  { rejectValue: string }
>("serviceAreas/delete", async (id, { rejectWithValue }) => {
  try {
    await deleteData(providerApi.serviceArea(id), { silent: true });
    return id;
  } catch (error) {
    return rejectWithValue(extractErrorMessage(error));
  }
});

/** Load / append service areas for Fixed Service form chips (See More). */
export const fetchServiceAreasPicker = createAsyncThunk<
  {
    items: ServiceArea[];
    page: number;
    totalPages: number;
    append: boolean;
  },
  { append?: boolean } | void,
  { state: { serviceAreas: ServiceAreasState }; rejectValue: string }
>("serviceAreas/fetchPicker", async (params, { getState, rejectWithValue }) => {
  const state = getState().serviceAreas;
  const append = Boolean(params && "append" in params && params.append);
  const nextPage = append ? state.pickerPage + 1 : 1;

  if (append && state.pickerPage >= state.pickerTotalPages) {
    return {
      items: [],
      page: state.pickerPage,
      totalPages: state.pickerTotalPages,
      append: true,
    };
  }

  try {
    const response = await getData(
      providerApi.serviceAreas,
      { page: nextPage, limit: DEFAULT_LIMIT },
      { silent: true },
    );
    const parsed = extractListPayload(response);
    return {
      items: parsed.items,
      page: parsed.pagination.page,
      totalPages: Math.max(1, parsed.pagination.totalPages),
      append,
    };
  } catch (error) {
    return rejectWithValue(extractErrorMessage(error));
  }
});

const serviceAreasSlice = createSlice({
  name: "serviceAreas",
  initialState,
  reducers: {
    setServiceAreasSearch(state, action: PayloadAction<string>) {
      state.search = action.payload;
      state.page = 1;
      // New search query — drop page cache so results stay accurate.
      state.pagesCache = {};
    },
    setServiceAreasPage(state, action: PayloadAction<number>) {
      state.page = Math.max(1, action.payload);
      const key = serviceAreasPageCacheKey(state.search, state.page, state.limit);
      const cached = state.pagesCache[key];
      if (cached?.length) {
        state.items = cached;
      }
    },
    setServiceAreasActiveFilter(
      state,
      action: PayloadAction<boolean | null>,
    ) {
      state.isActiveFilter = action.payload;
      state.page = 1;
      state.pagesCache = {};
    },
    clearServiceAreasError(state) {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchServiceAreas.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchServiceAreas.fulfilled, (state, action) => {
        state.loading = false;
        state.items = action.payload.items;
        state.page = action.payload.pagination.page;
        state.limit = action.payload.pagination.limit;
        state.total = action.payload.pagination.total;
        state.totalPages = Math.max(1, action.payload.pagination.totalPages);
        state.search = action.payload.search;
        state.isActiveFilter = action.payload.isActiveFilter;
        state.error = null;
        if (state.page > state.totalPages) {
          state.page = state.totalPages;
        }
        const key = serviceAreasPageCacheKey(
          state.search,
          state.page,
          state.limit,
        );
        state.pagesCache[key] = action.payload.items;
      })
      .addCase(fetchServiceAreas.rejected, (state, action) => {
        state.loading = false;
        state.error =
          action.payload || action.error.message || "Failed to load service areas.";
      })
      .addCase(createServiceArea.pending, (state) => {
        state.mutating = true;
        state.error = null;
      })
      .addCase(createServiceArea.fulfilled, (state) => {
        state.mutating = false;
        state.pagesCache = {};
      })
      .addCase(createServiceArea.rejected, (state, action) => {
        state.mutating = false;
        state.error =
          action.payload || action.error.message || "Failed to create service area.";
      })
      .addCase(updateServiceArea.pending, (state) => {
        state.mutating = true;
        state.error = null;
      })
      .addCase(updateServiceArea.fulfilled, (state, action) => {
        state.mutating = false;
        const index = state.items.findIndex((item) => item.id === action.payload.id);
        if (index >= 0) state.items[index] = action.payload;
        state.pagesCache = {};
        const key = serviceAreasPageCacheKey(state.search, state.page, state.limit);
        state.pagesCache[key] = state.items;
      })
      .addCase(updateServiceArea.rejected, (state, action) => {
        state.mutating = false;
        state.error =
          action.payload || action.error.message || "Failed to update service area.";
      })
      .addCase(deleteServiceArea.pending, (state) => {
        state.mutating = true;
        state.error = null;
      })
      .addCase(deleteServiceArea.fulfilled, (state, action) => {
        state.mutating = false;
        state.items = state.items.filter((item) => item.id !== action.payload);
        state.total = Math.max(0, state.total - 1);
        state.pagesCache = {};
      })
      .addCase(deleteServiceArea.rejected, (state, action) => {
        state.mutating = false;
        state.error =
          action.payload || action.error.message || "Failed to delete service area.";
      })
      .addCase(fetchServiceAreasPicker.pending, (state) => {
        state.pickerLoading = true;
      })
      .addCase(fetchServiceAreasPicker.fulfilled, (state, action) => {
        state.pickerLoading = false;
        state.pickerPage = action.payload.page;
        state.pickerTotalPages = action.payload.totalPages;
        if (action.payload.append) {
          const existingIds = new Set(state.pickerItems.map((item) => item.id));
          state.pickerItems = [
            ...state.pickerItems,
            ...action.payload.items.filter((item) => !existingIds.has(item.id)),
          ];
        } else {
          state.pickerItems = action.payload.items;
        }
      })
      .addCase(fetchServiceAreasPicker.rejected, (state) => {
        state.pickerLoading = false;
      });
  },
});

export const {
  setServiceAreasSearch,
  setServiceAreasPage,
  setServiceAreasActiveFilter,
  clearServiceAreasError,
} = serviceAreasSlice.actions;

export const selectServiceAreasState = (state: {
  serviceAreas: ServiceAreasState;
}) => state.serviceAreas;
export const selectServiceAreas = (state: { serviceAreas: ServiceAreasState }) =>
  state.serviceAreas.items;
export const selectServiceAreasLoading = (state: {
  serviceAreas: ServiceAreasState;
}) => state.serviceAreas.loading;
export const selectServiceAreasMutating = (state: {
  serviceAreas: ServiceAreasState;
}) => state.serviceAreas.mutating;

/** Full-page loader only when there is nothing cached to show. */
export const selectServiceAreasShowLoader = (state: {
  serviceAreas?: ServiceAreasState;
}) => {
  const slice = state.serviceAreas;
  if (!slice) return true;
  return slice.loading && slice.items.length === 0;
};

export default serviceAreasSlice.reducer;
