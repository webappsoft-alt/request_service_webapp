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

type CategoriesState = {
  parents: PublicCategory[];
  /** Subcategories keyed by parent category id */
  subcategoriesByParent: Record<string, PublicCategory[]>;
  loadingParents: boolean;
  loadingSubcategories: boolean;
  parentsLoaded: boolean;
  error: string | null;
};

const initialState: CategoriesState = {
  parents: [],
  subcategoriesByParent: {},
  loadingParents: false,
  loadingSubcategories: false,
  parentsLoaded: false,
  error: null,
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim());
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

export const fetchParentCategories = createAsyncThunk<
  PublicCategory[],
  void,
  { state: { categories: CategoriesState }; rejectValue: string }
>("categories/fetchParents", async (_arg, { getState, rejectWithValue }) => {
  const state = getState().categories;
  if (state.parentsLoaded && state.parents.length) {
    return state.parents;
  }
  try {
    const response = await getData(
      publicApi.categories,
      { page: 1, limit: 100, only_parent: true },
      { silent: true },
    );
    let items = extractCategoryList(response);
    // Fallback if backend returns an empty `only_parent` set but still has roots.
    if (!items.length) {
      const all = await getData(
        publicApi.categories,
        { page: 1, limit: 100 },
        { silent: true },
      );
      items = extractCategoryList(all).filter((item) => !item.parentCategory);
    }
    return items;
  } catch (error) {
    return rejectWithValue(extractErrorMessage(error));
  }
});

export const fetchSubcategories = createAsyncThunk<
  { parentId: string; items: PublicCategory[] },
  string,
  { state: { categories: CategoriesState }; rejectValue: string }
>("categories/fetchSubcategories", async (parentId, { rejectWithValue }) => {
  try {
    const response = await getData(
      publicApi.categories,
      { page: 1, limit: 100, parent_category_id: parentId },
      { silent: true },
    );
    return { parentId, items: extractCategoryList(response) };
  } catch (error) {
    return rejectWithValue(extractErrorMessage(error));
  }
}, {
  condition: (parentId, { getState }) => {
    if (!parentId) return false;
    // Only fetch once per parent until cache is invalidated.
    return !getState().categories.subcategoriesByParent[parentId];
  },
});

const categoriesSlice = createSlice({
  name: "categories",
  initialState,
  reducers: {
    clearCategoriesError(state) {
      state.error = null;
    },
    /** Allow re-fetch after admin catalog changes in the same session. */
    invalidateSubcategories(
      state,
      action: PayloadAction<string | undefined>,
    ) {
      if (action.payload) {
        delete state.subcategoriesByParent[action.payload];
      } else {
        state.subcategoriesByParent = {};
      }
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchParentCategories.pending, (state) => {
        if (!state.parents.length) state.loadingParents = true;
        state.error = null;
      })
      .addCase(fetchParentCategories.fulfilled, (state, action) => {
        state.loadingParents = false;
        state.parents = action.payload;
        state.parentsLoaded = true;
      })
      .addCase(fetchParentCategories.rejected, (state, action) => {
        state.loadingParents = false;
        state.error =
          action.payload ||
          action.error.message ||
          "Failed to load categories.";
      })
      .addCase(fetchSubcategories.pending, (state) => {
        state.loadingSubcategories = true;
        state.error = null;
      })
      .addCase(fetchSubcategories.fulfilled, (state, action) => {
        state.loadingSubcategories = false;
        state.subcategoriesByParent[action.payload.parentId] =
          action.payload.items;
      })
      .addCase(fetchSubcategories.rejected, (state, action) => {
        state.loadingSubcategories = false;
        state.error =
          action.payload ||
          action.error.message ||
          "Failed to load sub-categories.";
      });
  },
});

export const { clearCategoriesError, invalidateSubcategories } =
  categoriesSlice.actions;

export const selectParentCategories = (state: {
  categories?: CategoriesState;
}) => state.categories?.parents ?? [];

export const selectSubcategoriesForParent = (
  state: { categories?: CategoriesState },
  parentId: string,
) => state.categories?.subcategoriesByParent[parentId] ?? [];

export default categoriesSlice.reducer;
