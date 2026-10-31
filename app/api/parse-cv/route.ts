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
import { verificarCvSubido } from "@/lib/cv-servidor";
import { MODELOS_CV, pedirleAGemini } from "@/lib/gemini";

export const runtime = "nodejs";
// Tres modelos de 10 s en el peor caso, más leer el CV de Supabase.
export const maxDuration = 45;
// ⚠️ 7/9: LA LLAMADA SE MUDÓ A lib/gemini.ts, CON CAÍDA AL MODELO LIVIANO.
// Probando el lector de briefs apareció que `gemini-flash-latest` topea en 20
// requests POR MINUTO en el tier gratuito, y ese límite es del PROYECTO: lo
// comparten LABURO y somosder.ar. O sea que una tanda de pruebas en un producto
// dejaba SIN AUTOLLENADO al formulario donde se anota la gente, y del lado de
// la persona eso se ve igual que "no se pudo leer el CV".
// Medido el mismo día con un PDF de prueba: flash-latest en 429, y
// flash-lite-latest leyó el mismo archivo perfecto. Ahora se cae al liviano en
// vez de fallar.
//
// ⚠️ Y quedó comprobado por qué no se hardcodea una versión: `gemini-2.0-flash`
// ahora devuelve 404 "no longer available". Los alias -latest se mueven solos.

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
// 29/10: 12 s al principal y, si no contestó, 12 s al liviano (antes 20 s y a
// mano). Peor caso 24 s, pero casi siempre hay datos en vez de un formulario vacío.
// 31/10: con el liviano primero (MODELOS_CV), 10 s a cada uno de los tres.
// Un CV normal vuelve en 1 a 3 s; peor caso 30 s si los tres están caídos.
const GEMINI_TIMEOUT_MS = 10_000;
const GEMINI_RESPALDO_MS = 10_000;

