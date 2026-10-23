import { ImageResponse } from "next/og";
import {
  ENSO_PATH,
  KANJI_PATH,
  KANJI_SHADOW_PATH,
  WORDMARK_PATHS,
} from "@/components/brand/logo-paths";

export const alt = "Kiluu — Stream, Collect & Gift Anime";
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
          alignItems: "center",
          justifyContent: "center",
          gap: 56,
          color: "#e9e2d0",
          background: "#15110e",
        }}
      >
        <svg width="310" height="310" viewBox="0 0 200 200">
          <path d={ENSO_PATH} fill="#e9e2d0" />
          <path d={KANJI_SHADOW_PATH} fill="#7a0f1d" transform="translate(60 136.92) scale(.084 -.084)" />
          <path d={KANJI_PATH} fill="#d7263d" transform="translate(58 133.92) scale(.084 -.084)" />
        </svg>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <svg width="480" height="195" viewBox="180 28 185 75" aria-hidden="true">
            <g fill="#e9e2d0">
              {WORDMARK_PATHS.map(({ d, transform }, index) => (
                <path key={index} d={d} transform={transform} />
              ))}
            </g>
          </svg>
          <span style={{ marginTop: 24, fontSize: 26, letterSpacing: 7, color: "#c1b8a6" }}>
            STREAM · COLLECT · GIFT
          </span>
          <span style={{ marginTop: 18, fontSize: 22, color: "#a69d90" }}>Your anime universe</span>
        </div>
      </div>
    ),
    size,
  );
}
