"use client";

import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from "react";
import type { EstimateApproval, EstimateShareSnapshot } from "@/components/portal/use-estimate-share";
import { formatDate, formatLocation, formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";

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
    <div className="space-y-6">
      <PdfPage n={1} of={2} snapshot={snapshot}>
        <PdfHeader snapshot={snapshot} />
        <div className="mt-6 grid grid-cols-2 gap-6">
          <PdfParty
            label="Prepared by"
            name={snapshot.companyName}
            lines={[
              snapshot.companyStreet,
              snapshot.companyCity ? formatLocation(snapshot.companyCity, snapshot.companyState ?? "", snapshot.companyZip) : undefined,
              snapshot.companyPhone,
              snapshot.companyEmail,
            ]}
          />
          <PdfParty
            label="Customer"
            name={snapshot.customerName}
            lines={[snapshot.customerPhone, snapshot.customerEmail, snapshot.street, formatLocation(snapshot.city, snapshot.state, snapshot.zip)]}
          />
        </div>
        <div className="mt-6 grid grid-cols-3 gap-3 border border-black/10 bg-[#f8fafc] px-3 py-2.5 text-[11px]">
          <Meta label="Estimate" value={snapshot.number} />
          <Meta label="Issued" value={formatDate(snapshot.issuedAt)} />
          <Meta label="Expires" value={snapshot.expiresAt ? formatDate(snapshot.expiresAt) : "30 days"} />
        </div>
        <div className="mt-6">
          <p className="text-[10px] font-semibold tracking-[0.16em] text-[#003F7D] uppercase">Work details</p>
          <table className="mt-2 w-full border-collapse text-[12px]">
            <thead>
              <tr className="border-y border-black/10 bg-[#e8eef5] text-[10px] tracking-[0.12em] text-[#003F7D] uppercase">
                <th className="px-2 py-2 text-left font-semibold">Description</th>
                <th className="px-2 py-2 text-left font-semibold">Type</th>
                <th className="px-2 py-2 text-right font-semibold">Qty</th>
                <th className="px-2 py-2 text-right font-semibold">Price</th>
                <th className="px-2 py-2 text-right font-semibold">Amount</th>
              </tr>
            </thead>
            <tbody>
              {snapshot.items.map((row, index) => (
                <tr key={`${row.description}-${index}`} className="border-b border-black/8">
                  <td className="px-2 py-2 font-medium">{row.description || (row.kind === "labor" ? "Labor" : "Material")}</td>
                  <td className="px-2 py-2 capitalize text-muted-foreground">{row.kind}</td>
                  <td className="px-2 py-2 text-right tabular-nums text-muted-foreground">
                    {row.quantity} {row.unit}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums">{formatMoney(row.unitPrice)}</td>
                  <td className="px-2 py-2 text-right font-medium tabular-nums">{formatMoney(row.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-4 ml-auto w-56 text-[12px]">
          <Row label="Subtotal" value={formatMoney(snapshot.subtotal)} />
          <Row label="Tax" value={formatMoney(snapshot.tax)} />
          <div className="mt-1 flex justify-between border-t border-[#003F7D]/25 pt-2 text-sm font-semibold">
            <span>Total</span>
            <span className="tabular-nums">{formatMoney(snapshot.total)}</span>
          </div>
        </div>
        {snapshot.notes ? (
          <div className="mt-6">
            <p className="text-[10px] font-semibold tracking-[0.16em] text-[#003F7D] uppercase">Notes</p>
            <p className="mt-1 text-[12px] leading-5">{snapshot.notes}</p>
          </div>
        ) : null}
        <p className="mt-8 text-[11px] text-muted-foreground">Terms, conditions, and signatures continue on page 2.</p>
      </PdfPage>

      <PdfPage n={2} of={2} snapshot={snapshot}>
        <PdfHeader snapshot={snapshot} compact />
        <p className="mt-6 text-[10px] font-semibold tracking-[0.16em] text-[#003F7D] uppercase">Terms and conditions</p>
        {snapshot.terms ? (
          <p className="mt-2 border border-black/10 bg-[#f8fafc] px-3 py-2 text-[12px] leading-5">
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
            name={snapshot.companySignedBy || snapshot.companyName}
            date={snapshot.companySignedAt}
            image={snapshot.companySignatureDataUrl}
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
  return (
    <article className="mx-auto w-full max-w-[8.5in] overflow-hidden rounded-[2px] border border-black/15 bg-white shadow-[0_18px_40px_rgba(15,23,42,0.12)]">
      <div className="min-h-[10.4in] px-8 py-7">
        {children}
      </div>
      <footer className="flex items-center justify-between border-t border-black/10 bg-[#f8fafc] px-8 py-2 text-[10px] text-muted-foreground">
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
    <header className={cn("flex items-start justify-between gap-4", compact && "border-b border-black/10 pb-4")}>
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

function CompanyMark({ snapshot }: { snapshot: EstimateShareSnapshot }) {
  const initials = snapshot.logoInitials || snapshot.companyName.slice(0, 2).toUpperCase();
  return (
    <span className="relative flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-[4px] border border-black/10 bg-[#003F7D] text-[13px] font-semibold text-white">
      {snapshot.logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img alt="" src={snapshot.logoUrl} className="size-full object-cover" />
      ) : (
        initials
      )}
    </span>
  );
}

function PdfParty({ label, name, lines }: { label: string; name: string; lines: Array<string | undefined> }) {
  return (
    <div>
      <p className="text-[10px] font-semibold tracking-[0.16em] text-muted-foreground uppercase">{label}</p>
      <p className="mt-1 text-[13px] font-semibold">{name}</p>
      {lines.filter(Boolean).map((line) => (
        <p key={line} className="text-[11px] leading-4 text-muted-foreground">
          {line}
        </p>
      ))}
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">{label}</p>
      <p className="mt-0.5 font-semibold">{value}</p>
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
}: {
  title: string;
  name: string;
  date?: string;
  image?: string;
  slot?: ReactNode;
  empty: string;
}) {
  return (
    <div className="rounded-[4px] border border-black/10 p-3">
      <p className="text-[10px] font-semibold tracking-[0.14em] text-[#003F7D] uppercase">{title}</p>
      {slot ? (
        slot
      ) : image ? (
        <div className="mt-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img alt={`Signature of ${name}`} src={image} className="h-16 w-full object-contain object-left" />
          <p className="mt-2 text-[12px] font-medium">{name}</p>
          {date ? <p className="text-[11px] text-muted-foreground">{formatDate(date.slice(0, 10))}</p> : null}
        </div>
      ) : (
        <div className="mt-3">
          <div className="h-16 border-b border-black/25" />
          <p className="mt-2 text-[11px] text-muted-foreground">{empty}</p>
          <p className="text-[12px] font-medium">{name}</p>
        </div>
      )}
    </div>
  );
}

export function typedSignature(name: string) {
  const canvas = document.createElement("canvas");
  canvas.width = 420;
  canvas.height = 120;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";
  ctx.fillStyle = "#003F7D";
  ctx.font = "italic 36px Georgia, serif";
  ctx.fillText(name, 16, 72);
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
}: {
  name: string;
  onName: (value: string) => void;
  pad: ReturnType<typeof useSignPad>;
}) {
  return (
    <div className="mt-2 space-y-2">
      <input
        className="h-8 w-full rounded-[4px] border border-black/15 px-2 text-[12px]"
        value={name}
        onChange={(event) => onName(event.target.value)}
        placeholder="Full name"
      />
      <div>
        <div className="mb-1 flex justify-end">
          <button type="button" className="text-[11px] font-medium text-primary hover:underline" onClick={pad.clear}>
            Clear
          </button>
        </div>
        <canvas
          ref={pad.ref}
          className="h-20 w-full cursor-crosshair rounded-[4px] border border-black/15 bg-[#f8fafc]"
          onPointerDown={pad.start}
          onPointerMove={pad.move}
          onPointerUp={pad.end}
          onPointerLeave={pad.end}
        />
      </div>
    </div>
  );
}
