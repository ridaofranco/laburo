"use server";

/**
 * Lead de productor desde la landing publica ("/").
 *
 * EL PROBLEMA QUE RESUELVE: la landing anterior mandaba al productor nuevo a
 * "Buscar staff" -> /login, y el login esta gateado por membresia (D-06). O sea:
 * un productor interesado no podia ni dejar sus datos. Este action es la puerta
 * de entrada comercial: sin cuenta, sin login, un formulario corto.
 *
 * ── ORDEN: GUARDAR PRIMERO, MAIL DESPUES (fix 30/7/2026) ──
 * Hasta hoy este action SOLO mandaba un mail a MAIL_ADMIN_TO. Si Resend y el
 * SMTP fallaban los dos, el lead se perdia entero y Franco no se enteraba nunca.
 * Un productor interesado es exactamente el cliente que no se puede perder, asi
 * que ahora:
 *
 *   1. Se PERSISTE en staff_app.producer_leads (migracion 0039) con el admin
 *      client. Esa tabla es la memoria; Franco la mira en /leads.
 *   2. Recien despues se manda el mail, que pasa a ser el AVISO ("mira que entro
 *      uno"), no el almacenamiento.
 *
 * Y las dos mitades son independientes a proposito:
 *   * Si el mail falla pero el lead se guardo -> el visitante ve EXITO igual. El
 *     dato esta; el problema es nuestro y no se lo cobramos a el.
 *   * Si el guardado falla (tipico: la 0039 todavia no esta aplicada en
 *     Supabase) -> se intenta el mail igual como red de seguridad y se loguea el
 *     error. O sea: hasta que Franco corra la migracion, esto se comporta
 *     exactamente como antes, sin romperse.
 *   * Si fallan LAS DOS -> ahi si se le avisa al visitante que reintente, y sale
 *     una alerta (lib/alerta.ts) para que la perdida no sea silenciosa.
 */

import { rateLimit, clientIp } from "@/lib/rate-limit";
import { sendMail, adminEmail, emailEnabled } from "@/lib/email/mailer";
import { alerta } from "@/lib/alerta";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export interface LeadResult {
  ok: boolean;
  reason?: string;
}

/** Escape minimo para meter input del visitante en el HTML del mail. */
const esc = (v: string): string =>
  v
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface LeadDatos {
  nombre: string;
  email: string;
  telefono: string;
  empresa: string;
  mensaje: string;
}

/**
 * Guarda el lead en staff_app.producer_leads (RPC service_role de la 0039).
 *
 * NUNCA tira: devuelve `false` y loguea. El caso mas probable mientras la 0039
 * no este aplicada es que la funcion no exista (PGRST202 / "Could not find the
 * function"), y eso NO puede voltear el formulario: el mail sigue siendo la red
 * de seguridad hasta que Franco corra la migracion.
 */
async function guardarLead(d: LeadDatos): Promise<boolean> {
  try {
    const admin = createServiceRoleClient();
    const { data, error } = await admin.rpc("staff_app_registrar_lead_productor", {
      p_nombre: d.nombre,
      p_email: d.email,
      p_mensaje: d.mensaje,
      p_telefono: d.telefono || null,
      p_empresa: d.empresa || null,
      p_origen: "landing",
    });
    if (error) {
      const faltaMigracion = /staff_app_registrar_lead_productor/i.test(error.message);
      console.error(
        faltaMigracion
          ? "[lead-productor] no se guardo: falta aplicar la migracion 0039 en Supabase. " +
              "El lead va solo por mail hasta entonces."
          : "[lead-productor] no se guardo el lead:",
        error.message,
      );
      return false;
    }
    const res = (data ?? null) as { ok?: boolean; reason?: string } | null;
    if (!res?.ok) {
      console.error("[lead-productor] la RPC rechazo el lead:", res?.reason ?? "sin motivo");
      return false;
    }
    return true;
  } catch (e) {
    // Sin SUPABASE_SERVICE_ROLE_KEY en el env, createServiceRoleClient tira.
    console.error("[lead-productor] no se pudo guardar el lead:", (e as Error).message);
    return false;
  }
}

