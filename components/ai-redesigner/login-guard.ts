import { toast } from "sonner";
import { AI_DESIGNER_PATH } from "@/lib/api/ai-redesigner-client";

/** Guests can see the AI designer but must log in to use it; the toast links to login and back. */
export function showLoginRequired(navigate: (href: string) => void) {
  toast.error("Please log in to use the AI designer feature.", {
    id: "ai-designer-login-required",
    action: {
      label: "Log in",
      onClick: () => navigate(`/login?next=${encodeURIComponent(AI_DESIGNER_PATH)}`),
    },
  });
}
