"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Eye, Heart, Loader2, ShieldAlert, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { likeBlogPost, recordBlogView, checkEmailModerationStatus } from "@/lib/data/public-blogs";
import { useAppSelector } from "@/store/hooks";
import {
  selectAuthUser,
  selectIsAuthenticated,
} from "@/store/authSlice";

interface BlogEngagementProps {
  slug: string;
  initialViews?: number;
  initialLikes?: number;
}

function likedStorageKey(slug: string) {
  return `rs-blog-liked:${slug}`;
}

function viewedStorageKey(slug: string) {
  return `rs-blog-viewed:${slug}`;
}

export function BlogEngagement({
  slug,
  initialViews = 0,
  initialLikes = 0,
}: BlogEngagementProps) {
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  const authUser = useAppSelector(selectAuthUser);

  const [views, setViews] = useState(initialViews);
  const [likes, setLikes] = useState(initialLikes);
  const [liked, setLiked] = useState(false);
  const [liking, setLiking] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [flaggedNotice, setFlaggedNotice] = useState<string | null>(null);
  const lastFlagCheckedEmail = useRef("");

  useEffect(() => {
    setViews(initialViews);
    setLikes(initialLikes);
  }, [initialViews, initialLikes]);

  useEffect(() => {
    if (!modalOpen) return;
    const email = guestEmail.trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setFlaggedNotice(null);
      return undefined;
    }
    const timer = window.setTimeout(async () => {
      if (lastFlagCheckedEmail.current === email) return;
      const status = await checkEmailModerationStatus(email);
      lastFlagCheckedEmail.current = email;
      if (!status.success || !status.isFlagged) {
        setFlaggedNotice(null);
        return;
      }
      const msg =
        status.supportMessage ||
        status.reason ||
        "Your account was flagged. Please contact support.";
      setFlaggedNotice(msg);
    }, 450);
    return () => window.clearTimeout(timer);
  }, [guestEmail, modalOpen]);

  useEffect(() => {
    if (!slug || typeof window === "undefined") return;
    try {
      setLiked(window.localStorage.getItem(likedStorageKey(slug)) === "1");
    } catch {
      // ignore
    }

    const key = viewedStorageKey(slug);
    let already = false;
    try {
      already = window.sessionStorage.getItem(key) === "1";
    } catch {
      already = false;
    }
    if (already) return;

    recordBlogView(slug)
      .then((res) => {
        if (typeof res.viewCount === "number") setViews(res.viewCount);
        if (typeof res.likeCount === "number") setLikes(res.likeCount);
        try {
          window.sessionStorage.setItem(key, "1");
        } catch {
          // ignore
        }
      })
      .catch(() => {
        // ignore view errors
      });
  }, [slug]);

  const submitLike = async (name?: string, email?: string) => {
    setLiking(true);
    try {
      const res = await likeBlogPost(slug, {
        authorName: name,
        authorEmail: email,
      });
      if (!res.success) {
        toast.error(res.message || "Could not like this article.");
        return false;
      }
      if (typeof res.likeCount === "number") setLikes(res.likeCount);
      setLiked(true);
      try {
        window.localStorage.setItem(likedStorageKey(slug), "1");
      } catch {
        // ignore
      }
      toast.success(
        res.alreadyLiked
          ? "You already liked this article."
          : res.message || "Thanks for the like!",
      );
      return true;
    } catch {
      toast.error("Could not like this article.");
      return false;
    } finally {
      setLiking(false);
    }
  };

  const handleLikeClick = async () => {
    if (liked || liking) return;

    if (isAuthenticated && authUser?.email) {
      await submitLike();
      return;
    }

    setModalOpen(true);
  };

  const handleGuestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!guestName.trim() || !guestEmail.trim()) {
      toast.error("Name and email are required.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guestEmail.trim())) {
      toast.error("Please enter a valid email.");
      return;
    }
    const ok = await submitLike(guestName.trim(), guestEmail.trim());
    if (ok) {
      setModalOpen(false);
      setGuestName("");
      setGuestEmail("");
    }
  };

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground">
          <Eye className="size-3.5 text-primary" />
          {views.toLocaleString()} views
        </span>
        <Button
          type="button"
          size="sm"
          variant={liked ? "default" : "outline"}
          className="gap-1.5 rounded-full"
          disabled={liking || liked}
          onClick={handleLikeClick}
        >
          {liking ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Heart className={`size-3.5 ${liked ? "fill-current" : ""}`} />
          )}
          {likes.toLocaleString()} {liked ? "Liked" : "Like"}
        </Button>
      </div>

      {modalOpen && typeof document !== "undefined"
        ? createPortal(
            <div className="fixed inset-0 z-[200] flex items-end justify-center bg-black/40 p-4 sm:items-center">
              <button
                type="button"
                aria-label="Close"
                className="absolute inset-0"
                onClick={() => !liking && setModalOpen(false)}
              />
              <form
                onSubmit={handleGuestSubmit}
                className="relative z-10 w-full max-w-md rounded-2xl border bg-card p-5 shadow-lg sm:p-6"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-base font-semibold">Like this article</h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Enter your name and email. One like per email.
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={liking}
                    onClick={() => setModalOpen(false)}
                    className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted"
                  >
                    <X className="size-4" />
                  </button>
                </div>
                <div className="mt-4 space-y-3">
                  <input
                    required
                    value={guestName}
                    onChange={(e) => setGuestName(e.target.value)}
                    placeholder="Your name"
                    className="h-10 w-full rounded-xl border border-input bg-background px-3.5 text-sm"
                  />
                  <input
                    required
                    type="email"
                    value={guestEmail}
                    onChange={(e) => setGuestEmail(e.target.value)}
                    placeholder="Your email"
                    className="h-10 w-full rounded-xl border border-input bg-background px-3.5 text-sm"
                  />
                  {flaggedNotice ? (
                    <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                      <p className="inline-flex items-center gap-1.5 font-semibold">
                        <ShieldAlert className="size-3.5" />
                        Account flagged
                      </p>
                      <p className="mt-1">{flaggedNotice}</p>
                    </div>
                  ) : null}
                </div>
                <div className="mt-5 flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={liking}
                    onClick={() => setModalOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={liking} className="gap-2">
                    {liking ? <Loader2 className="size-4 animate-spin" /> : <Heart className="size-4" />}
                    Like
                  </Button>
                </div>
              </form>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
