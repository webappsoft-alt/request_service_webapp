import {
  createAsyncThunk,
  createSlice,
  type PayloadAction,
} from "@reduxjs/toolkit";
import {
  deleteData,
  extractErrorMessage,
  getData,
  patchData,
  postData,
  putData,
} from "@/components/api/apiFuntions";
import { providerApi } from "@/components/api/ApiRoutesFile";

export type PortfolioMediaType = "image" | "video";

export type PortfolioMedia = {
  url: string;
  type: PortfolioMediaType;
  caption: string;
  isBefore: boolean;
  isAfter: boolean;
  isCover: boolean;
};

export type PortfolioStatus = "ACTIVE" | "HIDDEN" | "ARCHIVED";

export type PortfolioLinkedService = {
  id: string;
  name: string;
};

export type PortfolioProject = {
  id: string;
  slug: string;
  title: string;
  description: string;
  media: PortfolioMedia[];
  fixedServiceIds: string[];
  linkedServices: PortfolioLinkedService[];
  categoryId: string;
  categoryName: string;
  tags: string[];
  projectDate: string;
  duration: string;
  cost: number;
  isFeatured: boolean;
  status: PortfolioStatus;
  createdAt?: string;
  updatedAt?: string;
};

export type PortfolioMediaInput = {
  url: string;
  type?: PortfolioMediaType;
  caption?: string;
  isBefore?: boolean;
  isAfter?: boolean;
  isCover?: boolean;
};

export type PortfolioInput = {
  title: string;
  description: string;
  media: PortfolioMediaInput[];
  fixedServiceIds?: string[];
  category?: string;
  tags?: string[];
  projectDate?: string;
  duration?: string;
  cost?: number;
  isFeatured?: boolean;
  status?: "ACTIVE" | "HIDDEN" | "ARCHIVED";
};

type PaginationMeta = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

type PortfolioState = {
  items: PortfolioProject[];
  pagesCache: Record<string, PortfolioProject[]>;
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  search: string;
  loading: boolean;
  mutating: boolean;
  detail: PortfolioProject | null;
  detailLoading: boolean;
  error: string | null;
};

const DEFAULT_LIMIT = 10;

const initialState: PortfolioState = {
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

function idOf(value: unknown): string {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  const record = asRecord(value);
  if (!record) return "";
  if (typeof record.$oid === "string" && record.$oid.trim()) return record.$oid.trim();
  for (const key of ["_id", "id", "Id", "ID"] as const) {
    const raw = record[key];
    if (typeof raw === "string" && raw.trim()) return raw.trim();
    if (typeof raw === "number" && Number.isFinite(raw)) return String(raw);
    const nested = asRecord(raw);
    if (nested && typeof nested.$oid === "string" && nested.$oid.trim()) {
      return nested.$oid.trim();
    }
  }
  return "";
}

function nameOf(value: unknown, fallback = ""): string {
  if (typeof value === "string" && value.trim()) {
    if (/^[a-f\d]{24}$/i.test(value.trim())) return fallback;
    return value.trim();
  }
  const record = asRecord(value);
  if (record && typeof record.name === "string") return record.name;
  if (record && typeof record.servicesName === "string") return record.servicesName;
  if (record && typeof record.title === "string") return record.title;
  return fallback;
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (typeof item === "string") return item.trim();
      return nameOf(item) || idOf(item);
    })
    .filter(Boolean);
}

function normalizeMedia(raw: unknown): PortfolioMedia | null {
  if (typeof raw === "string" && raw.trim()) {
    return {
      url: raw.trim(),
      type: "image",
      caption: "",
      isBefore: false,
      isAfter: false,
      isCover: false,
    };
  }
  const record = asRecord(raw);
  if (!record) return null;
  const url =
    (typeof record.url === "string" && record.url.trim()) ||
    (typeof record.image === "string" && record.image.trim()) ||
    (typeof record.src === "string" && record.src.trim()) ||
    "";
  if (!url) return null;
  const typeRaw = String(record.type || "image").toLowerCase();
  return {
    url,
    type: typeRaw === "video" ? "video" : "image",
    caption: typeof record.caption === "string" ? record.caption : "",
    isBefore: Boolean(record.isBefore),
    isAfter: Boolean(record.isAfter),
    isCover: Boolean(record.isCover),
  };
}

function normalizeStatus(value: unknown): PortfolioStatus {
  const raw = String(value || "ACTIVE").toUpperCase();
  if (raw === "HIDDEN") return "HIDDEN";
  if (raw === "ARCHIVED") return "ARCHIVED";
  return "ACTIVE";
}

