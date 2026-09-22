import {
  ClipboardList,
  FileText,
  Home,
  Inbox,
  LayoutDashboard,
  MessageCircle,
  Receipt,
  Settings,
  type LucideIcon,
} from "lucide-react";
import { customerPaths } from "@/lib/customer-paths";

export type CustomerNavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** External/marketing navigation (not an account section). */
  external?: boolean;
};

export type CustomerNavGroup = {
  id: string;
  label?: string;
  items: CustomerNavItem[];
};

export const customerNavGroups: CustomerNavGroup[] = [
  {
    id: "home",
    items: [
      {
        href: customerPaths.dashboard,
        label: "Overview",
        icon: LayoutDashboard,
      },
    ],
  },
  {
    id: "activity",
    label: "Activity",
    items: [
      { href: customerPaths.orders, label: "Orders", icon: ClipboardList },
      { href: customerPaths.requests, label: "Requests", icon: Inbox },
      { href: customerPaths.estimates, label: "Estimates", icon: FileText },
      { href: customerPaths.invoices, label: "Invoices", icon: Receipt },
      { href: customerPaths.messages, label: "Messages", icon: MessageCircle },
    ],
  },
  {
    id: "account",
    label: "Account",
    items: [
      { href: customerPaths.settings, label: "Settings", icon: Settings },
      {
        href: customerPaths.site,
        label: "Back to site",
        icon: Home,
        external: true,
      },
    ],
  },
];

export function isCustomerOverviewPath(pathname: string) {
  return pathname === customerPaths.dashboard;
}

export const customerNav: CustomerNavItem[] = customerNavGroups.flatMap(
  (group) => group.items,
);
