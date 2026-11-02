import { createAsyncThunk, createSlice, current, type PayloadAction } from "@reduxjs/toolkit";
import { extractErrorMessage } from "@/components/api/extractErrorMessage";
import {
  getPipelineBoard,
  getPipelineColumnPage,
  movePipelineCard,
  type PipelineBoard,
  type PipelineCard,
  type PipelineColumnPage,
  type PipelineMoveResult,
  type PipelineSchedule,
} from "@/lib/api/pipeline-client";

type PipelineState = {
  data: PipelineBoard | null;
  /** Only while there is no board to show yet (refreshes are silent). */
  loading: boolean;
  error: string | null;
  fetchedAt: number | null;
  /** Columns fetching their next page ("See more"). */
  loadingMore: string[];
  /** Moves / page loads in flight: a refresh landing now would undo them, so it waits. */
  pending: number;
  /** A refresh was skipped while something was in flight — run it once they finish. */
  refetchWanted: boolean;
  /** Board before each in-flight move (by request id), restored if the server refuses it. */
  rollback: Record<string, PipelineBoard>;
  /** Search last asked for (customer, EST-883, status…) — server-side, across every record. */
  search: string;
  /** Search the shown board answers (differs from `search` while a new one loads). */
  appliedSearch: string;
};

const initialState: PipelineState = {
  data: null,
  loading: false,
  error: null,
  fetchedAt: null,
  loadingMore: [],
  pending: 0,
  refetchWanted: false,
  rollback: {},
  search: "",
  appliedSearch: "",
};

type RootLike = { pipeline: PipelineState };

/* ───────────── Board helpers (pure; also used on Immer drafts) ───────────── */

const round = (value: number) => Math.round(value * 100) / 100;

/** Column totals follow their groups. */
function withTotals(board: PipelineBoard): PipelineBoard {
  return {
    ...board,
    columns: board.columns.map((column) => ({
      ...column,
      count: column.groups.reduce((sum, group) => sum + group.count, 0),
      value: round(column.groups.reduce((sum, group) => sum + group.value, 0)),
    })),
  };
}

/** Takes a card off the board (with its group's count / value); returns the card if found. */
function removeCard(board: PipelineBoard, key: string): [PipelineBoard, PipelineCard | null] {
  let found: PipelineCard | null = null;
  const columns = board.columns.map((column) => ({
    ...column,
    groups: column.groups.map((group) => {
      const card = group.cards.find((item) => item.key === key);
      if (!card) return group;
      found = card;
      return {
        ...group,
        count: Math.max(0, group.count - 1),
        value: round(Math.max(0, group.value - card.value)),
        cards: group.cards.filter((item) => item.key !== key),
      };
    }),
  }));
  return [found ? { ...board, columns } : board, found];
}

function insertCard(board: PipelineBoard, card: PipelineCard, index = 0): PipelineBoard {
  return {
    ...board,
    columns: board.columns.map((column) => ({
      ...column,
      groups: column.groups.map((group) => {
        if (group.id !== card.groupId) return group;
        const cards = [...group.cards];
        cards.splice(Math.min(Math.max(index, 0), cards.length), 0, card);
        return { ...group, count: group.count + 1, value: round(group.value + card.value), cards };
      }),
    })),
  };
}

function findCard(board: PipelineBoard, key: string) {
  for (const column of board.columns) {
    for (const group of column.groups) {
      const index = group.cards.findIndex((card) => card.key === key);
      if (index >= 0) return { card: group.cards[index], index };
    }
  }
  return null;
}

/**
 * A move's outcome (from our PATCH or another session's socket event). Idempotent: the card keeps
 * its spot when it is already where the server says, so the echo of our own move is a no-op.
 */
