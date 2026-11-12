"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, FileText, Loader2, Plus, Search, Trash2, UserRound, X } from "lucide-react";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import { extractErrorMessage } from "@/components/api/extractErrorMessage";
import {
  createAssistantEstimate,
  searchAssistantCustomers,
  type PaCustomerOption,
  type PaDraftItem,
  type PaEstimateDraft,
} from "./pro-assistant-api";

const KIND_LABEL: Record<PaDraftItem["kind"], string> = { labor: "Labor", material: "Material", equipment: "Equipment" };

function money2(n: number) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

/** Search + pick one of the Pro's customers. */
function CustomerPicker({
  value,
  initialQuery,
  candidates,
  onChange,
  disabled,
}: {
  value: PaCustomerOption | null;
  initialQuery: string;
  candidates: PaCustomerOption[];
  onChange: (customer: PaCustomerOption | null) => void;
  disabled?: boolean;
}) {
  const [query, setQuery] = useState(initialQuery);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<PaCustomerOption[]>(candidates);
  const requestRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  function search(term: string) {
    const request = ++requestRef.current;
    setLoading(true);
    searchAssistantCustomers(term)
      .then((rows) => {
        if (request === requestRef.current) setResults(rows);
      })
      .catch(() => {
        if (request === requestRef.current) setResults([]);
      })
      .finally(() => {
        if (request === requestRef.current) setLoading(false);
      });
  }

  if (value) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-lg border bg-background px-2.5 py-1.5">
        <span className="flex min-w-0 items-center gap-2">
          <UserRound className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
          <span className="min-w-0">
            <span className="block truncate text-xs font-semibold">{value.name}</span>
            {value.subtitle ? <span className="block truncate text-[11px] text-muted-foreground">{value.subtitle}</span> : null}
          </span>
        </span>
        {!disabled ? (
          <button type="button" onClick={() => onChange(null)} aria-label="Change customer" className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground">
            <X className="size-3.5" />
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="flex items-center gap-1.5 rounded-lg border bg-background px-2.5">
        <Search className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
        <input
          value={query}
          disabled={disabled}
          onFocus={() => {
            setOpen(true);
            search(query);
          }}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onChange={(event) => {
            const next = event.target.value;
            setQuery(next);
            setOpen(true);
            if (timerRef.current) clearTimeout(timerRef.current);
            timerRef.current = setTimeout(() => search(next), 250);
          }}
          placeholder="Search your customers…"
          aria-label="Customer for this estimate"
          className="h-8 min-w-0 flex-1 bg-transparent text-xs outline-none"
        />
        {loading ? <Loader2 className="size-3.5 animate-spin text-muted-foreground" /> : null}
      </div>
      {open ? (
        <div className="absolute inset-x-0 top-full z-20 mt-1 max-h-48 overflow-y-auto rounded-lg border bg-popover shadow-lg">
          {results.length ? (
            results.map((c) => (
              <button
                key={c.id}
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  onChange(c);
                  setOpen(false);
                }}
                className="flex w-full items-center justify-between gap-2 px-2.5 py-1.5 text-left hover:bg-muted"
              >
                <span className="min-w-0">
                  <span className="block truncate text-xs font-medium">{c.name}</span>
                  {c.subtitle ? <span className="block truncate text-[11px] text-muted-foreground">{c.subtitle}</span> : null}
                </span>
                {c.hasAddress === false ? <span className="shrink-0 text-[10px] text-amber-700">No address</span> : null}
              </button>
            ))
          ) : (
            <p className="px-2.5 py-2 text-[11px] text-muted-foreground">{loading ? "Searching…" : "No customers match."}</p>
          )}
        </div>
      ) : null}
    </div>
  );
}

/**
 * AI-drafted estimate in the chat: editable title, customer, line items and notes, then
 * "Create estimate" (creates the estimate workspace + estimate through the existing services).
 */
