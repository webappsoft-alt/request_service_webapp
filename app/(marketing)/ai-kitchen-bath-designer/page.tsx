import { permanentRedirect } from "next/navigation";
import { AI_DESIGNER_PATH } from "@/lib/api/ai-redesigner-client";

/**
 * The designer now lives on the Kitchen & Bath Design page (/ai-kitchen-redesign) with its h1,
 * intro and FAQ. Old links and bookmarks to this URL land there (308).
 * Previous: this page rendered <RedesignerWizard /> (or a "coming soon" placeholder) under a
 * breadcrumb "Home / AI Designer".
 */
export default function AiKitchenBathDesignerRedirect() {
  permanentRedirect(AI_DESIGNER_PATH);
}
