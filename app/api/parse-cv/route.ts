/**
 * POST /api/parse-cv — lee un CV con Gemini (tier gratuito) y devuelve los datos
 * estructurados para autocompletar el formulario de staff. MISMA lógica que el
 * endpoint de somosder.ar (un solo producto): registro y perfil comparten el
 * autollenado. La API key vive en el entorno (GEMINI_API_KEY), NUNCA en el cliente.
 *
 * Recibe { mime, data(base64), oficios[] } y devuelve { ok, data }.
 * Requiere GEMINI_API_KEY en el env (Franco la agrega al proyecto laburo, es la
 * misma de somosder-web). Sin key → 500 no_key (el form cae a carga manual).
 *
 * ⚠️ Endpoint PÚBLICO (middleware): comparte la cuota Gemini con somosder-web, así
 * que se endurece para que no lo abusen quemándola. Fail-closed: cap de tamaño de
 * body, allowlist de MIME (solo PDF/imagen), y timeout en la llamada a Gemini. Ante
 * cualquier duda, corta antes de gastar cuota.
 */

import { NextResponse } from "next/server";
import { clientIpFrom, rateLimitOr429 } from "@/lib/rate-limit";

export const runtime = "nodejs";
// gemini-2.5-flash quedó deprecado para cuentas nuevas (404). Usamos el alias
// estable "latest" del flash actual: gratis, apto tier free, sin deprecarse.
const MODEL = "gemini-flash-latest";

// Un CV en el form se capa a 10MB; en base64 infla ~33% → ~13.3MB. Dejamos 16MB
// de margen para el JSON entero (data + claves). Más que eso = cortamos.
const MAX_BODY_BYTES = 16 * 1024 * 1024;
// Largo máximo de la cadena base64 (defensa extra si content-length miente).
const MAX_DATA_CHARS = 15 * 1024 * 1024;
// MIME permitidos: lo que Gemini lee y lo que el form deja adjuntar.
const ALLOWED_MIME = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
]);
const GEMINI_TIMEOUT_MS = 20_000;

export async function POST(request: Request) {
  // FRENO DE ABUSO: esta ruta es pública (el formulario /sumate la usa sin cuenta)
  // y cada llamada gasta cuota de Gemini. Sin freno, un script con un PDF en un
  // loop deja el autollenado muerto para todos los que se anotan de verdad.
  // 6 por minuto y 30 por hora por IP: una persona sube su CV una vez, dos si se
  // equivocó de archivo.
  const ip = clientIpFrom(request);
  const frenado =
    rateLimitOr429(`parse-cv:${ip}`, 6, 60_000) ??
    rateLimitOr429(`parse-cv:hora:${ip}`, 30, 3_600_000);
  if (frenado) return frenado;

  const KEY = process.env.GEMINI_API_KEY;
  if (!KEY) return NextResponse.json({ error: "no_key" }, { status: 500 });

  // Cap de tamaño por content-length (barato, antes de leer el body).
  const clen = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(clen) && clen > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "too_large" }, { status: 413 });
  }

  let body: { mime?: string; data?: string; oficios?: string[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  const { mime, data, oficios } = body || {};

  if (typeof data !== "string" || data.length === 0) {
    return NextResponse.json({ error: "no_file" }, { status: 400 });
  }
  if (data.length > MAX_DATA_CHARS) {
    return NextResponse.json({ error: "too_large" }, { status: 413 });
  }
  // MIME allowlist fail-closed: sin MIME válido no llamamos a Gemini.
  const mimeType = typeof mime === "string" ? mime.toLowerCase() : "";
  if (!ALLOWED_MIME.has(mimeType)) {
    return NextResponse.json({ error: "bad_mime" }, { status: 415 });
  }

  const lista =
    Array.isArray(oficios) && oficios.length
      ? oficios.filter((o) => typeof o === "string").join(", ")
      : "";
  const prompt =
    `Extraé los datos de esta persona de su CV para una base de staff de eventos. ` +
    `Devolvé SOLO un objeto JSON con estas claves (usá null o [] si el dato no está; no inventes nada):\n` +
    `- nombre (solo el nombre de pila)\n- apellido\n- email\n- telefono (solo dígitos, sin prefijo de país)\n` +
    `- ciudad\n- pais\n- linkedin_url\n- portfolio_url\n` +
    `- anios_experiencia (uno de: "0–1","1–3","3–5","5–10","10+")\n` +
    `- experiencia_detalle (2 o 3 líneas resumiendo su experiencia laboral / en eventos)\n` +
    `- oficios (array; incluí SOLO valores EXACTOS de esta lista que apliquen a la persona: ${lista})`;

  // Timeout duro: si Gemini no responde a tiempo, abortamos (no colgamos la request).
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);
  let r: Response;
  try {
    r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            { parts: [{ inline_data: { mime_type: mimeType, data } }, { text: prompt }] },
          ],
          generationConfig: { response_mime_type: "application/json", temperature: 0 },
        }),
        signal: controller.signal,
      },
    );
  } catch (e) {
    const aborted = e instanceof Error && e.name === "AbortError";
    return NextResponse.json(
      { error: aborted ? "timeout" : "fetch_failed" },
      { status: aborted ? 504 : 502 },
    );
  } finally {
    clearTimeout(timer);
  }
  if (!r.ok) return NextResponse.json({ error: "gemini", status: r.status }, { status: 502 });

  const g = await r.json();
  const text = g?.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = {};
  }
  return NextResponse.json({ ok: true, data: parsed });
}
