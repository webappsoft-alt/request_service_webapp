import type { BlogAuthor, BlogCategory, BlogPost } from "@/lib/types";

export const blogCategories: BlogCategory[] = [
  {
    id: "blog_homeowners",
    slug: "homeowners",
    name: "For Homeowners",
    description: "Guides for requesting service, reviewing estimates, and hiring with confidence.",
  },
  {
    id: "blog_business",
    slug: "service-business",
    name: "For Service Businesses",
    description: "Operational guidance for estimates, jobs, invoices, and customer communication.",
  },
  {
    id: "blog_platform",
    slug: "platform",
    name: "Platform",
    description: "How Request Services works for customers and providers.",
  },
  {
    id: "blog_maintenance",
    slug: "maintenance",
    name: "Home Maintenance",
    description: "Seasonal and preventive maintenance topics across major home systems.",
  },
];

export const blogAuthors: BlogAuthor[] = [
  {
    id: "author_editorial",
    name: "Request Services Editorial",
    role: "Editorial Team",
    initials: "RS",
  },
  {
    id: "author_ops",
    name: "Operations Desk",
    role: "Provider Success",
    initials: "OD",
  },
];

export const blogPosts: BlogPost[] = [
  {
    id: "post_request_vs_direct",
    slug: "marketplace-request-vs-direct-booking",
    title: "When to submit a marketplace request vs. book a provider directly",
    description:
      "A practical guide to choosing between a ZIP-matched service request and booking a specific company from their public profile.",
    content: [
      "Homeowners on Request Services can start in two ways: submit a marketplace request, or open a provider profile and request that company directly.",
      "A marketplace request is useful when you know the service you need and your location, but you have not chosen a company yet. You select a category, enter a ZIP code, describe the work, and matching professionals can respond.",
      "Direct booking is better when you already know the company — perhaps from a previous job, a referral, or a profile you reviewed. You still provide the same job details, but the request is routed to that provider.",
      "In both cases, the next professional step is a written estimate. Approval and signature create a job record so the original quote is preserved even if materials or scope change later.",
      "This article uses demo process language for the public website. Actual matching, notifications, and payment processing will be connected as the provider portal comes online.",
    ],
    categoryId: "blog_homeowners",
    authorId: "author_editorial",
    publishedAt: "2026-06-12",
    updatedAt: "2026-06-12",
    readTimeMinutes: 6,
    imageAlt: "Homeowner checking nearby professionals on a phone",
    image: "/images/blog/blog-marketplace.jpg",
    featured: true,
  },
  {
    id: "post_reading_estimates",
    slug: "how-to-read-a-home-service-estimate",
    title: "How to read a home service estimate before you approve it",
    description:
      "What to look for in line items, materials, labor, taxes, and expiration dates so you can approve work with a clear record.",
    content: [
      "A professional estimate should be specific enough that you can approve it without guessing. Look for a property address, a service description, line items, and an expiration date.",
      "Labor, materials, and miscellaneous items should be separated. If a faucet replacement includes both the fixture and the labor, those should appear as distinct lines so later changes do not overwrite the original quote.",
      "Taxes and discounts should be calculated after the subtotal. If a deposit is required, it should appear as a payment schedule rather than an informal note.",
      "On Request Services, customer approval and electronic signature are designed to convert an accepted estimate into a job while keeping the original document intact.",
    ],
    categoryId: "blog_homeowners",
    authorId: "author_editorial",
    publishedAt: "2026-05-28",
    updatedAt: "2026-05-28",
    readTimeMinutes: 7,
    imageAlt: "Printed estimate with line items and totals",
    image: "/images/blog/blog-estimate.jpg",
    featured: true,
  },
  {
    id: "post_change_orders",
    slug: "why-change-orders-matter-on-home-service-jobs",
    title: "Why change orders matter when extra materials appear mid-job",
    description:
      "A bathroom faucet replacement can uncover extra piping. Here is how additional charges should be recorded without rewriting the original estimate.",
    content: [
      "Home service work often reveals conditions that were not visible at estimate time. A $300 faucet replacement may require an additional $75 in piping once the wall is opened.",
      "The original estimate should remain the source of truth for what was approved first. Additional materials and labor belong on a change order, not as an overwrite of the first quote.",
      "If customer approval is required for the extra work, that approval should be captured separately. The job then shows original estimate plus additional charges, which is the financial audit trail invoicing depends on.",
      "This is a core operating principle of Request Services and will be fully implemented in the provider portal.",
    ],
    categoryId: "blog_business",
    authorId: "author_ops",
    publishedAt: "2026-05-04",
    updatedAt: "2026-05-04",
    readTimeMinutes: 5,
    imageAlt: "Job materials staged beside a bathroom vanity",
    image: "/images/blog/blog-change-order.jpg",
    featured: true,
  },
  {
    id: "post_seasonal_hvac",
    slug: "seasonal-hvac-maintenance-checklist",
    title: "A seasonal HVAC maintenance checklist for homeowners",
    description:
      "Simple heating and cooling checks to request before peak season, plus what a professional visit typically includes.",
    content: [
      "Seasonal HVAC maintenance is one of the most common reasons homeowners request service. A visit typically includes filter guidance, system inspection, and a written note of anything that should be repaired before peak season.",
      "Request the work with your ZIP code and preferred window so matching local technicians can respond. If you already have a preferred company, open their profile and request them directly.",
      "Keep the estimate and job record. Next season, that history makes it easier to request the same professional again.",
    ],
    categoryId: "blog_maintenance",
    authorId: "author_editorial",
    publishedAt: "2026-04-16",
    updatedAt: "2026-04-16",
    readTimeMinutes: 4,
    imageAlt: "Technician checking an outdoor HVAC condenser",
    image: "/images/blog/blog-hvac.jpg",
  },
  {
    id: "post_provider_profile",
    slug: "what-belongs-on-a-professional-service-profile",
    title: "What belongs on a professional service business profile",
    description:
      "The public profile fields that help homeowners choose with confidence — and that later connect to the provider portal.",
    content: [
      "A public provider profile should include the company name, service categories, service area, a clear description, working hours, and evidence of work.",
      "Ratings and reviews should be presented honestly. On this Phase 1 website, sample reviews are labeled as demo content until live accounts publish real customer feedback.",
      "In Phase 2, the same profile fields will be managed from the provider portal so the marketplace page and the operating account stay aligned.",
    ],
    categoryId: "blog_platform",
    authorId: "author_ops",
    publishedAt: "2026-03-30",
    updatedAt: "2026-03-30",
    readTimeMinutes: 5,
    imageAlt: "Service professional reviewing a job on a tablet in a home",
    image: "/images/blog/blog-profile.jpg",
  },
  {
    id: "post_invoices_payments",
    slug: "deposits-progress-payments-and-balances",
    title: "Deposits, progress payments, and balances: a cleaner payment model",
    description:
      "Not every job is paid in one transfer. Here is how invoices, schedules, and multiple payments should work together.",
    content: [
      "A $2,000 job may start with a $500 deposit and a $1,500 balance. Another job may use 30% on approval, 40% at a midpoint, and 30% on completion.",
      "The invoice remains the financial parent. A payment schedule describes when amounts are due. Individual payments then reduce the balance.",
      "Request Services is designed around that model so providers can collect deposits without losing track of remaining balances, refunds, or overdue amounts.",
    ],
    categoryId: "blog_business",
    authorId: "author_ops",
    publishedAt: "2026-03-11",
    updatedAt: "2026-03-11",
    readTimeMinutes: 6,
    imageAlt: "Signing an approved estimate on a tablet",
    image: "/images/blog/blog-payments.jpg",
  },
];

export function getBlogCategoryById(id: string) {
  return blogCategories.find((category) => category.id === id);
}

export function getBlogCategoryBySlug(slug: string) {
  return blogCategories.find((category) => category.slug === slug);
}

export function getBlogAuthorById(id: string) {
  return blogAuthors.find((author) => author.id === id);
}

export function getBlogPostBySlug(slug: string) {
  return blogPosts.find((post) => post.slug === slug);
}

export function getPostsByCategory(categoryId: string) {
  return blogPosts.filter((post) => post.categoryId === categoryId);
}

export function getRelatedPosts(post: BlogPost, limit = 3) {
  return blogPosts
    .filter((item) => item.id !== post.id)
    .filter((item) => item.categoryId === post.categoryId)
    .concat(blogPosts.filter((item) => item.id !== post.id && item.categoryId !== post.categoryId))
    .slice(0, limit);
}

export function searchBlogPosts(query: string) {
  const value = query.trim().toLowerCase();
  if (!value) return blogPosts;
  return blogPosts.filter((post) => {
    const category = getBlogCategoryById(post.categoryId);
    return [post.title, post.description, category?.name, post.slug]
      .filter(Boolean)
      .some((field) => field!.toLowerCase().includes(value));
  });
}
