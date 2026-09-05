"use server";

/**
 * Salir de la suplantación. Vive del lado del portal porque el botón está en el
 * banner del layout, o sea en TODAS las pantallas.
 *
 * ⚠️ Salir no puede fallar nunca. Si esta acción tirara una excepción, alguien
 * quedaría operando la organización de otro sin forma de volver. Por eso
 * `terminarSuplantacion()` borra la cookie ANTES de hablar con la base, y este
 * wrapper no propaga nada.
 */

import { revalidatePath } from "next/cache";
import { terminarSuplantacion } from "@/lib/suplantacion";

export async function salirDeSuplantacion(): Promise<{ ok: boolean }> {
  await terminarSuplantacion();
  // Todo el portal tiene que redibujarse: cambia la organización, el menú, y
  // las pantallas de plataforma vuelven a aparecer.
  revalidatePath("/", "layout");
  return { ok: true };
}
