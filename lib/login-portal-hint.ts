import { toast } from "sonner";
import { extractErrorMessage } from "@/components/api/apiFuntions";

/** The sign-in pages the API's "wrong portal" message can point to. */
const PORTALS = [
  { path: "/technical/login", label: "Go to technician sign-in" },
  { path: "/contractor/login", label: "Go to contractor sign-in" },
  { path: "/pro/login", label: "Go to Pro sign-in" },
  { path: "/login", label: "Go to customer sign-in" },
];

/**
 * Login error toast. When the API says the account belongs on another sign-in page
 * ("This is a technician account… sign in on … (/technical/login)"), the toast gets a
 * button that opens that page.
 */
export function showLoginErrorToast(error: unknown, fallback: string, navigate: (href: string) => void) {
  const message = extractErrorMessage(error) || fallback;
  const portal = PORTALS.find((item) => message.includes(`(${item.path})`));
  toast.error(message, {
    duration: portal ? 10000 : undefined,
    action: portal ? { label: portal.label, onClick: () => navigate(portal.path) } : undefined,
  });
  return message;
}
