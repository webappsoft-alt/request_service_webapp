import type { NavItem } from "@/lib/types";

export const primaryNav: NavItem[] = [
  { label: "Home", href: "/", description: "Request Services homepage." },
  { label: "Services", href: "/services", description: "Browse home service categories." },
  {
    label: "Find a Professional",
    href: "/find-a-professional",
    description: "Search local providers by service and ZIP code.",
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
    { label: "Blog", href: "/blog" },
    { label: "How It Works", href: "/how-it-works" },
    { label: "FAQ", href: "/faq" },
    { label: "Customer Login", href: "/login" },
  ],
  providers: [
    { label: "For Service Providers", href: "/pro" },
    { label: "Provider Login", href: "/pro/login" },
    { label: "Create a Provider Account", href: "/pro/register" },
    { label: "Provider dashboard", href: "/pro/dashboard" },
  ],
  company: [
    { label: "About", href: "/about" },
    { label: "Blog", href: "/blog" },
    { label: "Contact", href: "/contact" },
    { label: "Sitemap", href: "/sitemap.xml" },
  ],
  legal: [
    { label: "Privacy Policy", href: "/privacy" },
    { label: "Terms of Service", href: "/terms" },
  ],
};

export const customerWorkflow = [
  { step: 1, title: "Choose a service", body: "Select the category that matches the work you need." },
  { step: 2, title: "Submit a request", body: "Add your ZIP code, details, timing, and photos if helpful." },
  { step: 3, title: "Connect with professionals", body: "Matching local providers review the request." },
  { step: 4, title: "Review the estimate", body: "Compare line items, materials, labor, and terms." },
  { step: 5, title: "Approve and sign", body: "Accept digitally. The original estimate is preserved." },
  { step: 6, title: "Get the work completed", body: "The approved estimate becomes a tracked job." },
  { step: 7, title: "Pay", body: "Pay a deposit, progress amount, or balance against the invoice." },
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
