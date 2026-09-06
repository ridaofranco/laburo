/**
 * POST /api/pedido-desde-brief — lee el brief y arma el borrador del pedido.
 *
 * Franco lo pidió así: *"la licitación se arma de alguna forma, y tengo que
 * contar"*. Contar es el trabajo. Esto lo saca del medio: pegás el mail del
 * cliente (o subís el PDF del brief) y sale el pedido armado, para revisar.
 *
 * ── LO QUE DE VERDAD HACE ESTA RUTA, Y NO ES COMPLETAR EL TÍTULO ────────────
 * El título lo escribís en veinte segundos. El problema real es otro: de las 45
 * respuestas al pedido del pallet, **43 eran repreguntas**. Cada una era un dato
 * que faltaba en el pedido. Así que lo que importa acá es lo que devuelve
 * además de los campos:
 *
 *  · `campos`     — las preguntas del desglose PARA ESE CASO, no las genéricas
 *                   del rubro. "¿Hay que subir por escalera?" solo aparece si el
 *                   brief habla de un tercer piso.
 *  · `faltantes`  — los datos que el brief NO dice y que van a generar
 *                   repreguntas. Esto no llena ningún campo: es una advertencia
 *                   para que la persona lo agregue ANTES de mandar 40 mails.
 *
 * ── LA REGLA QUE NO SE NEGOCIA: NO INVENTAR ────────────────────────────────
 * Lo que no está en el texto queda vacío. Nunca una fecha, un metraje o una
 * cantidad "razonable". Un pedido de precio con un dato inventado se cotiza
 * sobre algo que no existe, y ese error recién se descubre cuando llega la
 * factura. Por eso `temperature: 0` y por eso el prompt lo repite tres veces.
 *
 * ── Y ES UN BORRADOR, SIEMPRE ───────────────────────────────────────────────
 * Esta ruta no crea nada: devuelve JSON que la pantalla usa para rellenar el
 * formulario, que la persona revisa y recién ahí crea el pedido. La IA no manda
 * un mail ni le pide precio a nadie.
 *
 * ── SEGURIDAD ──────────────────────────────────────────────────────────────
 * ⚠️ A DIFERENCIA DE /api/parse-cv, esta ruta NO es pública: exige sesión. El
 * lector de CV tiene que ser público porque lo usa alguien que todavía no tiene
 * cuenta; acá el que arma un pedido siempre está adentro del portal. Sin sesión
 * es 401 antes de gastar un solo token de cuota.
 *
 * Igual lleva freno de abuso por usuario, cap de tamaño, allowlist de MIME y
 * timeout: la cuota de Gemini es del tier gratuito y la comparte con el lector
 * de CV de somosder.ar. Quemarla acá deja sin autollenado a los que se anotan.
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rateLimitOr429 } from "@/lib/rate-limit";
import { PLANTILLA_GENERICA, plantillaDe } from "@/lib/cotizaciones";
import { CATEGORIAS_PROVEEDOR } from "@/lib/categorias-proveedor";
import { PROVINCIAS } from "@/lib/provincias";

export const runtime = "nodejs";

// El mismo alias estable que usa el lector de CV: gratis y sin deprecarse.
const MODEL = "gemini-flash-latest";
const GEMINI_TIMEOUT_MS = 25_000;

// Un brief no es un CV escaneado: 8MB de PDF es muchísimo para un pliego.
const MAX_BODY_BYTES = 12 * 1024 * 1024;
const MAX_DATA_CHARS = 11 * 1024 * 1024;
// Texto pegado: 40.000 caracteres son ~20 páginas. Más que eso no es un brief.
const MAX_TEXTO = 40_000;

const ALLOWED_MIME = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
]);

export async function POST(request: Request) {
  // 1. Sesión primero: sin ella no se gasta cuota.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "sin_sesion" }, { status: 401 });

  // 2. Freno de abuso POR USUARIO (no por IP): acá sabemos quién es, así que el
  //    freno es más justo que el de la ruta pública.
  const frenado =
    rateLimitOr429(`brief:${user.id}`, 10, 60_000) ??
    rateLimitOr429(`brief:hora:${user.id}`, 40, 3_600_000);
  if (frenado) {
    console.warn(`[pedido-desde-brief] 429 freno de abuso · user=${user.id}`);
    return frenado;
  }

  const KEY = process.env.GEMINI_API_KEY;
  if (!KEY) return NextResponse.json({ error: "no_key" }, { status: 500 });

  const clen = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(clen) && clen > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "too_large" }, { status: 413 });
  }

  let body: { texto?: string; mime?: string; data?: string; categoria?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const texto = typeof body.texto === "string" ? body.texto.trim().slice(0, MAX_TEXTO) : "";
  const mimeType = typeof body.mime === "string" ? body.mime.toLowerCase() : "";
  const data = typeof body.data === "string" ? body.data : "";

  const hayArchivo = data.length > 0;
  if (!texto && !hayArchivo) {
    return NextResponse.json({ error: "sin_contenido" }, { status: 400 });
  }
  if (hayArchivo) {
    if (data.length > MAX_DATA_CHARS) {
      return NextResponse.json({ error: "too_large" }, { status: 413 });
    }
    if (!ALLOWED_MIME.has(mimeType)) {
      console.warn(`[pedido-desde-brief] 415 bad_mime · recibido="${mimeType}"`);
      return NextResponse.json({ error: "bad_mime" }, { status: 415 });
    }
  }

  // El desglose del rubro va como EJEMPLO, no como plantilla a copiar: sirve
  // para que entienda el nivel de detalle que esperamos, no para que devuelva
  // las mismas preguntas genéricas de siempre.
  const ejemplo = (plantillaDe(body.categoria) ?? PLANTILLA_GENERICA)
    .map((c) => `  · ${c.etiqueta}`)
    .join("\n");

  const prompt = [
    `Sos el que arma pedidos de presupuesto para una productora de eventos en Argentina.`,
    `Te paso el pedido de un cliente, como llegó (un mail, un mensaje, un brief).`,
    `Tu trabajo es convertirlo en un pedido de precio que varias empresas puedan responder CON UN NÚMERO, sin tener que repreguntar.`,
    ``,
    `Devolvé SOLO un objeto JSON con estas claves:`,
    `- titulo: una línea concreta de qué se necesita. Sin "solicitud de cotización" ni preámbulos.`,
    `- descripcion: 3 a 6 líneas con TODO lo que el texto dice y que sirva para poner un precio. Nada de relleno.`,
    `- categoria: EXACTAMENTE uno de esta lista, o null si ninguno encaja: ${CATEGORIAS_PROVEEDOR.join(", ")}`,
    `- provincia: DÓNDE SE HACE EL TRABAJO, exactamente una de esta lista, o null: ${PROVINCIAS.join(", ")}`,
    `  Si hay varios lugares (un origen y varios destinos, varias sedes), poné el de ORIGEN y contá los demás en la descripción.`,
    `- ciudad: la ciudad o localidad del punto de arriba, o null.`,
    `- necesario_para: la fecha del trabajo en formato YYYY-MM-DD, o null.`,
    `  Hoy es ${new Date().toISOString().slice(0, 10)}. Si el texto dice un día y un mes SIN año, usá la próxima vez que caiga esa fecha, y avisalo en "faltantes".`,
    `- campos: array de objetos {clave, etiqueta} con las preguntas que hay que hacerle a cada empresa ADEMÁS del precio.`,
    `- faltantes: array de strings. Cada uno es un dato que NO está en el texto y que va a hacer que las empresas repregunten en vez de cotizar.`,
    ``,
    `SOBRE "campos", que es lo más importante:`,
    `Escribí entre 3 y 7 preguntas ESPECÍFICAS DE ESTE CASO. Si el texto habla de un tercer piso sin ascensor, preguntá cómo suben. Si menciona siete destinos, preguntá cuánto cuesta sumar uno más.`,
    `NO repitas preguntas genéricas si el texto ya las contesta.`,
    `Si el trabajo se puede AGRANDAR o PARTIR (un destino más, una hora más, diez personas más), preguntá SIEMPRE cuánto cuesta ese incremento. En el caso del pallet, partir la carga en dos destrabó a una empresa que ya había dicho que no: sin ese número, esa salida no existe.`,
    `Cada pregunta tiene que poder contestarse en una línea. La "clave" en minúsculas, sin espacios ni acentos.`,
    `Este es el nivel de detalle esperado para el rubro (son un EJEMPLO, no los copies tal cual):`,
    ejemplo,
    ``,
    `SOBRE "faltantes":`,
    `Pensá qué te preguntaría una empresa antes de poder cotizar esto, y listá los datos que el texto no tiene. Frases cortas, en voseo, del estilo "No aclara si hay que subir por escalera".`,
    `Si el texto está completo, devolvé un array vacío.`,
    ``,
    `REGLAS QUE NO SE NEGOCIAN:`,
    `1. NO INVENTES NADA. Si un dato no está en el texto, va null o no va. Nunca supongas una fecha, una cantidad, un metraje ni una dirección.`,
    `2. NO pases un requisito excluyente a "categoria" ni a "titulo": si el cliente exige algo (por ejemplo portón hidráulico), va como PREGUNTA en campos, nunca como condición para cotizar.`,
    `3. Escribí en castellano rioplatense, de vos. Sin guiones largos.`,
    ``,
    texto ? `EL PEDIDO DEL CLIENTE:\n${texto}` : `El pedido del cliente está en el archivo adjunto.`,
  ].join("\n");

  const parts: unknown[] = [];
  if (hayArchivo) parts.push({ inline_data: { mime_type: mimeType, data } });
  parts.push({ text: prompt });

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
          contents: [{ parts }],
          // temperature 0: acá no queremos creatividad, queremos que no invente.
          generationConfig: { response_mime_type: "application/json", temperature: 0 },
        }),
        signal: controller.signal,
      },
    );
  } catch (e) {
    const aborted = e instanceof Error && e.name === "AbortError";
    console.error(
      `[pedido-desde-brief] ${aborted ? "504 timeout" : "502 fetch_failed"} · ${e instanceof Error ? e.message : String(e)}`,
    );
    return NextResponse.json(
      { error: aborted ? "timeout" : "fetch_failed" },
      { status: aborted ? 504 : 502 },
    );
  } finally {
    clearTimeout(timer);
  }

  if (!r.ok) {
    // El motivo real va a los logs, no a la respuesta: el detalle de Google
    // puede traer el nombre del proyecto o de la key.
    let detalle = "";
    try {
      detalle = (await r.text()).slice(0, 500);
    } catch {
      detalle = "(sin cuerpo)";
    }
    console.error(`[pedido-desde-brief] Gemini ${r.status}:`, detalle);
    return NextResponse.json({ error: "gemini", status: r.status }, { status: 502 });
  }

  const g = await r.json();
  const raw = g?.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(raw);
  } catch {
    console.error("[pedido-desde-brief] Gemini devolvió algo que no es JSON");
    return NextResponse.json({ error: "respuesta_ilegible" }, { status: 502 });
  }

  // ── SANEADO. Lo que vuelve de un modelo es entrada no confiable ───────────
  // Se recorta, se valida contra las listas cerradas y se descarta lo que no
  // encaje, en vez de confiar en que respetó el prompt. Un rubro inventado
  // rompería el <select> del formulario sin decir por qué.
  const str = (v: unknown, max = 2000): string | null => {
    const s = typeof v === "string" ? v.trim() : "";
    return s ? s.slice(0, max) : null;
  };
  const deLista = (v: unknown, lista: string[]): string | null => {
    const s = str(v, 120);
    return s && lista.includes(s) ? s : null;
  };
  const fecha = (v: unknown): string | null => {
    const s = str(v, 10);
    return s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
  };

  const camposCrudos = Array.isArray(parsed.campos) ? parsed.campos : [];
  const campos = camposCrudos
    .slice(0, 12)
    .map((c, i) => {
      const o = (c ?? {}) as Record<string, unknown>;
      const etiqueta = str(o.etiqueta, 200);
      if (!etiqueta) return null;
      const claveCruda = str(o.clave, 40) ?? `campo_${i + 1}`;
      const clave =
        claveCruda
          .toLowerCase()
          .normalize("NFD")
          .replace(/[̀-ͯ]/g, "")
          .replace(/[^a-z0-9_]/g, "_")
          .replace(/^_+|_+$/g, "") || `campo_${i + 1}`;
      return { clave, etiqueta };
    })
    .filter((c): c is { clave: string; etiqueta: string } => c !== null);

  const faltantes = (Array.isArray(parsed.faltantes) ? parsed.faltantes : [])
    .slice(0, 8)
    .map((f) => str(f, 200))
    .filter((f): f is string => f !== null);

  return NextResponse.json({
    ok: true,
    data: {
      titulo: str(parsed.titulo, 160),
      descripcion: str(parsed.descripcion, 2000),
      categoria: deLista(parsed.categoria, CATEGORIAS_PROVEEDOR),
      provincia: deLista(parsed.provincia, PROVINCIAS),
      ciudad: str(parsed.ciudad, 120),
      necesario_para: fecha(parsed.necesario_para),
      campos,
      faltantes,
    },
  });
}
