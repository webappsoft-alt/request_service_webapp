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
import { providerCrmApi } from "@/components/api/ApiRoutesFile";

export type CustomerNoteAttachment = {
  url: string;
  filename: string;
  fileType: string;
  sizeBytes: number;
};

/** Normalized customer note for the Customer → Notes UI. */
export type CustomerNote = {
  id: string;
  entityType: string;
  entityId: string;
  title: string;
  content: string;
  tags: string[];
  isPinned: boolean;
  color: string | null;
  attachments: CustomerNoteAttachment[];
  authorId: string;
  authorName: string;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
};

export type CustomerNoteCreateInput = {
  entityId: string;
  title?: string;
  content: string;
  tags?: string[];
  isPinned?: boolean;
  color?: string | null;
  attachments?: CustomerNoteAttachment[];
};

export type CustomerNoteUpdateInput = {
  title?: string;
  content?: string;
  tags?: string[];
  isPinned?: boolean;
  color?: string | null;
  attachments?: CustomerNoteAttachment[];
};

type PaginationMeta = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

type CustomerNotesState = {
  entityId: string;
  items: CustomerNote[];
  pagesCache: Record<string, CustomerNote[]>;
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  search: string;
  loading: boolean;
  mutating: boolean;
  error: string | null;
};

const DEFAULT_LIMIT = 10;
const ENTITY_TYPE = "Customer";

const initialState: CustomerNotesState = {
  entityId: "",
  items: [],
  pagesCache: {},
  page: 1,
  limit: DEFAULT_LIMIT,
  total: 0,
  totalPages: 1,
  search: "",
  loading: false,
  mutating: false,
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
  for (const key of ["_id", "id"] as const) {
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

function stringValue(value: unknown, fallback = ""): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return fallback;
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => stringValue(item).trim())
    .filter(Boolean);
}

function normalizeAttachment(raw: unknown): CustomerNoteAttachment | null {
  const record = asRecord(raw);
  if (!record) return null;
  const url = stringValue(record.url);
  if (!url) return null;
  return {
    url,
    filename: stringValue(record.filename),
    fileType: stringValue(record.fileType),
    sizeBytes: Number(record.sizeBytes) || 0,
  };
}

export function normalizeCustomerNote(raw: unknown): CustomerNote | null {
  const record = asRecord(raw);
  if (!record) return null;
  const id = idOf(record);
  if (!id) return null;

  return {
    id,
    entityType: stringValue(record.entityType, ENTITY_TYPE),
    entityId: idOf(record.entityId) || stringValue(record.entityId),
    title: stringValue(record.title),
    content: stringValue(record.content),
    tags: toStringArray(record.tags),
    isPinned: Boolean(record.isPinned),
    color:
      typeof record.color === "string" && record.color.trim()
        ? record.color.trim()
        : null,
    attachments: Array.isArray(record.attachments)
      ? record.attachments
          .map(normalizeAttachment)
          .filter((item): item is CustomerNoteAttachment => Boolean(item))
      : [],
    authorId: idOf(record.authorId) || stringValue(record.authorId),
    authorName: stringValue(record.authorName) || "Office",
    isDeleted: Boolean(record.isDeleted),
    createdAt: stringValue(record.createdAt) || stringValue(record.updatedAt),
    updatedAt: stringValue(record.updatedAt) || stringValue(record.createdAt),
  };
}

function extractList(response: unknown): {
  items: CustomerNote[];
  pagination: PaginationMeta;
} {
  const root = asRecord(response) ?? {};
  const list =
    (Array.isArray(root.data) && root.data) ||
    (Array.isArray(response) && response) ||
    [];
  const items = list
    .map(normalizeCustomerNote)
    .filter((item): item is CustomerNote => Boolean(item));

  const paginationRaw = asRecord(root.pagination) || {};
  const page = Math.max(1, Number(paginationRaw.page) || 1);
  const limit = Math.max(1, Number(paginationRaw.limit) || DEFAULT_LIMIT);
  const total = Math.max(
    0,
    Number(paginationRaw.total ?? paginationRaw.totalDocs ?? items.length) || 0,
  );
  const totalPages = Math.max(
    1,
    Number(paginationRaw.pages ?? paginationRaw.totalPages) ||
      Math.max(1, Math.ceil(total / limit) || 1),
  );

  return { items, pagination: { page, limit, total, totalPages } };
}

function extractEntity(response: unknown): CustomerNote | null {
  const root = asRecord(response);
  if (!root) return normalizeCustomerNote(response);
  const data = root.data;
  if (Array.isArray(data)) return normalizeCustomerNote(data[0]);
  return (
    normalizeCustomerNote(data) ||
    normalizeCustomerNote(root.note) ||
    normalizeCustomerNote(root)
  );
}

