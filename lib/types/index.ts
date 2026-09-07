export type UserRole = "customer" | "provider" | "admin";

export type UserStatus = "active" | "invited" | "suspended";

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  role: UserRole;
  status: UserStatus;
  avatarUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Customer {
  id: string;
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  addresses: ServiceAddress[];
  createdAt: string;
  updatedAt: string;
}

export interface ServiceAddress {
  id: string;
  label?: string;
  street: string;
  unit?: string;
  city: string;
  state: string;
  zip: string;
  country: "US";
}

export type ServiceCategorySlug =
  | "plumbing"
  | "hvac"
  | "electrical"
  | "handyman"
  | "house-cleaning"
  | "roofing"
  | "landscaping"
  | "painting"
  | "bathroom-remodeling"
  | "pest-control";

export interface ServiceCategory {
  id: string;
  slug: ServiceCategorySlug;
  name: string;
  shortName: string;
  tagline: string;
  description: string;
  longDescription: string;
  commonServices: string[];
  benefits: string[];
  seoTitle: string;
  seoDescription: string;
  icon: string;
  /** Public path to the category hero image. Replaceable by CMS-managed media later. */
  image?: string;
  imageAlt?: string;
}

export interface Service {
  id: string;
  categoryId: string;
  name: string;
  slug: string;
  description: string;
}

export type RequestStatus =
  | "new"
  | "viewed"
  | "contacted"
  | "estimate_sent"
  | "accepted"
  | "declined"
  | "converted_to_job"
  | "closed";

export type RequestChannel = "marketplace" | "direct";

export interface ServiceRequest {
  id: string;
  customerId?: string;
  providerId?: string;
  categoryId: string;
  channel: RequestChannel;
  zip: string;
  city?: string;
  state?: string;
  details: string;
  preferredDate?: string;
  preferredTimeWindow?: string;
  photoUrls: string[];
  status: RequestStatus;
  createdAt: string;
  updatedAt: string;
}

export type EstimateStatus =
  | "site_visit"
  | "inspected"
  | "draft"
  | "finalized"
  | "sent"
  | "accepted"
  | "rejected"
  | "expired"
  | "changes_requested";

export type EstimateItemType = "labor" | "materials" | "services" | "miscellaneous";

export interface EstimateItem {
  id: string;
  estimateId: string;
  type: EstimateItemType;
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  taxRate: number;
  discount: number;
  total: number;
}

export interface Estimate {
  id: string;
  number: string;
  providerId: string;
  customerId: string;
  requestId?: string;
  serviceId?: string;
  propertyAddress: ServiceAddress;
  status: EstimateStatus;
  issuedAt: string;
  expiresAt?: string;
  notes?: string;
  terms?: string;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  items: EstimateItem[];
  signature?: EstimateSignature;
  createdAt: string;
  updatedAt: string;
}

export interface EstimateSignature {
  signedBy: string;
  signedAt: string;
  ipAddress?: string;
}

export type JobStatus =
  | "unscheduled"
  | "scheduled"
  | "dispatched"
  | "en_route"
  | "on_site"
  | "in_progress"
  | "on_hold"
  | "waiting_parts"
  | "needs_return"
  | "completed"
  | "invoiced"
  | "paid"
  | "cancelled";

export interface JobItem {
  id: string;
  jobId: string;
  source: "estimate" | "change_order";
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  total: number;
}

export interface ChangeOrder {
  id: string;
  jobId: string;
  number: string;
  description: string;
  status: "draft" | "pending_approval" | "approved" | "rejected";
  items: JobItem[];
  total: number;
  createdAt: string;
  updatedAt: string;
}

export interface Job {
  id: string;
  number: string;
  providerId: string;
  customerId: string;
  estimateId: string;
  serviceId?: string;
  address: ServiceAddress;
  assignedTo?: string;
  scheduledAt?: string;
  dueAt?: string;
  status: JobStatus;
  notes?: string;
  items: JobItem[];
  changeOrders: ChangeOrder[];
  invoiceId?: string;
  createdAt: string;
  updatedAt: string;
}

export type InvoiceStatus =
  | "draft"
  | "sent"
  | "partially_paid"
  | "paid"
  | "overdue"
  | "cancelled";

