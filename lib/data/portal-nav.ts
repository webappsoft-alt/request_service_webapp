import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  Bot,
  Bell,
  Briefcase,
  Building2,
  CalendarDays,
  ClipboardList,
  CreditCard,
  Handshake,
  Images,
  Inbox,
  LayoutDashboard,
  ListTodo,
  MapPin,
  MapPinned,
  MessageCircle,
  Sparkles,
  Receipt,
  Store,
  Timer,
  UserRound,
  Users,
  Wallet,
  Wrench,
} from "lucide-react";

export type PortalNavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** One line shown in the sidebar hover card. */
  description?: string;
  /** Nested links shown under the item in the expanded sidebar. */
  children?: { href: string; label: string }[];
};

export type PortalNavGroup = {
  id: string;
  label?: string;
  items: PortalNavItem[];
};

export const portalNavGroups: PortalNavGroup[] = [
  {
    id: "home",
    items: [{ href: "/pro/dashboard", label: "Dashboard", icon: LayoutDashboard, description: "Today at a glance: sales, work and money" }],
  },
  {
    id: "people",
    label: "People",
    items: [
      { href: "/pro/dashboard/customers", label: "Customers", icon: Users, description: "Customer records, properties and history" },
      { href: "/pro/dashboard/team", label: "Employees", icon: UserRound, description: "Your technicians, roles and logins" },
      { href: "/pro/dashboard/contractors", label: "Contractors", icon: Handshake, description: "Subcontractors you assign work to" },
      { href: "/pro/dashboard/vendors", label: "Vendors", icon: Building2, description: "Suppliers and purchase orders" },
      { href: "/pro/dashboard/timesheets", label: "Timesheets", icon: Timer, description: "Hours logged by your team" },
      { href: "/pro/dashboard/tracking", label: "Employee tracking", icon: MapPinned, description: "Live location of employees in the field" },
      { href: "/pro/dashboard/reminders", label: "Reminders", icon: Bell, description: "Follow-ups and to-dos you scheduled" },
    ],
  },
  {
    id: "work",
    label: "Work",
    items: [
      { href: "/pro/dashboard/requests", label: "Leads", icon: Inbox, description: "New and open customer requests" },
      { href: "/pro/dashboard/messages", label: "Messages", icon: MessageCircle, description: "Customer and team conversations" },
      // Classic estimates — hidden for demo; use /new-estimate (labeled "Estimate") instead.
      // { href: "/pro/dashboard/estimates", label: "Estimates", icon: FileText },
      {
        href: "/pro/dashboard/new-estimate",
        label: "Estimate",
        description: "Build, send and track estimates",
        icon: ClipboardList,
        children: [
          { href: "/pro/dashboard/new-estimate", label: "All estimates" },
          { href: "/pro/dashboard/templates", label: "Estimate templates" },
        ],
      },
      { href: "/pro/dashboard/jobs", label: "Jobs", icon: Briefcase, description: "Scheduled and in-progress work" },
      { href: "/pro/dashboard/tasks", label: "Tasks", icon: ListTodo, description: "Tasks across customers and jobs" },
      { href: "/pro/dashboard/schedule", label: "Schedules", icon: CalendarDays, description: "Calendar of visits, jobs and stages" },
      { href: "/pro/dashboard/orders", label: "Fixed service orders", icon: ClipboardList, description: "Bookings for your fixed-price services" },
    ],
  },
  {
    id: "money",
    label: "Money",
    items: [
      { href: "/pro/dashboard/invoices", label: "Invoices", icon: Receipt, description: "Bill customers and track balances" },
      { href: "/pro/dashboard/payments", label: "Payments", icon: CreditCard, description: "Payments received from customers" },
    ],
  },
  {
    id: "setup",
    label: "Office",
    items: [
      { href: "/pro/dashboard/settings", label: "Business Profile", icon: Store, description: "Your public profile and business details" },
      { href: "/pro/dashboard/subscription", label: "Subscription", icon: Sparkles, description: "Your plan and billing" },
      { href: "/pro/dashboard/ai-receptionist", label: "AI Receptionist", icon: Bot, description: "AI that answers calls and books visits" },
      { href: "/pro/dashboard/portfolio", label: "Portfolio", icon: Images, description: "Photos of your past work" },
      { href: "/pro/dashboard/service-areas", label: "Service areas", icon: MapPin, description: "Where you take work" },
      { href: "/pro/dashboard/services", label: "Fixed services", icon: Wrench, description: "Fixed-price services customers can book" },
      { href: "/pro/dashboard/billing", label: "Utilities", icon: Wallet, description: "Tax, payment and app utilities" },
      { href: "/pro/dashboard/reports", label: "Reports", icon: BarChart3, description: "Sales, job and team reports" },
    ],
  },
];

export const dashboardViews = [
  { href: "/pro/dashboard", label: "Main" },
  { href: "/pro/dashboard/sales", label: "Sales" },
  { href: "/pro/dashboard/service", label: "Service" },
] as const;

export function isDashboardPath(pathname: string) {
  return pathname === "/pro/dashboard" || pathname === "/pro/dashboard/sales" || pathname === "/pro/dashboard/service";
}

export const portalNav: PortalNavItem[] = portalNavGroups.flatMap((group) => group.items);

export const peopleSubnav: { href: string; label: string }[] = [
  { href: "/pro/dashboard/customers", label: "Customers" },
  { href: "/pro/dashboard/team", label: "Employees" },
  { href: "/pro/dashboard/contractors", label: "Contractors" },
  { href: "/pro/dashboard/vendors", label: "Vendors" },
  { href: "/pro/dashboard/timesheets", label: "Timesheets" },
  { href: "/pro/dashboard/tracking", label: "Tracking" },
  { href: "/pro/dashboard/reminders", label: "Reminders" },
];

export const workSubnav: { href: string; label: string }[] = [
  { href: "/pro/dashboard/requests", label: "Leads" },
  { href: "/pro/dashboard/messages", label: "Messages" },
  // Classic estimates — hidden for demo; use /new-estimate (labeled "Estimate") instead.
  // { href: "/pro/dashboard/estimates", label: "Estimates" },
  { href: "/pro/dashboard/new-estimate", label: "Estimate" },
  { href: "/pro/dashboard/templates", label: "Estimate templates" },
  { href: "/pro/dashboard/jobs", label: "Jobs" },
  { href: "/pro/dashboard/tasks", label: "Tasks" },
  { href: "/pro/dashboard/schedule", label: "Schedules" },
  { href: "/pro/dashboard/orders", label: "Fixed service orders" },
];

export const portalAccountNav: PortalNavItem[] = [
  { href: "/pro/dashboard/settings", label: "Business Profile", icon: Store },
];

export function isPeoplePath(pathname: string) {
  return peopleSubnav.some((item) => pathname === item.href || pathname.startsWith(`${item.href}/`));
}

export function isWorkPath(pathname: string) {
  return workSubnav.some((item) => pathname === item.href || pathname.startsWith(`${item.href}/`));
}