export function customerNotesPageCacheKey(
  entityId: string,
  search: string,
  page: number,
  limit: number,
) {
  return `${entityId}|${search.trim()}|${page}|${limit}`;
}

export type FetchCustomerNotesArg = {
  entityId?: string;
  page?: number;
  limit?: number;
  search?: string;
  /** Bypass pagesCache and always hit the API. */
  force?: boolean;
};

export const fetchCustomerNotes = createAsyncThunk<
  {
    items: CustomerNote[];
    pagination: PaginationMeta;
    entityId: string;
    search: string;
  },
  FetchCustomerNotesArg | void,
  { state: { customerNotes: CustomerNotesState }; rejectValue: string }
>("customerNotes/fetchList", async (params, { getState, rejectWithValue }) => {
  const state = getState().customerNotes;
  const entityId = String(params?.entityId || state.entityId || "").trim();
  if (!entityId) {
    return rejectWithValue("Customer id is required to load notes.");
  }
  const page = params?.page ?? state.page;
  const limit = params?.limit ?? state.limit;
  const search = params?.search ?? state.search;

  try {
    const query: Record<string, string | number | boolean> = {
      entityType: ENTITY_TYPE,
      entityId,
      page,
      limit,
    };
    if (search.trim()) query.search = search.trim();

    const response = await getData(providerCrmApi.notes, query, {
      silent: true,
    });
    const parsed = extractList(response);
    return {
      items: parsed.items,
      pagination: parsed.pagination,
      entityId,
      search,
    };
  } catch (error) {
    return rejectWithValue(extractErrorMessage(error));
  }
});

function sortCustomerNotes(items: CustomerNote[]) {
  return [...items].sort((a, b) => {
    if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
    return b.createdAt.localeCompare(a.createdAt);
  });
}

function replaceNoteById(items: CustomerNote[], updated: CustomerNote) {
  const index = items.findIndex((item) => item.id === updated.id);
  if (index < 0) return items;
  const next = [...items];
  next[index] = updated;
  return sortCustomerNotes(next);
}

export const createCustomerNote = createAsyncThunk<
  CustomerNote,
  CustomerNoteCreateInput,
  { rejectValue: string }
>("customerNotes/create", async (payload, { rejectWithValue }) => {
  try {
    const response = await postData(
      providerCrmApi.notes,
      {
        entityType: ENTITY_TYPE,
        entityId: payload.entityId,
        title: payload.title ?? "",
        content: payload.content,
        tags: payload.tags ?? [],
        isPinned: payload.isPinned ?? false,
        color: payload.color ?? null,
        attachments: payload.attachments ?? [],
      },
      { silent: true },
    );
    const entity = extractEntity(response);
    if (!entity) {
      return rejectWithValue("Note was created but could not be read.");
    }
    return entity;
  } catch (error) {
    return rejectWithValue(extractErrorMessage(error));
  }
});

export const updateCustomerNote = createAsyncThunk<
  CustomerNote,
  { id: string } & CustomerNoteUpdateInput,
  { rejectValue: string }
>("customerNotes/update", async ({ id, ...payload }, { rejectWithValue }) => {
  try {
    const body: Record<string, unknown> = {};
    if (payload.title !== undefined) body.title = payload.title;
    if (payload.content !== undefined) body.content = payload.content;
    if (payload.tags !== undefined) body.tags = payload.tags;
    if (payload.isPinned !== undefined) body.isPinned = payload.isPinned;
    if (payload.color !== undefined) body.color = payload.color;
    if (payload.attachments !== undefined) body.attachments = payload.attachments;

    // Prefer PATCH for single-field pin toggles; PUT for full edits.
    const response =
      payload.isPinned !== undefined && Object.keys(body).length === 1
        ? await patchData(providerCrmApi.note(id), body, { silent: true })
        : await putData(providerCrmApi.note(id), body, { silent: true });

    const entity = extractEntity(response);
    if (!entity) {
      return rejectWithValue("Note was updated but could not be read.");
    }
    return entity;
  } catch (error) {
    return rejectWithValue(extractErrorMessage(error));
  }
});

export const deleteCustomerNote = createAsyncThunk<
  string,
  string,
  { rejectValue: string }
>("customerNotes/delete", async (id, { rejectWithValue }) => {
  try {
    await deleteData(providerCrmApi.note(id), { silent: true });
    return id;
  } catch (error) {
    return rejectWithValue(extractErrorMessage(error));
  }
});

