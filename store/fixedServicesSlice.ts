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

export type FixedServiceUnit = "job" | "hour" | "visit";

export type FixedService = {
  id: string;
  servicesName: string;
  categoryId: string;
  categoryName: string;
  subcategoryId: string;
  subcategoryName: string;
  price: number;
  unit: FixedServiceUnit;
  isPublic: boolean;
  customerSee: boolean;
  images: string[];
  covered: string[];
  description: string;
  commonServices: string[];
  workingArea: string[];
  serviceAreaIds: string[];
  availabilityType: "company_office_hours" | "custom";
  customHours?: unknown;
};

export type FixedServiceInput = {
  servicesName: string;
  category: string;
  subcategory: string;
  price: number;
  unit: string;
  isPublic: boolean;
  customerSee: boolean;
  images: string[];
  covered: string[];
  commonServices: string[];
  workingArea: string[];
  serviceAreas: string[];
  availabilityType: string;
  /** Optional customer-facing description if backend accepts it */
  description?: string;
};

type PaginationMeta = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

type FixedServicesState = {
  items: FixedService[];
  pagesCache: Record<string, FixedService[]>;
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  search: string;
  loading: boolean;
  mutating: boolean;
  detail: FixedService | null;
  detailLoading: boolean;
  error: string | null;
};

const DEFAULT_LIMIT = 10;

