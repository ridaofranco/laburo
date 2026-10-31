import "server-only";

/**
 * La llamada a Gemini, con la caída al modelo liviano.
 *
 * ── POR QUÉ EXISTE ESTE ARCHIVO (7/9/2026) ──────────────────────────────────
 * Probando el lector de briefs con un caso real apareció que `gemini-flash-latest`
 * devuelve **429 (cuota agotada)** y **503 (alta demanda)** bastante seguido en el
 * tier gratuito. El límite medido contra la API: **20 requests por minuto**, y es
 * del PROYECTO entero, así que LABURO lo comparte con el autollenado de CV de
 * somosder.ar.
 *
 * Eso no es un detalle de una prueba: significa que **cada vez que la cuota se
 * agota, el formulario donde se anota la gente deja de autocompletar el CV**, y
 * del lado de la persona eso se ve igual que "se rompió".
 *
 * La salida no es pagar ni esperar: es **caer a un modelo más liviano**, que
 * tiene su propia cuota. Medido el 7/9 con un PDF de prueba, en la misma
 * corrida:
 *
 *   gemini-flash-latest      → 429 (cuota agotada)
 *   gemini-2.0-flash         → 404 (ya no existe: cuidado con hardcodear versiones)
 *   gemini-flash-lite-latest → 200, leyó el PDF perfecto
 *
 * Para lo que hacemos (leer un documento y devolver JSON) el liviano alcanza de
 * sobra. Se prefiere el grande y se cae al chico, en vez de usar el chico
 * siempre: cuando hay cuota, el grande entiende mejor un brief desprolijo.
 *
 * ⚠️ NUNCA hardcodear una versión: `gemini-2.0-flash` devolvió 404 "no longer
 * available". Los alias `-latest` se mueven solos y por eso no se rompen. Hoy
 * `gemini-flash-latest` resuelve a gemini-3.8-flash.
 */

/** El principal y su respaldo. El orden importa: se prueba de mejor a más liviano. */
// 31/10: se suma `gemini-3.1-flash-lite`, otro liviano con cuota propia (esa
// noche el grande daba 429/503 seguido; ver MODELOS_CV).
export const MODELOS = ["gemini-flash-latest", "gemini-flash-lite-latest", "gemini-3.1-flash-lite"] as const;

/**
 * Orden para el lector de CV (31/10). En Vercel, del 28 al 30/10: 11 lecturas
 * murieron por 429 del principal y 2 por timeout del liviano (9 personas que se
 * anotaban tuvieron que tipear todo). Medido el 30/10 a la noche con un PDF de
 * prueba: `gemini-flash-latest` no contestó en 25 s; `gemini-flash-lite-latest`
 * y `gemini-3.1-flash-lite` leyeron perfecto en 1,2 s. Para un CV el liviano
 * alcanza, así que va PRIMERO (la persona espera 1 s y no 12), después otro
 * liviano con su propia cuota del tier gratuito, y el grande al final.
 * `gemini-2.5-flash-lite` ya da 404 «no longer available»: por eso un 404
 * también pasa al siguiente (ver abajo) y un modelo retirado no corta la cadena.
 */
export const MODELOS_CV = ["gemini-flash-lite-latest", "gemini-3.1-flash-lite", "gemini-flash-latest"] as const;

export interface GeminiParte {
  text?: string;
  inline_data?: { mime_type: string; data: string };
}

export interface GeminiResultado {
  ok: boolean;
  /** El texto crudo que devolvió el modelo (JSON, si se pidió así). */
  texto?: string;
  /** Qué modelo terminó contestando. Va a los logs: sirve para saber si el principal está caído. */
  modelo?: string;
  status?: number;
  error?: "timeout" | "fetch_failed" | "gemini";
}

/**
 * Llama a Gemini y devuelve el texto de la respuesta.
 *
 * Cae al modelo siguiente SOLO ante 429 (cuota) y 503 (saturado): son los dos
 * casos donde el mismo pedido, en otro modelo, sí funciona. Un 400 o un 403 son
 * problemas nuestros (pedido mal armado, key sin permiso) y reintentarlos en
 * otro modelo solo gasta tiempo y esconde el error real.
 */
