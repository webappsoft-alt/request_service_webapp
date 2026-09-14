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

export const blogPosts: BlogPost[] = [];

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
  return [];
}

export function searchBlogPosts(query: string) {
  return [];
}
