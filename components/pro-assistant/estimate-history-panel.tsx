"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, FileText, Loader2, MessageSquare, Save, Search, Trash2, UserRound, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/format";
import { extractErrorMessage } from "@/components/api/extractErrorMessage";
import { deleteAssistantDraft, listAssistantEstimateHistory, type PaEstimateHistoryItem } from "./pro-assistant-api";

function when(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

/**
 * AI estimate history (client): the drafts the Pro saved with "Save Draft" and the estimate drafts
 * the co-pilot generated in chats — title, customer, total, date / time. A saved draft reopens in
 * the chat as an editable card (save again or create the estimate); a generated one opens its chat.
 * Slides over the chat inside the panel, like Conversation history.
 */
export function ProAssistantEstimateHistory({
  onOpenSaved,
  onOpenChat,
  onClose,
}: {
  onOpenSaved: (id: string) => void;
  onOpenChat: (conversationId: string) => void;
  onClose: () => void;
}) {
  const [rows, setRows] = useState<PaEstimateHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const requestRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function load(term: string) {
    const request = ++requestRef.current;
    setLoading(true);
    setError(null);
    listAssistantEstimateHistory(term)
      .then((list) => {
        if (request === requestRef.current) setRows(list);
      })
      .catch((err) => {
        if (request === requestRef.current) setError(extractErrorMessage(err));
      })
      .finally(() => {
        if (request === requestRef.current) setLoading(false);
      });
  }

  useEffect(() => {
    load("");
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  async function remove(id: string) {
    setBusyId(id);
    try {
      await deleteAssistantDraft(id);
      setRows((prev) => prev.filter((r) => r.id !== id));
      setConfirmDelete(null);
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div
      className="absolute inset-0 z-30 flex flex-col bg-popover animate-in fade-in-0 slide-in-from-right-4 duration-200"
      role="region"
      aria-label="AI estimate history"
    >
      <div className="flex items-center justify-between gap-2 border-b px-3 py-2.5">
        <div className="min-w-0">
          <p className="text-sm font-semibold">AI estimate history</p>
          <p className="text-[11px] text-muted-foreground">Saved drafts and estimates drafted in your chats</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close estimate history"
          className="flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <X className="size-4" />
        </button>
      </div>

      <div className="border-b px-3 py-2">
        <div className="flex items-center gap-1.5 rounded-lg border bg-background px-2.5">
          <Search className="size-3.5 text-muted-foreground" aria-hidden />
          <input
            value={query}
            onChange={(event) => {
              const next = event.target.value;
              setQuery(next);
              if (timerRef.current) clearTimeout(timerRef.current);
              timerRef.current = setTimeout(() => load(next), 250);
            }}
            placeholder="Search by title or customer…"
            aria-label="Search AI estimates"
            className="h-8 min-w-0 flex-1 bg-transparent text-xs outline-none"
          />
          {loading && rows.length ? <Loader2 className="size-3.5 animate-spin text-muted-foreground" /> : null}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto" data-lenis-prevent>
        {loading && !rows.length ? (
          <div className="flex items-center justify-center gap-2 py-10 text-xs text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Loading…
          </div>
        ) : error && !rows.length ? (
          <p className="px-4 py-8 text-center text-xs text-rose-600">{error}</p>
        ) : !rows.length ? (
          <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
            <FileText className="size-7 text-muted-foreground/60" aria-hidden />
            <p className="text-sm font-medium">{query ? "No AI estimates match." : "No AI estimates yet"}</p>
            <p className="text-xs text-muted-foreground">Ask the co-pilot to draft an estimate, then tap Save Draft to keep it here.</p>
          </div>
        ) : (
          <ul className="divide-y">
            {rows.map((row) => (
              <li key={row.id} className="group relative">
                {confirmDelete === row.id ? (
                  <div className="flex items-center justify-between gap-2 bg-rose-50 px-3 py-2.5 dark:bg-rose-500/10">
                    <p className="min-w-0 truncate text-xs text-rose-800 dark:text-rose-200">Delete saved draft “{row.title}”?</p>
                    <div className="flex shrink-0 gap-1">
                      <button type="button" onClick={() => setConfirmDelete(null)} className="h-7 rounded-md px-2 text-xs font-medium hover:bg-white/70 dark:hover:bg-white/10">
                        Keep
                      </button>
                      <button
                        type="button"
                        onClick={() => void remove(row.id)}
                        className="inline-flex h-7 items-center gap-1 rounded-md bg-rose-600 px-2 text-xs font-semibold text-white hover:bg-rose-700"
                      >
                        {busyId === row.id ? <Loader2 className="size-3.5 animate-spin" /> : null}
                        Delete
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => (row.source === "saved" ? onOpenSaved(row.id) : row.conversationId && onOpenChat(row.conversationId))}
                      className={cn("flex w-full items-start gap-2.5 px-3 py-2.5 text-left hover:bg-muted/60", row.source === "saved" && "pr-11")}
                      aria-label={`Open ${row.title}`}
                    >
                      <span
                        className={cn(
                          "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg",
                          row.source === "saved" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
                        )}
                        aria-hidden
                      >
                        {row.source === "saved" ? <Save className="size-3.5" /> : <MessageSquare className="size-3.5" />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-baseline justify-between gap-2">
                          <span className="truncate text-sm font-medium">{row.title}</span>
                          <span className="shrink-0 text-sm font-semibold tabular-nums">{formatMoney(row.total)}</span>
                        </span>
                        <span className="mt-0.5 flex min-w-0 items-center gap-1 text-xs text-muted-foreground">
                          <UserRound className="size-3 shrink-0" aria-hidden />
                          <span className="truncate">{row.customerName || "No customer yet"}</span>
                        </span>
                        <span className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                          <span
                            className={cn(
                              "rounded-full px-1.5 py-px text-[10px] font-semibold",
                              row.source === "saved"
                                ? "bg-primary/10 text-primary"
                                : "bg-muted text-muted-foreground",
                            )}
                          >
                            {row.source === "saved" ? "Saved draft" : "From chat"}
                          </span>
                          {row.created ? (
                            <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-50 px-1.5 py-px text-[10px] font-semibold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
                              <CheckCircle2 className="size-2.5" aria-hidden /> {row.created.number ? `Created ${row.created.number}` : "Created"}
                            </span>
                          ) : null}
                          <span>
                            {when(row.at)} · {row.itemCount} item{row.itemCount === 1 ? "" : "s"}
                          </span>
                        </span>
                      </span>
                    </button>
                    {row.source === "saved" ? (
                      <button
                        type="button"
                        onClick={() => setConfirmDelete(row.id)}
                        aria-label={`Delete ${row.title}`}
                        className="absolute top-2.5 right-2 flex size-7 items-center justify-center rounded-md text-muted-foreground opacity-0 transition group-hover:opacity-100 focus-visible:opacity-100 hover:bg-rose-50 hover:text-rose-600 max-sm:opacity-100 dark:hover:bg-rose-500/10"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    ) : null}
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
