import { aiRedesignerApi } from "@/components/api/ApiRoutesFile";
import { getData, postData } from "@/components/api/apiFuntions";
import { extractUploadedUrl, uploadFile } from "@/components/api/uploadFile";

/** Customer page for the AI Kitchen & Bath Redesigner. */
export const AI_DESIGNER_PATH = "/ai-kitchen-bath-designer";
/**
 * Launch switch for customers. While false, the home banner shows a "coming soon" toast and the
 * designer page shows a placeholder (admins keep testing from the admin panel). Flip to true to launch.
 */
export const AI_DESIGNER_LIVE = false;

export type RoomType = "kitchen" | "bathroom";
export type FinishCategory = "cabinets" | "countertops" | "backsplash" | "hardware";
export type FinishKind = "style" | "color";
export type FinishPattern =
  | "none"
  | "marble"
  | "speckle"
  | "wood"
  | "subway"
  | "square"
  | "herringbone"
  | "checker"
  | "metal";

export const FINISH_CATEGORIES: FinishCategory[] = ["cabinets", "countertops", "backsplash", "hardware"];

export type RedesignStyle = {
  id: string;
  roomType: RoomType;
  name: string;
  description: string;
  image: string;
  swatches: string[];
  defaults: Record<FinishCategory, { style: string | null; color: string | null }>;
};

export type RedesignFinish = {
  id: string;
  roomType: RoomType;
  category: FinishCategory;
  kind: FinishKind;
  name: string;
  color: string;
  color2: string;
  image: string;
  pattern?: FinishPattern;
};

export type RedesignCatalog = {
  enabled: boolean;
  rooms?: Array<{ roomType: RoomType; categories: Array<{ key: FinishCategory; label: string }> }>;
  styles?: RedesignStyle[];
  finishes?: RedesignFinish[];
  section?: { title: string; subtitle: string };
};

export type RedesignContact = { name: string; email: string; phone: string; zip: string };

export type FinishPicks = Record<FinishCategory, { style: string | null; color: string | null }>;

export type RedesignGeneration = {
  id: string;
  status: "pending" | "processing" | "done" | "failed";
  error: string;
  roomType: RoomType;
  style: string;
  selections: Array<{ category: FinishCategory; style: string; color: string }>;
  notes: string;
  sourceImage: string;
  resultImage: string;
  createdAt: string;
};

type Envelope<T> = { success?: boolean; data?: T };
const unwrap = <T,>(response: Envelope<T> | T): T =>
  (response && typeof response === "object" && "data" in (response as Envelope<T>)
    ? (response as Envelope<T>).data
    : response) as T;

export async function getRedesignCatalog() {
  const response = await getData<Envelope<RedesignCatalog>>(aiRedesignerApi.catalog, undefined, {
    silent: true,
    token: null,
    skipLogoutOn401: true,
    force: true,
  });
  return unwrap(response);
}

export async function startRedesign(body: {
  roomType: RoomType;
  styleId: string;
  finishes: FinishPicks;
  notes: string;
  sourceImage: string;
  contact: RedesignContact;
  consent: boolean;
}) {
  const response = await postData<Envelope<RedesignGeneration>>(aiRedesignerApi.generations, body, {
    silent: true,
    skipLogoutOn401: true,
  });
  return unwrap(response);
}

export async function getRedesign(id: string) {
  const response = await getData<Envelope<RedesignGeneration>>(aiRedesignerApi.generation(id), undefined, {
    silent: true,
    token: null,
    skipLogoutOn401: true,
    force: true,
  });
  return unwrap(response);
}

export const ROOM_PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const ROOM_PHOTO_MAX_BYTES = 15 * 1024 * 1024;

/** Uploads the room photo to our storage; the server only accepts photos from there. */
export async function uploadRoomPhoto(file: File) {
  const response = await uploadFile(file);
  const url = extractUploadedUrl(response.data);
  if (!url) throw new Error("Upload failed. Please try again.");
  return url;
}
