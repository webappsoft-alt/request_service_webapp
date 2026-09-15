export const GALLERY_MIN = 3;
export const GALLERY_MAX = 7;

export type BusinessGalleryImage = {
  url: string;
  isBanner: boolean;
  sortOrder: number;
};

export function normalizeBusinessGallery(value: unknown): BusinessGalleryImage[] {
  if (!Array.isArray(value)) return [];
  const items = value
    .map((entry, index) => {
      if (typeof entry === "string" && entry.trim()) {
        return { url: entry.trim(), isBanner: index === 0, sortOrder: index };
      }
      if (!entry || typeof entry !== "object") return null;
      const record = entry as Record<string, unknown>;
      const url = typeof record.url === "string" ? record.url.trim() : "";
      if (!url) return null;
      return {
        url,
        isBanner: Boolean(record.isBanner),
        sortOrder: typeof record.sortOrder === "number" ? record.sortOrder : index,
      };
    })
    .filter((item): item is BusinessGalleryImage => Boolean(item))
    .slice(0, GALLERY_MAX)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((item, index) => ({ ...item, sortOrder: index }));

  if (items.length && !items.some((item) => item.isBanner)) {
    items[0] = { ...items[0], isBanner: true };
  }
  return items;
}

export function galleryBanner(images: BusinessGalleryImage[]): BusinessGalleryImage | undefined {
  return images.find((item) => item.isBanner) ?? images[0];
}

export function galleryRest(images: BusinessGalleryImage[]): BusinessGalleryImage[] {
  const banner = galleryBanner(images);
  return images.filter((item) => item.url !== banner?.url);
}

export function withBannerAt(images: BusinessGalleryImage[], url: string): BusinessGalleryImage[] {
  return images.map((item, index) => ({
    ...item,
    isBanner: item.url === url,
    sortOrder: item.url === url ? 0 : index + 1,
  }));
}

export function reorderGallery(
  images: BusinessGalleryImage[],
  fromIndex: number,
  toIndex: number,
): BusinessGalleryImage[] {
  if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0) return images;
  const next = [...images];
  const [moved] = next.splice(fromIndex, 1);
  if (!moved) return images;
  next.splice(toIndex, 0, moved);
  return next.map((item, index) => ({ ...item, sortOrder: index }));
}

export function galleryIsReady(images: BusinessGalleryImage[]) {
  return images.length >= GALLERY_MIN && images.length <= GALLERY_MAX && Boolean(galleryBanner(images));
}
