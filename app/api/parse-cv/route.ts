/**
 * POST /api/parse-cv — lee un CV con Gemini (tier gratuito) y devuelve los datos
 * estructurados para autocompletar el formulario de staff. MISMA lógica que el
 * endpoint de somosder.ar (un solo producto): registro y perfil comparten el
 * autollenado. La API key vive en el entorno (GEMINI_API_KEY), NUNCA en el cliente.
 *
 * Recibe { mime, data(base64), oficios[] } y devuelve { ok, data }.
 * Requiere GEMINI_API_KEY en el env (Franco la agrega al proyecto laburo, es la
 * misma de somosder-web). Sin key → 500 no_key (el form cae a carga manual).
 */

import { NextResponse } from "next/server";

export const runtime = "nodejs";
const MODEL = "gemini-2.5-flash";

export async function POST(request: Request) {
  const KEY = process.env.GEMINI_API_KEY;
  if (!KEY) return NextResponse.json({ error: "no_key" }, { status: 500 });

  let body: { mime?: string; data?: string; oficios?: string[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  const { mime, data, oficios } = body || {};
  if (!data) return NextResponse.json({ error: "no_file" }, { status: 400 });

  const lista = Array.isArray(oficios) && oficios.length ? oficios.join(", ") : "";
  const prompt =
    `Extraé los datos de esta persona de su CV para una base de staff de eventos. ` +
    `Devolvé SOLO un objeto JSON con estas claves (usá null o [] si el dato no está; no inventes nada):\n` +
    `- nombre (solo el nombre de pila)\n- apellido\n- email\n- telefono (solo dígitos, sin prefijo de país)\n` +
    `- ciudad\n- pais\n- linkedin_url\n- portfolio_url\n` +
    `- anios_experiencia (uno de: "0–1","1–3","3–5","5–10","10+")\n` +
    `- experiencia_detalle (2 o 3 líneas resumiendo su experiencia laboral / en eventos)\n` +
    `- oficios (array; incluí SOLO valores EXACTOS de esta lista que apliquen a la persona: ${lista})`;

  let r: Response;
  try {
    r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            { parts: [{ inline_data: { mime_type: mime || "application/pdf", data } }, { text: prompt }] },
          ],
          generationConfig: { response_mime_type: "application/json", temperature: 0 },
        }),
      },
    );
  } catch {
    return NextResponse.json({ error: "fetch_failed" }, { status: 502 });
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