function normalizeLinkedService(raw: unknown): PortfolioLinkedService | null {
  const id = idOf(raw);
  if (!id) return null;
  return {
    id,
    name:
      nameOf(raw) ||
      (asRecord(raw)?.servicesName as string) ||
      "Fixed service",
  };
}

export function normalizePortfolioProject(raw: unknown): PortfolioProject | null {
  const record = asRecord(raw);
  if (!record) return null;
  const id = idOf(record);
  if (!id) return null;

  const categoryRef = record.category;
  const categoryId = idOf(categoryRef);
  const categoryName =
    nameOf(categoryRef) ||
    (typeof record.categoryName === "string" ? record.categoryName : "");

  const mediaRaw = Array.isArray(record.media)
    ? record.media
    : Array.isArray(record.images)
      ? record.images
      : [];
  const media = mediaRaw
    .map(normalizeMedia)
    .filter((item): item is PortfolioMedia => Boolean(item));
  if (media.length && !media.some((item) => item.isCover)) {
    media[0] = { ...media[0], isCover: true };
  }

  const linkedFromPopulate = Array.isArray(record.fixedServices)
    ? record.fixedServices
    : Array.isArray(record.fixedServiceIds)
      ? record.fixedServiceIds
      : [];
  const linkedServices = linkedFromPopulate
    .map(normalizeLinkedService)
    .filter((item): item is PortfolioLinkedService => Boolean(item));
  const fixedServiceIds = linkedServices.length
    ? linkedServices.map((item) => item.id)
    : Array.isArray(record.fixedServiceIds)
      ? record.fixedServiceIds.map(idOf).filter(Boolean)
      : [];

  return {
    id,
    slug:
      typeof record.slug === "string" && record.slug.trim()
        ? record.slug.trim()
        : id,
    title: typeof record.title === "string" ? record.title : "",
    description: typeof record.description === "string" ? record.description : "",
    media,
    fixedServiceIds,
    linkedServices,
    categoryId,
    categoryName,
    tags: toStringArray(record.tags),
    projectDate:
      typeof record.projectDate === "string"
        ? record.projectDate
        : record.projectDate
          ? String(record.projectDate)
          : "",
    duration: typeof record.duration === "string" ? record.duration : "",
    cost:
      typeof record.cost === "number"
        ? record.cost
        : Number(record.cost) || 0,
    isFeatured: Boolean(record.isFeatured),
    status: normalizeStatus(record.status),
    createdAt: typeof record.createdAt === "string" ? record.createdAt : undefined,
    updatedAt: typeof record.updatedAt === "string" ? record.updatedAt : undefined,
  };
}

function extractList(response: unknown): {
  items: PortfolioProject[];
  pagination: PaginationMeta;
} {
  const root = asRecord(response) ?? {};
  const nested = asRecord(root.data);
  const list =
    (Array.isArray(root.data) && root.data) ||
    (nested && Array.isArray(nested.data) && nested.data) ||
    (Array.isArray(root.portfolio) && root.portfolio) ||
    (Array.isArray(root.projects) && root.projects) ||
    (Array.isArray(response) && response) ||
    [];
  const items = list
    .map(normalizePortfolioProject)
    .filter((item): item is PortfolioProject => Boolean(item));

  const paginationRaw =
    asRecord(root.pagination) ||
    (nested ? asRecord(nested.pagination) : null) ||
    {};
  const page = Math.max(
    1,
    Number(paginationRaw.page ?? paginationRaw.currentPage) || 1,
  );
  const limit = Math.max(1, Number(paginationRaw.limit) || DEFAULT_LIMIT);
  const total = Math.max(
    0,
    Number(
      paginationRaw.total ??
        paginationRaw.totalRecords ??
        paginationRaw.totalDocs ??
        items.length,
    ) || 0,
  );
  const totalPages = Math.max(
    1,
    Number(paginationRaw.totalPages) || Math.max(1, Math.ceil(total / limit) || 1),
  );

  return { items, pagination: { page, limit, total, totalPages } };
}

function extractEntity(response: unknown): PortfolioProject | null {
  const root = asRecord(response);
  if (!root) return normalizePortfolioProject(response);
  const data = root.data;
  const dataRecord = asRecord(data);
  return (
    normalizePortfolioProject(data) ||
    (Array.isArray(data) ? normalizePortfolioProject(data[0]) : null) ||
    (dataRecord ? normalizePortfolioProject(dataRecord.portfolio) : null) ||
    (dataRecord ? normalizePortfolioProject(dataRecord.project) : null) ||
    (dataRecord ? normalizePortfolioProject(dataRecord.result) : null) ||
    (dataRecord ? normalizePortfolioProject(dataRecord.item) : null) ||
    normalizePortfolioProject(root.portfolio) ||
    normalizePortfolioProject(root.project) ||
    normalizePortfolioProject(root)
  );
}

