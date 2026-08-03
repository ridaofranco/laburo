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
 *
 * ── LO MISMO VALE PARA LA 0044 (es_plataforma) ──────────────────────────────
 * Si el deploy llega antes que la migración 0044, la columna no existe, el
 * select nuevo falla y se cae al mismo fallback, que devuelve `esPlataforma:
 * false`. O sea: el portal sigue cargando y NADIE ve las pantallas de
 * plataforma. El error cae del lado seguro (fail closed). Cuando la 0044
 * aterrice, SOMOS DER las recupera sola, sin deploy.
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
  /**
   * ¿Esta organización es la DUEÑA del producto (migración 0044)?
   * Decide si el que mira ve las pantallas de plataforma, como /leads. Es una
   * decisión de producto, no un rol: adentro de una org los roles siguen siendo
   * owner y writer.
   */
  esPlataforma: boolean;
}

interface FilaMyOrgs {
  organization_id: string | null;
  role: string | null;
  org_name: string | null;
  org_slug: string | null;
  es_plataforma: boolean | null;
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

    // Camino nuevo (migración 0035): todas mis organizaciones. limit(1) es lo
    // que evita el PGRST116 de maybeSingle().
    //
    // ⚠️ LA PLATAFORMA GANA SIEMPRE (3/8). Antes esto ordenaba SOLO por
    // `created_at` ascendente, o sea "la organización más vieja". Con una sola
    // organización por persona daba igual, pero apenas alguien pertenece a dos
    // el criterio es arbitrario y elige mal.
    //
    // Pasó de verdad, hoy: Franco entró con un tercer mail
    // (fraannqiitoo@gmail.com), el alta automática le creó `somos-der-2` con
    // es_plataforma=false, y esa membresía quedó siendo la única. Resultado: el
    // dueño del producto entrando a su propia app como si fuera un cliente,
    // sin Leads y sin Rentabilidad. Sumarlo a mano a la org buena tampoco lo
    // arreglaba, porque esa membresía sería MÁS NUEVA y perdía el desempate.
    //
    // Con `es_plataforma` primero, pertenecer a la plataforma alcanza para
    // trabajar como la plataforma, sin importar en qué orden se dieron de alta.
    // `created_at` queda como desempate entre organizaciones del mismo tipo,
    // que es el comportamiento que ya existía.
    const { data, error } = await supabase
      .from("staff_app_my_orgs")
      .select("organization_id, role, org_name, org_slug, es_plataforma")
      .order("es_plataforma", { ascending: false, nullsFirst: false })
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
        esPlataforma: fila.es_plataforma === true,
      };
    }

    // Fallback: la 0035 (o la 0044) todavía no está aplicada.
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
      // Fail closed: sin la 0044 no hay forma de saber quién es la plataforma,
      // así que nadie lo es y nadie ve sus pantallas.
      esPlataforma: false,
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

/**
 * Gate de PLATAFORMA para server actions: además de ser miembro de una org, esa
 * org tiene que ser la dueña del producto (migración 0044).
 *
 * Lo usan las acciones de las pantallas de plataforma, hoy /leads. Esconder el
 * ítem del menú NO es seguridad: el gate real es este, del lado del servidor.
 * Mismo contrato que exigirOrg (devuelve la org o tira "forbidden"), así los
 * consumidores no cambian de forma.
 */
export async function exigirPlataforma(): Promise<OrgActual> {
  const org = await exigirOrg();
  if (!org.esPlataforma) throw new Error("forbidden");
  return org;
}
