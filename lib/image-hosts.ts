/**
 * Remote hosts the Next image optimizer may fetch from (used by next.config `remotePatterns`).
 * Anything else — API upload hosts, signed URLs on other domains, data:/blob: — is served as-is.
 */
export const OPTIMIZED_IMAGE_HOSTS = ["images.unsplash.com", "storage.googleapis.com"] as const;

/** true → let next/image resize + convert (AVIF/WebP); false → pass `unoptimized`. */
export function canOptimizeImage(src: string | null | undefined) {
  const value = String(src || "").trim();
  if (!value) return false;
  if (value.startsWith("/") && !value.startsWith("//")) return true;
  if (!/^https:\/\//i.test(value)) return false;
  try {
    return (OPTIMIZED_IMAGE_HOSTS as readonly string[]).includes(new URL(value).hostname);
  } catch {
    return false;
  }
}
