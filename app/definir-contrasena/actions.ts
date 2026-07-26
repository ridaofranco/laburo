"use server";

/**
 * Guardar la contraseña nueva.
 *
 * Para llegar acá la persona ya canjeó el link que le llegó por mail (ver
 * ./confirmar/route.ts), así que tiene sesión: `updateUser` aplica sobre SU
 * propia cuenta y no hace falta pasar ningún id. Si alguien entra de garrón sin
 * sesión, Supabase rechaza y devolvemos el error.
 */

import { createClient } from "@/lib/supabase/server";

/**
 * El mínimo son 8 caracteres.
 *
 * Supabase por default pide 6, que para gente que entra dos o tres veces al año
 * es poco. No se piden mayúsculas ni símbolos a propósito: esas reglas hacen que
 * la gente termine escribiendo la contraseña en un papel o usando "Laburo2026!",
 * y no suman seguridad real. Largo mínimo y listo.
 */
const MINIMO = 8;

export async function guardarContrasena(
  password: string,
  repetida: string,
): Promise<{ ok: boolean; error?: string }> {
  const p = String(password ?? "");
  const r = String(repetida ?? "");

  if (p.length < MINIMO) {
    return { ok: false, error: `La contraseña tiene que tener al menos ${MINIMO} caracteres.` };
  }
  if (p !== r) {
    return { ok: false, error: "Las dos contraseñas no coinciden." };
  }

  const supabase = await createClient();

  // Sin sesión no hay nada que actualizar. Pasa cuando el link venció, ya se usó,
  // o alguien entró a la URL de memoria.
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return {
      ok: false,
      error: "El link para definir tu contraseña venció o ya se usó. Pedí uno nuevo desde la pantalla de acceso.",
    };
  }

  const { error } = await supabase.auth.updateUser({ password: p });
  if (error) {
    // El mensaje de Supabase viene en inglés. Se traduce el caso que de verdad
    // pasa (contraseña muy corta o repetida) y el resto cae en algo genérico,
    // porque mostrar el error crudo en inglés es justo lo que Franco no quiere.
    const msg = /weak|short|least/i.test(error.message)
      ? `Esa contraseña es muy corta. Tiene que tener al menos ${MINIMO} caracteres.`
      : "No pudimos guardar la contraseña. Probá de nuevo en un minuto.";
    return { ok: false, error: msg };
  }

  return { ok: true };
}
