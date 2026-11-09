import { ImageResponse } from "next/og";

export const alt = "Eyal Danino — Computer Engineering, GPU Computing, Hardware & Robotics";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  const tiles = Array.from({ length: 64 }, (_, i) => i);
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background: "#05060a",
          color: "#e9edf6",
          position: "relative",
          padding: 72,
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", flex: 1 }}>
          <div style={{ display: "flex", fontSize: 22, letterSpacing: 6, color: "#38e8ff" }}>COMPUTER ENGINEERING · TECHNION</div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", fontSize: 150, fontWeight: 800, lineHeight: 0.92, letterSpacing: -6 }}>EYAL</div>
            <div style={{ display: "flex", fontSize: 150, fontWeight: 800, lineHeight: 0.92, letterSpacing: -6 }}>DANINO</div>
            <div style={{ display: "flex", marginTop: 28, fontSize: 30, color: "#8d96ab" }}>CUDA · FPGA · Robotics · AI Systems</div>
          </div>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", width: 360, height: 360, alignSelf: "center", gap: 6, padding: 14, border: "2px solid #38e8ff55", borderRadius: 16 }}>
          {tiles.map((i) => (
            <div key={i} style={{ width: 36, height: 36, borderRadius: 5, background: (i * 37) % 7 === 0 ? "#8b5cff" : "#38e8ff", opacity: 0.12 + ((i * 53) % 10) / 14 }} />
          ))}
        </div>
      </div>
    ),
    size,
  );
}
