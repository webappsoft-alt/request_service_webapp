import type { NavItem } from "@/lib/types";
import { proPaths } from "@/lib/pro-paths";

export const primaryNav: NavItem[] = [
  { label: "Services", href: "/services", description: "Browse home service categories." },
  {
    label: "Find a Professional",
    href: "/find-a-professional",
    description: "Search local Pros by service and ZIP code.",
  },
  {
    label: "Get a quote",
    href: "/get-a-quote",
    description: "Answer a few job questions, then see matching local pros.",
  },
];

export const secondaryNav: NavItem[] = [
  { label: "How It Works", href: "/how-it-works" },
  { label: "About", href: "/about" },
  { label: "FAQ", href: "/faq" },
];

export const footerNav = {
  customers: [
    { label: "Find a Professional", href: "/find-a-professional" },
    { label: "Get a quote", href: "/get-a-quote" },
    { label: "Services", href: "/services" },
    { label: "Browse by City", href: "/locations" },
    { label: "How It Works", href: "/how-it-works" },
    // { label: "Customer Login", href: "/login" },
  ],
  providers: [
    { label: "For Pros", href: proPaths.home },
    { label: "Plans & Pricing", href: proPaths.pricing },
    { label: "Pro Login", href: "/pro/login" },
    { label: "Create a Pro Account", href: proPaths.join },
    { label: "Pro dashboard", href: "/pro/dashboard" },
  ],
  // Contact Us / FAQ sit under Company (no separate Support heading).
  company: [
    { label: "About", href: "/about" },
    { label: "Blog", href: "/blog" },
    { label: "Contact Us", href: "/contact" },
    { label: "FAQ", href: "/faq" },
  ],
  // Bottom bar: Privacy Policy · Terms of Service · Sitemap
  legal: [
    { label: "Privacy Policy", href: "/privacy" },
    { label: "Terms of Service", href: "/terms" },
    { label: "Sitemap", href: "/sitemap.xml" },
  ],
};

export const customerWorkflow = [
  { step: 1, title: "Choose a service", body: "Select the category that matches the work you need." },
  { step: 2, title: "Submit a request", body: "Add your ZIP, details, timing, and photos." },
  { step: 3, title: "Connect with professionals", body: "Matching local Pros review the request." },
  { step: 4, title: "Review the estimate", body: "Compare line items, materials, labor, and terms." },
  { step: 5, title: "Approve and sign", body: "Accept digitally. The original estimate is preserved." },
  { step: 6, title: "Get the work completed", body: "The approved estimate becomes a tracked job." },
  { step: 7, title: "Pay", body: "Pay deposit, progress, or balance on the invoice." },
];

export const providerWorkflow = [
  { step: 1, title: "Create a business profile", body: "Add services, service area, hours, and company details." },
  { step: 2, title: "Subscribe", body: "Choose a plan. Portal access follows subscription status." },
  { step: 3, title: "Receive opportunities", body: "Get requests that match your category and ZIP coverage." },
  { step: 4, title: "Contact the customer", body: "Clarify scope, timing, and site conditions." },
  { step: 5, title: "Create an estimate", body: "Itemize labor, materials, tax, and terms." },
  { step: 6, title: "Receive approval", body: "Customer review, approval, and electronic signature." },
  { step: 7, title: "Complete the job", body: "Track schedule, notes, photos, and extra materials." },
  { step: 8, title: "Invoice the customer", body: "Bill the original estimate plus approved change orders." },
  { step: 9, title: "Receive payment", body: "Collect deposits, progress payments, or completion balances." },
  { step: 10, title: "Track performance", body: "Review revenue, jobs, conversion, and outstanding invoices." },
];
