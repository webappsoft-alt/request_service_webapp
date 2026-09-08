import axios, { type AxiosResponse } from "axios";
import { DocUpload, FileUpload, imageUpload } from "./ApiRoutesFile";
import { extractErrorMessage, getAuthToken } from "./apiFuntions";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

function buildUrl(endpoint: string): string {
  const base = String(API_BASE_URL || "").replace(/\/+$/, "");
  const path = String(endpoint || "").replace(/^\/+/, "");
  if (!base) return `/${path}`;
  return `${base}/${path}`;
}

function getFileExtension(filename: string): string {
  return filename.slice(((filename.lastIndexOf(".") - 1) >>> 0) + 2);
}

function isValidFileType(
  file: File,
  type: string[] = [
    "jpg",
    "jpeg",
    "png",
    "webp",
    "gif",
    "bmp",
    "svg",
    "ico",
    "avif",
    "heic",
    "heif",
    "tif",
    "tiff",
  ],
): boolean {
  const fileExtension = getFileExtension(file.name).toLowerCase();
  return type.includes(fileExtension);
}

/**
 * Auth only — do NOT set Content-Type for FormData.
 * The browser/axios must add multipart boundary automatically.
 */
function authHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const token = getAuthToken();
  const headers = { ...extra };
  // Strip any Content-Type so multipart boundary is preserved.
  delete headers["Content-Type"];
  delete headers["content-type"];
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

export type UploadError = {
  message: string;
};

/** Pull a usable image URL/path from common upload response shapes. */
export function extractUploadedUrl(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const root = payload as Record<string, unknown>;
  const nested =
    root.data && typeof root.data === "object"
      ? (root.data as Record<string, unknown>)
      : null;

  const candidates = [
    root.image,
    root.url,
    root.path,
    root.location,
    root.imageUrl,
    root.fileUrl,
    root.avatarUrl,
    nested?.image,
    nested?.url,
    nested?.path,
    nested?.location,
    nested?.imageUrl,
    nested?.fileUrl,
    nested?.avatarUrl,
  ];

  for (const value of candidates) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function toUploadError(error: unknown, fallback: string): UploadError {
  return { message: extractErrorMessage(error) || fallback };
}

export async function uploadFile(
  file: File,
  header2: Record<string, string> = {},
): Promise<AxiosResponse> {
  const check = isValidFileType(file);
  if (!check) {
    throw {
      message:
        "Invalid file type. Please upload a valid image (jpg, jpeg, png, webp, gif, bmp, svg, ico, avif, heic, heif, tif, tiff).",
    } satisfies UploadError;
  }

  const formData = new FormData();
  formData.append("image", file);

  try {
    return await axios.post(buildUrl(imageUpload), formData, {
      headers: authHeaders(header2),
    });
  } catch (error) {
    throw toUploadError(error, "Failed to upload image. Try again later.");
  }
}

export async function uploadDoc(
  file: File,
  header2: Record<string, string> = {},
): Promise<AxiosResponse> {
  const formData = new FormData();
  formData.append("file", file);

  try {
    return await axios.post(buildUrl(DocUpload), formData, {
      headers: authHeaders(header2),
    });
  } catch (error) {
    throw toUploadError(error, "Failed to upload document. Try again later.");
  }
}

export async function uploadAnyFile(
  file: File,
  header2: Record<string, string> = {},
): Promise<AxiosResponse> {
  const formData = new FormData();
  formData.append("file", file);

  try {
    return await axios.post(buildUrl(FileUpload), formData, {
      headers: authHeaders(header2),
    });
  } catch (error) {
    throw toUploadError(error, "Failed to upload file. Try again later.");
  }
}
