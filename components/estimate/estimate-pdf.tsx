"use client";

import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from "react";
import type {
  EstimateApproval,
  EstimateShareLine,
  EstimateShareSnapshot,
} from "@/components/portal/use-estimate-share";
import { formatDate, formatLocation, formatMoney } from "@/lib/format";
import { formatTaxRatePercent } from "@/lib/tax/state-tax";
import { cn } from "@/lib/utils";

function groupShareLinesBySection(items: EstimateShareLine[]) {
  const order: string[] = [];
  const map = new Map<string, EstimateShareLine[]>();
  for (const item of items) {
    const key = String(item.section || "").trim();
    if (!map.has(key)) {
      map.set(key, []);
      order.push(key);
    }
    map.get(key)!.push(item);
  }
  // Always label sections (including General) so the customer preview matches the pro editor.
  return order.map((key) => {
    const rows = map.get(key) || [];
    return {
      key,
      label: key || "General",
      rows,
      total: rows.reduce((sum, row) => sum + (Number(row.total) || 0), 0),
    };
  });
}

export const DEFAULT_ESTIMATE_TERMS = [
  {
    title: "Acceptance",
    body: "This estimate is an offer to perform the work listed. Work starts only after the customer signs page 2. Signing authorizes the company to schedule the job at the price shown.",
  },
  {
    title: "Validity",
    body: "Pricing is valid for 30 days from the issue date, or until the expiry date on page 1 if one is shown. After that the company may revise labor or material prices.",
  },
  {
    title: "Scope",
    body: "Only the labor and materials listed on page 1 are included. Hidden conditions found after the site visit, code upgrades, permits, and extra materials are billed separately after a written change is approved.",
  },
  {
    title: "Access and site",
    body: "The customer will provide reasonable access, parking, and a working area. Delays caused by locked spaces, pets, or missing access may add trip or labor time.",
  },
  {
    title: "Payment",
    body: "Payment is due as stated on the invoice after the work is completed unless another schedule is written on this estimate. Past-due balances may pause remaining work.",
  },
  {
    title: "Warranty and insurance",
    body: "The company carries the licenses and insurance noted on page 1. Workmanship is warranted for one year unless a different term is written here. Manufacturer warranties apply to listed materials.",
  },
] as const;

