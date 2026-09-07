import { buildMetadata } from "@/lib/seo";

export function portalMetadata(title: string, description: string, path: string) {
  return buildMetadata({
    title,
    description,
    path,
    index: false,
    follow: false,
  });
}
