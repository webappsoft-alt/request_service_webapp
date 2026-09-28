"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  MessageSquare,
  Send,
  User,
  CheckCircle2,
  Loader2,
  Reply,
  Pin,
  Ticket,
  ShieldAlert,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  checkEmailModerationStatus,
  fetchPublicBlogBySlug,
  submitBlogComment,
  submitSupportTicket,
} from "@/lib/data/public-blogs";
import { formatDate } from "@/lib/format";
import { useAppSelector } from "@/store/hooks";
import {
  selectAuthUser,
  selectIsAuthenticated,
} from "@/store/authSlice";
import type { PublicBlogComment } from "@/lib/types";

interface BlogCommentsProps {
  slug: string;
  blogId?: string;
  commentsEnabled?: boolean;
  initialComments?: PublicBlogComment[];
}

const SUPPORT_CATEGORIES = [
  { value: "billing", label: "Billing / payments", important: true },
  { value: "account_access", label: "Account access", important: true },
  { value: "service_dispute", label: "Service dispute", important: true },
  { value: "safety_concern", label: "Safety concern", important: true },
  { value: "content_moderation", label: "Content / abuse report", important: true },
  { value: "technical_issue", label: "Technical issue", important: false },
  { value: "feature_request", label: "Feature request", important: false },
  { value: "other_important", label: "Other important query", important: true },
];

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase() || "U";
}

function displayName(user: {
  firstName?: string;
  lastName?: string;
  name?: string;
  email?: string;
} | null): string {
  if (!user) return "";
  const fromParts = [user.firstName, user.lastName]
    .filter(Boolean)
    .join(" ")
    .trim();
  if (fromParts) return fromParts;
  if (typeof user.name === "string" && user.name.trim()) return user.name.trim();
  return user.email?.split("@")[0] || "You";
}

function normalizeComments(list?: PublicBlogComment[] | null): PublicBlogComment[] {
  if (!Array.isArray(list)) return [];
  return list.filter((c) => c && !c.isDisabled && !c.isDeleted);
}

function countComments(nodes: PublicBlogComment[]): number {
  return nodes.reduce(
    (sum, n) => sum + 1 + countComments(n.replies || []),
    0,
  );
}

