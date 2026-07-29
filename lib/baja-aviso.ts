import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * AVISO INTERNO AL ADMIN CUANDO ALGUIEN SE DA DE BAJA DEL POOL.
 *
 * ── EL PROBLEMA ──
 * La baja quedaba registrada en la base (baja_at / baja_motivo, migración 0026)
 * y el único aviso era el genérico de lib/alerta: framing de "algo se rompió"
 * (la baja no es una rotura, es feedback), sin el nombre de la persona, y con el
 * anti-repetición de 10 minutos que se TRAGA las bajas consecutivas: si tres
 * personas se bajan después de una tanda, llegaba un solo aviso sin motivo.
 *
 * ── LO QUE HACE ESTO ──
 * Un mail dedicado a MAIL_ADMIN_TO por CADA baja, con nombre, email y el motivo
 * que dejó la persona (el feedback más barato y honesto que hay sobre por qué
 * alguien no quiere estar). Sin dedupe a propósito: cada baja es un dato.
 * Telegram sigue saliendo por lib/alerta (con sinMail, para no duplicar).
 *
 * ── EL DETALLE NO OBVIO: LEER LA FICHA **ANTES** DE LA BAJA ──
 * public.staff_app_profiles filtra `baja_at IS NULL` (0026): apenas la RPC marca
 * la baja, la ficha DESAPARECE de la vista y ya no se puede leer el nombre. Por
 * eso el caller lee primero (leerFichaParaAviso), da la baja después, y recién
 * ahí manda el aviso con lo que leyó. Si la lectura falla, el aviso sale igual
 * con el id solo: peor es que no llegue.
 *
 * NUNCA TIRA: un fallo del aviso no puede convertir una baja hecha en un error
 * para la persona que se quiso ir.
 */

export interface FichaParaAviso {
  nombre: string | null;
  apellido: string | null;
  email: string | null;
}

/**
 * Lee lo mínimo de la ficha para el aviso. Llamar ANTES de staff_app_set_baja
 * (ver arriba). Devuelve null si no se pudo leer; el aviso sale igual sin nombre.
 */
export async function leerFichaParaAviso(
  admin: SupabaseClient,
  profileId: string,
): Promise<FichaParaAviso | null> {
  try {
    const { data } = await admin
      .from("staff_app_profiles")
      .select("nombre,apellido,email")
      .eq("id", profileId)
      .maybeSingle();
    return (data as FichaParaAviso | null) ?? null;
  } catch {
    return null;
  }
}

const esc = (v: unknown): string =>
  String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

/**
 * Manda el aviso de baja a MAIL_ADMIN_TO. Llamar SOLO cuando la baja quedó hecha
 * (data === true). Nunca tira; devuelve si salió, por si el caller lo loguea.
 */
export async function avisoBajaAdmin(opts: {
  profileId: string;
  ficha: FichaParaAviso | null;
  motivo?: string | null;
  /** De dónde vino: "formulario" (/baja) o "one-click" (botón del cliente de correo). */
  origen: "formulario" | "one-click";
}): Promise<boolean> {
  try {
    const { sendMail, emailEnabled, adminEmail } = await import("@/lib/email/mailer");
    const to = adminEmail();
    if (!to || !emailEnabled()) return false;

    const nombre =
      [opts.ficha?.nombre, opts.ficha?.apellido].filter(Boolean).join(" ").trim() ||
      "(no se pudo leer el nombre)";
    const motivo = opts.motivo?.trim() || "";

    const fila = (label: string, valor: string) =>
      `<p style="margin:0 0 10px 0;font-size:15px;line-height:1.5;color:#F5F5F5">` +
      `<span style="color:#8A8A8A">${esc(label)}: </span>${esc(valor)}</p>`;

    // Mismo esqueleto visual que los mails de la app (fondo negro, panel, sin
    // hacks de modo oscuro), pero armado a mano: es interno, no necesita el
    // componente react-email ni el wordmark.
    const html =
      `<div style="margin:0;padding:0;background-color:#000000;color:#F5F5F5;` +
      `font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif">` +
      `<div style="max-width:480px;margin:0 auto;padding:32px 20px">` +
      `<div style="background-color:#0A0A0A;border:1px solid #1A1A1A;padding:28px 24px">` +
      `<p style="margin:0 0 10px 0;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#8A8A8A">` +
      `LABURO · aviso interno</p>` +
      `<h1 style="margin:0 0 16px 0;font-size:22px;line-height:1.25;font-weight:700;color:#F5F5F5">` +
      `Alguien se dio de baja del pool</h1>` +
      fila("Quién", nombre) +
      (opts.ficha?.email ? fila("Email", opts.ficha.email) : "") +
      (motivo
        ? `<p style="margin:0 0 10px 0;font-size:15px;line-height:1.5;color:#F5F5F5">` +
          `<span style="color:#8A8A8A">Motivo, en sus palabras: </span></p>` +
          `<p style="margin:0 0 10px 0;padding:12px;background:#000;border:1px solid #1A1A1A;` +
          `font-size:14px;line-height:1.6;color:#F5F5F5">${esc(motivo)}</p>`
        : fila("Motivo", "no dejó motivo")) +
      fila("Vía", opts.origen === "one-click" ? "botón de baja del cliente de correo" : "formulario de /baja") +
      fila("Ficha", opts.profileId) +
      `<p style="margin:18px 0 0 0;font-size:13px;line-height:1.6;color:#8A8A8A">` +
      `La ficha no se borró: queda marcada con baja_at y fuera de la búsqueda, las ofertas ` +
      `y todos los envíos. Si se arrepiente, puede volver desde el mismo link de baja. ` +
      `Si se juntan varias bajas en pocos días, mirá qué mail salió último.</p>` +
      `</div></div></div>`;

    const r = await sendMail({
      to,
      subject: `Baja del pool: ${nombre}${motivo ? " (dejó motivo)" : ""}`,
      html,
    });
    if (!r.ok) console.error("[baja-aviso] no salió el aviso al admin:", r.error);
    return !!r.ok;
  } catch (e) {
    console.error(
      "[baja-aviso] falló el aviso al admin:",
      e instanceof Error ? e.message : String(e),
    );
    return false;
  }
}
