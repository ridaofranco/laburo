import "server-only";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { LABURO_ORG_COOKIE, esUuid } from "@/lib/org-cookie";

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
 * ordenadas. Devuelve además el id de la org, que es lo que las server actions
 * le pasan a las RPCs que corren con service_role (las que no tienen forma de
 * deducirla solas).
 *
 * ── CUÁL DE TODAS, DESDE EL 5/9: LA QUE ELIGIÓ EL USUARIO ───────────────────
 * Antes acá decía "quedate con la primera", y era la única regla. Ya no: ahora
 * manda la cookie `laburo_org_id`, que setea el selector de contexto. El orden
 * es:
 *
 *   1. Hay cookie, tiene forma de UUID, y esa organización está entre las del
 *      usuario  →  esa.
 *   2. Cualquier otro caso  →  la más antigua, que es el comportamiento de
 *      siempre.
 *
 * **El paso 2 se come en silencio una cookie inválida, vencida o ajena, y eso
 * es deliberado.** Una cookie con el UUID de una organización de la que no sos
 * miembro no habilita nada y tampoco produce un error distinto: quien la pise a
 * mano no aprende nada del sistema, solo vuelve a su organización de siempre.
 *
 * ⚠️ La validación va contra `staff_app_my_orgs`, que es `security_invoker`: la
 * RLS ya filtra a las organizaciones del que consulta, así que "aparece en la
 * lista" ES la prueba de membresía. No hay ni tiene que haber una validación
 * propia contra `organizations`.
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
 *
 * ── ⚠️ LA TRAMPA QUE SE VA A OLVIDAR PRIMERO: LA BASE TAMBIÉN ADIVINA ───────
 * Esta lógica está DUPLICADA adentro de Postgres:
 *
 *     staff_app.current_org_id()  → la membresía MÁS ANTIGUA del usuario
 *     staff_app.resolve_org(p_org) → coalesce(p_org, current_org_id(), default_org_id())
 *
 * Nueve funciones de escritura resuelven su organización así. Por eso
 * `exigirOrg()` NO alcanza como portero: si su resultado no viaja a la RPC como
 * `p_org`, el gate valida una organización y la base escribe en otra. Está
 * reproducido contra producción: con dos membresías, `staff_app_create_gig` sin
 * `p_org` creó el evento en SOMOS DER en vez de en la productora.
 *
 * **Regla: toda escritura pasa `p_org` explícito.** Ya lo hacen las ocho que
 * aceptan el parámetro (create_gig, update_gig, set_gig_details, set_gig_slots,
 * set_gig_payment_pref, create_offer, rate_staff, set_candidate_note) más
 * marcar_pago_listo.
 *
 * **La única que queda afuera a propósito:**
 * `staff_app_generar_link_proveedor(p_profile_id uuid, p_dias int)` (0042:164)
 * **NO tiene `p_org` en su firma**: mandárselo es un PGRST202 garantizado.
 * Resuelve su organización leyendo `profile_org_links`, o sea desde el PERFIL y
 * no desde el usuario, que para ese caso es lo correcto. Sólo cae a
 * `resolve_org(NULL)` si el perfil no tiene vínculo. Hoy, además, ningún archivo
 * del código la llama. Se deja como está.
 *
 * ── Y POR QUÉ `default_org_id()` NO ES UN AGUJERO ──────────────────────────
 * El tercer nivel del coalesce deposita en SOMOS DER (la organización
 * plataforma), así que a simple vista parece que un usuario sin contexto termina
 * en la organización más poderosa. **Cae del lado seguro**: las nueve funciones
 * gatean DESPUÉS con `is_org_writer(v_org)`, y un usuario sin membresía ahí no
 * es writer. El tercer nivel existe para los llamados sin `auth.uid()` (cron,
 * webhook, formulario público), que no tienen otra forma de resolver. No se
 * toca.
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
  /**
   * ¿Esta organización la eligió el usuario con el selector, o ganó el fallback
   * de "la más antigua"? La interfaz lo necesita para no mentir: si el fallback
   * ganó porque la cookie era inválida, el selector no puede mostrarse como si
   * el usuario hubiera elegido eso.
   */
  elegidaPorElUsuario: boolean;
}

interface FilaMyOrgs {
  organization_id: string | null;
  role: string | null;
  org_name: string | null;
  org_slug: string | null;
  es_plataforma: boolean | null;
}

function desdeFila(fila: FilaMyOrgs, elegida: boolean): OrgActual {
  return {
    organizationId: fila.organization_id ?? null,
    rol: (fila.role ?? "").toLowerCase() || null,
    nombre: fila.org_name ?? null,
    slug: fila.org_slug ?? null,
    esPlataforma: fila.es_plataforma === true,
    elegidaPorElUsuario: elegida,
  };
}

/**
 * TODAS las organizaciones del usuario, la más antigua primero.
 *
 * Es la misma vista que usa `orgActual()`, sin el `limit(1)`. Alimenta al
 * selector de contexto y es además la lista contra la que se valida la cookie:
 * como `staff_app_my_orgs` es `security_invoker`, estar en esta lista ES la
 * prueba de membresía.
 *
 * FAIL-CLOSED: ante cualquier error devuelve `[]`, y sin organizaciones no hay
 * selector ni cookie válida posible.
 */
export async function orgsDelUsuario(): Promise<OrgActual[]> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("staff_app_my_orgs")
      .select("organization_id, role, org_name, org_slug, es_plataforma")
      .order("created_at", { ascending: true });

    if (error || !data) return [];
    return (data as FilaMyOrgs[]).map((f) => desdeFila(f, false));
  } catch {
    return [];
  }
}

/**
 * La organización con la que está trabajando el usuario logueado.
 * Devuelve null si no es miembro de ninguna (o si no hay sesión).
 *
 * Cuál de todas: la de la cookie si es suya, y si no la más antigua. Ver el
 * header, sección "CUÁL DE TODAS".
 *
 * FAIL-CLOSED: ante cualquier error devuelve null, y todos los gates que la usan
 * tratan null como "no sos miembro".
 */
export async function orgActual(): Promise<OrgActual | null> {
  try {
    const supabase = await createClient();

    // Camino nuevo (migración 0035): todas mis organizaciones, la más antigua
    // primero. Sin limit(1) porque la cookie puede pedir cualquiera de ellas, y
    // pedir la lista entera es además lo que evita el PGRST116 de maybeSingle().
    const { data, error } = await supabase
      .from("staff_app_my_orgs")
      .select("organization_id, role, org_name, org_slug, es_plataforma")
      .order("created_at", { ascending: true });

    if (!error) {
      const filas = (data ?? []) as FilaMyOrgs[];
      if (filas.length === 0) return null;

      // La cookie es entrada NO confiable: se valida el formato y después se
      // busca EN LA LISTA que ya filtró la RLS. Si no está, se ignora entera y
      // gana la más antigua, sin error ni mensaje distinto.
      const elegida = (await cookies()).get(LABURO_ORG_COOKIE)?.value;
      if (esUuid(elegida)) {
        const suya = filas.find((f) => f.organization_id === elegida);
        if (suya) return desdeFila(suya, true);
      }

      return desdeFila(filas[0], false);
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
      // La vista vieja no sabe de varias organizaciones, así que acá no hay nada
      // que elegir y la cookie no juega.
      elegidaPorElUsuario: false,
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
