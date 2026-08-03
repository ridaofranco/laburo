"use server";

/**
 * ENTRAR CON MAIL Y CONTRASEÑA. Compartido por las DOS puertas: la del staff
 * (`/acceso-staff`) y la del productor (`/login`).
 *
 * ── POR QUÉ VIVE ACÁ Y NO ADENTRO DE UNA DE LAS DOS ──────────────────────────
 * Nació en `app/acceso-staff/actions.ts` y no tiene una sola línea específica del
 * staff. Mientras estuvo ahí, el login del productor no tenía forma de entrar con
 * contraseña, así que el mail de bienvenida prometía *"después entrás siempre con
 * este mismo mail y esa clave"* y esa clave no se podía usar en ningún lado.
 *
 * Es la misma lección que dejó escrita `lib/auth-link.ts` el 1/8, y es la tercera
 * vez que aparece: **lo que sirve para las dos puertas se comparte, no se copia**.
 * Franco, textual: *"lo que hacés para empleados no lo hacés para productores"*.
 */

import { createClient } from "@/lib/supabase/server";
import { clientIp, rateLimit } from "@/lib/rate-limit";

/**
 * A diferencia del magic link, ACÁ SÍ se devuelve el error: la persona está
 * escribiendo su propia contraseña y necesita saber si se equivocó. No hay
 * oráculo que proteger, porque para llegar hasta acá ya sabe que la cuenta
 * existe (fue ella quien la creó).
 *
 * El mensaje no distingue entre "no existe" y "contraseña equivocada" igual, que
 * es lo estándar: si no, sirve para averiguar qué mails están registrados.
 */
export async function signInWithPassword(
  email: string,
  password: string,
): Promise<{ ok: boolean; error?: string }> {
  const clean = (email || "").trim().toLowerCase();
  if (!clean || !password) return { ok: false, error: "Completá tu email y tu contraseña." };

  const ip = await clientIp();
  // Más ajustado que el del mail: acá se prueban contraseñas, así que el freno
  // es lo único que separa una cuenta de un ataque de fuerza bruta.
  if (!rateLimit(`signin:ip:${ip}`, 10, 60_000).ok) {
    return { ok: false, error: "Demasiados intentos. Esperá un minuto y probá de nuevo." };
  }
  if (!rateLimit(`signin:mail:${clean}`, 8, 600_000).ok) {
    return { ok: false, error: "Demasiados intentos con este email. Esperá unos minutos." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email: clean, password });
  if (error) {
    return { ok: false, error: "El email o la contraseña no coinciden." };
  }
  return { ok: true };
}
