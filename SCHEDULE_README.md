# Provider Dashboard Schedule Module — Architecture & Workflow

This document provides a comprehensive analysis of the **Schedule** system in the Provider Dashboard (`/pro/dashboard/schedule` and associated views). It outlines data origins, API routes, state management, components, and all functional operations performed on schedules.

---

## 1. Where Schedules Are Taken From (Data Sources & Endpoints)

The schedule data is sourced across several layers depending on the context (full calendar, detail tabs, dashboard overview, or offline fallbacks):

### A. Backend REST API Endpoints
All backend API routes are mapped in [`components/api/ApiRoutesFile.ts`](file:///d:/projects/utecho/request_service_webapp/components/api/ApiRoutesFile.ts):

| Operation | Endpoint | Method | Client Method |
| :--- | :--- | :--- | :--- |
| **List / Query Schedule** | `/api/provider/schedule` | `GET` | `querySchedule(query)` / `listSchedule()` |
| **Assign Work to Calendar** | `/api/provider/schedule/assign` | `POST` | `assignSchedule(payload)` |
| **Update Schedule Item** | `/api/provider/schedule/:id` | `PUT` | `updateSchedule(id, payload)` |
| **Delete Schedule Item** | `/api/provider/schedule/:id` | `DELETE` | `deleteSchedule(id)` |
| **Dashboard Summary** | `/api/provider/dashboard` | `GET` | `getProviderDashboard()` |

### B. Client API Client Layer (`lib/api/crm-client.ts`)
- [`querySchedule(query: CrmListQuery)`](file:///d:/projects/utecho/request_service_webapp/lib/api/crm-client.ts#L2231-L2254):
  Sends query parameters: `customerId`, `recordId`, `employeeId`, `contractorId`, `startDate`, `endDate`, `kind`, `force`, `silent`.
- [`loadCrmSnapshot()`](file:///d:/projects/utecho/request_service_webapp/lib/api/crm-client.ts#L2940-L2994):
  Used by [`CrmDataProvider`](file:///d:/projects/utecho/request_service_webapp/components/portal/crm-data-provider.tsx) to fetch initial global schedule alongside other CRM entities in parallel (`listSchedule()`).
- [`getProviderDashboard()`](file:///d:/projects/utecho/request_service_webapp/lib/api/crm-client.ts#L2785-L2808):
  Fetches high-level metrics: `schedule.todayCount`, `schedule.upcomingWeekCount`, `schedule.weekDays`, `schedule.upcoming`, and `schedule.weekEvents`.

### C. Data Mapper & Normalization (`lib/api/crm-mappers.ts`)
- [`mapScheduleEvent(raw)`](file:///d:/projects/utecho/request_service_webapp/lib/api/crm-mappers.ts#L1901-L1932):
  Transforms backend response objects into standard `PortalCalendarEvent` structures:
  - Normalizes IDs (`id`, `recordId`)
  - Maps kind (`job`, `fixed_service`, `estimate`, `request`, `invoice`, `task`)
  - Standardizes dates (`date`, `endDate`, `dueDate`)
  - Parses time window (`morning`, `afternoon`, `all_day`, `custom`)
  - Converts start and end minutes from midnight (`startMinutes`, `endMinutes`)
  - Resolves assigned assignee ID (`employeeId` or `contractorId`)
  - Generates detail deep-link (`href`: `/pro/dashboard/jobs/:id`, `/pro/dashboard/orders/:id`, etc.)

### D. Redux Slices & Context Providers
1. **`teamSlice.ts`** -> [`fetchEmployeeSchedule`](file:///d:/projects/utecho/request_service_webapp/store/teamSlice.ts#L616-L637): Fetches schedule filtered by `employeeId`.
2. **`contractorsSlice.ts`** -> [`fetchContractorSchedule`](file:///d:/projects/utecho/request_service_webapp/store/contractorsSlice.ts#L472-L493): Fetches schedule filtered by `contractorId`.
3. **`customersSlice.ts`** -> [`fetchCustomerSchedule`](file:///d:/projects/utecho/request_service_webapp/store/customersSlice.ts#L385-L407): Fetches schedule filtered by `customerId`.
4. **`requestsSlice.ts`** -> [`fetchLeadSchedule`](file:///d:/projects/utecho/request_service_webapp/store/requestsSlice.ts#L377-L400) & [`bookLeadSchedule`](file:///d:/projects/utecho/request_service_webapp/store/requestsSlice.ts#L402-L427): Books and retrieves schedule items for a specific request/lead.
5. **`usePortalCrew.ts`** -> [`usePortalCrew()`](file:///d:/projects/utecho/request_service_webapp/components/portal/use-portal-crew.ts): Central React hook providing unified crew and schedule access with fallbacks to local storage (`rs-portal-crew:{email}`) for guest/unauthenticated testing.

---

## 2. Where Schedules Are Displayed Across the App

1. **Main Schedule Page** ([`/pro/dashboard/schedule`](file:///d:/projects/utecho/request_service_webapp/app/%28portal%29/pro/dashboard/schedule/page.tsx)):
   - Handled by [`ScheduleView`](file:///d:/projects/utecho/request_service_webapp/components/portal/views/schedule-view.tsx) and [`EventCalendar`](file:///d:/projects/utecho/request_service_webapp/components/portal/event-calendar.tsx).
   - Full-width interactive calendar supporting Day, Week, and Month views.
2. **Employee Detail View** ([`/pro/dashboard/team/:id`](file:///d:/projects/utecho/request_service_webapp/components/portal/views/employee-detail-view.tsx)):
   - Schedule tab showing calendar filtered to the active employee.
3. **Contractor Detail View** ([`/pro/dashboard/contractors/:id`](file:///d:/projects/utecho/request_service_webapp/components/portal/views/contractor-detail-view.tsx)):
   - Schedule tab showing contractor's assigned work orders.
4. **Customer Detail View** ([`/pro/dashboard/customers/:id`](file:///d:/projects/utecho/request_service_webapp/components/portal/views/customer-detail-view.tsx)):
   - Schedule tab powered by [`CustomerEventCalendar`](file:///d:/projects/utecho/request_service_webapp/components/portal/customer-event-calendar.tsx).
5. **Request / Lead Detail View** ([`/pro/dashboard/requests/:id`](file:///d:/projects/utecho/request_service_webapp/components/portal/views/request-detail-view.tsx)):
   - Calendar booking and schedule viewing for site visits.
6. **Job Management** ([`job-file.tsx`](file:///d:/projects/utecho/request_service_webapp/components/portal/job-file.tsx)):
   - Directly schedules and assigns jobs to team members or contractors.

---

## 3. Data Models

### `PortalCalendarEvent`
```typescript
export type PortalCalendarEvent = {
  id: string;
  kind: "job" | "fixed_service" | "estimate" | "request" | "invoice" | "task";
  recordId?: string;
  title: string;
  detail: string;
  customerName?: string;
  technicianName?: string;
  notes?: string;
  date?: string;         // "YYYY-MM-DD"
  endDate?: string;      // "YYYY-MM-DD" (for multi-day spans)
  dueDate?: string;      // "YYYY-MM-DD" (due date for invoices / tasks)
  timeWindow: "morning" | "afternoon" | "all_day" | "custom";
  startMinutes?: number; // Minutes from midnight (e.g. 540 = 9:00 AM)
  endMinutes?: number;   // Minutes from midnight (e.g. 660 = 11:00 AM)
  employeeId?: string;   // Assignee ID (Employee or Contractor)
  href: string;          // Target detail page route
  status: string;        // "scheduled" | "confirmed" | "in_progress" | "completed" | "cancelled"
};
```

### `CrmScheduleAssignment`
```typescript
export type CrmScheduleAssignment = {
  recordId?: string | null;
  kind: PortalEventKind;
  title: string;
  date: string;
  endDate?: string | null;
  startMinutes: number;
  endMinutes: number;
  timeWindow: PortalTimeWindow | "custom";
  employeeId?: string | null;
  contractorId?: string | null;
  status?: CrmScheduleStatus;
};
```

---

## 4. Functions & Operations Performed on Schedules

### 1. Querying & Filtering
- **Member Filtering**: Filter schedule events by specific Employee or Contractor (`memberFilter` state in `ScheduleView` & dropdown in `EventCalendar`).
- **Kind Filtering**: Filter by record kind (`job`, `fixed_service` [Fix Service], `estimate`, `request`, `invoice`, `task`).
- **Date Range / Calendar Views**:
  - `Month View`: Full-width 35-42 calendar day grid with event pill badges.
  - `Week View`: 7-day time-grid (6:00 AM to midnight) with 30-minute slot intervals.
  - `Day View`: Single day detailed hourly timeline.
- **Date Navigation**: Previous/Next navigation, Today shortcut, month picker.

### 2. Interactive Drag & Drop / Side Date Extension (`EventCalendar`)
- **Move Event**:
  - Drag an event card onto any day or time slot.
  - Automatically calculates target start date based on `dayOffset` for smooth multi-day dragging.
  - Persists new schedule via `assign(...)` / `updateSchedule`.
- **Drag From Side to Extend Dates (Multi-Day Extension)**:
  - **Month View**: Drag the right edge handle (`cursor-ew-resize`) on any event chip to adjacent day cells to extend the `endDate` across multiple dates.
  - **Week / Day View**: Drag the right edge handle (`cursor-ew-resize`) on any timed event bar across day columns to extend the date range (`endDate`), or drag the bottom edge (`cursor-s-resize`) to extend the duration in 30-minute intervals.

### 3. Invoice Due Date Display
- Invoices on the calendar display their specific **Due Date** (e.g., `Due: Oct 15, 2026`) prominently on the event chip and timed event bar, giving instant visibility into payment timelines.

### 4. Editing & Deletion
- **Click Event**: Opens assignment / detail dialog for the selected event.
- **Remove from Calendar**:
  - Available when an event is selected to un-schedule it via `deleteScheduleApi(scheduleId)`.

### 5. Conflict & Collision Detection
- Server conflict validation (HTTP 409) returns error text containing conflicting time ranges.
- Formatted gracefully via [`formatScheduleError`](file:///d:/projects/utecho/request_service_webapp/components/portal/views/schedule-view.tsx#L33-L50) and [`formatAssignError`](file:///d:/projects/utecho/request_service_webapp/components/portal/assign-event-dialog.tsx#L82-L101).
