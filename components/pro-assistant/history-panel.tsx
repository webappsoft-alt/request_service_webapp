"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Loader2, MessageSquare, PanelLeftClose, Pencil, Plus, Search, Trash2, X } from "lucide-react";
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

/** Sidebar date groups (client): Today · Yesterday · Previous 7 days · Older (in list order). */
function dateGroups(rows: PaConversationSummary[]) {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const day = 86_400_000;
  const bucket = (value: string) => {
    const at = new Date(value).getTime();
    if (Number.isNaN(at)) return "Older";
    if (at >= startOfToday.getTime()) return "Today";
    if (at >= startOfToday.getTime() - day) return "Yesterday";
    if (at >= startOfToday.getTime() - 7 * day) return "Previous 7 days";
    return "Older";
  };
  const groups: Array<{ key: string; label: string; rows: PaConversationSummary[] }> = [];
  for (const row of rows) {
    const label = bucket(row.lastMessageAt);
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.rows.push(row);
    else groups.push({ key: `${label}-${groups.length}`, label, rows: [row] });
  }
  return groups;
}

/**
 * Saved Pro co-pilot conversations: open one to continue it, rename, delete, or start new.
 * `overlay` (small window): slides over the chat inside the panel.
 * `sidebar` (expanded window, client: Claude-style): a left pane next to the chat — "New
 * conversation" on top, then the list; collapsible. Reloads when `refreshKey` changes (a new chat
 * got saved, another one was opened).
 */
export function ProAssistantHistory({
  activeId,
  onOpen,
  onNew,
  onClose,
  onDeleted,
  variant = "overlay",
  refreshKey = null,
  focusSearchKey = 0,
}: {
  /** Changes (> 0) → focus the search box (the collapsed rail's Search button). */
  focusSearchKey?: number;
  activeId: string | null;
  onOpen: (id: string) => void;
  onNew: () => void;
  onClose: () => void;
  onDeleted: (id: string) => void;
  variant?: "overlay" | "sidebar";
  refreshKey?: string | null;
}) {
  const sidebar = variant === "sidebar";
  const [rows, setRows] = useState<PaConversationSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<{ id: string; title: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const requestRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (focusSearchKey > 0) searchRef.current?.focus();
  }, [focusSearchKey]);

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
    load(query);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // Reload when a chat is saved / switched (sidebar stays open meanwhile).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

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
    <div
      className={cn(
        "flex flex-col bg-popover",
        sidebar
          ? "w-[270px] shrink-0 bg-transparent animate-in fade-in-0 duration-300"
          : "absolute inset-0 z-30 animate-in fade-in-0 slide-in-from-right-4 duration-200",
      )}
      role="region"
      aria-label={sidebar ? "Conversation sidebar" : "Co-pilot history"}
    >
      {sidebar ? (
        <div className="flex items-center gap-1.5 border-b px-3 py-2.5">
          <button
            type="button"
            onClick={onNew}
            className="inline-flex h-9 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="size-3.5" /> New conversation
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Hide conversation sidebar"
            title="Hide sidebar"
            className="flex size-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <PanelLeftClose className="size-4" />
          </button>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-2 border-b px-3 py-2.5">
          <p className="text-sm font-semibold">Conversation history</p>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={onNew}
              className="inline-flex h-8 items-center gap-1 rounded-lg bg-primary px-2.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
            >
              <Plus className="size-3.5" /> New conversation
            </button>
            <button type="button" onClick={onClose} aria-label="Close history" className="flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground">
              <X className="size-4" />
            </button>
          </div>
        </div>
      )}


      <div className="border-b px-3 py-2">
        <div className="flex items-center gap-1.5 rounded-lg border bg-background px-2.5">
          <Search className="size-3.5 text-muted-foreground" aria-hidden />
          <input
            ref={searchRef}
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

      <div className="min-h-0 flex-1 overflow-y-auto" data-lenis-prevent>
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
          <div className={cn(sidebar && "flex flex-col gap-3 px-2 py-2")}>
          {(sidebar ? dateGroups(rows) : [{ key: "all", label: "", rows }]).map((group) => (
          <div key={group.key} role={group.label ? "group" : undefined} aria-label={group.label || undefined}>
          {group.label ? (
            <p className="px-2 pb-1 text-[10px] font-semibold tracking-[0.08em] text-muted-foreground/80 uppercase">{group.label}</p>
          ) : null}
          <ul className={cn(sidebar ? "flex flex-col gap-0.5" : "divide-y")}>
            {group.rows.map((row) => (
              <li
                key={row.id}
                aria-current={row.id === activeId ? "true" : undefined}
                className={cn(
                  "group relative",
                  sidebar && "rounded-lg",
                  row.id === activeId && (sidebar ? "bg-primary/10 dark:bg-primary/20" : "bg-primary/5"),
                )}
              >
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
                    <button
                      type="button"
                      onClick={() => onOpen(row.id)}
                      className={cn(
                        "block w-full text-left",
                        sidebar
                          ? "rounded-lg px-2.5 py-2 transition group-hover:pr-16 hover:bg-slate-200/60 dark:hover:bg-white/5"
                          : "px-3 py-2.5 pr-20 hover:bg-muted/60",
                      )}
                    >
                      <span className="flex items-baseline justify-between gap-2">
                        <span className={cn("truncate font-medium", sidebar ? "text-[13px]" : "text-sm", row.id === activeId && sidebar && "text-primary dark:text-foreground")}>
                          {row.title}
                        </span>
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                        {/* Sidebar: time + count only (no preview) so rows stay clean. */}
                        {when(row.lastMessageAt)} · {row.messageCount} messages{!sidebar && row.preview ? ` · ${row.preview}` : ""}
                      </span>
                    </button>
                    <div className="absolute top-1/2 right-1.5 flex -translate-y-1/2 gap-0.5 opacity-0 transition group-hover:opacity-100 focus-within:opacity-100">
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
          </div>
          ))}
          </div>
        )}
      </div>
    </div>
  );
}
