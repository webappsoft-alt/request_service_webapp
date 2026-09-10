import {
  createAsyncThunk,
  createSlice,
  type PayloadAction,
} from "@reduxjs/toolkit";
import {
  extractErrorMessage,
  getData,
} from "@/components/api/apiFuntions";
import { publicApi } from "@/components/api/ApiRoutesFile";

export type PublicCategory = {
  id: string;
  name: string;
  slug: string;
  tagline?: string;
  parentCategory: string | null;
  status?: string;
  commonServices: string[];
  workingArea: string[];
  sortOrder?: number;
};

type SubMeta = {
  page: number;
  totalPages: number;
  hasMore: boolean;
};

type CategoriesState = {
  parents: PublicCategory[];
  /** Subcategories keyed by parent category id */
  subcategoriesByParent: Record<string, PublicCategory[]>;
  /** Pagination meta keyed by parent category id */
  subMetaByParent: Record<string, SubMeta>;
  loadingParents: boolean;
  loadingMoreParents: boolean;
  loadingSubcategories: boolean;
  loadingMoreSubcategories: boolean;
  parentsPage: number;
  parentsTotalPages: number;
  parentsHasMore: boolean;
  parentsLoaded: boolean;
  error: string | null;
};

const PARENTS_PAGE_SIZE = 10;
const SUBS_PAGE_SIZE = 10;

const initialState: CategoriesState = {
  parents: [],
  subcategoriesByParent: {},
  subMetaByParent: {},
  loadingParents: false,
  loadingMoreParents: false,
  loadingSubcategories: false,
  loadingMoreSubcategories: false,
  parentsPage: 0,
  parentsTotalPages: 1,
  parentsHasMore: true,
  parentsLoaded: false,
  error: null,
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item): item is string => typeof item === "string" && Boolean(item.trim()),
  );
}

function extractPagination(response: unknown): {
  page: number;
  totalPages: number;
  hasNextPage: boolean;
} {
  const root = asRecord(response) ?? {};
  const pagination = asRecord(root.pagination) ?? {};
  const page = Math.max(1, Number(pagination.page ?? 1) || 1);
  const limit = Math.max(1, Number(pagination.limit ?? PARENTS_PAGE_SIZE) || PARENTS_PAGE_SIZE);
  const total = Number(
    pagination.totalDocs ?? pagination.total ?? Number.NaN,
  );
  let totalPages = Math.max(1, Number(pagination.totalPages ?? 0) || 0);
  if (!totalPages && Number.isFinite(total)) {
    totalPages = Math.max(1, Math.ceil(total / limit));
  }
  if (!totalPages) totalPages = 1;

  const rawNext = pagination.hasNextPage;
  const hasNextPage =
    rawNext === true ||
    rawNext === "true" ||
    (rawNext !== false &&
      rawNext !== "false" &&
      page < totalPages);

  return { page, totalPages, hasNextPage };
}

export function normalizePublicCategory(raw: unknown): PublicCategory | null {
  const record = asRecord(raw);
  if (!record) return null;
  const id =
    (typeof record.id === "string" && record.id) ||
    (typeof record._id === "string" && record._id) ||
    "";
  if (!id) return null;

  const parentRaw = record.parentCategory;
  let parentCategory: string | null = null;
  if (typeof parentRaw === "string") parentCategory = parentRaw;
  else if (parentRaw && typeof parentRaw === "object") {
    const nested = parentRaw as Record<string, unknown>;
    parentCategory =
      (typeof nested._id === "string" && nested._id) ||
      (typeof nested.id === "string" && nested.id) ||
      null;
  }

  return {
    id,
    name: typeof record.name === "string" ? record.name : "",
    slug: typeof record.slug === "string" ? record.slug : "",
    tagline: typeof record.tagline === "string" ? record.tagline : undefined,
    parentCategory,
    status: typeof record.status === "string" ? record.status : undefined,
    commonServices: toStringArray(record.commonServices),
    workingArea: toStringArray(record.workingArea),
    sortOrder:
      typeof record.sortOrder === "number" ? record.sortOrder : undefined,
  };
}

