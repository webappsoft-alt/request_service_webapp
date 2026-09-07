import { ImageResponse } from "next/og";

export const size = { width: 512, height: 512 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#003F7D",
          color: "#f7f9fc",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 220,
          fontWeight: 700,
        }}
      >
        RS
      </div>
    ),
    { ...size }
  );
}
