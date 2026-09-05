/**
 * /api/cron/diario — el ÚNICO cron agendado de LABURO.
 *
 * POR QUÉ EXISTE: `vercel.json` agendaba una sola ruta (`reminders`) mientras que
 * en `app/api/cron/` hay varias. Las otras tres (`bienvenida`, `quien-ficho`,
 * `recordatorio-perfil`) no las llamaba nadie: el código estaba en producción y
 * los mails no salían nunca. La salida obvia (agendar las cuatro) no entra: el
 * plan Hobby de Vercel topea en 2 cron jobs, y cada tanda futura volvería a
 * chocar contra el mismo techo. Este orquestador lo resuelve una sola vez.
 *
 * CÓMO: importa los `GET` de las rutas hijas y los llama en secuencia con el
 * MISMO request. Se verificó que ninguna lee `searchParams` — todas
 * leen solo el header de authorization — así que el request original les sirve
 * tal cual. Cero lógica duplicada: si cambia una tanda, cambia en un solo lugar,
 * y las cuatro rutas siguen siendo llamables a mano para probar de a una.
 *
 * 🚨 UNA RUTA NUEVA EN `app/api/cron/` QUE NO ESTÉ EN `TANDAS` NO LA LLAMA
 * NADIE. Es exactamente el bug que dio origen a este archivo, y volvió a pasar
 * el 5/9 con la tanda de visibilidad: quedó escrita, probada y desplegada, con
 * su variable de encendido documentada, y no se habría disparado jamás. El
 * despachador de Cloudflare pega en ESTA ruta y en ninguna otra. Agregar una
 * tanda es agregarla al array de abajo, en el mismo commit.
 *
 * TOLERANCIA A FALLAS: cada tanda va en su propio try/catch. Que una explote no
 * puede impedir que salgan las demás; el resumen dice qué pasó con cada una.
 *
 * ⚠️ EL STATUS HTTP DICE SI ALGO SE ROMPIÓ, NO SI TODO CORRIÓ (2/9). Hasta hoy
 * esta ruta devolvía SIEMPRE 200 y el `ok:false` viajaba en el cuerpo, que el
 * despachador de Cloudflare no lee: las cuatro tandas corren exclusivamente acá
 * adentro, así que una RPC rota quedaba invisible para siempre. Hay TRES
 * desenlaces distintos y por eso hay tres tratos distintos:
 *
 *  1. ROTO (la tanda tiró, o devolvió un 5xx que no es 503) → estado "error" y
 *     el orquestador contesta 500. Es una falla real y un reintento es deseable.
 *  2. SIN CONFIGURAR (503) → estado "sin_configurar", y NO sube el status. Hoy
 *     `quien-ficho` cae acá todos los días porque falta MAIL_ADMIN_TO. Eso no es
 *     una rotura: es una pieza que falta, es permanente, y reintentar no arregla
 *     nada. Si contara como error, esta ruta tiraría 500 TODOS LOS DÍAS PARA
 *     SIEMPRE y en dos semanas la alarma se ignora. La alarma que suena siempre
 *     no es una alarma.
 *  3. SALTEADA por presupuesto de tiempo → tampoco sube el status: es por diseño
 *     y se autorepara en la vuelta siguiente.
 *
 * POR QUÉ DEVOLVER 500 ES SEGURO (o sea, por qué un reintento no manda ningún
 * mail dos veces): se verificó RPC por RPC, no se asumió. Las cinco batch que
 * usan las cuatro tandas (welcome_batch, perfil_reminder_batch,
 * fichaje_resumen_batch, crew_due_reminder y offers_due_reminder, todas en la
 * 0038) estampan su ancla de exactly-once en la MISMA sentencia que seleccionan:
 * WITH ... UPDATE ... RETURNING, con FOR UPDATE SKIP LOCKED donde hace falta. La
 * segunda corrida selecciona vacío.
 *
 * ⚠️ Que nadie "simplifique" esto a "cualquier cosa que no sea ok es 500": el
 * punto entero de esta sección es la diferencia entre roto y sin configurar.
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

import { alerta } from "@/lib/alerta";
import { GET as reminders } from "../reminders/route";
import { GET as bienvenida } from "../bienvenida/route";
import { GET as quienFicho } from "../quien-ficho/route";
import { GET as recordatorioPerfil } from "../recordatorio-perfil/route";
import { GET as visibilidad } from "../visibilidad/route";
import { GET as recordatorioCotizacion } from "../recordatorio-cotizacion/route";

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
  // El recordatorio de los pedidos de precio que cierran en 48hs. Va ANTES que
  // visibilidad porque tiene fecha: si el presupuesto de tiempo se acaba, el que
  // no sale hoy pierde su ventana (el pedido cierra igual), y la pregunta de
  // visibilidad no vence nunca.
  { nombre: "recordatorio-cotizacion", handler: recordatorioCotizacion },
  // ⚠️ VA ÚLTIMA, Y NO ES CAPRICHO. Es la única tanda que le escribe al pool
  // entero por un tema que no es trabajo, así que si el presupuesto de tiempo
  // alcanza para una sola, tiene que ganar la que manda una propuesta o un
  // recordatorio de un evento real. Y si se saltea no se pierde nada: su ancla
  // de exactly-once (visibilidad_preguntada_at) se estampa AL SELECCIONAR,
  // igual que las otras cinco.
  //
  // ⚠️ MIENTRAS `BIENVENIDA_BATCH` ESTÉ PRENDIDA, ESTA VA APAGADA. Las dos
  // salen en la misma corrida: con las dos encendidas, a las 686 fichas que
  // todavía no saben que LABURO existe les llegan dos mails el mismo día y
  // parecen dos remitentes distintos. Primero la bienvenida, y cuando se
  // termine, esta.
  { nombre: "visibilidad", handler: visibilidad },
];

/** Lo que se reporta de cada tanda. */
interface ResultadoTanda {
  tanda: string;
  /**
   * ⚠️ "error" y "sin_configurar" NO son lo mismo, y esa diferencia es la que
   * decide el status HTTP de toda la corrida. "error" es algo ROTO (la tanda
   * tiró, o contestó un 5xx que no es 503): se puede arreglar y un reintento
   * sirve. "sin_configurar" es una VARIABLE DE ENTORNO QUE FALTA (503): no está
   * roto nada, es permanente hasta que alguien la cargue, y reintentar no
   * cambia nada. Ver la sección del header.
   */
  estado: "ok" | "error" | "sin_configurar" | "salteada";
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
        // El 503 de una hija significa "me falta una variable para poder
        // trabajar", no "me rompí". El `detalle` queda como está: el cuerpo de la
        // hija ya trae el `hint` con qué variable falta, que es justo lo que hay
        // que leer.
        estado: res.ok ? "ok" : res.status === 503 ? "sin_configurar" : "error",
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
  const sinConfigurar = resultados.filter((r) => r.estado === "sin_configurar").length;
  const salteadas = resultados.filter((r) => r.estado === "salteada").length;

