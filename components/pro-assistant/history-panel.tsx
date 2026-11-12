"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Loader2, MessageSquare, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { extractErrorMessage } from "@/components/api/extractErrorMessage";
import {
  deleteAssistantConversation,
  listAssistantConversations,
  renameAssistantConversation,
  type PaConversationSummary,
} from "./pro-assistant-api";

function when(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const days = Math.floor((Date.now() - date.getTime()) / 86_400_000);
  if (days < 1) return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  if (days < 7) return date.toLocaleDateString("en-US", { weekday: "short" });
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/**
 * Saved Pro co-pilot conversations: open one to continue it, rename, delete, or start new.
 * Slides over the chat inside the panel.
 */
export function ProAssistantHistory({
  activeId,
  onOpen,
  onNew,
  onClose,
  onDeleted,
}: {
  activeId: string | null;
  onOpen: (id: string) => void;
  onNew: () => void;
  onClose: () => void;
  onDeleted: (id: string) => void;
}) {
  const [rows, setRows] = useState<PaConversationSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<{ id: string; title: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const requestRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function load(term: string) {
    const request = ++requestRef.current;
    setLoading(true);
    setError(null);
    listAssistantConversations(term)
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

  async function rename() {
    if (!editing?.title.trim()) return;
    setBusyId(editing.id);
    try {
      const saved = await renameAssistantConversation(editing.id, editing.title.trim());
      setRows((prev) => prev.map((r) => (r.id === saved.id ? { ...r, title: saved.title } : r)));
      setEditing(null);
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setBusyId(null);
    }
  }

  async function remove(id: string) {
    setBusyId(id);
    try {
      await deleteAssistantConversation(id);
      setRows((prev) => prev.filter((r) => r.id !== id));
      setConfirmDelete(null);
      onDeleted(id);
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="absolute inset-0 z-30 flex flex-col bg-popover animate-in fade-in-0 slide-in-from-right-4 duration-200" role="region" aria-label="Co-pilot history">
      <div className="flex items-center justify-between gap-2 border-b px-3 py-2.5">
        <p className="text-sm font-semibold">Conversation history</p>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onNew}
            className="inline-flex h-8 items-center gap-1 rounded-lg bg-primary px-2.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="size-3.5" /> New
          </button>
          <button type="button" onClick={onClose} aria-label="Close history" className="flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground">
            <X className="size-4" />
          </button>
        </div>
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
            placeholder="Search conversations…"
            aria-label="Search conversations"
            className="h-8 min-w-0 flex-1 bg-transparent text-xs outline-none"
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {loading && !rows.length ? (
          <div className="flex items-center justify-center gap-2 py-10 text-xs text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Loading…
          </div>
        ) : error && !rows.length ? (
          <p className="px-4 py-8 text-center text-xs text-rose-600">{error}</p>
        ) : !rows.length ? (
          <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
            <MessageSquare className="size-7 text-muted-foreground/60" aria-hidden />
            <p className="text-sm font-medium">{query ? "No conversations match." : "No saved conversations yet"}</p>
            <p className="text-xs text-muted-foreground">Your chats with the co-pilot are saved here automatically.</p>
          </div>
        ) : (
          <ul className="divide-y">
            {rows.map((row) => (
              <li key={row.id} className={cn("group relative", row.id === activeId && "bg-primary/[0.05]")}>
                {editing?.id === row.id ? (
                  <div className="flex items-center gap-1.5 px-3 py-2.5">
                    <input
                      autoFocus
                      value={editing.title}
                      maxLength={120}
                      onChange={(event) => setEditing({ id: row.id, title: event.target.value })}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") void rename();
                        if (event.key === "Escape") setEditing(null);
                      }}
                      aria-label="Conversation title"
                      className="h-8 min-w-0 flex-1 rounded-md border bg-background px-2 text-sm outline-none focus:border-primary/50"
                    />
                    <button type="button" onClick={() => void rename()} aria-label="Save title" className="flex size-8 items-center justify-center rounded-md text-emerald-600 hover:bg-emerald-50">
                      {busyId === row.id ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
                    </button>
                    <button type="button" onClick={() => setEditing(null)} aria-label="Cancel rename" className="flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted">
                      <X className="size-4" />
                    </button>
                  </div>
                ) : confirmDelete === row.id ? (
                  <div className="flex items-center justify-between gap-2 bg-rose-50 px-3 py-2.5 dark:bg-rose-500/10">
                    <p className="min-w-0 truncate text-xs text-rose-800 dark:text-rose-200">Delete “{row.title}”?</p>
                    <div className="flex shrink-0 gap-1">
                      <button type="button" onClick={() => setConfirmDelete(null)} className="h-7 rounded-md px-2 text-xs font-medium hover:bg-white/70">
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
                    <button type="button" onClick={() => onOpen(row.id)} className="block w-full px-3 py-2.5 pr-20 text-left hover:bg-muted/60">
                      <span className="flex items-baseline justify-between gap-2">
                        <span className="truncate text-sm font-medium">{row.title}</span>
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                        {when(row.lastMessageAt)} · {row.messageCount} messages{row.preview ? ` · ${row.preview}` : ""}
                      </span>
                    </button>
                    <div className="absolute top-1/2 right-2 flex -translate-y-1/2 gap-0.5 opacity-0 transition group-hover:opacity-100 focus-within:opacity-100">
                      <button type="button" onClick={() => setEditing({ id: row.id, title: row.title })} aria-label={`Rename ${row.title}`} className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-background hover:text-foreground">
                        <Pencil className="size-3.5" />
                      </button>
                      <button type="button" onClick={() => setConfirmDelete(row.id)} aria-label={`Delete ${row.title}`} className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-rose-50 hover:text-rose-600">
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
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
