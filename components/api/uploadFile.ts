import axios, { type AxiosResponse } from "axios";
import { DocUpload, FileUpload, imageUpload } from "./ApiRoutesFile";
import { getAuthToken } from "./cookieUtils";

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

function authHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const token = getAuthToken();
  return {
    ...extra,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export type UploadError = {
  message: string;
};

export async function uploadFile(
  file: File,
  header2: Record<string, string> = {},
): Promise<AxiosResponse> {
  try {
    const check = isValidFileType(file);
    if (!check) {
      const err: UploadError = {
        message:
          "Invalid file type. Please upload a valid image (jpg, jpeg, png, webp, gif, bmp, svg, ico, avif, heic, heif, tif, tiff).",
      };
      throw err;
    }
    const formData = new FormData();
    formData.append("image", file);
    return await axios.post(buildUrl(imageUpload), formData, {
      headers: authHeaders({
        "Content-Type": "multipart/form-data",
        ...header2,
      }),
    });
  } catch (error) {
    console.error("Error uploading file:", error);
    throw error;
  }
}

export async function uploadDoc(
  file: File,
  header2: Record<string, string> = {},
): Promise<AxiosResponse> {
  try {
    const formData = new FormData();
    formData.append("file", file);
    return await axios.post(buildUrl(DocUpload), formData, {
      headers: authHeaders({
        "Content-Type": "multipart/form-data",
        ...header2,
      }),
    });
  } catch (error) {
    console.error("Error uploading document:", error);
    throw error;
  }
}

export async function uploadAnyFile(
  file: File,
  header2: Record<string, string> = {},
): Promise<AxiosResponse> {
  try {
    const formData = new FormData();
    formData.append("file", file);
    return await axios.post(buildUrl(FileUpload), formData, {
      headers: authHeaders({
        "Content-Type": "multipart/form-data",
        ...header2,
      }),
    });
  } catch (error) {
    console.error("Error uploading file:", error);
    throw error;
  }
}