  // 4. Aviso cuando hay algo ROTO de verdad (sin_configurar y salteada no
  //    avisan: no hay nada que arreglar corriendo).
  //    ⚠️ HOY ESTO ES UN NO-OP: TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID y
  //    MAIL_ADMIN_TO están las tres sin cargar, así que alerta() devuelve false
  //    sin hacer nada. El valor real de este arreglo es el status 500 de abajo,
  //    que el despachador de Cloudflare SÍ ve. Que quede escrito para que el
  //    próximo no crea que el aviso está funcionando.
  if (conError > 0) {
    const rotas = resultados
      .filter((r) => r.estado === "error")
      .map((r) => `${r.tanda}: ${r.motivo ?? `status ${r.status ?? "?"}`}`)
      .join("\n");
    await alerta({
      titulo: "El cron diario tuvo tandas rotas",
      detalle: rotas,
      datos: { rotas: conError, corridas: resultados.length - salteadas },
      // Clave propia: si no, el anti repetición se lo come con cualquier otro
      // aviso que comparta título.
      clave: "cron-diario-tandas-rotas",
    });
  }

  return Response.json(
    {
      ok: conError === 0,
      corridas: resultados.length - salteadas,
      con_error: conError,
      sin_configurar: sinConfigurar,
      salteadas,
      ms_total: Date.now() - arranque,
      resultados,
    },
    // Acá está el arreglo: hasta hoy esto era siempre 200 y el despachador no
    // se enteraba nunca de una tanda rota.
    { status: conError > 0 ? 500 : 200 },
  );
}
