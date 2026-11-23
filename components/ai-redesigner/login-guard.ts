import { toast } from "sonner";
import { AI_DESIGNER_PATH } from "@/lib/api/ai-redesigner-client";

/**
 * Guests can use the whole designer (upload, room, style, finishes); only generating needs an
 * account (the API requires a login and limits runs per person). The toast links to login and back
 * to the page they were on; the wizard keeps their photo and picks for the return.
 * Previous text: "Please log in to use the AI designer feature." (shown on the photo upload too).
 */
export function showLoginRequired(navigate: (href: string) => void) {
  const back = typeof window !== "undefined" ? window.location.pathname : AI_DESIGNER_PATH;
  toast.error("Log in or create a free account to generate your design.", {
    id: "ai-designer-login-required",
    description: "Your photo and picks are kept, so you can pick up right where you left off.",
    action: {
      label: "Log in",
      onClick: () => navigate(`/login?next=${encodeURIComponent(back)}`),
    },
  });
}