function extractCategoryList(response: unknown): PublicCategory[] {
  const root = asRecord(response) ?? {};
  const list =
    (Array.isArray(root.data) && root.data) ||
    (Array.isArray(root.categories) && root.categories) ||
    (Array.isArray(response) && response) ||
    [];
  return list
    .map(normalizePublicCategory)
    .filter((item): item is PublicCategory => Boolean(item));
}

export type FetchParentsResult = {
  items: PublicCategory[];
  page: number;
  totalPages: number;
  hasMore: boolean;
  append: boolean;
};

export type FetchSubsArg = {
  parentId: string;
  append?: boolean;
};

export type FetchSubsResult = {
  parentId: string;
  items: PublicCategory[];
  page: number;
  totalPages: number;
  hasMore: boolean;
  append: boolean;
};

/**
 * Load parent categories page-by-page (infinite scroll).
 * Pass `{ append: true }` to fetch the next page and append.
 */
export const fetchParentCategories = createAsyncThunk<
  FetchParentsResult,
  { append?: boolean } | void,
  { state: { categories: CategoriesState }; rejectValue: string }
>(
  "categories/fetchParents",
  async (arg, { getState, rejectWithValue }) => {
    const append = Boolean(arg && typeof arg === "object" && arg.append);
    const state = getState().categories;

    if (!append && state.parentsLoaded && state.parents.length) {
      return {
        items: state.parents,
        page: state.parentsPage,
        totalPages: state.parentsTotalPages,
        hasMore: state.parentsHasMore,
        append: false,
      };
    }

    const nextPage = append ? state.parentsPage + 1 : 1;

    try {
      const response = await getData(
        publicApi.categories,
        {
          page: nextPage,
          limit: PARENTS_PAGE_SIZE,
          only_parent: true,
        },
        { silent: true },
      );

      let items = extractCategoryList(response).filter(
        (item) => !item.parentCategory,
      );
      let pagination = extractPagination(response);

      if (!append && !items.length) {
        const all = await getData(
          publicApi.categories,
          { page: nextPage, limit: PARENTS_PAGE_SIZE },
          { silent: true },
        );
        items = extractCategoryList(all).filter((item) => !item.parentCategory);
        pagination = extractPagination(all);
      }

      return {
        items,
        page: pagination.page,
        totalPages: pagination.totalPages,
        hasMore: pagination.hasNextPage,
        append,
      };
    } catch (error) {
      return rejectWithValue(extractErrorMessage(error));
    }
  },
  {
    condition: (arg, { getState }) => {
      const append = Boolean(arg && typeof arg === "object" && arg.append);
      const state = getState().categories;
      if (append) {
        if (state.loadingMoreParents || state.loadingParents) return false;
        if (!state.parentsHasMore) return false;
        if (state.parentsPage >= state.parentsTotalPages) return false;
        return true;
      }
      if (state.loadingParents) return false;
      return true;
    },
  },
);

/**
 * Load sub-categories for a parent, page-by-page.
 * Pass `{ append: true }` to fetch the next page and append.
 */
export const fetchSubcategories = createAsyncThunk<
  FetchSubsResult,
  FetchSubsArg,
  { state: { categories: CategoriesState }; rejectValue: string }
>(
  "categories/fetchSubcategories",
  async ({ parentId, append = false }, { getState, rejectWithValue }) => {
    const state = getState().categories;
    const meta = state.subMetaByParent[parentId];
    const cached = state.subcategoriesByParent[parentId];

    if (!append && cached && meta) {
      return {
        parentId,
        items: cached,
        page: meta.page,
        totalPages: meta.totalPages,
        hasMore: meta.hasMore,
        append: false,
      };
    }

    const nextPage = append ? (meta?.page ?? 0) + 1 : 1;

    try {
      const response = await getData(
        publicApi.categories,
        {
          page: nextPage,
          limit: SUBS_PAGE_SIZE,
          parent_category_id: parentId,
        },
        { silent: true },
      );

      const items = extractCategoryList(response);
      const pagination = extractPagination(response);

      return {
        parentId,
        items,
        page: pagination.page,
        totalPages: pagination.totalPages,
        hasMore: pagination.hasNextPage,
        append,
      };
    } catch (error) {
      return rejectWithValue(extractErrorMessage(error));
    }
  },
  {
    condition: ({ parentId, append = false }, { getState }) => {
      if (!parentId) return false;
      const state = getState().categories;
      if (append) {
        if (state.loadingMoreSubcategories || state.loadingSubcategories) {
          return false;
        }
        const meta = state.subMetaByParent[parentId];
        if (!meta?.hasMore) return false;
        if (meta.page >= meta.totalPages) return false;
        return true;
      }
      if (state.loadingSubcategories) return false;
      // Allow first load even if empty array was cached without meta
      if (
        state.subcategoriesByParent[parentId] &&
        state.subMetaByParent[parentId]
      ) {
        return true; // thunk returns cache
      }
      return true;
    },
  },
);

