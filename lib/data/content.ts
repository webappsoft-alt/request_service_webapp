import type { FaqItem, Testimonial } from "@/lib/types";

export const faqs: FaqItem[] = [
  {
    id: "faq_c_1",
    category: "customers",
    question: "How do I find a service professional?",
    answer:
      "Choose a service category, enter your ZIP code, and submit a request — or browse the marketplace and open a specific provider profile. Both paths use the same professional request details.",
  },
  {
    id: "faq_c_2",
    category: "customers",
    question: "Is Request Services available nationwide?",
    answer:
      "The public website is built for a USA-focused marketplace. Matching depends on providers who serve your ZIP code. Coverage expands as local businesses join the platform.",
  },
  {
    id: "faq_c_3",
    category: "customers",
    question: "Do I need an account to request service?",
    answer:
      "You can start a request from the public site. Creating a customer account lets you review estimates, approve work, and keep job history in one place.",
  },
  {
    id: "faq_p_1",
    category: "providers",
    question: "Who can join as a service provider?",
    answer:
      "Local home-service businesses in supported categories can create a profile, subscribe, and receive opportunities that match their services and service area.",
  },
  {
    id: "faq_p_2",
    category: "providers",
    question: "Do customers subscribe to Request Services?",
    answer:
      "No. Only service providers subscribe to the business portal. Customers use the marketplace to find and request professionals.",
  },
  {
    id: "faq_p_3",
    category: "providers",
    question: "When do I get access to the provider portal?",
    answer:
      "After registration and an active subscription, the provider dashboard, requests, estimates, jobs, invoices, and reports become available. Portal access is determined by subscription status.",
  },
  {
    id: "faq_p_4",
    category: "providers",
    question: "Do you take a commission on the jobs I win?",
    answer:
      "No. You pay a monthly subscription for the public profile and the portal. There is no commission on the work you quote, schedule, or collect.",
  },
  {
    id: "faq_p_5",
    category: "providers",
    question: "How do new jobs reach my inbox?",
    answer:
      "Two ways. Homeowners request a trade and ZIP, and matching companies in that area see it. Or they open your public profile and request you by name. Both land on the same job file.",
  },
  {
    id: "faq_p_6",
    category: "providers",
    question: "Can customers book a time on my profile?",
    answer:
      "Yes. Online booking uses the working hours you set. They pick a slot, and it becomes a request on the same record you estimate from.",
  },
  {
    id: "faq_p_7",
    category: "providers",
    question: "What happens if the job needs extra work?",
    answer:
      "Add a change order. The original signed estimate stays as they approved it. Extra labor or materials need their own approval before they hit the invoice.",
  },
  {
    id: "faq_p_8",
    category: "providers",
    question: "Can I add technicians and more than one shop?",
    answer:
      "Yes. Team members get seats on the roster, and you can run more than one location, each with its own service area, from the same login.",
  },
  {
    id: "faq_p_9",
    category: "providers",
    question: "Can I cancel whenever I want?",
    answer:
      "Yes. There is no setup fee and no annual lock-in on the listed plans. Cancel from billing. You keep the job history already on the account.",
  },
  {
    id: "faq_p_10",
    category: "providers",
    question: "Is this ready for a real crew, or is it a demo?",
    answer:
      "The public site and portal you see now are a working front-end of the product. Subscriptions, payments, and matching connect when the live backend is attached — the workflow does not change.",
  },
  {
    id: "faq_b_1",
    category: "bookings",
    question: "What is the difference between a marketplace request and a direct booking?",
    answer:
      "A marketplace request is matched to providers who offer that service in your area. A direct booking is sent to one company you selected from their public profile.",
  },
  {
    id: "faq_b_2",
    category: "bookings",
    question: "Can I include photos with my request?",
    answer:
      "Yes. Additional details and photos help professionals scope the work before they send an estimate.",
  },
  {
    id: "faq_e_1",
    category: "estimates",
    question: "Do I have to accept the first estimate I receive?",
    answer:
      "No. You can review line items, pricing, and terms before you approve, reject, or request changes.",
  },
  {
    id: "faq_e_2",
    category: "estimates",
    question: "What happens after I approve an estimate?",
    answer:
      "An approved and signed estimate becomes a job. The original estimate is retained so later materials or change orders do not overwrite it.",
  },
  {
    id: "faq_pay_1",
    category: "payments",
    question: "Can a job be paid in more than one payment?",
    answer:
      "Yes. The payment model supports deposits, completion payments, and milestone schedules such as 30/40/30. Each payment is recorded against the invoice balance.",
  },
  {
    id: "faq_pay_2",
    category: "payments",
    question: "Where do I see what I still owe?",
    answer:
      "The invoice shows total, amount paid, and balance due. Payment history is kept with the job so deposits and remaining balances stay visible.",
  },
  {
    id: "faq_s_1",
    category: "subscriptions",
    question: "Are the listed prices final?",
    answer:
      "No. Current plan prices are placeholders. Plans are designed to be configured later through backend and admin settings rather than hard-coded into the interface.",
  },
  {
    id: "faq_s_2",
    category: "subscriptions",
    question: "Can I change plans later?",
    answer:
      "Yes. The provider portal is designed to support upgrades, downgrades, cancellation, and billing history once subscriptions are connected.",
  },
  {
    id: "faq_j_1",
    category: "jobs",
    question: "What if extra materials are needed after work starts?",
    answer:
      "Additional materials or labor are added as a change order. The original estimate stays in place, and customer approval can be required for the extra work.",
  },
  {
    id: "faq_j_2",
    category: "jobs",
    question: "How do invoices relate to jobs?",
    answer:
      "After work is completed, a provider can generate an invoice from the original estimate plus any approved additional charges. That invoice then tracks payments and remaining balance.",
  },
];

export const faqCategories = [
  { id: "customers", label: "Customers" },
  { id: "providers", label: "Providers" },
  { id: "bookings", label: "Bookings" },
  { id: "estimates", label: "Estimates" },
  { id: "payments", label: "Payments" },
  { id: "subscriptions", label: "Subscriptions" },
  { id: "jobs", label: "Jobs" },
] as const;

export function getFaqsByCategory(category: FaqItem["category"]) {
  return faqs.filter((item) => item.category === category);
}

export const testimonials: Testimonial[] = [
  {
    id: "t_customer_1",
    quote:
      "I submitted a plumbing request with photos and received a written estimate I could actually understand before anyone arrived.",
    name: "Lauren C.",
    role: "Homeowner",
    company: "Austin, TX",
    audience: "customer",
    isDemo: true,
  },
  {
    id: "t_customer_2",
    quote:
      "Booking from the company profile felt more professional than calling around. The scope and timing were in writing.",
    name: "Marcus T.",
    role: "Homeowner",
    company: "Boston, MA",
    audience: "customer",
    isDemo: true,
  },
  {
    id: "t_provider_1",
    quote:
      "The workflow from request to estimate to job is what we already try to run on paper. Seeing it structured this way is the reason we would subscribe.",
    name: "Diana Hale",
    role: "Owner",
    company: "Harbor Electric (demo)",
    audience: "provider",
    isDemo: true,
  },
  {
    id: "t_provider_2",
    quote:
      "Change orders are the difference between a clean job and an argument. Keeping the original estimate intact is the right operating model.",
    name: "Chris Nguyen",
    role: "Operations Manager",
    company: "Summit Home Systems (demo)",
    audience: "provider",
    isDemo: true,
  },
];