function settle(board: PipelineBoard, result: PipelineMoveResult): PipelineBoard {
  const card = result.card;
  const at = card ? findCard(board, card.key) : null;
  let next = board;
  for (const key of result.removed) {
    if (card && key === card.key) continue;
    next = removeCard(next, key)[0];
  }
  if (!card) return withTotals(next);
  const keepIndex = at && at.card.groupId === card.groupId ? at.index : 0;
  [next] = removeCard(next, card.key);
  return withTotals(insertCard(next, card, keepIndex));
}

/** "See more" on a column: each group gets its new cards appended and its current count / value. */
function appendPage(board: PipelineBoard, page: PipelineColumnPage): PipelineBoard {
  // Cards already on the board (moved here meanwhile) aren't added twice.
  const seen = new Set(board.columns.flatMap((column) => column.groups.flatMap((group) => group.cards.map((card) => card.key))));
  const updates = new Map(page.groups.map((group) => [group.id, group]));
  return withTotals({
    ...board,
    columns: board.columns.map((column) =>
      column.id !== page.id
        ? column
        : {
            ...column,
            groups: column.groups.map((group) => {
              const next = updates.get(group.id);
              if (!next) return group;
              return {
                ...group,
                count: next.count,
                value: next.value,
                cards: [...group.cards, ...next.cards.filter((card) => !seen.has(card.key))],
              };
            }),
          },
    ),
  });
}

/** How many cards each group shows now — a refresh reloads that many, not just the first page. */
function depthsOf(board: PipelineBoard | null) {
  const depths: Record<string, number> = {};
  for (const column of board?.columns ?? []) {
    for (const group of column.groups) depths[group.id] = group.cards.length;
  }
  return depths;
}

function findColumn(board: PipelineBoard | null, columnId: string) {
  return board?.columns.find((column) => column.id === columnId) ?? null;
}

/** Cards a column shows vs. holds in all. */
export function columnShown(column: PipelineBoard["columns"][number]) {
  return column.groups.reduce((sum, group) => sum + group.cards.length, 0);
}

/* ───────────────────────────── Thunks ───────────────────────────── */

/**
 * Loads the board; with cached data it refreshes silently, keeping each column's depth. A new
 * `search` starts the columns over at 10 matching cards each.
 */
export const fetchPipelineBoard = createAsyncThunk<
  { board: PipelineBoard; search: string },
  { force?: boolean; search?: string } | void,
  { state: RootLike; rejectValue: string }
>(
  "pipeline/fetch",
  async (params, { getState, rejectWithValue }) => {
    const state = getState().pipeline;
    const search = (params?.search ?? state.search).trim();
    try {
      const depths = search === state.appliedSearch ? depthsOf(state.data) : {};
      return { board: await getPipelineBoard(depths, search), search };
    } catch (error) {
      return rejectWithValue(extractErrorMessage(error));
    }
  },
  {
    condition: (params, { getState }) => {
      const state = getState().pipeline ?? initialState;
      if (state.loading) return false;
      if (params?.force) return true;
      return state.data == null;
    },
  },
);

export type MovePipelineCardArgs = {
  card: PipelineCard;
  toGroupId: string;
  index: number;
  schedule?: PipelineSchedule | null;
};

/** Moves a card: shown at once, confirmed by the server, rolled back if refused. */
export const movePipelineCardThunk = createAsyncThunk<PipelineMoveResult, MovePipelineCardArgs, { state: RootLike; rejectValue: string }>(
  "pipeline/move",
  async ({ card, toGroupId, schedule }, { rejectWithValue }) => {
    try {
      return await movePipelineCard(card, toGroupId, schedule);
    } catch (error) {
      return rejectWithValue(extractErrorMessage(error));
    }
  },
  { condition: (_args, { getState }) => getState().pipeline.data != null },
);

