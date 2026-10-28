import "server-only";

import { readFileSync } from "node:fs";
import path from "node:path";
import { ImageResponse } from "next/og";

/**
 * Imagen para compartir (Open Graph) de cada página del blog y de /para,
 * 28/10/2026. Antes todas usaban la misma (/brand/laburo-og.png); ahora cada
 * una muestra su título, para que en WhatsApp, LinkedIn y Google se entienda
 * de qué es el enlace. Se genera al compilar (las rutas son estáticas), por eso
 * se puede leer la fuente y el logo con fs.
 */
export const OG_SIZE = { width: 1200, height: 630 };

const BOLD = readFileSync(path.join(process.cwd(), "assets", "og", "NotoSans-Bold.ttf"));
const REGULAR = readFileSync(path.join(process.cwd(), "assets", "og", "NotoSans-Regular.ttf"));
const WORDMARK = `data:image/png;base64,${readFileSync(
  path.join(process.cwd(), "public", "brand", "laburo-wordmark.png"),
).toString("base64")}`;

export function ogImage({ kicker, title }: { kicker: string; title: string }) {
  const size = title.length > 70 ? 54 : title.length > 45 ? 62 : 72;
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#000000",
          padding: "64px 72px",
          borderLeft: "12px solid #0047ff",
        }}
      >
        <div style={{ display: "flex", fontFamily: "Noto Sans", fontSize: 26, letterSpacing: 4, color: "#8a8a8a", textTransform: "uppercase" }}>
          {kicker}
        </div>
        <div style={{ display: "flex", fontFamily: "Noto Sans", fontWeight: 700, fontSize: size, lineHeight: 1.12, color: "#f5f5f5" }}>
          {title}
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text */}
          <img src={WORDMARK} width={268} height={48} />
          <div style={{ display: "flex", fontFamily: "Noto Sans", fontSize: 26, color: "#8a8a8a" }}>laburo.somosder.ar</div>
        </div>
      </div>
    ),
    {
      ...OG_SIZE,
      fonts: [
        { name: "Noto Sans", data: BOLD, weight: 700, style: "normal" },
        { name: "Noto Sans", data: REGULAR, weight: 400, style: "normal" },
      ],
    },
  );
}

/** El título de la página sin el «| LABURO» del metaTitle. */
export function tituloOg(title: string) {
  return title.replace(/\s*\|\s*LABURO\s*$/, "");
}
