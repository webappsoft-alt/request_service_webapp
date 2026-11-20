"use client";

import { useId } from "react";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Platform brand navy — same as the invoice letterhead / print headers. */
export const STAMP_INK = "#003F7D";

/** Serrated seal edge: `teeth` points alternating between the outer and inner radius. */
function sealPath(cx: number, cy: number, outer: number, inner: number, teeth: number) {
  const points: string[] = [];
  for (let i = 0; i < teeth * 2; i += 1) {
    const radius = i % 2 === 0 ? outer : inner;
    const angle = (Math.PI * i) / teeth - Math.PI / 2;
    points.push(`${(cx + radius * Math.cos(angle)).toFixed(2)},${(cy + radius * Math.sin(angle)).toFixed(2)}`);
  }
  return `M${points.join("L")}Z`;
}

const SEAL = sealPath(100, 100, 98, 90, 40);

/** Ring text that always fits the top arc (~200 units): shrink long names, cap very long ones. */
function ringText(value: string) {
  const text = value.trim().toUpperCase();
  const capped = text.length > 30 ? `${text.slice(0, 29)}…` : text;
  const fontSize = capped.length <= 14 ? 15 : Math.max(8.5, (15 * 14) / capped.length);
  const letterSpacing = capped.length <= 14 ? 3 : capped.length <= 20 ? 1.5 : 0.6;
  return { text: capped, fontSize, letterSpacing };
}

/**
 * Rubber-stamp seal for paid invoices / receipts: serrated edge, double ring, the business name
 * around the top and "THANK YOU" around the bottom, a big "PAID" band (paid date under it) — in
 * the platform's brand navy, with a light worn-ink texture. Pure SVG: crisp on screen and in
 * print / PDF. Decorative (`aria-hidden`); paid status is always shown as text too.
 * Previous: red ink with "THANK YOU" top and bottom (no company name).
 */
export function PaidStamp({
  date,
  company,
  label = "Paid",
  size = "md",
  className,
}: {
  /** Paid date, printed small under the band (optional). */
  date?: string | null;
  /** Business name shown around the top of the seal (falls back to "THANK YOU"). */
  company?: string | null;
  label?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const ink = STAMP_INK;
  const px = { sm: 88, md: 136, lg: 176 }[size];
  const word = label.toUpperCase();
  const top = ringText(company && company.trim() ? company : "Thank you");

  return (
    <svg
      aria-hidden
      viewBox="0 0 200 200"
      width={px}
      height={px}
      className={cn(
        "pointer-events-none shrink-0 -rotate-[8deg] select-none [print-color-adjust:exact] [-webkit-print-color-adjust:exact]",
        className,
      )}
    >
      <defs>
        {/* Light worn-ink texture (fine speckles; text stays readable). */}
        <filter id={`${uid}-ink`} x="-5%" y="-5%" width="110%" height="110%">
          <feTurbulence type="fractalNoise" baseFrequency="1.1" numOctaves="1" seed="7" result="noise" />
          <feColorMatrix
            in="noise"
            type="matrix"
            values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -1.6 1.45"
            result="holes"
          />
          <feComposite in="SourceGraphic" in2="holes" operator="in" />
        </filter>
        <path id={`${uid}-top`} d="M 36 100 A 64 64 0 0 1 164 100" />
        <path id={`${uid}-bottom`} d="M 30 100 A 70 70 0 0 0 170 100" />
      </defs>

      <g filter={`url(#${uid}-ink)`}>
        {/* Serrated outer seal + rings */}
        <path d={SEAL} fill={ink} />
        <circle cx="100" cy="100" r="84" fill="#fff" />
        <circle cx="100" cy="100" r="80" fill="none" stroke={ink} strokeWidth="4" />
        <circle cx="100" cy="100" r="52" fill="none" stroke={ink} strokeWidth="2.5" />

        {/* Business name (top) · THANK YOU (bottom) */}
        <text
          fill={ink}
          fontSize={top.fontSize}
          fontWeight="800"
          letterSpacing={top.letterSpacing}
          fontFamily="Arial, Helvetica, sans-serif"
        >
          <textPath href={`#${uid}-top`} startOffset="50%" textAnchor="middle">
            {top.text}
          </textPath>
        </text>
        <text fill={ink} fontSize="14" fontWeight="800" letterSpacing="3" fontFamily="Arial, Helvetica, sans-serif">
          <textPath href={`#${uid}-bottom`} startOffset="50%" textAnchor="middle">
            THANK YOU
          </textPath>
        </text>
        {/* Side dots */}
        {[-1, 1].map((side) =>
          [-10, 0, 10].map((dy) => (
            <circle key={`${side}${dy}`} cx={100 + side * 66} cy={100 + dy} r="2.2" fill={ink} />
          )),
        )}

        {/* PAID band across the middle */}
        <g transform="rotate(-16 100 100)">
          <rect x="18" y="74" width="164" height="52" rx="3" fill="#fff" stroke={ink} strokeWidth="4" />
          <text
            x="100"
            y={date ? "110" : "115"}
            textAnchor="middle"
            fill={ink}
            fontSize={date ? 40 : 46}
            fontWeight="900"
            letterSpacing="4"
            fontFamily="Arial Black, Arial, Helvetica, sans-serif"
          >
            {word}
          </text>
          {date ? (
            <text
              x="100"
              y="121"
              textAnchor="middle"
              fill={ink}
              fontSize="9.5"
              fontWeight="700"
              letterSpacing="1.2"
              fontFamily="Arial, Helvetica, sans-serif"
            >
              {formatDate(date).toUpperCase()}
            </text>
          ) : null}
        </g>
      </g>
    </svg>
  );
}