export function portfolioPageCacheKey(search: string, page: number, limit: number) {
  return `${search.trim()}|${page}|${limit}`;
}

export function portfolioCoverUrl(project: PortfolioProject): string | undefined {
  const cover = project.media.find((item) => item.isCover && item.url);
  return cover?.url || project.media[0]?.url;
}

export const fetchPortfolios = createAsyncThunk<
  {
    items: PortfolioProject[];
    pagination: PaginationMeta;
    search: string;
  },
  { page?: number; limit?: number; search?: string } | void,
  { state: { portfolio: PortfolioState }; rejectValue: string }
>("portfolio/fetchList", async (params, { getState, rejectWithValue }) => {
  const state = getState().portfolio;
  const page = params?.page ?? state.page;
  const limit = params?.limit ?? state.limit;
  const search = params?.search ?? state.search;
  try {
    const query: Record<string, string | number> = { page, limit };
    if (search.trim()) query.search = search.trim();
    const response = await getData(providerApi.portfolio, query, { silent: true });
    const parsed = extractList(response);
    return {
      items: parsed.items,
      pagination: {
        ...parsed.pagination,
        // Prefer the page/limit we requested so cache keys stay correct.
        page,
        limit,
      },
      search,
    };
  } catch (error) {
    return rejectWithValue(extractErrorMessage(error));
  }
});

export const fetchPortfolioById = createAsyncThunk<
  PortfolioProject,
  string,
  { rejectValue: string }
>("portfolio/fetchById", async (id, { rejectWithValue }) => {
  try {
    const response = await getData(providerApi.portfolioItem(id), undefined, {
      silent: true,
    });
    const entity = extractEntity(response);
    if (!entity) return rejectWithValue("Portfolio project not found.");
    return entity;
  } catch (error) {
    return rejectWithValue(extractErrorMessage(error));
  }
});

export const createPortfolio = createAsyncThunk<
  PortfolioProject,
  PortfolioInput,
  { rejectValue: string }
>("portfolio/create", async (payload, { rejectWithValue }) => {
  try {
    const response = await postData(providerApi.portfolio, payload, {
      silent: true,
    });
    const entity = extractEntity(response);
    if (!entity) {
      return rejectWithValue("Project was created but could not be read.");
    }
    return entity;
  } catch (error) {
    return rejectWithValue(extractErrorMessage(error));
  }
});

export const updatePortfolio = createAsyncThunk<
  PortfolioProject,
  { id: string } & PortfolioInput,
  { rejectValue: string }
>("portfolio/update", async ({ id, ...payload }, { rejectWithValue }) => {
  try {
    const response = await putData(providerApi.portfolioItem(id), payload, {
      silent: true,
    });
    const entity = extractEntity(response);
    if (!entity) {
      return {
        id,
        slug: id,
        title: payload.title,
        description: payload.description,
        media: (payload.media || []).map((item, index) => ({
          url: item.url,
          type: item.type || "image",
          caption: item.caption || "",
          isBefore: Boolean(item.isBefore),
          isAfter: Boolean(item.isAfter),
          isCover: item.isCover ?? index === 0,
        })),
        fixedServiceIds: payload.fixedServiceIds || [],
        linkedServices: [],
        categoryId: payload.category || "",
        categoryName: "",
        tags: payload.tags || [],
        projectDate: payload.projectDate || "",
        duration: payload.duration || "",
        cost: payload.cost || 0,
        isFeatured: Boolean(payload.isFeatured),
        status: (payload.status as PortfolioStatus) || "ACTIVE",
      };
    }
    return entity;
  } catch (error) {
    return rejectWithValue(extractErrorMessage(error));
  }
});

export const deletePortfolio = createAsyncThunk<
  string,
  string,
  { rejectValue: string }
>("portfolio/delete", async (id, { rejectWithValue }) => {
  try {
    await deleteData(providerApi.portfolioItem(id), { silent: true });
    return id;
  } catch (error) {
    return rejectWithValue(extractErrorMessage(error));
  }
});

export const togglePortfolioFeature = createAsyncThunk<
  PortfolioProject,
  string,
  { rejectValue: string }
>("portfolio/toggleFeature", async (id, { rejectWithValue }) => {
  try {
    const response = await patchData(
      providerApi.portfolioFeature(id),
      undefined,
      { silent: true },
    );
    const entity = extractEntity(response);
    if (!entity) {
      return rejectWithValue("Could not update featured status.");
    }
    return entity;
  } catch (error) {
    return rejectWithValue(extractErrorMessage(error));
  }
});

