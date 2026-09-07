import { ImageResponse } from "next/og";
import { siteConfig } from "@/lib/site";

export const alt = `${siteConfig.name} — ${siteConfig.tagline}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#003F7D",
          color: "#f7f9fc",
          padding: "72px",
          fontFamily: "Georgia, serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 28 }}>
          <div
            style={{
              width: 48,
              height: 48,
              background: "#f7f9fc",
              color: "#003F7D",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 700,
            }}
          >
            RS
          </div>
          Request Services
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 18, maxWidth: 900 }}>
          <div style={{ fontSize: 64, lineHeight: 1.1, fontWeight: 600 }}>
            The professional marketplace for home services.
          </div>
          <div style={{ fontSize: 28, color: "rgba(247,249,252,0.72)" }}>
            Find local professionals. Run estimates, jobs, invoices, and payments.
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
