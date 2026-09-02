"use server";

/**
 * ALTA ABIERTA DE PRODUCTORA (Fase 2).
 *
 * Decisión de Franco (2/8): "que quede abierto, ya está, sino no tiene sentido".
 * Se anota, entra y opera. Nadie aprueba la cuenta ni lo que publica. El control
 * es después, desde /plataforma.
 *
 * ── POR QUÉ TODO PASA POR ACÁ Y NO POR EL BROWSER ────────────────────────────
 * `staff_app_crear_productora` está granteada SOLO a service_role. Si fuera
 * llamable desde el cliente, cualquiera crearía organizaciones en un loop. El
 * freno de abuso vive acá, igual que en /sumate.
 *
 * ── CÓMO SE VUELVE MIEMBRO ───────────────────────────────────────────────────
 * No se inventa nada: la RPC crea la organización y le deja una invitación de
 * owner a su mail. Cuando entra por primera vez, `provision_member` (que ya
 * corre en /auth/callback) la lee y lo hace owner. Cero auth nueva.
 *
 * ── QUÉ SE GUARDA Y QUÉ NO (2/9) ─────────────────────────────────────────────
 * El teléfono va a la base (columna `telefono` de la 0069). El tipo de eventos y
 * el volumen anual van SOLO al aviso de Telegram. La razón del corte: el
 * teléfono es el dato de RECUPERACIÓN, y si vive en un mensaje de Telegram no
 * existe cuando hace falta ni lo puede mostrar /plataforma. Los otros dos son
 * cualitativos, sirven para la primera charla, y ninguna pantalla los consume.
 *
 * ── EL MAIL SE DEVUELVE, NO SE TIRA ──────────────────────────────────────────
 * `mailOk` se calculaba y se descartaba: la función devolvía `{ ok: true }`
 * pelado, así que la pantalla afirmaba SIEMPRE "le mandamos un mail", saliera o
 * no. Ahora sale con el resultado, mismo criterio de estado honesto que
 * offer-actions.ts: la cuenta YA existe aunque el mail falle, son dos cosas.
 */

