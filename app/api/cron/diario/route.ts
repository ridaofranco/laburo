/**
 * /api/cron/diario — el ÚNICO cron agendado de LABURO.
 *
 * POR QUÉ EXISTE: `vercel.json` agendaba una sola ruta (`reminders`) mientras que
 * en `app/api/cron/` hay cuatro. Las otras tres (`bienvenida`, `quien-ficho`,
 * `recordatorio-perfil`) no las llamaba nadie: el código estaba en producción y
 * los mails no salían nunca. La salida obvia (agendar las cuatro) no entra: el
 * plan Hobby de Vercel topea en 2 cron jobs, y cada tanda futura volvería a
 * chocar contra el mismo techo. Este orquestador lo resuelve una sola vez.
 *
 * CÓMO: importa los `GET` de las cuatro rutas y los llama en secuencia con el
 * MISMO request. Se verificó que ninguna de las cuatro lee `searchParams` — todas
 * leen solo el header de authorization — así que el request original les sirve
 * tal cual. Cero lógica duplicada: si cambia una tanda, cambia en un solo lugar,
 * y las cuatro rutas siguen siendo llamables a mano para probar de a una.
 *
 * TOLERANCIA A FALLAS: cada tanda va en su propio try/catch. Que una explote no
 * puede impedir que salgan las demás; el resumen dice qué pasó con cada una.
 *
 * PRESUPUESTO DE TIEMPO: antes de arrancar cada tanda se mira el reloj, y si no
 * queda margen contra maxDuration esa tanda NO se arranca. Es seguro porque las
 * cuatro RPC estampan su ancla de exactly-once AL SELECCIONAR: la tanda que no
 * corre hoy no pierde nada, corre en la próxima vuelta. Lo inseguro sería lo
 * contrario, que la función muera a mitad de un envío.
 *
 * SEGURIDAD: misma auth fail-closed que las cuatro rutas que orquesta. Sin
 * CRON_SECRET seteado, o con un header que no coincida EXACTO, devuelve 401 y no
 * ejecuta nada.
 */

import { GET as reminders } from "../reminders/route";
import { GET as bienvenida } from "../bienvenida/route";
import { GET as quienFicho } from "../quien-ficho/route";
import { GET as recordatorioPerfil } from "../recordatorio-perfil/route";

// Nunca cachear: cada disparo del cron debe ejecutar de verdad.
export const dynamic = "force-dynamic";

// Techo del plan Hobby. El presupuesto de abajo se calcula contra esto.
export const maxDuration = 60;

/**
 * Margen que se reserva para armar y devolver la respuesta. Si al momento de
 * arrancar una tanda quedan menos de estos segundos, se saltea.
 */
const RESERVA_MS = 8_000;

/** Cuánto se le concede como mínimo a una tanda para que valga la pena arrancarla. */
const MINIMO_POR_TANDA_MS = 5_000;

type Tanda = {
  nombre: string;
  handler: (request: Request) => Promise<Response>;
};

/**
 * Orden deliberado: las dos de mayor valor comercial primero, por si el
 * presupuesto de tiempo corta la cola. `bienvenida` va antes que su recordatorio
 * por lectura, aunque no haya dependencia dura dentro de una misma corrida (el
 * recordatorio persigue bienvenidas de hace 5 días o más, nunca la recién enviada).
 */
const TANDAS: Tanda[] = [
  { nombre: "reminders", handler: reminders },
  { nombre: "bienvenida", handler: bienvenida },
  { nombre: "quien-ficho", handler: quienFicho },
  { nombre: "recordatorio-perfil", handler: recordatorioPerfil },
];

/** Lo que se reporta de cada tanda. */
interface ResultadoTanda {
  tanda: string;
  estado: "ok" | "error" | "salteada";
  status?: number;
  detalle?: unknown;
  ms?: number;
  motivo?: string;
}

export async function GET(request: Request) {
  // 1. Auth fail-closed: sin CRON_SECRET o header que no coincida EXACTO → 401.
  // Acepta CRON_SECRET (el que inyecta Vercel en su propio cron) o
  // CF_CRON_SECRET (el del despachador de Cloudflare, que pasó a ser el
  // disparador real el 31/7/2026, porque el plan Hobby de Vercel solo permite
  // UNA corrida por día). Se SUMA una clave, no se reemplaza: la vieja quedó
  // marcada Sensitive y es ilegible hasta con token, y la regla de Franco es
  // que ninguna clave se rota ni se borra.
  // Sigue siendo fail-closed: sin ninguna de las dos cargadas, 401.
  const aceptados = [process.env.CRON_SECRET, process.env.CF_CRON_SECRET].filter(Boolean);
  const auth = request.headers.get("authorization");
  if (!aceptados.length || !aceptados.some((s) => auth === `Bearer ${s}`)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const arranque = Date.now();
  const limiteMs = maxDuration * 1000 - RESERVA_MS;
  const resultados: ResultadoTanda[] = [];

  for (const { nombre, handler } of TANDAS) {
    const transcurrido = Date.now() - arranque;
    const restante = limiteMs - transcurrido;

    // 2. Presupuesto: si no queda margen, esta tanda queda para mañana. No se
    //    pierde nada (el ancla de exactly-once se estampa al seleccionar).
    if (restante < MINIMO_POR_TANDA_MS) {
      resultados.push({
        tanda: nombre,
        estado: "salteada",
        motivo: `sin margen de tiempo (quedaban ${restante}ms); corre en la próxima vuelta`,
      });
      continue;
    }

    // 3. Cada tanda aislada: que una falle no frena a las demás.
    const desde = Date.now();
    try {
      const res = await handler(request);
      let detalle: unknown;
      try {
        detalle = await res.clone().json();
      } catch {
        detalle = await res.clone().text();
      }
      resultados.push({
        tanda: nombre,
        estado: res.ok ? "ok" : "error",
        status: res.status,
        detalle,
        ms: Date.now() - desde,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`[cron/diario] la tanda "${nombre}" tiró:`, msg);
      resultados.push({
        tanda: nombre,
        estado: "error",
        motivo: msg,
        ms: Date.now() - desde,
      });
    }
  }

  const conError = resultados.filter((r) => r.estado === "error").length;
  const salteadas = resultados.filter((r) => r.estado === "salteada").length;

  return Response.json({
    ok: conError === 0,
    corridas: resultados.length - salteadas,
    con_error: conError,
    salteadas,
    ms_total: Date.now() - arranque,
    resultados,
  });
}
