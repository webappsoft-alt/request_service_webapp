import { cn } from "@/lib/utils";

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
  photoUrl,
  kind = "company",
  size = "lg",
}: {
  name: string;
  /** @deprecated Prefer photoUrl — kept for call-site compatibility. */
  photoKey?: string;
  /** Customer/user profile image URL (avatarUrl). */
  photoUrl?: string;
  kind?: "company" | "person";
  size?: "sm" | "md" | "lg";
}) {
  const initials = initialsFrom(name);
  const box = size === "sm" ? "size-9" : size === "md" ? "size-11" : "size-14";
  const imageUrl = (photoUrl || photoKey || "").trim();
  const looksLikeUrl =
    imageUrl.startsWith("http://") ||
    imageUrl.startsWith("https://") ||
    imageUrl.startsWith("/") ||
    imageUrl.startsWith("data:");

  if (looksLikeUrl) {
    return (
      <span
        className={cn(
          "relative grid shrink-0 place-items-center overflow-hidden rounded-md border border-input bg-muted shadow-[0_6px_16px_rgba(4,26,54,0.12)]",
          box,
        )}
        aria-hidden="true"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={imageUrl} alt="" className="size-full object-cover" />
      </span>
    );
  }

  return (
    <span
      className={cn(
        "relative grid shrink-0 place-items-center overflow-hidden rounded-md border border-input text-white shadow-[0_6px_16px_rgba(4,26,54,0.12)]",
        box,
      )}
      style={{ background: toneFor(name) }}
      aria-hidden="true"
    >
      {kind === "company" ? (
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