import { createElement } from "react";
import { render } from "@react-email/components";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { sendMail } from "@/lib/email/mailer";
import { BienvenidaProductora } from "@/components/emails/bienvenida-productora";
import { siteUrl } from "@/lib/site";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { linkParaElegirContrasena } from "@/lib/auth-link";
import { alerta } from "@/lib/alerta";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export async function registrarProductora(input: {
  productora: string;
  email: string;
  telefono: string;
  /** Qué eventos arma, texto libre. Opcional: solo va al aviso interno. */
  queEventos?: string;
  /** Cuántos eventos por año, rango. Opcional: solo va al aviso interno. */
  volumen?: string;
}): Promise<{ ok: boolean; error?: string; mailOk?: boolean }> {
  const productora = (input.productora || "").trim();
  const email = (input.email || "").trim().toLowerCase();
  const telefono = (input.telefono || "").trim();
  const queEventos = (input.queEventos || "").trim();
  const volumen = (input.volumen || "").trim();

  if (!productora) return { ok: false, error: "Escribí el nombre de tu productora." };
  if (!EMAIL_RE.test(email)) return { ok: false, error: "Ese email no parece válido." };
  // Criterio liviano, igual que el del mail: acá no se valida un formato de
  // teléfono, se valida que haya algo. Un número mal escrito se corrige por
  // WhatsApp; un campo vacío deja a la productora sin ningún canal de rescate.
  if (!telefono) return { ok: false, error: "Dejanos tu teléfono o WhatsApp." };

  // Freno de abuso: cada alta crea una organización Y manda un mail.
  const ip = await clientIp();
  if (!rateLimit(`prod:ip:${ip}`, 3, 60_000).ok) {
    return { ok: false, error: "Esperá un minuto y volvé a intentar." };
  }
  if (!rateLimit(`prod:ip-hora:${ip}`, 10, 3_600_000).ok) {
    return { ok: false, error: "Demasiados registros desde esta conexión. Probá más tarde." };
  }
  if (!rateLimit(`prod:mail:${email}`, 3, 600_000).ok) {
    return { ok: false, error: "Ya recibimos tu registro. Revisá tu casilla, incluido el spam." };
  }

  const admin = createServiceRoleClient();
  const { data, error } = await admin.rpc("staff_app_crear_productora", {
    p_nombre: productora,
    p_email: email,
    p_telefono: telefono,
  });

  if (error) {
    console.error("[registrar-productora] RPC falló:", error.message);
    return { ok: false, error: "No se pudo crear la cuenta. Probá de nuevo." };
  }

  const r = data as { ok?: boolean; reason?: string; ya_existia?: boolean } | null;
  if (!r?.ok) {
    if (r?.reason === "ya_tiene_cuenta") {
      // No es un error de la persona: ya está adentro. Se la manda a entrar en
      // vez de dejarla trabada creando algo que no necesita.
      return {
        ok: false,
        error: "Ese email ya tiene cuenta en LABURO. Entrá desde laburo.somosder.ar/login.",
      };
    }
    if (r?.reason === "falta_nombre") return { ok: false, error: "Escribí el nombre de tu productora." };
    if (r?.reason === "falta_email") return { ok: false, error: "Ese email no parece válido." };
    return { ok: false, error: "No se pudo crear la cuenta. Probá de nuevo." };
  }

  // El mail sale SIEMPRE, también si ya existía la invitación: el caso normal de
  // volver a registrarse es "no me llegó el mail". Un fallo del envío nunca
  // voltea el alta, que ya está guardada.
  let mailOk = false;
  try {
    const claveLink = await linkParaElegirContrasena(admin, email, "registrar-productora");
    const html = await render(
      createElement(BienvenidaProductora, {
        productora,
        link: claveLink ?? siteUrl("/login"),
        conLinkDeClave: claveLink !== null,
      }),
    );
    const res = await sendMail({
      to: email,
      subject: `${productora} ya tiene su cuenta en LABURO`,
      html,
    });
    mailOk = !!res.ok;
    if (!res.ok) {
      console.error("[registrar-productora] mail no salió:", res.error ?? res.channel);
    }
  } catch (e) {
    console.error(
      "[registrar-productora] render/send falló:",
      e instanceof Error ? e.message : String(e),
    );
  }

  /**
   * ── EL AVISO (6/8) ─────────────────────────────────────────────────────────
   * Franco: *"a lo sumo despues vemos quien se sumo"*. Hasta hoy no había forma
   * de "ver después" en el momento: el alta abierta existía desde el 2/8 y NADIE
   * avisaba. Una productora se registraba, entraba y operaba, y Franco se
   * enteraba solo si entraba a /plataforma a mirar la lista.
   *
   * Es el mismo aviso que ya tiene el alta de proveedor. Nunca voltea el alta:
   * `alerta` se traga sus propios errores.
   */
  await alerta({
    titulo: `Productora nueva en LABURO: ${productora}`,
    // Cada alta es su propio aviso: agrupadas por título, dos altas seguidas se
    // comerían la segunda por el anti-repetición de 10 minutos.
    clave: `productora-alta:${email}`,
    datos: {
      productora,
      email,
      telefono,
      // Los dos cualitativos no se persisten: viven acá y en la primera charla.
      // Si vienen vacíos no se mandan, para no ensuciar el aviso con "sin dato".
      ...(queEventos ? { "qué eventos arma": queEventos } : {}),
      ...(volumen ? { "cuántos por año": volumen } : {}),
      "le llegó el mail": mailOk ? "sí" : "NO, revisar",
      "ya se había registrado": r.ya_existia ? "sí" : "no",
      "ver quién se sumó": siteUrl("/plataforma"),
    },
  });

  // Estado honesto: la cuenta ya está creada. `mailOk` viaja para que la
  // pantalla ofrezca el respaldo en vez de mentir.
  return { ok: true, mailOk };
}
