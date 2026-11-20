import { ImageResponse } from "next/og";

export const size = { width: 512, height: 512 };
export const contentType = "image/png";

/**
 * App / PWA icon ("any" purpose — desktop dock, taskbar, browser tab).
 * macOS doesn't round web-app icons, so the shape is drawn here like a native macOS app icon:
 * Apple's icon grid (824/1024 body → 412 px on 512, ~22.4% corner radius, transparent margin)
 * with a soft brand-navy gradient and drop shadow, so it sits in the Dock like the apps around it.
 * Previous: a full-bleed square navy tile. Android uses /maskable-icon; iOS uses apple-icon.tsx.
 */
export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "transparent",
        }}
      >
        <div
          style={{
            width: 412,
            height: 412,
            borderRadius: 92,
            background: "linear-gradient(160deg, #1a5aa0 0%, #003F7D 55%, #002a55 100%)",
            boxShadow: "0 10px 22px rgba(0, 20, 50, 0.35)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#f7f9fc",
            fontSize: 176,
            fontWeight: 700,
            letterSpacing: -4,
          }}
        >
          RS
        </div>
      </div>
    ),
    { ...size },
  );
}
