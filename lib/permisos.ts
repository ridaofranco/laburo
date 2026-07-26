import "server-only";
import { createClient } from "@/lib/supabase/server";

/**
 * QUIÉN PUEDE VER EL CONTACTO DE ALGUIEN DEL POOL.
 *
 * ── EL PROBLEMA QUE RESUELVE (pedido de Franco) ──
 * El modelo de LABURO es de intermediación: la ficha se ve, el contacto no, y a la
 * persona se llega a través de SOMOS DER. Eso es lo que sostiene la comisión.
 *
 * Pero hasta hoy eso estaba garantizado **por el acceso, no por el producto**: la
 * pantalla del perfil muestra Email, Teléfono y DNI a cualquiera que sea miembro de
 * la organización, y el visor del CV original tiene el contacto adentro del PDF. Con
 * un solo equipo eso no era un problema. El día que Franco le da acceso a un cliente
 * o abre el marketplace a otra productora, **el contacto queda a la vista y la
 * comisión se puede saltear**. Y ese día no se avisa: pasa cuando pasa.
 *
 * ── CÓMO SE RESUELVE, SIN INVENTAR ESTRUCTURA ──
 * La app ya tiene roles por miembro (`staff_app.members.role`, default `writer`).
 * Así que el contacto se muestra SOLO a los roles de la casa, y cualquier rol nuevo
 * (un cliente, otra productora) NO lo ve por default. Es lo importante: **el
 * default es no mostrarlo.** Si mañana se agrega un rol `cliente`, no hay que
 * acordarse de nada.
 *
 * `MOSTRAR_CONTACTO_A` se puede ampliar por env var si hace falta sumar un rol
 * interno sin tocar código.
 */

/** Los roles que SÍ ven el contacto. Todo lo demás, no. */
const ROLES_INTERNOS = new Set(
  (process.env.MOSTRAR_CONTACTO_A || "owner,admin,writer")
    .split(",")
    .map((r) => r.trim().toLowerCase())
    .filter(Boolean),
);

export interface Permisos {
  /** El rol del que está mirando, tal como está en la base. */
  rol: string | null;
  /** true = puede ver mail, teléfono, DNI y el PDF original del CV. */
  verContacto: boolean;
}

/**
 * Lee el rol del usuario logueado y decide.
 *
 * FAIL-CLOSED: si no se puede averiguar el rol, **no se muestra el contacto**. En
 * una duda sobre datos personales de terceros, el default tiene que ser ocultar.
 */
export async function permisos(): Promise<Permisos> {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("staff_app_my_membership")
      .select("role")
      .maybeSingle();
    const rol = ((data as { role?: string } | null)?.role ?? "").toLowerCase() || null;
    return { rol, verContacto: !!rol && ROLES_INTERNOS.has(rol) };
  } catch {
    return { rol: null, verContacto: false };
  }
}
