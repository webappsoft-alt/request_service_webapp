import CryptoJS from "crypto-js";

function getSecretKey(): string {
  const key = process.env.NEXT_PUBLIC_SECRET_KEY;
  if (!key) {
    console.warn("[encrypted] NEXT_PUBLIC_SECRET_KEY is not set");
    return "rs-fallback-dev-key";
  }
  return key;
}

export function encryptData(data: unknown): string | null {
  try {
    return CryptoJS.AES.encrypt(JSON.stringify(data), getSecretKey()).toString();
  } catch (error) {
    console.error("Error encrypting data:", error);
    return null;
  }
}

export function decryptData<T = unknown>(data: string | null | undefined): T | null {
  try {
    if (data && typeof data === "string") {
      const bytes = CryptoJS.AES.decrypt(data, getSecretKey());
      if (bytes.sigBytes > 0) {
        const utf8String = bytes.toString(CryptoJS.enc.Utf8);
        if (utf8String) {
          return JSON.parse(utf8String) as T;
        }
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : error;
    console.warn("Warning decrypting data:", message);
  }
  return null;
}
