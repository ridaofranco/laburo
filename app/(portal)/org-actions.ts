"use server";

/**
 * ELEGIR EN NOMBRE DE QUÉ ORGANIZACIÓN SE ACTÚA.
 *
 * Setea la cookie `laburo_org_id` que después lee `orgActual()`. Es el otro
 * extremo del selector de contexto: la mitad de TypeScript de un arreglo cuya
 * otra mitad vive adentro de Postgres (las ocho RPC que reciben `p_org`). Sin
 * esa mitad, esto sería decorativo — la pantalla diría una organización y la
 * base escribiría en otra.
 *
 * ── DOS DECISIONES QUE PARECEN DETALLE Y NO LO SON ──────────────────────────
 *
 * 1. **`revalidatePath("/", "layout")`, no una ruta suelta.** Cambiar de
 *    organización cambia TODO: el nombre de la barra, qué ítems tiene el menú,
 *    qué eventos se ven, si /leads existe. Revalidando una sola ruta, el usuario
 *    cambia de contexto y el resto del portal le sigue mostrando la anterior,
 *    que es peor que no haber cambiado nada.
 *
 * 2. **Nunca tira una excepción.** Devuelve `{ ok: false }` y listo. Cambiar de
 *    contexto no puede dejar a nadie sin portal: si esto reventara, el usuario
 *    se quedaría mirando una pantalla de error sin forma de volver.
 */

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { orgsDelUsuario } from "@/lib/org";
import { LABURO_ORG_COOKIE, LABURO_ORG_COOKIE_OPTS, esUuid } from "@/lib/org-cookie";

export async function elegirOrg(
  orgId: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    if (!esUuid(orgId)) return { ok: false, error: "No se pudo cambiar de productora." };

    // La prueba de membresía es aparecer en la lista: `staff_app_my_orgs` es
    // security_invoker, así que la RLS ya filtró a las del que consulta.
    const mias = await orgsDelUsuario();
    if (!mias.some((o) => o.organizationId === orgId)) {
      // Motivo genérico a propósito: quien pruebe con un UUID ajeno no aprende
      // desde acá si esa organización existe.
      return { ok: false, error: "No se pudo cambiar de productora." };
    }

    (await cookies()).set(LABURO_ORG_COOKIE, orgId, LABURO_ORG_COOKIE_OPTS);
    revalidatePath("/", "layout");
    return { ok: true };
  } catch {
    return { ok: false, error: "No se pudo cambiar de productora." };
  }
}
