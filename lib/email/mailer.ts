import "server-only";
import nodemailer from "nodemailer";

// ─────────────────────────────────────────────────────────────────────────
// Mailer central de LABURO (portado de HITO — lib/email/mailer.ts).
//
// Estrategia de envío en cascada (de más a menos confiable):
//   1. RESEND  → API HTTP (~300ms), entregabilidad alta, da error real.
//                Tier free (100/día) = cero costo, respeta la regla no-pagar.
//   2. SMTP    → nodemailer/Ferozo propio de SOMOS DER. Funciona, pero lento
//                (15-25s) y con entregabilidad de hosting compartido.
//   3. nada    → no se envía; el caller cae al fallback de wa.me (link mágico).
//
// Contrato honesto (D-02): sendMail() SIEMPRE devuelve un MailResult y NUNCA
// tira. Un fallo surface como { ok:false } — nunca un 250-OK silencioso. Sin
// ninguna vía configurada, emailEnabled() es false y sendMail() devuelve
// { ok:false, channel:"none" } en vez de fingir éxito. El caller (03-03) DEBE
// chequear result.ok y ofrecer el wa.me de fallback cuando el mail falla.
//
// ACTIVAR RESEND: cargar RESEND_API_KEY (+ opcional RESEND_FROM) en el env de
// Vercel. Sin esas vars, el comportamiento es idéntico al SMTP-only de antes.
// ─────────────────────────────────────────────────────────────────────────

export type MailChannel = "resend" | "smtp" | "none";

export interface MailResult {
  ok: boolean;
  channel: MailChannel;
  error?: string;
}

export interface MailAttachment {
  filename: string;
  content: Buffer;
  contentType?: string;
  cid?: string;
}

export interface MailOptions {
  to: string;
  subject: string;
  html: string;
  attachments?: MailAttachment[];
  /**
   * Headers extra. Se usa para List-Unsubscribe / List-Unsubscribe-Post (RFC
   * 8058) en los envíos a muchas personas: Gmail lee un envío masivo sin vía de
   * baja y castiga la reputación del dominio. Lo soportan los dos canales
   * (Resend por el campo `headers` de su API, nodemailer nativo).
   */
  headers?: Record<string, string>;
}

// ─── Helpers de configuración ────────────────────────────────────────────

/** Ferozo espera el usuario en minúsculas; normalizamos para evitar 535 por casing. */
function smtpUser(): string {
  return (process.env.SMTP_USER || "").trim().toLowerCase();
}

function fromAddress(): string {
  // MAIL_FROM_ADDRESS no está seteada hoy → cae a SMTP_USER (fallback documentado).
  return process.env.MAIL_FROM_ADDRESS || smtpUser();
}

/** Header "Nombre <email>" para el SMTP (Ferozo). */
function fromHeader(): string {
  return `"${process.env.MAIL_FROM_NAME || "SOMOS DER"}" <${fromAddress()}>`;
}

/**
 * Remitente para Resend. Acepta RESEND_FROM en dos formatos:
 *   - completo:  "SOMOS DER <no-reply@tudominio.com>"  → se usa tal cual.
 *   - solo mail: "no-reply@tudominio.com"              → se envuelve con el nombre.
 * Debe ser un dominio verificado en Resend, si no la API rechaza el envío.
 */
function resendFrom(): string {
  const raw = process.env.RESEND_FROM || fromAddress();
  if (raw.includes("<")) return raw; // ya viene "Nombre <mail>"
  return `${process.env.MAIL_FROM_NAME || "SOMOS DER"} <${raw}>`;
}

/** Dirección de respuesta. Si MAIL_REPLY_TO no está seteada, no se agrega. */
function replyToAddress(): string | undefined {
  return process.env.MAIL_REPLY_TO || undefined;
}

/** ¿Está Resend configurado? (API key + algún remitente). */
export function resendEnabled(): boolean {
  return !!(process.env.RESEND_API_KEY && (process.env.RESEND_FROM || fromAddress()));
}

/** ¿Está el SMTP configurado? (para degradar con honestidad si falta). */
export function smtpEnabled(): boolean {
  return !!(
    process.env.SMTP_HOST &&
    process.env.SMTP_USER &&
    process.env.SMTP_PASSWORD
  );
}

/** ¿Hay alguna vía de envío configurada? (Resend o SMTP). */
export function emailEnabled(): boolean {
  return resendEnabled() || smtpEnabled();
}

export function adminEmail(): string {
  return process.env.MAIL_ADMIN_TO || process.env.MAIL_FROM_ADDRESS || "";
}

const errMsg = (e: unknown): string =>
  e instanceof Error ? e.message : String(e);

// ─── Resend (vía API HTTP, sin dependencia extra) ─────────────────────────

async function sendViaResend(opts: MailOptions): Promise<void> {
  const replyTo = replyToAddress();
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: resendFrom(),
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
      ...(replyTo ? { reply_to: replyTo } : {}),
      ...(opts.headers ? { headers: opts.headers } : {}),
      attachments: opts.attachments?.map((a) => ({
        filename: a.filename,
        content: a.content.toString("base64"),
      })),
    }),
    // Resend es rápido; cortamos a los 15s para no colgar la acción.
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Resend ${res.status}: ${body.slice(0, 300)}`);
  }
}

// ─── SMTP (nodemailer / Ferozo) ───────────────────────────────────────────

let cached: nodemailer.Transporter | null = null;
function transporter(): nodemailer.Transporter {
  if (cached) return cached;
  cached = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 465),
    secure: String(process.env.SMTP_SECURE ?? "true") === "true",
    auth: {
      user: smtpUser(),
      pass: process.env.SMTP_PASSWORD,
    },
    // Ferozo es lento — timeouts cortos para fallar rápido en vez de colgar.
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 20000,
  });
  return cached;
}

async function sendViaSmtp(opts: MailOptions): Promise<void> {
  const replyTo = replyToAddress();
  await transporter().sendMail({
    from: fromHeader(),
    ...(replyTo ? { replyTo } : {}),
    ...opts,
  });
}

// ─── Envío en cascada (nunca tira) ─────────────────────────────────────────

export async function sendMail(opts: MailOptions): Promise<MailResult> {
  // Resend no soporta imágenes inline por CID como SMTP. Si el mail trae un
  // attachment con cid (p.ej. un QR inline), va por SMTP sí o sí.
  const hasCidAttachment = !!opts.attachments?.some((a) => a.cid);

  let resendError: string | undefined;
  if (resendEnabled() && !hasCidAttachment) {
    try {
      await sendViaResend(opts);
      return { ok: true, channel: "resend" };
    } catch (e) {
      resendError = errMsg(e);
      console.error("[mailer] resend failed, probando SMTP:", resendError);
    }
  }

  if (smtpEnabled()) {
    try {
      await sendViaSmtp(opts);
      return { ok: true, channel: "smtp" };
    } catch (e) {
      const smtpError = errMsg(e);
      console.error("[mailer] smtp failed:", smtpError);
      // Reportamos los dos errores, empezando por el del canal que devolvemos.
      // Antes devolvíamos `resendError ?? smtpError`, o sea channel:"smtp" con el
      // mensaje de Resend, y se debuggeaba el canal equivocado.
      return {
        ok: false,
        channel: "smtp",
        error: resendError ? `smtp: ${smtpError} | resend: ${resendError}` : smtpError,
      };
    }
  }

  return {
    ok: false,
    channel: "none",
    error: resendError ?? "No hay ninguna vía de envío de email configurada.",
  };
}
