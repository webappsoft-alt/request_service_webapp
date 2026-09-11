/** Fixed Service order / booking types — aligned with FIXED_SERVICE_ORDER_LIFECYCLE_INTEGRATION_GUIDE.md */

export type OrderStatus =
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

export type BookingStatus =
  | "CONFIRMED"
  | "IN_PROGRESS"
  | "FULFILLED"
  | "CANCELLED";

export type PaymentStatus =
  | "HOLD_AUTHORIZED"
  | "PAID"
  | "REFUNDED"
  | "FAILED";

export interface GeoLocationPoint {
  type: "Point";
  coordinates: [number, number]; // [longitude, latitude]
}

export interface OrderAddress {
  street: string;
  unit?: string;
  city: string;
  state: string;
  zip: string;
  location: GeoLocationPoint;
  notes?: string;
}

export interface OrderPricing {
  basePrice: number;
  changeOrdersTotal: number;
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  platformFee: number;
  totalAmount: number;
  currency: string;
}

export interface BookingSlot {
  startTime: string;
  endTime: string;
  bufferEndTime?: string;
  durationMinutes?: number;
  bufferMinutes?: number;
  isAvailable: boolean;
  disabledReason?: string | null;
}

export interface SlotAvailabilityResponse {
  date: string;
  serviceId: string;
  providerId?: string;
  duration: number;
  bufferMinutes: number;
  timezone?: string;
  slots: BookingSlot[];
  serviceName?: string;
  basePrice?: number;
}

export interface OrderCheckoutRequest {
  serviceId: string;
  startTime: string;
  duration?: number;
  address: {
    street: string;
    unit?: string;
    city: string;
    state?: string;
    zip: string;
    location: {
      type?: "Point";
      coordinates: [number, number];
    };
    notes?: string;
  };
  customerNotes?: string;
}

export interface OrderCheckoutBooking {
  id: string;
  providerId?: string;
  startTime: string;
  endTime: string;
  bufferEndTime?: string;
  status: BookingStatus | string;
}

export interface OrderCheckoutResult {
  order: {
    id: string;
    orderNumber: string;
    bookingId?: string;
    status: OrderStatus | string;
    pricing?: Partial<OrderPricing>;
    payment?: {
      status?: PaymentStatus | string;
      authorizationHoldId?: string;
    };
  };
  booking?: OrderCheckoutBooking;
  message: string;
}

/** Nested service summary on list/detail payloads. */
export interface CustomerOrderServiceSummary {
  id?: string;
  title: string;
  category?: string;
  subcategory?: string;
  unit?: string;
  quantity?: number | string;
  slug?: string;
  images?: string[];
  covered?: string[];
  basePrice?: number;
}

/** Nested provider summary on list/detail payloads. */
export interface CustomerOrderProviderSummary {
  id?: string;
  companyName: string;
  phone?: string;
  email?: string;
  slug?: string;
  website?: string;
  avatarUrl?: string;
}

/** Nested booking window on list/detail payloads. */
export interface CustomerOrderBookingSummary {
  id?: string;
  startTime: string;
  endTime: string;
  bufferEndTime?: string;
  status?: BookingStatus | string;
  duration?: number;
}

export interface ChangeOrderItem {
  id: string;
  description: string;
  additionalAmount: number;
  evidenceImages: string[];
  status: "PENDING" | "APPROVED" | "REJECTED" | string;
  requestedAt?: string;
  respondedAt?: string | null;
  customerNote?: string;
}

export interface LifecycleAuditEntry {
  fromStatus: string | null;
  toStatus: string;
  timestamp: string;
  triggeredBy?: string;
  notes?: string;
}

export interface CustomerSignOff {
  confirmed: boolean;
  signedAt?: string | null;
  signatureUrl?: string | null;
  rating?: number | null;
  review?: string;
}

export interface CompletionDetails {
  completedAt?: string | null;
  proofOfWorkImages: string[];
  proofOfWorkVideos?: string[];
  notes?: string;
  customerSignOff?: CustomerSignOff;
}

/** List card shape from `GET /api/orders`. */
export interface CustomerOrderListItem {
  id: string;
  orderNumber: string;
  status: OrderStatus | string;
  pricing: {
    totalAmount: number;
    currency: string;
    basePrice?: number;
    subtotal?: number;
  };
  service: CustomerOrderServiceSummary | null;
  provider: CustomerOrderProviderSummary | null;
  booking: CustomerOrderBookingSummary | null;
  address?: Partial<OrderAddress> | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface OrdersPagination {
  page: number;
  limit: number;
  totalDocs: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export interface CustomerOrdersListResult {
  orders: CustomerOrderListItem[];
  pagination: OrdersPagination;
}

/** Detail shape from `GET /api/orders/:id` (populated fields when API returns them). */
export interface CustomerOrderDetail {
  id: string;
  orderNumber: string;
  status: OrderStatus | string;
  bookingId?: string;
  customerId?: string;
  providerId?: string;
  serviceId?: string;
  pricing: Partial<OrderPricing> & {
    totalAmount: number;
    currency: string;
  };
  payment?: {
    status?: PaymentStatus | string;
    authorizationHoldId?: string;
  };
  address?: Partial<OrderAddress> | null;
  customerNotes?: string;
  service: CustomerOrderServiceSummary | null;
  provider: CustomerOrderProviderSummary | null;
  booking: CustomerOrderBookingSummary | null;
  changeOrders: ChangeOrderItem[];
  lifecycleAudit: LifecycleAuditEntry[];
  completionDetails?: CompletionDetails | null;
  createdAt?: string;
  updatedAt?: string;
}
