import {
  createAsyncThunk,
  createSlice,
  type PayloadAction,
} from "@reduxjs/toolkit";
import { extractErrorMessage } from "@/components/api/extractErrorMessage";
import { getProviderDashboard } from "@/lib/api/crm-client";

export type DashboardCountRow = { label: string; value: number };

export type DashboardRequestRow = {
  id: string;
  serviceName: string;
  customerName: string;
  neighborhood: string;
  status: string;
  statusLabel: string;
  preferredDate: string;
  details: string;
};

export type DashboardJobRow = {
  id: string;
  number: string;
  customerName: string;
  status: string;
  statusLabel: string;
  scheduledAt: string | null;
  city: string;
  detail: string;
  assignee: string | null;
};

export type DashboardScheduleEvent = {
  id: string;
  title: string;
  detail: string;
  date: string;
  startMinutes: number | null;
  employeeName: string | null;
  href: string;
};

/** One row in Important Actions / Today's Work — always links to an existing detail page. */
export type DashboardActionItem = {
  id: string;
  kind: string;
  actionLabel: string;
  priority?: "high" | "medium" | "low";
  title?: string;
  customerName: string;
  reference: string;
  status: string;
  statusLabel: string;
  detail: string;
  time?: string | null;
  amount?: number;
  href: string;
};

export type DashboardActionCenter = {
  importantActions: DashboardActionItem[];
  importantActionsTotal: number;
  importantActionsHigh: number;
  today: DashboardActionItem[];
  todayDate: string;
};

export type DashboardPeriodTotals = {
  revenue: number;
  count: number;
};

export type ProviderDashboardData = {
  companyName: string;
  city: string;
  state: string;
  generatedAt: string;
  actionCenter: DashboardActionCenter;
  attention: {
    overdueInvoices: { count: number; amountPastDue: number };
    uninvoicedCompletedJobs: number;
    unassignedActiveJobs: number;
    overdueTasks: number;
    estimatesAwaitingSignature: { count: number; totalOut: number };
  };
  leads: {
    openCount: number;
    newFromWebsite: number;
    total: number;
    byStatus: DashboardCountRow[];
    latest: DashboardRequestRow[];
    incoming: DashboardRequestRow[];
    field: DashboardRequestRow[];
  };
  messages: {
    unreadChats: number;
    inboxPreview: Array<{
      id: string;
      href: string;
      title: string;
      detail: string;
      kind: "chat" | "lead";
      unread?: number;
    }>;
  };
  estimates: {
    openCount: number;
    pendingValue: number;
    awaitingSignature: number;
    latest: Array<{
      id: string;
      number: string;
      customerName: string;
      total: number;
      status: string;
      statusLabel: string;
    }>;
  };
  jobs: {
    total: number;
    active: number;
    scheduledThisWeek: number;
    unscheduled: number;
    inField: number;
    heldUp: number;
    byStatus: DashboardCountRow[];
    byServiceGroup: DashboardCountRow[];
    byServiceMix: DashboardCountRow[];
    serviceMixTotal: number;
    latestActive: DashboardJobRow[];
    upcoming: DashboardJobRow[];
  };
  schedule: {
    upcomingWeekCount: number;
    todayCount: number;
    weekDays: Array<{ date: string; label: string; day: number; count: number }>;
    upcoming: DashboardScheduleEvent[];
    weekEvents: DashboardScheduleEvent[];
  };
  invoices: {
    total: number;
    unpaid: { count: number; balanceDue: number };
    byAging: DashboardCountRow[];
    latest: Array<{
      id: string;
      number: string;
      customerName: string;
      balanceDue: number;
      status: string;
      statusLabel: string;
      daysOverdue: number;
    }>;
  };
  payments: {
    allTimeRevenue: number;
    period: {
      today: DashboardPeriodTotals;
      week: DashboardPeriodTotals;
      month: DashboardPeriodTotals;
    };
    revenueChart: Array<{ key: string; label: string; value: number }>;
    latest: Array<{
      id: string;
      number: string;
      amount: number;
      paidAt: string;
      invoiceNumber: string;
      invoiceId: string | null;
    }>;
  };
  salesChart: {
    month: Array<{ key: string; label: string; billed: number; collected: number }>;
    year: Array<{ key: string; label: string; billed: number; collected: number }>;
  };
  jobsChart: {
    month: Array<{ key: string; label: string; opened: number; finished: number }>;
    year: Array<{ key: string; label: string; opened: number; finished: number }>;
  };
  people: {
    customers: number;
    employees: number;
    contractors: number;
    vendors: number;
  };
  tasks: {
    overdueCount: number;
    myDay: Array<{
      id: string;
      title: string;
      dueAt: string;
      priority: string;
      isOverdue: boolean;
      subjectKind: string | null;
    }>;
  };
  reminders: {
    dueNext14Days: Array<{
      id: string;
      title: string;
      dueAt: string;
      subjectKind: string | null;
    }>;
  };
  activity: Array<{
    id: string;
    title: string;
    detail: string;
    at: string;
    href: string;
  }>;
};

type DashboardState = {
  data: ProviderDashboardData | null;
  loading: boolean;
  error: string | null;
  fetchedAt: number | null;
};

const initialState: DashboardState = {
  data: null,
  loading: false,
  error: null,
  fetchedAt: null,
};

export const fetchProviderDashboard = createAsyncThunk<
  ProviderDashboardData,
  { force?: boolean; silent?: boolean } | void,
  { state: { dashboard: DashboardState }; rejectValue: string }
>(
  "dashboard/fetch",
  async (params, { rejectWithValue }) => {
    try {
      return await getProviderDashboard({
        // Always bypass GET cache when the thunk actually runs; Redux condition
        // prevents duplicate in-flight / cached-slice refetches across tabs.
        force: true,
        silent: params?.silent ?? true,
      });
    } catch (error) {
      return rejectWithValue(extractErrorMessage(error));
    }
  },
  {
    condition: (params, { getState }) => {
      const state = getState().dashboard ?? initialState;
      if (state.loading) return false;
      if (params?.force) return true;
      if (state.data) return false;
      return true;
    },
  },
);

const dashboardSlice = createSlice({
  name: "dashboard",
  initialState,
  reducers: {
    clearDashboard(state) {
      state.data = null;
      state.error = null;
      state.fetchedAt = null;
    },
    setDashboardData(state, action: PayloadAction<ProviderDashboardData | null>) {
      state.data = action.payload;
      state.fetchedAt = action.payload ? Date.now() : null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchProviderDashboard.pending, (state) => {
        // Soft loading: only show loading when there is no cached dashboard data.
        state.loading = state.data == null;
        state.error = null;
      })
      .addCase(fetchProviderDashboard.fulfilled, (state, action) => {
        state.loading = false;
        state.error = null;
        state.data = action.payload;
        state.fetchedAt = Date.now();
      })
      .addCase(fetchProviderDashboard.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload ?? "Failed to load dashboard";
      });
  },
});

export const { clearDashboard, setDashboardData } = dashboardSlice.actions;

export function selectDashboardData(state: { dashboard: DashboardState }) {
  return state.dashboard.data;
}

export function selectDashboardLoading(state: { dashboard: DashboardState }) {
  return state.dashboard.loading;
}

export default dashboardSlice.reducer;
