import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/**
 * iPhone / iPad home-screen icon. iOS rounds the corners itself, so this one is full-bleed
 * (a transparent margin would show as a black frame there).
 */
export default function AppleIcon() {
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
          fontSize: 76,
          fontWeight: 700,
          letterSpacing: -2,
        }}
      >
        RS
      </div>
    ),
    { ...size },
  );
}