export async function enviarLeadProductor(formData: FormData): Promise<LeadResult> {
  // Honeypot: campo invisible que un humano nunca completa. Si viene con algo,
  // respondemos "ok" sin mandar nada, para no darle al bot una senal de error.
  if (String(formData.get("sitio") || "").trim() !== "") return { ok: true };

  const nombre = String(formData.get("nombre") || "").trim().slice(0, 120);
  const email = String(formData.get("email") || "").trim().slice(0, 200);
  const telefono = String(formData.get("telefono") || "").trim().slice(0, 60);
  const empresa = String(formData.get("empresa") || "").trim().slice(0, 160);
  const mensaje = String(formData.get("mensaje") || "").trim().slice(0, 2000);

  if (!nombre || !email || !mensaje) {
    return { ok: false, reason: "Completá tu nombre, tu email y qué necesitás." };
  }
  if (!EMAIL_RE.test(email)) {
    return { ok: false, reason: "Ese email no parece válido. Revisalo." };
  }

  // Freno de abuso: esto manda mails con cuota compartida del dia (ver
  // lib/rate-limit.ts). 3 consultas por IP cada 10 minutos es de sobra para un
  // humano y corta un script.
  const ip = await clientIp();
  const rl = rateLimit(`lead-productor:${ip}`, 3, 10 * 60_000);
  if (!rl.ok) {
    return {
      ok: false,
      reason: "Demasiadas consultas seguidas. Probá de nuevo en unos minutos.",
    };
  }

  // ── (1) GUARDAR. Va PRIMERO: es lo único que no se puede perder. ──
  const guardado = await guardarLead({ nombre, email, telefono, empresa, mensaje });

  // ── (2) EL MAIL. Aviso, no almacenamiento. ──
  const to = adminEmail();
  if (!to || !emailEnabled()) {
    console.error("[lead-productor] sin via de mail configurada (MAIL_ADMIN_TO / Resend / SMTP)");
    await alerta({
      titulo: guardado
        ? "Entró una consulta de productor y no hay mail configurado (el lead está guardado)"
        : "Un productor dejó una consulta y no hay mail configurado",
      detalle: `nombre=${nombre} email=${email} tel=${telefono} empresa=${empresa} :: ${mensaje.slice(0, 400)}`,
      clave: "lead-productor-sin-mail",
    });
    // Si el lead quedó guardado, para el visitante esto salió bien: el dato está
    // en /leads. Que no haya mail configurado es un problema nuestro.
    if (guardado) return { ok: true };
    return {
      ok: false,
      reason: "No pudimos enviar tu consulta. Probá de nuevo en unos minutos.",
    };
  }

  const fila = (label: string, valor: string) =>
    valor
      ? `<tr><td style="padding:6px 16px 6px 0;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#8a8a8a;vertical-align:top;white-space:nowrap">${label}</td>` +
        `<td style="padding:6px 0;font-size:14px;line-height:1.6;color:#e9e6e4">${esc(valor)}</td></tr>`
      : "";

  const html =
    `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;background:#0d0d0d;color:#e9e6e4;padding:24px">` +
    `<p style="margin:0 0 6px;font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:#0047ff">LABURO · landing</p>` +
    `<h1 style="margin:0 0 16px;font-size:20px;line-height:1.3">Nuevo productor interesado: ${esc(nombre)}</h1>` +
    `<table style="border-collapse:collapse">` +
    fila("Nombre", nombre) +
    fila("Email", email) +
    fila("Teléfono", telefono) +
    fila("Empresa", empresa) +
    `</table>` +
    `<p style="margin:16px 0 4px;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#8a8a8a">Qué necesita</p>` +
    `<p style="margin:0;font-size:14px;line-height:1.7;color:#e9e6e4;white-space:pre-wrap">${esc(mensaje)}</p>` +
    `<p style="margin:20px 0 0;font-size:12px;color:#8a8a8a">Respondele directo a ${esc(email)}.</p>` +
    (guardado
      ? `<p style="margin:8px 0 0;font-size:12px;color:#8a8a8a">También quedó guardado en el portal, en Leads.</p>`
      : `<p style="margin:8px 0 0;font-size:12px;color:#ffb4ab">⚠️ Este lead NO se pudo guardar en la base (¿falta aplicar la migración 0039?). Este mail es la única copia: guardalo.</p>`) +
    `</div>`;

  const r = await sendMail({
    to,
    subject: `LABURO: consulta de productor · ${nombre}`,
    html,
  });

  if (!r.ok) {
    console.error("[lead-productor] fallo el envio:", r.error);
    // Que Franco se entere: un lead comercial perdido es exactamente el tipo de
    // falla silenciosa que lib/alerta.ts existe para evitar.
    await alerta({
      titulo: guardado
        ? "No salió el mail de una consulta de productor (el lead está guardado en /leads)"
        : "Se perdió una consulta de productor de la landing",
      detalle: r.error,
      datos: { nombre, email, telefono, empresa, guardado: guardado ? "sí" : "NO" },
      clave: "lead-productor-envio",
    });
    // El lead está en la base: para el visitante esto salió bien. No se le
    // castiga con un "reintentá" (y un reintento duplicaría la fila) por una
    // falla de nuestro proveedor de mail.
    if (guardado) return { ok: true };
    return {
      ok: false,
      reason: "No pudimos enviar tu consulta. Probá de nuevo en unos minutos.",
    };
  }

  return { ok: true };
}
