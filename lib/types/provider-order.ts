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

export interface ProviderOrder {
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
