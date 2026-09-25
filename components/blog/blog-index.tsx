"use client";

import { useEffect, useState, useTransition } from "react";
import { ChevronDown, Loader2, Search, Sparkles, X } from "lucide-react";
import { BlogCard } from "@/components/shared/blog-card";
import { BlogCardSkeleton } from "@/components/shared/loading-skeletons";
import { Button } from "@/components/ui/button";
import {
  BLOG_CATEGORIES,
  fetchPublicBlogs,
  slugToCategoryName,
} from "@/lib/data/public-blogs";
import type { PublicBlogItem } from "@/lib/types";

interface BlogIndexProps {
  initialCategorySlug?: string;
}

export function BlogIndex({ initialCategorySlug }: BlogIndexProps) {
  const initialCategory = initialCategorySlug
    ? slugToCategoryName(initialCategorySlug) || ""
    : "";

  const [category, setCategory] = useState<string>(initialCategory);
  const [searchInput, setSearchInput] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [blogs, setBlogs] = useState<PublicBlogItem[]>([]);
  const [page, setPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);
  const [, startTransition] = useTransition();

  const PAGE_LIMIT = 9;

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchTerm(searchInput.trim());
    }, 350);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // When category or searchTerm changes, fetch page 1
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setPage(1);

    fetchPublicBlogs({
      page: 1,
      limit: PAGE_LIMIT,
      category: category || undefined,
      search: searchTerm || undefined,
    })
      .then((res) => {
        if (cancelled) return;

        if (res.data && res.data.length > 0) {
          setBlogs(res.data);
          setTotalCount(res.pagination?.total ?? res.data.length);
          setTotalPages(res.pagination?.totalPages ?? 1);
        } else {
          setBlogs([]);
          setTotalCount(res.pagination?.total ?? 0);
          setTotalPages(res.pagination?.totalPages ?? 1);
        }

        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error("Failed to fetch public blogs:", err);
        setBlogs([]);
        setTotalCount(0);
        setTotalPages(1);
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [category, searchTerm]);

  // Load more / See more pagination
  const handleSeeMore = async () => {
    if (page >= totalPages || loadingMore) return;

    const nextPage = page + 1;
    setLoadingMore(true);

    try {
      const res = await fetchPublicBlogs({
        page: nextPage,
        limit: PAGE_LIMIT,
        category: category || undefined,
        search: searchTerm || undefined,
      });

      if (res.data && res.data.length > 0) {
        startTransition(() => {
          setBlogs((prev) => {
            // Deduplicate items
            const existingIds = new Set(prev.map((b) => b._id || b.slug));
            const newItems = res.data.filter(
              (item) => !existingIds.has(item._id || item.slug),
            );
            return [...prev, ...newItems];
          });
          setPage(nextPage);
          setTotalPages(res.pagination.totalPages);
          setTotalCount(res.pagination.total);
        });
      }
    } catch (err) {
      console.error("Failed to load more blogs:", err);
    } finally {
      setLoadingMore(false);
    }
  };

  const handleCategoryChange = (catValue: string) => {
    setCategory(catValue);
  };

  const handleClearFilters = () => {
    setSearchInput("");
    setSearchTerm("");
    setCategory("");
  };

  const hasMore = page < totalPages;

  return (
    <div className="flex flex-col gap-8">
      {/* Top Filter Bar: Search and Category Pills */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {/* Search Box */}
          <div className="relative w-full sm:max-w-md">
            <Search
              className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search articles by title, topic, or keyword..."
              className="h-10 w-full rounded-xl border border-input bg-card pl-10 pr-9 text-sm text-foreground shadow-xs transition-colors placeholder:text-muted-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
            />
            {searchInput && (
              <button
                type="button"
                onClick={() => setSearchInput("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label="Clear search"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>

          {/* Results Counter */}
          {!loading && (
            <p className="text-xs font-medium text-muted-foreground sm:text-right">
              Showing{" "}
              <span className="font-semibold text-foreground">
                {blogs.length}
              </span>{" "}
              of{" "}
              <span className="font-semibold text-foreground">
                {totalCount}
              </span>{" "}
              {totalCount === 1 ? "article" : "articles"}
            </p>
          )}
        </div>

        {/* Category Pills */}
        <div
          className="flex flex-wrap items-center gap-2 overflow-x-auto pb-1"
          role="tablist"
          aria-label="Filter articles by category"
        >
          {BLOG_CATEGORIES.map((item) => {
            const isActive = category === item.value;
            return (
              <button
                key={item.slug}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => handleCategoryChange(item.value)}
                className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium transition-all ${
                  isActive
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "border border-input bg-card text-muted-foreground hover:border-input hover:bg-accent hover:text-foreground"
                }`}
              >
                {item.value === "" && <Sparkles className="size-3" />}
                {item.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Grid of Articles or Skeletons or Empty State */}
      {loading ? (
        <div
          className="grid gap-x-8 gap-y-10 md:grid-cols-2 xl:grid-cols-3"
          aria-busy="true"
          aria-label="Loading articles"
        >
          {Array.from({ length: 6 }).map((_, i) => (
            <BlogCardSkeleton key={`blog-sk-${i}`} />
          ))}
        </div>
      ) : blogs.length > 0 ? (
        <div className="flex flex-col gap-10">
          <div className="grid gap-x-8 gap-y-10 md:grid-cols-2 xl:grid-cols-3">
            {blogs.map((post) => (
              <BlogCard key={post._id || post.slug} post={post} />
            ))}
          </div>

          {/* See More / Load More Pagination Button */}
          {hasMore && (
            <div className="mt-4 flex flex-col items-center justify-center gap-2">
              <Button
                size="lg"
                variant="outline"
                onClick={handleSeeMore}
                disabled={loadingMore}
                className="h-11 rounded-full border-input bg-card px-8 font-medium shadow-xs transition-all hover:bg-accent hover:text-foreground"
              >
                {loadingMore ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" />
                    Loading more articles...
                  </>
                ) : (
                  <>
                    See more articles
                    <ChevronDown className="ml-2 size-4" />
                  </>
                )}
              </Button>
              <p className="text-xs text-muted-foreground">
                Page {page} of {totalPages}
              </p>
            </div>
          )}
        </div>
      ) : (
        /* Empty State */
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-input bg-card px-6 py-16 text-center shadow-xs">
          <div className="flex size-12 items-center justify-center rounded-full bg-muted">
            <Search className="size-6 text-muted-foreground" />
          </div>
          <h3 className="mt-4 text-lg font-semibold tracking-tight">
            No articles found
          </h3>
          <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">
            {searchTerm
              ? `No articles match "${searchTerm}". Try another search term or remove filters.`
              : category
                ? `No articles found in "${category}".`
                : "No articles published yet. Check back soon for guides and industry updates."}
          </p>
          {(searchTerm || category) && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleClearFilters}
              className="mt-5 rounded-full"
            >
              Clear filters
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