const customerNotesSlice = createSlice({
  name: "customerNotes",
  initialState,
  reducers: {
    setCustomerNotesEntity(state, action: PayloadAction<string>) {
      const nextId = String(action.payload || "").trim();
      if (nextId === state.entityId) return;
      state.entityId = nextId;
      state.items = [];
      state.pagesCache = {};
      state.page = 1;
      state.total = 0;
      state.totalPages = 1;
      state.search = "";
      state.error = null;
    },
    setCustomerNotesSearch(state, action: PayloadAction<string>) {
      state.search = action.payload;
      state.page = 1;
      state.pagesCache = {};
    },
    setCustomerNotesPage(state, action: PayloadAction<number>) {
      state.page = Math.max(1, action.payload);
      const key = customerNotesPageCacheKey(
        state.entityId,
        state.search,
        state.page,
        state.limit,
      );
      if (key in state.pagesCache) {
        state.items = state.pagesCache[key];
      }
    },
    invalidateCustomerNotesCache(state) {
      state.pagesCache = {};
    },
    clearCustomerNotesError(state) {
      state.error = null;
    },
    /** Instant pin/unpin in the list before the API responds. */
    optimisticToggleNotePin(
      state,
      action: PayloadAction<{ id: string; isPinned: boolean }>,
    ) {
      const index = state.items.findIndex(
        (item) => item.id === action.payload.id,
      );
      if (index < 0) return;
      state.items[index] = {
        ...state.items[index],
        isPinned: action.payload.isPinned,
      };
      state.items = sortCustomerNotes(state.items);
      const key = customerNotesPageCacheKey(
        state.entityId,
        state.search,
        state.page,
        state.limit,
      );
      state.pagesCache[key] = state.items;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchCustomerNotes.pending, (state) => {
        // Keep existing rows visible — only block UI when there is nothing to show yet.
        if (state.items.length === 0) {
          state.loading = true;
        }
        state.error = null;
      })
      .addCase(fetchCustomerNotes.fulfilled, (state, action) => {
        state.loading = false;
        state.entityId = action.payload.entityId;
        state.items = action.payload.items;
        state.page = action.payload.pagination.page;
        state.limit = action.payload.pagination.limit;
        state.total = action.payload.pagination.total;
        state.totalPages = Math.max(1, action.payload.pagination.totalPages);
        state.search = action.payload.search;
        const key = customerNotesPageCacheKey(
          state.entityId,
          state.search,
          state.page,
          state.limit,
        );
        state.pagesCache[key] = action.payload.items;
      })
      .addCase(fetchCustomerNotes.rejected, (state, action) => {
        state.loading = false;
        state.error =
          action.payload ||
          action.error.message ||
          "Failed to load customer notes.";
      })
      .addCase(createCustomerNote.pending, (state) => {
        state.mutating = true;
        state.error = null;
      })
      .addCase(createCustomerNote.fulfilled, (state, action) => {
        state.mutating = false;
        state.pagesCache = {};
        state.page = 1;
        // Prepend created note so the list updates without waiting on GET.
        const created = action.payload;
        state.items = sortCustomerNotes([
          created,
          ...state.items.filter((item) => item.id !== created.id),
        ]);
        state.total = state.total + 1;
      })
      .addCase(createCustomerNote.rejected, (state, action) => {
        state.mutating = false;
        state.error =
          action.payload ||
          action.error.message ||
          "Failed to create note.";
      })
      .addCase(updateCustomerNote.pending, (state) => {
        state.mutating = true;
        state.error = null;
      })
      .addCase(updateCustomerNote.fulfilled, (state, action) => {
        state.mutating = false;
        const updated = action.payload;
        state.items = replaceNoteById(state.items, updated);
        const key = customerNotesPageCacheKey(
          state.entityId,
          state.search,
          state.page,
          state.limit,
        );
        state.pagesCache[key] = state.items;
      })
      .addCase(updateCustomerNote.rejected, (state, action) => {
        state.mutating = false;
        state.error =
          action.payload ||
          action.error.message ||
          "Failed to update note.";
      })
      .addCase(deleteCustomerNote.pending, (state) => {
        state.mutating = true;
        state.error = null;
      })
      .addCase(deleteCustomerNote.fulfilled, (state, action) => {
        state.mutating = false;
        state.pagesCache = {};
        state.items = state.items.filter((item) => item.id !== action.payload);
        state.total = Math.max(0, state.total - 1);
      })
      .addCase(deleteCustomerNote.rejected, (state, action) => {
        state.mutating = false;
        state.error =
          action.payload ||
          action.error.message ||
          "Failed to delete note.";
      });
  },
});

export const {
  setCustomerNotesEntity,
  setCustomerNotesSearch,
  setCustomerNotesPage,
  invalidateCustomerNotesCache,
  clearCustomerNotesError,
  optimisticToggleNotePin,
} = customerNotesSlice.actions;

export default customerNotesSlice.reducer;
