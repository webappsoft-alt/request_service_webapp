"use client";

import { forwardRef } from "react";
import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";

/** Cloudflare Turnstile site key. Unset = the check is off (the API skips it too when its secret is unset). */
export const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_CLOUDFLARE_SITE_KEY || "";

export const turnstileEnabled = Boolean(TURNSTILE_SITE_KEY);

export type { TurnstileInstance };

/**
 * Cloudflare's "verify you're human" check on the signup screens. Reports a token on success and
 * "" when it expires or fails, so the form can block submit until there is a token.
 */
export const TurnstileField = forwardRef<
  TurnstileInstance | undefined,
  { onToken: (token: string) => void; className?: string }
>(function TurnstileField({ onToken, className }, ref) {
  if (!turnstileEnabled) return null;
  return (
    <Turnstile
      ref={ref}
      siteKey={TURNSTILE_SITE_KEY}
      className={className}
      options={{ theme: "light", size: "flexible", action: "signup", refreshExpired: "auto" }}
      onSuccess={(token) => onToken(token)}
      onExpire={() => onToken("")}
      onError={() => onToken("")}
    />
  );
});
