import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/site";

/** Private app areas, auth flows and APIs — never crawled. */
const PRIVATE_PATHS = [
  "/account/",
  "/pro/",
  "/contractor/",
  "/technical/",
  "/api/",
  "/e/",
  "/login",
  "/register",
  "/signup",
  "/forgot-password",
  "/verify-forgot-otp",
  "/verify-otp",
  "/reset-password",
];

/** AI search / assistant crawlers (OpenAI, Anthropic, Perplexity) — explicitly welcome. */
const AI_AGENTS = [
  "GPTBot",
  "ChatGPT-User",
  "OAI-SearchBot",
  "ClaudeBot",
  "Claude-User",
  "Claude-SearchBot",
  "Claude-Web",
  "PerplexityBot",
  "Perplexity-User",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: PRIVATE_PATHS },
      // A bot that matches its own group ignores "*", so the private paths are repeated here.
      { userAgent: AI_AGENTS, allow: "/", disallow: PRIVATE_PATHS },
    ],
    sitemap: absoluteUrl("/sitemap.xml"),
    host: absoluteUrl("/"),
  };
}