export async function POST(request: Request) {
  // FRENO DE ABUSO: esta ruta es pública (el formulario /sumate la usa sin cuenta)
  // y cada llamada gasta cuota de Gemini. Sin freno, un script con un PDF en un
  // loop deja el autollenado muerto para todos los que se anotan de verdad.
  //
  // ⚠️ 6/8: ESTE FRENO ERA EL SOSPECHOSO NÚMERO UNO Y NO DEJABA RASTRO.
  // Medido en producción: el séptimo intento en un minuto devuelve 429, y del
  // lado de la pantalla eso se veía igual que "no pudimos leer el CV". Peor era
  // el tope por hora: pasadas 30 llamadas, la persona quedaba afuera 60 minutos
  // con CUALQUIER archivo, que es exactamente la sensación de "se rompió todo".
  //
  // Se sube a 12 por minuto y 60 por hora. Sigue frenando a un script (que
  // pegaría miles), pero ya no castiga a alguien que se equivocó de archivo unas
  // cuantas veces. Y ahora queda logueado, que era lo que faltaba para poder
  // diagnosticarlo sin adivinar.
  const ip = clientIpFrom(request);
  const frenado =
    rateLimitOr429(`parse-cv:${ip}`, 12, 60_000) ??
    rateLimitOr429(`parse-cv:hora:${ip}`, 60, 3_600_000);
  if (frenado) {
    console.warn(`[parse-cv] 429 freno de abuso · ip=${ip}`);
    return frenado;
  }

  const KEY = process.env.GEMINI_API_KEY;
  if (!KEY) return NextResponse.json({ error: "no_key" }, { status: 500 });

  // Cap de tamaño por content-length (barato, antes de leer el body).
  const clen = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(clen) && clen > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "too_large" }, { status: 413 });
  }

  let body: { mime?: string; data?: string; oficios?: string[]; path?: string; firma?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  const { oficios } = body || {};
  let { mime, data } = body || {};

  /**
   * CAMINO NUEVO: el CV ya está en Supabase y acá llega solo su nombre.
   *
   * Es lo que saca el límite de tamaño de raíz. Antes el archivo entero venía en
   * base64 adentro de este request, y base64 infla 33%, así que un PDF de 3,4 MB
   * generaba un body de 4,5 MB y Vercel lo cortaba con FUNCTION_PAYLOAD_TOO_LARGE
   * antes de que este código llegara a correr. Ahora el body pesa ~200 bytes y
   * los bytes los busca el servidor, que no tiene ese tope.
   *
   * El path tiene que venir FIRMADO: esta ruta es pública y sin la firma
   * cualquiera podría pedir que le lean el CV de otra persona.
   */
  if (typeof body?.path === "string" && body.path) {
    const v = await verificarCvSubido(body.path, body.firma);
    if (!v.ok) {
      console.warn(`[parse-cv] 400 cv_no_valido · ${v.reason}`);
      return NextResponse.json({ error: "cv_no_valido" }, { status: 400 });
    }
    mime = v.mime;
    data = Buffer.from(v.bytes).toString("base64");
  }

  if (typeof data !== "string" || data.length === 0) {
    return NextResponse.json({ error: "no_file" }, { status: 400 });
  }
  if (data.length > MAX_DATA_CHARS) {
    console.warn(`[parse-cv] 413 too_large · chars=${data.length}`);
    return NextResponse.json({ error: "too_large" }, { status: 413 });
  }
  // MIME allowlist fail-closed: sin MIME válido no llamamos a Gemini.
  const mimeType = typeof mime === "string" ? mime.toLowerCase() : "";
  if (!ALLOWED_MIME.has(mimeType)) {
    // El MIME que llega ahora lo sniffea el cliente por magic bytes, así que un
    // bad_mime acá ya no es "el navegador dijo cualquier cosa": o es un formato
    // que de verdad no leemos (Word), o alguien pegándole a la ruta a mano.
    console.warn(`[parse-cv] 415 bad_mime · recibido="${mimeType}"`);
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

  // Timeout duro + caída al modelo liviano (lib/gemini.ts). El motivo real de
  // un fallo va a los logs y no a la respuesta, porque esta ruta es pública.
  const g = await pedirleAGemini(
    [{ inline_data: { mime_type: mimeType, data } }, { text: prompt }],
    {
      timeoutMs: GEMINI_TIMEOUT_MS,
      timeoutRespaldoMs: GEMINI_RESPALDO_MS,
      etiqueta: "parse-cv",
      modelos: MODELOS_CV,
    },
  );

  if (!g.ok) {
    const status = g.error === "timeout" ? 504 : 502;
    return NextResponse.json({ error: g.error, status: g.status }, { status });
  }
  const text = g.texto || "{}";
  let parsed: Record<string, unknown>;
  try {
    const crudo: unknown = JSON.parse(text);
    // 31/10: el modelo liviano a veces devuelve el objeto adentro de una lista
    // (`[{"nombre":…}]`, visto probando). La pantalla leía `d.nombre` de la
    // lista, no encontraba nada y le decía a la persona que no pudo leer el CV.
    const objeto = Array.isArray(crudo) ? crudo[0] : crudo;
    parsed = objeto && typeof objeto === "object" ? (objeto as Record<string, unknown>) : {};
  } catch {
    parsed = {};
  }
  // Lo que la pantalla muestra como «no pudimos sacar datos» no dejaba rastro
  // (así pasó inadvertido el [{…}] del 30/10). Ahora queda en los logs, con el
  // modelo y el comienzo de la respuesta, sin datos de la persona.
  const util = ["nombre", "apellido", "email", "telefono", "ciudad", "experiencia_detalle"].some(
    (k) => typeof parsed[k] === "string" && (parsed[k] as string).trim(),
  );
  if (!util) {
    console.warn(
      `[parse-cv] respuesta sin datos · modelo=${g.modelo} · forma=${text.trim().slice(0, 1)} · largo=${text.length}`,
    );
  }
  return NextResponse.json({ ok: true, data: parsed });
}
