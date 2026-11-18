import {
  ClipboardList,
  CreditCard,
  FileDiff,
  FileText,
  // Home, — Back to site item (commented out)
  Inbox,
  LayoutDashboard,
  // LifeBuoy, — Support moved to the avatar menu
  // MessageCircle, — Messages moved to the header icon
  Receipt,
  // Settings, — Settings moved to the avatar menu
  type LucideIcon,
} from "lucide-react";
import { customerPaths } from "@/lib/customer-paths";

export type CustomerNavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** One line shown in the sidebar hover card. */
  description?: string;
  /** External/marketing navigation (not an account section). */
  external?: boolean;
  /** Other sections that also highlight this item and add to its badge (e.g. change orders → Orders). */
  matchAlso?: string[];
  /** Nested links: the item becomes a dropdown in the expanded sidebar. */
  children?: { href: string; label: string; icon?: LucideIcon; description?: string }[];
};

export type CustomerNavGroup = {
  id: string;
  label?: string;
  items: CustomerNavItem[];
};

/**
 * Customer sidebar (client: fewer, cleaner options — SaaS customer-portal standard).
 * Dashboard · Projects (Quote Requests, Estimates, Orders) · Billing (Invoices, Payments) ·
 * Help (Messages, Support) · Settings. Orders is a dropdown (All orders, Change orders); "Back to
 * site" lives in the top bar / mobile menu footer, not here.
 * Every route is unchanged. Previous config is kept below as a comment.
 */
export const customerNavGroups: CustomerNavGroup[] = [
  {
    id: "home",
    items: [
      {
        href: customerPaths.dashboard,
        label: "Dashboard", // was "Overview" (client: rename to Dashboard)
        icon: LayoutDashboard,
        description: "Your projects, spending and latest activity",
      },
    ],
  },
  {
    id: "projects",
    label: "Projects",
    items: [
      { href: customerPaths.requests, label: "Quote Requests", icon: Inbox, description: "Requests you sent and the quotes received" },
      { href: customerPaths.estimates, label: "Estimates", icon: FileText, description: "Review, accept or ask for changes" },
      {
        href: customerPaths.orders,
        label: "Orders",
        icon: ClipboardList,
        description: "Active projects, booked services and change orders",
        // Dropdown again (client: "Orders dropdown with Orders and Change orders in it").
        // Interim version used a single link: matchAlso: [customerPaths.changeOrders].
        children: [
          { href: customerPaths.orders, label: "All orders", description: "Booked services and their status" },
          {
            href: customerPaths.changeOrders,
            label: "Change orders",
            icon: FileDiff,
            description: "Changes to approved work that need your OK",
          },
        ],
      },
    ],
  },
  {
    id: "billing",
    label: "Billing",
    items: [
      { href: customerPaths.invoices, label: "Invoices", icon: Receipt, description: "Bills from your pros and what is due" },
      { href: customerPaths.payments, label: "Payments", icon: CreditCard, description: "Payments you have made" },
    ],
  },
  // Client: Messages is a header icon now (with unread badge), Settings + Support are in the
  // avatar menu — so this group left the sidebar.
  // {
  //   // Client: Settings and Support moved to the avatar menu (top right); only Messages stays here.
  //   id: "inbox",
  //   label: "Inbox",
  //   items: [
  //     { href: customerPaths.messages, label: "Messages", icon: MessageCircle, description: "Chats with your pros and support" },
  //     // { href: customerPaths.support, label: "Support", icon: LifeBuoy, description: "Get help from the Request Services team" },
  //   ],
  // },
  // {
  //   id: "account",
  //   label: "Account",
  //   items: [{ href: customerPaths.settings, label: "Settings", icon: Settings, description: "Profile, password and notifications" }],
  // },
];

/* Previous sidebar config (Activity group with an Orders dropdown, plus "Back to site"):
   export const customerNavGroups: CustomerNavGroup[] = [
     {
       id: "home",
       items: [
         {
           href: customerPaths.dashboard,
           label: "Overview",
           icon: LayoutDashboard,
           description: "Your projects, spending and latest activity",
         },
       ],
     },
     {
       id: "activity",
       label: "Activity",
       items: [
         { href: customerPaths.requests, label: "Quote Requests", icon: Inbox, description: "Requests you sent and the quotes received" },
         { href: customerPaths.estimates, label: "Estimates", icon: FileText, description: "Review, accept or ask for changes" },
         {
           href: customerPaths.orders,
           label: "Orders",
           icon: ClipboardList,
           description: "Booked services and change orders",
           children: [
             { href: customerPaths.orders, label: "All orders", description: "Booked services and their status" },
             { href: customerPaths.changeOrders, label: "Change orders", icon: FileDiff, description: "Changes to approved work that need your OK" },
           ],
         },
         { href: customerPaths.invoices, label: "Invoices", icon: Receipt, description: "Bills from your pros and what is due" },
         { href: customerPaths.payments, label: "Payments", icon: CreditCard, description: "Payments you have made" },
         { href: customerPaths.messages, label: "Messages", icon: MessageCircle, description: "Chats with your pros and support" },
         { href: customerPaths.support, label: "Support", icon: LifeBuoy, description: "Get help from the Request Services team" },
       ],
     },
     {
       id: "account",
       label: "Account",
       items: [
         { href: customerPaths.settings, label: "Settings", icon: Settings, description: "Profile, password and notifications" },
         {
           href: customerPaths.site,
           label: "Back to site",
           icon: Home,
           description: "Return to the Request Services home page",
           external: true,
         },
       ],
     },
   ];
*/

export function isCustomerOverviewPath(pathname: string) {
  return pathname === customerPaths.dashboard;
}

export const customerNav: CustomerNavItem[] = customerNavGroups.flatMap(
  (group) => group.items,
);
