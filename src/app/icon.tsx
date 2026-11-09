import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

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
          background: "#05060a",
          border: "2px solid #38e8ff",
          borderRadius: 8,
          color: "#e9edf6",
          fontSize: 15,
          fontWeight: 800,
          letterSpacing: -1,
        }}
      >
        ED
      </div>
    ),
    size,
  );
}
