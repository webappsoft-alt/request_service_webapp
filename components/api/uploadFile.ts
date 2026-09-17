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
  const index = filename.lastIndexOf(".");
  return index >= 0 ? filename.slice(index + 1).toLowerCase() : "";
}

const IMAGE_EXTENSIONS = [
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
] as const;

export const ATTACHMENT_MAX_FILE_SIZE = 500 * 1024 * 1024; // 500MB

export const ALLOWED_ATTACHMENT_MIME_TYPES = [
  // Videos
  "video/mp4",
  "video/quicktime",
  // Audio
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/ogg",
  "audio/aac",
  "audio/m4a",
  "audio/webm",
  "audio/m4b",
  // Documents
  "application/pdf",
  // Images
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
] as const;

export const ALLOWED_ATTACHMENT_EXTENSIONS = [
  "mp4",
  "mov",
  "mp3",
  "wav",
  "ogg",
  "aac",
  "m4a",
  "webm",
  "m4b",
  "pdf",
  "jpeg",
  "jpg",
  "png",
  "webp",
  "gif",
] as const;

export const ATTACHMENT_ACCEPT_ATTRIBUTE = [
  ...ALLOWED_ATTACHMENT_MIME_TYPES,
  ...ALLOWED_ATTACHMENT_EXTENSIONS.map((ext) => `.${ext}`),
].join(",");

export function isValidAttachmentFile(file: File): boolean {
  if (file.size > ATTACHMENT_MAX_FILE_SIZE) return false;
  if (ALLOWED_ATTACHMENT_MIME_TYPES.includes(file.type as (typeof ALLOWED_ATTACHMENT_MIME_TYPES)[number])) {
    return true;
  }
  const ext = getFileExtension(file.name);
  if (ext && ALLOWED_ATTACHMENT_EXTENSIONS.includes(ext as (typeof ALLOWED_ATTACHMENT_EXTENSIONS)[number])) {
    return true;
  }
  return false;
}

export function validateAttachmentFile(file: File): { valid: true } | { valid: false; error: string } {
  if (file.size > ATTACHMENT_MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `"${file.name}" exceeds the maximum 500MB size limit.`,
    };
  }
  if (!isValidAttachmentFile(file)) {
    return {
      valid: false,
      error: `"${file.name}" format is not allowed. Supported formats: Videos (MP4, MOV), Audio (MP3, WAV, OGG, AAC, M4A, WEBM, M4B), Documents (PDF), Images (JPEG, PNG, WEBP, GIF).`,
    };
  }
  return { valid: true };
}

function isValidFileType(file: File): boolean {
  const fileExtension = getFileExtension(file.name);
  if (fileExtension && IMAGE_EXTENSIONS.includes(fileExtension as (typeof IMAGE_EXTENSIONS)[number])) {
    return true;
  }
  return file.type.startsWith("image/");
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
    root.file,
    root.url,
    root.path,
    root.location,
    root.imageUrl,
    root.fileUrl,
    root.avatarUrl,
    nested?.image,
    nested?.file,
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
    throw new Error(
      "Invalid file type. Please upload a valid image (jpg, jpeg, png, webp, gif, bmp, svg, ico, avif, heic, heif, tif, tiff).",
    );
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
  const check = validateAttachmentFile(file);
  if (!check.valid) {
    throw new Error(check.error);
  }

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
