import "server-only";
import nodemailer from "nodemailer";

// ─────────────────────────────────────────────────────────────────────────
// Mailer central de LABURO (portado de HITO — lib/email/mailer.ts).
//
// D-02: envío por el SMTP Ferozo propio de SOMOS DER. CERO ESP pago, así que
// la rama Resend de HITO queda DESACTIVADA (no se instala, no se cablea): esto
// es SMTP-only. Si en el futuro se quisiera Resend, se re-porta esa rama.
//
// Contrato honesto (D-02): sendMail() SIEMPRE devuelve un MailResult y NUNCA
// tira. Un fallo del SMTP de Ferozo (lento/caído) surface como { ok:false } —
// nunca un 250-OK silencioso. Con el SMTP sin configurar, smtpEnabled() es
// false y sendMail() devuelve { ok:false, channel:"none" } en vez de fingir
// éxito. El caller (03-03) DEBE chequear result.ok y ofrecer el wa.me de
// fallback cuando el mail falla.
// ─────────────────────────────────────────────────────────────────────────

export type MailChannel = "smtp" | "none";

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

function fromHeader(): string {
  return `"${process.env.MAIL_FROM_NAME || "SOMOS DER"}" <${fromAddress()}>`;
}

/** Dirección de respuesta. Si MAIL_REPLY_TO no está seteada, no se agrega. */
function replyToAddress(): string | undefined {
  return process.env.MAIL_REPLY_TO || undefined;
}

/** ¿Está el SMTP configurado? (para degradar con honestidad si falta). */
export function smtpEnabled(): boolean {
  return !!(
    process.env.SMTP_HOST &&
    process.env.SMTP_USER &&
    process.env.SMTP_PASSWORD
  );
}

/** ¿Hay alguna vía de envío configurada? (hoy sólo SMTP). */
export function emailEnabled(): boolean {
  return smtpEnabled();
}

export function adminEmail(): string {
  return process.env.MAIL_ADMIN_TO || process.env.MAIL_FROM_ADDRESS || "";
}

const errMsg = (e: unknown): string =>
  e instanceof Error ? e.message : String(e);

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

// ─── Envío honesto (nunca tira) ────────────────────────────────────────────

export async function sendMail(opts: MailOptions): Promise<MailResult> {
  if (smtpEnabled()) {
    try {
      await sendViaSmtp(opts);
      return { ok: true, channel: "smtp" };
    } catch (e) {
      const smtpError = errMsg(e);
      console.error("[mailer] smtp failed:", smtpError);
      return { ok: false, channel: "smtp", error: smtpError };
    }
  }

  return {
    ok: false,
    channel: "none",
    error: "No hay ninguna vía de envío de email configurada.",
  };
}
