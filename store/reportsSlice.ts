import {
  createAsyncThunk,
  createSlice,
  type PayloadAction,
} from "@reduxjs/toolkit";
import { extractErrorMessage } from "@/components/api/extractErrorMessage";
import { getProviderReports } from "@/lib/api/crm-client";
import type { InvoiceStatus } from "@/lib/types";

export type ReportLedgerRow = {
  id: string;
  number: string;
  status: InvoiceStatus | string;
  issuedAt: string;
  dueAt?: string | null;
  total: number;
  amountPaid: number;
  balanceDue: number;
  customerId: string;
  customerName: string;
  jobId: string | null;
  jobNumber: string;
  jobTitle: string;
  site: string;
  invoiceType: string;
  updatedAt?: string;
  createdAt?: string;
};

export type ReportKpis = {
  collected: number;
  outstanding: number;
  paymentsCount: number;
  overdueInvoices: number;
  estimateConversion: number;
  estimatesAccepted: number;
  estimatesSent: number;
  activeJobs: number;
  completedJobs: number;
  totalJobs: number;
};

export type ReportMonthlyPoint = {
  key: string;
  label: string;
  value: number;
  year: number;
};

export type ReportPipelineItem = {
  id: string;
  label: string;
  value: number;
  href: string;
};

export type ReportMixItem = {
  status: string;
  label: string;
  value: number;
};

export type ReportMoneyOnBooks = {
  collected: number;
  outstanding: number;
  overdue: number;
  households: number;
  invoicesOnFile: number;
};

export type ProviderReportsData = {
  companyName: string;
  period: {
    start: string;
    end: string;
    label: string;
    months: number;
  };
  kpis: ReportKpis;
  monthlyVolume: ReportMonthlyPoint[];
  pipeline: ReportPipelineItem[];
  requestMix: ReportMixItem[];
  moneyOnBooks: ReportMoneyOnBooks;
  ledger: ReportLedgerRow[];
};

type ReportsState = {
  data: ProviderReportsData | null;
  months: number;
  loading: boolean;
  error: string | null;
  fetchedAt: number | null;
};

const emptyKpis: ReportKpis = {
  collected: 0,
  outstanding: 0,
  paymentsCount: 0,
  overdueInvoices: 0,
  estimateConversion: 0,
  estimatesAccepted: 0,
  estimatesSent: 0,
  activeJobs: 0,
  completedJobs: 0,
  totalJobs: 0,
};

const emptyMoney: ReportMoneyOnBooks = {
  collected: 0,
  outstanding: 0,
  overdue: 0,
  households: 0,
  invoicesOnFile: 0,
};

export const REPORTS_DEFAULT_MONTHS = 6;

const initialState: ReportsState = {
  data: null,
  months: REPORTS_DEFAULT_MONTHS,
  loading: false,
  error: null,
  fetchedAt: null,
};

export const fetchProviderReports = createAsyncThunk<
  ProviderReportsData,
  { months?: number; force?: boolean; silent?: boolean } | void,
  { state: { reports: ReportsState }; rejectValue: string }
>("reports/fetch", async (params, { getState, rejectWithValue }) => {
  const state = getState().reports ?? initialState;
  const months = params?.months ?? state.months ?? REPORTS_DEFAULT_MONTHS;
  try {
    return await getProviderReports({
      months,
      force: params?.force ?? true,
      silent: params?.silent ?? true,
    });
  } catch (error) {
    return rejectWithValue(extractErrorMessage(error));
  }
});

const reportsSlice = createSlice({
  name: "reports",
  initialState,
  reducers: {
    setReportsMonths(state, action: PayloadAction<number>) {
      state.months = Math.max(1, Math.min(24, action.payload));
    },
    clearReports(state) {
      state.data = null;
      state.error = null;
      state.fetchedAt = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchProviderReports.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchProviderReports.fulfilled, (state, action) => {
        state.loading = false;
        state.error = null;
        state.data = action.payload;
        state.months = action.payload.period?.months ?? state.months;
        state.fetchedAt = Date.now();
      })
      .addCase(fetchProviderReports.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload ?? "Failed to load reports";
      });
  },
});

export const { setReportsMonths, clearReports } = reportsSlice.actions;

export function selectReportsData(state: { reports: ReportsState }) {
  return state.reports.data;
}

export function selectReportsKpis(state: { reports: ReportsState }) {
  return state.reports.data?.kpis ?? emptyKpis;
}

export function selectReportsMoney(state: { reports: ReportsState }) {
  return state.reports.data?.moneyOnBooks ?? emptyMoney;
}

export default reportsSlice.reducer;