export function EstimateDraftCard({
  draft,
  created,
  onCreated,
  conversationId,
  messageId,
}: {
  draft: PaEstimateDraft;
  /** Saved chat + message this draft belongs to (marked "created" in history). */
  conversationId?: string | null;
  messageId?: string;
  created: { href: string; number: string } | null | undefined;
  onCreated: (result: { href: string; number: string }) => void;
}) {
  const [title, setTitle] = useState(draft.title);
  const [customer, setCustomer] = useState<PaCustomerOption | null>(draft.customer);
  const [items, setItems] = useState<PaDraftItem[]>(() =>
    draft.items.map(({ description, kind, quantity, unit, unitPrice }) => ({ description, kind, quantity, unit, unitPrice })),
  );
  const [notes, setNotes] = useState(draft.notes);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const locked = Boolean(created) || saving;

  const total = useMemo(() => money2(items.reduce((t, i) => t + (Number(i.quantity) || 0) * (Number(i.unitPrice) || 0), 0)), [items]);
  const validItems = items.filter((i) => i.description.trim() && Number(i.quantity) > 0);

  function update(index: number, patch: Partial<PaDraftItem>) {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }

  async function create() {
    if (!customer || !validItems.length || !title.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const result = await createAssistantEstimate({
        customerId: customer.id,
        title: title.trim(),
        notes: notes.trim(),
        items: validItems.map((i) => ({ ...i, quantity: money2(i.quantity), unitPrice: money2(i.unitPrice) })),
        conversationId: conversationId || null,
        messageId,
      });
      onCreated({ href: result.href, number: result.number });
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="w-full overflow-hidden rounded-xl border bg-card shadow-sm">
      <div className="flex items-center gap-2 border-b bg-linear-to-r from-primary/[0.07] to-transparent px-3 py-2">
        <span className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <FileText className="size-4" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">Draft estimate</p>
          <input
            value={title}
            disabled={locked}
            onChange={(event) => setTitle(event.target.value)}
            aria-label="Estimate title"
            className="w-full truncate bg-transparent text-sm font-semibold outline-none disabled:opacity-100"
          />
        </div>
      </div>

      <div className="flex flex-col gap-2.5 p-3">
        <div className="flex flex-col gap-1">
          <span className="text-[11px] font-medium text-muted-foreground">Customer</span>
          <CustomerPicker
            value={customer}
            initialQuery={draft.customerName || ""}
            candidates={draft.customerCandidates}
            onChange={setCustomer}
            disabled={locked}
          />
          {draft.customerName && !draft.customer && !customer ? (
            <p className="text-[11px] text-muted-foreground">
              {draft.customerCandidates.length ? `Pick the right “${draft.customerName}”.` : `No customer named “${draft.customerName}” yet — search or add them first.`}
            </p>
          ) : null}
          {customer?.hasAddress === false ? (
            <p className="text-[11px] text-amber-700">This customer has no service address — add one before creating.</p>
          ) : null}
        </div>

        <div className="overflow-hidden rounded-lg border">
          <div className="flex items-center justify-between bg-muted/50 px-2.5 py-1.5 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
            <span>Line items</span>
            <span>{items.length}</span>
          </div>
          {items.map((item, index) => (
            <div key={index} className="flex flex-col gap-1.5 border-t px-2.5 py-2">
              <div className="flex items-start gap-1.5">
                <textarea
                  value={item.description}
                  disabled={locked}
                  rows={1}
                  onChange={(event) => update(index, { description: event.target.value })}
                  aria-label={`Line ${index + 1} description`}
                  className="min-w-0 flex-1 resize-none bg-transparent text-xs leading-snug font-medium outline-none [field-sizing:content]"
                />
                <span className="shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">{KIND_LABEL[item.kind]}</span>
                {!locked && items.length > 1 ? (
                  <button
                    type="button"
                    onClick={() => setItems((prev) => prev.filter((_, i) => i !== index))}
                    aria-label={`Remove line ${index + 1}`}
                    className="-mt-0.5 flex size-6 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-rose-50 hover:text-rose-600"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                ) : null}
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <span>Qty</span>
                <input
                  type="number"
                  min={0.01}
                  step="any"
                  value={item.quantity}
                  disabled={locked}
                  onChange={(event) => update(index, { quantity: Number(event.target.value) })}
                  aria-label={`Line ${index + 1} quantity`}
                  className="h-7 w-14 rounded border bg-background px-1.5 text-right text-xs text-foreground tabular-nums outline-none focus:border-primary/50"
                />
                {item.unit ? <span>{item.unit}</span> : null}
                <span>×</span>
                <span className="relative">
                  <span className="pointer-events-none absolute top-1/2 left-1.5 -translate-y-1/2 text-xs">$</span>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={item.unitPrice}
                    disabled={locked}
                    onChange={(event) => update(index, { unitPrice: Number(event.target.value) })}
                    aria-label={`Line ${index + 1} unit price`}
                    className="h-7 w-24 rounded border bg-background pr-1.5 pl-4 text-right text-xs text-foreground tabular-nums outline-none focus:border-primary/50"
                  />
                </span>
                <span className="ml-auto text-xs font-semibold text-foreground tabular-nums">
                  {formatMoney(money2((Number(item.quantity) || 0) * (Number(item.unitPrice) || 0)))}
                </span>
              </div>
            </div>
          ))}
          <div className="flex items-center justify-between border-t bg-muted/30 px-2 py-1.5">
            {!locked ? (
              <button
                type="button"
                onClick={() => setItems((prev) => [...prev, { description: "", kind: "labor", quantity: 1, unit: "", unitPrice: 0 }])}
                className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
              >
                <Plus className="size-3" /> Add line
              </button>
            ) : (
              <span />
            )}
            <span className="text-xs">
              <span className="text-muted-foreground">Total </span>
              <span className="font-semibold tabular-nums">{formatMoney(total)}</span>
            </span>
          </div>
        </div>

        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-medium text-muted-foreground">Scope notes for the customer</span>
          <textarea
            value={notes}
            disabled={locked}
            rows={2}
            onChange={(event) => setNotes(event.target.value)}
            className="resize-none rounded-lg border bg-background px-2.5 py-1.5 text-xs outline-none focus:border-primary/50"
          />
        </label>

        {error ? (
          <p className="flex items-start gap-1.5 rounded-md bg-rose-50 px-2.5 py-1.5 text-[11px] text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            {error}
          </p>
        ) : null}

        {created ? (
          <div className="flex items-center justify-between gap-2 rounded-lg bg-emerald-50 px-2.5 py-2 text-xs text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300">
            <span className="inline-flex items-center gap-1.5 font-medium">
              <CheckCircle2 className="size-4" aria-hidden />
              Estimate {created.number || ""} created
            </span>
            <Link href={created.href} className="font-semibold underline underline-offset-2">
              Open
            </Link>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => void create()}
            disabled={saving || !customer || !validItems.length || !title.trim()}
            className={cn(
              "inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50",
            )}
          >
            {saving ? <Loader2 className="size-3.5 animate-spin" /> : <CheckCircle2 className="size-3.5" />}
            {saving ? "Creating…" : !customer ? "Pick a customer to create" : "Create estimate"}
          </button>
        )}
      </div>
    </div>
  );
}
