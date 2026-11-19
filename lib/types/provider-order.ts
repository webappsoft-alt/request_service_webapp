/** Provider Operational Orders types matching OpenAPI spec */

export type ProviderOrderStatus =
  | "BOOKING_REQUESTED"
  | "CONFIRMED"
  | "IN_TRANSIT"
  | "ARRIVED"
  | "IN_PROGRESS"
  | "CHANGE_ORDER_PENDING"
  | "WORK_COMPLETED"
  | "SETTLED"
  | "CANCELLED"
  | "DISPUTED";

export interface GeoPoint {
  type: "Point";
  coordinates: [number, number]; // [longitude, latitude]
}

export interface ProviderOrderPricing {
  basePrice: number;
  changeOrdersTotal: number;
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  platformFee: number;
  totalAmount: number;
  currency: string;
}

export interface ProviderOrderPayment {
  status: "PENDING" | "AUTHORIZED" | "CAPTURED" | "REFUNDED" | "FAILED" | string;
  authorizationHoldId?: string;
}

export interface ProviderOrderAddress {
  street: string;
  unit?: string;
  city: string;
  state: string;
  zip: string;
  location?: GeoPoint;
  notes?: string;
}

export interface ProviderOrderServiceSnapshot {
  id?: string;
  title?: string;
  servicesName?: string;
  name?: string;
  category?: string;
  subcategory?: string;
  images?: string[];
  covered?: string[];
  basePrice?: number;
  unit?: string;
}

export interface ProviderOrderCustomerSnapshot {
  id?: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  email?: string;
  avatarUrl?: string;
}

export interface ProviderChangeOrderItem {
  id?: string;
  description: string;
  reason?: string;
  additionalAmount: number;
  evidencePhotos?: string[];
  status?: "PENDING" | "APPROVED" | "REJECTED" | string;
  createdAt?: string;
  respondedAt?: string;
  /** Who raised it: the Pro, or an assigned employee / contractor. */
  requestedBy?: OrderActor | null;
}

export interface ProviderCustomerSignOff {
  confirmed?: boolean;
  signedAt?: string | null;
  signatureUrl?: string | null;
  rating?: number | null;
  review?: string | null;
  tip?: number;
}

export interface ProviderCompletionDetails {
  notes?: string;
  completionNotes?: string;
  beforePhotos?: string[];
  afterPhotos?: string[];
  proofOfWorkImages?: string[];
  proofOfWorkVideos?: string[];
  customerSignOff?: ProviderCustomerSignOff;
  completedAt?: string;
}

export interface ProviderBookingSnapshot {
  id?: string;
  _id?: string;
  startTime?: string;
  endTime?: string;
  durationMinutes?: number;
}

/** Someone who moved the order through a step: the Pro, or assigned crew. */
export interface OrderActor {
  type: "provider" | "employee" | "contractor";
  id?: string | null;
  name: string;
}

/** Shared by employees and contractors on a fixed service order (GET …/orders/:id → crew). */
interface OrderCrewMemberBase {
  name: string;
  trade?: string;
  phone?: string;
  email?: string;
  hasPortalAccess: boolean;
  /** Checked in on the order, or moved it through a step → can't be removed. */
  started: boolean;
  checkedIn: boolean;
  firstCheckInAt?: string | null;
  lastCheckOutAt?: string | null;
  removable: boolean;
}

export interface OrderCrewEmployee extends OrderCrewMemberBase {
  employeeId: string;
  role?: string;
}

export interface OrderCrewContractor extends OrderCrewMemberBase {
  contractorId: string;
  title?: string;
  instructions?: string;
  startAt?: string | null;
  endAt?: string | null;
  payType?: "hourly" | "fixed";
  payRate?: number;
}

export interface OrderCrew {
  employees: OrderCrewEmployee[];
  contractors: OrderCrewContractor[];
  lastActor?: OrderActor | null;
}

/** Crew "Mark complete" waiting for / reviewed by the Pro (like a job completion request). */
export interface OrderCrewCompletion {
  status: "none" | "pending" | "approved" | "rejected";
  submittedBy: OrderActor | null;
  submittedAt: string | null;
  photos: string[];
  notes: string;
  reviewNote: string;
  reviewedAt: string | null;
}

/** The order's invoice (Pro "Convert to invoice" after completion; customer pays, then signs off). */
export interface OrderInvoiceSummary {
  id: string;
  number: string;
  status: string;
  total: number;
  amountPaid: number;
  balanceDue: number;
  dueAt: string | null;
}

/** Parse the API's `invoice` summary on an order (null when none / not visible). */
export function parseOrderInvoice(raw: unknown): OrderInvoiceSummary | null {
  if (!raw || typeof raw !== "object") return null;
  const rec = raw as Record<string, unknown>;
  const id = typeof rec.id === "string" ? rec.id : "";
  if (!id) return null;
  return {
    id,
    number: typeof rec.number === "string" ? rec.number : "",
    status: typeof rec.status === "string" ? rec.status : "draft",
    total: Number(rec.total) || 0,
    amountPaid: Number(rec.amountPaid) || 0,
    balanceDue: Number(rec.balanceDue) || 0,
    dueAt: typeof rec.dueAt === "string" ? rec.dueAt : null,
  };
}

export interface ProviderOrder {
  /** Invoice created from this order (Pro view; customer once sent). */
  invoice?: OrderInvoiceSummary | null;
  /** Assigned employees / contractors (Pro + crew views; absent for customers). */
  crew?: OrderCrew;
  crewCompletion?: OrderCrewCompletion;
  id: string;
  orderNumber: string;
  bookingId?: string;
  customerId?: string;
  providerId?: string;
  serviceId?: string;
  status: ProviderOrderStatus | string;
  pricing: ProviderOrderPricing;
  payment: ProviderOrderPayment;
  address: ProviderOrderAddress;
  booking?: ProviderBookingSnapshot;
  service?: ProviderOrderServiceSnapshot;
  customer?: ProviderOrderCustomerSnapshot;
  changeOrders?: ProviderChangeOrderItem[];
  completionDetails?: ProviderCompletionDetails;
  rejectionReason?: string;
  cancellationReason?: string;
  transitCoordinates?: [number, number];
  arrivedCoordinates?: [number, number];
  createdAt: string;
  updatedAt: string;
}

export interface ProviderOrdersPagination {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ProviderOrdersListResponse {
  orders: ProviderOrder[];
  pagination: ProviderOrdersPagination;
}

export interface ProviderOrdersQueryParams {
  page?: number;
  limit?: number;
  status?: ProviderOrderStatus | string;
  search?: string;
  force?: boolean;
}

// Action Payloads
export interface RejectOrderPayload {
  id: string;
  rejectionReason?: string;
  reason: string;
}

export interface TransitOrderPayload {
  id: string;
  startCoordinates: [number, number]; // [longitude, latitude]
}

export interface ArriveOrderPayload {
  id: string;
  coordinates: [number, number]; // [longitude, latitude]
}

export interface ProposeChangeOrderPayload {
  id: string;
  description: string;
  reason: string;
  additionalAmount: number;
  evidencePhotos?: string[];
}

export interface CompleteOrderPayload {
  id: string;
  completionNotes: string;
  beforePhotos?: string[];
  afterPhotos: string[];
}

export interface CancelOrderPayload {
  id: string;
  reason: string;
}
