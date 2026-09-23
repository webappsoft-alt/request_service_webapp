import {
  createAsyncThunk,
  createSlice,
  type PayloadAction,
} from "@reduxjs/toolkit";
import { extractErrorMessage } from "@/components/api/extractErrorMessage";
import { deleteData, getData, postData, putData } from "@/components/api/sliceHttp";
import { providerCrmApi } from "@/components/api/ApiRoutesFile";
import {
  extractNoteEntity,
  extractNotesList,
  replaceNoteById,
  sortCrmNotes,
} from "@/store/notes/normalize";
import {
  createInitialEntityNotesState,
  NOTES_DEFAULT_LIMIT,
  notesPageCacheKey,
  type CrmNote,
  type EntityNotesState,
  type NoteCreateInput,
  type NotesEntityType,
  type NotesModuleKey,
  type NoteUpdateInput,
} from "@/store/notes/types";

type NotesRoot = Partial<Record<NotesModuleKey, EntityNotesState>>;

export type FetchEntityNotesArg = {
  entityId?: string;
  page?: number;
  limit?: number;
  search?: string;
  force?: boolean;
};

export function createEntityNotesSlice(options: {
  /** Redux slice name + state key, e.g. `customerNotes`. */
  name: NotesModuleKey;
  /** Exact API `entityType` from the CRM notes guide. */
  entityType: NotesEntityType;
  /**
   * When set, always request/store this page size and ignore API
   * `pagination.limit` (prevents limit=100 overwrite + refetch loops).
   */
  fixedLimit?: number;
}) {
  const { name, entityType, fixedLimit } = options;

  const fetchNotes = createAsyncThunk<
    {
      items: CrmNote[];
      pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
      };
      entityId: string;
      search: string;
    },
    FetchEntityNotesArg | void,
    { state: NotesRoot; rejectValue: string }
  >(`${name}/fetchList`, async (params, { getState, rejectWithValue }) => {
    const state = getState()[name] ?? createInitialEntityNotesState();
    const entityId = String(params?.entityId || state.entityId || "").trim();
    if (!entityId) {
      return rejectWithValue(`${entityType} id is required to load notes.`);
    }
    const page = params?.page ?? state.page;
    const limit =
      fixedLimit ?? params?.limit ?? state.limit ?? NOTES_DEFAULT_LIMIT;
    const search = params?.search ?? state.search;

    try {
      const query: Record<string, string | number | boolean> = {
        entityType,
        entityId,
        page,
        limit,
      };
      if (search.trim()) query.search = search.trim();

      // Bypass getData's 45s recent-success cache when force is set so
      // tab return still hits the network (background refresh).
      const response = await getData(providerCrmApi.notes, query, {
        silent: true,
        force: params?.force ?? false,
      });
      const parsed = extractNotesList(response, entityType);
      const pagination = fixedLimit
        ? {
            ...parsed.pagination,
            limit: fixedLimit,
            totalPages: Math.max(
              1,
              Number(parsed.pagination.totalPages) ||
                Math.ceil(parsed.pagination.total / fixedLimit) ||
                1,
            ),
          }
        : parsed.pagination;
      return {
        items: parsed.items,
        pagination,
        entityId,
        search,
      };
    } catch (error) {
      return rejectWithValue(extractErrorMessage(error));
    }
  });

  const createNote = createAsyncThunk<
    CrmNote,
    NoteCreateInput,
    { rejectValue: string }
  >(`${name}/create`, async (payload, { rejectWithValue }) => {
    try {
      const response = await postData(
        providerCrmApi.notes,
        {
          entityType,
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
      const entity = extractNoteEntity(response, entityType);
      if (!entity) {
        return rejectWithValue("Note was created but could not be read.");
      }
      return entity;
    } catch (error) {
      return rejectWithValue(extractErrorMessage(error));
    }
  });

  const updateNote = createAsyncThunk<
    CrmNote,
    { id: string } & NoteUpdateInput,
    { rejectValue: string }
  >(`${name}/update`, async ({ id, ...payload }, { rejectWithValue }) => {
    try {
      const body: Record<string, unknown> = {};
      if (payload.title !== undefined) body.title = payload.title;
      if (payload.content !== undefined) body.content = payload.content;
      if (payload.tags !== undefined) body.tags = payload.tags;
      if (payload.isPinned !== undefined) body.isPinned = payload.isPinned;
      if (payload.color !== undefined) body.color = payload.color;
      if (payload.attachments !== undefined) {
        body.attachments = payload.attachments;
      }

      const response = await putData(providerCrmApi.note(id), body, { silent: true });

      const entity = extractNoteEntity(response, entityType);
      if (!entity) {
        return rejectWithValue("Note was updated but could not be read.");
      }
      return entity;
    } catch (error) {
      return rejectWithValue(extractErrorMessage(error));
    }
  });

  const deleteNote = createAsyncThunk<string, string, { rejectValue: string }>(
    `${name}/delete`,
    async (id, { rejectWithValue }) => {
      try {
        await deleteData(providerCrmApi.note(id), { silent: true });
        return id;
      } catch (error) {
        return rejectWithValue(extractErrorMessage(error));
      }
    },
  );

  const slice = createSlice({
    name,
    initialState: createInitialEntityNotesState(),
    reducers: {
      setEntity(state, action: PayloadAction<string>) {
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
      setSearch(state, action: PayloadAction<string>) {
        state.search = action.payload;
        state.page = 1;
        state.pagesCache = {};
      },
      setPage(state, action: PayloadAction<number>) {
        state.page = Math.max(1, action.payload);
        const key = notesPageCacheKey(
          state.entityId,
          state.search,
          state.page,
          state.limit,
        );
        if (key in state.pagesCache) {
          state.items = state.pagesCache[key];
        }
      },
      invalidateCache(state) {
        state.pagesCache = {};
      },
      clearError(state) {
        state.error = null;
      },
      optimisticTogglePin(
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
        state.items = sortCrmNotes(state.items);
        const key = notesPageCacheKey(
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
        .addCase(fetchNotes.pending, (state) => {
          if (state.items.length === 0) state.loading = true;
          state.error = null;
        })
        .addCase(fetchNotes.fulfilled, (state, action) => {
          state.loading = false;
          state.entityId = action.payload.entityId;
          state.items = action.payload.items;
          state.page = action.payload.pagination.page;
          // Prefer locked page size when configured (Customer Notes = 10).
          state.limit = fixedLimit ?? action.payload.pagination.limit;
          state.total = action.payload.pagination.total;
          state.totalPages = Math.max(1, action.payload.pagination.totalPages);
          state.search = action.payload.search;
          const key = notesPageCacheKey(
            state.entityId,
            state.search,
            state.page,
            state.limit,
          );
          state.pagesCache[key] = action.payload.items;
        })
        .addCase(fetchNotes.rejected, (state, action) => {
          state.loading = false;
          state.error =
            action.payload ||
            action.error.message ||
            `Failed to load ${entityType.toLowerCase()} notes.`;
        })
        .addCase(createNote.pending, (state) => {
          state.mutating = true;
          state.error = null;
        })
        .addCase(createNote.fulfilled, (state, action) => {
          state.mutating = false;
          state.pagesCache = {};
          state.page = 1;
          const created = action.payload;
          state.items = sortCrmNotes([
            created,
            ...state.items.filter((item) => item.id !== created.id),
          ]);
          state.total = state.total + 1;
        })
        .addCase(createNote.rejected, (state, action) => {
          state.mutating = false;
          state.error =
            action.payload ||
            action.error.message ||
            "Failed to create note.";
        })
        .addCase(updateNote.pending, (state) => {
          state.mutating = true;
          state.error = null;
        })
        .addCase(updateNote.fulfilled, (state, action) => {
          state.mutating = false;
          const updated = action.payload;
          state.items = replaceNoteById(state.items, updated);
          const key = notesPageCacheKey(
            state.entityId,
            state.search,
            state.page,
            state.limit,
          );
          state.pagesCache[key] = state.items;
        })
        .addCase(updateNote.rejected, (state, action) => {
          state.mutating = false;
          state.error =
            action.payload ||
            action.error.message ||
            "Failed to update note.";
        })
        .addCase(deleteNote.pending, (state) => {
          state.mutating = true;
          state.error = null;
        })
        .addCase(deleteNote.fulfilled, (state, action) => {
          state.mutating = false;
          state.pagesCache = {};
          state.items = state.items.filter(
            (item) => item.id !== action.payload,
          );
          state.total = Math.max(0, state.total - 1);
        })
        .addCase(deleteNote.rejected, (state, action) => {
          state.mutating = false;
          state.error =
            action.payload ||
            action.error.message ||
            "Failed to delete note.";
        });
    },
  });

  return {
    entityType,
    name,
    reducer: slice.reducer,
    actions: slice.actions,
    fetchNotes,
    createNote,
    updateNote,
    deleteNote,
  };
}

export type EntityNotesModule = ReturnType<typeof createEntityNotesSlice>;
