import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { extractErrorMessage } from "@/components/api/extractErrorMessage";
import { getData } from "@/components/api/sliceHttp";
import { publicApi } from "@/components/api/ApiRoutesFile";
import { siteConfig } from "@/lib/site";
import type { RootState } from "@/store";

export type BusinessHourDay = {
  day: string;
  open: string | null;
  close: string | null;
  closed: boolean;
};

export type SiteBrandingContact = {
  phone: string;
  phone2: string;
  email: string;
  email2: string;
  address: string;
  address2: string;
  businessHours: BusinessHourDay[];
  closedDates: string[];
  phoneHref: string;
  phone2Href: string;
  hoursSummary: string;
  hoursDetailed: string[];
};

type SiteBrandingState = {
  data: SiteBrandingContact | null;
  loading: boolean;
  loaded: boolean;
  error: string | null;
};

const DAY_ORDER = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;

const DAY_SHORT: Record<string, string> = {
  monday: "Mon",
  tuesday: "Tue",
  wednesday: "Wed",
  thursday: "Thu",
  friday: "Fri",
  saturday: "Sat",
  sunday: "Sun",
};

const initialState: SiteBrandingState = {
  data: null,
  loading: false,
  loaded: false,
  error: null,
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function stringOr(value: unknown, fallback = "") {
  return typeof value === "string" ? value.trim() : value == null ? fallback : String(value).trim();
}

export function phoneToHref(phone: string) {
  const digits = phone.replace(/[^\d+]/g, "");
  if (!digits) return "";
  return digits.startsWith("+") ? `tel:${digits}` : `tel:+${digits}`;
}

function formatClock(value: string | null | undefined) {
  if (!value) return "";
  const match = String(value).trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return String(value);
  let hour = Number(match[1]);
  const minute = match[2];
  const suffix = hour >= 12 ? "PM" : "AM";
  hour = hour % 12 || 12;
  return `${hour}:${minute} ${suffix}`;
}

function normalizeHours(raw: unknown): BusinessHourDay[] {
  const list = Array.isArray(raw) ? raw : [];
  const byDay = new Map<string, BusinessHourDay>();
  for (const item of list) {
    const row = asRecord(item);
    if (!row) continue;
    const day = stringOr(row.day).toLowerCase();
    if (!DAY_ORDER.includes(day as (typeof DAY_ORDER)[number])) continue;
    const closed = row.closed === true;
    byDay.set(day, {
      day,
      closed,
      open: closed ? null : stringOr(row.open) || null,
      close: closed ? null : stringOr(row.close) || null,
    });
  }
  return DAY_ORDER.map((day) => {
    if (byDay.has(day)) return byDay.get(day)!;
    const weekend = day === "saturday" || day === "sunday";
    return {
      day,
      closed: weekend,
      open: weekend ? null : "08:00",
      close: weekend ? null : "18:00",
    };
  });
}

export function formatBusinessHoursSummary(hours: BusinessHourDay[]) {
  const openDays = hours.filter((item) => !item.closed && item.open && item.close);
  if (!openDays.length) return "Closed";

  const groups: Array<{ start: string; end: string; open: string; close: string }> = [];
  for (const item of openDays) {
    const last = groups[groups.length - 1];
    if (
      last &&
      last.open === item.open &&
      last.close === item.close &&
      DAY_ORDER.indexOf(item.day as (typeof DAY_ORDER)[number]) ===
        DAY_ORDER.indexOf(last.end as (typeof DAY_ORDER)[number]) + 1
    ) {
      last.end = item.day;
      continue;
    }
    groups.push({
      start: item.day,
      end: item.day,
      open: item.open || "",
      close: item.close || "",
    });
  }

  return groups
    .map((group) => {
      const label =
        group.start === group.end
          ? DAY_SHORT[group.start]
          : `${DAY_SHORT[group.start]} – ${DAY_SHORT[group.end]}`;
      return `${label}: ${formatClock(group.open)} – ${formatClock(group.close)}`;
    })
    .join("; ");
}

export function formatBusinessHoursDetailed(hours: BusinessHourDay[]) {
  return hours.map((item) => {
    const label = DAY_SHORT[item.day] || item.day;
    if (item.closed || !item.open || !item.close) return `${label}: Closed`;
    return `${label}: ${formatClock(item.open)} – ${formatClock(item.close)}`;
  });
}

function fallbackAddress() {
  const { street, city, state, postalCode } = siteConfig.address;
  return `${street}, ${city}, ${state} ${postalCode}`;
}

export function fallbackSiteBranding(): SiteBrandingContact {
  const hours = normalizeHours([]);
  return {
    phone: siteConfig.phone,
    phone2: "",
    email: siteConfig.email,
    email2: "",
    address: fallbackAddress(),
    address2: "",
    businessHours: hours,
    closedDates: [],
    phoneHref: siteConfig.phoneHref,
    phone2Href: "",
    hoursSummary: formatBusinessHoursSummary(hours),
    hoursDetailed: formatBusinessHoursDetailed(hours),
  };
}

function parseBrandingResponse(response: unknown): SiteBrandingContact {
  const root = asRecord(response) ?? {};
  const data = asRecord(root.data) ?? root;
  const fallback = fallbackSiteBranding();
  const phone = stringOr(data.phone) || fallback.phone;
  const phone2 = stringOr(data.phone2);
  const email = stringOr(data.email) || fallback.email;
  const email2 = stringOr(data.email2);
  const address = stringOr(data.address) || fallback.address;
  const address2 = stringOr(data.address2);
  const businessHours = normalizeHours(data.businessHours);
  const closedDates = Array.isArray(data.closedDates)
    ? data.closedDates.map((item) => stringOr(item)).filter(Boolean)
    : [];

  return {
    phone,
    phone2,
    email,
    email2,
    address,
    address2,
    businessHours,
    closedDates,
    phoneHref: phoneToHref(phone) || fallback.phoneHref,
    phone2Href: phone2 ? phoneToHref(phone2) : "",
    hoursSummary: formatBusinessHoursSummary(businessHours),
    hoursDetailed: formatBusinessHoursDetailed(businessHours),
  };
}

export const fetchSiteBranding = createAsyncThunk<
  SiteBrandingContact,
  void,
  { state: RootState; rejectValue: string }
>(
  "siteBranding/fetch",
  async (_, { rejectWithValue }) => {
    try {
      const response = await getData(
        publicApi.cmsSection("general"),
        {},
        { silent: true, skipLogoutOn401: true, token: null, force: true },
      );
      return parseBrandingResponse(response);
    } catch (error) {
      return rejectWithValue(extractErrorMessage(error));
    }
  },
  {
    condition: (_, { getState }) => {
      const state = getState().siteBranding;
      if (!state) return true;
      if (state.loading) return false;
      if (state.loaded) return false;
      return true;
    },
  },
);

const siteBrandingSlice = createSlice({
  name: "siteBranding",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchSiteBranding.pending, (state) => {
        state.loading = !state.data;
        state.error = null;
      })
      .addCase(fetchSiteBranding.fulfilled, (state, action) => {
        state.loading = false;
        state.loaded = true;
        state.data = action.payload;
        state.error = null;
      })
      .addCase(fetchSiteBranding.rejected, (state, action) => {
        state.loading = false;
        state.loaded = true;
        state.data = state.data ?? fallbackSiteBranding();
        state.error = action.payload || action.error.message || "Failed to load site branding.";
      });
  },
});

export const selectSiteBranding = (state: RootState): SiteBrandingContact =>
  state.siteBranding?.data ?? fallbackSiteBranding();

export const selectSiteBrandingLoading = (state: RootState) =>
  Boolean(state.siteBranding?.loading);

export default siteBrandingSlice.reducer;