function CommentNode({
  item,
  depth,
  onReply,
  onTicket,
}: {
  item: PublicBlogComment;
  depth: number;
  onReply: (c: PublicBlogComment) => void;
  onTicket: (c: PublicBlogComment) => void;
}) {
  const body = item.comment || item.body || "";
  const replies = item.replies || [];

  return (
    <div className={depth > 0 ? "mt-3 border-l-2 border-border/70 pl-3 sm:pl-4" : ""}>
      <div className="flex items-start gap-3 rounded-xl p-3 sm:gap-4 sm:p-4">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary sm:size-10">
          {item.authorName ? getInitials(item.authorName) : <User className="size-4" />}
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <h4 className="text-sm font-semibold text-foreground">
                {item.authorName}
              </h4>
              {item.isAdminReply ? (
                <span className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                  Staff
                </span>
              ) : null}
              {item.isPinned ? (
                <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
                  <Pin className="size-3" /> Pinned
                </span>
              ) : null}
              {item.isFlaggedUser ? (
                <span className="inline-flex items-center gap-1 rounded-md border border-destructive/30 bg-destructive/10 px-1.5 py-0.5 text-[10px] font-semibold text-destructive">
                  <ShieldAlert className="size-3" /> Flagged User
                </span>
              ) : null}
            </div>
            {item.createdAt ? (
              <span className="text-xs text-muted-foreground">
                {formatDate(item.createdAt)}
              </span>
            ) : null}
          </div>

          {item.isFlaggedUser && item.flaggedUserReason ? (
            <div className="rounded-lg border border-destructive/25 bg-destructive/5 px-3 py-2 text-xs text-destructive">
              <strong className="font-semibold">Flagged User:</strong>{" "}
              {item.flaggedUserReason}
            </div>
          ) : null}

          <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
            {body}
          </p>

          <div className="flex flex-wrap gap-2 pt-0.5">
            <button
              type="button"
              onClick={() => onReply(item)}
              className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              <Reply className="size-3.5" /> Reply
            </button>
            <button
              type="button"
              onClick={() => onTicket(item)}
              className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              <Ticket className="size-3.5" /> Create support ticket
            </button>
          </div>
        </div>
      </div>

      {replies.length > 0 ? (
        <div className="space-y-1">
          {replies.map((child, idx) => (
            <CommentNode
              key={child._id || `${child.authorName}-${depth}-${idx}`}
              item={child}
              depth={depth + 1}
              onReply={onReply}
              onTicket={onTicket}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function BlogComments({
  slug,
  blogId,
  commentsEnabled = true,
  initialComments = [],
}: BlogCommentsProps) {
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  const authUser = useAppSelector(selectAuthUser);
  const loggedInName = useMemo(() => displayName(authUser), [authUser]);

  const [comments, setComments] = useState<PublicBlogComment[]>(() =>
    normalizeComments(initialComments),
  );
  const [authorName, setAuthorName] = useState("");
  const [authorEmail, setAuthorEmail] = useState("");
  const [commentText, setCommentText] = useState("");
  const [replyTo, setReplyTo] = useState<PublicBlogComment | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submittedSuccess, setSubmittedSuccess] = useState(false);
  const [loadingComments, setLoadingComments] = useState(
    () => normalizeComments(initialComments).length === 0,
  );

  const [ticketOpen, setTicketOpen] = useState(false);
  const [ticketSource, setTicketSource] = useState<PublicBlogComment | null>(null);
  const [ticketCategory, setTicketCategory] = useState("other_important");
  const [ticketSubject, setTicketSubject] = useState("");
  const [ticketMessage, setTicketMessage] = useState("");
  const [ticketName, setTicketName] = useState("");
  const [ticketEmail, setTicketEmail] = useState("");
  const [ticketSubmitting, setTicketSubmitting] = useState(false);
  const [flaggedNotice, setFlaggedNotice] = useState<{
    reason: string;
    supportMessage: string;
  } | null>(null);
  const lastFlagCheckedEmail = useRef("");

  const openSupportForFlag = (email?: string, name?: string) => {
    setTicketSource(null);
    setTicketCategory("content_moderation");
    setTicketSubject("Account flagged — need support");
    setTicketMessage(
      "My account appears to be flagged. Please review and help me resolve this.\n\n",
    );
    if (name) setTicketName(name);
    if (email) setTicketEmail(email);
    if (email) setAuthorEmail(email);
    if (name) setAuthorName(name);
    setTicketOpen(true);
  };

  const notifyIfFlagged = async (rawEmail: string) => {
    const email = String(rawEmail || "").trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setFlaggedNotice(null);
      lastFlagCheckedEmail.current = "";
      return false;
    }
    if (lastFlagCheckedEmail.current === email && flaggedNotice) {
      return true;
    }

    const status = await checkEmailModerationStatus(email);
    lastFlagCheckedEmail.current = email;
    if (!status.success || !status.isFlagged) {
      setFlaggedNotice(null);
      return false;
    }

    setFlaggedNotice({
      reason: status.reason || "Your account has been flagged for review.",
      supportMessage:
        status.supportMessage ||
        "Please contact support for help resolving this.",
    });
    return true;
  };

  // Keep in sync when server props arrive / change (fixes empty client hydration)
  useEffect(() => {
    const next = normalizeComments(initialComments);
    if (next.length > 0) {
      setComments(next);
      setLoadingComments(false);
    }
  }, [initialComments]);

  // Only fetch comments when SSR/hydration left the list empty
  useEffect(() => {
    let cancelled = false;
    if (!slug || !commentsEnabled) {
      setLoadingComments(false);
      return undefined;
    }
    if (normalizeComments(initialComments).length > 0) {
      setLoadingComments(false);
      return undefined;
    }

    setLoadingComments(true);
    fetchPublicBlogBySlug(slug)
      .then((blog) => {
        if (cancelled || !blog) return;
        const next = normalizeComments(blog.comments);
        if (next.length > 0) {
          setComments(next);
        }
      })
      .catch((err) => {
        console.error("Failed to refresh public comments:", err);
      })
      .finally(() => {
        if (!cancelled) setLoadingComments(false);
      });

    return () => {
      cancelled = true;
    };
  }, [slug, commentsEnabled, initialComments]);

  // Logged-in flagged users: warn as soon as comments load
  useEffect(() => {
    if (!isAuthenticated || !authUser?.email) return;
    void notifyIfFlagged(String(authUser.email));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run when auth email changes
  }, [isAuthenticated, authUser?.email]);

  // Guest: check as soon as a valid email is entered (debounced)
  useEffect(() => {
    if (isAuthenticated) return;
    const email = authorEmail.trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      if (flaggedNotice) setFlaggedNotice(null);
      return undefined;
    }
    const timer = window.setTimeout(() => {
      void notifyIfFlagged(email);
    }, 450);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authorEmail, isAuthenticated]);

  // Lock background scroll while ticket modal is open (inner modal scrolls only)
  useEffect(() => {
    if (!ticketOpen) return undefined;
    const html = document.documentElement;
    const body = document.body;
    const scrollY = window.scrollY;
    const prev = {
      htmlOverflow: html.style.overflow,
      bodyOverflow: body.style.overflow,
      bodyPosition: body.style.position,
      bodyTop: body.style.top,
      bodyLeft: body.style.left,
      bodyRight: body.style.right,
      bodyWidth: body.style.width,
      htmlOverscroll: html.style.overscrollBehavior,
    };

    html.style.overflow = "hidden";
    html.style.overscrollBehavior = "none";
    body.style.overflow = "hidden";
    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.left = "0";
    body.style.right = "0";
    body.style.width = "100%";

    return () => {
      html.style.overflow = prev.htmlOverflow;
      html.style.overscrollBehavior = prev.htmlOverscroll;
      body.style.overflow = prev.bodyOverflow;
      body.style.position = prev.bodyPosition;
      body.style.top = prev.bodyTop;
      body.style.left = prev.bodyLeft;
      body.style.right = prev.bodyRight;
      body.style.width = prev.bodyWidth;
      window.scrollTo(0, scrollY);
    };
  }, [ticketOpen]);

  const totalCount = useMemo(() => countComments(comments), [comments]);

  const insertReplyLocally = (
    tree: PublicBlogComment[],
    parentId: string,
    reply: PublicBlogComment,
  ): PublicBlogComment[] =>
    tree.map((node) => {
      const id = String(node._id || node.id || "");
      if (id === parentId) {
        return {
          ...node,
          replies: [...(node.replies || []), reply],
        };
      }
      if (node.replies?.length) {
        return {
          ...node,
          replies: insertReplyLocally(node.replies, parentId, reply),
        };
      }
      return node;
    });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentsEnabled) {
      toast.error("Comments are disabled for this article.");
      return;
    }

    const comment = commentText.trim();
    if (!comment) {
      toast.error("Please write a comment.");
      return;
    }

    let name = authorName.trim();
    let email = authorEmail.trim();

    if (isAuthenticated && authUser) {
      name = loggedInName;
      email = String(authUser.email || "").trim();
    } else {
      if (!name) {
        toast.error("Please enter your name.");
        return;
      }
      if (!email) {
        toast.error("Please enter your email address.");
        return;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        toast.error("Please enter a valid email address.");
        return;
      }
    }

    // Block client-side if already known flagged — API also enforces this
    if (flaggedNotice) {
      return;
    }
    const blocked = await notifyIfFlagged(email);
    if (blocked) {
      return;
    }

    setSubmitting(true);
    try {
      const parentId = replyTo?._id || replyTo?.id || undefined;
      const res = await submitBlogComment(slug, {
        authorName: name,
        authorEmail: email,
        comment,
        parentId: parentId ? String(parentId) : undefined,
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
          replies: [],
        };

        if (parentId) {
          setComments((prev) =>
            insertReplyLocally(prev, String(parentId), newComment),
          );
        } else {
          setComments((prev) => [newComment, ...prev]);
        }

        setCommentText("");
        setReplyTo(null);
        if (!isAuthenticated) {
          setAuthorName("");
          setAuthorEmail("");
        }
        setSubmittedSuccess(true);
        setTimeout(() => setSubmittedSuccess(false), 4000);
      } else if (res.isFlaggedUser) {
        setFlaggedNotice({
          reason: res.flaggedUserReason || "Your account has been flagged for review.",
          supportMessage:
            res.supportMessage ||
            "Please contact support for help resolving this.",
        });
      } else {
        toast.error(res.message || "Failed to submit comment.");
      }
    } catch (err) {
      console.error(err);
      toast.error("An unexpected error occurred. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleTicketSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticketSubject.trim() || !ticketMessage.trim()) {
      toast.error("Subject and message are required.");
      return;
    }

    let name = ticketName.trim() || authorName.trim();
    let email = ticketEmail.trim() || authorEmail.trim();
    if (isAuthenticated && authUser) {
      name = loggedInName;
      email = String(authUser.email || "").trim();
    }
    if (!isAuthenticated && (!name || !email)) {
      toast.error("Please enter your name and email to create a ticket.");
      return;
    }
    if (!isAuthenticated && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error("Please enter a valid email address.");
      return;
    }

    const cat = SUPPORT_CATEGORIES.find((c) => c.value === ticketCategory);
    setTicketSubmitting(true);
    try {
      const res = await submitSupportTicket({
        category: ticketCategory,
        subject: ticketSubject.trim(),
        message: ticketMessage.trim(),
        priority: cat?.important ? "important" : "normal",
        authorName: name,
        authorEmail: email,
        entityType: "blog",
        entityId: blogId,
        sourceCommentId: ticketSource?._id || ticketSource?.id,
      });
      if (res.success) {
        toast.success(res.message || "Support ticket created.");
        setTicketOpen(false);
        setTicketSource(null);
        setTicketSubject("");
        setTicketMessage("");
        setTicketName("");
        setTicketEmail("");
      } else {
        toast.error(res.message || "Failed to create ticket.");
      }
    } catch {
      toast.error("Failed to create support ticket.");
    } finally {
      setTicketSubmitting(false);
    }
  };

  if (!commentsEnabled) {
    return (
      <section className="mt-12 rounded-2xl border border-dashed border-border/70 bg-muted/20 p-8 text-center">
        <MessageSquare className="mx-auto size-6 text-muted-foreground" />
        <h2 className="mt-3 text-lg font-semibold">Comments are closed</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Discussion is turned off for this article.
        </p>
      </section>
    );
  }

  return (
    <section className="mt-12 flex flex-col gap-8 border-t border-border/70 pt-10">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <MessageSquare className="size-4" aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-xl font-semibold tracking-tight md:text-2xl">
              Discussion
            </h2>
            <p className="text-xs text-muted-foreground">
              {loadingComments && comments.length === 0
                ? "Loading comments…"
                : `${totalCount} ${totalCount === 1 ? "comment" : "comments"}`}
            </p>
          </div>
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        className="flex flex-col gap-4 rounded-2xl border border-input bg-card/80 p-5 shadow-xs sm:p-6"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-foreground">
              {replyTo ? "Reply to comment" : "Leave a comment"}
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              {isAuthenticated
                ? `Posting as ${loggedInName}.`
                : "Your email address will not be published. Required fields are marked *"}
            </p>
          </div>
          {replyTo ? (
            <button
              type="button"
              onClick={() => setReplyTo(null)}
              className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="Cancel reply"
            >
              <X className="size-4" />
            </button>
          ) : null}
        </div>

        {replyTo ? (
          <div className="rounded-xl border border-primary/20 bg-primary/5 px-3.5 py-3 text-xs text-muted-foreground">
            Replying to <strong className="text-foreground">{replyTo.authorName}</strong>
            : {(replyTo.comment || replyTo.body || "").slice(0, 140)}
            {(replyTo.comment || replyTo.body || "").length > 140 ? "…" : ""}
          </div>
        ) : null}

        {flaggedNotice ? (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-3.5 py-3 text-xs text-destructive">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-1.5 min-w-0">
                <p className="inline-flex items-center gap-1.5 text-sm font-semibold">
                  <ShieldAlert className="size-4 shrink-0" />
                  Account flagged
                </p>
                {flaggedNotice.reason ? (
                  <p>
                    <span className="font-medium">Reason:</span>{" "}
                    {flaggedNotice.reason}
                  </p>
                ) : null}
                <p className="text-destructive/90">
                  {flaggedNotice.supportMessage}
                </p>
                <p className="text-destructive/80">
                  You cannot post comments until support resolves this.
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 shrink-0 gap-1.5 border-destructive/30 text-destructive hover:bg-destructive/10"
                onClick={() =>
                  openSupportForFlag(
                    isAuthenticated
                      ? String(authUser?.email || "")
                      : authorEmail.trim(),
                    isAuthenticated ? loggedInName : authorName.trim(),
                  )
                }
              >
                <Ticket className="size-3.5" />
                Contact support
              </Button>
            </div>
          </div>
        ) : null}

        {isAuthenticated ? (
          <div className="flex items-center gap-3 rounded-xl border border-border/60 bg-muted/30 px-3.5 py-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
              {getInitials(loggedInName || "U")}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground">
                {loggedInName}
              </p>
              {authUser?.email ? (
                <p className="truncate text-xs text-muted-foreground">
                  {authUser.email}
                </p>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="comment-author-name"
                className="mb-1.5 block text-xs font-medium text-foreground"
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
                className="h-10 w-full rounded-xl border border-input bg-background px-3.5 text-sm shadow-xs focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
            <div>
              <label
                htmlFor="comment-author-email"
                className="mb-1.5 block text-xs font-medium text-foreground"
              >
                Email *
              </label>
              <input
                id="comment-author-email"
                type="email"
                required
                value={authorEmail}
                onChange={(e) => setAuthorEmail(e.target.value)}
                onBlur={() => {
                  if (authorEmail.trim()) void notifyIfFlagged(authorEmail);
                }}
                placeholder="e.g. morgan@example.com"
                className="h-10 w-full rounded-xl border border-input bg-background px-3.5 text-sm shadow-xs focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
          </div>
        )}

        <div>
          <label
            htmlFor="comment-body"
            className="mb-1.5 block text-xs font-medium text-foreground"
          >
            {replyTo ? "Your reply *" : "Comment *"}
          </label>
          <textarea
            id="comment-body"
            required
            rows={4}
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            disabled={Boolean(flaggedNotice)}
            placeholder={
              flaggedNotice
                ? "Commenting is disabled while your account is flagged"
                : replyTo
                  ? "Write your reply…"
                  : "Share your thoughts or questions on this article…"
            }
            className="w-full rounded-xl border border-input bg-background p-3.5 text-sm shadow-xs focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          {submittedSuccess ? (
            <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-600">
              <CheckCircle2 className="size-4" />
              Your comment has been posted!
            </span>
          ) : (
            <button
              type="button"
              onClick={() => {
                setTicketSource(null);
                setTicketCategory("other_important");
                setTicketSubject("");
                setTicketMessage("");
                setTicketName(
                  isAuthenticated ? loggedInName : authorName.trim(),
                );
                setTicketEmail(
                  isAuthenticated
                    ? String(authUser?.email || "")
                    : authorEmail.trim(),
                );
                setTicketOpen(true);
              }}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              <Ticket className="size-3.5" />
              Important query? Open a support ticket
            </button>
          )}

          <Button
            type="submit"
            disabled={submitting || Boolean(flaggedNotice)}
            className="gap-2 rounded-xl"
          >
            {submitting ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Posting...
              </>
            ) : (
              <>
                {replyTo ? "Post reply" : "Post comment"}
                <Send className="size-3.5" />
              </>
            )}
          </Button>
        </div>
      </form>

      <div className="flex flex-col gap-2">
        {loadingComments && comments.length === 0 ? (
          <div className="flex items-center justify-center gap-2 rounded-2xl border border-dashed border-input bg-card/60 p-8 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Loading comments…
          </div>
        ) : comments.length > 0 ? (
          <div className="divide-y divide-border/60 rounded-2xl border border-input bg-card shadow-xs">
            {comments.map((item, index) => (
              <CommentNode
                key={item._id || `${item.authorName}-${index}`}
                item={item}
                depth={0}
                onReply={(c) => {
                  setReplyTo(c);
                  document
                    .getElementById("comment-body")
                    ?.scrollIntoView({ behavior: "smooth", block: "center" });
                }}
                onTicket={(c) => {
                  setTicketSource(c);
                  setTicketCategory("content_moderation");
                  setTicketSubject(
                    `Follow-up: ${(c.comment || c.body || "").slice(0, 60)}`,
                  );
                  setTicketMessage(
                    `Regarding comment by ${c.authorName}:\n\n"${c.comment || c.body || ""}"\n\n`,
                  );
                  setTicketName(
                    isAuthenticated ? loggedInName : authorName.trim(),
                  );
                  setTicketEmail(
                    isAuthenticated
                      ? String(authUser?.email || "")
                      : authorEmail.trim(),
                  );
                  setTicketOpen(true);
                }}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-input bg-card/60 p-8 text-center text-sm text-muted-foreground">
            No comments on this article yet. Be the first to share your thoughts!
          </div>
        )}
      </div>

      {ticketOpen && typeof document !== "undefined"
        ? createPortal(
            <div
              className="fixed inset-0 z-[200] flex items-center justify-center overflow-hidden overscroll-none bg-black/50 p-3 sm:p-4"
              role="dialog"
              aria-modal="true"
              onWheel={(e) => {
                const el = e.target as HTMLElement | null;
                if (!el?.closest?.("[data-modal-scroll]")) {
                  e.preventDefault();
                }
              }}
              onTouchMove={(e) => {
                const el = e.target as HTMLElement | null;
                if (!el?.closest?.("[data-modal-scroll]")) {
                  e.preventDefault();
                }
              }}
            >
              <button
                type="button"
                aria-label="Close"
                className="absolute inset-0 cursor-default"
                onClick={() => !ticketSubmitting && setTicketOpen(false)}
              />
              <form
                onSubmit={handleTicketSubmit}
                className="relative z-10 flex max-h-[min(92dvh,40rem)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border bg-card shadow-xl"
              >
                <div className="flex shrink-0 items-start justify-between gap-3 border-b px-5 py-4">
                  <div className="min-w-0">
                    <h3 className="text-base font-semibold tracking-tight">
                      Create support ticket
                    </h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {ticketSource
                        ? `About ${ticketSource.authorName}'s comment`
                        : "Important categories are prioritized for the support team."}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={ticketSubmitting}
                    onClick={() => setTicketOpen(false)}
                    className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted"
                    aria-label="Close"
                  >
                    <X className="size-4" />
                  </button>
                </div>

                <div
                  data-modal-scroll
                  className="min-h-0 flex-1 space-y-3.5 overflow-y-auto overscroll-contain px-5 py-4"
                >
                  <div>
                    <label
                      htmlFor="ticket-category"
                      className="mb-1.5 block text-xs font-medium"
                    >
                      Category *
                    </label>
                    <select
                      id="ticket-category"
                      value={ticketCategory}
                      onChange={(e) => setTicketCategory(e.target.value)}
                      className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm"
                    >
                      {SUPPORT_CATEGORIES.map((c) => (
                        <option key={c.value} value={c.value}>
                          {c.label}
                          {c.important ? " · Important" : ""}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label
                      htmlFor="ticket-subject"
                      className="mb-1.5 block text-xs font-medium"
                    >
                      Subject *
                    </label>
                    <input
                      id="ticket-subject"
                      required
                      value={ticketSubject}
                      onChange={(e) => setTicketSubject(e.target.value)}
                      placeholder="Short summary of the issue"
                      className="h-10 w-full rounded-xl border border-input bg-background px-3.5 text-sm"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="ticket-message"
                      className="mb-1.5 block text-xs font-medium"
                    >
                      Message *
                    </label>
                    <textarea
                      id="ticket-message"
                      required
                      rows={5}
                      value={ticketMessage}
                      onChange={(e) => setTicketMessage(e.target.value)}
                      placeholder="Describe what you need help with…"
                      className="w-full resize-none rounded-xl border border-input bg-background p-3.5 text-sm leading-relaxed"
                    />
                  </div>

                  {!isAuthenticated ? (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <label
                          htmlFor="ticket-name"
                          className="mb-1.5 block text-xs font-medium"
                        >
                          Your name *
                        </label>
                        <input
                          id="ticket-name"
                          required
                          value={ticketName}
                          onChange={(e) => setTicketName(e.target.value)}
                          placeholder="Your name"
                          className="h-10 w-full rounded-xl border border-input bg-background px-3.5 text-sm"
                        />
                      </div>
                      <div>
                        <label
                          htmlFor="ticket-email"
                          className="mb-1.5 block text-xs font-medium"
                        >
                          Your email *
                        </label>
                        <input
                          id="ticket-email"
                          required
                          type="email"
                          value={ticketEmail}
                          onChange={(e) => setTicketEmail(e.target.value)}
                          onBlur={() => {
                            if (ticketEmail.trim()) {
                              void notifyIfFlagged(ticketEmail);
                            }
                          }}
                          placeholder="you@example.com"
                          className="h-10 w-full rounded-xl border border-input bg-background px-3.5 text-sm"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-border/60 bg-muted/30 px-3.5 py-3 text-xs text-muted-foreground">
                      Submitting as{" "}
                      <strong className="text-foreground">{loggedInName}</strong>
                      {authUser?.email ? ` · ${authUser.email}` : ""}
                    </div>
                  )}
                </div>

                <div className="flex shrink-0 justify-end gap-2 border-t bg-muted/20 px-5 py-3">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={ticketSubmitting}
                    onClick={() => setTicketOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={ticketSubmitting}
                    className="gap-2"
                  >
                    {ticketSubmitting ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Ticket className="size-4" />
                    )}
                    Submit ticket
                  </Button>
                </div>
              </form>
            </div>,
            document.body,
          )
        : null}
    </section>
  );
}
