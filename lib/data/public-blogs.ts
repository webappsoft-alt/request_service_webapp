import { publicApi } from "@/components/api/ApiRoutesFile";
import type {
  BlogsPagination,
  PublicBlogComment,
  PublicBlogItem,
  PublicBlogsResponse,
} from "@/lib/types";

export const BLOG_CATEGORIES = [
  { label: "All", value: "", slug: "all" },
  {
    label: "For Homeowners",
    value: "For Homeowners",
    slug: "homeowners",
    description: "Guides for requesting service, reviewing estimates, and hiring with confidence.",
  },
  {
    label: "For Service Businesses",
    value: "For Service Businesses",
    slug: "service-business",
    description: "Operational guidance for estimates, jobs, invoices, and customer communication.",
  },
  {
    label: "Platform News",
    value: "Platform News",
    slug: "platform",
    description: "How Request Service works for customers and providers.",
  },
  {
    label: "Home Maintenance",
    value: "Home Maintenance",
    slug: "maintenance",
    description: "Seasonal and preventive maintenance topics across major home systems.",
  },
] as const;

export function slugToCategoryName(slug?: string): string | undefined {
  if (!slug || slug === "all") return undefined;
  const match = BLOG_CATEGORIES.find(
    (c) => c.slug === slug || c.value.toLowerCase() === slug.toLowerCase(),
  );
  return match?.value;
}

export function categoryNameToSlug(name?: string): string {
  if (!name) return "all";
  const match = BLOG_CATEGORIES.find(
    (c) =>
      c.value.toLowerCase() === name.toLowerCase() ||
      c.slug === name.toLowerCase(),
  );
  return match?.slug || name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

export function extractFirstImageUrl(content?: string): string | undefined {
  if (!content || typeof content !== "string") return undefined;
  const match = content.match(/<img[^>]+src=["']([^"']+)["']/i);
  return match && match[1] ? match[1].trim() : undefined;
}

function getBaseUrl(): string {
  return String(process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(
    /\/+$/,
    "",
  );
}

export type FetchBlogsQuery = {
  page?: number;
  limit?: number;
  search?: string;
  category?: string;
};

/**
 * Fetch paginated list of public blogs with optional category & search filter.
 * Works both on the server (SSR) and client.
 */
export async function fetchPublicBlogs(
  query: FetchBlogsQuery = {},
): Promise<PublicBlogsResponse> {
  const base = getBaseUrl();
  const page = Math.max(1, query.page || 1);
  const limit = Math.max(1, query.limit || 9);

  const fallback: PublicBlogsResponse = {
    data: [],
    pagination: {
      total: 0,
      page,
      limit,
      totalPages: 1,
    },
  };

  if (!base) return fallback;

  try {
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("limit", String(limit));

    if (query.search && query.search.trim()) {
      params.set("search", query.search.trim());
    }

    if (query.category && query.category.trim() && query.category !== "All") {
      params.set("category", query.category.trim());
    }

    const url = `${base}/${publicApi.blogs}?${params.toString()}`;
    const response = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
      next: { revalidate: 30 },
    });

    if (!response.ok) {
      return fallback;
    }

    const result = (await response.json()) as PublicBlogsResponse;
    if (result && Array.isArray(result.data)) {
      // Enrich blog items: if image is missing, extract from CKEditor content
      const enriched = await Promise.all(
        result.data.map(async (item) => {
          let image = item.image || item.coverImage || item.thumbnail;
          let content = item.content;

          if (!image) {
            if (content) {
              image = extractFirstImageUrl(content);
            } else if (item.slug) {
              try {
                const detail = await fetchPublicBlogBySlug(item.slug);
                if (detail?.content) {
                  content = detail.content;
                  image = extractFirstImageUrl(detail.content);
                }
              } catch {
                // ignore
              }
            }
          }

          return {
            ...item,
            image: image || item.image,
            content: content || item.content,
          };
        }),
      );

      return {
        data: enriched,
        pagination: result.pagination || {
          total: enriched.length,
          page,
          limit,
          totalPages: Math.ceil(enriched.length / limit) || 1,
        },
      };
    }

    return fallback;
  } catch (err) {
    console.error("fetchPublicBlogs error:", err);
    return fallback;
  }
}

/**
 * Fetch a single public blog by slug including approved comments.
 */
export async function fetchPublicBlogBySlug(
  slug: string,
): Promise<PublicBlogItem | null> {
  const trimmed = String(slug || "").trim();
  const base = getBaseUrl();
  if (!trimmed || !base) return null;

  try {
    const url = `${base}/${publicApi.blog(trimmed)}`;
    const response = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
      next: { revalidate: 30 },
    });

    if (!response.ok) return null;

    const data = await response.json();
    if (!data || typeof data !== "object") return null;

    // Response might be wrapped in `{ data: ... }` or directly the blog object
    const blog: PublicBlogItem = "data" in data && data.data ? data.data : data;
    if (!blog._id && !blog.slug && !blog.title) return null;

    if (!blog.image && blog.content) {
      blog.image = extractFirstImageUrl(blog.content);
    }

    return blog;
  } catch (err) {
    console.error("fetchPublicBlogBySlug error:", err);
    return null;
  }
}

export type SubmitCommentPayload = {
  authorName: string;
  authorEmail: string;
  comment: string;
};

export type SubmitCommentResponse = {
  success: boolean;
  message: string;
  comment?: PublicBlogComment;
};

/**
 * Submit a comment to a public blog by slug.
 */
export async function submitBlogComment(
  slug: string,
  payload: SubmitCommentPayload,
): Promise<SubmitCommentResponse> {
  const trimmedSlug = String(slug || "").trim();
  const base = getBaseUrl();

  if (!trimmedSlug || !base) {
    return { success: false, message: "Invalid blog identifier." };
  }

  if (!payload.authorName?.trim()) {
    return { success: false, message: "Please enter your name." };
  }
  if (!payload.authorEmail?.trim()) {
    return { success: false, message: "Please enter your email address." };
  }
  if (!payload.comment?.trim()) {
    return { success: false, message: "Please enter your comment." };
  }

  try {
    const url = `${base}/${publicApi.blogComments(trimmedSlug)}`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        authorName: payload.authorName.trim(),
        authorEmail: payload.authorEmail.trim(),
        comment: payload.comment.trim(),
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      return {
        success: false,
        message: data?.message || "Failed to submit comment. Please try again.",
      };
    }

    return {
      success: true,
      message: data?.message || "Comment submitted successfully.",
      comment: data?.comment,
    };
  } catch (err) {
    console.error("submitBlogComment error:", err);
    return {
      success: false,
      message: "Network error while submitting comment.",
    };
  }
}
