import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { extractErrorMessage } from "@/components/api/extractErrorMessage";
import { getRedesignCatalog, type RedesignCatalog } from "@/lib/api/ai-redesigner-client";

/**
 * AI Kitchen & Bath Redesigner catalog (styles + finishes), shared by the home page section
 * and the designer page: loaded once per visit, so moving between them is instant.
 */
type AiRedesignerState = {
  catalog: RedesignCatalog | null;
  loading: boolean;
  loaded: boolean;
  error: string | null;
};

const initialState: AiRedesignerState = { catalog: null, loading: false, loaded: false, error: null };

type RootLike = { aiRedesigner?: AiRedesignerState };

export const fetchRedesignCatalog = createAsyncThunk<
  RedesignCatalog,
  void,
  { state: RootLike; rejectValue: string }
>(
  "aiRedesigner/fetchCatalog",
  async (_, { rejectWithValue }) => {
    try {
      return await getRedesignCatalog();
    } catch (error) {
      return rejectWithValue(extractErrorMessage(error));
    }
  },
  {
    condition: (_, { getState }) => {
      const state = getState().aiRedesigner;
      return !state?.loading && !state?.loaded;
    },
  },
);

const aiRedesignerSlice = createSlice({
  name: "aiRedesigner",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchRedesignCatalog.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchRedesignCatalog.fulfilled, (state, action) => {
        state.catalog = action.payload;
        state.loading = false;
        state.loaded = true;
      })
      .addCase(fetchRedesignCatalog.rejected, (state, action) => {
        state.loading = false;
        state.loaded = true;
        state.error = action.payload || "Could not load the AI designer.";
      });
  },
});

export const selectRedesignCatalog = (state: RootLike) => state.aiRedesigner?.catalog ?? null;
export const selectRedesignCatalogStatus = (state: RootLike) => {
  const slice = state.aiRedesigner;
  if (!slice?.loaded) return "loading" as const;
  return slice.error ? ("failed" as const) : ("ready" as const);
};

export default aiRedesignerSlice.reducer;
