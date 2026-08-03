"use server";

import { createElement } from "react";
import { render } from "@react-email/components";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { linkMagicoParaEntrar } from "@/lib/auth-link";
import { sendMail } from "@/lib/email/mailer";
import { LinkDeAccesoEmail } from "@/components/emails/link-de-acceso-email";

/**
 * MANDAR EL LINK PARA ENTRAR.
 *
 * Reemplaza al `supabase.auth.signInWithOtp()` que corría en el navegador. Ese
 * usaba PKCE y por eso el link "vencía" apenas lo abrías desde el mail del
 * teléfono: el detalle completo, con los logs de producción que lo prueban,
 * está en lib/auth-link.ts.
 *
 * ── LA RESPUESTA ES SIEMPRE LA MISMA ─────────────────────────────────────────
 * Exista o no la cuenta, exista o no el mail, esto devuelve `{ ok: true }`.
 * Decisión de Franco (28/7): contestar distinto sería un oráculo que revela qué
 * mails tienen cuenta. El gate real es `generateLink`, que falla solo si la
 * cuenta no existe (equivale al viejo `shouldCreateUser:false`), y ahí no se
 * manda nada. La pantalla ya ofrece el camino del que todavía no tiene cuenta.
 *
 * Nunca tira: un fallo de mail o de red no puede romper la puerta de entrada.
 */
export async function enviarLinkDeAcceso(
  email: string,
): Promise<{ ok: true }> {
  const limpio = email.trim().toLowerCase();
  // Chequeo mínimo, solo para no llamar a Supabase al pedo. La validación de
  // forma la hace el input type="email" del formulario.
  if (!limpio || !limpio.includes("@")) return { ok: true };

  try {
    const admin = createServiceRoleClient();
    const link = await linkMagicoParaEntrar(admin, limpio, "login");
    // Sin link es que la cuenta no existe. Silencio, mismo resultado visible.
    if (!link) return { ok: true };

    const html = await render(createElement(LinkDeAccesoEmail, { link }));
    const res = await sendMail({
      to: limpio,
      subject: "Tu link para entrar a LABURO",
      html,
    });
    if (!res.ok) {
      console.error("[login] mail no salió:", res.error ?? res.channel);
    }
  } catch (e) {
    console.error(
      "[login] enviarLinkDeAcceso falló:",
      e instanceof Error ? e.message : String(e),
    );
  }

  return { ok: true };
}
