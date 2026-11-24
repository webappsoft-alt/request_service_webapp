import { proPaths } from "@/lib/pro-paths";

/**
 * Two blogs, one article store. The admin tags every article with an audience:
 *   customer → the customer blog (/blog) · pro → the Pro blog (/pros/blog) · both → listed on both.
 * Articles saved before the field existed fall back to their category (same rule as the API).
 */
export type BlogAudience = "customer" | "pro" | "both";
export type BlogSite = "customer" | "pro";

export const BLOG_BASE: Record<BlogSite, string> = {
  customer: "/blog",
  pro: `${proPaths.home}/blog`,
};

export function audienceForCategory(category?: string): BlogAudience {
  if (category === "For Service Businesses") return "pro";
  if (category === "Platform News") return "both";
  return "customer";
}

export function audienceOf(post: { audience?: string | null; category?: string }): BlogAudience {
  const value = post.audience;
  return value === "customer" || value === "pro" || value === "both"
    ? value
    : audienceForCategory(post.category);
}

/** Can this blog list / render the article? */
export function belongsTo(post: { audience?: string | null; category?: string }, site: BlogSite) {
  const audience = audienceOf(post);
  return audience === "both" || audience === site;
}

/** The blog an article is opened on: the current blog when it belongs there, else its own. */
export function siteForPost(post: { audience?: string | null; category?: string }, preferred: BlogSite): BlogSite {
  if (belongsTo(post, preferred)) return preferred;
  return audienceOf(post) === "pro" ? "pro" : "customer";
}

/**
 * Canonical blog for an article (sitemap, canonical tag, RSS). A "both" article lives on both
 * blogs, so the customer copy is canonical and the Pro copy points to it — no duplicate content.
 */
export function canonicalSite(post: { audience?: string | null; category?: string }): BlogSite {
  return audienceOf(post) === "pro" ? "pro" : "customer";
}

export const blogPaths = {
  index: (site: BlogSite) => BLOG_BASE[site],
  article: (site: BlogSite, slug: string) => `${BLOG_BASE[site]}/${slug}`,
  category: (site: BlogSite, categorySlug: string) => `${BLOG_BASE[site]}/category/${categorySlug}`,
};
