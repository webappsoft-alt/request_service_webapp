import { createAsyncThunk, createSlice, type PayloadAction } from "@reduxjs/toolkit";
import { extractErrorMessage } from "@/components/api/extractErrorMessage";
import {
  approveContractorRequest,
  listContractorReviewRequests,
  rejectContractorRequest,
  type ContractorRequest,
  type Paginated,
  type PendingReviewCounts,
  type PendingReviewQuery,
  type ApproveRequestLine,
} from "@/lib/api/contractor-portal-client";

/**
 * Pro side of the contractor workflow: the "Pending reviews" queue
 * (completion proofs + change order requests) and its sidebar badge.
 */
export type ContractorReviewsState = {
  counts: PendingReviewCounts & { loaded: boolean };
  list: { key: string; data: Paginated<ContractorRequest> | null; loading: boolean; error: string | null };
  /** Request ids with an approve / reject in flight. */
  acting: Record<string, "approve" | "reject">;
  /** Bumped when the socket says the queue changed, so the open list refetches. */
  version: number;
};

const initialState: ContractorReviewsState = {
  counts: { completions: 0, changeOrders: 0, total: 0, loaded: false },
  list: { key: "", data: null, loading: false, error: null },
  acting: {},
  version: 0,
};

type RootLike = { contractorReviews: ContractorReviewsState };

function listKey(query: PendingReviewQuery) {
  return [query.page || 1, query.limit || 20, query.status || "pending_pro_approval", query.type || "", query.jobId || ""].join("|");
}

export const fetchContractorReviews = createAsyncThunk<
  { key: string; data: Paginated<ContractorRequest> },
  PendingReviewQuery & { force?: boolean },
  { state: RootLike; rejectValue: string }
>(
  "contractorReviews/list",
  async (query, { rejectWithValue }) => {
    try {
      return { key: listKey(query), data: await listContractorReviewRequests(query) };
    } catch (error) {
      return rejectWithValue(extractErrorMessage(error));
    }
  },
  {
    condition: (query, { getState }) => {
      const list = getState().contractorReviews?.list;
      return Boolean(query.force || !list || list.key !== listKey(query) || !list.data);
    },
  },
);

type ReviewArg = { request: ContractorRequest };

export const approveContractorReview = createAsyncThunk<
  ContractorRequest,
  ReviewArg & { note?: string; title?: string; amount?: number; items?: ApproveRequestLine[] },
  { rejectValue: string }
>("contractorReviews/approve", async ({ request, ...input }, { rejectWithValue }) => {
  try {
    return await approveContractorRequest(request.id, input);
  } catch (error) {
    return rejectWithValue(extractErrorMessage(error));
  }
});

export const rejectContractorReview = createAsyncThunk<
  ContractorRequest,
  ReviewArg & { reason: string },
  { rejectValue: string }
>("contractorReviews/reject", async ({ request, reason }, { rejectWithValue }) => {
  try {
    return await rejectContractorRequest(request.id, reason);
  } catch (error) {
    return rejectWithValue(extractErrorMessage(error));
  }
});

function countKey(request: ContractorRequest): "completions" | "changeOrders" {
  return request.type === "completion" ? "completions" : "changeOrders";
}

/** Optimistic: a decided request leaves the pending badge immediately. */
function adjustCounts(state: ContractorReviewsState, request: ContractorRequest, delta: number) {
  if (request.status !== "pending_pro_approval") return;
  const key = countKey(request);
  state.counts[key] = Math.max(0, state.counts[key] + delta);
  state.counts.total = Math.max(0, state.counts.total + delta);
}

function replaceRow(state: ContractorReviewsState, updated: ContractorRequest) {
  const items = state.list.data?.items;
  if (!items) return;
  const index = items.findIndex((row) => row.id === updated.id);
  if (index >= 0) items[index] = updated;
}

const contractorReviewsSlice = createSlice({
  name: "contractorReviews",
  initialState,
  reducers: {
    /** Socket `provider:inbox-counts` → `contractorReviews` (badge source of truth; no REST). */
    pendingReviewCountsReceived(state, action: PayloadAction<PendingReviewCounts>) {
      state.counts = { ...action.payload, loaded: true };
    },
    /** Socket `contractor:requests` — the queue changed; an open list refetches. */
    contractorRequestsChanged(state) {
      state.version += 1;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchContractorReviews.pending, (state, action) => {
        const key = listKey(action.meta.arg);
        if (state.list.key !== key) state.list.data = null;
        state.list.key = key;
        state.list.loading = true;
        state.list.error = null;
      })
      .addCase(fetchContractorReviews.fulfilled, (state, action) => {
        if (action.payload.key !== state.list.key) return;
        state.list.data = action.payload.data;
        state.list.loading = false;
      })
      .addCase(fetchContractorReviews.rejected, (state, action) => {
        state.list.loading = false;
        state.list.error = action.payload || "Could not load contractor submissions.";
      });

    for (const [thunk, kind] of [
      [approveContractorReview, "approve"],
      [rejectContractorReview, "reject"],
    ] as const) {
      builder
        .addCase(thunk.pending, (state, action) => {
          state.acting[action.meta.arg.request.id] = kind;
          adjustCounts(state, action.meta.arg.request, -1);
        })
        .addCase(thunk.fulfilled, (state, action) => {
          delete state.acting[action.meta.arg.request.id];
          replaceRow(state, action.payload);
        })
        .addCase(thunk.rejected, (state, action) => {
          delete state.acting[action.meta.arg.request.id];
          // Roll the badge back — the request is still pending on the server.
          adjustCounts(state, action.meta.arg.request, 1);
        });
    }
  },
});

export const { contractorRequestsChanged, pendingReviewCountsReceived } = contractorReviewsSlice.actions;

export function selectPendingReviewTotal(state: RootLike) {
  return state.contractorReviews?.counts?.total ?? 0;
}

export default contractorReviewsSlice.reducer;