const initialState: FixedServicesState = {
  items: [],
  pagesCache: {},
  page: 1,
  limit: DEFAULT_LIMIT,
  total: 0,
  totalPages: 1,
  search: "",
  loading: false,
  mutating: false,
  detail: null,
  detailLoading: false,
  error: null,
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function idOf(value: unknown): string {
  if (typeof value === "string") return value;
  const record = asRecord(value);
  if (!record) return "";
  return (
    (typeof record.id === "string" && record.id) ||
    (typeof record._id === "string" && record._id) ||
    ""
  );
}

function nameOf(value: unknown, fallback = ""): string {
  const record = asRecord(value);
  if (record && typeof record.name === "string") return record.name;
  return fallback;
}

function parseUnit(value: unknown): FixedServiceUnit {
  const raw = String(value || "").toLowerCase();
  if (raw.includes("hour")) return "hour";
  if (raw.includes("visit")) return "visit";
  return "job";
}

export function unitToApi(unit: FixedServiceUnit): string {
  switch (unit) {
    case "hour":
      return "per hour";
    case "visit":
      return "per visit";
    default:
      return "per job";
  }
}

export function normalizeFixedService(raw: unknown): FixedService | null {
  const record = asRecord(raw);
  if (!record) return null;
  const id = idOf(record);
  if (!id) return null;

  const categoryRef = record.category;
  const subcategoryRef = record.subcategory;

  return {
    id,
    servicesName:
      (typeof record.servicesName === "string" && record.servicesName) ||
      (typeof record.name === "string" && record.name) ||
      "",
    categoryId: idOf(categoryRef),
    categoryName: nameOf(categoryRef),
    subcategoryId: idOf(subcategoryRef),
    subcategoryName: nameOf(subcategoryRef),
    price: typeof record.price === "number" ? record.price : Number(record.price) || 0,
    unit: parseUnit(record.unit),
    isPublic: Boolean(record.isPublic ?? true),
    customerSee: Boolean(record.customerSee ?? record.isPublic ?? true),
    images: toStringArray(record.images),
    covered: toStringArray(record.covered),
    description:
      typeof record.description === "string"
        ? record.description
        : typeof record.customerDescription === "string"
          ? record.customerDescription
          : "",
    commonServices: toStringArray(record.commonServices),
    workingArea: toStringArray(record.workingArea),
    serviceAreaIds: Array.isArray(record.serviceAreas)
      ? record.serviceAreas.map(idOf).filter(Boolean)
      : [],
    availabilityType:
      String(record.availabilityType || "") === "custom"
        ? "custom"
        : "company_office_hours",
    customHours: record.customHours ?? record.workingHours,
  };
}

function extractList(response: unknown): {
  items: FixedService[];
  pagination: PaginationMeta;
} {
  const root = asRecord(response) ?? {};
  const list =
    (Array.isArray(root.data) && root.data) ||
    (Array.isArray(root.fixedServices) && root.fixedServices) ||
    (Array.isArray(response) && response) ||
    [];
  const items = list
    .map(normalizeFixedService)
    .filter((item): item is FixedService => Boolean(item));

  const paginationRaw = asRecord(root.pagination) || {};
  const page = Math.max(1, Number(paginationRaw.page) || 1);
  const limit = Math.max(1, Number(paginationRaw.limit) || DEFAULT_LIMIT);
  const total = Math.max(
    0,
    Number(paginationRaw.total ?? paginationRaw.totalDocs ?? items.length) || 0,
  );
  const totalPages = Math.max(
    1,
    Number(paginationRaw.totalPages) || Math.max(1, Math.ceil(total / limit) || 1),
  );

  return { items, pagination: { page, limit, total, totalPages } };
}

function extractEntity(response: unknown): FixedService | null {
  const root = asRecord(response);
  if (!root) return normalizeFixedService(response);
  return (
    normalizeFixedService(root.data) ||
    normalizeFixedService(root.fixedService) ||
    normalizeFixedService(root)
  );
}

export function fixedServicesPageCacheKey(
  search: string,
  page: number,
  limit: number,
) {
  return `${search.trim()}|${page}|${limit}`;
}

export const fetchFixedServices = createAsyncThunk<
  {
    items: FixedService[];
    pagination: PaginationMeta;
    search: string;
  },
  { page?: number; limit?: number; search?: string } | void,
  { state: { fixedServices: FixedServicesState }; rejectValue: string }
>("fixedServices/fetchList", async (params, { getState, rejectWithValue }) => {
  const state = getState().fixedServices;
  const page = params?.page ?? state.page;
  const limit = params?.limit ?? state.limit;
  const search = params?.search ?? state.search;
  try {
    const query: Record<string, string | number> = { page, limit };
    if (search.trim()) query.search = search.trim();
    const response = await getData(providerApi.fixedServices, query, {
      silent: true,
    });
    const parsed = extractList(response);
    return {
      items: parsed.items,
      pagination: parsed.pagination,
      search,
    };
  } catch (error) {
    return rejectWithValue(extractErrorMessage(error));
  }
});

export const fetchFixedServiceById = createAsyncThunk<
  FixedService,
  string,
  { rejectValue: string }
>("fixedServices/fetchById", async (id, { rejectWithValue }) => {
  try {
    const response = await getData(providerApi.fixedService(id), undefined, {
      silent: true,
    });
    const entity = extractEntity(response);
    if (!entity) {
      return rejectWithValue("Fixed service not found.");
    }
    return entity;
  } catch (error) {
    return rejectWithValue(extractErrorMessage(error));
  }
});

export const createFixedService = createAsyncThunk<
  FixedService,
  FixedServiceInput,
  { rejectValue: string }
>("fixedServices/create", async (payload, { rejectWithValue }) => {
  try {
    const response = await postData(providerApi.fixedServices, payload, {
      silent: true,
    });
    const entity = extractEntity(response);
    if (!entity) {
      return rejectWithValue("Service was created but could not be read.");
    }
    return entity;
  } catch (error) {
    return rejectWithValue(extractErrorMessage(error));
  }
});

export const updateFixedService = createAsyncThunk<
  FixedService,
  { id: string } & FixedServiceInput,
  { rejectValue: string }
>("fixedServices/update", async ({ id, ...payload }, { rejectWithValue }) => {
  try {
    const response = await putData(providerApi.fixedService(id), payload, {
      silent: true,
    });
    const entity = extractEntity(response);
    if (!entity) {
      return {
        id,
        servicesName: payload.servicesName,
        categoryId: payload.category,
        categoryName: "",
        subcategoryId: payload.subcategory,
        subcategoryName: "",
        price: payload.price,
        unit: parseUnit(payload.unit),
        isPublic: payload.isPublic,
        customerSee: payload.customerSee,
        images: payload.images,
        covered: payload.covered,
        description: payload.description || "",
        commonServices: payload.commonServices,
        workingArea: payload.workingArea,
        serviceAreaIds: payload.serviceAreas,
        availabilityType:
          payload.availabilityType === "custom"
            ? "custom"
            : "company_office_hours",
      };
    }
    return entity;
  } catch (error) {
    return rejectWithValue(extractErrorMessage(error));
  }
});

export const deleteFixedService = createAsyncThunk<
  string,
  string,
  { rejectValue: string }
>("fixedServices/delete", async (id, { rejectWithValue }) => {
  try {
    await deleteData(providerApi.fixedService(id), { silent: true });
    return id;
  } catch (error) {
    return rejectWithValue(extractErrorMessage(error));
  }
});

const fixedServicesSlice = createSlice({
  name: "fixedServices",
  initialState,
  reducers: {
    setFixedServicesSearch(state, action: PayloadAction<string>) {
      state.search = action.payload;
      state.page = 1;
      state.pagesCache = {};
    },
    setFixedServicesPage(state, action: PayloadAction<number>) {
      state.page = Math.max(1, action.payload);
      const key = fixedServicesPageCacheKey(state.search, state.page, state.limit);
      const cached = state.pagesCache[key];
      if (cached?.length) state.items = cached;
    },
    clearFixedServiceDetail(state) {
      state.detail = null;
    },
    clearFixedServicesError(state) {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchFixedServices.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchFixedServices.fulfilled, (state, action) => {
        state.loading = false;
        state.items = action.payload.items;
        state.page = action.payload.pagination.page;
        state.limit = action.payload.pagination.limit;
        state.total = action.payload.pagination.total;
        state.totalPages = Math.max(1, action.payload.pagination.totalPages);
        state.search = action.payload.search;
        const key = fixedServicesPageCacheKey(
          state.search,
          state.page,
          state.limit,
        );
        state.pagesCache[key] = action.payload.items;
      })
      .addCase(fetchFixedServices.rejected, (state, action) => {
        state.loading = false;
        state.error =
          action.payload ||
          action.error.message ||
          "Failed to load fixed services.";
      })
      .addCase(fetchFixedServiceById.pending, (state) => {
        state.detailLoading = true;
        state.error = null;
      })
      .addCase(fetchFixedServiceById.fulfilled, (state, action) => {
        state.detailLoading = false;
        state.detail = action.payload;
      })
      .addCase(fetchFixedServiceById.rejected, (state, action) => {
        state.detailLoading = false;
        state.error =
          action.payload ||
          action.error.message ||
          "Failed to load fixed service.";
      })
      .addCase(createFixedService.pending, (state) => {
        state.mutating = true;
        state.error = null;
      })
      .addCase(createFixedService.fulfilled, (state) => {
        state.mutating = false;
        state.pagesCache = {};
      })
      .addCase(createFixedService.rejected, (state, action) => {
        state.mutating = false;
        state.error =
          action.payload ||
          action.error.message ||
          "Failed to create fixed service.";
      })
      .addCase(updateFixedService.pending, (state) => {
        state.mutating = true;
        state.error = null;
      })
      .addCase(updateFixedService.fulfilled, (state, action) => {
        state.mutating = false;
        state.detail = action.payload;
        state.pagesCache = {};
        const index = state.items.findIndex((item) => item.id === action.payload.id);
        if (index >= 0) state.items[index] = action.payload;
      })
      .addCase(updateFixedService.rejected, (state, action) => {
        state.mutating = false;
        state.error =
          action.payload ||
          action.error.message ||
          "Failed to update fixed service.";
      })
      .addCase(deleteFixedService.pending, (state) => {
        state.mutating = true;
        state.error = null;
      })
      .addCase(deleteFixedService.fulfilled, (state, action) => {
        state.mutating = false;
        state.items = state.items.filter((item) => item.id !== action.payload);
        state.total = Math.max(0, state.total - 1);
        state.pagesCache = {};
      })
      .addCase(deleteFixedService.rejected, (state, action) => {
        state.mutating = false;
        state.error =
          action.payload ||
          action.error.message ||
          "Failed to delete fixed service.";
      });
  },
});

export const {
  setFixedServicesSearch,
  setFixedServicesPage,
  clearFixedServiceDetail,
  clearFixedServicesError,
} = fixedServicesSlice.actions;

export const selectFixedServicesShowLoader = (state: {
  fixedServices?: FixedServicesState;
}) => {
  const slice = state.fixedServices;
  if (!slice) return true;
  return slice.loading && slice.items.length === 0;
};

export default fixedServicesSlice.reducer;