export interface InvoiceItem {
  id: string;
  invoiceId: string;
  source: "estimate" | "change_order" | "adjustment";
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface Invoice {
  id: string;
  number: string;
  providerId: string;
  customerId: string;
  jobId: string;
  status: InvoiceStatus;
  issuedAt: string;
  dueAt?: string;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  amountPaid: number;
  balanceDue: number;
  items: InvoiceItem[];
  createdAt: string;
  updatedAt: string;
}

export type PaymentMethodType = "card" | "ach" | "check" | "cash";

export type PaymentStatus = "pending" | "processing" | "succeeded" | "failed" | "refunded";

export interface Payment {
  id: string;
  invoiceId: string;
  scheduleId?: string;
  amount: number;
  method: PaymentMethodType;
  status: PaymentStatus;
  paidAt?: string;
  createdAt: string;
}

export type PaymentScheduleType = "upfront" | "completion" | "milestone";

export interface PaymentScheduleItem {
  id: string;
  label: string;
  percent?: number;
  amount: number;
  due: "on_approval" | "on_start" | "on_progress" | "on_completion" | "custom";
  dueAt?: string;
}

export interface PaymentSchedule {
  id: string;
  invoiceId: string;
  type: PaymentScheduleType;
  items: PaymentScheduleItem[];
}

export type BillingInterval = "month" | "year";

export interface SubscriptionPlan {
  id: string;
  name: string;
  slug: string;
  description: string;
  price: number;
  currency: "USD";
  interval: BillingInterval;
  features: string[];
  limits: Record<string, number | string | boolean>;
  highlighted?: boolean;
  ctaLabel: string;
  isActive: boolean;
  sortOrder: number;
}

export type SubscriptionStatus =
  | "trialing"
  | "active"
  | "past_due"
  | "canceled"
  | "incomplete";

export interface Subscription {
  id: string;
  providerId: string;
  planId: string;
  status: SubscriptionStatus;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface WorkingHours {
  day:
    | "monday"
    | "tuesday"
    | "wednesday"
    | "thursday"
    | "friday"
    | "saturday"
    | "sunday";
  open: string | null;
  close: string | null;
  closed: boolean;
}

export interface Review {
  id: string;
  providerId: string;
  customerName: string;
  rating: number;
  title?: string;
  body: string;
  serviceName?: string;
  createdAt: string;
  isDemo: boolean;
}

export interface Provider {
  id: string;
  slug: string;
  companyName: string;
  logoInitials: string;
  logoUrl?: string;
  /** Optional card cover photo. Falls back to the first category image. */
  coverImage?: string;
  /** Extra portfolio photos. Combined with cover and category images for the swiper. */
  images?: string[];
  /** Starting / base price in USD. */
  startingPrice?: number;
  tagline: string;
  description: string;
  rating: number;
  reviewCount: number;
  yearsInBusiness: number;
  licensed: boolean;
  insured: boolean;
  categoryIds: string[];
  serviceArea: string[];
  street: string;
  city: string;
  state: string;
  zip: string;
  lat: number;
  lng: number;
  phone: string;
  email: string;
  website?: string;
  contact?: {
    name: string;
    role: string;
  };
  social?: {
    facebook?: string;
    google?: string;
    instagram?: string;
    x?: string;
  };
  workingHours: WorkingHours[];
  gallery: string[];
  foundedYear: number;
  employeeCount: string;
  reviews: Review[];
  featured?: boolean;
}

export interface ProviderProject {
  slug: string;
  title: string;
  summary: string;
  location: string;
  completedOn: string;
  categoryName: string;
  cover: string;
  images: string[];
  details: string[];
}

export type BlogCategorySlug =
  | "homeowners"
  | "service-business"
  | "platform"
  | "maintenance";

export interface BlogCategory {
  id: string;
  slug: BlogCategorySlug;
  name: string;
  description: string;
}

export interface BlogAuthor {
  id: string;
  name: string;
  role: string;
  initials: string;
}

export interface BlogPost {
  id: string;
  slug: string;
  title: string;
  description: string;
  content: string[];
  categoryId: string;
  authorId: string;
  publishedAt: string;
  updatedAt: string;
  readTimeMinutes: number;
  imageAlt: string;
  image?: string;
  featured?: boolean;
}

export interface FaqItem {
  id: string;
  question: string;
  answer: string;
  category:
    | "customers"
    | "providers"
    | "bookings"
    | "estimates"
    | "payments"
    | "subscriptions"
    | "jobs";
}

export interface Testimonial {
  id: string;
  quote: string;
  name: string;
  role: string;
  company?: string;
  audience: "customer" | "provider";
  isDemo: true;
}

export interface NavItem {
  label: string;
  href: string;
  description?: string;
}
