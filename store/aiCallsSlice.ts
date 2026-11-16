import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { extractErrorMessage } from "@/components/api/extractErrorMessage";
import {
  deleteAiCall,
  fetchAiCall,
  fetchAiCalls,
  type AiCallLog,
  type AiCallSummary,
} from "@/components/ai-calling/call-logs";

/**
 * AI receptionist call history cache (Call history table + call detail). Pages and calls are kept,
 * so coming back shows them straight away while a fresh copy loads in the background; the
 * skeleton only shows the first time. Cleared with the rest of the store on sign-out.
 */
export const AI_CALLS_PAGE_SIZE = 20;

type PageState = {
  items: AiCallSummary[];
  total: number;
  totalPages: number;
  loading: boolean;
  loaded: boolean;
  error: string | null;
};

type DetailState = {
  call: AiCallLog | null;
  loading: boolean;
  loaded: boolean;
  error: string | null;
};

export type AiCallsState = {
  /** By aiCallsPageKey(query): page + search + filter. */
  pages: Record<string, PageState>;
  details: Record<string, DetailState>;
  deletingId: string | null;
};

const initialState: AiCallsState = { pages: {}, details: {}, deletingId: null };

type RootLike = { aiCalls?: AiCallsState };

/** The table's query: page, search box and the type / outcome filter ("" = all). */
export type AiCallsQuery = {
  page: number;
  search?: string;
  channel?: string;
  outcome?: string;
};

export function aiCallsPageKey(query: AiCallsQuery) {
  return `${query.page}|${query.search?.trim().toLowerCase() || ""}|${query.channel || ""}|${query.outcome || ""}`;
}

/** One page of calls. Always refreshes (in the background when cached); one request per page at a time. */
export const fetchAiCallsPage = createAsyncThunk<
  { key: string; items: AiCallSummary[]; total: number; totalPages: number },
  AiCallsQuery,
  { state: RootLike; rejectValue: string }
>(
  "aiCalls/fetchPage",
  async (query, { rejectWithValue }) => {
    try {
      const result = await fetchAiCalls({
        page: query.page,
        limit: AI_CALLS_PAGE_SIZE,
        search: query.search,
        channel:
          query.channel === "phone" || query.channel === "browser_test"
            ? query.channel
            : "",
        outcome: query.outcome,
      });
      return {
        key: aiCallsPageKey(query),
        items: result?.data || [],
        total: result?.pagination?.total ?? 0,
        totalPages: Math.max(1, result?.pagination?.totalPages ?? 1),
      };
    } catch (error) {
      return rejectWithValue(extractErrorMessage(error));
    }
  },
  {
    condition: (query, { getState }) =>
      !getState().aiCalls?.pages[aiCallsPageKey(query)]?.loading,
  },
);

/** One call (detail page). Always refreshes (in the background when cached). */
export const fetchAiCallDetail = createAsyncThunk<
  AiCallLog,
  { id: string },
  { state: RootLike; rejectValue: string }
>(
  "aiCalls/fetchDetail",
  async ({ id }, { rejectWithValue }) => {
    try {
      return await fetchAiCall(id);
    } catch (error) {
      return rejectWithValue(extractErrorMessage(error));
    }
  },
  {
    condition: ({ id }, { getState }) =>
      !getState().aiCalls?.details[id]?.loading,
  },
);

/** Delete one call record; it leaves every cached page and its detail. */
export const removeAiCall = createAsyncThunk<
  string,
  { id: string },
  { rejectValue: string }
>("aiCalls/remove", async ({ id }, { rejectWithValue }) => {
  try {
    await deleteAiCall(id);
    return id;
  } catch (error) {
    return rejectWithValue(extractErrorMessage(error));
  }
});

function pageEntry(state: AiCallsState, page: string) {
  if (!state.pages[page])
    state.pages[page] = {
      items: [],
      total: 0,
      totalPages: 1,
      loading: false,
      loaded: false,
      error: null,
    };
  return state.pages[page];
}

function detailEntry(state: AiCallsState, id: string) {
  if (!state.details[id])
    state.details[id] = {
      call: null,
      loading: false,
      loaded: false,
      error: null,
    };
  return state.details[id];
}

const aiCallsSlice = createSlice({
  name: "aiCalls",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchAiCallsPage.pending, (state, action) => {
        const entry = pageEntry(state, aiCallsPageKey(action.meta.arg));
        entry.loading = true;
        entry.error = null;
      })
      .addCase(fetchAiCallsPage.fulfilled, (state, action) => {
        const entry = pageEntry(state, action.payload.key);
        Object.assign(entry, {
          items: action.payload.items,
          total: action.payload.total,
          totalPages: action.payload.totalPages,
          loading: false,
          loaded: true,
        });
      })
      .addCase(fetchAiCallsPage.rejected, (state, action) => {
        const entry = pageEntry(state, aiCallsPageKey(action.meta.arg));
        entry.loading = false;
        // A failed background refresh keeps the last rows.
        entry.error = action.payload || "Could not load call history.";
      })
      .addCase(fetchAiCallDetail.pending, (state, action) => {
        const entry = detailEntry(state, action.meta.arg.id);
        entry.loading = true;
        entry.error = null;
      })
      .addCase(fetchAiCallDetail.fulfilled, (state, action) => {
        const entry = detailEntry(state, action.meta.arg.id);
        Object.assign(entry, {
          call: action.payload,
          loading: false,
          loaded: true,
        });
      })
      .addCase(fetchAiCallDetail.rejected, (state, action) => {
        const entry = detailEntry(state, action.meta.arg.id);
        entry.loading = false;
        entry.error = action.payload || "This call could not be loaded.";
      })
      .addCase(removeAiCall.pending, (state, action) => {
        state.deletingId = action.meta.arg.id;
      })
      .addCase(removeAiCall.fulfilled, (state, action) => {
        state.deletingId = null;
        const id = action.payload;
        for (const entry of Object.values(state.pages)) {
          const before = entry.items.length;
          entry.items = entry.items.filter((call) => call.id !== id);
          if (entry.items.length !== before)
            entry.total = Math.max(0, entry.total - 1);
        }
        delete state.details[id];
      })
      .addCase(removeAiCall.rejected, (state) => {
        state.deletingId = null;
      });
  },
});

const EMPTY_PAGE: PageState = {
  items: [],
  total: 0,
  totalPages: 1,
  loading: false,
  loaded: false,
  error: null,
};
const EMPTY_DETAIL: DetailState = {
  call: null,
  loading: false,
  loaded: false,
  error: null,
};

export const selectAiCallsPage = (state: RootLike, query: AiCallsQuery) =>
  state.aiCalls?.pages[aiCallsPageKey(query)] ?? EMPTY_PAGE;
export const selectAiCallDetail = (state: RootLike, id: string) =>
  state.aiCalls?.details[id] ?? EMPTY_DETAIL;
export const selectAiCallDeletingId = (state: RootLike) =>
  state.aiCalls?.deletingId ?? null;

export default aiCallsSlice.reducer;
