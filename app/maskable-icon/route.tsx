import { ImageResponse } from "next/og";

/**
 * Android "maskable" PWA icon (manifest purpose: "maskable"): full-bleed brand square with the
 * letters inside the 80% safe zone, so the launcher can cut any shape (circle, squircle) cleanly.
 * The rounded macOS-style icon (app/icon.tsx) stays the "any" icon.
 */
export function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "linear-gradient(160deg, #1a5aa0 0%, #003F7D 55%, #002a55 100%)",
          color: "#f7f9fc",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 168,
          fontWeight: 700,
          letterSpacing: -4,
        }}
      >
        RS
      </div>
    ),
    { width: 512, height: 512 },
  );
}