export async function pedirleAGemini(
  partes: GeminiParte[],
  opciones: {
    timeoutMs?: number;
    etiqueta?: string;
    /**
     * Si viene, un TIMEOUT del modelo principal también cae al siguiente, con
     * este tiempo. Lo usa el lector de CV (29/10): en Vercel, 7 lecturas en una
     * semana murieron a los 20 s esperando al grande, y la persona tenía que
     * tipear todo a mano. El liviano lee un CV en pocos segundos. Sin esta
     * opción, el comportamiento de siempre: el timeout no se reintenta.
     */
    timeoutRespaldoMs?: number;
    /** Qué modelos probar, en orden. Por defecto `MODELOS`. */
    modelos?: readonly string[];
  } = {},
): Promise<GeminiResultado> {
  const KEY = process.env.GEMINI_API_KEY;
  if (!KEY) return { ok: false, error: "gemini", status: 500 };

  const timeoutMs = opciones.timeoutMs ?? 25_000;
  const etiqueta = opciones.etiqueta ?? "gemini";
  let ultimoStatus = 0;
  const modelos = opciones.modelos?.length ? opciones.modelos : MODELOS;

  for (const [i, modelo] of modelos.entries()) {
    const controller = new AbortController();
    const espera = i > 0 && opciones.timeoutRespaldoMs ? opciones.timeoutRespaldoMs : timeoutMs;
    const timer = setTimeout(() => controller.abort(), espera);
    let r: Response;
    try {
      r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: partes }],
            generationConfig: { response_mime_type: "application/json", temperature: 0 },
          }),
          signal: controller.signal,
        },
      );
    } catch (e) {
      const aborted = e instanceof Error && e.name === "AbortError";
      // Un timeout no se reintenta en otro modelo, salvo que quien llama lo
      // pida con `timeoutRespaldoMs` (ver arriba) y quede un modelo por probar.
      if (aborted && opciones.timeoutRespaldoMs && i < modelos.length - 1) {
        console.warn(`[${etiqueta}] ${modelo} tardó más de ${espera} ms, pruebo con ${modelos[i + 1]}`);
        continue;
      }
      console.error(
        `[${etiqueta}] ${modelo} ${aborted ? "timeout" : "fetch_failed"}: ${e instanceof Error ? e.message : String(e)}`,
      );
      return { ok: false, error: aborted ? "timeout" : "fetch_failed" };
    } finally {
      clearTimeout(timer);
    }

    if (r.ok) {
      const g = await r.json();
      const texto = g?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
      // Se loguea qué modelo contestó: si empiezan a aparecer solo respuestas
      // del liviano, es que el principal está sin cuota todo el tiempo y hay
      // que mirarlo, no esperar a que alguien se queje.
      if (modelo !== modelos[0]) console.warn(`[${etiqueta}] respondió el modelo de respaldo (${modelo})`);
      return { ok: true, texto, modelo, status: r.status };
    }

    ultimoStatus = r.status;
    // El motivo real va a los logs, nunca a la respuesta: el detalle de Google
    // puede traer el nombre del proyecto o de la key.
    let detalle = "";
    try {
      detalle = (await r.text()).slice(0, 300);
    } catch {
      detalle = "(sin cuerpo)";
    }
    const quedaOtro = i < modelos.length - 1;
    // Si otro modelo lo va a intentar, es un aviso y no un error: el error es
    // solo cuando la persona se queda sin datos.
    const linea = `[${etiqueta}] ${modelo} devolvió ${r.status}: ${detalle}`;
    if (quedaOtro && (r.status === 429 || r.status === 503 || r.status === 404)) console.warn(linea);
    else console.error(linea);

    // 404 = el alias o la versión ya no existe: el pedido está bien, el modelo
    // no. Se sigue con el próximo en vez de dejar a la persona sin autollenado.
    if (r.status !== 429 && r.status !== 503 && r.status !== 404) break; // no es falta de cuota: no insistir
  }

  return { ok: false, error: "gemini", status: ultimoStatus };
}
