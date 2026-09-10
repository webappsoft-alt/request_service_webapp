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