const categoriesSlice = createSlice({
  name: "categories",
  initialState,
  reducers: {
    clearCategoriesError(state) {
      state.error = null;
    },
    invalidateSubcategories(
      state,
      action: PayloadAction<string | undefined>,
    ) {
      if (action.payload) {
        delete state.subcategoriesByParent[action.payload];
        delete state.subMetaByParent[action.payload];
      } else {
        state.subcategoriesByParent = {};
        state.subMetaByParent = {};
      }
    },
    invalidateParentCategories(state) {
      state.parents = [];
      state.parentsPage = 0;
      state.parentsTotalPages = 1;
      state.parentsHasMore = true;
      state.parentsLoaded = false;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchParentCategories.pending, (state, action) => {
        const append = Boolean(
          action.meta.arg &&
            typeof action.meta.arg === "object" &&
            action.meta.arg.append,
        );
        if (append) state.loadingMoreParents = true;
        else if (!state.parents.length) state.loadingParents = true;
        state.error = null;
      })
      .addCase(fetchParentCategories.fulfilled, (state, action) => {
        state.loadingParents = false;
        state.loadingMoreParents = false;
        state.parentsPage = action.payload.page;
        state.parentsTotalPages = action.payload.totalPages;
        state.parentsHasMore = action.payload.hasMore;
        state.parentsLoaded = true;

        if (action.payload.append) {
          const seen = new Set(state.parents.map((item) => item.id));
          for (const item of action.payload.items) {
            if (!seen.has(item.id)) {
              state.parents.push(item);
              seen.add(item.id);
            }
          }
          return;
        }

        if (action.payload.items !== state.parents) {
          state.parents = action.payload.items;
        }
      })
      .addCase(fetchParentCategories.rejected, (state, action) => {
        state.loadingParents = false;
        state.loadingMoreParents = false;
        state.error =
          action.payload ||
          action.error.message ||
          "Failed to load categories.";
      })
      .addCase(fetchSubcategories.pending, (state, action) => {
        const append = Boolean(action.meta.arg?.append);
        if (append) state.loadingMoreSubcategories = true;
        else state.loadingSubcategories = true;
        state.error = null;
      })
      .addCase(fetchSubcategories.fulfilled, (state, action) => {
        state.loadingSubcategories = false;
        state.loadingMoreSubcategories = false;
        const { parentId, items, page, totalPages, hasMore, append } =
          action.payload;

        state.subMetaByParent[parentId] = { page, totalPages, hasMore };

        if (append) {
          const current = state.subcategoriesByParent[parentId] ?? [];
          const seen = new Set(current.map((item) => item.id));
          const next = [...current];
          for (const item of items) {
            if (!seen.has(item.id)) {
              next.push(item);
              seen.add(item.id);
            }
          }
          state.subcategoriesByParent[parentId] = next;
          return;
        }

        // Fresh page-1 (or cache return — skip same-ref overwrite)
        if (items !== state.subcategoriesByParent[parentId]) {
          state.subcategoriesByParent[parentId] = items;
        }
      })
      .addCase(fetchSubcategories.rejected, (state, action) => {
        state.loadingSubcategories = false;
        state.loadingMoreSubcategories = false;
        state.error =
          action.payload ||
          action.error.message ||
          "Failed to load sub-categories.";
      });
  },
});

export const {
  clearCategoriesError,
  invalidateSubcategories,
  invalidateParentCategories,
} = categoriesSlice.actions;

export const selectParentCategories = (state: {
  categories?: CategoriesState;
}) => state.categories?.parents ?? [];

export const selectSubcategoriesForParent = (
  state: { categories?: CategoriesState },
  parentId: string,
) => state.categories?.subcategoriesByParent[parentId] ?? [];

export default categoriesSlice.reducer;
