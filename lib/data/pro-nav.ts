import {
  BookMarked,
  Briefcase,
  Building2,
  CalendarDays,
  FileText,
  Inbox,
  MapPin,
  Receipt,
  Smartphone,
  Sparkles,
  Users,
  BarChart3,
} from "lucide-react";
import { serviceCategories } from "@/lib/data/services";
import { serviceIcons } from "@/lib/icons";
import { proPaths } from "@/lib/pro-paths";

export const proProductLinks = [
  {
    href: `${proPaths.home}#how-it-works`,
    label: "Job requests",
    hint: "Marketplace jobs and direct bookings",
    icon: Inbox,
  },
  {
    href: `${proPaths.home}#product`,
    label: "Online booking",
    hint: "Customers pick a slot on your profile",
    icon: CalendarDays,
  },
  {
    href: `${proPaths.home}#how-it-works`,
    label: "Estimates",
    hint: "Line items, signature, change orders",
    icon: FileText,
  },
  {
    href: `${proPaths.home}#how-it-works`,
    label: "Schedule",
    hint: "Calendar, crew, and the day",
    icon: MapPin,
  },
  {
    href: `${proPaths.home}#product`,
    label: "Jobs",
    hint: "The signed scope becomes the work",
    icon: Briefcase,
  },
  {
    href: `${proPaths.home}#product`,
    label: "Customers",
    hint: "History, addresses, and notes",
    icon: Users,
  },
  {
    href: `${proPaths.home}#product`,
    label: "Price book",
    hint: "Reusable labor and material lines",
    icon: BookMarked,
  },
  {
    href: `${proPaths.home}#product`,
    label: "Team and locations",
    hint: "Seats, shops, and service areas",
    icon: Building2,
  },
  {
    href: `${proPaths.home}#product`,
    label: "Mobile app",
    hint: "The job file on the phone",
    icon: Smartphone,
  },
  {
    href: `${proPaths.home}#product`,
    label: "Invoices and payments",
    hint: "Bill the signed file, track balances",
    icon: Receipt,
  },
  {
    href: `${proPaths.home}#product`,
    label: "Reporting",
    hint: "Volume, cash collected, aging",
    icon: BarChart3,
  },
  {
    href: `${proPaths.home}#product`,
    label: "AI tools",
    hint: "Draft scopes from the notes you keep",
    icon: Sparkles,
  },
] as const;

export const proResourceGroups = [
  {
    title: "The product",
    links: [
      { href: `${proPaths.home}#how-it-works`, label: "The portal", hint: "Inbox through payment" },
      { href: `${proPaths.home}#product`, label: "What’s included", hint: "Booking, jobs, the desk" },
      { href: `${proPaths.home}#plans`, label: "Pricing", hint: "Monthly, cancel anytime" },
      { href: `${proPaths.home}#faq`, label: "FAQ", hint: "Commission, booking, cancel" },
    ],
  },
  {
    title: "From the desk",
    links: [
      { href: "/blog", label: "Blog", hint: "Notes for service companies" },
      {
        href: "/blog/why-change-orders-matter-on-home-service-jobs",
        label: "Change orders",
        hint: "Keep the original estimate",
      },
      {
        href: "/blog/deposits-progress-payments-and-balances",
        label: "Deposits and balances",
        hint: "How the invoice stays the parent",
      },
      {
        href: "/blog/what-belongs-on-a-professional-service-profile",
        label: "Your public profile",
        hint: "What homeowners see",
      },
    ],
  },
] as const;

export const proResourceLinks: { href: string; label: string; hint: string }[] =
  proResourceGroups.flatMap((group) => [...group.links]);

export const proResourceFeature = {
  title: "Ready to run the desk?",
  body: "Public profile, inbox, and the crew in one login. No commission on the work you win.",
  href: proPaths.register,
  cta: "Join as a pro",
  secondaryHref: "/contact",
  secondary: "Talk to the team",
} as const;

export function getProIndustryLinks() {
  return serviceCategories.map((category) => ({
    href: `${proPaths.home}#process`,
    label: category.name,
    hint: category.tagline,
    icon: serviceIcons[category.slug],
    jobs: category.commonServices.slice(0, 3),
  }));
}
