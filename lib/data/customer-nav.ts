import {
  ClipboardList,
  CreditCard,
  FileDiff,
  FileText,
  Home,
  Inbox,
  LayoutDashboard,
  LifeBuoy,
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
  /** Nested links: the item becomes a dropdown in the expanded sidebar. */
  children?: { href: string; label: string; icon?: LucideIcon }[];
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
      { href: customerPaths.requests, label: "Quote Requests", icon: Inbox },
      { href: customerPaths.estimates, label: "Estimates", icon: FileText },
      {
        href: customerPaths.orders,
        label: "Orders",
        icon: ClipboardList,
        children: [
          { href: customerPaths.orders, label: "All orders" },
          { href: customerPaths.changeOrders, label: "Change orders", icon: FileDiff },
        ],
      },
      { href: customerPaths.invoices, label: "Invoices", icon: Receipt },
      { href: customerPaths.payments, label: "Payments", icon: CreditCard },
      { href: customerPaths.messages, label: "Messages", icon: MessageCircle },
      { href: customerPaths.support, label: "Support", icon: LifeBuoy },
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