export function EstimatePdfDocument({
  snapshot,
  approval,
  companySlot,
  customerSlot,
}: {
  snapshot: EstimateShareSnapshot;
  approval?: EstimateApproval;
  companySlot?: ReactNode;
  customerSlot?: ReactNode;
}) {
  return (
    <div className="space-y-6 print:space-y-0 print:p-0">
      <PdfPage n={1} of={2} snapshot={snapshot}>
        <PdfHeader snapshot={snapshot} />
        <div className="mt-6 grid grid-cols-2 gap-6">
          <PdfParty
            label="Prepared by"
            name={snapshot.companyName}
            lines={[
              `Issued ${formatDate(snapshot.issuedAt)}`,
              `Expires ${snapshot.expiresAt ? formatDate(snapshot.expiresAt) : "30 days"}`,
            ]}
          />
          <PdfParty
            label="Customer"
            name={snapshot.customerName}
            lines={[snapshot.customerPhone, snapshot.customerEmail, snapshot.street, formatLocation(snapshot.city, snapshot.state, snapshot.zip)]}
          />
        </div>
        {snapshot.notes ? (
          <div className="mt-5">
            <p className="text-[10px] font-semibold tracking-[0.16em] text-slate-700 uppercase">Notes</p>
            <p className="mt-1 whitespace-pre-wrap break-words text-[12px] leading-5 text-slate-800">
              {snapshot.notes}
            </p>
          </div>
        ) : null}
        <div className="mt-6">
          <p className="text-[10px] font-semibold tracking-[0.16em] text-[#003F7D] uppercase">Work details</p>
          <table className="mt-2 w-full table-fixed border-collapse text-[12px]">
            <colgroup>
              <col className="w-[58%]" />
              <col className="w-[12%]" />
              <col className="w-[10%]" />
              <col className="w-[10%]" />
              <col className="w-[10%]" />
            </colgroup>
            <thead>
              <tr className="border-y border-[#003F7D]/30 bg-[#003F7D] text-[10px] tracking-[0.12em] text-white uppercase print:bg-[#003F7D]">
                <th className="px-2 py-2 text-left font-semibold">Description</th>
                <th className="px-1.5 py-2 text-center font-semibold">Type</th>
                <th className="px-1.5 py-2 text-center font-semibold">Qty</th>
                <th className="px-1.5 py-2 text-center font-semibold">Price</th>
                <th className="px-2 py-2 text-center font-semibold">Amount</th>
              </tr>
            </thead>
            <tbody>
              {groupShareLinesBySection(snapshot.items).flatMap((group) => {
                const rows = [];
                if (group.label) {
                  rows.push(
                    <tr
                      key={`section-${group.key || "general"}`}
                      className="border-b border-[#d7dee8] bg-[#f1f5f9] print:bg-[#f1f5f9]"
                    >
                      <td
                        colSpan={5}
                        className="px-2 py-2 text-[11px] font-semibold tracking-[0.1em] text-slate-700 uppercase"
                      >
                        {group.label}
                      </td>
                    </tr>,
                  );
                }
                for (const [index, row] of group.rows.entries()) {
                  const materialImage =
                    row.kind === "materials" && row.images?.length
                      ? row.images[0]
                      : null;
                  rows.push(
                    <tr key={`${group.key}-${row.description}-${index}`} className="border-b border-input">
                      <td className="px-2 py-2 break-words font-medium align-middle">
                        <div className="flex min-w-0 items-center gap-2">
                          <div className="min-w-0 flex-1 whitespace-pre-wrap leading-snug">
                            {row.description ||
                              (row.kind === "labor"
                                ? "Labour"
                                : row.kind === "equipment"
                                  ? "Equipment"
                                  : "Material")}
                          </div>
                          {materialImage ? (
                            <span className="relative inline-block h-6 w-8 shrink-0 overflow-hidden rounded border border-input bg-[#f8fafc]">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={materialImage}
                                alt=""
                                className="size-full object-cover"
                              />
                            </span>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-1.5 py-2 capitalize whitespace-nowrap text-center text-muted-foreground align-top">
                        {row.kind === "materials"
                          ? "Material"
                          : row.kind === "equipment"
                            ? "Equipment"
                            : "Labour"}
                      </td>
                      <td className="px-1.5 py-2 text-center tabular-nums whitespace-nowrap text-muted-foreground align-top">
                        {row.quantity} {row.unit}
                      </td>
                      <td className="px-1.5 py-2 text-center tabular-nums whitespace-nowrap align-top">
                        {formatMoney(row.unitPrice)}
                      </td>
                      <td className="px-2 py-2 text-center font-medium tabular-nums whitespace-nowrap align-top">
                        {formatMoney(row.total)}
                      </td>
                    </tr>,
                  );
                }
                if (group.label) {
                  rows.push(
                    <tr key={`total-${group.key || "general"}`} className="border-b border-input bg-[#fafbfc]">
                      <td colSpan={4} className="px-2 py-2 text-right text-[11px] font-semibold text-slate-500">
                        {group.label} total
                      </td>
                      <td className="px-2 py-2 text-center font-semibold tabular-nums text-slate-800">
                        {formatMoney(group.total)}
                      </td>
                    </tr>,
                  );
                }
                return rows;
              })}
            </tbody>
          </table>
        </div>
        <div className="mt-4 ml-auto w-56 text-[12px]">
          <Row label="Subtotal" value={formatMoney(snapshot.subtotal)} />
          {Number(snapshot.discount) > 0 ? (
            <Row
              label="Discount"
              value={`-${formatMoney(Number(snapshot.discount) || 0)}`}
            />
          ) : null}
          <Row
            label={`Tax (${formatTaxRatePercent(snapshot.taxRatePercent)}%)`}
            value={formatMoney(snapshot.tax)}
          />
          <div className="mt-1 flex justify-between border-t border-[#003F7D]/25 pt-2 text-sm font-semibold">
            <span>Total</span>
            <span className="tabular-nums">{formatMoney(snapshot.total)}</span>
          </div>
        </div>
      </PdfPage>

      <PdfPage n={2} of={2} snapshot={snapshot}>
        <PdfHeader snapshot={snapshot} compact />
        <p className="mt-6 text-[10px] font-semibold tracking-[0.16em] text-[#003F7D] uppercase">Terms and conditions</p>
        {snapshot.terms ? (
          <p className="mt-2 border border-input bg-[#f8fafc] px-3 py-2 text-[12px] leading-5 print:bg-transparent">
            <span className="font-semibold">Project terms. </span>
            {snapshot.terms}
          </p>
        ) : null}
        <ol className="mt-3 space-y-3">
          {DEFAULT_ESTIMATE_TERMS.map((item, index) => (
            <li key={item.title} className="text-[12px] leading-5">
              <span className="font-semibold text-[#003F7D]">
                {index + 1}. {item.title}.{" "}
              </span>
              {item.body}
            </li>
          ))}
        </ol>
        <div className="mt-8 grid gap-6 sm:grid-cols-2">
          <SignatureBlock
            title="Company authorization"
            name={snapshot.companySignedBy || undefined}
            date={snapshot.companySignedAt}
            image={snapshot.companySignatureDataUrl || undefined}
            slot={companySlot}
            empty="Authorized company signature"
          />
          <SignatureBlock
            title="Customer approval"
            name={approval?.signedBy || snapshot.customerName}
            date={approval?.signedAt}
            image={approval?.signatureDataUrl}
            slot={customerSlot}
            empty="Customer signs to approve this estimate"
            snapshot={snapshot}
            isCustomer
          />
        </div>
      </PdfPage>
    </div>
  );
}

function PdfPage({
  n,
  of,
  snapshot,
  children,
}: {
  n: number;
  of: number;
  snapshot: EstimateShareSnapshot;
  children: ReactNode;
}) {
  const isLast = n === of;

  return (
    <article
      className={cn(
        "mx-auto flex w-full max-w-[8.5in] flex-col justify-between overflow-hidden rounded-[2px] border border-input bg-white shadow-[0_18px_40px_rgba(15,23,42,0.12)]",
        "print:m-0 print:flex print:min-h-[10.4in] print:w-full print:max-w-none print:flex-col print:justify-between print:rounded-none print:border-none print:bg-white print:p-0 print:shadow-none",
        isLast ? "print:break-after-avoid" : "print:break-after-page",
      )}
    >
      <div className="flex-1 min-h-[10in] px-8 py-7 print:min-h-0 print:px-0 print:py-0">
        {children}
      </div>
      <footer className="mt-auto flex items-center justify-between border-t border-input bg-[#f8fafc] px-8 py-2 text-[10px] text-muted-foreground print:bg-transparent print:px-0">
        <span>
          {snapshot.number} · {snapshot.companyName}
        </span>
        <span>
          Page {n} of {of}
        </span>
      </footer>
    </article>
  );
}

function PdfHeader({ snapshot, compact = false }: { snapshot: EstimateShareSnapshot; compact?: boolean }) {
  return (
    <header className={cn("flex items-start justify-between gap-4", compact && "border-b border-input pb-4")}>
      <div className="flex min-w-0 items-start gap-3">
        <CompanyMark snapshot={snapshot} />
        <div className="min-w-0">
          <p className="text-[15px] font-semibold tracking-tight">{snapshot.companyName}</p>
          <p className="text-[11px] leading-4 text-muted-foreground">
            {snapshot.companyStreet ? `${snapshot.companyStreet} · ` : ""}
            {snapshot.companyCity ? formatLocation(snapshot.companyCity, snapshot.companyState ?? "", snapshot.companyZip) : ""}
          </p>
          <p className="text-[11px] text-muted-foreground">
            {snapshot.companyPhone}
            {snapshot.companyEmail ? ` · ${snapshot.companyEmail}` : ""}
          </p>
          <p className="mt-1 text-[10px] font-medium tracking-[0.08em] text-[#003F7D] uppercase">
            {[snapshot.licensed ? "Licensed" : null, snapshot.insured ? "Insured" : null].filter(Boolean).join(" · ") || "Written estimate"}
          </p>
        </div>
      </div>
      <div className="shrink-0 text-right">
        <p className="text-[10px] font-semibold tracking-[0.18em] text-[#003F7D] uppercase">Estimate</p>
        <p className="mt-0.5 text-xl font-semibold tabular-nums">{snapshot.number}</p>
        <p className="text-[11px] text-muted-foreground">Total {formatMoney(snapshot.total)}</p>
      </div>
    </header>
  );
}

function CompanyMark({
  snapshot,
  size = "md",
}: {
  snapshot: EstimateShareSnapshot;
  size?: "sm" | "md";
}) {
  const initials = snapshot.logoInitials || snapshot.companyName.slice(0, 2).toUpperCase();
  const box = size === "sm" ? "size-10 text-[11px]" : "size-14 text-[13px]";
  return (
    <span
      className={cn(
        "relative flex shrink-0 items-center justify-center overflow-hidden rounded-[4px] border border-input bg-[#003F7D] font-semibold text-white",
        box,
      )}
    >
      {snapshot.logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img alt="" src={snapshot.logoUrl} className="size-full object-cover" />
      ) : (
        initials
      )}
    </span>
  );
}

function PdfParty({
  label,
  name,
  lines,
  mark,
}: {
  label: string;
  name: string;
  lines: Array<string | undefined>;
  mark?: ReactNode;
}) {
  return (
    <div className="flex min-w-0 items-start gap-2.5">
      {mark}
      <div className="min-w-0">
        <p className="text-[10px] font-semibold tracking-[0.16em] text-muted-foreground uppercase">{label}</p>
        <p className="mt-1 text-[13px] font-semibold">{name}</p>
        {lines.filter(Boolean).map((line) => (
          <p key={line} className="text-[11px] leading-4 text-muted-foreground">
            {line}
          </p>
        ))}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-0.5 text-muted-foreground">
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}

function SignatureBlock({
  title,
  name,
  date,
  image,
  slot,
  empty,
  snapshot,
  isCustomer = false,
}: {
  title: string;
  name?: string;
  date?: string;
  image?: string;
  slot?: ReactNode;
  empty: string;
  snapshot?: EstimateShareSnapshot;
  isCustomer?: boolean;
}) {
  return (
    <div className="flex flex-col">
      <p className="text-[10px] font-semibold tracking-[0.14em] text-[#003F7D] uppercase">{title}</p>
      {slot ? (
        slot
      ) : image ? (
        <div className="mt-2">
          <div className="h-20 border-b border-input">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img alt={name ? `Signature of ${name}` : "Signature"} src={image} className="h-full w-full object-contain object-left" />
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">{empty}</p>
          {name ? <p className="mt-1 text-[12px] font-medium">{name}</p> : null}
          {date ? <p className="text-[11px] text-muted-foreground">{formatDate(date.slice(0, 10))}</p> : null}
          {isCustomer && snapshot ? (
            <div className="mt-3 flex items-start gap-2 text-[11px] leading-4 text-foreground">
              <span className="mt-0.5 inline-flex size-3.5 shrink-0 items-center justify-center rounded-[2px] border border-input bg-white text-[10px] font-bold text-[#003F7D]">
                ✓
              </span>
              <span>
                I have read pages 1 and 2 and authorize <strong>{snapshot.companyName}</strong> to proceed for{" "}
                <strong>{formatMoney(snapshot.total)}</strong>.
              </span>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="mt-2">
          <div className="h-20 border-b border-input" />
          <p className="mt-2 text-[11px] text-muted-foreground">{empty}</p>
          {isCustomer && snapshot ? (
            <div className="mt-3 flex items-start gap-2 text-[11px] leading-4 text-foreground">
              <span className="mt-0.5 inline-block size-3.5 shrink-0 rounded-[2px] border border-input bg-white" />
              <span>
                I have read pages 1 and 2 and authorize <strong>{snapshot.companyName}</strong> to proceed for{" "}
                <strong>{formatMoney(snapshot.total)}</strong>.
              </span>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

export function typedSignature(name: string) {
  if (typeof document === "undefined") return "";
  const canvas = document.createElement("canvas");
  canvas.width = 420;
  canvas.height = 120;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";
  ctx.fillStyle = "#003F7D";
  ctx.font = "italic 36px Georgia, serif";
  ctx.fillText(String(name || "").trim(), 16, 72);
  return canvas.toDataURL("image/png");
}

export function useSignPad() {
  const ref = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const resize = () => {
      const ratio = window.devicePixelRatio || 1;
      const next = canvas.getBoundingClientRect();
      canvas.width = Math.max(1, Math.floor(next.width * ratio));
      canvas.height = Math.max(1, Math.floor(next.height * ratio));
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.scale(ratio, ratio);
      ctx.lineWidth = 2;
      ctx.lineCap = "round";
      ctx.strokeStyle = "#003F7D";
    };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  function point(event: PointerEvent<HTMLCanvasElement>) {
    const canvas = ref.current;
    if (!canvas) return { x: 0, y: 0 };
    const box = canvas.getBoundingClientRect();
    return { x: event.clientX - box.left, y: event.clientY - box.top };
  }

  function start(event: PointerEvent<HTMLCanvasElement>) {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx) return;
    canvas?.setPointerCapture(event.pointerId);
    drawing.current = true;
    const { x, y } = point(event);
    ctx.beginPath();
    ctx.moveTo(x, y);
    setDirty(true);
  }

  function move(event: PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    const ctx = ref.current?.getContext("2d");
    if (!ctx) return;
    const { x, y } = point(event);
    ctx.lineTo(x, y);
    ctx.stroke();
  }

  function end() {
    drawing.current = false;
  }

  function clear() {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setDirty(false);
  }

  function toImage() {
    return ref.current?.toDataURL("image/png") ?? "";
  }

  return { ref, start, move, end, clear, toImage, dirty };
}

export function SignaturePadField({
  name,
  onName,
  pad,
  showNameInput = false,
  showName = false,
  caption,
  date,
}: {
  name?: string;
  onName?: (value: string) => void;
  pad: ReturnType<typeof useSignPad>;
  showNameInput?: boolean;
  showName?: boolean;
  caption?: string;
  date?: string;
}) {
  return (
    <div className="mt-2">
      <div className="relative">
        <button
          type="button"
          className="absolute -top-5 right-0 text-[11px] font-medium text-[#003F7D] hover:underline z-10 print:hidden cursor-pointer"
          onClick={pad.clear}
        >
          Clear
        </button>
        <canvas
          ref={pad.ref}
          style={{ touchAction: "none" }}
          className="h-20 w-full cursor-crosshair border-b border-input bg-transparent"
          onPointerDown={pad.start}
          onPointerMove={pad.move}
          onPointerUp={pad.end}
          onPointerLeave={pad.end}
        />
      </div>
      {caption ? <p className="mt-2 text-[11px] text-muted-foreground">{caption}</p> : null}
      {showNameInput && onName ? (
        <div className="mt-1">
          <input
            className="h-7 w-full max-w-[220px] rounded-[4px] border border-input bg-white px-2 text-[12px] font-medium placeholder:text-muted-foreground/60 focus:border-[#003F7D] focus:outline-none"
            value={name || ""}
            onChange={(event) => onName(event.target.value)}
            placeholder="Signer name"
          />
        </div>
      ) : showName && name ? (
        <p className="mt-1 text-[12px] font-medium text-foreground">{name}</p>
      ) : null}
      {date ? <p className="mt-1 text-[11px] text-muted-foreground">{formatDate(date.slice(0, 10))}</p> : null}
    </div>
  );
}

