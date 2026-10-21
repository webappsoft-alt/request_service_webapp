import { publicApi } from "@/components/api/ApiRoutesFile";
import { extractCategoryList, type PublicCategory } from "@/store/categoriesSlice";

/**
 * First page of parent categories for server rendering (homepage "Browse services").
 * Same endpoint + params + parser as `fetchParentCategories`; never throws (empty on failure),
 * and the client thunk still runs on mount and takes over.
 */
export async function fetchParentCategoriesForSeo(): Promise<PublicCategory[]> {
  const base = String(process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(/\/+$/, "");
  if (!base) return [];
  try {
    const params = new URLSearchParams({ page: "1", limit: "50", only_parent: "true" });
    const response = await fetch(`${base}/${publicApi.categories}?${params}`, {
      headers: { Accept: "application/json" },
      next: { revalidate: 300 },
    });
    if (!response.ok) return [];
    return extractCategoryList(await response.json()).filter((item) => !item.parentCategory);
  } catch {
    return [];
  }
}
