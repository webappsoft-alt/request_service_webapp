import { permanentRedirect } from "next/navigation";
import { AI_DESIGNER_PATH } from "@/lib/api/ai-redesigner-client";

/**
 * Kitchen & Bath Design moved to /kitchen-bath-design (matches the navbar label). Old links and
 * search results land there (308).
 * Previous: this route rendered the page itself (centered h1, the designer, admin FAQ); before that,
 * an info page with log-in buttons.
 */
export default function AiKitchenRedesignRedirect() {
  permanentRedirect(AI_DESIGNER_PATH);
}
