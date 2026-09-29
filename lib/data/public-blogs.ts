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
 * Uses no-store so comment threads are not stuck on a stale ISR cache.
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
      cache: "no-store",
    });

    if (!response.ok) return null;

    const data = await response.json();
    if (!data || typeof data !== "object") return null;

    // Prefer nested `.data` only when it looks like the blog document itself
    const wrapped =
      "data" in data &&
      data.data &&
      typeof data.data === "object" &&
      !Array.isArray(data.data) &&
      ("slug" in data.data || "title" in data.data || "_id" in data.data)
        ? (data.data as PublicBlogItem)
        : null;

    const blog: PublicBlogItem = wrapped || (data as PublicBlogItem);
    if (!blog._id && !blog.slug && !blog.title) return null;

    // Normalize comments to always be an array
    if (!Array.isArray(blog.comments)) {
      blog.comments = [];
    }

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
  authorName?: string;
  authorEmail?: string;
  comment: string;
  parentId?: string;
};

export type SubmitCommentResponse = {
  success: boolean;
  message: string;
  comment?: PublicBlogComment;
  isFlaggedUser?: boolean;
  flaggedUserReason?: string;
  supportMessage?: string;
};

/**
 * Submit a comment to a public blog by slug.
 * Sends Bearer token when the visitor is logged in so the API can skip name/email fields.
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

  if (!payload.comment?.trim()) {
    return { success: false, message: "Please enter your comment." };
  }

  try {
    const url = `${base}/${publicApi.blogComments(trimmedSlug)}`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
    };

    if (typeof window !== "undefined") {
      try {
        const { getAuthToken } = await import("@/components/api/apiFuntions");
        const token = getAuthToken();
        if (token) headers.Authorization = `Bearer ${token}`;
      } catch {
        // guest submit still works
      }
    }

    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({
        authorName: payload.authorName?.trim() || "",
        authorEmail: payload.authorEmail?.trim() || "",
        comment: payload.comment.trim(),
        parentId: payload.parentId || undefined,
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      const message =
        data?.message || "Failed to submit comment. Please try again.";
      const isFlaggedUser =
        response.status === 403 && /flagged/i.test(String(message));
      return {
        success: false,
        message,
        isFlaggedUser,
        supportMessage: isFlaggedUser ? message : "",
        flaggedUserReason: isFlaggedUser ? message : "",
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

export type SupportTicketPayload = {
  category: string;
  subject: string;
  message: string;
  priority?: string;
  authorName?: string;
  authorEmail?: string;
  entityType?: string;
  entityId?: string;
  sourceCommentId?: string;
};

export async function submitSupportTicket(
  payload: SupportTicketPayload,
): Promise<{ success: boolean; message: string; ticket?: unknown }> {
  const base = getBaseUrl();
  if (!base) return { success: false, message: "API unavailable." };

  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
    };
    if (typeof window !== "undefined") {
      try {
        const { getAuthToken } = await import("@/components/api/apiFuntions");
        const token = getAuthToken();
        if (token) headers.Authorization = `Bearer ${token}`;
      } catch {
        // ignore
      }
    }

    const response = await fetch(`${base}/public/support-tickets`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    if (!response.ok) {
      return {
        success: false,
        message: data?.message || "Failed to create support ticket.",
      };
    }
    return {
      success: true,
      message: data?.message || "Support ticket submitted.",
      ticket: data?.ticket,
    };
  } catch (err) {
    console.error("submitSupportTicket error:", err);
    return { success: false, message: "Network error while creating ticket." };
  }
}

export type EmailModerationStatus = {
  success: boolean;
  isFlagged: boolean;
  reason?: string;
  supportMessage?: string;
  accountStatus?: string | null;
};

export async function checkEmailModerationStatus(
  email: string,
): Promise<EmailModerationStatus> {
  const base = getBaseUrl();
  const normalized = String(email || "").trim().toLowerCase();
  if (!base || !normalized || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    return { success: false, isFlagged: false };
  }

  try {
    const response = await fetch(`${base}/public/moderation/check-email`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ email: normalized }),
    });
    const data = await response.json();
    if (!response.ok) {
      return { success: false, isFlagged: false };
    }
    return {
      success: true,
      isFlagged: Boolean(data?.isFlagged),
      reason: data?.reason || "",
      supportMessage: data?.supportMessage || "",
      accountStatus: data?.accountStatus || null,
    };
  } catch {
    return { success: false, isFlagged: false };
  }
}

export async function recordBlogView(
  slug: string,
): Promise<{ success: boolean; viewCount?: number; likeCount?: number }> {
  const base = getBaseUrl();
  const trimmed = String(slug || "").trim();
  if (!base || !trimmed) return { success: false };
  try {
    const response = await fetch(`${base}/public/blogs/${trimmed}/view`, {
      method: "POST",
      headers: { Accept: "application/json" },
    });
    const data = await response.json();
    if (!response.ok) return { success: false };
    return {
      success: true,
      viewCount: data?.viewCount,
      likeCount: data?.likeCount,
    };
  } catch {
    return { success: false };
  }
}

export async function likeBlogPost(
  slug: string,
  payload: { authorName?: string; authorEmail?: string } = {},
): Promise<{
  success: boolean;
  message?: string;
  likeCount?: number;
  liked?: boolean;
  alreadyLiked?: boolean;
}> {
  const base = getBaseUrl();
  const trimmed = String(slug || "").trim();
  if (!base || !trimmed) return { success: false, message: "Invalid blog." };

  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
    };
    if (typeof window !== "undefined") {
      try {
        const { getAuthToken } = await import("@/components/api/apiFuntions");
        const token = getAuthToken();
        if (token) headers.Authorization = `Bearer ${token}`;
      } catch {
        // ignore
      }
    }

    const response = await fetch(`${base}/public/blogs/${trimmed}/like`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        authorName: payload.authorName?.trim() || "",
        authorEmail: payload.authorEmail?.trim() || "",
      }),
    });
    const data = await response.json();
    if (!response.ok) {
      return {
        success: false,
        message: data?.message || "Failed to like article.",
      };
    }
    return {
      success: true,
      message: data?.message,
      likeCount: data?.likeCount,
      liked: data?.liked,
      alreadyLiked: data?.alreadyLiked,
    };
  } catch {
    return { success: false, message: "Network error while liking." };
  }
}