const portfolioSlice = createSlice({
  name: "portfolio",
  initialState,
  reducers: {
    setPortfolioSearch(state, action: PayloadAction<string>) {
      state.search = action.payload;
      state.page = 1;
      state.pagesCache = {};
    },
    setPortfolioPage(state, action: PayloadAction<number>) {
      state.page = Math.max(1, action.payload);
      const key = portfolioPageCacheKey(state.search, state.page, state.limit);
      if (key in state.pagesCache) {
        state.items = state.pagesCache[key];
      }
    },
    clearPortfolioDetail(state) {
      state.detail = null;
    },
    clearPortfolioError(state) {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchPortfolios.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchPortfolios.fulfilled, (state, action) => {
        // Drop stale responses if the user already moved to another page/search.
        if (
          action.payload.pagination.page !== state.page ||
          action.payload.search !== state.search
        ) {
          return;
        }
        state.loading = false;
        state.items = action.payload.items;
        state.page = action.payload.pagination.page;
        state.limit = action.payload.pagination.limit;
        state.total = action.payload.pagination.total;
        state.totalPages = Math.max(1, action.payload.pagination.totalPages);
        state.search = action.payload.search;
        const key = portfolioPageCacheKey(
          state.search,
          state.page,
          state.limit,
        );
        state.pagesCache[key] = action.payload.items;
      })
      .addCase(fetchPortfolios.rejected, (state, action) => {
        state.loading = false;
        state.error =
          action.payload ||
          action.error.message ||
          "Failed to load portfolio projects.";
      })
      .addCase(fetchPortfolioById.pending, (state) => {
        state.detailLoading = true;
        state.error = null;
      })
      .addCase(fetchPortfolioById.fulfilled, (state, action) => {
        state.detailLoading = false;
        state.detail = action.payload;
      })
      .addCase(fetchPortfolioById.rejected, (state, action) => {
        state.detailLoading = false;
        state.error =
          action.payload ||
          action.error.message ||
          "Failed to load portfolio project.";
      })
      .addCase(createPortfolio.pending, (state) => {
        state.mutating = true;
        state.error = null;
      })
      .addCase(createPortfolio.fulfilled, (state) => {
        state.mutating = false;
        state.pagesCache = {};
      })
      .addCase(createPortfolio.rejected, (state, action) => {
        state.mutating = false;
        state.error =
          action.payload ||
          action.error.message ||
          "Failed to create portfolio project.";
      })
      .addCase(updatePortfolio.pending, (state) => {
        state.mutating = true;
        state.error = null;
      })
      .addCase(updatePortfolio.fulfilled, (state, action) => {
        state.mutating = false;
        state.detail = action.payload;
        const index = state.items.findIndex((item) => item.id === action.payload.id);
        if (index >= 0) state.items[index] = action.payload;
        state.pagesCache = {};
      })
      .addCase(updatePortfolio.rejected, (state, action) => {
        state.mutating = false;
        state.error =
          action.payload ||
          action.error.message ||
          "Failed to update portfolio project.";
      })
      .addCase(deletePortfolio.pending, (state) => {
        state.mutating = true;
        state.error = null;
      })
      .addCase(deletePortfolio.fulfilled, (state, action) => {
        state.mutating = false;
        state.items = state.items.filter((item) => item.id !== action.payload);
        state.total = Math.max(0, state.total - 1);
        state.pagesCache = {};
        if (state.detail?.id === action.payload) state.detail = null;
      })
      .addCase(deletePortfolio.rejected, (state, action) => {
        state.mutating = false;
        state.error =
          action.payload ||
          action.error.message ||
          "Failed to delete portfolio project.";
      })
      .addCase(togglePortfolioFeature.pending, (state) => {
        state.mutating = true;
        state.error = null;
      })
      .addCase(togglePortfolioFeature.fulfilled, (state, action) => {
        state.mutating = false;
        const index = state.items.findIndex((item) => item.id === action.payload.id);
        if (index >= 0) state.items[index] = action.payload;
        if (state.detail?.id === action.payload.id) state.detail = action.payload;
        state.pagesCache = {};
      })
      .addCase(togglePortfolioFeature.rejected, (state, action) => {
        state.mutating = false;
        state.error =
          action.payload ||
          action.error.message ||
          "Failed to update featured status.";
      });
  },
});

export const {
  setPortfolioSearch,
  setPortfolioPage,
  clearPortfolioDetail,
  clearPortfolioError,
} = portfolioSlice.actions;

export default portfolioSlice.reducer;
