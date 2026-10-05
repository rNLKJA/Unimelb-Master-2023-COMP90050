import { ImageResponse } from "next/og";

export const alt = "Self-Driving DB Lab — COMP90050 Group 40";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const NAVY = "#0b1222";
const MINT = "#7ce8c4";
const INK = "#e8eef8";
const MUTED = "#8e9bb5";

/** Social card: the arena's cumulative-time race in miniature. */
export default function OpengraphImage() {
  const lines = [
    { color: MUTED, pts: "0,250 600,40" },
    { color: "#f2c46b", pts: "0,250 120,215 240,170 360,130 480,95 600,62" },
    { color: "#8fb7f0", pts: "0,250 120,222 240,186 360,150 480,118 600,86" },
    { color: MINT, pts: "0,250 120,226 240,206 360,186 480,170 600,154" },
  ];
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        background: NAVY,
        padding: 64,
        color: INK,
        fontFamily: "monospace",
      }}
    >
      <div style={{ display: "flex", fontSize: 24, color: MINT, letterSpacing: 3 }}>
        COMP90050 · GROUP 40 · UNIVERSITY OF MELBOURNE
      </div>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
        <div style={{ display: "flex", flexDirection: "column", maxWidth: 560 }}>
          <div
            style={{ fontSize: 76, fontWeight: 700, lineHeight: 1.02, fontFamily: "sans-serif" }}
          >
            Self-Driving DB Lab
          </div>
          <div
            style={{
              fontSize: 28,
              color: MUTED,
              marginTop: 20,
              lineHeight: 1.35,
              fontFamily: "sans-serif",
            }}
          >
            Index advisors from 1985 to 2023 race on a live SQLite database in your browser.
          </div>
        </div>
        <svg width="420" height="260" viewBox="0 0 600 260">
          {[60, 120, 180, 240].map((y) => (
            <line key={y} x1="0" x2="600" y1={y} y2={y} stroke="#1f2b44" strokeWidth="2" />
          ))}
          {lines.map((l) => (
            <polyline
              key={l.pts}
              points={l.pts}
              fill="none"
              stroke={l.color}
              strokeWidth="6"
              strokeLinejoin="round"
            />
          ))}
        </svg>
      </div>
      <div style={{ display: "flex", fontSize: 22, color: MUTED }}>
        DROP · AutoAdmin · DB2 Advisor · CoPhy · C²UCB bandit · QB5000
      </div>
    </div>,
    size,
  );
}
