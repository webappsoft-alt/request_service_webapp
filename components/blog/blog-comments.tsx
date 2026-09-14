"use client";

import { useState } from "react";
import { MessageSquare, Send, User, CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { submitBlogComment } from "@/lib/data/public-blogs";
import { formatDate } from "@/lib/format";
import type { PublicBlogComment } from "@/lib/types";

interface BlogCommentsProps {
  slug: string;
  initialComments?: PublicBlogComment[];
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase() || "U";
}

export function BlogComments({ slug, initialComments = [] }: BlogCommentsProps) {
  // Only display comments that are not disabled
  const [comments, setComments] = useState<PublicBlogComment[]>(() =>
    initialComments.filter((c) => !c.isDisabled),
  );
  const [authorName, setAuthorName] = useState("");
  const [authorEmail, setAuthorEmail] = useState("");
  const [commentText, setCommentText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submittedSuccess, setSubmittedSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const name = authorName.trim();
    const email = authorEmail.trim();
    const comment = commentText.trim();

    if (!name) {
      toast.error("Please enter your name.");
      return;
    }

    if (!email) {
      toast.error("Please enter your email address.");
      return;
    }

    // Basic email format check
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error("Please enter a valid email address.");
      return;
    }

    if (!comment) {
      toast.error("Please write a comment.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await submitBlogComment(slug, {
        authorName: name,
        authorEmail: email,
        comment,
      });

      if (res.success) {
        toast.success(res.message || "Comment submitted successfully.");
        const newComment: PublicBlogComment = res.comment || {
          _id: String(Date.now()),
          authorName: name,
          authorEmail: email,
          comment,
          createdAt: new Date().toISOString(),
          isDisabled: false,
        };

        setComments((prev) => [newComment, ...prev]);
        setCommentText("");
        setSubmittedSuccess(true);
        setTimeout(() => setSubmittedSuccess(false), 4000);
      } else {
        toast.error(res.message || "Failed to submit comment. Please try again.");
      }
    } catch (err) {
      console.error(err);
      toast.error("An unexpected error occurred. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="mt-12 flex flex-col gap-8 border-t pt-10">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <MessageSquare className="size-5 text-primary" aria-hidden="true" />
          <h2 className="text-2xl font-semibold tracking-tight">
            Discussion ({comments.length})
          </h2>
        </div>
      </div>

      {/* Comment Form */}
      <form
        onSubmit={handleSubmit}
        className="flex flex-col gap-4 rounded-2xl border border-black/10 bg-card p-6 shadow-xs"
      >
        <div>
          <h3 className="text-base font-semibold text-foreground">
            Leave a comment
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Your email address will not be published. Required fields are marked *
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label
              htmlFor="comment-author-name"
              className="block text-xs font-medium text-foreground mb-1.5"
            >
              Name *
            </label>
            <input
              id="comment-author-name"
              type="text"
              required
              value={authorName}
              onChange={(e) => setAuthorName(e.target.value)}
              placeholder="e.g. Morgan Taylor"
              className="h-10 w-full rounded-xl border border-input bg-background px-3.5 text-sm text-foreground shadow-xs transition-colors placeholder:text-muted-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>

          <div>
            <label
              htmlFor="comment-author-email"
              className="block text-xs font-medium text-foreground mb-1.5"
            >
              Email *
            </label>
            <input
              id="comment-author-email"
              type="email"
              required
              value={authorEmail}
              onChange={(e) => setAuthorEmail(e.target.value)}
              placeholder="e.g. morgan@example.com"
              className="h-10 w-full rounded-xl border border-input bg-background px-3.5 text-sm text-foreground shadow-xs transition-colors placeholder:text-muted-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
        </div>

        <div>
          <label
            htmlFor="comment-body"
            className="block text-xs font-medium text-foreground mb-1.5"
          >
            Comment *
          </label>
          <textarea
            id="comment-body"
            required
            rows={4}
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            placeholder="Share your thoughts or questions on this article..."
            className="w-full rounded-xl border border-input bg-background p-3.5 text-sm text-foreground shadow-xs transition-colors placeholder:text-muted-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>

        <div className="flex items-center justify-between pt-1">
          {submittedSuccess ? (
            <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-600">
              <CheckCircle2 className="size-4" />
              Your comment has been posted!
            </span>
          ) : (
            <span />
          )}

          <Button
            type="submit"
            disabled={submitting}
            className="gap-2 rounded-xl"
          >
            {submitting ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Posting...
              </>
            ) : (
              <>
                Post comment
                <Send className="size-3.5" />
              </>
            )}
          </Button>
        </div>
      </form>

      {/* Existing Comments List */}
      <div className="flex flex-col gap-4">
        {comments.length > 0 ? (
          <div className="flex flex-col divide-y divide-border rounded-2xl border border-black/10 bg-card shadow-xs">
            {comments.map((item, index) => (
              <div
                key={item._id || `${item.authorName}-${index}`}
                className="flex items-start gap-4 p-5 sm:p-6"
              >
                {/* Avatar */}
                <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 font-semibold text-primary text-xs">
                  {item.authorName ? getInitials(item.authorName) : <User className="size-4" />}
                </div>

                {/* Content */}
                <div className="flex flex-1 flex-col gap-1.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h4 className="text-sm font-semibold text-foreground">
                      {item.authorName}
                    </h4>
                    {item.createdAt && (
                      <span className="text-xs text-muted-foreground">
                        {formatDate(item.createdAt)}
                      </span>
                    )}
                  </div>
                  <p className="text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap">
                    {item.comment}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-black/10 bg-card p-8 text-center text-sm text-muted-foreground">
            No comments on this article yet. Be the first to share your thoughts!
          </div>
        )}
      </div>
    </section>
  );
}
