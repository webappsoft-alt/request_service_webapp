import Image from "next/image";
import { cn } from "@/lib/utils";

const CUSTOMER_PHOTOS: Record<string, string> = {
  maya: "/images/customers/maya.jpg",
  elena: "/images/customers/elena.jpg",
  noah: "/images/customers/noah.jpg",
  priya: "/images/customers/priya.jpg",
  luis: "/images/customers/luis.jpg",
};

const CREW_PHOTOS: Record<string, string> = {
  luis: "/images/crew/luis.jpg",
  ava: "/images/crew/ava.jpg",
  marcus: "/images/crew/marcus.jpg",
  sofia: "/images/crew/sofia.jpg",
};

const MARK_TONES = ["#003F7D", "#0b4f8a", "#1a3a5c", "#245a8f", "#0e3d6e"] as const;

function initialsFrom(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return name.slice(0, 2).toUpperCase() || "RS";
}

function toneFor(name: string) {
  const sum = [...name].reduce((total, char) => total + char.charCodeAt(0), 0);
  return MARK_TONES[sum % MARK_TONES.length];
}

export function CrmMark({
  name,
  photoKey,
  kind = "company",
  size = "lg",
}: {
  name: string;
  photoKey?: string;
  kind?: "company" | "person";
  size?: "sm" | "md" | "lg";
}) {
  const photo =
    kind === "person" && photoKey
      ? (CUSTOMER_PHOTOS[photoKey.toLowerCase()] ?? CREW_PHOTOS[photoKey.toLowerCase()])
      : undefined;
  const initials = initialsFrom(name);
  const box = size === "sm" ? "size-9" : size === "md" ? "size-11" : "size-14";

  return (
    <span
      className={cn(
        "relative grid shrink-0 place-items-center overflow-hidden rounded-md border border-black/10 text-white shadow-[0_6px_16px_rgba(4,26,54,0.12)]",
        box,
      )}
      style={photo ? undefined : { background: toneFor(name) }}
      aria-hidden="true"
    >
      {photo ? (
        <Image src={photo} alt="" fill sizes="56px" className="object-cover" />
      ) : kind === "company" ? (
        <svg viewBox="0 0 56 56" className="size-full">
          <rect width="56" height="56" fill={toneFor(name)} />
          <path d="M8 40V22l20-10 20 10v18H8Z" fill="rgba(255,255,255,0.1)" />
          <path d="M16 40V26h8v14h-8Zm16 0V26h8v14h-8Z" fill="rgba(255,255,255,0.16)" />
          <text
            x="28"
            y="34"
            textAnchor="middle"
            fill="white"
            fontSize="16"
            fontWeight="700"
            fontFamily="ui-sans-serif, system-ui, sans-serif"
          >
            {initials}
          </text>
        </svg>
      ) : (
        <span className="text-sm font-semibold tracking-wide">{initials}</span>
      )}
    </span>
  );
}
