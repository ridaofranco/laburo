import "server-only";
import { createClient } from "@/lib/supabase/server";

/**
 * LA ORGANIZACIÓN DEL QUE ESTÁ MIRANDO.
 *
 * ── EL PROBLEMA QUE RESUELVE ────────────────────────────────────────────────
 * Hasta la migración 0035, la app leía la membresía así, repetido en 8 archivos:
 *
 *     supabase.from("staff_app_my_membership").select("role").maybeSingle()
 *
 * Con UNA sola organización eso anda. Pero `maybeSingle()` **tira error si la
 * consulta devuelve más de una fila** (PGRST116), y el día que Franco entre a
 * acompañar a una productora aliada va a ser miembro de DOS organizaciones: el
 * panel entero (layout, config, favoritos, ofertas, notas, ratings, pagos, y el
 * gate de "¿ve el contacto?") dejaría de cargar de golpe. No con un mensaje
 * lindo: con un error.
 *
 * Acá la lectura pasa a ser explícita: pedí las organizaciones del usuario,
 * ordenadas, y quedate con la primera. Devuelve además el id de la org, que es
 * lo que las server actions le pasan a las RPCs que corren con service_role (las
 * que no tienen forma de deducirla solas).
 *
 * ── POR QUÉ HAY FALLBACK ────────────────────────────────────────────────────
 * La base y el deploy se aplican por separado. Si este código llega a producción
 * ANTES de la migración 0035, la vista `staff_app_my_orgs` todavía no existe y
 * la consulta falla. En ese caso se cae a la vista vieja `staff_app_my_membership`,
 * que sigue existiendo y funcionando. Así el orden de aplicación no importa y
 * nada se cae en el medio. El fallback se puede borrar una vez aplicada la 0035
 * (está anotado en PLAN-DESHARCODEAR-ORG.md).
 */

export interface OrgActual {
  /** UUID de la organización. Puede ser null si se resolvió por la vista vieja. */
  organizationId: string | null;
  /** Rol del usuario en esa organización, tal cual está en la base. */
  rol: string | null;
  /** Nombre de la productora, para mostrar. */
  nombre: string | null;
  /** Slug público, para URLs por productora. */
  slug: string | null;
}

interface FilaMyOrgs {
  organization_id: string | null;
  role: string | null;
  org_name: string | null;
  org_slug: string | null;
}

/**
 * La organización con la que está trabajando el usuario logueado.
 * Devuelve null si no es miembro de ninguna (o si no hay sesión).
 *
 * FAIL-CLOSED: ante cualquier error devuelve null, y todos los gates que la usan
 * tratan null como "no sos miembro".
 */
export async function orgActual(): Promise<OrgActual | null> {
  try {
    const supabase = await createClient();

    // Camino nuevo (migración 0035): todas mis organizaciones, la más antigua
    // primero. limit(1) es lo que evita el PGRST116 de maybeSingle().
    const { data, error } = await supabase
      .from("staff_app_my_orgs")
      .select("organization_id, role, org_name, org_slug")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (!error) {
      const fila = data as FilaMyOrgs | null;
      if (!fila) return null;
      return {
        organizationId: fila.organization_id ?? null,
        rol: (fila.role ?? "").toLowerCase() || null,
        nombre: fila.org_name ?? null,
        slug: fila.org_slug ?? null,
      };
    }

    // Fallback: la 0035 todavía no está aplicada.
    const { data: vieja } = await supabase
      .from("staff_app_my_membership")
      .select("organization_id, role")
      .limit(1)
      .maybeSingle();
    const fila = vieja as { organization_id?: string; role?: string } | null;
    if (!fila) return null;
    return {
      organizationId: fila.organization_id ?? null,
      rol: (fila.role ?? "").toLowerCase() || null,
      nombre: null,
      slug: null,
    };
  } catch {
    return null;
  }
}

/**
 * Gate de membresía para server actions. Devuelve la org o tira "forbidden",
 * que es exactamente lo que hacían los ocho `if (!membership) throw` que
 * reemplaza.
 */
export async function exigirOrg(): Promise<OrgActual> {
  const org = await orgActual();
  if (!org) throw new Error("forbidden");
  return org;
}
