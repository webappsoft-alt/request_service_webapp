import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  Bell,
  Briefcase,
  Building2,
  CalendarDays,
  CreditCard,
  FileText,
  Handshake,
  Inbox,
  LayoutDashboard,
  ListTodo,
  MapPin,
  MessageCircle,
  Receipt,
  Settings,
  Store,
  UserRound,
  Users,
  Wallet,
  Wrench,
} from "lucide-react";

export type PortalNavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

export type PortalNavGroup = {
  id: string;
  label?: string;
  items: PortalNavItem[];
};

export const portalNavGroups: PortalNavGroup[] = [
  {
    id: "home",
    items: [{ href: "/pro/dashboard", label: "Dashboard", icon: LayoutDashboard }],
  },
  {
    id: "people",
    label: "People",
    items: [
      { href: "/pro/dashboard/customers", label: "Customers", icon: Users },
      { href: "/pro/dashboard/team", label: "Employees", icon: UserRound },
      { href: "/pro/dashboard/contractors", label: "Contractors", icon: Handshake },
      { href: "/pro/dashboard/vendors", label: "Vendors", icon: Building2 },
      { href: "/pro/dashboard/reminders", label: "Reminders", icon: Bell },
    ],
  },
  {
    id: "work",
    label: "Work",
    items: [
      { href: "/pro/dashboard/requests", label: "Leads", icon: Inbox },
      { href: "/pro/dashboard/messages", label: "Messages", icon: MessageCircle },
      { href: "/pro/dashboard/estimates", label: "Estimates", icon: FileText },
      { href: "/pro/dashboard/jobs", label: "Jobs", icon: Briefcase },
      { href: "/pro/dashboard/tasks", label: "Tasks", icon: ListTodo },
      { href: "/pro/dashboard/schedule", label: "Schedules", icon: CalendarDays },
    ],
  },
  {
    id: "money",
    label: "Money",
    items: [
      { href: "/pro/dashboard/invoices", label: "Invoices", icon: Receipt },
      { href: "/pro/dashboard/payments", label: "Payments", icon: CreditCard },
    ],
  },
  {
    id: "setup",
    label: "Office",
    items: [
      { href: "/pro/dashboard/services", label: "Fixed service", icon: Wrench },
      { href: "/pro/dashboard/service-areas", label: "Service areas", icon: MapPin },
      { href: "/pro/dashboard/reports", label: "Reports", icon: BarChart3 },
      { href: "/pro/dashboard/profile", label: "Documents", icon: Store },
      { href: "/pro/dashboard/billing", label: "Utilities", icon: Wallet },
      { href: "/pro/dashboard/settings", label: "Settings", icon: Settings },
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
  { href: "/pro/dashboard/reminders", label: "Reminders" },
];

export const workSubnav: { href: string; label: string }[] = [
  { href: "/pro/dashboard/requests", label: "Leads" },
  { href: "/pro/dashboard/messages", label: "Messages" },
  { href: "/pro/dashboard/estimates", label: "Estimates" },
  { href: "/pro/dashboard/jobs", label: "Jobs" },
  { href: "/pro/dashboard/tasks", label: "Tasks" },
  { href: "/pro/dashboard/schedule", label: "Schedules" },
];

export const portalAccountNav: PortalNavItem[] = [
  { href: "/pro/dashboard/profile", label: "Profile", icon: UserRound },
];

export function isPeoplePath(pathname: string) {
  return peopleSubnav.some((item) => pathname === item.href || pathname.startsWith(`${item.href}/`));
}

export function isWorkPath(pathname: string) {
  return workSubnav.some((item) => pathname === item.href || pathname.startsWith(`${item.href}/`));
}
