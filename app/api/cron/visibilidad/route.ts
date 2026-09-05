/**
 * Cron de LA PREGUNTA DE VISIBILIDAD: "¿querés que otras productoras te vean?".
 *
 * Le manda a las fichas del pool de la plataforma (1.048 con mail válido al
 * momento de escribir esto) el mail que les pregunta si aceptan aparecer en el
 * catálogo compartido. Es la pieza que faltaba: la 0076 dejó la columna, la RPC
 * que escribe y la pantalla /mi-visibilidad, pero nadie preguntaba nada, así que
 * el consentimiento existía en la base y no existía en la realidad.
 *
 * ⚠️ ESTE MAIL NO ABRE EL POOL. Guarda la respuesta. Abrir el catálogo es otra
 * decisión y otra migración, y se toma MIRANDO cuánta gente dijo que sí, que es
 * exactamente lo que devuelve `pending` acá abajo.
 *
 * APAGADO POR DEFECTO, y es lo más importante del archivo: sin VISIBILIDAD_BATCH
 * cargada, o con valor 0, responde 200 y NO manda NADA. El scheduler puede
 * quedar dado de alta sin que salga un solo mail. Franco lo prende cargando
 * VISIBILIDAD_BATCH=50 en Vercel y lo apaga borrándola o poniéndola en 0.
 *
 * EN TANDAS, no los 1.048 de una. Mismos dos límites que la bienvenida: el SMTP
 * de hosting compartido no es para masivos, y una avalancha de mails idénticos
 * el mismo día es la definición de lo que los filtros marcan como spam. Acá hay
 * una razón más: si el mail cae en spam, la persona no contesta, y no contestar
 * cuenta como NO. Quemar la reputación del dominio con esta tanda no es perder
 * entregas, es perder consentimientos.
 *
 * ⚠️ ORDEN CON LA TANDA DE BIENVENIDA: son independientes a propósito, pero no
 * conviene correrlas el mismo día. Las 686 fichas que nunca recibieron la
 * bienvenida no saben que LABURO existe; este mail se explica solo, pero si le
 * llegan los dos juntos parecen dos remitentes distintos hablando de lo mismo.
 * Si hay que elegir cuál va primero, va la bienvenida.
 *
 * SEGURIDAD (mismo patrón que /api/cron/bienvenida, que ya corre en prod):
 *   * Fail-closed: sin CRON_SECRET/CF_CRON_SECRET seteado, o si el bearer no
 *     coincide EXACTO, 401 sin tocar nada.
 *   * Service-role: el cron corre sin sesión. Las dos RPC están granteadas solo
 *     a service_role.
 *   * Exactly-once: vive en la RPC (visibilidad_preguntada_at IS NULL + UPDATE
 *     en la misma sentencia). Verificado contra producción con ROLLBACK: dos
 *     tandas seguidas de 3 devuelven 6 fichas distintas, 0 repetidas.
 *
 * TRADE-OFF asumido (igual que en bienvenida): la RPC estampa
 * visibilidad_preguntada_at ANTES de saber si el SMTP entregó. Preferimos perder
 * alguna pregunta antes que mandarle dos veces la misma a la misma persona. Los
 * que fallan quedan en los logs (failed) y se les puede preguntar a mano.
 */

import { createElement } from "react";
import { render } from "@react-email/components";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { sendMail, emailEnabled } from "@/lib/email/mailer";
import { VisibilidadEmail } from "@/components/emails/visibilidad-email";
import { bajaHeaders, bajaReady, bajaUrl } from "@/lib/baja";
import { visibilidadReady, visibilidadUrl } from "@/lib/visibilidad";
import { alerta } from "@/lib/alerta";

// Nunca cachear: cada disparo del cron debe ejecutar de verdad.
export const dynamic = "force-dynamic";

/** Cuántas preguntas por corrida. 0 o ausente = tanda apagada. Techo 200 (la RPC también lo limita). */
function batchSize(): number {
  const raw = Number(process.env.VISIBILIDAD_BATCH);
  if (!Number.isFinite(raw) || raw <= 0) return 0;
  return Math.min(Math.floor(raw), 200);
}

/** Forma de cada fila que devuelve public.staff_app_visibilidad_batch. */
interface VisibilidadRow {
  profile_id: string;
  email: string | null;
  first_name: string | null;
}