/** "See more": appends a column's next 10 cards (across its groups) in place. */
export const fetchPipelineColumnPage = createAsyncThunk<PipelineColumnPage, string, { state: RootLike; rejectValue: string }>(
  "pipeline/columnPage",
  async (columnId, { getState, rejectWithValue }) => {
    try {
      const column = findColumn(getState().pipeline.data, columnId);
      const loaded = Object.fromEntries((column?.groups ?? []).map((group) => [group.id, group.cards.length]));
      return await getPipelineColumnPage(columnId, loaded, getState().pipeline.appliedSearch);
    } catch (error) {
      return rejectWithValue(extractErrorMessage(error));
    }
  },
  {
    condition: (columnId, { getState }) => {
      const state = getState().pipeline;
      const column = findColumn(state.data, columnId);
      return Boolean(column && columnShown(column) < column.count && !state.loadingMore.includes(columnId));
    },
  },
);

/* ───────────────────────────── Slice ───────────────────────────── */

const pipelineSlice = createSlice({
  name: "pipeline",
  initialState,
  reducers: {
    /** Another session moved a card (PIPELINE_UPDATED). */
    pipelineCardSettled(state, action: PayloadAction<PipelineMoveResult>) {
      if (state.data) state.data = settle(current(state.data), action.payload);
    },
    /** A refresh is due but something is in flight — remember it. */
    pipelineRefetchWanted(state) {
      state.refetchWanted = true;
    },
    pipelineRefetchStarted(state) {
      state.refetchWanted = false;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchPipelineBoard.pending, (state, action) => {
        // Soft loading: only show loading when there is no cached board.
        state.loading = state.data == null;
        state.error = null;
        if (action.meta.arg?.search !== undefined) state.search = action.meta.arg.search.trim();
      })
      .addCase(fetchPipelineBoard.fulfilled, (state, action) => {
        state.loading = false;
        // An answer to an older search (typed over since) is dropped.
        if (action.payload.search !== state.search) return;
        // A move / page started while this was out: its result wins, refresh again after.
        if (state.pending > 0) {
          state.refetchWanted = true;
          return;
        }
        state.data = action.payload.board;
        state.appliedSearch = action.payload.search;
        state.fetchedAt = Date.now();
      })
      .addCase(fetchPipelineBoard.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload ?? "Failed to load the pipeline";
      })

      .addCase(movePipelineCardThunk.pending, (state, action) => {
        if (!state.data) return;
        const board = current(state.data);
        const { card, toGroupId, index } = action.meta.arg;
        state.pending += 1;
        state.rollback[action.meta.requestId] = board;
        const [without, found] = removeCard(board, card.key);
        if (found) state.data = withTotals(insertCard(without, { ...found, groupId: toGroupId }, index));
      })
      .addCase(movePipelineCardThunk.fulfilled, (state, action) => {
        state.pending = Math.max(0, state.pending - 1);
        delete state.rollback[action.meta.requestId];
        if (state.data) state.data = settle(current(state.data), action.payload);
      })
      .addCase(movePipelineCardThunk.rejected, (state, action) => {
        state.pending = Math.max(0, state.pending - 1);
        const before = state.rollback[action.meta.requestId];
        delete state.rollback[action.meta.requestId];
        if (before) state.data = before;
      })

      .addCase(fetchPipelineColumnPage.pending, (state, action) => {
        state.pending += 1;
        state.loadingMore.push(action.meta.arg);
      })
      .addCase(fetchPipelineColumnPage.fulfilled, (state, action) => {
        state.pending = Math.max(0, state.pending - 1);
        state.loadingMore = state.loadingMore.filter((id) => id !== action.meta.arg);
        if (state.data) state.data = appendPage(current(state.data), action.payload);
      })
      .addCase(fetchPipelineColumnPage.rejected, (state, action) => {
        state.pending = Math.max(0, state.pending - 1);
        state.loadingMore = state.loadingMore.filter((id) => id !== action.meta.arg);
      });
  },
});

export const { pipelineCardSettled, pipelineRefetchWanted, pipelineRefetchStarted } = pipelineSlice.actions;

export const selectPipeline = (state: RootLike) => state.pipeline;

export default pipelineSlice.reducer;
