import { createAsyncThunk, createSlice, type PayloadAction } from "@reduxjs/toolkit";
import {
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type AppNotification,
} from "@/lib/api/notifications-client";

/**
 * The header bell, shared by every portal (Pro, Customer, Employee, Contractor).
 * The badge is the server's unread total: set from each list response, from the
 * `unreadCount` on NEW_NOTIFICATION, and from NOTIFICATIONS_READ (any tab/device).
 * The list loads 10 at a time; older pages load as the dropdown scrolls.
 */
export const NOTIFICATION_PAGE_SIZE = 10;

type FeedStatus = "idle" | "loading" | "ready" | "failed";

type NotificationFeedState = {
  items: AppNotification[];
  unread: number;
  page: number;
  hasMore: boolean;
  status: FeedStatus;
  loadingMore: boolean;
  /** Bumped on every first-page load, so an older "load more" can't append to a fresh list. */
  epoch: number;
  loadedAt: number;
};

const initialState: NotificationFeedState = {
  items: [],
  unread: 0,
  page: 0,
  hasMore: false,
  status: "idle",
  loadingMore: false,
  epoch: 0,
  loadedAt: 0,
};

type RootLike = { notificationFeed?: NotificationFeedState };

function feedOf(getState: () => unknown) {
  return (getState() as RootLike).notificationFeed ?? initialState;
}

/** First page (newest 10) + the unread total. `force` re-syncs even when already loaded. */
export const loadNotificationFeed = createAsyncThunk(
  "notificationFeed/load",
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- the arg is read by `condition`
  async (_arg: { force?: boolean } | undefined) =>
    fetchNotifications({
      page: 1,
      limit: NOTIFICATION_PAGE_SIZE,
      status: "all",
      silent: true,
      force: true,
    }),
  {
    condition: (arg, { getState }) => {
      const feed = feedOf(getState);
      if (feed.status === "loading") return false;
      return Boolean(arg?.force) || feed.status === "idle" || feed.status === "failed";
    },
  },
);

/** Next page of older notifications (infinite scroll). */
export const loadMoreNotifications = createAsyncThunk(
  "notificationFeed/loadMore",
  async (_arg: void, { getState }) => {
    const feed = feedOf(getState);
    const result = await fetchNotifications({
      page: feed.page + 1,
      limit: NOTIFICATION_PAGE_SIZE,
      status: "all",
      silent: true,
      force: true,
    });
    return { result, epoch: feed.epoch };
  },
  {
    condition: (_arg, { getState }) => {
      const feed = feedOf(getState);
      return feed.status === "ready" && feed.hasMore && !feed.loadingMore;
    },
  },
);

export const markFeedItemRead = createAsyncThunk(
  "notificationFeed/markRead",
  async (id: string) => markNotificationRead(id),
);

export const markFeedAllRead = createAsyncThunk("notificationFeed/markAllRead", async () =>
  markAllNotificationsRead(),
);

function setRead(state: NotificationFeedState, ids: Set<string> | null) {
  const now = new Date().toISOString();
  state.items = state.items.map((item) =>
    !item.isRead && (!ids || ids.has(item.id)) ? { ...item, isRead: true, readAt: now } : item,
  );
}

const notificationFeedSlice = createSlice({
  name: "notificationFeed",
  initialState,
  reducers: {
    /** Socket NEW_NOTIFICATION. */
    notificationArrived(
      state,
      action: PayloadAction<{ item: AppNotification; unreadCount?: number }>,
    ) {
      const { item, unreadCount } = action.payload;
      if (state.items.some((row) => row.id === item.id)) return;
      state.items = [item, ...state.items];
      if (typeof unreadCount === "number" && Number.isFinite(unreadCount)) {
        state.unread = Math.max(0, unreadCount);
      } else if (!item.isRead) {
        state.unread += 1;
      }
    },
    /** Socket NOTIFICATIONS_READ — items read in this or another tab / device. */
    notificationsReadElsewhere(
      state,
      action: PayloadAction<{ ids?: string[]; all?: boolean; unreadCount?: number }>,
    ) {
      const { ids, all, unreadCount } = action.payload;
      if (all) setRead(state, null);
      else if (ids?.length) setRead(state, new Set(ids.map(String)));
      if (typeof unreadCount === "number" && Number.isFinite(unreadCount)) {
        state.unread = Math.max(0, unreadCount);
      } else if (all) {
        state.unread = 0;
      }
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loadNotificationFeed.pending, (state) => {
        state.status = "loading";
        state.epoch += 1;
      })
      .addCase(loadNotificationFeed.fulfilled, (state, action) => {
        const { items, unreadCount, totalPages } = action.payload;
        // Keep anything the socket delivered while this page was loading.
        const fetched = new Set(items.map((row) => row.id));
        const newest = items[0]?.createdAt ? Date.parse(items[0].createdAt) : 0;
        const arrived = state.items.filter(
          (row) =>
            !fetched.has(row.id) && row.createdAt && Date.parse(row.createdAt) > newest,
        );
        state.items = [...arrived, ...items];
        state.unread = Math.max(0, unreadCount);
        state.page = 1;
        state.hasMore = totalPages > 1;
        state.status = "ready";
        state.loadingMore = false;
        state.loadedAt = Date.now();
      })
      .addCase(loadNotificationFeed.rejected, (state) => {
        state.status = state.items.length ? "ready" : "failed";
      })
      .addCase(loadMoreNotifications.pending, (state) => {
        state.loadingMore = true;
      })
      .addCase(loadMoreNotifications.fulfilled, (state, action) => {
        state.loadingMore = false;
        const { result, epoch } = action.payload;
        if (epoch !== state.epoch) return;
        // New arrivals shift pages down, so a page can repeat rows we already have.
        const seen = new Set(state.items.map((row) => row.id));
        state.items = [...state.items, ...result.items.filter((row) => !seen.has(row.id))];
        state.page = result.page;
        state.hasMore = result.page < result.totalPages && result.items.length > 0;
        state.unread = Math.max(0, result.unreadCount);
      })
      .addCase(loadMoreNotifications.rejected, (state) => {
        state.loadingMore = false;
      })
      .addCase(markFeedItemRead.pending, (state, action) => {
        const id = action.meta.arg;
        const item = state.items.find((row) => row.id === id);
        if (item && !item.isRead) state.unread = Math.max(0, state.unread - 1);
        setRead(state, new Set([id]));
      })
      .addCase(markFeedItemRead.fulfilled, (state, action) => {
        state.unread = Math.max(0, action.payload.unreadCount);
      })
      .addCase(markFeedAllRead.pending, (state) => {
        setRead(state, null);
        state.unread = 0;
      });
  },
});

export const { notificationArrived, notificationsReadElsewhere } =
  notificationFeedSlice.actions;

export const selectNotificationFeed = (state: RootLike) =>
  state.notificationFeed ?? initialState;
export const selectNotificationUnread = (state: RootLike) =>
  state.notificationFeed?.unread ?? 0;

export default notificationFeedSlice.reducer;