export async function GET(request: Request) {
  // 1. Auth fail-closed. Se aceptan las dos claves por la misma razón que en
  //    bienvenida: CRON_SECRET es la de Vercel y CF_CRON_SECRET la del
  //    despachador de Cloudflare, que es el disparador real. Se SUMA una clave,
  //    nunca se rota ni se borra la vieja.
  const aceptados = [process.env.CRON_SECRET, process.env.CF_CRON_SECRET].filter(Boolean);
  const auth = request.headers.get("authorization");
  if (!aceptados.length || !aceptados.some((s) => auth === `Bearer ${s}`)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const limit = batchSize();
  const supabase = createServiceRoleClient();

  // 2. Tanda apagada: reportamos el tablero y nos vamos sin mandar nada ni marcar
  //    ninguna ficha. Es el estado por defecto.
  if (limit === 0) {
    const { data: pending } = await supabase.rpc("staff_app_visibilidad_pending");
    return Response.json({
      ok: true,
      tanda: "apagada",
      hint: "Cargá VISIBILIDAD_BATCH=50 en Vercel para arrancar.",
      pending: pending ?? null,
      email: emailEnabled(),
      sent: 0,
    });
  }

  // 3. Sin secreto para firmar links NO pedimos la tanda. Sin firma no hay link,
  //    y sin link el mail es una pregunta sin dónde contestar: quemaría las
  //    fichas (quedan marcadas como preguntadas) sin haber preguntado nada.
  if (!visibilidadReady()) {
    const { data: pending } = await supabase.rpc("staff_app_visibilidad_pending");
    return Response.json(
      {
        ok: false,
        error: "sin_secreto",
        hint: "Falta BAJA_SECRET (o SUPABASE_SERVICE_ROLE_KEY) para firmar los links. No se pidió la tanda.",
        pending: pending ?? null,
        sent: 0,
      },
      { status: 503 },
    );
  }

  // 4. Sin ninguna vía de envío configurada, tampoco: la RPC estampa al
  //    seleccionar, así que pedirla sin poder mandar quemaría las fichas.
  if (!emailEnabled()) {
    const { data: pending } = await supabase.rpc("staff_app_visibilidad_pending");
    return Response.json(
      {
        ok: false,
        error: "sin_email",
        hint: "Falta RESEND_API_KEY o el SMTP en el env. No se pidió la tanda para no marcar fichas sin poder enviarles.",
        pending: pending ?? null,
        sent: 0,
      },
      { status: 503 },
    );
  }

  // 5. La tanda: la RPC devuelve las fichas y las marca en la misma sentencia.
  const { data, error } = await supabase.rpc("staff_app_visibilidad_batch", {
    p_limit: limit,
  });

  if (error) {
    // 500 y no 200: con 200 el scheduler marca la ejecución como exitosa y una
    // RPC rota queda invisible en el dashboard durante meses.
    console.error("[cron/visibilidad] rpc failed:", error.message);
    await alerta({
      titulo: "La tanda de la pregunta de visibilidad se rompió",
      detalle: error.message,
    });
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }

  const rows = (data as VisibilidadRow[] | null) ?? [];

  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const row of rows) {
    const to = row.email?.trim();
    if (!to) {
      skipped += 1;
      continue;
    }
    try {
      const html = await render(
        createElement(VisibilidadEmail, {
          firstName: (row.first_name ?? "").split(/\s+/)[0] ?? "",
          link: visibilidadUrl(row.profile_id),
          bajaLink: bajaReady() ? bajaUrl(row.profile_id) : undefined,
        }),
      );
      const result = await sendMail({
        to,
        subject: "¿Querés que otras productoras vean tu ficha?",
        html,
        // List-Unsubscribe + one-click: Gmail muestra su propio botón de baja y
        // deja de leer la tanda como masivo sin salida.
        headers: bajaHeaders(row.profile_id),
      });
      if (result.ok) sent += 1;
      else failed += 1;
    } catch (e) {
      // Defensa en profundidad: el mailer no tira, pero envolvemos el render.
      console.error(
        "[cron/visibilidad] send failed for",
        row.profile_id,
        e instanceof Error ? e.message : String(e),
      );
      failed += 1;
    }
  }

  const { data: pending } = await supabase.rpc("staff_app_visibilidad_pending");

  return Response.json({
    ok: true,
    tanda: limit,
    preguntadas: rows.length,
    sent,
    failed,
    skipped,
    pending: pending ?? null,
  });
}
